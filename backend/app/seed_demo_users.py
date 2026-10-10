"""
seed_demo_users.py
------------------
Mengganti password_hash placeholder di 3 user dummy (dari 003_sample_data.sql)
dengan hash bcrypt asli, supaya bisa dipakai login saat development.

Jalankan dari folder backend/ (venv aktif):
    python -m app.seed_demo_users

HANYA UNTUK DEVELOPMENT. Jangan dipakai di server production.
"""

import psycopg2

from .config import DATABASE_URL
from .security import hash_password

DEMO_USERS = [
    ("admin_rifa", "Admin123!"),
    ("operator_demo", "Operator123!"),
    ("viewer_demo", "Viewer123!"),
]


def main():
    conn = psycopg2.connect(DATABASE_URL)
    with conn, conn.cursor() as cur:
        for username, password in DEMO_USERS:
            cur.execute(
                "UPDATE users SET password_hash = %s WHERE username = %s",
                (hash_password(password), username),
            )
            status = "OK" if cur.rowcount else "TIDAK DITEMUKAN (jalankan 003_sample_data.sql dulu)"
            print(f"{username:15} password = {password:15} -> {status}")
    conn.close()


if __name__ == "__main__":
    main()
