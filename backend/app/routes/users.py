"""
routes/users.py
---------------
Kelola user -- khusus role admin (tugas 5c: RBAC).
  GET   /users              daftar semua user
  PATCH /users/{id}/role    ubah role user
"""

from fastapi import APIRouter, Depends, HTTPException, status

from ..database import get_db
from ..deps import require_roles
from ..schemas import RoleUpdate, UserOut

router = APIRouter(prefix="/users", tags=["Users (khusus Admin)"])


@router.get("", response_model=list[UserOut])
def list_users(admin=Depends(require_roles("admin")), conn=Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute("SELECT id, username, email, role, created_at FROM users ORDER BY id")
        return cur.fetchall()


@router.patch("/{user_id}/role", response_model=UserOut)
def change_role(
    user_id: int,
    body: RoleUpdate,
    admin=Depends(require_roles("admin")),
    conn=Depends(get_db),
):
    if user_id == admin["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tidak bisa mengubah role akun sendiri",
        )

    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE users SET role = %s WHERE id = %s
            RETURNING id, username, email, role, created_at
            """,
            (body.role, user_id),
        )
        user = cur.fetchone()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User tidak ditemukan")
    conn.commit()
    return user
