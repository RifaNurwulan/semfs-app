"""
mock_power_meter.py
-------------------
Simulator power meter (Modbus TCP) untuk testing tanpa alat asli. Bisa menjalankan BEBERAPA device sekaligus.

Cara pakai:
    python mock_power_meter.py                      # 1 device: port 5020, Virtual ID 1, register 0
    python mock_power_meter.py 5021:1:0 5022:2:10   # beberapa device, format  PORT:VIRTUAL_ID:REGISTER

Tiga register berurutan mulai dari alamat REGISTER:
    +0 arus (Ampere x 100)   +1 tegangan (Volt x 10)   +2 daya (Watt)
Nilainya diacak tiap 2 detik. Untuk simulasi device mati: Ctrl+C lalu jalankan lagi.
"""

import asyncio
import logging
import random
import sys

from pymodbus.datastore import ModbusSequentialDataBlock, ModbusServerContext, ModbusSlaveContext
from pymodbus.server import StartAsyncTcpServer

logging.basicConfig(level=logging.WARNING)
log = logging.getLogger("mock_power_meter")
HOST = "127.0.0.1"


def parse(spec: str) -> tuple[int, int, int]:
    port, unit, register = (int(x) for x in spec.split(":"))
    return port, unit, register


async def run_device(port: int, unit: int, register: int):
    slave = ModbusSlaveContext(hr=ModbusSequentialDataBlock(0, [0] * (register + 10)))
    context = ModbusServerContext(slaves={unit: slave}, single=False)

    async def randomizer():
        while True:
            arus = random.uniform(4.0, 16.0)
            tegangan = random.uniform(215.0, 225.0)
            slave.setValues(3, register, [int(arus * 100), int(tegangan * 10), int(arus * tegangan)])
            await asyncio.sleep(2)

    asyncio.create_task(randomizer())
    print(f"Device mock jalan di {HOST}:{port}  (Virtual ID {unit}, register {register})", flush=True)
    await StartAsyncTcpServer(context=context, address=(HOST, port))


async def main(specs: list[str]):
    devices = [parse(s) for s in specs] or [(5020, 1, 0)]
    print("Tekan Ctrl+C untuk menghentikan semua device.", flush=True)
    await asyncio.gather(*(run_device(*d) for d in devices))


if __name__ == "__main__":
    try:
        asyncio.run(main(sys.argv[1:]))
    except KeyboardInterrupt:
        print("Device mock dihentikan.")
    except ValueError:
        sys.exit("Format salah. Contoh: python mock_power_meter.py 5021:1:0 5022:2:10")
