"""
config.py
---------
Baca konfigurasi dari file .env (di folder backend/).
"""

import os

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))

# Alamat frontend yang boleh mengakses API (pisahkan dengan koma kalau lebih dari satu)
CORS_ORIGINS = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if o.strip()
]

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL belum diisi di file .env")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET belum diisi di file .env")
if len(JWT_SECRET.encode("utf-8")) < 32:
    raise RuntimeError(
        "JWT_SECRET di file .env terlalu pendek (minimal 32 karakter), "
        "token login jadi mudah dipalsukan.\n"
        "Buat yang baru dengan perintah ini, lalu tempel hasilnya ke .env:\n"
        '    python -c "import secrets; print(secrets.token_hex(32))"'
    )
