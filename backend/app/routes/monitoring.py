"""Endpoint ringkasan untuk halaman Monitoring Energy."""

from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query

from ..database import get_db
from ..deps import get_current_user
from ..schemas import MonitoringSummary
from ..modbus_registers import MEASUREMENT_DB_COLUMNS, MEASUREMENT_FIELDS

router = APIRouter(prefix="/monitoring", tags=["Monitoring"])

PERIODS = {
    "1h": ("1 hour", "5 minutes"),
    "24h": ("24 hours", "1 hour"),
    "7d": ("7 days", "6 hours"),
    "live": ("1 hour", "1 minute"),
}
LOCAL_TIMEZONE = timezone(timedelta(hours=7), name="Asia/Jakarta")
METRIC_COLUMNS = {
    "daya": "daya",
    "arus": "arus",
    "tegangan": "tegangan",
    "energy": "energy",
    **dict(zip(MEASUREMENT_FIELDS, MEASUREMENT_DB_COLUMNS)),
}


def _custom_range(start_time: datetime, end_time: datetime) -> tuple[datetime, datetime, str]:
    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=LOCAL_TIMEZONE)
    else:
        start_time = start_time.astimezone(LOCAL_TIMEZONE)
    if end_time.tzinfo is None:
        end_time = end_time.replace(tzinfo=LOCAL_TIMEZONE)
    else:
        end_time = end_time.astimezone(LOCAL_TIMEZONE)
    if start_time > end_time:
        raise HTTPException(status_code=422, detail="Waktu awal tidak boleh melewati waktu akhir")

    start = start_time.replace(second=0, microsecond=0)
    end = end_time.replace(second=0, microsecond=0) + timedelta(minutes=1)
    return start, end, "1 minute"


