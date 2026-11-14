"""
config.py
---------
Baca konfigurasi dari file .env (di folder backend/).
"""

import os

from dotenv import load_dotenv

load_dotenv()


def _flag(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in ("1", "true", "yes", "on")


DATABASE_URL = os.getenv("DATABASE_URL")
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))



DEVICE_STALE_SECONDS = max(int(os.getenv("DEVICE_STALE_SECONDS", "60")), 5)


CORS_ORIGINS = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if o.strip()
]



FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
RESET_TOKEN_EXPIRE_MINUTES = int(os.getenv("RESET_TOKEN_EXPIRE_MINUTES", "60"))
RESET_COOLDOWN_SECONDS = 60


RESET_REVEAL_UNKNOWN_EMAIL = _flag("RESET_REVEAL_UNKNOWN_EMAIL", True)


EMAIL_VERIFICATION_EXPIRE_MINUTES = int(os.getenv("EMAIL_VERIFICATION_EXPIRE_MINUTES", "10"))
EMAIL_VERIFICATION_RESEND_SECONDS = int(os.getenv("EMAIL_VERIFICATION_RESEND_SECONDS", "60"))
EMAIL_VERIFICATION_MAX_ATTEMPTS = int(os.getenv("EMAIL_VERIFICATION_MAX_ATTEMPTS", "5"))


SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "").strip() or SMTP_USER or "noreply@semfs.local"
SMTP_STARTTLS = _flag("SMTP_STARTTLS", True)


SUPPORT_EMAIL = os.getenv("SUPPORT_EMAIL", "").strip()


AVATAR_MAX_BYTES = 512 * 1024

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
