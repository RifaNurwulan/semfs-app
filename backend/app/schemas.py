"""...
schemas.py
----------
Bentuk data yang masuk dan keluar dari API (divalidasi otomatis oleh Pydantic).
"""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

USERNAME_PATTERN = r"^[A-Za-z0-9_.-]+$"
EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"

Role = Literal["admin", "operator", "viewer"]
Severity = Literal["info", "warning", "critical"]


def check_bcrypt_limit(value: Optional[str]) -> Optional[str]:
    # bcrypt hanya membaca 72 byte pertama, jadi tolak yang lebih panjang
    if value is not None and len(value.encode("utf-8")) > 72:
        raise ValueError("Password maksimal 72 byte")
    return value


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, description="Boleh diisi username ATAU email")
    password: str = Field(..., min_length=1)


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern=USERNAME_PATTERN)
    email: str = Field(..., max_length=100, pattern=EMAIL_PATTERN)
    password: str = Field(..., min_length=8, max_length=72)

    @field_validator("password")
    @classmethod
    def _password_limit(cls, v):
        return check_bcrypt_limit(v)


class UpdateProfileRequest(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50, pattern=USERNAME_PATTERN)
    email: Optional[str] = Field(None, max_length=100, pattern=EMAIL_PATTERN)
    current_password: Optional[str] = None  # wajib kalau mau ganti password
    new_password: Optional[str] = Field(None, min_length=8, max_length=72)

    @field_validator("new_password")
    @classmethod
    def _new_password_limit(cls, v):
        return check_bcrypt_limit(v)


class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., max_length=100, pattern=EMAIL_PATTERN)


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=20, max_length=200)
    new_password: str = Field(..., min_length=8, max_length=72)

    @field_validator("new_password")
    @classmethod
    def _new_password_limit(cls, v):
        return check_bcrypt_limit(v)


class CreateUserRequest(RegisterRequest):
    """Admin membuat akun sekaligus menentukan role-nya."""

    role: Role = "viewer"


class SupportRequestIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., max_length=100, pattern=EMAIL_PATTERN)
    message: str = Field(..., min_length=10, max_length=2000)


class SupportStatusUpdate(BaseModel):
    status: Literal["new", "resolved"]


class SupportRequestOut(BaseModel):
    id: int
    name: str
    email: str
    message: str
    status: Literal["new", "resolved"]
    created_at: datetime
    resolved_at: Optional[datetime] = None


class DeviceBase(BaseModel):
    device_name: Optional[str] = Field(None, max_length=100)
    ip_address: str = Field(..., min_length=1, max_length=45)
    port: int = Field(502, ge=1, le=65535)
    virtual_id: int = Field(1, ge=0, le=247)  # Modbus Unit/Slave ID
    register_address: int = Field(0, ge=0, le=65535)  # alamat register pertama (arus, tegangan, daya berurutan)
    location: Optional[str] = Field(None, max_length=150)
    power_limit_w: Optional[float] = Field(None, gt=0, le=1e9)  # batas daya (W) untuk notifikasi F-13
    enabled: bool = True


class DeviceCreate(DeviceBase):
    device_id: str = Field(..., min_length=2, max_length=50, pattern=r"^[A-Za-z0-9_-]+$")


class DeviceUpdate(BaseModel):
    """Semua field opsional; yang tidak dikirim tidak berubah. power_limit_w=null berarti hapus batas."""

    device_name: Optional[str] = Field(None, max_length=100)
    ip_address: Optional[str] = Field(None, min_length=1, max_length=45)
    port: Optional[int] = Field(None, ge=1, le=65535)
    virtual_id: Optional[int] = Field(None, ge=0, le=247)
    register_address: Optional[int] = Field(None, ge=0, le=65535)
    location: Optional[str] = Field(None, max_length=150)
    power_limit_w: Optional[float] = Field(None, gt=0, le=1e9)
    enabled: Optional[bool] = None


class DeviceOut(BaseModel):
    id: int
    device_id: str
    device_name: Optional[str] = None
    ip_address: str
    port: int
    virtual_id: Optional[int] = None
    register_address: Optional[int] = None
    location: Optional[str] = None
    status: Literal["online", "offline", "error"]
    last_seen_at: Optional[datetime] = None
    enabled: bool
    power_limit_w: Optional[float] = None
    created_at: datetime
    uptime_24h: Optional[float] = None  # persen, None = belum pernah terhubung


class MonitoringPoint(BaseModel):
    time: datetime
    avg_power_w: Optional[float] = None
    avg_current_a: Optional[float] = None
    avg_voltage_v: Optional[float] = None
    peak_power_w: Optional[float] = None
    sample_count: int


class MonitoringDeviceReading(BaseModel):
    device_id: str
    device_name: Optional[str] = None
    location: Optional[str] = None
    status: Literal["online", "offline", "error"]
    enabled: bool
    time: Optional[datetime] = None
    arus: Optional[float] = None
    tegangan: Optional[float] = None
    daya: Optional[float] = None
    energy: Optional[float] = None


class MonitoringSummary(BaseModel):
    period: Literal["1h", "24h", "7d"]
    total_energy_kwh: float
    avg_power_w: float
    peak_power_w: float
    points: list[MonitoringPoint]
    devices: list[MonitoringDeviceReading]


class ProbeResult(BaseModel):
    ok: bool
    message: str
    arus: Optional[float] = None
    tegangan: Optional[float] = None
    daya: Optional[float] = None


class AuditLogOut(BaseModel):
    id: int
    at: datetime
    username: Optional[str] = None
    action: str
    entity: Optional[str] = None
    entity_id: Optional[str] = None
    detail: Optional[str] = None
    ip: Optional[str] = None


class AuditLogList(BaseModel):
    items: list[AuditLogOut]
    next_before_id: Optional[int] = None  # kirim sebagai before_id untuk halaman berikutnya


class RestoreResult(BaseModel):
    created: int
    updated: int
    message: str


class RoleUpdate(BaseModel):
    role: Role


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    role: Role
    created_at: datetime
    has_avatar: bool = False
    avatar_updated_at: Optional[datetime] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # detik
    user: UserOut


class MessageResponse(BaseModel):
    message: str


class NotificationOut(BaseModel):
    id: int
    type: str
    severity: Severity
    title: str
    message: Optional[str] = None
    device_id: Optional[str] = None
    created_at: datetime
    read: bool


class NotificationList(BaseModel):
    items: list[NotificationOut]
    unread_count: int
