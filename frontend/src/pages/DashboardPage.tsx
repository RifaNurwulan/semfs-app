import { BarChart3, Battery, CircleAlert, TrendingUp, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useUser } from '../auth/auth-context'
import { MainHeader } from '../components/layout/MainHeader'
import { Badge } from '../components/ui/badge'
import { Card } from '../components/ui/card'
import { canAccess, FEATURES, ROLE_LABEL, type Feature } from '../lib/features'
import { useDevices } from '../lib/useDevices'
import { useHealth } from '../lib/useHealth'
import { useNotifications } from '../notifications/notification-context'
import { cn, formatTime } from '../lib/utils'

interface Stat {
  icon: LucideIcon
  iconClass: string
  value: string
  label: string
  note?: string
}

const GRID_COLUMNS = { 1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4' } as const

export default function DashboardPage() {
  const user = useUser()
  const health = useHealth()
  const { devices } = useDevices()
  const { enabled: notificationsEnabled, unreadCount } = useNotifications()
  const enabledDevices = (devices ?? []).filter((device) => device.enabled)
  const onlineDevices = enabledDevices.filter((device) => device.status === 'online').length
  const problemDevices = enabledDevices.length - onlineDevices
  const features = FEATURES.filter((feature) => canAccess(user.role, feature))
  const largeFeatures = features.filter((feature) => feature.size === 'large')
  const smallFeatures = features.filter((feature) => feature.size === 'small')
  const stats: Stat[] = [
    { icon: Zap, iconClass: 'bg-emerald-100 text-emerald-600', value: devices ? `${onlineDevices}/${enabledDevices.length}` : '—', label: 'Perangkat Online', note: 'Status power meter' },
    { icon: TrendingUp, iconClass: 'bg-blue-100 text-blue-600', value: devices ? `${devices.length}` : '—', label: 'Total Perangkat', note: 'Terdaftar di sistem' },
    { icon: Battery, iconClass: 'bg-purple-100 text-purple-600', value: health.ok === null ? '...' : health.ok ? 'Normal' : 'Periksa', label: 'Kesehatan Sistem', note: 'API & database' },
    { icon: CircleAlert, iconClass: 'bg-orange-100 text-orange-600', value: notificationsEnabled ? `${unreadCount} Alert` : '—', label: 'Notifikasi Aktif', note: notificationsEnabled ? 'Belum dibaca' : 'Khusus admin/operator' },
  ]

  return (
    <div className="min-h-screen">
      <MainHeader />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
        <section>
          <h1 className="text-xl font-semibold text-gray-900">Selamat Datang di Dashboard</h1>
          <p className="mt-1 text-gray-500">Overview sistem monitoring dan forecasting energi Anda</p>
        </section>

        <section aria-label="Ringkasan" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => <StatCard key={stat.label} stat={stat} />)}
        </section>

        <section aria-labelledby="modules-heading">
          <h2 id="modules-heading" className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <BarChart3 className="size-5 text-gray-500" aria-hidden /> Menu Utama
          </h2>
          {largeFeatures.length > 0 && <div className={cn('mt-4 grid gap-4', GRID_COLUMNS[largeFeatures.length as 1 | 2 | 3 | 4])}>{largeFeatures.map((feature) => <FeatureCard key={feature.key} feature={feature} online={onlineDevices} total={devices?.length ?? null} problems={devices ? problemDevices : null} />)}</div>}
          {smallFeatures.length > 0 && <div className={cn('mt-4 grid gap-4 sm:grid-cols-2', GRID_COLUMNS[smallFeatures.length as 1 | 2 | 3 | 4])}>{smallFeatures.map((feature) => <FeatureCard key={feature.key} feature={feature} online={onlineDevices} total={devices?.length ?? null} problems={devices ? problemDevices : null} />)}</div>}
        </section>

        <Card className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm text-gray-600">
          <span className="flex items-center gap-2.5" role="status"><span className={cn('size-2.5 rounded-full', health.ok === null ? 'bg-gray-300' : health.ok ? 'bg-emerald-500' : 'bg-rose-500')} />{health.ok === null ? 'Memeriksa status sistem...' : health.ok ? 'Sistem Operasional' : 'Server tidak terhubung'}</span>
          {health.checkedAt && <span>Pemeriksaan terakhir: {formatTime(health.checkedAt)} WIB</span>}
          <span>Database: {health.ok ? 'Terhubung' : health.ok === null ? '-' : 'Tidak terhubung'}</span>
          <span>Akun: {ROLE_LABEL[user.role]}</span>
        </Card>
      </main>
    </div>
  )
}

function StatCard({ stat }: { stat: Stat }) {
  const Icon = stat.icon
  return <Card className="p-5"><div className="flex items-start justify-between"><span className={cn('flex size-11 items-center justify-center rounded-xl', stat.iconClass)}><Icon className="size-5" aria-hidden /></span><span className="text-sm text-gray-500">{stat.note}</span></div><p className="mt-4 text-sm font-medium text-gray-900">{stat.value}</p><p className="text-sm text-gray-500">{stat.label}</p></Card>
}

function FeatureCard({ feature, online, total, problems }: { feature: Feature; online: number; total: number | null; problems: number | null }) {
  const Icon = feature.icon
  const large = feature.size === 'large'
  return <Link to={feature.path} className={cn('group relative flex flex-col justify-between overflow-hidden rounded-2xl bg-linear-to-br p-6 text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900', feature.gradient, large ? 'min-h-52' : 'min-h-44')}>
    <span className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full bg-white/10" />
    <span className="pointer-events-none absolute -bottom-10 -left-10 size-24 rounded-full bg-white/10" />
    <div className="relative"><Icon className={cn('mb-6', large ? 'size-12' : 'size-9')} strokeWidth={1.75} aria-hidden /><h3 className="font-medium">{feature.title}</h3><p className="mt-1 text-sm text-white/90">{feature.description}</p></div>
    <div className="relative mt-5 flex flex-wrap gap-2">
      {feature.key === 'monitoring' && <><Badge tone="glass">{total === null ? '...' : `${online} Online`}</Badge><Badge tone="glass">{total === null ? '...' : `${total} Device`}</Badge></>}
      {feature.key === 'forecasting' && <><Badge tone="glass">Prediksi energi</Badge><Badge tone="glass">7 Hari</Badge></>}
      {feature.key === 'maintenance' && <Badge tone="glass" className="bg-white/25"><span className={cn('size-2 rounded-full', problems && problems > 0 ? 'bg-amber-300' : 'bg-emerald-400')} />{problems === null ? '...' : problems === 0 ? 'Sistem Normal' : `${problems} device bermasalah`}</Badge>}
    </div>
  </Link>
}
/**.. */