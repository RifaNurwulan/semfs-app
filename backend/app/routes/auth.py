"""
routes/auth.py
--------------
Endpoint autentikasi:
  POST   /auth/register          daftar akun baru (role otomatis 'viewer', kirim OTP email)
  POST   /auth/verify-email      verifikasi email dengan kode OTP 6 digit
  POST   /auth/resend-verification  kirim ulang kode OTP verifikasi email
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
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from fastapi.concurrency import run_in_threadpool
from psycopg2 import errors

from ..config import (
    AVATAR_MAX_BYTES,
    EMAIL_VERIFICATION_EXPIRE_MINUTES,
    EMAIL_VERIFICATION_MAX_ATTEMPTS,
    EMAIL_VERIFICATION_RESEND_SECONDS,
    FRONTEND_URL,
    JWT_EXPIRE_MINUTES,
    RESET_COOLDOWN_SECONDS,
    RESET_REVEAL_UNKNOWN_EMAIL,
    RESET_TOKEN_EXPIRE_MINUTES,
)
from ..audit import record
from ..database import USER_COLUMNS, get_db
from ..deps import get_current_user
from ..email_service import send_reset_email, send_verification_email
from ..schemas import (
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserOut,
    VerifyEmailRequest,
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


    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _issue_verification_code(cur, user_id: int) -> str:
    code = f"{secrets.randbelow(1_000_000):06d}"
    cur.execute(
        """
        UPDATE users
        SET email_otp_hash = %s,
            email_otp_expiry = %s,
            email_otp_attempts = 0,
            email_otp_sent_at = now()
        WHERE id = %s
        """,
        (
            _hash_token(code),
            datetime.now(timezone.utc) + timedelta(minutes=EMAIL_VERIFICATION_EXPIRE_MINUTES),
            user_id,
        ),
    )
    return code


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(
    body: RegisterRequest,
    background: BackgroundTasks,
    request: Request,
    conn=Depends(get_db),
):
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
        except errors.UniqueViolation:
            conn.rollback()
            raise _conflict("Username atau email")
        user = cur.fetchone()
        code = _issue_verification_code(cur, user["id"])
    record(conn, "register", username=user["username"], entity="user", entity_id=user["id"], request=request)
    conn.commit()

    background.add_task(send_verification_email, email, user["username"], code)
    return user


@router.post("/verify-email", response_model=MessageResponse)
def verify_email(body: VerifyEmailRequest, request: Request, conn=Depends(get_db)):
    email = body.email.lower()

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, username, email_verified_at, email_otp_hash,
                   email_otp_expiry, email_otp_attempts
            FROM users WHERE email = %s
            """,
            (email,),
        )
        user = cur.fetchone()

        if user is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Kode verifikasi tidak valid atau sudah kedaluwarsa",
            )
        if user["email_verified_at"] is not None:
            return {"message": "Email sudah terverifikasi. Silakan login."}

        if user["email_otp_attempts"] >= EMAIL_VERIFICATION_MAX_ATTEMPTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Terlalu banyak percobaan. Minta kode OTP baru.",
            )

        code_hash = user["email_otp_hash"]
        expiry = user["email_otp_expiry"]
        if code_hash is None or expiry is None or expiry <= datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Kode verifikasi tidak valid atau sudah kedaluwarsa",
            )

        if not hmac.compare_digest(code_hash, _hash_token(body.code)):
            cur.execute(
                "UPDATE users SET email_otp_attempts = email_otp_attempts + 1 WHERE id = %s",
                (user["id"],),
            )
            conn.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Kode verifikasi salah. Periksa kembali kode di email Anda.",
            )

        cur.execute(
            """
            UPDATE users
            SET email_verified_at = now(),
                email_otp_hash = NULL,
                email_otp_expiry = NULL,
                email_otp_attempts = 0
            WHERE id = %s
            """,
            (user["id"],),
        )
    record(conn, "email_verified", username=user["username"], entity="user", entity_id=user["id"], request=request)
    conn.commit()
    return {"message": "Email berhasil diverifikasi. Silakan login."}


@router.post("/resend-verification", response_model=MessageResponse)
def resend_verification(
    body: ResendVerificationRequest,
    background: BackgroundTasks,
    request: Request,
    conn=Depends(get_db),
):
    email = body.email.lower()
    neutral = {"message": "Jika email terdaftar dan belum diverifikasi, kode OTP baru telah dikirim."}

    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, username, email_verified_at, email_otp_sent_at FROM users WHERE email = %s",
            (email,),
        )
        user = cur.fetchone()

        if user is None or user["email_verified_at"] is not None:
            return neutral

        sent_at = user["email_otp_sent_at"]
        if sent_at is not None:
            elapsed = (datetime.now(timezone.utc) - sent_at).total_seconds()
            if elapsed < EMAIL_VERIFICATION_RESEND_SECONDS:
                wait = int(EMAIL_VERIFICATION_RESEND_SECONDS - elapsed)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Tunggu {wait} detik sebelum meminta kode baru.",
                )

        code = _issue_verification_code(cur, user["id"])
    record(conn, "email_verification_resend", username=user["username"], entity="user", entity_id=user["id"], request=request)
    conn.commit()

    background.add_task(send_verification_email, email, user["username"], code)
    return neutral


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, request: Request, conn=Depends(get_db)):
    identifier = body.username.strip()

    with conn.cursor() as cur:
        cur.execute(
            f"SELECT {USER_COLUMNS}, password_hash, email_verified_at FROM users WHERE username = %s OR email = %s",
            (identifier, identifier.lower()),
        )
        row = cur.fetchone()



    password_ok = verify_password(body.password, row["password_hash"] if row else DUMMY_HASH)
    if row is None or not password_ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username/email atau password salah",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if row["email_verified_at"] is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email belum diverifikasi. Masukkan kode OTP yang dikirim ke email Anda.",
        )

    user = {k: v for k, v in row.items() if k not in ("password_hash", "email_verified_at")}
    record(conn, "login", user=user, request=request)
    conn.commit()
    return TokenResponse(
        access_token=create_access_token(user["id"], user["role"]),
        expires_in=JWT_EXPIRE_MINUTES * 60,
        user=user,
    )


