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

export default function DashboardPage() {
  const user = useUser()
  const health = useHealth()
  const { devices } = useDevices()
  const { enabled: notificationsEnabled, unreadCount } = useNotifications()
  const enabledDevices = (devices ?? []).filter((device) => device.enabled)
  const onlineDevices = enabledDevices.filter((device) => device.status === 'online').length
  const problemDevices = enabledDevices.length - onlineDevices
  const features = FEATURES.filter((feature) => canAccess(user.role, feature))
  const stats: Stat[] = [
    { icon: Zap, iconClass: 'bg-emerald-100 text-emerald-600', value: devices ? `${onlineDevices}/${enabledDevices.length}` : '—', label: 'Perangkat Online', note: 'Status power meter' },
    { icon: TrendingUp, iconClass: 'bg-blue-100 text-blue-600', value: devices ? `${devices.length}` : '—', label: 'Total Perangkat', note: 'Terdaftar di sistem' },
    { icon: Battery, iconClass: 'bg-purple-100 text-purple-600', value: health.ok === null ? '...' : health.ok ? 'Normal' : 'Periksa', label: 'Kesehatan Sistem', note: 'API & database' },
    ...(user.role === 'admin' || user.role === 'operator'
      ? [
          {
            icon: CircleAlert,
            iconClass: 'bg-orange-100 text-orange-600',
            value: notificationsEnabled ? `${unreadCount} Alert` : '—',
            label: 'Notifikasi Aktif',
            note: notificationsEnabled ? 'Belum dibaca' : '-',
          },
        ]
      : []),
  ]

  return (
    <div className="flex min-h-screen flex-col">
      <MainHeader />
      <main className="flex w-full flex-1 flex-col gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-6 lg:px-8">
        <section>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Selamat Datang di Dashboard</h1>
          <p className="mt-1 text-gray-500">Overview sistem monitoring dan forecasting energi Anda</p>
        </section>

        <section aria-label="Ringkasan" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => <StatCard key={stat.label} stat={stat} />)}
        </section>

        <section aria-labelledby="modules-heading" className="flex flex-1 flex-col">
          <h2 id="modules-heading" className="flex shrink-0 items-center gap-2 text-base font-semibold text-gray-800">
            <BarChart3 className="size-5 text-gray-500" aria-hidden /> Menu Utama
          </h2>
          <div className="mt-3 grid flex-1 auto-rows-fr grid-cols-1 gap-4 lg:grid-cols-2">
            {features.map((feature) => <FeatureCard key={feature.key} feature={feature} problems={devices ? problemDevices : null} />)}
          </div>
        </section>

        <Card className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm text-gray-600">
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
  return <Card className="p-5 transition-shadow hover:shadow-md"><div className="flex items-start justify-between"><span className={cn('flex size-11 items-center justify-center rounded-xl', stat.iconClass)}><Icon className="size-5" aria-hidden /></span><span className="text-xs text-gray-500">{stat.note}</span></div><p className="mt-4 text-2xl font-semibold tracking-tight text-gray-900">{stat.value}</p><p className="text-sm text-gray-500">{stat.label}</p></Card>
}

