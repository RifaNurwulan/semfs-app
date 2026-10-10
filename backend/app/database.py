"""
database.py
-----------
Koneksi ke PostgreSQL/TimescaleDB. Satu koneksi dibuka per request,
lalu otomatis ditutup setelah request selesai.
"""

import psycopg2
from psycopg2.extras import RealDictCursor

from .config import DATABASE_URL


def get_db():
    """Dependency FastAPI: kasih koneksi DB ke route, tutup otomatis setelahnya."""
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    try:
        yield conn
    finally:
        conn.close()  # perubahan yang belum di-commit otomatis dibatalkan
