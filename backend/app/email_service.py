"""
email_service.py
----------------
Kirim email reset password lewat SMTP.

Kalau SMTP_HOST di .env kosong (mode development), email TIDAK dikirim; tautan
reset dicetak di terminal tempat uvicorn berjalan, tinggal disalin ke browser.
"""

import logging
import smtplib
from email.message import EmailMessage

from .config import (
    RESET_TOKEN_EXPIRE_MINUTES,
    SMTP_FROM,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_STARTTLS,
    SMTP_USER,
    SUPPORT_EMAIL,
)

# Memakai logger milik uvicorn supaya pesannya tampil di terminal yang sama
log = logging.getLogger("uvicorn.error")


def send_reset_email(to_email: str, username: str, link: str) -> None:
    if not SMTP_HOST:
        log.warning("[MODE DEV - SMTP belum diatur] Tautan reset password untuk %s: %s", username, link)
        return

    msg = EmailMessage()
    msg["Subject"] = "Reset password SEMFS"
    msg["From"] = SMTP_FROM
    msg["To"] = to_email
    msg.set_content(
        f"Halo {username},\n\n"
        f"Klik tautan berikut untuk membuat password baru "
        f"(berlaku {RESET_TOKEN_EXPIRE_MINUTES} menit, hanya bisa dipakai sekali):\n\n"
        f"{link}\n\n"
        "Kalau Anda tidak meminta reset password, abaikan email ini. Password Anda tidak berubah.\n"
    )

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as smtp:
            if SMTP_STARTTLS:
                smtp.starttls()
            if SMTP_USER:
                smtp.login(SMTP_USER, SMTP_PASSWORD)
            smtp.send_message(msg)
        log.info("Email reset password terkirim ke %s", to_email)
    except Exception:
        # Dijalankan di background task: jangan sampai menjatuhkan server
        log.exception("Gagal mengirim email reset password ke %s", to_email)


def send_support_email(name: str, from_email: str, message: str) -> None:
    """Teruskan pesan 'Hubungi Support' ke tim support. Balasan langsung ke pengirim (Reply-To)."""
    to = SUPPORT_EMAIL or SMTP_FROM
    if not SMTP_HOST:
        log.warning("[MODE DEV - SMTP belum diatur] Pesan support dari %s <%s>: %s", name, from_email, message)
        return

    msg = EmailMessage()
    msg["Subject"] = "Pesan support SEMFS"
    msg["From"] = SMTP_FROM
    msg["To"] = to
    msg["Reply-To"] = from_email  # sudah divalidasi: tanpa spasi/baris baru
    msg.set_content(f"Dari: {name} <{from_email}>\n\n{message}\n")
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as smtp:
            if SMTP_STARTTLS:
                smtp.starttls()
            if SMTP_USER:
                smtp.login(SMTP_USER, SMTP_PASSWORD)
            smtp.send_message(msg)
    except Exception:
        log.exception("Gagal meneruskan pesan support dari %s", from_email)
