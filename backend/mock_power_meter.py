"""
mock_power_meter.py
-------------------
Simulator power meter (Modbus TCP) untuk testing tanpa alat asli. Bisa menjalankan BEBERAPA device sekaligus.

Cara pakai:
    python mock_power_meter.py                      # PM-001..PM-003 di port 502
    python mock_power_meter.py 502:1:0 502:2:0     # 2 meter berbagi port dan register awal
    python mock_power_meter.py 5021:1:0 5022:2:0   # port berbeda juga didukung

Format setiap device: PORT:VIRTUAL_ID:REGISTER

Mulai dari REGISTER, tiap tag memakai dua register holding/input (IEEE-754 float32 big-endian).
Tiga simulator bawaan memakai ID 1, 2, dan 3. Nilai diperbarui tiap 2 detik.
"""

import asyncio
import logging
import math
import os
import random
import sys
import time
from dataclasses import dataclass, field

from pymodbus.datastore import ModbusSequentialDataBlock, ModbusServerContext, ModbusSlaveContext
from pymodbus.server import StartAsyncTcpServer

from app.modbus_registers import (
    MEASUREMENT_FIELDS,
    REGISTER_COUNT,
    encode_float32,
)

logging.basicConfig(level=logging.WARNING)
log = logging.getLogger("mock_power_meter")
HOST = os.getenv("MOCK_HOST", "0.0.0.0")
PHASE_SHARES = (0.32, 0.34, 0.34)


@dataclass
class MeterState:
    energy_del: float = 0.0
    energy_rec: float = 0.0
    reactive_del: float = 0.0
    reactive_rec: float = 0.0
    apparent_del: float = 0.0
    load_kw: float = 0.0
    power_factor: float = 0.93
    last_sample: float | None = None
    rng: random.Random = field(default_factory=random.Random)


def simulate_measurements(state: MeterState, unit: int, now: float) -> dict[str, float]:
    """Generate smooth, physically related readings and cumulative energy totals."""
    elapsed = 2.0 if state.last_sample is None else max(now - state.last_sample, 0.0)
    state.last_sample = now
    phase = now / 60.0 + unit * 0.73
    rated_kw = 4.0 + unit * 2.0
    target_kw = rated_kw * (
        0.52
        + 0.16 * math.sin(2 * math.pi * phase / 5.0)
        + 0.07 * math.sin(2 * math.pi * phase / 1.7)
    )
    target_kw = max(rated_kw * 0.2, min(rated_kw * 0.9, target_kw))
    load_alpha = 1 - math.exp(-elapsed / 20.0)
    state.load_kw += (target_kw - state.load_kw) * load_alpha

    pf_target = max(
        0.84,
        min(0.99, 0.94 - 0.035 * state.load_kw / rated_kw + 0.012 * math.sin(phase / 2.3)),
    )
    state.power_factor += (pf_target - state.power_factor) * (1 - math.exp(-elapsed / 28.0))
    phase_voltages = [
        220.0 - 0.65 * state.load_kw / rated_kw
        + 0.8 * math.sin(phase * 0.21 + index * 0.8)
        + state.rng.gauss(0, 0.08)
        for index in range(3)
    ]
    apparent_kva = state.load_kw / state.power_factor
    currents = [
        PHASE_SHARES[index] * apparent_kva * 1000 / phase_voltages[index]
        for index in range(3)
    ]
    active_kw = sum(v * i for v, i in zip(phase_voltages, currents)) * state.power_factor / 1000
    apparent_kva = sum(v * i for v, i in zip(phase_voltages, currents)) / 1000
    reactive_kvar = math.sqrt(max(apparent_kva**2 - active_kw**2, 0))
    line_voltages = [
        math.sqrt(phase_voltages[0] ** 2 + phase_voltages[1] ** 2
                  + phase_voltages[0] * phase_voltages[1]),
        math.sqrt(phase_voltages[1] ** 2 + phase_voltages[2] ** 2
                  + phase_voltages[1] * phase_voltages[2]),
        math.sqrt(phase_voltages[2] ** 2 + phase_voltages[0] ** 2
                  + phase_voltages[2] * phase_voltages[0]),
    ]
    current_spread = max(currents) - min(currents)
    neutral_current = max(0.15, current_spread * 0.28 + state.rng.uniform(0.05, 0.25))
    frequency_hz = (
        50.0
        + 0.025 * math.sin(phase / 3.1)
        + 0.006 * math.sin(phase * 1.9)
        + state.rng.gauss(0, 0.002)
    )

    elapsed_hours = elapsed / 3600
    state.energy_del += active_kw * elapsed_hours
    state.energy_rec += state.rng.uniform(0, 0.0005) * elapsed_hours
    state.reactive_del += reactive_kvar * elapsed_hours
    state.reactive_rec += state.rng.uniform(0, 0.0002) * elapsed_hours
    state.apparent_del += apparent_kva * elapsed_hours

    return {
        "v_r_v": line_voltages[0],
        "v_s_v": line_voltages[1],
        "v_t_v": line_voltages[2],
        "v_rn_v": phase_voltages[0],
        "v_sn_v": phase_voltages[1],
        "v_tn_v": phase_voltages[2],
        "i_r_a": currents[0],
        "i_s_a": currents[1],
        "i_t_a": currents[2],
        "i_n_a": neutral_current,
        "p_total_kw": active_kw,
        "q_total_kvar": reactive_kvar,
        "s_total_kva": apparent_kva,
        "power_factor": state.power_factor,
        "frequency_hz": frequency_hz,
        "kwh_del": state.energy_del,
        "kwh_rec": state.energy_rec,
        "kvarh_del": state.reactive_del,
        "kvarh_rec": state.reactive_rec,
        "kvah_del": state.apparent_del,
    }


