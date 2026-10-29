"""
modbus_reader.py
----------------
Membaca SEMUA device aktif secara paralel dan menyimpannya ke TimescaleDB (F-02, F-03, NF-04).

- Daftar device (IP, port, Virtual ID, alamat register) dibaca dari tabel power_meters,
  yaitu yang diatur admin di halaman Maintenance. Tidak perlu restart: perubahan
  konfigurasi (tambah, ubah, nonaktifkan, hapus) terdeteksi otomatis tiap CONFIG_REFRESH detik.
- Satu thread per device. Device yang mati tidak mengganggu device lain.
- Auto-reconnect: kalau koneksi putus, dicoba lagi terus sampai tersambung.
- Status device (online/offline/error) ditulis ke database; trigger database membuat log
  dan notifikasi, dan trigger batas daya (F-13) membuat alert saat daya melebihi batas.

Jalankan dari folder backend (venv aktif):
    python modbus_reader.py        # hentikan dengan Ctrl+C
"""

import logging
import os
import signal
import threading
from datetime import datetime, timezone

import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import Json, RealDictCursor
from pymodbus.client import ModbusTcpClient

from app.modbus_registers import (
    DEFAULT_REGISTER_MAP,
    MEASUREMENT_DB_COLUMNS,
    MEASUREMENT_FIELDS,
    register_config_from_map,
    read_measurements,
)

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise SystemExit("DATABASE_URL belum diisi di file .env")

READ_INTERVAL = float(os.getenv("READ_INTERVAL", "5"))            # detik antar pembacaan
RECONNECT_INTERVAL = float(os.getenv("RECONNECT_INTERVAL", "5"))  # detik antar percobaan sambung ulang
CONFIG_REFRESH = float(os.getenv("CONFIG_REFRESH", "15"))         # detik antar pengecekan konfigurasi
CONNECT_TIMEOUT = 3

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("modbus_reader")


def connect_db():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def load_configs() -> dict[str, dict]:
    conn = connect_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT device_id, ip_address, port, virtual_id, register_address, register_map, register_config "
                "FROM power_meters "
                "WHERE enabled ORDER BY device_id"
            )
            return {r["device_id"]: r for r in cur.fetchall()}
    finally:
        conn.close()


def fingerprint(cfg: dict) -> tuple:
    return (
        cfg["ip_address"], cfg["port"], cfg["virtual_id"],
        tuple(
            tuple(sorted(item.items()))
            for item in (cfg.get("register_config") or register_config_from_map(
                cfg.get("register_map") or DEFAULT_REGISTER_MAP
            ))
        ),
    )


