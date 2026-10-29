"""Shared Modbus holding-register map for three-phase power meters."""

import math
import struct
from collections.abc import Mapping, Sequence

MEASUREMENT_FIELDS = (
    "v_r_v",
    "v_s_v",
    "v_t_v",
    "v_rn_v",
    "v_sn_v",
    "v_tn_v",
    "i_r_a",
    "i_s_a",
    "i_t_a",
    "i_n_a",
    "p_total_kw",
    "q_total_kvar",
    "s_total_kva",
    "power_factor",
    "frequency_hz",
    "kwh_del",
    "kwh_rec",
    "kvarh_del",
    "kvarh_rec",
    "kvah_del",
)

REGISTER_COUNT = len(MEASUREMENT_FIELDS) * 2
DATA_TYPE_FORMATS = {
    "int16": (">h", 1),
    "uint16": (">H", 1),
    "int32": (">i", 2),
    "uint32": (">I", 2),
    "float32": (">f", 2),
    "float64": (">d", 4),
}
REGISTER_TYPES = ("holding", "input")
MEASUREMENT_DB_COLUMNS = tuple(
    "frekuensi" if field == "frequency_hz" else field
    for field in MEASUREMENT_FIELDS
)
MEASUREMENT_LABELS = {
    "v_r_v": ("V_R (V_L1)", "V"),
    "v_s_v": ("V_S (V_L2)", "V"),
    "v_t_v": ("V_T (V_L3)", "V"),
    "v_rn_v": ("V_RN (V_L1N)", "V"),
    "v_sn_v": ("V_SN (V_L2N)", "V"),
    "v_tn_v": ("V_TN (V_L3N)", "V"),
    "i_r_a": ("I_R (I_L1)", "A"),
    "i_s_a": ("I_S (I_L2)", "A"),
    "i_t_a": ("I_T (I_L3)", "A"),
    "i_n_a": ("I_N", "A"),
    "p_total_kw": ("P_Total (kW_Total)", "kW"),
    "q_total_kvar": ("Q_Total (kVAR_Total)", "kVAR"),
    "s_total_kva": ("S_Total (kVA_Total)", "kVA"),
    "power_factor": ("PF (Power_Factor)", ""),
    "frequency_hz": ("Freq (Frequency)", "Hz"),
    "kwh_del": ("kWh_Del (E_Act_Del / Import)", "kWh"),
    "kwh_rec": ("kWh_Rec (E_Act_Rec / Export)", "kWh"),
    "kvarh_del": ("kVARh_Del (E_React_Del)", "kVARh"),
    "kvarh_rec": ("kVARh_Rec (E_React_Rec)", "kVARh"),
    "kvah_del": ("kVAh_Del (E_App_Del)", "kVAh"),
}
DEFAULT_REGISTER_MAP = {field: index * 2 for index, field in enumerate(MEASUREMENT_FIELDS)}
DEFAULT_REGISTER_CONFIG = [
    {
        "key": field,
        "parameter": label,
        "unit": unit,
        "register_type": "holding",
        "address": DEFAULT_REGISTER_MAP[field],
        "data_type": "float32",
    }
    for field in MEASUREMENT_FIELDS
    for label, unit in (MEASUREMENT_LABELS[field],)
]
MAX_FLOAT32_REGISTER_ADDRESS = 65534


class ModbusRegisterReadError(ValueError):
    """Raised when a configured holding-register range cannot be read."""


def encode_float32(value: float) -> tuple[int, int]:
    packed = struct.pack(">f", value)
    return int.from_bytes(packed[:2], "big"), int.from_bytes(packed[2:], "big")


def decode_measurements(registers: list[int]) -> dict[str, float]:
    if len(registers) != REGISTER_COUNT:
        raise ValueError(f"Expected {REGISTER_COUNT} registers, received {len(registers)}")

    values = {}
    for index, field in enumerate(MEASUREMENT_FIELDS):
        high, low = registers[index * 2:index * 2 + 2]
        value = struct.unpack(">f", struct.pack(">HH", high, low))[0]
        if not math.isfinite(value):
            raise ValueError(f"Invalid float value in Modbus register field {field}")
        values[field] = value
    return values


def validate_register_map(register_map: Mapping[str, int]) -> dict[str, int]:
    if set(register_map) != set(MEASUREMENT_FIELDS):
        raise ValueError("Peta register harus memiliki alamat untuk semua 20 parameter")
    result = {}
    for field in MEASUREMENT_FIELDS:
        address = register_map[field]
        if isinstance(address, bool) or not isinstance(address, int):
            raise ValueError(f"Alamat register {field} harus berupa bilangan bulat")
        if not 0 <= address <= MAX_FLOAT32_REGISTER_ADDRESS:
            raise ValueError(f"Alamat register {field} harus antara 0 dan {MAX_FLOAT32_REGISTER_ADDRESS}")
        result[field] = address
    sorted_addresses = sorted((address, field) for field, address in result.items())
    for (previous, previous_field), (current, current_field) in zip(sorted_addresses, sorted_addresses[1:]):
        if current < previous + 2:
            raise ValueError(
                f"Register {current} untuk {current_field} bertumpang tindih "
                f"dengan register {previous}-{previous + 1} untuk {previous_field}"
            )
    return result


