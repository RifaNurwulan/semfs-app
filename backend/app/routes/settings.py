"""System-wide preferences from the existing single-row settings table."""

from fastapi import APIRouter, Depends, HTTPException, Request

from ..audit import record
from ..database import get_db
from ..deps import get_current_user, require_roles
from ..polling_config import read_interval_from_environment
from ..schemas import SystemSettingsUpdate

router = APIRouter(prefix="/settings", tags=["Pengaturan"])


@router.get("")
def get_settings(user=Depends(get_current_user), conn=Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT timezone, language,
                   COALESCE(poll_interval_seconds, %s) AS poll_interval_seconds,
                   updated_at
            FROM system_settings
            WHERE id = 1
            """,
            (read_interval_from_environment(),),
        )
        row = cur.fetchone()
    if row is None:
        raise HTTPException(status_code=503, detail="Pengaturan sistem belum tersedia")
    return row


@router.put("")
def update_settings(
    body: SystemSettingsUpdate,
    request: Request,
    admin=Depends(require_roles("admin")),
    conn=Depends(get_db),
):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE system_settings
            SET timezone = %s, language = %s, poll_interval_seconds = %s,
                updated_at = now()
            WHERE id = 1
            RETURNING timezone, language, poll_interval_seconds, updated_at
            """,
            (body.timezone, body.language, body.poll_interval_seconds),
        )
        row = cur.fetchone()
    if row is None:
        raise HTTPException(status_code=503, detail="Pengaturan sistem belum tersedia")
    record(conn, "system_settings_update", user=admin, entity="system_settings", request=request)
    conn.commit()
    return row