class DeviceWorker(threading.Thread):
    """Membaca satu device terus-menerus sampai diminta berhenti."""

    def __init__(self, cfg: dict):
        super().__init__(name=f"worker-{cfg['device_id']}", daemon=True)
        self.cfg = cfg
        self.device_id = cfg["device_id"]
        self.stop_event = threading.Event()
        self.log = logging.getLogger(self.device_id)

    def stop(self):
        self.stop_event.set()

    def _set_status(self, conn, status: str):
        with conn.cursor() as cur:
            cur.execute("UPDATE power_meters SET status = %s WHERE device_id = %s AND status <> %s",
                        (status, self.device_id, status))
        conn.commit()

    def run(self):
        cfg = self.cfg
        unit = cfg["virtual_id"] if cfg["virtual_id"] is not None else 1
        register_config = cfg.get("register_config") or register_config_from_map(
            cfg.get("register_map") or DEFAULT_REGISTER_MAP
        )
        conn, client = None, None
        self.log.info("Mulai membaca %s:%s (Virtual ID %s, %s parameter)",
                      cfg["ip_address"], cfg["port"], unit, len(register_config))

        while not self.stop_event.is_set():
            wait = READ_INTERVAL
            try:
                if conn is None or conn.closed:
                    conn = connect_db()

                if client is None:
                    client = ModbusTcpClient(cfg["ip_address"], port=cfg["port"], timeout=CONNECT_TIMEOUT)
                    if not client.connect():
                        client = None
                        self._set_status(conn, "offline")
                        self.log.warning("Gagal connect, coba lagi dalam %.0f detik", RECONNECT_INTERVAL)
                        self.stop_event.wait(RECONNECT_INTERVAL)
                        continue
                    self.log.info("Tersambung")

                measurements = read_measurements(client, unit, register_config)
                currents = [measurements.get(f"i_{phase}_a") for phase in ("r", "s", "t")]
                voltages = [measurements.get(f"v_{phase}n_v") for phase in ("r", "s", "t")]
                arus = sum(currents) / 3 if all(value is not None for value in currents) else None
                tegangan = sum(voltages) / 3 if all(value is not None for value in voltages) else None
                daya = measurements["p_total_kw"] * 1000 if "p_total_kw" in measurements else None
                columns = (
                    "time", "device_id", "arus", "tegangan", "daya", "energy",
                    *MEASUREMENT_DB_COLUMNS, "register_values",
                )
                values = (
                    datetime.now(timezone.utc), self.device_id, arus, tegangan, daya,
                    measurements.get("kwh_del"),
                    *(measurements.get(field) for field in MEASUREMENT_FIELDS),
                    Json(measurements),
                )
                placeholders = ", ".join(["%s"] * len(columns))
                with conn.cursor() as cur:
                    cur.execute(
                        f"INSERT INTO energy_readings ({', '.join(columns)}) VALUES ({placeholders})",
                        values,
                    )
                conn.commit()
                self.log.info(
                    "Pembacaan berhasil: %s parameter; arus=%sA tegangan=%sV daya=%sW",
                    len(measurements), arus, tegangan, daya,
                )

            except ValueError as e:
                self.log.error("Nilai register Modbus tidak valid: %s", e)
                if conn is not None and not conn.closed:
                    try:
                        self._set_status(conn, "error")
                    except psycopg2.Error as db_error:
                        self.log.error("Tidak bisa memperbarui status device: %s",
                                       str(db_error).strip().splitlines()[0])
                        conn.close()
                        conn = None
                if client is not None:
                    client.close()
                client = None
                wait = RECONNECT_INTERVAL
            except psycopg2.IntegrityError:
                conn.rollback()
                self.log.warning("Device sudah dihapus dari database, worker berhenti")
                break
            except psycopg2.Error as e:
                self.log.error("Masalah database: %s", str(e).strip().splitlines()[0])
                try:
                    conn.close()
                except Exception:
                    pass
                conn = None
                wait = RECONNECT_INTERVAL
            except Exception as e:  # putus koneksi / timeout Modbus
                self.log.error("Koneksi ke device terputus: %s", type(e).__name__)
                if client is not None:
                    client.close()
                client = None
                if conn is not None and not conn.closed:
                    try:
                        self._set_status(conn, "offline")
                    except psycopg2.Error:
                        conn = None
                wait = RECONNECT_INTERVAL

            self.stop_event.wait(wait)

        if client is not None:
            client.close()
        if conn is not None and not conn.closed:
            conn.close()
        self.log.info("Berhenti")


def main():
    workers: dict[str, DeviceWorker] = {}
    stop = threading.Event()

    def shutdown(*_):
        log.info("Menghentikan semua pembaca...")
        stop.set()

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)
    log.info("modbus_reader berjalan. Konfigurasi device dibaca dari database tiap %.0f detik.", CONFIG_REFRESH)

    while not stop.is_set():
        try:
            wanted = load_configs()
        except psycopg2.Error as e:
            log.error("Tidak bisa membaca konfigurasi dari database: %s", str(e).strip().splitlines()[0])
            stop.wait(CONFIG_REFRESH)
            continue

        for device_id, worker in list(workers.items()):
            cfg = wanted.get(device_id)
            if cfg is None or fingerprint(cfg) != fingerprint(worker.cfg) or not worker.is_alive():
                if cfg is None:
                    log.info("%s dinonaktifkan/dihapus -> pembacaan dihentikan", device_id)
                elif fingerprint(cfg) != fingerprint(worker.cfg):
                    log.info("%s konfigurasi berubah -> memulai ulang pembacaan", device_id)
                worker.stop()
                workers.pop(device_id)

        for device_id, cfg in wanted.items():
            if device_id not in workers:
                workers[device_id] = DeviceWorker(cfg)
                workers[device_id].start()

        stop.wait(CONFIG_REFRESH)

    for w in workers.values():
        w.stop()
    for w in workers.values():
        w.join(timeout=10)
    log.info("modbus_reader berhenti.")


if __name__ == "__main__":
    main()
