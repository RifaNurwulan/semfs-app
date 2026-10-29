"""..
schemas.py
----------
Bentuk data yang masuk dan keluar dari API (divalidasi otomatis oleh Pydantic).
"""

from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field, StrictInt, field_validator, model_validator

from .modbus_registers import (
    DEFAULT_REGISTER_CONFIG,
    DEFAULT_REGISTER_MAP,
    register_config_from_map,
    validate_register_config,
    validate_register_map,
)

USERNAME_PATTERN = r"^[A-Za-z0-9_.-]+$"
EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"

Role = Literal["admin", "operator", "viewer"]
Severity = Literal["info", "warning", "critical"]


def check_modbus_unit_id(value: Optional[int]) -> Optional[int]:
    if value is not None and not (1 <= value <= 247 or value == 255):
        raise ValueError("Virtual ID harus 1-247 atau 255 untuk server TCP langsung")
    return value


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


class MeterRegister(BaseModel):
    key: str = Field(..., min_length=1, max_length=50, pattern=r"^[A-Za-z0-9_-]+$")
    parameter: str = Field(..., min_length=1, max_length=100)
    unit: str = Field("", max_length=30)
    register_type: Literal["holding", "input"]
    address: StrictInt = Field(..., ge=0, le=65535)
    data_type: Literal["int16", "uint16", "int32", "uint32", "float32", "float64"]


def _register_config_input(value):
    if not isinstance(value, dict):
        return value
    if "register_config" in value:
        value = value.copy()
        value.pop("register_map", None)
        return value
    if "register_map" not in value:
        return value
    try:
        register_config = register_config_from_map(value["register_map"])
        value = value.copy()
        value.pop("register_map")
        value["register_config"] = register_config
    except (TypeError, ValueError):
        pass
    return value


class DeviceBase(BaseModel):
    device_name: Optional[str] = Field(None, max_length=100)
    ip_address: str = Field(..., min_length=1, max_length=45)
    port: int = Field(502, ge=1, le=65535)
    virtual_id: int = Field(1, ge=1, le=255)  # Modbus slave IDs 1-247; 255 for direct TCP
    register_config: list[MeterRegister] = Field(
        default_factory=lambda: [MeterRegister(**entry) for entry in DEFAULT_REGISTER_CONFIG]
    )
    register_map: Optional[dict[str, StrictInt]] = None
    location: Optional[str] = Field(None, max_length=150)
    power_limit_w: Optional[float] = Field(None, gt=0, le=1e9)  # batas daya (W) untuk notifikasi F-13
    enabled: bool = True

    @model_validator(mode="before")
    @classmethod
    def _accept_legacy_register_map(cls, value):
        return _register_config_input(value)

    @field_validator("register_config")
    @classmethod
    def _valid_register_config(cls, value):
        return [MeterRegister(**entry) for entry in validate_register_config(
            [item.model_dump() for item in value]
        )]

    @field_validator("register_map")
    @classmethod
    def _valid_legacy_register_map(cls, value):
        if value is None:
            raise ValueError("register_map tidak boleh kosong")
        return validate_register_map(value)

    @field_validator("virtual_id")
    @classmethod
    def _valid_virtual_id(cls, value):
        return check_modbus_unit_id(value)

class DeviceCreate(DeviceBase):
    device_id: str = Field(..., min_length=2, max_length=50, pattern=r"^[A-Za-z0-9_-]+$")


