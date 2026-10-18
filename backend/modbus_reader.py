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
import time
from datetime import datetime, timezone

import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import RealDictCursor
from pymodbus.client import ModbusTcpClient

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
                "SELECT device_id, ip_address, port, virtual_id, register_address FROM power_meters "
                "WHERE enabled ORDER BY device_id"
            )
            return {r["device_id"]: r for r in cur.fetchall()}
    finally:
        conn.close()


def fingerprint(cfg: dict) -> tuple:
    return (cfg["ip_address"], cfg["port"], cfg["virtual_id"], cfg["register_address"])


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

    def _last_energy(self, conn) -> float:
        with conn.cursor() as cur:
            cur.execute("SELECT energy FROM energy_readings WHERE device_id = %s ORDER BY time DESC LIMIT 1",
                        (self.device_id,))
            row = cur.fetchone()
        conn.commit()
        return float(row["energy"]) if row and row["energy"] is not None else 0.0

    def run(self):
        cfg = self.cfg
        unit = cfg["virtual_id"] if cfg["virtual_id"] is not None else 1
        register = cfg["register_address"] or 0
        conn, client, energy = None, None, 0.0
        self.log.info("Mulai membaca %s:%s (Virtual ID %s, register %s)", cfg["ip_address"], cfg["port"], unit, register)

        while not self.stop_event.is_set():
            wait = READ_INTERVAL
            try:
                if conn is None or conn.closed:
                    conn = connect_db()
                    energy = self._last_energy(conn)

                if client is None:
                    client = ModbusTcpClient(cfg["ip_address"], port=cfg["port"], timeout=CONNECT_TIMEOUT)
                    if not client.connect():
                        client = None
                        self._set_status(conn, "offline")
                        self.log.warning("Gagal connect, coba lagi dalam %.0f detik", RECONNECT_INTERVAL)
                        self.stop_event.wait(RECONNECT_INTERVAL)
                        continue
                    self.log.info("Tersambung")

                result = client.read_holding_registers(address=register, count=3, slave=unit)
                if result.isError():
                    # Tersambung tapi pembacaan ditolak: biasanya Virtual ID atau alamat register salah
                    self._set_status(conn, "error")
                    self.log.error("Pembacaan ditolak device: %s", result)
                    client.close()
                    client = None
                    wait = RECONNECT_INTERVAL
                else:
                    arus, tegangan, daya = result.registers[0] / 100.0, result.registers[1] / 10.0, float(result.registers[2])
                    energy += (daya / 1000.0) * (READ_INTERVAL / 3600.0)  # kWh
                    ts = datetime.now(timezone.utc)
                    with conn.cursor() as cur:
                        cur.execute(
                            "INSERT INTO energy_readings (time, device_id, arus, tegangan, daya, energy) "
                            "VALUES (%s, %s, %s, %s, %s, %s)",
                            (ts, self.device_id, arus, tegangan, daya, energy),
                        )
                    conn.commit()
                    self.log.info("arus=%.2fA tegangan=%.1fV daya=%.0fW", arus, tegangan, daya)

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
