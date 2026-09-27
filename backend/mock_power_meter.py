"""
mock_power_meter.py
--------------------
Simulator Modbus TCP -- pura-pura jadi power meter asli.
Tugas: Rifa - Poin 3d (bagian testing)

Cara pakai:
    python mock_power_meter.py

Register yang disediakan (Holding Register, alamat mulai dari 0):
    0 -> Arus   (Ampere x 100, misal 512 berarti 5.12 A)
    1 -> Tegangan (Volt x 10, misal 2201 berarti 220.1 V)
    2 -> Daya   (Watt, bilangan bulat)

Nilainya di-random ulang tiap 2 detik biar keliatan "hidup".
Untuk simulasi device OFFLINE (uji auto-reconnect), tinggal
tekan Ctrl+C buat matiin program ini, lalu jalankan lagi nanti.
"""

import asyncio
import logging
import random

from pymodbus.datastore import (
    ModbusSequentialDataBlock,
    ModbusServerContext,
    ModbusSlaveContext,
)
from pymodbus.server import StartAsyncTcpServer

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("mock_power_meter")

HOST = "127.0.0.1"
PORT = 5020  # sengaja BUKAN 502 (default Modbus), biar tidak perlu izin admin di Windows


def build_context() -> ModbusServerContext:
    """Siapkan data register awal (nilai default sebelum di-random)."""
    block = ModbusSequentialDataBlock(0, [0] * 10)
    slave_ctx = ModbusSlaveContext(hr=block)
    return ModbusServerContext(slaves=slave_ctx, single=True)


async def randomizer(context: ModbusServerContext):
    """Update nilai register tiap 2 detik supaya datanya 'hidup'."""
    slave_ctx = context[0]
    while True:
        arus = random.uniform(4.0, 16.0)          # 4 - 16 Ampere
        tegangan = random.uniform(215.0, 225.0)    # 215 - 225 Volt
        daya = arus * tegangan                     # P = V x I (Watt)

        slave_ctx.setValues(3, 0, [int(arus * 100)])       # register 0
        slave_ctx.setValues(3, 1, [int(tegangan * 10)])    # register 1
        slave_ctx.setValues(3, 2, [int(daya)])              # register 2

        log.info(
            "Update register -> arus=%.2fA tegangan=%.1fV daya=%.1fW",
            arus, tegangan, daya,
        )
        await asyncio.sleep(2)


async def main():
    context = build_context()
    log.info("Mock Power Meter jalan di %s:%s (Ctrl+C untuk stop)", HOST, PORT)

    # Jalankan randomizer di background, server di foreground
    asyncio.create_task(randomizer(context))
    await StartAsyncTcpServer(context=context, address=(HOST, PORT))


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log.info("Mock Power Meter dihentikan.")
