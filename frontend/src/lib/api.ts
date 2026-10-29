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

export type DeviceStatus = 'online' | 'offline' | 'error'
export type ModbusRegisterType = 'holding' | 'input'
export type ModbusDataType = 'int16' | 'uint16' | 'int32' | 'uint32' | 'float32' | 'float64'

export interface MeterRegister {
  key: string
  parameter: string
  unit: string
  register_type: ModbusRegisterType
  address: number
  data_type: ModbusDataType
}

export interface Device {
  id: number
  device_id: string
  device_name: string | null
  ip_address: string
  port: number
  virtual_id: number | null
  register_address: number | null
  register_map: Record<string, number>
  register_config: MeterRegister[]
  location: string | null
  status: DeviceStatus
  last_seen_at: string | null
  enabled: boolean
  power_limit_w: number | null
  created_at: string
  uptime_24h: number | null
}

export interface DevicePayload {
  device_name: string | null
  ip_address: string
  port: number
  virtual_id: number
  register_config: MeterRegister[]
  location: string | null
  power_limit_w: number | null
  enabled: boolean
}

export type MonitoringPeriod = 'live' | '1h' | '24h' | '7d' | 'custom'

export interface MonitoringPoint {
  time: string
  avg_power_w: number | null
  avg_current_a: number | null
  avg_voltage_v: number | null
  peak_power_w: number | null
  avg_power_factor: number | null
  avg_metric_value: number | null
  peak_metric_value: number | null
  sample_count: number
}

export interface MonitoringDevicePoint {
  device_id: string
  device_name: string | null
  time: string
  daya: number | null
  arus: number | null
  tegangan: number | null
  power_factor: number | null
  metric_value: number | null
}

export interface MonitoringDailyEnergyPoint {
  time: string
  energy_kwh: number
}

export interface MonitoringDeviceDailyEnergyPoint extends MonitoringDailyEnergyPoint {
  device_id: string
  device_name: string | null
}

export interface MonitoringDeviceConsumption {
  device_id: string
  device_name: string | null
  consumption_kwh: number
}

export interface MonitoringDeviceReading {
  device_id: string
  device_name: string | null
  location: string | null
  status: DeviceStatus
  enabled: boolean
  time: string | null
  arus: number | null
  tegangan: number | null
  daya: number | null
  energy: number | null
  v_r_v: number | null
  v_s_v: number | null
  v_t_v: number | null
  v_rn_v: number | null
  v_sn_v: number | null
  v_tn_v: number | null
  i_r_a: number | null
  i_s_a: number | null
  i_t_a: number | null
  i_n_a: number | null
  p_total_kw: number | null
  q_total_kvar: number | null
  s_total_kva: number | null
  power_factor: number | null
  frequency_hz: number | null
  kwh_del: number | null
  kwh_rec: number | null
  kvarh_del: number | null
  kvarh_rec: number | null
  kvah_del: number | null
  register_values: Record<string, number> | null
  register_config: MeterRegister[]
}

export interface MonitoringSummary {
  period: MonitoringPeriod
  total_energy_kwh: number
  price_per_kwh: number
  estimated_cost: number
  avg_power_w: number
  peak_power_w: number
  points: MonitoringPoint[]
  device_points: MonitoringDevicePoint[]
  daily_energy: MonitoringDailyEnergyPoint[]
  device_daily_energy: MonitoringDeviceDailyEnergyPoint[]
  device_consumption: MonitoringDeviceConsumption[]
  devices: MonitoringDeviceReading[]
}

export interface EnergyTariff {
  price_per_kwh: number
}

export interface ProbeResult {
  ok: boolean
  message: string
  arus: number | null
  tegangan: number | null
  daya: number | null
}

export interface AuditLog {
  id: number
  at: string
  username: string | null
  action: string
  entity: string | null
  entity_id: string | null
  detail: string | null
  ip: string | null
}

export interface AuditLogList {
  items: AuditLog[]
  next_before_id: number | null
}

export interface RestoreResult {
  created: number
  updated: number
  message: string
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
  /** Body JSON. */
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

  listDevices: (token: string) => request<Device[]>('/devices', { token }),
  monitoringSummary: (
    token: string,
    period: MonitoringPeriod,
    deviceId?: string,
    startTime?: string,
    endTime?: string,
    metricKey = 'daya',
  ) => {
    const query = new URLSearchParams({ period })
    if (deviceId) query.set('device_id', deviceId)
    if (startTime) query.set('start_time', startTime)
    if (endTime) query.set('end_time', endTime)
    query.set('metric_key', metricKey)
    return request<MonitoringSummary>(`/monitoring/summary?${query}`, { token })
  },
  createDevice: (token: string, payload: DevicePayload & { device_id: string }) =>
    request<Device>('/devices', { method: 'POST', body: payload, token }),
  updateDevice: (token: string, deviceId: string, payload: Partial<DevicePayload>) =>
    request<Device>(`/devices/${encodeURIComponent(deviceId)}`, { method: 'PUT', body: payload, token }),
  deleteDevice: (token: string, deviceId: string, purge: boolean) =>
    request<{ message: string }>(`/devices/${encodeURIComponent(deviceId)}?purge=${purge}`, { method: 'DELETE', token }),
  testDevice: (token: string, deviceId: string) =>
    request<ProbeResult>(`/devices/${encodeURIComponent(deviceId)}/test`, { method: 'POST', token }),

  auditLogs: (token: string, opts: { beforeId?: number | null; action?: string } = {}) => {
    const q = new URLSearchParams({ limit: '25' })
    if (opts.beforeId) q.set('before_id', String(opts.beforeId))
    if (opts.action) q.set('action', opts.action)
    return request<AuditLogList>(`/maintenance/audit-logs?${q}`, { token })
  },
  energyTariff: (token: string) => request<EnergyTariff>('/maintenance/energy-tariff', { token }),
  updateEnergyTariff: (token: string, pricePerKwh: number) =>
    request<EnergyTariff>('/maintenance/energy-tariff', {
      method: 'PUT',
      body: { price_per_kwh: pricePerKwh },
      token,
    }),
  backupConfig: (token: string) => request<Blob>('/maintenance/backup', { token, responseType: 'blob' }),
  restoreConfig: (token: string, file: Blob) =>
    request<RestoreResult>('/maintenance/restore', { method: 'POST', rawBody: file, token }),

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
/**..*/