@router.post("/logout", response_model=MessageResponse)
def logout(request: Request, user=Depends(get_current_user), conn=Depends(get_db)):


    record(conn, "logout", user=user, request=request)
    conn.commit()
    return {"message": "Logout berhasil. Hapus token di sisi client."}



@router.get("/me", response_model=UserOut)
def read_me(user=Depends(get_current_user)):
    return user


@router.put("/me", response_model=UserOut)
def update_me(body: UpdateProfileRequest, request: Request, user=Depends(get_current_user), conn=Depends(get_db)):
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
        return user

    with conn.cursor() as cur:

        try:
            cur.execute(
                f"UPDATE users SET {', '.join(sets)} WHERE id = %s RETURNING {USER_COLUMNS}",
                (*params, user["id"]),
            )
        except errors.UniqueViolation:
            conn.rollback()
            raise _conflict("Username atau email")
        updated = cur.fetchone()
    changed = ", ".join(s.split(" = ")[0].replace("password_hash", "password") for s in sets)
    record(conn, "profile_update", user=user, entity="user", entity_id=user["id"], detail=changed, request=request)
    conn.commit()
    return updated



@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(body: ForgotPasswordRequest, background: BackgroundTasks, request: Request, conn=Depends(get_db)):
    email = body.email.lower()
    sent = {"message": "Tautan reset password sudah dikirim ke email Anda."}

    neutral = {"message": "Jika email terdaftar, tautan reset password akan dikirim ke email tersebut."}

    with conn.cursor() as cur:
        cur.execute("SELECT id, username, reset_token_expiry FROM users WHERE email = %s", (email,))
        user = cur.fetchone()

        if user is None:
            if RESET_REVEAL_UNKNOWN_EMAIL:

                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email tidak ditemukan")
            return neutral


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
    record(conn, "password_reset_request", username=user["username"], entity="user", entity_id=user["id"], request=request)
    conn.commit()

    background.add_task(send_reset_email, email, user["username"], f"{FRONTEND_URL}/reset-password?token={token}")
    return sent if RESET_REVEAL_UNKNOWN_EMAIL else neutral


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(body: ResetPasswordRequest, request: Request, conn=Depends(get_db)):


    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE users
            SET password_hash = %s, reset_token = NULL, reset_token_expiry = NULL, password_changed_at = now()
            WHERE reset_token = %s AND reset_token_expiry > now()
            RETURNING id, username
            """,
            (hash_password(body.new_password), _hash_token(body.token)),
        )
        row = cur.fetchone()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tautan reset tidak valid atau sudah kedaluwarsa",
        )
    record(conn, "password_reset", username=row["username"], entity="user", entity_id=row["id"], request=request)
    conn.commit()
    return {"message": "Password berhasil diganti. Silakan login dengan password baru."}



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


def _save_avatar(conn, user: dict, data: bytes, mime: str, request) -> dict:
    with conn.cursor() as cur:
        cur.execute(
            f"""
            UPDATE users SET avatar = %s, avatar_mime = %s, avatar_updated_at = now()
            WHERE id = %s RETURNING {USER_COLUMNS}
            """,
            (data, mime, user["id"]),
        )
        updated = cur.fetchone()
    record(conn, "avatar_update", user=user, request=request)
    conn.commit()
    return updated


@router.put("/me/avatar", response_model=UserOut)
async def upload_avatar(request: Request, user=Depends(get_current_user), conn=Depends(get_db)):
    too_big = HTTPException(
        status_code=413,
        detail=f"Ukuran foto maksimal {AVATAR_MAX_BYTES // 1024} KB",
    )
    declared = request.headers.get("content-length", "")
    if declared.isdigit() and int(declared) > AVATAR_MAX_BYTES:
        raise too_big


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
    return await run_in_threadpool(_save_avatar, conn, user, data, mime, request)


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
def delete_avatar(request: Request, user=Depends(get_current_user), conn=Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute(
            f"""
            UPDATE users SET avatar = NULL, avatar_mime = NULL, avatar_updated_at = now()
            WHERE id = %s RETURNING {USER_COLUMNS}
            """,
            (user["id"],),
        )
        updated = cur.fetchone()
    record(conn, "avatar_delete", user=user, request=request)
    conn.commit()
    return updated
