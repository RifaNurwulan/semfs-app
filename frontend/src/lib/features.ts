import { Activity, FileText, Settings, TrendingUp, Users, Wrench, type LucideIcon } from 'lucide-react'
import type { Role } from './api'

export type FeatureKey = 'monitoring' | 'forecasting' | 'pengaturan' | 'ekspor' | 'maintenance' | 'pengguna'

export interface Feature {
  key: FeatureKey
  path: string
  title: string
  /** Teks di kartu Dashboard */
  description: string
  /** Teks di header halaman */
  subtitle: string
  icon: LucideIcon
  size: 'large' | 'small'
  gradient: string
  headerIconBg: string
  /** Role yang boleh membuka halaman ini (RBAC, F-10) */
  roles: Role[]
  /** Info roadmap, dipakai halaman placeholder */
  owner: string
  task: string
  schedule: string
}

// Urutan = urutan kartu di Dashboard. Untuk mengubah hak akses cukup ubah `roles`.
export const FEATURES: Feature[] = [
  {
    key: 'monitoring',
    path: '/monitoring',
    title: 'Monitoring Energy',
    description: 'Pantau konsumsi energi real-time dengan visualisasi interaktif',
    subtitle: 'Pantau konsumsi energi secara real-time',
    icon: Activity,
    size: 'large',
    gradient: 'from-emerald-500 to-teal-600',
    headerIconBg: 'bg-emerald-600',
    roles: ['admin', 'operator', 'viewer'],
    owner: 'Irfan',
    task: 'Poin 6b-6c',
    schedule: 'W5-W6',
  },
  {
    key: 'forecasting',
    path: '/forecasting',
    title: 'Forecasting Energy',
    description: 'Prediksi dan analisis tren konsumsi energi menggunakan AI',
    subtitle: 'Prediksi konsumsi energi dengan model AI',
    icon: TrendingUp,
    size: 'large',
    gradient: 'from-blue-500 to-cyan-600',
    headerIconBg: 'bg-blue-600',
    // SRS 2.3 + diagram use case: Viewer juga boleh melihat forecast
    roles: ['admin', 'operator', 'viewer'],
    owner: 'Rifat',
    task: 'Poin 7c',
    schedule: 'W4-W5',
  },
  {
    key: 'pengaturan',
    path: '/pengaturan',
    title: 'Pengaturan Sistem',
    description: 'Konfigurasi sistem',
    subtitle: 'Konfigurasi zona waktu dan bahasa',
    icon: Settings,
    size: 'small',
    gradient: 'from-purple-500 to-indigo-600',
    headerIconBg: 'bg-purple-600',
    roles: ['admin'],
    owner: 'Ilham',
    task: 'Poin 8b',
    schedule: 'W7',
  },
  {
    key: 'ekspor',
    path: '/ekspor',
    title: 'Ekspor & Laporan',
    description: 'Generate laporan',
    subtitle: 'Generate dan export data laporan energi',
    icon: FileText,
    size: 'small',
    gradient: 'from-orange-500 to-orange-600',
    headerIconBg: 'bg-orange-500',
    roles: ['admin', 'operator'],
    owner: 'Ilham',
    task: 'Poin 8a',
    schedule: 'W6-W7',
  },
  {
    key: 'maintenance',
    path: '/maintenance',
    title: 'Maintenance',
    description: 'Pemeliharaan dan monitoring kesehatan sistem',
    subtitle: 'Kelola perangkat power meter',
    icon: Wrench,
    size: 'small',
    gradient: 'from-red-500 to-rose-600',
    headerIconBg: 'bg-rose-600',
    roles: ['admin'],
    owner: 'Ilham',
    task: 'Poin 8c',
    schedule: 'W7-W8',
  },
  {
    key: 'pengguna',
    path: '/pengguna',
    title: 'Kelola Pengguna',
    description: 'Atur akun, role, dan pesan support',
    subtitle: 'Kelola akun pengguna, role, dan pesan support',
    icon: Users,
    size: 'small',
    gradient: 'from-slate-600 to-slate-800',
    headerIconBg: 'bg-slate-700',
    roles: ['admin'],
    owner: 'Rifa',
    task: 'Tambahan di luar timeline',
    schedule: '-',
  },
]

export function getFeature(key: FeatureKey): Feature {
  return FEATURES.find((f) => f.key === key)!
}

export function canAccess(role: Role, feature: Feature): boolean {
  return feature.roles.includes(role)
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  operator: 'Operator',
  viewer: 'Viewer',
}
