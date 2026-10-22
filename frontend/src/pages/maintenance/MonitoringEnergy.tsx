import {
	Activity,
	ArrowDownRight,
	ArrowUpRight,
	Bell,
	CalendarDays,
	ChevronRight,
	Download,
	Gauge,
	RefreshCw,
	Zap,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { Alert } from '../../components/ui/alert'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { getToken } from '../../auth/tokenStorage'
import { api, type MonitoringPeriod, type MonitoringSummary } from '../../lib/api'
import { getFeature } from '../../lib/features'
import { useDevices } from '../../lib/useDevices'
import { downloadBlob, formatRelative } from '../../lib/utils'
import { useNotifications } from '../../notifications/notification-context'

const PERIODS: { value: MonitoringPeriod; label: string }[] = [
	{ value: '1h', label: '1 jam' },
	{ value: '24h', label: '24 jam' },
	{ value: '7d', label: '7 hari' },
]

const number = (value: number, digits = 1) =>
	new Intl.NumberFormat('id-ID', { maximumFractionDigits: digits }).format(value)

function timeLabel(value: string, period: MonitoringPeriod) {
	const date = new Date(value)
	return new Intl.DateTimeFormat('id-ID', period === '7d'
		? { day: 'numeric', month: 'short' }
		: { hour: '2-digit', minute: '2-digit' },
	).format(date)
}

function exportCsv(summary: MonitoringSummary) {
	const rows = [
		['Waktu', 'Daya rata-rata (W)', 'Daya puncak (W)', 'Arus rata-rata (A)', 'Tegangan rata-rata (V)', 'Jumlah sampel'],
		...summary.points.map((point) => [
			point.time,
			point.avg_power_w ?? '',
			point.peak_power_w ?? '',
			point.avg_current_a ?? '',
			point.avg_voltage_v ?? '',
			point.sample_count,
		]),
	]
	const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n')
	downloadBlob(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }), `monitoring-energi-${summary.period}.csv`)
}