def register_config_from_map(register_map: Mapping[str, int]) -> list[dict]:
    addresses = validate_register_map(register_map)
    return [
        {**entry, "address": addresses[entry["key"]]}
        for entry in DEFAULT_REGISTER_CONFIG
    ]


def register_map_from_config(register_config: Sequence[Mapping]) -> dict[str, int]:
    return {entry["key"]: entry["address"] for entry in register_config}


def validate_register_config(register_config: Sequence[Mapping]) -> list[dict]:
    if not isinstance(register_config, Sequence) or isinstance(register_config, (str, bytes)):
        raise ValueError("Konfigurasi register harus berupa daftar parameter")
    if not 1 <= len(register_config) <= 100:
        raise ValueError("Konfigurasi harus berisi 1-100 parameter")

    result = []
    seen_keys = set()
    occupied = {"holding": [], "input": []}
    for item in register_config:
        if not isinstance(item, Mapping):
            raise ValueError("Setiap parameter harus berupa objek")
        key = item.get("key")
        parameter = item.get("parameter")
        unit = item.get("unit", "")
        register_type = item.get("register_type")
        address = item.get("address")
        data_type = item.get("data_type")
        if not isinstance(key, str) or not key or len(key) > 50:
            raise ValueError("Key parameter harus berisi 1-50 karakter")
        if key in seen_keys:
            raise ValueError(f"Key parameter {key} digunakan lebih dari sekali")
        if not isinstance(parameter, str) or not parameter.strip() or len(parameter) > 100:
            raise ValueError(f"Nama parameter {key} harus berisi 1-100 karakter")
        if not isinstance(unit, str) or len(unit) > 30:
            raise ValueError(f"Satuan parameter {key} maksimal 30 karakter")
        if register_type not in REGISTER_TYPES:
            raise ValueError(f"Jenis register {key} harus holding atau input")
        if isinstance(address, bool) or not isinstance(address, int) or address < 0:
            raise ValueError(f"Alamat register {key} harus bilangan bulat nonnegatif")
        if data_type not in DATA_TYPE_FORMATS:
            raise ValueError(f"Format data parameter {key} tidak didukung")
        register_length = DATA_TYPE_FORMATS[data_type][1]
        if address + register_length > 65536:
            raise ValueError(f"Rentang register {key} melewati alamat maksimum 65535")

        end = address + register_length
        for previous_start, previous_end, previous_key in occupied[register_type]:
            if address < previous_end and previous_start < end:
                raise ValueError(
                    f"Register {address}-{end - 1} untuk {key} bertumpang tindih "
                    f"dengan register {previous_start}-{previous_end - 1} untuk {previous_key}"
                )
        occupied[register_type].append((address, end, key))
        seen_keys.add(key)
        result.append({
            "key": key,
            "parameter": parameter.strip(),
            "unit": unit.strip(),
            "register_type": register_type,
            "address": address,
            "data_type": data_type,
        })
    return result


def _decode_value(registers: Sequence[int], data_type: str) -> float:
    format_string, register_length = DATA_TYPE_FORMATS[data_type]
    if len(registers) != register_length:
        raise ModbusRegisterReadError(
            f"Data {data_type} membutuhkan {register_length} register, menerima {len(registers)}"
        )
    packed = b"".join(register.to_bytes(2, "big") for register in registers)
    value = struct.unpack(format_string, packed)[0]
    if not math.isfinite(value):
        raise ModbusRegisterReadError(f"Nilai {data_type} tidak valid")
    return float(value)


def read_measurements(client, unit: int, register_config: Mapping | Sequence[Mapping]) -> dict[str, float]:
    if isinstance(register_config, Mapping):
        register_config = register_config_from_map(register_config)
    configuration = validate_register_config(register_config)
    ranges = []
    for item in sorted(configuration, key=lambda entry: (entry["register_type"], entry["address"])):
        register_length = DATA_TYPE_FORMATS[item["data_type"]][1]
        start = item["address"]
        end = start + register_length
        if (
            ranges
            and ranges[-1][0] == item["register_type"]
            and start <= ranges[-1][2]
            and max(ranges[-1][2], end) - ranges[-1][1] <= 125
        ):
            ranges[-1][2] = max(ranges[-1][2], end)
            ranges[-1][3].append(item)
        else:
            ranges.append([item["register_type"], start, end, [item]])

    values = {}
    for register_type, start, end, parameters in ranges:
        reader = (
            client.read_holding_registers
            if register_type == "holding"
            else client.read_input_registers
        )
        response = reader(address=start, count=end - start, slave=unit)
        if response.isError():
            raise ModbusRegisterReadError(
                f"Pembacaan {register_type} register {start}-{end - 1} gagal: {response}"
            )
        registers = response.registers
        for item in parameters:
            offset = item["address"] - start
            length = DATA_TYPE_FORMATS[item["data_type"]][1]
            raw = registers[offset:offset + length]
            if len(raw) != length:
                raise ModbusRegisterReadError(
                    f"Register {item['address']}-{item['address'] + length - 1} "
                    f"untuk {item['key']} tidak lengkap"
                )
            values[item["key"]] = _decode_value(raw, item["data_type"])
    return values
