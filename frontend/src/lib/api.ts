export type Role = 'admin' | 'operator' | 'viewer'
export type Severity = 'info' | 'warning' | 'critical'

export interface User {
  id: number
  username: string
  email: string
  role: Role
  created_at: string
  has_avatar: boolean
  avatar_updated_at: string | null
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

export interface NotificationItem {
  id: number
  type: string
  severity: Severity
  title: string
  message: string | null
  device_id: string | null
  created_at: string
  read: boolean
}

export interface SupportRequest {
  id: number
  name: string
  email: string
  message: string
  status: 'new' | 'resolved'
  created_at: string
  resolved_at: string | null
}

export interface NewUserPayload {
  username: string
  email: string
  password: string
}

export interface NotificationList {
  items: NotificationItem[]
  unread_count: number
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
  /** Body JSON */
  body?: unknown
  /** Body mentah (mis. file gambar). Content-Type diambil dari jenis file. */
  rawBody?: Blob
  token?: string | null
  responseType?: 'json' | 'blob'
}

async function request<T>(
  path: string,
  { method = 'GET', body, rawBody, token, responseType = 'json' }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (rawBody) headers['Content-Type'] = rawBody.type || 'application/octet-stream'
  else if (body !== undefined) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: rawBody ?? (body !== undefined ? JSON.stringify(body) : undefined),
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

  return (responseType === 'blob' ? await res.blob() : await res.json()) as T
}

export const api = {
  login: (username: string, password: string) =>
    request<LoginResponse>('/auth/login', { method: 'POST', body: { username, password } }),
  logout: (token: string) => request<{ message: string }>('/auth/logout', { method: 'POST', token }),
  me: (token: string) => request<User>('/auth/me', { token }),
  updateProfile: (token: string, payload: UpdateProfilePayload) =>
    request<User>('/auth/me', { method: 'PUT', body: payload, token }),
  health: () => request<HealthResponse>('/health'),

  register: (payload: NewUserPayload) => request<User>('/auth/register', { method: 'POST', body: payload }),
  listUsers: (token: string) => request<User[]>('/users', { token }),
  createUser: (token: string, payload: NewUserPayload & { role: Role }) =>
    request<User>('/users', { method: 'POST', body: payload, token }),
  changeRole: (token: string, id: number, role: Role) =>
    request<User>(`/users/${id}/role`, { method: 'PATCH', body: { role }, token }),

  sendSupport: (payload: { name: string; email: string; message: string }) =>
    request<{ message: string }>('/support', { method: 'POST', body: payload }),
  listSupport: (token: string) => request<SupportRequest[]>('/support?limit=50', { token }),
  setSupportStatus: (token: string, id: number, status: SupportRequest['status']) =>
    request<SupportRequest>(`/support/${id}`, { method: 'PATCH', body: { status }, token }),

  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (token: string, newPassword: string) =>
    request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: { token, new_password: newPassword },
    }),

  uploadAvatar: (token: string, image: Blob) =>
    request<User>('/auth/me/avatar', { method: 'PUT', rawBody: image, token }),
  getAvatar: (token: string) => request<Blob>('/auth/me/avatar', { token, responseType: 'blob' }),
  deleteAvatar: (token: string) => request<User>('/auth/me/avatar', { method: 'DELETE', token }),

  notifications: (token: string, limit = 20) =>
    request<NotificationList>(`/notifications?limit=${limit}`, { token }),
  markNotificationRead: (token: string, id: number) =>
    request<{ message: string }>(`/notifications/${id}/read`, { method: 'POST', token }),
  markAllNotificationsRead: (token: string) =>
    request<{ message: string }>('/notifications/read-all', { method: 'POST', token }),
}
