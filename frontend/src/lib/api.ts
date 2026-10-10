export type Role = 'admin' | 'operator' | 'viewer'

export interface User {
  id: number
  username: string
  email: string
  role: Role
  created_at: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
  expires_in: number
  user: User
}

export interface UpdateProfilePayload {
  username?: string
  email?: string
  current_password?: string
  new_password?: string
}

export interface HealthResponse {
  status: string
  database: string
}

// Alamat API FastAPI. Ubah lewat file .env di folder frontend (VITE_API_URL).
const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://127.0.0.1:8000'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// Dipanggil kalau server menjawab 401 untuk request yang membawa token
// (token kedaluwarsa / tidak valid) -> AuthProvider akan mengeluarkan user.
let unauthorizedHandler: (() => void) | null = null
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler
}

interface RequestOptions {
  method?: string
  body?: unknown
  token?: string | null
}

async function request<T>(path: string, { method = 'GET', body, token }: RequestOptions = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('Tidak dapat terhubung ke server. Pastikan API sudah berjalan.', 0)
  }

  if (!res.ok) {
    const data: unknown = await res.json().catch(() => null)
    const detail = (data as { detail?: unknown } | null)?.detail
    const message =
      typeof detail === 'string'
        ? detail
        : res.status === 422
          ? 'Data yang dikirim tidak valid. Periksa kembali isian Anda.'
          : 'Terjadi kesalahan pada server.'
    if (res.status === 401 && token) unauthorizedHandler?.()
    throw new ApiError(message, res.status)
  }

  return (await res.json()) as T
}

export const api = {
  login: (username: string, password: string) =>
    request<LoginResponse>('/auth/login', { method: 'POST', body: { username, password } }),
  logout: (token: string) => request<{ message: string }>('/auth/logout', { method: 'POST', token }),
  me: (token: string) => request<User>('/auth/me', { token }),
  updateProfile: (token: string, payload: UpdateProfilePayload) =>
    request<User>('/auth/me', { method: 'PUT', body: payload, token }),
  health: () => request<HealthResponse>('/health'),
}
