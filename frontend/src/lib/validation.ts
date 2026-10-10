// Aturan yang sama dengan backend (app/schemas.py) supaya error tertangkap sebelum kirim.
export const USERNAME_RE = /^[A-Za-z0-9_.-]{3,50}$/
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function passwordError(password: string): string | null {
  if (password.length < 8) return 'Password minimal 8 karakter'
  if (new TextEncoder().encode(password).length > 72) return 'Password terlalu panjang (maksimal 72 byte)'
  return null
}
