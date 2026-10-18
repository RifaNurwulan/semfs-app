"""
routes/devices.py
-----------------
Konfigurasi device Modbus (SRS: Atur IP Address, Atur Virtual ID, Kelola Register, Simpan Konfigurasi).
  GET    /devices                  daftar device + status + uptime 24 jam (semua role yang login)
  POST   /devices                  tambah device                 (admin)
  PUT    /devices/{id}             ubah konfigurasi              (admin)
  DELETE /devices/{id}             hapus (?purge=true = beserta data historis) (admin)
  POST   /devices/{id}/test        uji koneksi Modbus            (admin)

Pembaca Modbus (modbus_reader.py) membaca konfigurasi dari tabel yang sama,
jadi perubahan di sini berlaku otomatis tanpa restart.
"""

import ipaddress
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.concurrency import run_in_threadpool
from psycopg2 import errors

from ..audit import record
from ..database import get_db
from ..deps import get_current_user, require_roles
from ..schemas import DeviceCreate, DeviceOut, DeviceUpdate, MessageResponse, ProbeResult

router = APIRouter(prefix="/devices", tags=["Perangkat"])

COLS = ("id, device_id, device_name, ip_address, port, virtual_id, register_address, location, "
        "status, last_seen_at, enabled, power_limit_w, created_at")


def check_ip(value: str) -> str:
    """Pesan sesuai SRS (alternative flow Maintenance): 'Format IP Invalid'."""
    try:
        return str(ipaddress.ip_address(value.strip()))
    except ValueError:
        raise HTTPException(status_code=422, detail="Format IP Invalid")


