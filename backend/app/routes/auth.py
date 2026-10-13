"""
routes/auth.py
--------------
Endpoint autentikasi:
  POST   /auth/register          daftar akun baru (role otomatis 'viewer')
  POST   /auth/login             login pakai username/email + password -> token JWT
  POST   /auth/logout            logout
  GET    /auth/me                lihat profil sendiri
  PUT    /auth/me                edit profil (username, email, password)
  POST   /auth/forgot-password   minta tautan reset password lewat email
  POST   /auth/reset-password    buat password baru memakai tautan dari email
  PUT    /auth/me/avatar         ganti foto profil (kirim file gambar mentah)
  GET    /auth/me/avatar         ambil foto profil sendiri
  DELETE /auth/me/avatar         hapus foto profil
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from fastapi.concurrency import run_in_threadpool
from psycopg2 import errors

from ..config import (
    AVATAR_MAX_BYTES,
    FRONTEND_URL,
    JWT_EXPIRE_MINUTES,
    RESET_COOLDOWN_SECONDS,
    RESET_REVEAL_UNKNOWN_EMAIL,
    RESET_TOKEN_EXPIRE_MINUTES,
)
from ..database import USER_COLUMNS, get_db
from ..deps import get_current_user
from ..email_service import send_reset_email
from ..schemas import (
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserOut,
)
from ..security import (
    DUMMY_HASH,
    create_access_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


def _conflict(field: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=f"{field} sudah dipakai akun lain",
    )


def _hash_token(token: str) -> str:
    # Yang disimpan di database hanya hash token, jadi kalau database bocor,
    # tautan reset yang masih berlaku tidak bisa dipakai penyerang.
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------- register / login
@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, conn=Depends(get_db)):
    email = body.email.lower()

    with conn.cursor() as cur:
        cur.execute(
            "SELECT username, email FROM users WHERE username = %s OR email = %s",
            (body.username, email),
        )
        existing = cur.fetchone()
        if existing:
            raise _conflict("Username" if existing["username"] == body.username else "Email")

        try:
            cur.execute(
                f"""
                INSERT INTO users (username, email, password_hash, role)
                VALUES (%s, %s, %s, 'viewer')
                RETURNING {USER_COLUMNS}
                """,
                (body.username, email, hash_password(body.password)),
            )
        except errors.UniqueViolation:  # jaga-jaga kalau dua request masuk bersamaan
            conn.rollback()
            raise _conflict("Username atau email")
        user = cur.fetchone()
    conn.commit()
    return user


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, conn=Depends(get_db)):
    identifier = body.username.strip()

    with conn.cursor() as cur:
        cur.execute(
            f"SELECT {USER_COLUMNS}, password_hash FROM users WHERE username = %s OR email = %s",
            (identifier, identifier.lower()),
        )
        row = cur.fetchone()

    # Pesan error sengaja sama untuk "user tidak ada" dan "password salah"
    # supaya orang luar tidak bisa menebak username mana yang terdaftar.
    password_ok = verify_password(body.password, row["password_hash"] if row else DUMMY_HASH)
    if row is None or not password_ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username/email atau password salah",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = {k: v for k, v in row.items() if k != "password_hash"}
    return TokenResponse(
        access_token=create_access_token(user["id"], user["role"]),
        expires_in=JWT_EXPIRE_MINUTES * 60,
        user=user,
    )


@router.post("/logout", response_model=MessageResponse)
def logout(user=Depends(get_current_user)):
    # JWT bersifat stateless: server tidak menyimpan sesi. Logout = client (frontend)
    # menghapus token yang tersimpan. Token lama otomatis mati saat kedaluwarsa.
    return {"message": "Logout berhasil. Hapus token di sisi client."}


# ---------------------------------------------------------------- profil
@router.get("/me", response_model=UserOut)
def read_me(user=Depends(get_current_user)):
    return user


@router.put("/me", response_model=UserOut)
def update_me(body: UpdateProfileRequest, user=Depends(get_current_user), conn=Depends(get_db)):
    sets, params = [], []

    if body.username is not None and body.username != user["username"]:
        sets.append("username = %s")
        params.append(body.username)

    if body.email is not None and body.email.lower() != user["email"]:
        sets.append("email = %s")
        params.append(body.email.lower())

    if body.new_password is not None:
        if not body.current_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="current_password wajib diisi untuk mengganti password",
            )
        with conn.cursor() as cur:
            cur.execute("SELECT password_hash FROM users WHERE id = %s", (user["id"],))
            current_hash = cur.fetchone()["password_hash"]
        if not verify_password(body.current_password, current_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password saat ini salah",
            )
        sets.append("password_hash = %s")
        params.append(hash_password(body.new_password))

    if not sets:
        return user  # tidak ada yang berubah

    with conn.cursor() as cur:
        # Nama kolom di 'sets' dibuat oleh kode di atas (bukan input user), jadi aman.
        try:
            cur.execute(
                f"UPDATE users SET {', '.join(sets)} WHERE id = %s RETURNING {USER_COLUMNS}",
                (*params, user["id"]),
            )
        except errors.UniqueViolation:
            conn.rollback()
            raise _conflict("Username atau email")
        updated = cur.fetchone()
    conn.commit()
    return updated


# ---------------------------------------------------------------- reset password (SRS use case #3)
@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(body: ForgotPasswordRequest, background: BackgroundTasks, conn=Depends(get_db)):
    email = body.email.lower()
    sent = {"message": "Tautan reset password sudah dikirim ke email Anda."}
    # Dipakai kalau RESET_REVEAL_UNKNOWN_EMAIL=false: jawaban sama untuk semua kasus
    neutral = {"message": "Jika email terdaftar, tautan reset password akan dikirim ke email tersebut."}

    with conn.cursor() as cur:
        cur.execute("SELECT id, username, reset_token_expiry FROM users WHERE email = %s", (email,))
        user = cur.fetchone()

        if user is None:
            if RESET_REVEAL_UNKNOWN_EMAIL:
                # Sesuai SRS: alternative flow "Email tidak ditemukan"
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email tidak ditemukan")
            return neutral

        # Batasi: satu tautan per RESET_COOLDOWN_SECONDS (cegah email dibanjiri)
        expiry = user["reset_token_expiry"]
        if expiry is not None:
            issued_at = expiry - timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
            if datetime.now(timezone.utc) - issued_at < timedelta(seconds=RESET_COOLDOWN_SECONDS):
                if RESET_REVEAL_UNKNOWN_EMAIL:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="Tautan baru saja dikirim. Tunggu sekitar 1 menit sebelum meminta lagi.",
                    )
                return neutral

        token = secrets.token_urlsafe(32)
        cur.execute(
            "UPDATE users SET reset_token = %s, reset_token_expiry = %s WHERE id = %s",
            (
                _hash_token(token),
                datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES),
                user["id"],
            ),
        )
    conn.commit()

    background.add_task(send_reset_email, email, user["username"], f"{FRONTEND_URL}/reset-password?token={token}")
    return sent if RESET_REVEAL_UNKNOWN_EMAIL else neutral


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(body: ResetPasswordRequest, conn=Depends(get_db)):
    # Satu perintah UPDATE: cek token + masa berlaku + ganti password + hapus token.
    # Dua request bersamaan dengan token yang sama tidak mungkin sama-sama berhasil.
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE users
            SET password_hash = %s, reset_token = NULL, reset_token_expiry = NULL, password_changed_at = now()
            WHERE reset_token = %s AND reset_token_expiry > now()
            RETURNING id
            """,
            (hash_password(body.new_password), _hash_token(body.token)),
        )
        row = cur.fetchone()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tautan reset tidak valid atau sudah kedaluwarsa",
        )
    conn.commit()
    return {"message": "Password berhasil diganti. Silakan login dengan password baru."}


