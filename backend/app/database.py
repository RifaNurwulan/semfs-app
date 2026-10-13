"""
database.py
-----------
Koneksi ke PostgreSQL/TimescaleDB. Satu koneksi dibuka per request,
lalu otomatis ditutup setelah request selesai.
"""

import psycopg2
from psycopg2.extras import RealDictCursor

from .config import DATABASE_URL

# Kolom user yang aman dikirim ke client (tanpa password_hash dan tanpa isi foto)
USER_COLUMNS = (
    "id, username, email, role, created_at, "
    "(avatar IS NOT NULL) AS has_avatar, avatar_updated_at"
)


def get_db():
    """Dependency FastAPI: kasih koneksi DB ke route, tutup otomatis setelahnya."""
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    try:
        yield conn
    finally:
        conn.close()  # perubahan yang belum di-commit otomatis dibatalkan