function FeatureCard({ feature, problems }: { feature: Feature; problems: number | null }) {
  const Icon = feature.icon
  return <Link to={feature.path} className={cn('group relative flex h-full min-h-48 flex-col justify-between overflow-hidden rounded-2xl bg-linear-to-br p-5 text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 sm:min-h-52 sm:p-6 lg:min-h-[clamp(12rem,24vh,17rem)]', feature.gradient)}>
    <CardArtwork feature={feature} />
    <span className="pointer-events-none absolute inset-0 bg-linear-to-r from-black/10 via-transparent to-transparent" />
    <div className="relative z-10 max-w-[62%]">
      <span className="mb-4 flex size-11 items-center justify-center rounded-xl border border-white/25 bg-white/20 shadow-sm backdrop-blur-sm"><Icon className="size-6" strokeWidth={1.8} aria-hidden /></span>
      <h3 className="text-lg font-semibold tracking-tight sm:text-xl">{feature.title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-white/90">{feature.description}</p>
    </div>
    <div className="relative z-10 mt-4 flex flex-wrap gap-2">
      {feature.key === 'maintenance' && <Badge tone="glass" className="bg-white/25"><span className={cn('size-2 rounded-full', problems && problems > 0 ? 'bg-amber-300' : 'bg-emerald-400')} />{problems === null ? '...' : problems === 0 ? 'Sistem Normal' : `${problems} device bermasalah`}</Badge>}
    </div>
  </Link>
}

function CardArtwork({ feature }: { feature: Feature }) {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 w-[60%] overflow-hidden opacity-90 transition duration-300 group-hover:scale-[1.03] group-hover:opacity-100 sm:w-[58%]">
      <svg viewBox="0 0 460 240" preserveAspectRatio="xMidYMid slice" className="size-full" aria-hidden="true">
        <defs>
          <linearGradient id={`art-scene-${feature.key}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="white" stopOpacity=".02" />
            <stop offset="1" stopColor="white" stopOpacity=".18" />
          </linearGradient>
          <pattern id={`art-grid-${feature.key}`} width="22" height="22" patternUnits="userSpaceOnUse">
            <path d="M22 0H0v22" fill="none" stroke="white" strokeOpacity=".12" strokeWidth="1" />
          </pattern>
        </defs>
        <rect x="0" y="0" width="460" height="240" fill={`url(#art-scene-${feature.key})`} />
        <rect x="0" y="0" width="460" height="240" fill={`url(#art-grid-${feature.key})`} opacity=".45" />
        <circle cx="363" cy="48" r="31" fill="white" opacity=".12" />
        <path d="M0 164 93 111l61 41 98-78 102 73 66-39 40 27v105H0Z" fill="white" opacity=".1" />
        <path d="m0 188 87-51 64 41 94-56 99 53 73-36 43 23v78H0Z" fill="white" opacity=".12" />
        {feature.key === 'monitoring' && <g stroke="white" strokeWidth="2" strokeLinejoin="round">
          <path d="M70 203v-71l38-24v95m10 0V86l49-27v144m10 0v-67l35-22v89m10 0V97l50-30v106m10 0v-70l42-24v94m10 0v-50l42-24v74m10 0v-37l35-20v57" fill="white" fillOpacity=".19" />
          <path d="M80 149h13m-13 16h13m-13 16h13m29-94h17m-17 17h17m-17 17h17m-17 17h17m31-71h18m-18 17h18m-18 17h18m-18 17h18m31-11h14m-14 17h14m-14 16h14m32-67h19m-19 17h19m-19 17h19m-19 17h19m27-27h14m-14 17h14m-14 17h14m27-36h17m-17 17h17" opacity=".75" />
          <path d="M143 94V42h13v44m76 49h10v29m41-55h11v55m53-80h11v80m42-50h11v50" fill="white" fillOpacity=".72" />
          <path d="M58 203h396" />
          <path d="M245 51V24h8v27m-12 0h16m-16-9h16" strokeWidth="3" />
          <path d="M256 24h18v13h-18" fill="#f97316" stroke="none" />
          <path d="M270 89h24m-12-12v24m59 15 15-10m-13 20 18-3" strokeWidth="3" opacity=".6" />
        </g>}
        {feature.key === 'forecasting' && <g>
          <rect x="94" y="29" width="320" height="164" rx="15" fill="#075985" fillOpacity=".2" stroke="white" strokeOpacity=".62" strokeWidth="2" />
          <path d="M110 61h286M110 91h286M110 121h286M110 151h286M153 43v132m53-132v132m53-132v132m53-132v132m53-132v132" stroke="white" strokeOpacity=".18" />
          {[0, 1, 2, 3, 4, 5].map((bar) => <rect key={bar} x={128 + bar * 42} y={148 - [23, 42, 57, 78, 95, 71][bar]} width="23" height={[23, 42, 57, 78, 95, 71][bar]} rx="4" fill="white" fillOpacity=".36" />)}
          <path d="m116 127 40-30 37 10 39-39 34 21 38-41 37 15 38-19" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {[116, 156, 193, 232, 266, 304, 341, 379].map((x, i) => <circle key={x} cx={x} cy={[127, 97, 107, 68, 89, 48, 63, 44][i]} r="4" fill="white" />)}
          <path d="M80 207h354" stroke="white" strokeOpacity=".48" strokeWidth="3" />
          <path d="M34 157v-43h8v43m-20 0h32m10 0V91h8v66m-20 0h32" fill="white" fillOpacity=".22" stroke="white" strokeWidth="2" />
        </g>}
        {feature.key === 'pengaturan' && <g stroke="white" strokeLinejoin="round">
          <rect x="130" y="28" width="278" height="169" rx="16" fill="white" fillOpacity=".16" strokeWidth="3" />
          <rect x="147" y="44" width="244" height="137" rx="9" fill="#312e81" fillOpacity=".24" strokeOpacity=".5" />
          <circle cx="164" cy="60" r="4" fill="white" stroke="none" /><circle cx="178" cy="60" r="4" fill="white" stroke="none" />
          <rect x="160" y="77" width="72" height="86" rx="8" fill="white" fillOpacity=".14" strokeOpacity=".45" />
          <circle cx="196" cy="101" r="15" fill="white" fillOpacity=".65" stroke="none" />
          <path d="m196 91 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" fill="#6366f1" stroke="none" />
          <rect x="247" y="78" width="126" height="12" rx="6" fill="white" fillOpacity=".6" stroke="none" />
          <rect x="247" y="101" width="92" height="8" rx="4" fill="white" fillOpacity=".36" stroke="none" />
          <rect x="247" y="117" width="110" height="8" rx="4" fill="white" fillOpacity=".36" stroke="none" />
          <rect x="247" y="139" width="80" height="19" rx="9" fill="#38bdf8" fillOpacity=".7" stroke="none" />
          <path d="M116 199h302l-19 14H135Z" fill="white" fillOpacity=".48" strokeWidth="3" />
          <circle cx="361" cy="164" r="31" fill="#c7d2fe" fillOpacity=".7" strokeWidth="3" />
          <circle cx="361" cy="164" r="25" fill="#4338ca" fillOpacity=".58" strokeOpacity=".5" />
          <path d="M361 147v17l12 7" fill="none" strokeWidth="4" strokeLinecap="round" />
          <circle cx="361" cy="164" r="3" fill="white" stroke="none" />
        </g>}
        {feature.key === 'ekspor' && <g stroke="white" strokeLinejoin="round">
          <rect x="94" y="29" width="267" height="162" rx="15" fill="white" fillOpacity=".18" strokeWidth="3" />
          <path d="M110 56h235" strokeOpacity=".55" strokeWidth="2" />
          <circle cx="123" cy="43" r="3" fill="white" stroke="none" /><circle cx="135" cy="43" r="3" fill="white" stroke="none" /><circle cx="147" cy="43" r="3" fill="white" stroke="none" />
          <path d="M121 167v-33h18v33m15 0V99h18v68m15 0v-48h18v48m15 0V81h18v86m15 0v-60h18v60" fill="white" fillOpacity=".46" strokeWidth="2" />
          <path d="m119 122 39-21 26 12 38-39 31 16 34-32" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="222" cy="74" r="4" fill="white" stroke="none" />
          <rect x="310" y="91" width="105" height="122" rx="10" fill="#fff7ed" fillOpacity=".92" strokeWidth="3" />
          <path d="M327 113h69m-69 15h69m-69 15h49m-49 14h61" stroke="#f97316" strokeOpacity=".65" strokeWidth="3" strokeLinecap="round" />
          <path d="M327 181h26" stroke="#f97316" strokeWidth="9" strokeLinecap="round" />
          <rect x="367" y="174" width="34" height="25" rx="4" fill="#f97316" stroke="none" />
          <path d="M374 181v10m7-10v10m7-10v10" stroke="white" strokeWidth="2" />
        </g>}
        {feature.key === 'maintenance' && <g stroke="white" strokeLinejoin="round">
          <path d="M137 44h203a13 13 0 0 1 13 13v131H124V57a13 13 0 0 1 13-13Z" fill="white" fillOpacity=".18" strokeWidth="4" />
          <rect x="144" y="61" width="202" height="91" rx="9" fill="#082f49" fillOpacity=".53" strokeWidth="3" />
          <rect x="160" y="76" width="169" height="60" rx="5" fill="#cffafe" fillOpacity=".8" stroke="none" />
          <path d="M174 91h56m-56 14h83m-83 14h42" stroke="#0f172a" strokeOpacity=".7" strokeWidth="4" strokeLinecap="round" />
          <text x="278" y="98" fill="#0f172a" stroke="none" fontSize="13" fontWeight="700">V 231.5</text>
          <text x="278" y="119" fill="#0f172a" stroke="none" fontSize="13" fontWeight="700">A 48.7</text>
          <circle cx="153" cy="168" r="5" fill="#fde68a" stroke="none" /><circle cx="173" cy="168" r="5" fill="#86efac" stroke="none" /><circle cx="193" cy="168" r="5" fill="white" stroke="none" />
          <path d="M150 188v20m38-20v20m38-20v20m38-20v20m38-20v20" strokeWidth="4" strokeLinecap="round" />
          <path d="M359 87c22 8 29 24 29 42v38" fill="none" strokeWidth="6" strokeLinecap="round" />
          <path d="m375 87 12 12 12-12m-35 77h30" fill="none" strokeWidth="4" strokeLinecap="round" />
        </g>}
        {feature.key === 'pengguna' && <g stroke="white" strokeLinejoin="round">
          <rect x="85" y="45" width="272" height="149" rx="16" fill="white" fillOpacity=".12" strokeOpacity=".42" strokeWidth="2" />
          <path d="M106 68h72m-72 11h49m89-11h70m-70 11h49" strokeOpacity=".4" strokeWidth="3" strokeLinecap="round" />
          <circle cx="219" cy="96" r="27" fill="white" fillOpacity=".55" strokeWidth="3" />
          <circle cx="164" cy="118" r="19" fill="white" fillOpacity=".4" strokeWidth="3" />
          <circle cx="274" cy="118" r="19" fill="white" fillOpacity=".4" strokeWidth="3" />
          <path d="M170 171c0-29 20-49 49-49s49 20 49 49v9h-98Zm-48 9v-9c0-22 16-39 39-41m116 50v-9c0-22-16-39-39-41" fill="white" fillOpacity=".48" strokeWidth="3" />
          <path d="m341 98 35 13v30c0 26-15 44-35 55-20-11-35-29-35-55v-30Z" fill="#0ea5e9" fillOpacity=".8" strokeWidth="3" />
          <rect x="329" y="137" width="24" height="20" rx="4" fill="white" fillOpacity=".92" stroke="none" />
          <path d="M334 137v-7a7 7 0 0 1 14 0v7" fill="none" strokeWidth="4" />
        </g>}
      </svg>
    </div>
  )
}
/**.. */