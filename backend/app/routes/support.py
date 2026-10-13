"""
routes/support.py
-----------------
"Hubungi Support" di halaman login.
  POST  /support        kirim pesan (tanpa login, dibatasi per alamat IP)
  GET   /support        daftar pesan masuk (admin)
  PATCH /support/{id}   tandai selesai / buka lagi (admin)
"""

import time

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status

from ..database import get_db
from ..deps import require_roles
from ..email_service import send_support_email
from ..schemas import MessageResponse, SupportRequestIn, SupportRequestOut, SupportStatusUpdate

router = APIRouter(prefix="/support", tags=["Support"])

# Pembatas sederhana di memori: maksimal 5 pesan per IP per 15 menit.
# (Cukup untuk satu server; reset kalau server di-restart.)
MAX_PER_WINDOW = 5
WINDOW_SECONDS = 15 * 60
_hits: dict[str, list[float]] = {}


def _rate_limited(key: str) -> bool:
    now = time.time()
    recent = [t for t in _hits.get(key, []) if now - t < WINDOW_SECONDS]
    if len(recent) >= MAX_PER_WINDOW:
        _hits[key] = recent
        return True
    recent.append(now)
    _hits[key] = recent
    if len(_hits) > 10_000:  # jaga memori
        for k in [k for k, v in _hits.items() if not v or now - v[-1] >= WINDOW_SECONDS]:
            del _hits[k]
    return False


@router.post("", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def send_message(
    body: SupportRequestIn,
    request: Request,
    background: BackgroundTasks,
    conn=Depends(get_db),
):
    if _rate_limited(request.client.host if request.client else "unknown"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Terlalu banyak pesan dalam waktu singkat. Coba lagi beberapa menit lagi.",
        )
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO support_requests (name, email, message) VALUES (%s, %s, %s)",
            (body.name.strip(), body.email.lower(), body.message.strip()),
        )
    conn.commit()
    background.add_task(send_support_email, body.name.strip(), body.email.lower(), body.message.strip())
    return {"message": "Pesan Anda sudah kami terima. Tim support akan membalas lewat email."}


@router.get("", response_model=list[SupportRequestOut])
def list_messages(
    limit: int = Query(50, ge=1, le=200),
    admin=Depends(require_roles("admin")),
    conn=Depends(get_db),
):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, name, email, message, status, created_at, resolved_at
            FROM support_requests ORDER BY (status = 'new') DESC, created_at DESC, id DESC LIMIT %s
            """,
            (limit,),
        )
        return cur.fetchall()


@router.patch("/{request_id}", response_model=SupportRequestOut)
def update_status(
    request_id: int,
    body: SupportStatusUpdate,
    admin=Depends(require_roles("admin")),
    conn=Depends(get_db),
):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE support_requests
            SET status = %s, resolved_at = CASE WHEN %s = 'resolved' THEN now() ELSE NULL END
            WHERE id = %s
            RETURNING id, name, email, message, status, created_at, resolved_at
            """,
            (body.status, body.status, request_id),
        )
        row = cur.fetchone()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pesan tidak ditemukan")
    conn.commit()
    return row
