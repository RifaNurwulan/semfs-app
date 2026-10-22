"""
main.py
-------
Titik masuk aplikasi FastAPI.

Jalankan dari folder backend/ (venv aktif):
    uvicorn app.main:app --reload

Dokumentasi interaktif otomatis:  http://127.0.0.1:8000/docs
"""

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import CORS_ORIGINS
from .database import get_db
from .routes import auth, devices, maintenance, monitoring, notifications, support, users

app = FastAPI(title="SEMF API", version="0.1.0")

# Izinkan frontend React (Vite, port 5173) memanggil API ini dari browser
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,  # token dikirim lewat header Authorization, bukan cookie
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(notifications.router)
app.include_router(support.router)
app.include_router(devices.router)
app.include_router(monitoring.router)
app.include_router(maintenance.router)


@app.get("/health", tags=["System"])
def health(conn=Depends(get_db)):
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
        return {"status": "ok", "database": "connected"}
    except Exception:
        raise HTTPException(status_code=503, detail="Database tidak bisa diakses")
