"""
deps.py
-------
Dependency untuk melindungi endpoint:
  - get_current_user : wajib login (kirim header  Authorization: Bearer <token>)
  - require_roles    : wajib login DAN punya salah satu role yang diizinkan (RBAC)

Contoh pemakaian di modul lain (Dashboard, Forecasting, dll):

    from app.deps import get_current_user, require_roles

    @router.get("/dashboard")                       # semua role yang sudah login
    def dashboard(user=Depends(get_current_user)): ...

    @router.post("/forecast")                       # hanya operator & admin
    def forecast(user=Depends(require_roles("operator", "admin"))): ...
"""

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .database import USER_COLUMNS, get_db
from .security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    conn=Depends(get_db),
) -> dict:
    if creds is None:
        raise _unauthorized("Belum login. Sertakan header Authorization: Bearer <token>")

    try:
        payload = decode_access_token(creds.credentials)
        user_id = int(payload["sub"])
        issued_at = int(payload.get("iat", 0))
    except jwt.ExpiredSignatureError:
        raise _unauthorized("Sesi sudah berakhir, silakan login ulang")
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise _unauthorized("Token tidak valid")

    # Role diambil dari database (bukan dari token) supaya perubahan role langsung berlaku
    with conn.cursor() as cur:
        cur.execute(f"SELECT {USER_COLUMNS}, password_changed_at FROM users WHERE id = %s", (user_id,))
        user = cur.fetchone()

    if user is None:
        raise _unauthorized("Akun tidak ditemukan")

    # Password pernah direset setelah token ini dibuat -> token lama tidak berlaku lagi
    changed_at = user.pop("password_changed_at")
    if changed_at is not None and issued_at < int(changed_at.timestamp()):
        raise _unauthorized("Password sudah diganti, silakan login ulang")
    return user


def require_roles(*allowed_roles: str):
    def checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Akses ditolak. Dibutuhkan role: {', '.join(allowed_roles)}",
            )
        return user

    return checker