# ---------------------------------------------------------------- foto profil
def sniff_image(data: bytes) -> str | None:
    """Tentukan jenis gambar dari isi file (bukan dari nama/header kiriman client).
    SVG sengaja tidak diizinkan karena bisa berisi script."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def _save_avatar(conn, user_id: int, data: bytes, mime: str) -> dict:
    with conn.cursor() as cur:
        cur.execute(
            f"""
            UPDATE users SET avatar = %s, avatar_mime = %s, avatar_updated_at = now()
            WHERE id = %s RETURNING {USER_COLUMNS}
            """,
            (data, mime, user_id),
        )
        updated = cur.fetchone()
    conn.commit()
    return updated


@router.put("/me/avatar", response_model=UserOut)
async def upload_avatar(request: Request, user=Depends(get_current_user), conn=Depends(get_db)):
    too_big = HTTPException(
        status_code=413,  # Content Too Large (pakai angka: nama konstantanya berubah antar versi Starlette)
        detail=f"Ukuran foto maksimal {AVATAR_MAX_BYTES // 1024} KB",
    )
    declared = request.headers.get("content-length", "")
    if declared.isdigit() and int(declared) > AVATAR_MAX_BYTES:
        raise too_big

    # Baca bertahap dan berhenti begitu melewati batas (tidak mengandalkan header saja)
    chunks, total = [], 0
    async for chunk in request.stream():
        total += len(chunk)
        if total > AVATAR_MAX_BYTES:
            raise too_big
        chunks.append(chunk)
    data = b"".join(chunks)

    mime = sniff_image(data)
    if mime is None:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Format foto harus PNG, JPEG, atau WebP",
        )
    return await run_in_threadpool(_save_avatar, conn, user["id"], data, mime)


@router.get("/me/avatar")
def read_avatar(user=Depends(get_current_user), conn=Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute("SELECT avatar, avatar_mime FROM users WHERE id = %s", (user["id"],))
        row = cur.fetchone()
    if row is None or row["avatar"] is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Belum ada foto profil")
    return Response(
        content=bytes(row["avatar"]),
        media_type=row["avatar_mime"],
        headers={"Cache-Control": "private, no-cache", "X-Content-Type-Options": "nosniff"},
    )


@router.delete("/me/avatar", response_model=UserOut)
def delete_avatar(user=Depends(get_current_user), conn=Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute(
            f"""
            UPDATE users SET avatar = NULL, avatar_mime = NULL, avatar_updated_at = now()
            WHERE id = %s RETURNING {USER_COLUMNS}
            """,
            (user["id"],),
        )
        updated = cur.fetchone()
    conn.commit()
    return updated
