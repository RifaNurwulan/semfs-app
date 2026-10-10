"""
routes/auth.py
--------------
Endpoint autentikasi (tugas 5a & 5b):
  POST /auth/register   daftar akun baru (role otomatis 'viewer')
  POST /auth/login      login pakai username/email + password -> token JWT
  POST /auth/logout     logout
  GET  /auth/me         lihat profil sendiri
  PUT  /auth/me         edit profil (username, email, password)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from psycopg2 import errors

from ..database import get_db
from ..deps import get_current_user
from ..schemas import (
    LoginRequest,
    MessageResponse,
    RegisterRequest,
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
from ..config import JWT_EXPIRE_MINUTES

router = APIRouter(prefix="/auth", tags=["Auth"])

USER_COLUMNS = "id, username, email, role, created_at"


def _conflict(field: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=f"{field} sudah dipakai akun lain",
    )


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
            """
            SELECT id, username, email, role, created_at, password_hash
            FROM users WHERE username = %s OR email = %s
            """,
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
