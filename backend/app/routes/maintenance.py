"""
routes/maintenance.py
---------------------
Alat admin di halaman Maintenance:
  GET  /maintenance/audit-logs   jejak aktivitas pengguna (NF-08)
  GET  /maintenance/backup       unduh konfigurasi device sebagai file JSON
  POST /maintenance/restore      pulihkan konfigurasi dari file backup (digabung, tidak ada yang dihapus)

Restore bersifat "semua atau tidak sama sekali": kalau ada satu data yang salah,
tidak ada perubahan yang disimpan. File dicek dengan checksum SHA-256 untuk
mendeteksi file rusak/berubah (SRS: pesan "File Korup").
"""

import hashlib
import hmac
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.concurrency import run_in_threadpool
from pydantic import ValidationError
from psycopg2.extras import Json

from ..audit import record
from ..database import get_db
from ..deps import get_current_user, require_roles
from ..modbus_registers import MEASUREMENT_FIELDS
from ..schemas import AuditLogList, DeviceCreate, EnergyTariffOut, EnergyTariffUpdate, RestoreResult
from .devices import check_ip

router = APIRouter(prefix="/maintenance", tags=["Maintenance"])

FORMAT, VERSION = "semfs-config", 1
MAX_BACKUP_BYTES = 1_000_000
MAX_DEVICES = 500
CONFIG_FIELDS = ("device_id", "device_name", "ip_address", "port", "virtual_id",
                 "register_address", "register_map", "register_config", "location",
                 "power_limit_w", "enabled")


def _checksum(body: dict) -> str:
    canonical = json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _corrupt(detail: str = "File Korup") -> HTTPException:
    return HTTPException(status_code=422, detail=detail)