function EnergyChart({ summary }: { summary: MonitoringSummary }) {
	const values = summary.points.map((point) => point.avg_power_w ?? 0)
	const maxValue = Math.max(...values, 1)
	const chartPoints = values.map((value, index) => ({
		x: values.length <= 1 ? 400 : 42 + (index / (values.length - 1)) * 716,
		y: 218 - (value / maxValue) * 188,
	}))
	const line = chartPoints.map((point) => `${point.x},${point.y}`).join(' ')
	const area = chartPoints.length ? `42,218 ${line} 758,218` : ''
	const labelIndices = [...new Set([0, Math.floor((summary.points.length - 1) / 2), summary.points.length - 1])]

	return (
		<div className="mt-5">
			{summary.points.length === 0 ? (
				<div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-center">
					<Activity className="size-8 text-gray-300" aria-hidden />
					<p className="mt-3 text-sm font-medium text-gray-700">Belum ada data energi pada periode ini</p>
					<p className="mt-1 text-xs text-gray-500">Pastikan power meter aktif dan pengumpul data berjalan.</p>
				</div>
			) : (
				<div className="overflow-hidden rounded-xl bg-slate-50 px-2 pt-2">
					<svg viewBox="0 0 800 260" className="h-64 w-full" role="img" aria-label="Grafik daya rata-rata berdasarkan waktu">
						<defs>
							<linearGradient id="energy-area" x1="0" x2="0" y1="0" y2="1">
								<stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
								<stop offset="100%" stopColor="#10b981" stopOpacity="0" />
							</linearGradient>
						</defs>
						{[30, 92, 154, 218].map((y) => <line key={y} x1="42" x2="758" y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 5" />)}
						<polygon points={area} fill="url(#energy-area)" />
						<polyline points={line} fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
						{chartPoints.length === 1 && <circle cx={chartPoints[0].x} cy={chartPoints[0].y} r="5" fill="#059669" />}
						{labelIndices.map((index) => {
							const point = summary.points[index]
							if (!point) return null
							const x = chartPoints[index]?.x ?? 42
							return <text key={`${point.time}-${index}`} x={x} y="248" textAnchor={index === 0 ? 'start' : index === summary.points.length - 1 ? 'end' : 'middle'} fill="#64748b" fontSize="11">{timeLabel(point.time, summary.period)}</text>
						})}
					</svg>
					<div className="flex items-center justify-between px-3 pb-3 text-xs text-gray-500">
						<span>0 W</span>
						<span>Puncak {number(summary.peak_power_w)} W</span>
						<span>{number(maxValue)} W</span>
					</div>
				</div>
			)}
		</div>
	)
}

function metricCards(summary: MonitoringSummary, online: number, total: number) {
	return [
		{ label: 'Energi terpakai', value: `${number(summary.total_energy_kwh, 3)} kWh`, hint: 'Akumulasi pada periode', icon: Zap, iconClass: 'bg-emerald-100 text-emerald-700', trend: 'neutral' },
		{ label: 'Daya rata-rata', value: `${number(summary.avg_power_w)} W`, hint: 'Rata-rata seluruh sampel', icon: Gauge, iconClass: 'bg-blue-100 text-blue-700', trend: 'neutral' },
		{ label: 'Daya puncak', value: `${number(summary.peak_power_w)} W`, hint: 'Nilai tertinggi tercatat', icon: ArrowUpRight, iconClass: 'bg-amber-100 text-amber-700', trend: 'neutral' },
		{ label: 'Perangkat online', value: `${online}/${total}`, hint: total ? `${total - online} perlu diperiksa` : 'Belum ada perangkat', icon: Activity, iconClass: 'bg-violet-100 text-violet-700', trend: total > online ? 'warning' : 'neutral' },
	]
}

/** Monitoring energi live dengan status perangkat dan notifikasi dari modul terkait. */
export default function MonitoringEnergy() {
	const feature = getFeature('monitoring')
	const { devices: managedDevices } = useDevices()
	const { items: notifications, enabled: notificationsEnabled, unreadCount } = useNotifications()
	const [period, setPeriod] = useState<MonitoringPeriod>('24h')
	const [deviceId, setDeviceId] = useState('')
	const [summary, setSummary] = useState<MonitoringSummary | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [loading, setLoading] = useState(true)
	const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

	const reload = useCallback(async () => {
		const token = getToken()
		if (!token) return
		setLoading(true)
		try {
			const result = await api.monitoringSummary(token, period, deviceId || undefined)
			setSummary(result)
			setError(null)
			setUpdatedAt(new Date())
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Gagal memuat data monitoring')
		} finally {
			setLoading(false)
		}
	}, [deviceId, period])

	useEffect(() => {
		void reload()
		const interval = window.setInterval(() => void reload(), 30_000)
		return () => window.clearInterval(interval)
	}, [reload])

	const devices = useMemo(() => summary?.devices ?? [], [summary])
	const onlineCount = devices.filter((device) => device.enabled && device.status === 'online').length
	const metrics = summary ? metricCards(summary, onlineCount, devices.filter((device) => device.enabled).length) : []
	const recentNotifications = notifications.slice(0, 4)

	return (
		<div className="min-h-screen">
			<PageHeader icon={feature.icon} iconClassName={feature.headerIconBg} title={feature.title} subtitle={feature.subtitle} />
			<main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
				<section className="overflow-hidden rounded-2xl bg-linear-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-lg sm:p-8">
					<div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
						<div>
							<div className="flex items-center gap-2 text-sm font-medium text-emerald-300">
								<span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-emerald-400" /></span>
								SISTEM MONITORING
							</div>
							<h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Konsumsi energi, dalam kendali.</h2>
							<p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Pantau performa power meter, tren daya, dan peringatan operasional dalam satu tampilan.</p>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<label className="sr-only" htmlFor="monitor-device">Pilih perangkat</label>
							<select id="monitor-device" value={deviceId} onChange={(event) => setDeviceId(event.target.value)} className="h-10 min-w-44 rounded-xl border border-white/15 bg-white/10 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400 [&>option]:text-gray-900">
								<option value="">Semua perangkat</option>
								{(managedDevices ?? []).map((device) => <option key={device.device_id} value={device.device_id}>{device.device_name || device.device_id}</option>)}
							</select>
							<Button variant="outline" size="sm" onClick={() => void reload()} loading={loading} className="border-white/15 bg-white/10 text-white hover:bg-white/15">
								<RefreshCw className="size-4" aria-hidden /> Perbarui
							</Button>
						</div>
					</div>
					<div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5">
						<div className="flex items-center gap-2 text-xs text-slate-300"><CalendarDays className="size-4" aria-hidden />Periode data</div>
						<div className="flex rounded-xl border border-white/10 bg-white/5 p-1" role="group" aria-label="Pilih periode monitoring">
							{PERIODS.map((option) => <button key={option.value} type="button" onClick={() => setPeriod(option.value)} aria-pressed={period === option.value} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${period === option.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:text-white'}`}>{option.label}</button>)}
						</div>
						<span className="text-xs text-slate-400">{updatedAt ? `Diperbarui ${formatRelative(updatedAt.toISOString())}` : 'Menunggu data...'}</span>
					</div>
				</section>

				{error && <Alert variant="error">{error}</Alert>}

				{summary ? (
					<>
						<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
							{metrics.map(({ label, value, hint, icon: Icon, iconClass, trend }) => (
								<Card key={label} className="p-5">
									<div className="flex items-start justify-between gap-3">
										<span className={`flex size-11 items-center justify-center rounded-xl ${iconClass}`}><Icon className="size-5" aria-hidden /></span>
										{trend === 'warning' && <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"><ArrowDownRight className="size-3.5" aria-hidden />Perhatian</span>}
									</div>
									<p className="mt-4 text-sm text-gray-500">{label}</p>
									<p className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">{value}</p>
									<p className="mt-1 text-xs text-gray-400">{hint}</p>
								</Card>
							))}
						</div>

						<div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(18rem,0.8fr)]">
							<Card className="p-5 sm:p-6">
								<div className="flex flex-wrap items-start justify-between gap-4">
									<div>
										<h2 className="font-semibold text-gray-900">Tren konsumsi daya</h2>
										<p className="mt-1 text-sm text-gray-500">Rata-rata daya per interval waktu · Watt</p>
									</div>
									<Button variant="outline" size="sm" onClick={() => exportCsv(summary)}><Download className="size-4" aria-hidden />Ekspor CSV</Button>
								</div>
								<EnergyChart summary={summary} />
							</Card>

							<Card className="p-5 sm:p-6">
								<div className="flex items-start justify-between gap-3">
									<div>
										<h2 className="font-semibold text-gray-900">Status perangkat</h2>
										<p className="mt-1 text-sm text-gray-500">Sinkron dengan modul Maintenance</p>
									</div>
									<Link to="/maintenance" aria-label="Kelola perangkat" className="flex size-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-emerald-700"><ChevronRight className="size-5" aria-hidden /></Link>
								</div>
								<div className="mt-5 space-y-3">
									{devices.length === 0 ? <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">Belum ada perangkat terdaftar.</p> : devices.slice(0, 5).map((device) => {
										const online = device.enabled && device.status === 'online'
										const statusClass = !device.enabled ? 'bg-gray-100 text-gray-500' : online ? 'bg-emerald-50 text-emerald-700' : device.status === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
										const statusLabel = !device.enabled ? 'Nonaktif' : device.status === 'online' ? 'Online' : device.status === 'error' ? 'Error' : 'Offline'
										return <div key={device.device_id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 p-3">
											<div className="flex min-w-0 items-center gap-3">
												<span className={`size-2.5 shrink-0 rounded-full ${online ? 'bg-emerald-500' : device.status === 'error' && device.enabled ? 'bg-rose-500' : 'bg-amber-400'}`} />
												<div className="min-w-0"><p className="truncate text-sm font-medium text-gray-900">{device.device_name || device.device_id}</p><p className="truncate text-xs text-gray-500">{device.location || device.device_id}</p></div>
											</div>
											<div className="shrink-0 text-right"><span className={`rounded-full px-2 py-1 text-[11px] font-medium ${statusClass}`}>{statusLabel}</span><p className="mt-1 text-xs text-gray-500">{device.daya == null ? '—' : `${number(device.daya)} W`}</p></div>
										</div>
									})}
								</div>
								<Link to="/maintenance" className="mt-4 flex items-center justify-center gap-1 rounded-xl bg-gray-50 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-emerald-50 hover:text-emerald-700">Buka Maintenance<ChevronRight className="size-4" aria-hidden /></Link>
							</Card>
						</div>

						<div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(18rem,0.8fr)]">
							<Card className="overflow-hidden">
								<div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 sm:px-6">
									<div><h2 className="font-semibold text-gray-900">Bacaan terakhir</h2><p className="mt-1 text-sm text-gray-500">Nilai terkini dari setiap power meter</p></div>
									<span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">{devices.length} perangkat</span>
								</div>
								<div className="overflow-x-auto">
									<table className="w-full min-w-[38rem] text-left text-sm">
										<thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr>{['Perangkat', 'Arus', 'Tegangan', 'Daya', 'Pembaruan'].map((heading) => <th key={heading} className="px-5 py-3 font-medium">{heading}</th>)}</tr></thead>
										<tbody className="divide-y divide-gray-100">{devices.map((device) => <tr key={device.device_id}>
											<td className="px-5 py-3.5"><span className="block font-medium text-gray-900">{device.device_name || device.device_id}</span><span className="text-xs text-gray-500">{device.device_id}</span></td>
											<td className="px-5 py-3.5 text-gray-700">{device.arus == null ? '—' : `${number(device.arus, 2)} A`}</td>
											<td className="px-5 py-3.5 text-gray-700">{device.tegangan == null ? '—' : `${number(device.tegangan, 1)} V`}</td>
											<td className="px-5 py-3.5 font-medium text-gray-900">{device.daya == null ? '—' : `${number(device.daya)} W`}</td>
											<td className="px-5 py-3.5 text-gray-500">{device.time ? formatRelative(device.time) : 'Belum ada data'}</td>
										</tr>)}
										{devices.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-500">Tidak ada perangkat untuk ditampilkan.</td></tr>}</tbody>
									</table>
								</div>
							</Card>

							<Card className="p-5 sm:p-6">
								<div className="flex items-start justify-between gap-3">
									<div><h2 className="font-semibold text-gray-900">Peringatan & notifikasi</h2><p className="mt-1 text-sm text-gray-500">Terhubung dengan modul Notifikasi</p></div>
									<span className="relative flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Bell className="size-5" aria-hidden />{unreadCount > 0 && <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}</span>
								</div>
								{notificationsEnabled ? recentNotifications.length ? <ul className="mt-4 divide-y divide-gray-100">{recentNotifications.map((item) => <li key={item.id} className="py-3 first:pt-0 last:pb-0"><div className="flex items-start justify-between gap-2"><p className={`text-sm ${item.read ? 'font-medium text-gray-700' : 'font-semibold text-gray-900'}`}>{item.title}</p><span className={`mt-1 size-2 shrink-0 rounded-full ${item.severity === 'critical' ? 'bg-rose-500' : item.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}`} /></div><p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">{item.message || item.device_id || 'Pemberitahuan sistem'}</p><p className="mt-1 text-[11px] text-gray-400">{formatRelative(item.created_at)}</p></li>)}</ul> : <div className="mt-4 rounded-xl bg-gray-50 px-4 py-8 text-center"><p className="text-sm font-medium text-gray-700">Tidak ada peringatan terbaru</p><p className="mt-1 text-xs text-gray-500">Notifikasi perangkat akan muncul di sini.</p></div> : <div className="mt-4 rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">Notifikasi tersedia untuk Admin dan Operator.</div>}
								<Link to="/" className="mt-4 flex items-center justify-center gap-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Lihat dashboard<ChevronRight className="size-4" aria-hidden /></Link>
							</Card>
						</div>

						<section aria-label="Tautan modul terkait" className="grid gap-3 sm:grid-cols-3">
							{[
								{ to: '/forecasting', title: 'Forecasting Energy', text: 'Lihat prediksi konsumsi', icon: ArrowUpRight, color: 'text-blue-600 bg-blue-50' },
								{ to: '/ekspor', title: 'Ekspor & Laporan', text: 'Siapkan laporan energi', icon: Download, color: 'text-orange-600 bg-orange-50' },
								{ to: '/maintenance', title: 'Maintenance', text: 'Kelola power meter', icon: Activity, color: 'text-rose-600 bg-rose-50' },
							].map(({ to, title, text, icon: Icon, color }) => <Link key={to} to={to} className="group flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"><span className={`flex size-10 items-center justify-center rounded-xl ${color}`}><Icon className="size-5" aria-hidden /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-gray-900">{title}</span><span className="mt-0.5 block text-xs text-gray-500">{text}</span></span><ChevronRight className="size-4 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-emerald-600" aria-hidden /></Link>)}
						</section>
					</>
				) : loading ? <Card className="p-12 text-center text-sm text-gray-500">Memuat data monitoring energi...</Card> : null}
			</main>
		</div>
	)
}
/**. */