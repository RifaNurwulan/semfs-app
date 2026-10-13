"""
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
