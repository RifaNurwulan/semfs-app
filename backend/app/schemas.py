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


class RoleUpdate(BaseModel):
    role: Role


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    role: Role
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # detik
    user: UserOut


class MessageResponse(BaseModel):
    message: str