class DeviceUpdate(BaseModel):
    """Semua field opsional; yang tidak dikirim tidak berubah. power_limit_w=null berarti hapus batas."""

    device_name: Optional[str] = Field(None, max_length=100)
    ip_address: Optional[str] = Field(None, min_length=1, max_length=45)
    port: Optional[int] = Field(None, ge=1, le=65535)
    virtual_id: Optional[int] = Field(None, ge=1, le=255)
    register_config: Optional[list[MeterRegister]] = None
    register_map: Optional[dict[str, StrictInt]] = None
    location: Optional[str] = Field(None, max_length=150)
    power_limit_w: Optional[float] = Field(None, gt=0, le=1e9)
    enabled: Optional[bool] = None

    @model_validator(mode="before")
    @classmethod
    def _accept_legacy_register_map(cls, value):
        return _register_config_input(value)

    @field_validator("register_config")
    @classmethod
    def _valid_register_config(cls, value):
        if value is None:
            raise ValueError("register_config tidak boleh kosong")
        return [MeterRegister(**entry) for entry in validate_register_config(
            [item.model_dump() for item in value]
        )]

    @field_validator("virtual_id")
    @classmethod
    def _valid_virtual_id(cls, value):
        return check_modbus_unit_id(value)

    @field_validator("register_map")
    @classmethod
    def _valid_register_map(cls, value):
        if value is None:
            raise ValueError("register_map tidak boleh kosong")
        return validate_register_map(value)

class DeviceOut(BaseModel):
    id: int
    device_id: str
    device_name: Optional[str] = None
    ip_address: str
    port: int
    virtual_id: Optional[int] = None
    register_address: Optional[int] = None
    register_map: dict[str, int] = Field(default_factory=lambda: DEFAULT_REGISTER_MAP.copy())
    register_config: list[MeterRegister] = Field(
        default_factory=lambda: [MeterRegister(**entry) for entry in DEFAULT_REGISTER_CONFIG]
    )
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
    avg_power_factor: Optional[float] = None
    avg_metric_value: Optional[float] = None
    peak_metric_value: Optional[float] = None
    sample_count: int


class MonitoringDevicePoint(BaseModel):
    device_id: str
    device_name: Optional[str] = None
    time: datetime
    daya: Optional[float] = None
    arus: Optional[float] = None
    tegangan: Optional[float] = None
    power_factor: Optional[float] = None
    metric_value: Optional[float] = None


class MonitoringDailyEnergyPoint(BaseModel):
    time: datetime
    energy_kwh: float


class MonitoringDeviceDailyEnergyPoint(MonitoringDailyEnergyPoint):
    device_id: str
    device_name: Optional[str] = None


class MonitoringDeviceConsumption(BaseModel):
    device_id: str
    device_name: Optional[str] = None
    consumption_kwh: float


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
    v_r_v: Optional[float] = None
    v_s_v: Optional[float] = None
    v_t_v: Optional[float] = None
    v_rn_v: Optional[float] = None
    v_sn_v: Optional[float] = None
    v_tn_v: Optional[float] = None
    i_r_a: Optional[float] = None
    i_s_a: Optional[float] = None
    i_t_a: Optional[float] = None
    i_n_a: Optional[float] = None
    p_total_kw: Optional[float] = None
    q_total_kvar: Optional[float] = None
    s_total_kva: Optional[float] = None
    power_factor: Optional[float] = None
    frequency_hz: Optional[float] = None
    kwh_del: Optional[float] = None
    kwh_rec: Optional[float] = None
    kvarh_del: Optional[float] = None
    kvarh_rec: Optional[float] = None
    kvah_del: Optional[float] = None
    register_values: Optional[dict[str, float]] = None
    register_config: list[MeterRegister] = Field(default_factory=list)


class MonitoringSummary(BaseModel):
    period: Literal["live", "1h", "24h", "7d", "custom"]
    total_energy_kwh: float
    price_per_kwh: float
    estimated_cost: float
    avg_power_w: float
    peak_power_w: float
    points: list[MonitoringPoint]
    device_points: list[MonitoringDevicePoint] = Field(default_factory=list)
    daily_energy: list[MonitoringDailyEnergyPoint] = Field(default_factory=list)
    device_daily_energy: list[MonitoringDeviceDailyEnergyPoint] = Field(default_factory=list)
    device_consumption: list[MonitoringDeviceConsumption] = Field(default_factory=list)
    devices: list[MonitoringDeviceReading]


class EnergyTariffUpdate(BaseModel):
    price_per_kwh: Decimal = Field(..., ge=0, max_digits=12, decimal_places=2)


class EnergyTariffOut(BaseModel):
    price_per_kwh: float


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