def parse(spec: str) -> tuple[int, int, int]:
    parts = spec.split(":")
    if len(parts) != 3:
        raise ValueError("Format device harus PORT:VIRTUAL_ID:REGISTER")
    port, unit, register = (int(x) for x in parts)
    if not 1 <= port <= 65535:
        raise ValueError("Port harus antara 1 dan 65535")
    if not (1 <= unit <= 247 or unit == 255):
        raise ValueError("Virtual ID harus 1-247 atau 255 untuk server TCP langsung (0 dan 248-254 dicadangkan)")
    if not 0 <= register <= 65535 - REGISTER_COUNT + 1:
        raise ValueError(f"Register awal harus antara 0 dan {65535 - REGISTER_COUNT + 1}")
    return port, unit, register


def group_devices(devices: list[tuple[int, int, int]]) -> dict[int, dict[int, int]]:
    servers: dict[int, dict[int, int]] = {}
    for port, unit, register in devices:
        slaves = servers.setdefault(port, {})
        if unit in slaves:
            raise ValueError(f"Virtual ID {unit} digunakan lebih dari sekali pada port {port}")
        slaves[unit] = register
    return servers


async def run_server(port: int, devices: dict[int, int]):
    slaves = {
        unit: ModbusSlaveContext(
            hr=ModbusSequentialDataBlock(0, [0] * (register + REGISTER_COUNT)),
            ir=ModbusSequentialDataBlock(0, [0] * (register + REGISTER_COUNT)),
            zero_mode=True,
        )
        for unit, register in devices.items()
    }
    context = ModbusServerContext(slaves=slaves, single=False)

    async def randomizer(unit: int, register: int):
        slave = slaves[unit]
        state = MeterState(
            load_kw=(4.0 + unit * 2.0) * 0.52,
            rng=random.Random(1000 + unit),
        )
        while True:
            measurements = simulate_measurements(state, unit, time.monotonic())
            registers = [
                word
                for field in MEASUREMENT_FIELDS
                for word in encode_float32(measurements[field])
            ]
            slave.setValues(3, register, registers)
            slave.setValues(4, register, registers)
            await asyncio.sleep(2)

    tasks = [asyncio.create_task(randomizer(unit, register)) for unit, register in devices.items()]
    print(
        f"Simulator jalan di {HOST}:{port} (Virtual ID/register: "
        + ", ".join(f"PM-{unit:03}/{unit}/{register}" for unit, register in devices.items())
        + f"; {REGISTER_COUNT} register per meter, data dinamis, jenis default: holding/input, "
        + f"urutan tag: {', '.join(MEASUREMENT_FIELDS)})",
        flush=True,
    )
    try:
        await StartAsyncTcpServer(context=context, address=(HOST, port))
    finally:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)


async def main(specs: list[str]):
    devices = [parse(spec) for spec in specs] or [(502, 1, 0), (502, 2, 0), (502, 3, 0)]
    servers = group_devices(devices)
    print("Tekan Ctrl+C untuk menghentikan semua simulator.", flush=True)
    await asyncio.gather(*(run_server(port, units) for port, units in servers.items()))


if __name__ == "__main__":
    try:
        asyncio.run(main(sys.argv[1:]))
    except KeyboardInterrupt:
        print("Simulator dihentikan.")
    except ValueError as exc:
        sys.exit(f"{exc}. Contoh: python mock_power_meter.py 502:1:0 502:2:10")
