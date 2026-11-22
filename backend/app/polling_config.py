import math
import os


def read_interval_from_environment() -> float:
    try:
        interval = float(os.getenv("READ_INTERVAL", "5"))
    except ValueError as exc:
        raise RuntimeError("READ_INTERVAL harus berupa angka") from exc
    if not math.isfinite(interval) or not 1 <= interval <= 3600:
        raise RuntimeError("READ_INTERVAL harus berada antara 1 dan 3600 detik")
    return interval

