"""
modbus_reader.py
-----------------
Service pembaca data dari power meter (Modbus TCP) dan penyimpan
ke TimescaleDB, dengan timestamp akurat + auto-reconnect (F-02, F-03).
Tugas: Rifa - Poin 3d

Cara pakai:
    python modbus_reader.py

Alur kerja:
    1. Coba connect ke device Modbus (host & port dari .env / default)
    2. Kalau berhasil: baca register tiap READ_INTERVAL detik, simpan ke DB
    3. Kalau koneksi terputus / gagal connect: otomatis retry terus
       dengan jeda RECONNECT_INTERVAL detik, sampai berhasil lagi
    4. Setiap perubahan status (online/offline) tercatat otomatis lewat
       trigger database (trg_power_meters_status_log) yang sudah dibuat
       di poin 1c -- service ini cukup UPDATE kolom status saja.
"""

import logging
import os
import time
from datetime import datetime, timezone

import psycopg2
from dotenv import load_dotenv
from pymodbus.client import ModbusTcpClient
from pymodbus.exceptions import ModbusException

# ------------------------------------------------------------
# Konfigurasi
# ------------------------------------------------------------
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

DEVICE_ID = "PM-001"              # samakan dengan device_id di tabel power_meters
MODBUS_HOST = "127.0.0.1"         # ganti ke IP power meter asli nanti
MODBUS_PORT = 5020                # ganti ke 502 kalau pakai device/simulator asli

READ_INTERVAL = 5                 # detik, jeda antar pembacaan saat online
RECONNECT_INTERVAL = 5            # detik, jeda antar percobaan reconnect saat offline

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("modbus_reader")


# ------------------------------------------------------------
# Koneksi Database
# ------------------------------------------------------------
def get_db_connection():
    """Bikin koneksi baru ke PostgreSQL/TimescaleDB."""
    return psycopg2.connect(DATABASE_URL)


def update_device_status(conn, device_id: str, status: str):
    """Update status device di tabel power_meters (trigger otomatis catat log)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE power_meters
            SET status = %s,
                last_seen_at = CASE WHEN %s = 'online' THEN now() ELSE last_seen_at END
            WHERE device_id = %s
            """,
            (status, status, device_id),
        )
    conn.commit()


def insert_reading(conn, device_id: str, arus: float, tegangan: float, daya: float, energy: float):
    """Simpan satu baris pembacaan ke hypertable energy_readings dengan timestamp akurat (F-03)."""
    timestamp = datetime.now(timezone.utc)  # UTC, akurat & konsisten (F-03)
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO energy_readings (time, device_id, arus, tegangan, daya, energy)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (timestamp, device_id, arus, tegangan, daya, energy),
        )
    conn.commit()
    log.info(
        "Tersimpan -> device=%s arus=%.2fA tegangan=%.1fV daya=%.1fW @ %s",
        device_id, arus, tegangan, daya, timestamp.isoformat(),
    )


# ------------------------------------------------------------
# Pembacaan Modbus
# ------------------------------------------------------------
def read_power_meter(client: ModbusTcpClient):
    """
    Baca 3 holding register: arus (x100), tegangan (x10), daya (bulat).
    Sesuaikan alamat register & faktor skala ini dengan datasheet
    power meter ASLI kalau device fisiknya sudah didapat (bukan simulator).
    """
    result = client.read_holding_registers(address=0, count=3)
    if result.isError():
        raise ModbusException(f"Gagal baca register: {result}")

    arus = result.registers[0] / 100.0
    tegangan = result.registers[1] / 10.0
    daya = float(result.registers[2])
    return arus, tegangan, daya


# ------------------------------------------------------------
# Loop utama -- termasuk logic AUTO-RECONNECT
# ------------------------------------------------------------
def run():
    conn = get_db_connection()
    running_energy = 0.0
    client = None
    is_connected = False

    log.info("Memulai modbus_reader untuk device_id=%s (%s:%s)", DEVICE_ID, MODBUS_HOST, MODBUS_PORT)

    while True:
        try:
            # --- Kalau belum connect / baru putus, coba connect ulang ---
            if not is_connected:
                log.info("Mencoba connect ke device...")
                client = ModbusTcpClient(MODBUS_HOST, port=MODBUS_PORT, timeout=3)

                if client.connect():
                    is_connected = True
                    update_device_status(conn, DEVICE_ID, "online")
                    log.info("Berhasil connect ke device %s.", DEVICE_ID)
                else:
                    update_device_status(conn, DEVICE_ID, "offline")
                    log.warning(
                        "Gagal connect, coba lagi dalam %s detik...", RECONNECT_INTERVAL
                    )
                    time.sleep(RECONNECT_INTERVAL)
                    continue  # ulangi loop, coba connect lagi

            # --- Kalau sudah connect, baca data & simpan ---
            arus, tegangan, daya = read_power_meter(client)
            running_energy += (daya / 1000.0) * (READ_INTERVAL / 3600.0)  # kWh
            insert_reading(conn, DEVICE_ID, arus, tegangan, daya, running_energy)

            time.sleep(READ_INTERVAL)

        except (ModbusException, ConnectionError, OSError) as e:
            # --- Koneksi terputus di tengah jalan -> tandai offline, siap reconnect ---
            log.error("Koneksi ke device terputus: %s", e)
            is_connected = False
            if client:
                client.close()
            update_device_status(conn, DEVICE_ID, "offline")
            log.info("Akan mencoba reconnect dalam %s detik...", RECONNECT_INTERVAL)
            time.sleep(RECONNECT_INTERVAL)

        except KeyboardInterrupt:
            log.info("Dihentikan oleh user (Ctrl+C).")
            break

        except Exception as e:
            # Jaga-jaga: error tak terduga jangan sampai bikin service mati total
            log.exception("Error tak terduga: %s", e)
            time.sleep(RECONNECT_INTERVAL)

    if client:
        client.close()
    conn.close()
    log.info("modbus_reader berhenti.")


if __name__ == "__main__":
    run()