@router.get("/audit-logs", response_model=AuditLogList)
def audit_logs(
    limit: int = Query(50, ge=1, le=200),
    before_id: int | None = Query(None, ge=1),
    action: str | None = Query(None, max_length=40),
    admin=Depends(require_roles("admin")),
    conn=Depends(get_db),
):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, at, username, action, entity, entity_id, detail, ip FROM audit_logs
            WHERE (%s::bigint IS NULL OR id < %s) AND (%s::text IS NULL OR action = %s)
            ORDER BY id DESC LIMIT %s
            """,
            (before_id, before_id, action, action, limit + 1),
        )
        rows = cur.fetchall()
    items = rows[:limit]
    return {"items": items, "next_before_id": items[-1]["id"] if len(rows) > limit else None}


@router.get("/energy-tariff", response_model=EnergyTariffOut)
def get_energy_tariff(user=Depends(get_current_user), conn=Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute("SELECT price_per_kwh FROM system_settings WHERE id = 1")
        row = cur.fetchone()
    if row is None:
        raise HTTPException(status_code=503, detail="Pengaturan tarif belum tersedia. Jalankan migration terbaru.")
    return row


@router.put("/energy-tariff", response_model=EnergyTariffOut)
def update_energy_tariff(
    body: EnergyTariffUpdate,
    request: Request,
    user=Depends(require_roles("admin", "operator")),
    conn=Depends(get_db),
):
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE system_settings SET price_per_kwh = %s, updated_at = now() WHERE id = 1 "
            "RETURNING price_per_kwh",
            (body.price_per_kwh,),
        )
        row = cur.fetchone()
    if row is None:
        raise HTTPException(status_code=503, detail="Pengaturan tarif belum tersedia. Jalankan migration terbaru.")
    record(
        conn,
        "energy_tariff_update",
        user=user,
        entity="system_settings",
        detail=f"Tarif energi diperbarui menjadi Rp {body.price_per_kwh}/kWh",
        request=request,
    )
    conn.commit()
    return row


@router.get("/backup")
def backup(request: Request, admin=Depends(require_roles("admin")), conn=Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute(f"SELECT {', '.join(CONFIG_FIELDS)} FROM power_meters ORDER BY device_id")
        devices = [dict(r) for r in cur.fetchall()]
    body = {"format": FORMAT, "version": VERSION, "created_at": datetime.now(timezone.utc).isoformat(), "devices": devices}
    payload = {**body, "checksum": _checksum(body)}
    record(conn, "config_backup", user=admin, entity="config", detail=f"{len(devices)} device", request=request)
    conn.commit()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M")
    return Response(
        content=json.dumps(payload, ensure_ascii=False, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="semfs-config-{stamp}.json"'},
    )


def _apply_restore(conn, admin: dict, payload, request) -> dict:
    if (not isinstance(payload, dict) or payload.get("format") != FORMAT or payload.get("version") != VERSION
            or not isinstance(payload.get("devices"), list) or not isinstance(payload.get("checksum"), str)):
        raise _corrupt("File Korup: bukan file backup SEMFS yang valid")
    claimed = payload.pop("checksum")
    if not hmac.compare_digest(claimed, _checksum(payload)):
        raise _corrupt("File Korup: isi file berubah atau rusak")
    if len(payload["devices"]) > MAX_DEVICES:
        raise _corrupt(f"File terlalu besar (maksimal {MAX_DEVICES} device)")

    devices, seen = [], set()
    for raw in payload["devices"]:
        try:
            device_data = {k: raw[k] for k in CONFIG_FIELDS if isinstance(raw, dict) and k in raw}
            if isinstance(raw, dict) and "register_config" not in raw and "register_map" not in raw:
                base_address = raw.get("register_address") or 0
                device_data["register_map"] = {
                    field: base_address + index * 2
                    for index, field in enumerate(MEASUREMENT_FIELDS)
                }
            # Nilai kosong untuk field berikut = pakai bawaan (Virtual ID 1, register 0, port 502, aktif).
            # Device sampel lama bisa punya Virtual ID/register kosong di database.
            nullable_defaults = ("port", "virtual_id", "register_address", "register_map",
                                 "register_config", "enabled")
            dev = DeviceCreate(**{
                k: value for k, value in device_data.items()
                if not (k in nullable_defaults and value is None)
            })
        except (ValidationError, TypeError):
            name = raw.get("device_id") if isinstance(raw, dict) else "?"
            raise _corrupt(f"File Korup: data device tidak valid ({name})")
        if dev.device_id in seen:
            raise _corrupt(f"File Korup: Device ID ganda ({dev.device_id})")
        seen.add(dev.device_id)
        devices.append((dev, check_ip(dev.ip_address)))

    created = updated = 0
    with conn.cursor() as cur:
        for dev, ip in devices:
            cur.execute(
                """
                INSERT INTO power_meters (device_id, device_name, ip_address, port, virtual_id, register_address,
                                          register_map, register_config, location, power_limit_w, enabled)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (device_id) DO UPDATE SET
                    device_name = EXCLUDED.device_name, ip_address = EXCLUDED.ip_address, port = EXCLUDED.port,
                    virtual_id = EXCLUDED.virtual_id, register_address = EXCLUDED.register_address,
                    register_map = EXCLUDED.register_map, register_config = EXCLUDED.register_config,
                    location = EXCLUDED.location,
                    power_limit_w = EXCLUDED.power_limit_w, enabled = EXCLUDED.enabled
                RETURNING (xmax = 0) AS inserted
                """,
                (
                    dev.device_id, dev.device_name, ip, dev.port, dev.virtual_id,
                    min(item.address for item in dev.register_config),
                    Json({item.key: item.address for item in dev.register_config}),
                    Json([item.model_dump() for item in dev.register_config]),
                    dev.location, dev.power_limit_w, dev.enabled,
                ),
            )
            if cur.fetchone()["inserted"]:
                created += 1
            else:
                updated += 1
        cur.execute(
            "SELECT ip_address, port, virtual_id FROM power_meters GROUP BY 1, 2, 3 HAVING count(*) > 1 LIMIT 1"
        )
        dup = cur.fetchone()
        if dup:
            conn.rollback()
            raise HTTPException(
                status_code=409,
                detail=(
                    "Hasil pemulihan memuat kombinasi IP/port/Virtual ID ganda "
                    f"({dup['ip_address']}:{dup['port']}, ID {dup['virtual_id']}). "
                    "IP yang sama boleh dipakai jika port atau Virtual ID berbeda. Tidak ada yang diubah."
                ),
            )
    record(conn, "config_restore", user=admin, entity="config", detail=f"{created} baru, {updated} diperbarui", request=request)
    conn.commit()
    return {"created": created, "updated": updated, "message": f"Pemulihan selesai: {created} device baru, {updated} diperbarui."}


@router.post("/restore", response_model=RestoreResult)
async def restore(request: Request, admin=Depends(require_roles("admin")), conn=Depends(get_db)):
    chunks, total = [], 0
    async for chunk in request.stream():
        total += len(chunk)
        if total > MAX_BACKUP_BYTES:
            raise HTTPException(status_code=413, detail="File terlalu besar (maksimal 1 MB)")
        chunks.append(chunk)
    try:
        payload = json.loads(b"".join(chunks).decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        raise _corrupt()
    return await run_in_threadpool(_apply_restore, conn, admin, payload, request)