@router.get("/summary", response_model=MonitoringSummary)
def monitoring_summary(
    period: Literal["live", "1h", "24h", "7d", "custom"] = Query("24h"),
    device_id: str | None = Query(None, min_length=2, max_length=50),
    start_time: datetime | None = Query(None),
    end_time: datetime | None = Query(None),
    metric_key: str = Query("daya", min_length=1, max_length=50, pattern=r"^[A-Za-z0-9_-]+$"),
    user=Depends(get_current_user),
    conn=Depends(get_db),
):
    """Ambil tren daya teragregasi, pemakaian energi, dan bacaan terbaru device."""
    if period == "custom":
        if start_time is None or end_time is None:
            raise HTTPException(status_code=422, detail="Waktu awal dan waktu akhir wajib diisi")
        start, end, bucket = _custom_range(start_time, end_time)
        time_filter = "time >= %s AND time < %s"
        time_params = (start, end)
    else:
        duration, bucket = PERIODS[period]
        start = end = None
        time_filter = "time >= now() - %s::interval"
        time_params = (duration,)

    latest_fields = ", ".join(f"latest.{field}" for field in MEASUREMENT_FIELDS)
    measurement_fields = ", ".join(
        f"{column} AS {field}" if column != field else field
        for field, column in zip(MEASUREMENT_FIELDS, MEASUREMENT_DB_COLUMNS)
    )
    latest_time_filter = "AND time >= %s AND time < %s" if period == "custom" else ""
    if period == "custom":
        history_time_filter = "time >= %s AND time < %s"
        meter_history_time_filter = "er.time >= %s AND er.time < %s"
    else:
        history_time_filter = """
        time >= (date_trunc('day', now() AT TIME ZONE 'Asia/Jakarta') - INTERVAL '13 days')
                    AT TIME ZONE 'Asia/Jakarta'
          AND time < (date_trunc('day', now() AT TIME ZONE 'Asia/Jakarta') + INTERVAL '1 day')
                    AT TIME ZONE 'Asia/Jakarta'
        """
        meter_history_time_filter = """
        er.time >= (date_trunc('day', now() AT TIME ZONE 'Asia/Jakarta') - INTERVAL '13 days')
                       AT TIME ZONE 'Asia/Jakarta'
          AND er.time < (date_trunc('day', now() AT TIME ZONE 'Asia/Jakarta') + INTERVAL '1 day')
                       AT TIME ZONE 'Asia/Jakarta'
        """
    history_time_params = (start, end) if period == "custom" else ()
    metric_expression = METRIC_COLUMNS.get(metric_key)
    metric_params: tuple[str, ...] = ()
    if metric_expression is None:
        metric_expression = "NULLIF(register_values ->> %s, '')::double precision"
        metric_params = (metric_key,)
    device_metric_expression = (
        f"er.{metric_expression}"
        if metric_key in METRIC_COLUMNS
        else metric_expression.replace("register_values", "er.register_values")
    )

    with conn.cursor() as cur:
        cur.execute("SELECT price_per_kwh FROM system_settings WHERE id = 1")
        tariff_row = cur.fetchone()
        if tariff_row is None:
            raise HTTPException(status_code=503, detail="Pengaturan tarif belum tersedia. Jalankan migration terbaru.")
        price_per_kwh = float(tariff_row["price_per_kwh"])

        cur.execute(
            f"""
            SELECT time_bucket(%s::interval, time) AS time,
                   AVG(daya) AS avg_power_w,
                   AVG(arus) AS avg_current_a,
                   AVG(tegangan) AS avg_voltage_v,
                   MAX(daya) AS peak_power_w,
                   AVG(power_factor) AS avg_power_factor,
                   AVG({metric_expression}) AS avg_metric_value,
                   MAX({metric_expression}) AS peak_metric_value,
                   COUNT(*) AS sample_count
            FROM energy_readings
            WHERE {time_filter}
              AND (%s::text IS NULL OR device_id = %s)
            GROUP BY time_bucket(%s::interval, time)
            ORDER BY time
            """,
            (
                bucket,
                *metric_params,
                *metric_params,
                *time_params,
                device_id,
                device_id,
                bucket,
            ),
        )
        points = cur.fetchall()

        cur.execute(
            f"""
            SELECT er.device_id,
                   pm.device_name,
                   er.time,
                   er.daya,
                   er.arus,
                   er.tegangan,
                   er.power_factor,
                   {device_metric_expression} AS metric_value
            FROM energy_readings AS er
            LEFT JOIN power_meters AS pm ON pm.device_id = er.device_id
            WHERE {time_filter.replace('time', 'er.time')}
              AND (%s::text IS NULL OR er.device_id = %s)
            ORDER BY er.time, er.device_id
            """,
            (
                *metric_params,
                *time_params,
                device_id,
                device_id,
            ),
        )
        device_points = cur.fetchall()

        cur.execute(
            f"""
            SELECT COALESCE(SUM(GREATEST(last_energy - first_energy, 0)), 0) AS total_energy_kwh
            FROM (
                SELECT device_id,
                       (array_agg(energy ORDER BY time DESC))[1] AS last_energy,
                       (array_agg(energy ORDER BY time ASC))[1] AS first_energy
                FROM energy_readings
                WHERE {time_filter}
                  AND (%s::text IS NULL OR device_id = %s)
                  AND energy IS NOT NULL
                GROUP BY device_id
            ) AS per_device
            """,
            (*time_params, device_id, device_id),
        )
        energy = cur.fetchone()["total_energy_kwh"]

        cur.execute(
            f"""
            WITH per_meter_day AS (
                SELECT device_id,
                       date_trunc('day', time AT TIME ZONE 'Asia/Jakarta') AS local_day,
                       (array_agg(energy ORDER BY time DESC))[1] AS last_energy,
                       (array_agg(energy ORDER BY time ASC))[1] AS first_energy
                FROM energy_readings
                WHERE {history_time_filter}
                  AND (%s::text IS NULL OR device_id = %s)
                  AND energy IS NOT NULL
                GROUP BY device_id, date_trunc('day', time AT TIME ZONE 'Asia/Jakarta')
            )
            SELECT local_day AT TIME ZONE 'Asia/Jakarta' AS time,
                   COALESCE(SUM(GREATEST(last_energy - first_energy, 0)), 0) AS energy_kwh
            FROM per_meter_day
            GROUP BY local_day
            ORDER BY local_day
            """,
            (*history_time_params, device_id, device_id),
        )
        daily_energy = cur.fetchall()

        cur.execute(
            f"""
            WITH per_meter_day AS (
                SELECT er.device_id,
                       pm.device_name,
                       date_trunc('day', er.time AT TIME ZONE 'Asia/Jakarta') AS local_day,
                       (array_agg(er.energy ORDER BY er.time DESC))[1] AS last_energy,
                       (array_agg(er.energy ORDER BY er.time ASC))[1] AS first_energy
                FROM energy_readings AS er
                LEFT JOIN power_meters AS pm ON pm.device_id = er.device_id
                WHERE {history_time_filter.replace('time', 'er.time')}
                  AND (%s::text IS NULL OR er.device_id = %s)
                  AND er.energy IS NOT NULL
                GROUP BY er.device_id, pm.device_name,
                         date_trunc('day', er.time AT TIME ZONE 'Asia/Jakarta')
            )
            SELECT device_id,
                   device_name,
                   local_day AT TIME ZONE 'Asia/Jakarta' AS time,
                   GREATEST(last_energy - first_energy, 0) AS energy_kwh
            FROM per_meter_day
            ORDER BY local_day, device_id
            """,
            (*history_time_params, device_id, device_id),
        )
        device_daily_energy = cur.fetchall()

        cur.execute(
            f"""
            SELECT pm.device_id,
                   pm.device_name,
                   COALESCE(GREATEST(
                       (array_agg(er.energy ORDER BY er.time DESC))[1]
                       - (array_agg(er.energy ORDER BY er.time ASC))[1],
                       0
                   ), 0) AS consumption_kwh
            FROM power_meters AS pm
            LEFT JOIN energy_readings AS er
              ON er.device_id = pm.device_id
             AND {meter_history_time_filter}
             AND er.energy IS NOT NULL
            WHERE (%s::text IS NULL OR pm.device_id = %s)
            GROUP BY pm.device_id, pm.device_name
            ORDER BY consumption_kwh DESC, pm.device_id
            """,
            (*history_time_params, device_id, device_id),
        )
        device_consumption = cur.fetchall()

        cur.execute(
            f"""
            SELECT pm.device_id, pm.device_name, pm.location, pm.status, pm.enabled,
                   pm.register_config,
                   latest.time, latest.arus, latest.tegangan, latest.daya, latest.energy,
                   latest.register_values, {latest_fields}
            FROM power_meters AS pm
            LEFT JOIN LATERAL (
                SELECT time, arus, tegangan, daya, energy, register_values, {measurement_fields}
                FROM energy_readings
                WHERE device_id = pm.device_id
                  {latest_time_filter}
                ORDER BY time DESC
                LIMIT 1
            ) AS latest ON TRUE
            WHERE (%s::text IS NULL OR pm.device_id = %s)
            ORDER BY pm.device_id
            """,
            (*((start, end) if period == "custom" else ()), device_id, device_id),
        )
        devices = cur.fetchall()

    numeric_powers = [p["avg_power_w"] for p in points if p["avg_power_w"] is not None]
    return {
        "period": period,
        "total_energy_kwh": float(energy or 0),
        "price_per_kwh": price_per_kwh,
        "estimated_cost": round(float(energy or 0) * price_per_kwh, 2),
        "avg_power_w": sum(numeric_powers) / len(numeric_powers) if numeric_powers else 0,
        "peak_power_w": max((p["peak_power_w"] or 0 for p in points), default=0),
        "points": points,
        "device_points": device_points,
        "daily_energy": daily_energy,
        "device_daily_energy": device_daily_energy,
        "device_consumption": device_consumption,
        "devices": devices,
    }
