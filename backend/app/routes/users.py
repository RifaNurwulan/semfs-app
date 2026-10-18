"""
routes/users.py
---------------
Kelola user -- khusus role admin (RBAC).
  GET   /users              daftar semua user
  PATCH /users/{id}/role    ubah role user
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status

from ..audit import record
from ..database import USER_COLUMNS, get_db
from ..deps import require_roles
from psycopg2 import errors

from ..schemas import CreateUserRequest, RoleUpdate, UserOut
from ..security import hash_password

router = APIRouter(prefix="/users", tags=["Users (khusus Admin)"])


@router.get("", response_model=list[UserOut])
def list_users(admin=Depends(require_roles("admin")), conn=Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute(f"SELECT {USER_COLUMNS} FROM users ORDER BY id")
        return cur.fetchall()


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(body: CreateUserRequest, request: Request, admin=Depends(require_roles("admin")), conn=Depends(get_db)):
    """Admin membuat akun baru sekaligus menentukan role-nya (diagram use case: Admin -> Register Akun)."""
    email = body.email.lower()
    with conn.cursor() as cur:
        cur.execute("SELECT username, email FROM users WHERE username = %s OR email = %s", (body.username, email))
        existing = cur.fetchone()
        if existing:
            field = "Username" if existing["username"] == body.username else "Email"
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"{field} sudah dipakai akun lain")
        try:
            cur.execute(
                f"INSERT INTO users (username, email, password_hash, role) VALUES (%s, %s, %s, %s) RETURNING {USER_COLUMNS}",
                (body.username, email, hash_password(body.password), body.role),
            )
        except errors.UniqueViolation:
            conn.rollback()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username atau email sudah dipakai akun lain")
        user = cur.fetchone()
    record(conn, "user_create", user=admin, entity="user", entity_id=user["id"], detail=f"{user['username']} sebagai {body.role}", request=request)
    conn.commit()
    return user


@router.patch("/{user_id}/role", response_model=UserOut)
def change_role(
    user_id: int,
    body: RoleUpdate,
    request: Request,
    admin=Depends(require_roles("admin")),
    conn=Depends(get_db),
):
    if user_id == admin["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tidak bisa mengubah role akun sendiri",
        )

    with conn.cursor() as cur:
        cur.execute("SELECT role FROM users WHERE id = %s", (user_id,))
        before = cur.fetchone()
        if before is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User tidak ditemukan")
        cur.execute(
            f"UPDATE users SET role = %s WHERE id = %s RETURNING {USER_COLUMNS}",
            (body.role, user_id),
        )
        user = cur.fetchone()
    record(conn, "role_change", user=admin, entity="user", entity_id=user_id, detail=f"{user['username']}: {before['role']} -> {body.role}", request=request)
    conn.commit()
    return user
