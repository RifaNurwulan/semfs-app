"""
security.py
-----------
Hash password (bcrypt) dan buat/baca token JWT.
"""

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from .config import JWT_ALGORITHM, JWT_EXPIRE_MINUTES, JWT_SECRET


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        # Hash tidak valid (misalnya 'placeholder_hash_ganti_nanti' dari data dummy)
        return False


# Dipakai supaya waktu respon login tetap mirip walau username tidak ditemukan
DUMMY_HASH = hash_password("dummy-password")


def create_access_token(user_id: int, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Raise jwt.ExpiredSignatureError / jwt.InvalidTokenError kalau token bermasalah."""
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