def _uptime_24h(conn, devices: list[dict]) -> dict[str, float | None]:
    """Persentase waktu 'online' dalam 24 jam terakhir, dihitung dari riwayat status (maintenance_logs)."""
    now = datetime.now(timezone.utc)
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT device_id, event_type, logged_at FROM maintenance_logs
            WHERE event_type IN ('connect', 'reconnect', 'disconnect', 'error')
              AND logged_at >= now() - interval '25 hours'
            ORDER BY device_id, logged_at
            """
        )
        events = defaultdict(list)
        for r in cur.fetchall():
            events[r["device_id"]].append((r["logged_at"], r["event_type"] in ("connect", "reconnect")))

    result: dict[str, float | None] = {}
    for d in devices:
        start = max(now - timedelta(hours=24), d["created_at"])
        evs = [(t, up) for t, up in events.get(d["device_id"], []) if t >= start]
        if not evs and d["last_seen_at"] is None:
            result[d["device_id"]] = None  # belum pernah terhubung
            continue
        up_now = (not evs[0][1]) if evs else d["status"] == "online"  # status di awal jendela
        cursor, online = start, timedelta()
        for t, up in evs:
            if up_now:
                online += t - cursor
            cursor, up_now = t, up
        if up_now:
            online += now - cursor
        total = (now - start).total_seconds()
        result[d["device_id"]] = round(100 * online.total_seconds() / total, 1) if total > 0 else None
    return result


def _with_uptime(conn, rows: list[dict]) -> list[dict]:
    up = _uptime_24h(conn, rows)
    return [{**r, "uptime_24h": up.get(r["device_id"])} for r in rows]


def _conflict_endpoint(cur, ip: str, port: int, unit: int | None, exclude: str | None = None):
    cur.execute(
        "SELECT device_id FROM power_meters WHERE ip_address = %s AND port = %s AND virtual_id IS NOT DISTINCT FROM %s "
        "AND (%s::text IS NULL OR device_id <> %s)",
        (ip, port, unit, exclude, exclude),
    )
    other = cur.fetchone()
    if other:
        raise HTTPException(status_code=409, detail=f"IP Address, port, dan Virtual ID sudah dipakai device {other['device_id']}")


@router.get("", response_model=list[DeviceOut])
def list_devices(user=Depends(get_current_user), conn=Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute(f"SELECT {COLS} FROM power_meters ORDER BY device_id")
        return _with_uptime(conn, cur.fetchall())


@router.post("", response_model=DeviceOut, status_code=status.HTTP_201_CREATED)
def create_device(body: DeviceCreate, request: Request, admin=Depends(require_roles("admin")), conn=Depends(get_db)):
    ip = check_ip(body.ip_address)
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM power_meters WHERE device_id = %s", (body.device_id,))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="Device ID sudah dipakai")
        _conflict_endpoint(cur, ip, body.port, body.virtual_id)
        try:
            cur.execute(
                f"""
                INSERT INTO power_meters (device_id, device_name, ip_address, port, virtual_id, register_address,
                                          location, power_limit_w, enabled)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING {COLS}
                """,
                (body.device_id, body.device_name, ip, body.port, body.virtual_id, body.register_address,
                 body.location, body.power_limit_w, body.enabled),
            )
        except errors.UniqueViolation:
            conn.rollback()
            raise HTTPException(status_code=409, detail="Device ID sudah dipakai")
        row = cur.fetchone()
    record(conn, "device_create", user=admin, entity="device", entity_id=body.device_id, detail=f"{ip}:{body.port}", request=request)
    conn.commit()
    return _with_uptime(conn, [row])[0]


@router.put("/{device_id}", response_model=DeviceOut)
def update_device(device_id: str, body: DeviceUpdate, request: Request,
                  admin=Depends(require_roles("admin")), conn=Depends(get_db)):
    changes = body.model_dump(exclude_unset=True)
    with conn.cursor() as cur:
        cur.execute(f"SELECT {COLS} FROM power_meters WHERE device_id = %s", (device_id,))
        cur_row = cur.fetchone()
        if cur_row is None:
            raise HTTPException(status_code=404, detail="Device tidak ditemukan")
        if "ip_address" in changes:
            if changes["ip_address"] is None:
                raise HTTPException(status_code=422, detail="Format IP Invalid")
            changes["ip_address"] = check_ip(changes["ip_address"])
        for required in ("port", "virtual_id", "register_address", "enabled"):
            if required in changes and changes[required] is None:
                raise HTTPException(status_code=422, detail=f"{required} tidak boleh kosong")
        merged = {**cur_row, **changes}
        _conflict_endpoint(cur, merged["ip_address"], merged["port"], merged["virtual_id"], exclude=device_id)
        if not changes:
            return _with_uptime(conn, [cur_row])[0]
        # Nama kolom berasal dari model Pydantic (bukan input mentah), nilai lewat parameter.
        sets = ", ".join(f"{k} = %s" for k in changes)
        cur.execute(f"UPDATE power_meters SET {sets} WHERE device_id = %s RETURNING {COLS}", (*changes.values(), device_id))
        row = cur.fetchone()
    record(conn, "device_update", user=admin, entity="device", entity_id=device_id, detail=", ".join(sorted(changes)), request=request)
    conn.commit()
    return _with_uptime(conn, [row])[0]


@router.delete("/{device_id}", response_model=MessageResponse)
def delete_device(device_id: str, request: Request, purge: bool = False,
                  admin=Depends(require_roles("admin")), conn=Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM power_meters WHERE device_id = %s", (device_id,))
        if cur.fetchone() is None:
            raise HTTPException(status_code=404, detail="Device tidak ditemukan")
        cur.execute(
            """
            SELECT EXISTS (SELECT 1 FROM energy_readings WHERE device_id = %(d)s)
                OR EXISTS (SELECT 1 FROM forecast_results WHERE device_id = %(d)s)
                OR EXISTS (SELECT 1 FROM anomaly_detections WHERE device_id = %(d)s) AS has_data
            """,
            {"d": device_id},
        )
        if cur.fetchone()["has_data"] and not purge:
            raise HTTPException(
                status_code=409,
                detail="Device memiliki data historis. Nonaktifkan saja, atau hapus beserta seluruh datanya.",
            )
        for table in ("energy_readings", "forecast_results", "anomaly_detections", "maintenance_logs"):
            cur.execute(f"DELETE FROM {table} WHERE device_id = %s", (device_id,))  # nama tabel tetap (bukan input)
        cur.execute("DELETE FROM power_meters WHERE device_id = %s", (device_id,))
    record(conn, "device_delete", user=admin, entity="device", entity_id=device_id, detail="beserta data" if purge else None, request=request)
    conn.commit()
    return {"message": f"Device {device_id} dihapus."}


def _probe(dev: dict) -> dict:
    try:
        from pymodbus.client import ModbusTcpClient
    except ImportError:
        return {"ok": False, "message": "Library pymodbus belum terpasang di server"}
    client = ModbusTcpClient(dev["ip_address"], port=dev["port"], timeout=3)
    try:
        if not client.connect():
            return {"ok": False, "message": f"Tidak dapat terhubung ke {dev['ip_address']}:{dev['port']}"}
        res = client.read_holding_registers(address=dev["register_address"] or 0, count=3, slave=dev["virtual_id"] if dev["virtual_id"] is not None else 1)
        if res.isError():
            return {"ok": False, "message": "Device terhubung, tetapi gagal membaca register. Periksa Virtual ID dan alamat register."}
        r = res.registers
        return {"ok": True, "message": "Koneksi berhasil", "arus": r[0] / 100, "tegangan": r[1] / 10, "daya": float(r[2])}
    except Exception as e:  # jaringan putus, timeout, dsb.
        return {"ok": False, "message": f"Koneksi gagal: {type(e).__name__}"}
    finally:
        client.close()


@router.post("/{device_id}/test", response_model=ProbeResult)
async def test_connection(device_id: str, request: Request, admin=Depends(require_roles("admin")), conn=Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute(f"SELECT {COLS} FROM power_meters WHERE device_id = %s", (device_id,))
        dev = cur.fetchone()
    if dev is None:
        raise HTTPException(status_code=404, detail="Device tidak ditemukan")
    result = await run_in_threadpool(_probe, dev)
    record(conn, "device_test", user=admin, entity="device", entity_id=device_id, detail="berhasil" if result["ok"] else "gagal", request=request)
    conn.commit()
    return result
