import { ArrowDown, ArrowUp, BarChart3, CircleAlert, TrendingUp, Zap, Battery } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useUser } from '../auth/auth-context'
import { MainHeader } from '../components/layout/MainHeader'
import { Badge } from '../components/ui/badge'
import { Card } from '../components/ui/card'
import { canAccess, FEATURES, type Feature } from '../lib/features'
import { useHealth } from '../lib/useHealth'
import { cn, formatTime } from '../lib/utils'

interface Stat {
  icon: LucideIcon
  iconClass: string
  value: string
  label: string
  trend?: { dir: 'up' | 'down'; text: string; className: string }
  note?: string
}

// TODO: ganti dengan data asli dari API setelah endpoint ringkasan energi tersedia
// (query ke mv_energy_daily / forecast_results -> poin 6a & 6c).
const STATS: Stat[] = [
  {
    icon: Zap,
    iconClass: 'bg-emerald-100 text-emerald-600',
    value: '1,234 kWh',
    label: 'Konsumsi Hari Ini',
    trend: { dir: 'down', text: '12%', className: 'text-emerald-600' },
  },
  {
    icon: TrendingUp,
    iconClass: 'bg-blue-100 text-blue-600',
    value: '1,456 kWh',
    label: 'Prediksi Besok',
    trend: { dir: 'up', text: '8%', className: 'text-blue-600' },
  },
  {
    icon: Battery,
    iconClass: 'bg-purple-100 text-purple-600',
    value: '85%',
    label: 'Efisiensi Sistem',
    trend: { dir: 'down', text: '15%', className: 'text-emerald-600' },
  },
  {
    icon: CircleAlert,
    iconClass: 'bg-orange-100 text-orange-600',
    value: '3 Alert',
    label: 'Notifikasi Aktif',
    note: 'Status',
  },
]

const COLUMNS = { 1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3' } as const

export default function DashboardPage() {
  const user = useUser()
  const health = useHealth()

  const allowed = FEATURES.filter((f) => canAccess(user.role, f))
  const large = allowed.filter((f) => f.size === 'large')
  const small = allowed.filter((f) => f.size === 'small')

  return (
    <div className="min-h-screen">
      <MainHeader alertCount={3} />

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Selamat Datang di Dashboard</h1>
          <p className="mt-1 text-gray-500">Overview sistem monitoring dan forecasting energi Anda</p>
        </div>

        <section aria-label="Ringkasan" className="space-y-2">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STATS.map((s) => (
              <StatCard key={s.label} stat={s} />
            ))}
          </div>
          <p className="text-xs text-gray-400">Data contoh, belum terhubung ke API.</p>
        </section>

        <section aria-labelledby="menu-utama" className="space-y-4">
          <h2 id="menu-utama" className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <BarChart3 className="size-5 text-gray-500" aria-hidden />
            Menu Utama
          </h2>

          {large.length > 0 && (
            <div className={cn('grid gap-4', COLUMNS[large.length as 1 | 2])}>
              {large.map((f) => (
                <FeatureCard key={f.key} feature={f} />
              ))}
            </div>
          )}
          {small.length > 0 && (
            <div className={cn('grid gap-4 sm:grid-cols-2', COLUMNS[small.length as 1 | 2 | 3])}>
              {small.map((f) => (
                <FeatureCard key={f.key} feature={f} />
              ))}
            </div>
          )}
        </section>

        <Card className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm text-gray-600">
          <span className="flex items-center gap-2.5" role="status">
            <span
              className={cn(
                'size-2.5 rounded-full',
                health.ok === null ? 'bg-gray-300' : health.ok ? 'bg-emerald-500' : 'bg-rose-500',
              )}
            />
            {health.ok === null
              ? 'Memeriksa status sistem...'
              : health.ok
                ? 'Sistem Operasional'
                : 'Server tidak terhubung'}
          </span>
          {health.checkedAt && <span>Pemeriksaan terakhir: {formatTime(health.checkedAt)} WIB</span>}
          <span>Database: {health.ok ? 'Terhubung' : health.ok === null ? '-' : 'Tidak terhubung'}</span>
        </Card>
      </main>
    </div>
  )
}

function StatCard({ stat }: { stat: Stat }) {
  const { icon: Icon, iconClass, value, label, trend, note } = stat
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <span className={cn('flex size-11 items-center justify-center rounded-xl', iconClass)}>
          <Icon className="size-5" aria-hidden />
        </span>
        {trend && (
          <span className={cn('flex items-center gap-1 text-sm font-medium', trend.className)}>
            {trend.dir === 'up' ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
            {trend.text}
          </span>
        )}
        {note && <span className="text-sm text-gray-500">{note}</span>}
      </div>
      <p className="mt-4 text-sm font-medium text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </Card>
  )
}

function FeatureCard({ feature }: { feature: Feature }) {
  const { icon: Icon, title, description, gradient, size, key } = feature
  const large = size === 'large'

  return (
    <Link
      to={feature.path}
      className={cn(
        'group relative flex flex-col justify-between overflow-hidden rounded-2xl bg-linear-to-br p-6 text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900',
        gradient,
        large ? 'min-h-52' : 'min-h-44',
      )}
    >
      <span className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full bg-white/10" />
      <span className="pointer-events-none absolute -bottom-10 -left-10 size-24 rounded-full bg-white/10" />

      <div className="relative">
        <Icon className={cn('mb-6', large ? 'size-12' : 'size-9')} strokeWidth={1.75} aria-hidden />
        <h3 className="font-medium">{title}</h3>
        <p className="mt-1 text-sm text-white/90">{description}</p>
      </div>

      <div className="relative mt-5 flex flex-wrap gap-2">
        {key === 'monitoring' && (
          <>
            <Badge tone="glass">Online</Badge>
            <Badge tone="glass">24 Device</Badge>
          </>
        )}
        {key === 'forecasting' && (
          <>
            <Badge tone="glass">95% Akurasi</Badge>
            <Badge tone="glass">7 Hari</Badge>
          </>
        )}
        {key === 'maintenance' && (
          <Badge tone="glass" className="bg-white/25">
            <span className="size-2 rounded-full bg-emerald-400" />
            Sistem Normal
          </Badge>
        )}
      </div>
    </Link>
  )
}
