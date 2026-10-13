"""
routes/notifications.py
-----------------------
Notifikasi (F-13) -- untuk role admin dan operator.
  GET  /notifications             daftar notifikasi terbaru + jumlah yang belum dibaca
  POST /notifications/read-all    tandai semua sudah dibaca
  POST /notifications/{id}/read   tandai satu notifikasi sudah dibaca

Notifikasi dibuat otomatis oleh trigger database (lihat 004_notifications_avatar.sql):
device offline/online/error dan anomali baru.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from psycopg2 import errors

from ..database import get_db
from ..deps import require_roles
from ..schemas import MessageResponse, NotificationList

router = APIRouter(prefix="/notifications", tags=["Notifikasi"])

WINDOW_DAYS = 30  # hanya notifikasi 30 hari terakhir (dan sejak akun dibuat) yang dihitung

# Batas waktu: 30 hari terakhir ATAU sejak akun dibuat, mana yang lebih baru
_SINCE = "GREATEST(%s::timestamptz, now() - make_interval(days => %s))"


@router.get("", response_model=NotificationList)
def list_notifications(
    limit: int = Query(20, ge=1, le=100),
    user=Depends(require_roles("admin", "operator")),
    conn=Depends(get_db),
):
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT n.id, n.type, n.severity, n.title, n.message, n.device_id, n.created_at,
                   (r.read_at IS NOT NULL) AS read
            FROM notifications n
            LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = %s
            WHERE n.created_at >= {_SINCE}
            ORDER BY n.created_at DESC, n.id DESC
            LIMIT %s
            """,
            (user["id"], user["created_at"], WINDOW_DAYS, limit),
        )
        items = cur.fetchall()

        cur.execute(
            f"""
            SELECT count(*) AS unread
            FROM notifications n
            WHERE n.created_at >= {_SINCE}
              AND NOT EXISTS (
                SELECT 1 FROM notification_reads r
                WHERE r.notification_id = n.id AND r.user_id = %s
              )
            """,
            (user["created_at"], WINDOW_DAYS, user["id"]),
        )
        unread = cur.fetchone()["unread"]

    return {"items": items, "unread_count": unread}


# Penting: rute tetap ("/read-all") ditulis SEBELUM rute berparameter ("/{id}/read")
@router.post("/read-all", response_model=MessageResponse)
def mark_all_read(user=Depends(require_roles("admin", "operator")), conn=Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute(
            f"""
            INSERT INTO notification_reads (notification_id, user_id)
            SELECT n.id, %s FROM notifications n WHERE n.created_at >= {_SINCE}
            ON CONFLICT DO NOTHING
            """,
            (user["id"], user["created_at"], WINDOW_DAYS),
        )
    conn.commit()
    return {"message": "Semua notifikasi ditandai sudah dibaca."}


@router.post("/{notification_id}/read", response_model=MessageResponse)
def mark_read(
    notification_id: int,
    user=Depends(require_roles("admin", "operator")),
    conn=Depends(get_db),
):
    with conn.cursor() as cur:
        try:
            cur.execute(
                """
                INSERT INTO notification_reads (notification_id, user_id) VALUES (%s, %s)
                ON CONFLICT DO NOTHING
                """,
                (notification_id, user["id"]),
            )
        except errors.ForeignKeyViolation:
            conn.rollback()
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notifikasi tidak ditemukan")
    conn.commit()
    return {"message": "Notifikasi ditandai sudah dibaca."}
