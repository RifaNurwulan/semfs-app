"""Endpoint ringkasan untuk halaman Monitoring Energy."""

from typing import Literal

from fastapi import APIRouter, Depends, Query

from ..database import get_db
from ..deps import get_current_user
from ..schemas import MonitoringSummary

router = APIRouter(prefix="/monitoring", tags=["Monitoring"])

PERIODS = {
    "1h": ("1 hour", "5 minutes"),
    "24h": ("24 hours", "1 hour"),
    "7d": ("7 days", "6 hours"),
}


@router.get("/summary", response_model=MonitoringSummary)
def monitoring_summary(
    period: Literal["1h", "24h", "7d"] = Query("24h"),
    device_id: str | None = Query(None, min_length=2, max_length=50),
    user=Depends(get_current_user),
    conn=Depends(get_db),
):
    """Ambil tren daya teragregasi, pemakaian energi, dan bacaan terbaru device."""
    duration, bucket = PERIODS[period]

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT time_bucket(%s::interval, time) AS time,
                   AVG(daya) AS avg_power_w,
                   AVG(arus) AS avg_current_a,
                   AVG(tegangan) AS avg_voltage_v,
                   MAX(daya) AS peak_power_w,
                   COUNT(*) AS sample_count
            FROM energy_readings
            WHERE time >= now() - %s::interval
              AND (%s::text IS NULL OR device_id = %s)
            GROUP BY time_bucket(%s::interval, time)
            ORDER BY time
            """,
            (bucket, duration, device_id, device_id, bucket),
        )
        points = cur.fetchall()

        cur.execute(
            """
            SELECT COALESCE(SUM(GREATEST(last_energy - first_energy, 0)), 0) AS total_energy_kwh
            FROM (
                SELECT device_id,
                       (array_agg(energy ORDER BY time DESC))[1] AS last_energy,
                       (array_agg(energy ORDER BY time ASC))[1] AS first_energy
                FROM energy_readings
                WHERE time >= now() - %s::interval
                  AND (%s::text IS NULL OR device_id = %s)
                  AND energy IS NOT NULL
                GROUP BY device_id
            ) AS per_device
            """,
            (duration, device_id, device_id),
        )
        energy = cur.fetchone()["total_energy_kwh"]

        cur.execute(
            """
            SELECT pm.device_id, pm.device_name, pm.location, pm.status, pm.enabled,
                   latest.time, latest.arus, latest.tegangan, latest.daya, latest.energy
            FROM power_meters AS pm
            LEFT JOIN LATERAL (
                SELECT time, arus, tegangan, daya, energy
                FROM energy_readings
                WHERE device_id = pm.device_id
                ORDER BY time DESC
                LIMIT 1
            ) AS latest ON TRUE
            WHERE (%s::text IS NULL OR pm.device_id = %s)
            ORDER BY pm.device_id
            """,
            (device_id, device_id),
        )
        devices = cur.fetchall()

    numeric_powers = [p["avg_power_w"] for p in points if p["avg_power_w"] is not None]
    return {
        "period": period,
        "total_energy_kwh": float(energy or 0),
        "avg_power_w": sum(numeric_powers) / len(numeric_powers) if numeric_powers else 0,
        "peak_power_w": max((p["peak_power_w"] or 0 for p in points), default=0),
        "points": points,
        "devices": devices,
    }
