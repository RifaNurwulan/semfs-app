import {
	Activity,
	ArrowDownRight,
	ArrowLeft,
	ArrowUpRight,
	BadgeDollarSign,
	Bell,
	CalendarDays,
	ChevronRight,
	CircleAlert,
	Download,
	Gauge,
	RefreshCw,
	TrendingUp,
	Zap,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '../../auth/auth-context'
import { getToken } from '../../auth/tokenStorage'
import { MainHeader } from '../../components/layout/MainHeader'
import { Alert } from '../../components/ui/alert'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { api, type MonitoringPeriod, type MonitoringSummary } from '../../lib/api'
import { useDevices } from '../../lib/useDevices'
import { downloadBlob, formatRelative } from '../../lib/utils'
import { useNotifications } from '../../notifications/notification-context'

function localDateTimeInputValue(date = new Date()) {
	const offset = date.getTimezoneOffset() * 60_000
	return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

const number = (value: number, digits = 1) =>
	new Intl.NumberFormat('id-ID', { maximumFractionDigits: digits }).format(value)

const rupiah = (value: number, digits = 0) =>
	new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: digits }).format(value)

const EMPTY_DEVICES: NonNullable<ReturnType<typeof useDevices>['devices']> = []
const METER_COLORS = ['#059669', '#2563eb', '#d97706', '#7c3aed', '#e11d48', '#0891b2', '#65a30d', '#db2777']
type ChartFilter = { deviceId: string; start: string; end: string }

function rangeEndingNow(hours: number): Pick<ChartFilter, 'start' | 'end'> {
	const end = new Date()
	return {
		start: localDateTimeInputValue(new Date(end.getTime() - hours * 60 * 60 * 1000)),
		end: localDateTimeInputValue(end),
	}
}

function FilteredChartCard({
	id,
	title,
	subtitle,
	devices,
	initialFilter,
	metricKey = 'daya',
	allowRealtime = false,
	className = '',
	children,
}: {
	id: string
	title: string
	subtitle: string
	devices: NonNullable<ReturnType<typeof useDevices>['devices']>
	initialFilter: ChartFilter
	metricKey?: string
	allowRealtime?: boolean
	className?: string
	children: (summary: MonitoringSummary, filter: ChartFilter, realtime: boolean) => ReactNode
}) {
	const [draft, setDraft] = useState(initialFilter)
	const [filter, setFilter] = useState(initialFilter)
	const [realtime, setRealtime] = useState(allowRealtime)
	const [summary, setSummary] = useState<MonitoringSummary | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [validationError, setValidationError] = useState<string | null>(null)

	useEffect(() => {
		let active = true
		let requestInFlight = false
		const load = async (initial: boolean) => {
			const token = getToken()
			if (!token) {
				setError('Sesi login tidak tersedia. Silakan login kembali.')
				setLoading(false)
				return
			}
			if (requestInFlight) return
			requestInFlight = true
			if (initial) setLoading(true)
			try {
				const result = await api.monitoringSummary(
					token,
					realtime ? 'live' : 'custom',
					filter.deviceId || undefined,
					realtime ? undefined : filter.start,
					realtime ? undefined : filter.end,
					metricKey,
				)
				if (!active) return
				setSummary(result)
				setError(null)
			} catch (err) {
				if (active) setError(err instanceof Error ? err.message : 'Gagal memuat data grafik.')
			} finally {
				requestInFlight = false
				if (active && initial) setLoading(false)
			}
		}
		const timer = window.setTimeout(() => void load(true), 0)
		const interval = realtime ? window.setInterval(() => void load(false), 5_000) : undefined
		return () => {
			active = false
			window.clearTimeout(timer)
			if (interval !== undefined) window.clearInterval(interval)
		}
	}, [filter, metricKey, realtime])

	function applyFilter(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		const now = localDateTimeInputValue()
		if (!draft.start || !draft.end || draft.start >= draft.end || draft.end > now) {
			setValidationError('Rentang tanggal/waktu tidak valid. Waktu awal harus sebelum waktu akhir dan waktu akhir tidak boleh di masa depan.')
			return
		}
		setValidationError(null)
		setFilter(draft)
	}

	return (
		<Card className={`min-w-0 p-4 shadow-sm sm:p-5 ${className}`}>
			<div>
				<h2 className="font-semibold text-slate-900">{title}</h2>
				<p className="mt-1 text-sm text-slate-500">{subtitle}</p>
			</div>
			{allowRealtime && (
				<div className="mt-3 flex w-fit rounded-lg border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Mode grafik tren">
					{[
						{ value: true, label: 'Realtime' },
						{ value: false, label: 'Riwayat tanggal' },
					].map((option) => (
						<button key={option.label} type="button" aria-pressed={realtime === option.value} onClick={() => setRealtime(option.value)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${realtime === option.value ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
							{option.label}
						</button>
					))}
				</div>
			)}
			<form onSubmit={applyFilter} className="mt-3 grid gap-2 sm:grid-cols-2 2xl:grid-cols-[minmax(10rem,1fr)_minmax(12rem,1fr)_minmax(12rem,1fr)_auto]">
				<div className="min-w-0">
					<label htmlFor={`${id}-device`} className="mb-1 block text-xs font-medium text-slate-600">Power meter</label>
					<select id={`${id}-device`} value={draft.deviceId} onChange={(event) => setDraft((current) => ({ ...current, deviceId: event.target.value }))} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500">
						<option value="">Semua power meter</option>
						{devices.map((device) => <option key={device.device_id} value={device.device_id}>{device.device_name || device.device_id}</option>)}
					</select>
				</div>
				{!realtime && <>
					<div className="min-w-0">
						<label htmlFor={`${id}-start`} className="mb-1 block text-xs font-medium text-slate-600">Dari tanggal/waktu</label>
						<input id={`${id}-start`} type="datetime-local" value={draft.start} max={draft.end || localDateTimeInputValue()} onChange={(event) => setDraft((current) => ({ ...current, start: event.target.value }))} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 [color-scheme:light]" />
					</div>
					<div className="min-w-0">
						<label htmlFor={`${id}-end`} className="mb-1 block text-xs font-medium text-slate-600">Sampai tanggal/waktu</label>
						<input id={`${id}-end`} type="datetime-local" value={draft.end} min={draft.start || undefined} max={localDateTimeInputValue()} onChange={(event) => setDraft((current) => ({ ...current, end: event.target.value }))} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 [color-scheme:light]" />
					</div>
				</>}
				<div className="flex items-end">
					{realtime
						? <span className="pb-2 text-xs text-slate-500">Update otomatis tiap 5 detik</span>
						: <Button type="submit" size="sm" className="w-full 2xl:w-auto">Terapkan</Button>}
				</div>
			</form>
			{validationError && <p role="alert" className="mt-2 text-xs text-rose-700">{validationError}</p>}
			{error ? <Alert variant="error" className="mt-3">{error}</Alert> : loading ? (
				<div className="flex h-48 items-center justify-center text-sm text-slate-500">Memuat data grafik...</div>
			) : summary ? children(summary, filter, realtime) : null}
		</Card>
	)
}

function timeLabel(value: string, period: MonitoringPeriod) {
	const date = new Date(value)
	const options: Intl.DateTimeFormatOptions = period === 'custom'
		? { year: 'numeric', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
		: period === '7d'
			? { day: 'numeric', month: 'short' }
			: { hour: '2-digit', minute: '2-digit' }
	return new Intl.DateTimeFormat('id-ID', options).format(date)
}

function detailedTimeLabel(value: string) {
	return new Intl.DateTimeFormat('id-ID', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	}).format(new Date(value))
}

function localDayKey(value: string) {
	return new Intl.DateTimeFormat('sv-SE', {
		timeZone: 'Asia/Jakarta',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(new Date(value))
}

function exportCsv(summary: MonitoringSummary, startTime: string, endTime: string, metricLabel: string, metricUnit: string) {
	const rows = [
		['Power meter', 'Waktu pembacaan', 'Daya (W)', 'Arus (A)', 'Tegangan (V)', 'Faktor daya', `${metricLabel}${metricUnit ? ` (${metricUnit})` : ''}`],
		...summary.device_points.map((point) => [
			point.device_name || point.device_id,
			point.time,
			point.daya ?? '',
			point.arus ?? '',
			point.tegangan ?? '',
			point.power_factor ?? '',
			point.metric_value ?? '',
		]),
	]
	const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n')
	const dateSuffix = summary.period === 'custom'
		? `-${startTime.replace('T', '_').replaceAll(':', '-')}-${endTime.replace('T', '_').replaceAll(':', '-')}`
		: `-${summary.period}`
	downloadBlob(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }), `monitoring-energi${dateSuffix}.csv`)
}

function EnergyChart({ summary, metricLabel, metricUnit }: { summary: MonitoringSummary; metricLabel: string; metricUnit: string }) {
	const svgRef = useRef<SVGSVGElement>(null)
	const [hovered, setHovered] = useState<{ seriesIndex: number; pointIndex: number } | null>(null)
	const plot = { left: 88, right: 1235, top: 28, bottom: 204 }
	const groupedPoints = new Map<string, typeof summary.device_points>()
	summary.device_points.forEach((point) => {
		const series = groupedPoints.get(point.device_id) ?? []
		series.push(point)
		groupedPoints.set(point.device_id, series)
	})
	const times = summary.device_points.map((point) => new Date(point.time).getTime())
	const minTime = Math.min(...times)
	const maxTime = Math.max(...times)
	const timeRange = maxTime - minTime
	const series = [...groupedPoints.entries()].map(([deviceId, points], seriesIndex) => ({
		deviceId,
		name: points[0]?.device_name || deviceId,
		color: METER_COLORS[seriesIndex % METER_COLORS.length],
		points: points.map((point) => ({
			point,
			x: timeRange === 0 ? (plot.left + plot.right) / 2 : plot.left + ((new Date(point.time).getTime() - minTime) / timeRange) * (plot.right - plot.left),
			value: point.metric_value ?? 0,
		})),
	}))
	const values = series.flatMap((item) => item.points.map(({ value }) => value))
	const dataMin = values.reduce((minimum, value) => Math.min(minimum, value), Number.POSITIVE_INFINITY)
	const dataMax = values.reduce((maximum, value) => Math.max(maximum, value), Number.NEGATIVE_INFINITY)
	const chartDataMin = values.length ? dataMin : 0
	const chartDataMax = values.length ? dataMax : 0
	const range = chartDataMax - chartDataMin
	const padding = range > 0 ? range * 0.12 : Math.max(Math.abs(chartDataMax) * 0.08, 1)
	const chartMin = chartDataMin - padding
	const chartMax = chartDataMax + padding
	const chartRange = chartMax - chartMin
	const gridLines = [0, 1, 2, 3].map((index) => {
		const ratio = index / 3
		return {
			y: plot.top + ratio * (plot.bottom - plot.top),
			value: chartMax - ratio * chartRange,
		}
	})
	const chartSeries = series.map((item) => ({
		...item,
		points: item.points.map(({ point, x, value }) => ({
			point,
			x,
			y: plot.top + ((chartMax - value) / chartRange) * (plot.bottom - plot.top),
		})),
	}))
	const hoveredLine = hovered === null ? null : chartSeries[hovered.seriesIndex]
	const hoveredPoint = hoveredLine?.points[hovered?.pointIndex ?? -1] ?? null
	const hoveredTime = hoveredPoint ? new Date(hoveredPoint.point.time).getTime() : null
	const hoveredReadings = hoveredTime === null ? [] : chartSeries.map((item) => ({
		series: item,
		point: item.points.reduce<typeof item.points[number] | null>((nearest, point) => {
			if (nearest === null) return point
			return Math.abs(new Date(point.point.time).getTime() - hoveredTime) < Math.abs(new Date(nearest.point.time).getTime() - hoveredTime)
				? point
				: nearest
		}, null),
	})).filter((reading): reading is { series: typeof chartSeries[number]; point: typeof chartSeries[number]['points'][number] } => reading.point !== null)
	const tooltipWidth = 240
	const tooltipX = hoveredPoint
		? Math.min(plot.right - tooltipWidth, Math.max(plot.left, hoveredPoint.x - tooltipWidth / 2))
		: plot.left
	const tooltipHeight = 38 + hoveredReadings.length * 17
	const tooltipY = hoveredPoint
		? hoveredPoint.y < plot.top + tooltipHeight + 10
			? Math.min(plot.bottom - tooltipHeight, hoveredPoint.y + 14)
			: hoveredPoint.y - tooltipHeight - 8
		: plot.top

	const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
		const svg = svgRef.current
		if (!svg || chartSeries.length === 0) return
		const screenMatrix = svg.getScreenCTM()
		if (!screenMatrix) return
		const pointer = svg.createSVGPoint()
		pointer.x = event.clientX
		pointer.y = event.clientY
		const localPointer = pointer.matrixTransform(screenMatrix.inverse())
		let nearest: { seriesIndex: number; pointIndex: number; distance: number } | null = null
		chartSeries.forEach((item, seriesIndex) => item.points.forEach((point, pointIndex) => {
			const distance = Math.abs(point.x - localPointer.x)
			if (nearest === null || distance < nearest.distance) nearest = { seriesIndex, pointIndex, distance }
		}))
		setHovered(nearest)
	}

	return (
		<div className="mt-5">
			{summary.device_points.length === 0 ? (
				<div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-center">
					<Activity className="size-8 text-gray-300" aria-hidden />
					<p className="mt-3 text-sm font-medium text-gray-700">Belum ada data energi pada periode ini</p>
					<p className="mt-1 text-xs text-gray-500">Pastikan power meter aktif dan pengumpul data berjalan.</p>
				</div>
			) : (
				<div className="overflow-hidden rounded-xl border border-slate-100 bg-linear-to-br from-slate-50 via-white to-emerald-50/70 px-2 pt-2">
					<svg
						ref={svgRef}
						viewBox="0 0 1260 260"
						className="h-64 w-full touch-pan-y"
						role="img"
						aria-label={`Grafik ${metricLabel} berdasarkan waktu. Arahkan kursor ke grafik untuk melihat nilai dan waktu.`}
						onPointerMove={handlePointerMove}
						onPointerLeave={() => setHovered(null)}
					>
						{gridLines.map(({ y, value }) => (
							<g key={y}>
								<line x1={plot.left} x2={plot.right} y1={y} y2={y} stroke="#cbd5e1" strokeOpacity="0.7" strokeDasharray="3 5" />
								<text x={plot.left - 10} y={y + 4} textAnchor="end" fill="#64748b" fontSize="10">
									{number(value)}{metricUnit ? ` ${metricUnit}` : ''}
								</text>
							</g>
						))}
						{chartSeries.map((item) => (
							<g key={item.deviceId}>
								<polyline points={item.points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={item.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
								{item.points.length === 1 && <circle cx={item.points[0].x} cy={item.points[0].y} r="5" fill={item.color} />}
							</g>
						))}
						{hoveredPoint && hoveredLine && (
							<g pointerEvents="none">
								<line x1={hoveredPoint.x} x2={hoveredPoint.x} y1={plot.top} y2={plot.bottom} stroke={hoveredLine.color} strokeDasharray="4 4" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
								<circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="5" fill="#fff" stroke={hoveredLine.color} strokeWidth="3" vectorEffect="non-scaling-stroke" />
								<rect x={tooltipX} y={tooltipY} width={tooltipWidth} height={tooltipHeight} rx="8" fill="#0f172a" />
								<text x={tooltipX + 10} y={tooltipY + 15} fill="#cbd5e1" fontSize="9">{detailedTimeLabel(hoveredPoint.point.time)}</text>
								{hoveredReadings.map(({ series: item, point }, index) => (
									<g key={item.deviceId}>
										<circle cx={tooltipX + 12} cy={tooltipY + 31 + index * 17} r="3" fill={item.color} />
										<text x={tooltipX + 21} y={tooltipY + 34 + index * 17} fill="#fff" fontSize="10">{`${item.name}: ${number(point.point.metric_value ?? 0)}${metricUnit ? ` ${metricUnit}` : ''}`}</text>
										<circle cx={point.x} cy={point.y} r="4" fill="#fff" stroke={item.color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
									</g>
								))}
							</g>
						)}
						{[...new Set(times)].sort((a, b) => a - b).filter((_, index, uniqueTimes) => [0, Math.floor((uniqueTimes.length - 1) / 2), uniqueTimes.length - 1].includes(index)).map((timestamp, index, labels) => {
							const x = timeRange === 0 ? (plot.left + plot.right) / 2 : plot.left + ((timestamp - minTime) / timeRange) * (plot.right - plot.left)
							return <text key={timestamp} x={x} y="238" textAnchor={index === 0 ? 'start' : index === labels.length - 1 ? 'end' : 'middle'} fill="#475569" fontSize="10">{timeLabel(new Date(timestamp).toISOString(), summary.period)}</text>
						})}
					</svg>
					<div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 px-3 pb-3 pt-2 text-xs text-slate-500">
						<div className="flex flex-wrap gap-x-4 gap-y-2">
							{chartSeries.map((item) => <span key={item.deviceId} className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span>)}
						</div>
						<span>{metricLabel}{metricUnit ? ` · ${metricUnit}` : ''} · {summary.device_points.length.toLocaleString('id-ID')} titik meter</span>
					</div>
				</div>
			)}
		</div>
	)
}

function DailyEnergyChart({ summary }: { summary: MonitoringSummary }) {
	const points = summary.device_daily_energy
	const days = [...new Set(points.map((point) => localDayKey(point.time)))].sort()
	const devices = [...new Map(points.map((point) => [point.device_id, {
		device_id: point.device_id,
		device_name: point.device_name,
	}])).values()]
	const dayGroups = days.map((day) => ({
		day,
		points: devices.map((device) => points.find((point) => point.device_id === device.device_id && localDayKey(point.time) === day)),
	}))
	const width = Math.max(760, days.length * Math.max(devices.length, 1) * 28 + 72)
	const maxEnergy = points.reduce((maximum, point) => Math.max(maximum, point.energy_kwh), 0)
	const chartMax = maxEnergy > 0 ? maxEnergy * 1.12 : 1
	const plot = { left: 44, right: width - 18, top: 20, bottom: 210 }
	const step = days.length ? (plot.right - plot.left) / days.length : 0
	const barWidth = Math.min(22, (step / Math.max(devices.length, 1)) * 0.68)
	const labelStep = Math.max(1, Math.ceil(days.length / 12))

	return days.length ? (
		<div className="overflow-x-auto rounded-xl border border-slate-100 bg-linear-to-br from-slate-50 via-white to-emerald-50/60">
			<svg
				viewBox={`0 0 ${width} 260`}
				className="h-64 min-w-full"
				role="img"
				aria-label="Grafik batang konsumsi energi harian yang dipisahkan per power meter"
			>
				{[0, 1, 2, 3].map((index) => {
					const y = plot.top + index * ((plot.bottom - plot.top) / 3)
					const value = chartMax * (1 - index / 3)
					return <g key={index}>
						<line x1={plot.left} x2={plot.right} y1={y} y2={y} stroke="#cbd5e1" strokeOpacity="0.65" strokeDasharray="3 5" />
						<text x={plot.left - 7} y={y + 3} textAnchor="end" fill="#64748b" fontSize="9">{number(value, 2)}</text>
					</g>
				})}
				{dayGroups.map(({ day, points: dayPoints }, dayIndex) => {
					const date = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(`${day}T00:00:00+07:00`))
					return <g key={day}>
						{dayPoints.map((point, deviceIndex) => {
							if (!point) return null
							const barHeight = (point.energy_kwh / chartMax) * (plot.bottom - plot.top)
							const groupWidth = barWidth * devices.length
							const x = plot.left + step * dayIndex + (step - groupWidth) / 2 + barWidth * deviceIndex
							const y = plot.bottom - barHeight
							const color = METER_COLORS[deviceIndex % METER_COLORS.length]
							return <rect key={point.device_id} x={x} y={y} width={barWidth} height={Math.max(barHeight, 1)} rx="3" fill={color}>
								<title>{`${devices[deviceIndex].device_name || devices[deviceIndex].device_id} · ${date}: ${number(point.energy_kwh, 3)} kWh`}</title>
							</rect>
						})}
						{dayIndex % labelStep === 0 || dayIndex === days.length - 1
							? <text x={plot.left + step * dayIndex + step / 2} y="232" textAnchor="middle" fill="#475569" fontSize="9">{date}</text>
							: null}
					</g>
				})}
			</svg>
			<div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-200/70 px-3 py-2 text-xs text-slate-600">
				{devices.map((device, index) => <span key={device.device_id} className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ backgroundColor: METER_COLORS[index % METER_COLORS.length] }} />{device.device_name || device.device_id}</span>)}
			</div>
		</div>
	) : (
		<div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-500">
			Belum ada data konsumsi energi harian pada rentang ini.
		</div>
	)
}

function ConsumptionComparison({ summary }: { summary: MonitoringSummary }) {
	const points = summary.device_daily_energy
	const days = [...new Set(points.map((point) => localDayKey(point.time)))].sort()
	const splitIndex = days.length >= 14 ? days.length - 7 : Math.floor(days.length / 2)
	const firstPeriod = new Set(days.slice(Math.max(0, splitIndex - 7), splitIndex))
	const secondPeriod = new Set(days.slice(splitIndex))
	const devices = [...new Map(points.map((point) => [point.device_id, {
		device_id: point.device_id,
		device_name: point.device_name,
	}])).values()]
	const rows = devices.map((device, index) => {
		const devicePoints = points.filter((point) => point.device_id === device.device_id)
		const firstTotal = devicePoints.reduce((total, point) => total + (firstPeriod.has(localDayKey(point.time)) ? point.energy_kwh : 0), 0)
		const secondTotal = devicePoints.reduce((total, point) => total + (secondPeriod.has(localDayKey(point.time)) ? point.energy_kwh : 0), 0)
		return {
			...device,
			firstTotal,
			secondTotal,
			change: firstTotal > 0 ? ((secondTotal - firstTotal) / firstTotal) * 100 : null,
			color: METER_COLORS[index % METER_COLORS.length],
		}
	})
	const maxValue = Math.max(...rows.flatMap((row) => [row.firstTotal, row.secondTotal]), 1)
	const comparisonLabel = days.length >= 14
		? '7 hari terakhir dibanding 7 hari sebelumnya'
		: 'Perbandingan dua bagian rentang terpilih'

	return days.length >= 2 && rows.length ? (
		<div className="max-h-72 space-y-4 overflow-y-auto pr-1">
			<p className="text-xs text-slate-500">{comparisonLabel}</p>
			{rows.map((row) => (
				<div key={row.device_id} className="rounded-lg border border-slate-100 p-3">
					<p className="mb-2 truncate text-xs font-semibold text-slate-800">{row.device_name || row.device_id}</p>
					<div className="mb-1.5 flex justify-between gap-3 text-[11px]">
						<span className="text-slate-600">{days.length >= 14 ? 'Sebelumnya' : 'Bagian awal'}</span>
						<span className="font-medium text-slate-900">{number(row.firstTotal, 2)} kWh</span>
					</div>
					<div className="mb-2 h-2 overflow-hidden rounded-full bg-slate-100">
						<div className="h-full rounded-full" style={{ width: `${Math.max((row.firstTotal / maxValue) * 100, row.firstTotal > 0 ? 2 : 0)}%`, backgroundColor: row.color, opacity: 0.55 }} />
					</div>
					<div className="mb-1.5 flex justify-between gap-3 text-[11px]">
						<span className="text-slate-600">{days.length >= 14 ? '7 hari terakhir' : 'Bagian akhir'}</span>
						<span className="font-medium text-slate-900">{number(row.secondTotal, 2)} kWh</span>
					</div>
					<div className="h-2 overflow-hidden rounded-full bg-slate-100">
						<div className="h-full rounded-full" style={{ width: `${Math.max((row.secondTotal / maxValue) * 100, row.secondTotal > 0 ? 2 : 0)}%`, backgroundColor: row.color }} />
					</div>
					<p className={`mt-2 text-xs font-semibold ${row.change === null ? 'text-slate-500' : row.change > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
						Perubahan: {row.change === null ? 'belum ada pembanding' : `${row.change > 0 ? '+' : ''}${number(row.change)}%`}
					</p>
					</div>
			))}
		</div>
	) : (
		<div className="flex h-44 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-500">
			Perlu data minimal dua hari untuk perbandingan.
		</div>
	)
}

function PowerFactorTrend({ summary }: { summary: MonitoringSummary }) {
	const points = summary.device_points.filter((point) => point.power_factor !== null)
	const groups = new Map<string, typeof points>()
	points.forEach((point) => {
		const series = groups.get(point.device_id) ?? []
		series.push(point)
		groups.set(point.device_id, series)
	})
	const width = 560
	const plot = { left: 42, right: 548, top: 18, bottom: 150 }
	const timestamps = points.map((point) => new Date(point.time).getTime())
	const minTime = Math.min(...timestamps)
	const timeRange = Math.max(...timestamps) - minTime
	const chartSeries = [...groups.entries()].map(([deviceId, devicePoints], seriesIndex) => ({
		deviceId,
		name: devicePoints[0]?.device_name || deviceId,
		color: METER_COLORS[seriesIndex % METER_COLORS.length],
		points: devicePoints.map((point) => ({
			point,
			x: timeRange === 0 ? (plot.left + plot.right) / 2 : plot.left + ((new Date(point.time).getTime() - minTime) / timeRange) * (plot.right - plot.left),
			y: plot.bottom - ((point.power_factor ?? 0) / 1) * (plot.bottom - plot.top),
		})),
	}))

	return points.length > 0 ? (
		<div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2">
			<svg viewBox={`0 0 ${width} 184`} className="h-44 w-full" role="img" aria-label="Tren faktor daya terpisah untuk setiap power meter">
				{[0, 0.5, 1].map((value) => {
					const y = plot.bottom - value * (plot.bottom - plot.top)
					return <g key={value}>
						<line x1={plot.left} x2={plot.right} y1={y} y2={y} stroke="#cbd5e1" strokeDasharray="3 5" />
						<text x={plot.left - 8} y={y + 3} textAnchor="end" fill="#64748b" fontSize="9">{number(value, 1)}</text>
					</g>
				})}
				{chartSeries.map((series) => <g key={series.deviceId}>
					<polyline points={series.points.map(({ x, y }) => `${x},${y}`).join(' ')} fill="none" stroke={series.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
					{series.points.length === 1 && <circle cx={series.points[0].x} cy={series.points[0].y} r="3" fill={series.color}><title>{`${series.name}: ${number(series.points[0].point.power_factor ?? 0, 3)}`}</title></circle>}
				</g>)}
				{[0, 0.5, 1].map((ratio) => {
					const time = new Date(minTime + timeRange * ratio).toISOString()
					const x = plot.left + ratio * (plot.right - plot.left)
					return <text key={ratio} x={x} y="174" textAnchor={ratio === 0 ? 'start' : ratio === 1 ? 'end' : 'middle'} fill="#64748b" fontSize="9">{timeLabel(time, summary.period)}</text>
				})}
			</svg>
			<div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-200 px-2 py-2 text-[10px] text-slate-600">
				{chartSeries.map((item) => <span key={item.deviceId} className="flex items-center gap-1"><span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span>)}
			</div>
		</div>
	) : (
		<div className="flex h-44 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-500">
			Data faktor daya belum tersedia.
		</div>
	)
}

function NotificationPanel() {
	const { enabled, items, unreadCount } = useNotifications()
	const latest = items.slice(0, 3)

	return (
		<div className="space-y-3">
			{!enabled ? (
				<div className="flex h-44 items-center justify-center rounded-xl bg-slate-50 px-5 text-center text-sm text-slate-500">
					Notifikasi tidak tersedia untuk akun ini.
				</div>
			) : latest.length ? latest.map((item) => {
				const severityClass = item.severity === 'critical'
					? 'bg-rose-100 text-rose-700'
					: item.severity === 'warning'
						? 'bg-amber-100 text-amber-700'
						: 'bg-sky-100 text-sky-700'
				return <div key={item.id} className="flex gap-3 rounded-xl border border-slate-100 bg-white p-3">
					<span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${severityClass}`}><CircleAlert className="size-4" aria-hidden /></span>
					<div className="min-w-0 flex-1">
						<div className="flex items-start justify-between gap-2">
							<p className="line-clamp-1 text-sm font-semibold text-slate-900">{item.title}</p>
							<span className="shrink-0 text-[10px] text-slate-400">{formatRelative(item.created_at)}</span>
						</div>
						<p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.message || item.device_id || 'Pemberitahuan sistem'}</p>
					</div>
				</div>
			}) : (
				<div className="flex h-44 flex-col items-center justify-center rounded-xl bg-slate-50 px-5 text-center">
					<Bell className="size-5 text-slate-400" aria-hidden />
					<p className="mt-2 text-sm font-medium text-slate-700">Tidak ada notifikasi terbaru</p>
				</div>
			)}
			{enabled && <Link to="/" className="flex items-center justify-between px-1 text-xs font-medium text-emerald-700 hover:text-emerald-800">
				<span>{unreadCount} belum dibaca</span><span className="flex items-center">Lihat semua <ChevronRight className="size-3.5" aria-hidden /></span>
			</Link>}
		</div>
	)
}

const PIE_COLORS = ['#059669', '#0f766e', '#14b8a6', '#0f172a', '#34d399', '#64748b', '#a7f3d0', '#334155']

function createPieSlices(devices: MonitoringSummary['device_consumption'], total: number) {
	const circumference = 2 * Math.PI * 58
	let offset = 0
	return devices.map((device, index) => {
		const length = (device.consumption_kwh / total) * circumference
		const slice = { ...device, color: PIE_COLORS[index % PIE_COLORS.length], length, offset }
		offset += length
		return slice
	})
}

function DeviceConsumptionPieChart({ summary }: { summary: MonitoringSummary }) {
	const positiveDevices = summary.device_consumption.filter((device) => device.consumption_kwh > 0)
	const total = positiveDevices.reduce((sum, device) => sum + device.consumption_kwh, 0)
	const circumference = 2 * Math.PI * 58
	const slices = total > 0 ? createPieSlices(positiveDevices, total) : []

	return total > 0 ? (
		<div className="flex h-full flex-col items-center justify-center gap-5 py-3 sm:flex-row sm:items-center">
			<div className="relative size-48 shrink-0">
				<svg viewBox="0 0 160 160" className="size-full -rotate-90" role="img" aria-label="Distribusi konsumsi energi tiap power meter">
					<circle cx="80" cy="80" r="58" fill="none" stroke="#e2e8f0" strokeWidth="26" />
					{slices.map((slice) => (
						<circle
							key={slice.device_id}
							cx="80"
							cy="80"
							r="58"
							fill="none"
							stroke={slice.color}
							strokeWidth="26"
							strokeDasharray={`${slice.length} ${circumference - slice.length}`}
							strokeDashoffset={-slice.offset}
						>
							<title>{`${slice.device_name || slice.device_id}: ${number(slice.consumption_kwh, 3)} kWh`}</title>
						</circle>
					))}
				</svg>
				<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
					<span className="text-xs text-slate-500">Total</span>
					<span className="mt-1 text-lg font-semibold text-slate-900">{number(total, 2)}</span>
					<span className="text-xs text-slate-500">kWh</span>
				</div>
			</div>
			<ul className="max-h-52 min-w-0 flex-1 space-y-2 overflow-y-auto pr-2">
				{summary.device_consumption.map((device) => {
					const share = total ? (device.consumption_kwh / total) * 100 : 0
					const colorIndex = positiveDevices.findIndex((item) => item.device_id === device.device_id)
					const color = colorIndex >= 0 ? PIE_COLORS[colorIndex % PIE_COLORS.length] : '#cbd5e1'
					return <li key={device.device_id} className="flex items-center gap-2 text-sm">
						<span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
						<span className="min-w-0 flex-1 truncate text-slate-700" title={device.device_name || device.device_id}>{device.device_name || device.device_id}</span>
						<span className="shrink-0 text-right text-xs font-medium text-slate-900">{number(device.consumption_kwh, 3)} kWh</span>
						<span className="w-12 shrink-0 text-right text-xs text-slate-500">{number(share)}%</span>
					</li>
				})}
			</ul>
		</div>
	) : (
		<div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-500">
			Belum ada kenaikan energi meter untuk dihitung pada rentang ini.
		</div>
	)
}

function metricCards(summary: MonitoringSummary, devices: MonitoringSummary['devices']) {
	const energyCost = summary.total_energy_kwh * summary.price_per_kwh
	return [
		{ label: 'Energi terpakai', value: `${number(summary.total_energy_kwh, 3)} kWh`, hint: 'Akumulasi pada periode', icon: Zap, iconClass: 'bg-emerald-100 text-emerald-800', trend: 'neutral' },
		{ label: 'Daya rata-rata', value: `${number(summary.avg_power_w)} W`, hint: 'Rata-rata seluruh sampel', icon: Gauge, iconClass: 'bg-slate-200 text-slate-800', trend: 'neutral' },
		{ label: 'Daya puncak', value: `${number(summary.peak_power_w)} W`, hint: 'Nilai tertinggi tercatat', icon: ArrowUpRight, iconClass: 'bg-emerald-50 text-emerald-700', trend: 'neutral' },
		{ label: 'Meter online', value: `${devices.filter((device) => device.status === 'online').length} / ${devices.length}`, hint: 'Status koneksi terkini', icon: Activity, iconClass: 'bg-sky-100 text-sky-800', trend: 'neutral' },
		{ label: 'Biaya energi terpakai', value: rupiah(energyCost), hint: `${number(summary.total_energy_kwh, 3)} kWh × ${rupiah(summary.price_per_kwh, 2)} / kWh`, icon: BadgeDollarSign, iconClass: 'bg-amber-100 text-amber-800', trend: 'neutral' },
	]
}

/** Monitoring energi live dengan status perangkat dan notifikasi dari modul terkait. */
export default function MonitoringEnergy() {
	const user = useUser()
	const { devices: managedDevices } = useDevices()
	const [period, setPeriod] = useState<MonitoringPeriod>('live')
	const [historyDraft, setHistoryDraft] = useState(() => {
		const end = new Date()
		return {
			start: localDateTimeInputValue(new Date(end.getTime() - 60 * 60 * 1000)),
			end: localDateTimeInputValue(end),
		}
	})
	const [historyRange, setHistoryRange] = useState(historyDraft)
	const [deviceId, setDeviceId] = useState('')
	const [dailyChartRange] = useState(() => rangeEndingNow(24 * 7))
	const [trendChartRange] = useState(() => rangeEndingNow(1))
	const [showAllReadings, setShowAllReadings] = useState(false)
	const [selectedMetricKey, setSelectedMetricKey] = useState('daya')
	const [summary, setSummary] = useState<MonitoringSummary | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [loading, setLoading] = useState(true)
	const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
	const devices = useMemo(() => summary?.devices ?? [], [summary])
	const managedDeviceList = managedDevices ?? EMPTY_DEVICES
	const metricOptions = useMemo(() => {
		const options = new Map<string, { key: string; parameter: string; unit: string }>([
			['daya', { key: 'daya', parameter: 'Daya', unit: 'W' }],
		])
		managedDeviceList.forEach((device) => {
			device.register_config.forEach(({ key, parameter, unit }) => {
				if (!options.has(key)) options.set(key, { key, parameter, unit })
			})
		})
		return [...options.values()]
	}, [managedDeviceList])
	const activeMetric = metricOptions.find(({ key }) => key === selectedMetricKey) ?? metricOptions[0]
	const metricKey = activeMetric.key

	const reload = useCallback(async (silent = false) => {
		const token = getToken()
		if (!token) return
		if (!silent) setLoading(true)
		try {
			const result = await api.monitoringSummary(
				token,
				period,
				deviceId || undefined,
				period === 'custom' ? historyRange.start : undefined,
				period === 'custom' ? historyRange.end : undefined,
				metricKey,
			)
			setSummary(result)
			setError(null)
			setUpdatedAt(new Date())
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Gagal memuat data monitoring')
		} finally {
			if (!silent) setLoading(false)
		}
	}, [deviceId, historyRange, metricKey, period])

	useEffect(() => {
		const initial = window.setTimeout(() => void reload(), 0)
		const interval = period === 'live'
			? window.setInterval(() => void reload(true), 5_000)
			: undefined
		return () => {
			window.clearTimeout(initial)
			if (interval !== undefined) window.clearInterval(interval)
		}
	}, [period, reload])

	const metrics = summary ? metricCards(summary, summary.devices) : []
	const displayedDevices = period === 'live' && !showAllReadings ? devices.slice(0, 5) : devices
	const applyHistoryRange = () => {
		const now = localDateTimeInputValue()
		if (!historyDraft.start || !historyDraft.end || historyDraft.start > historyDraft.end || historyDraft.end > now) {
			setError('Pilih rentang waktu yang valid. Waktu awal harus sebelum waktu akhir dan waktu akhir tidak boleh di masa depan.')
			return
		}
		setError(null)
		setHistoryRange(historyDraft)
	}

	return (
		<div className="min-h-screen w-full bg-slate-50/70">
			<div className="sticky top-0 z-50"><MainHeader /></div>
			<main className="w-full min-w-0 space-y-4 px-2 py-4 sm:px-4 lg:px-6 2xl:px-8">
				<section className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:p-5">
			<div className="flex min-w-0 items-center gap-3">
				<Link to="/" aria-label="Kembali ke Dashboard" title="Kembali ke Dashboard" className="flex size-10 shrink-0 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
					<ArrowLeft className="size-5" aria-hidden />
				</Link>
				<div className="min-w-0">
					<p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Monitoring energi</p>
					<h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Selamat datang, {user.username}</h1>
					<p className="mt-1 text-sm text-slate-500">Pantau konsumsi, performa meter, dan tren energi secara realtime.</p>
				</div>
			</div>
					<div className="flex flex-wrap items-center gap-2">
						<label className="sr-only" htmlFor="monitor-device">Power meter untuk ringkasan dan tabel</label>
						<select id="monitor-device" value={deviceId} onChange={(event) => { setDeviceId(event.target.value); setShowAllReadings(false) }} className="h-10 min-w-40 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500">
							<option value="">Semua perangkat</option>
							{managedDeviceList.map((device) => <option key={device.device_id} value={device.device_id}>{device.device_name || device.device_id}</option>)}
						</select>
						<Button variant="outline" size="sm" onClick={() => void reload()} loading={loading}>
							<RefreshCw className="size-4" aria-hidden /> Perbarui
						</Button>
					</div>
				</section>

				<section aria-label="Filter monitoring" className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
					<div className="flex items-center gap-2 text-xs font-medium text-slate-600"><CalendarDays className="size-4 text-emerald-700" aria-hidden />Periode ringkasan & tabel realtime</div>
					<div className="flex flex-wrap items-center gap-3">
						<div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Pilih mode monitoring">
							{([
								{ value: 'live' as const, label: 'Realtime' },
								{ value: 'custom' as const, label: 'Pilih tanggal' },
							]).map((option) => <button key={option.value} type="button" onClick={() => { setPeriod(option.value); setShowAllReadings(false) }} aria-pressed={period === option.value || (option.value === 'custom' && period !== 'live')} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${period === option.value || (option.value === 'custom' && period !== 'live') ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>{option.label}</button>)}
						</div>
						{period === 'custom' && (
							<div className="flex flex-wrap items-center gap-2">
								<label className="text-xs text-slate-500" htmlFor="monitor-start-time">Dari</label>
								<input id="monitor-start-time" type="datetime-local" value={historyDraft.start} max={historyDraft.end || localDateTimeInputValue()} onChange={(event) => setHistoryDraft((current) => ({ ...current, start: event.target.value }))} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 [color-scheme:light]" />
								<label className="text-xs text-slate-500" htmlFor="monitor-end-time">Sampai</label>
								<input id="monitor-end-time" type="datetime-local" value={historyDraft.end} min={historyDraft.start || undefined} max={localDateTimeInputValue()} onChange={(event) => setHistoryDraft((current) => ({ ...current, end: event.target.value }))} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 [color-scheme:light]" />
								<Button variant="primary" size="sm" onClick={applyHistoryRange}>Terapkan</Button>
							</div>
						)}
					</div>
					<span className="text-xs text-slate-500">
						{period === 'live' ? 'Refresh tiap 5 detik' : 'Rentang historis · WIB'}
						{updatedAt ? ` · ${formatRelative(updatedAt.toISOString())}` : ' · Menunggu data...'}
					</span>
				</section>

				{error && <Alert variant="error">{error}</Alert>}

				{summary ? (
					<>
						<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
							{metrics.map(({ label, value, hint, icon: Icon, iconClass, trend }) => (
								<Card key={label} className="border-slate-200 bg-linear-to-br from-white to-emerald-50/60 p-4 shadow-sm sm:p-5">
									<div className="flex items-start justify-between gap-2">
										<span className={`flex size-9 items-center justify-center rounded-xl ${iconClass}`}><Icon className="size-4.5" aria-hidden /></span>
										{trend === 'warning' && <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"><ArrowDownRight className="size-3.5" aria-hidden />Perhatian</span>}
									</div>
									<p className="mt-3 text-sm text-gray-500">{label}</p>
									<p className="mt-1 break-words text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">{value}</p>
									<p className="mt-1 text-xs text-gray-400">{hint}</p>
								</Card>
							))}
						</div>

						<div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.9fr)_minmax(18rem,0.9fr)]">
							<FilteredChartCard
								id="daily-energy-chart"
								title="Konsumsi energi per hari"
								subtitle="Energi harian (kWh) sesuai meter dan rentang waktu yang dipilih"
								devices={managedDeviceList}
								initialFilter={{ deviceId, ...dailyChartRange }}
								className="border-emerald-100 bg-linear-to-br from-white via-white to-emerald-50/40"
							>
								{(chartSummary) => <div className="mt-4"><DailyEnergyChart summary={chartSummary} /></div>}
							</FilteredChartCard>
							<FilteredChartCard
								id="meter-consumption-chart"
								title="Konsumsi per power meter"
								subtitle="Porsi energi pada meter dan rentang waktu terpilih"
								devices={managedDeviceList}
								initialFilter={{ deviceId, ...dailyChartRange }}
								className="border-slate-200 bg-linear-to-br from-white to-slate-50"
							>
								{(chartSummary) => <div className="mt-2"><DeviceConsumptionPieChart summary={chartSummary} /></div>}
							</FilteredChartCard>
							<Card className="min-w-0 border-slate-200 bg-white p-4 shadow-sm sm:p-5">
								<div className="mb-4 flex items-start justify-between gap-3">
									<div>
										<h2 className="font-semibold text-slate-900">Peringatan & notifikasi</h2>
										<p className="mt-1 text-sm text-slate-500">Pembaruan operasional terbaru</p>
									</div>
									<Bell className="mt-0.5 size-4 text-emerald-700" aria-hidden />
								</div>
								<NotificationPanel />
							</Card>
						</div>

						<div className="grid min-w-0 gap-4 xl:grid-cols-4">
							<FilteredChartCard
								id="energy-trend-chart"
								title={`Tren ${activeMetric.parameter.toLocaleLowerCase('id-ID')}`}
								subtitle={`Nilai aktual setiap pembacaan · parameter ${activeMetric.parameter}`}
								devices={managedDeviceList}
								initialFilter={{ deviceId, ...trendChartRange }}
								metricKey={metricKey}
								allowRealtime
								className="border-emerald-100 bg-linear-to-br from-white via-white to-emerald-50/40 xl:col-span-2"
							>
								{(chartSummary, chartFilter, realtime) => (
									<>
										<p className="mt-1 text-xs text-slate-500">
											{realtime ? 'Pembacaan aktual 1 jam terakhir · pembaruan otomatis tiap 5 detik' : `Pembacaan aktual · ${chartFilter.start.replace('T', ' ')} sampai ${chartFilter.end.replace('T', ' ')}`}
										</p>
										<div className="mt-3 flex flex-wrap items-center justify-between gap-2">
											<div className="flex items-center gap-2">
												<label htmlFor="monitor-metric" className="text-xs font-medium text-gray-600">Parameter</label>
												<select
													id="monitor-metric"
													value={metricKey}
													onChange={(event) => setSelectedMetricKey(event.target.value)}
													className="h-9 max-w-56 rounded-lg border border-gray-200 bg-white px-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-emerald-500"
												>
													{metricOptions.map((option) => <option key={option.key} value={option.key}>{option.parameter}{option.unit ? ` (${option.unit})` : ''}</option>)}
												</select>
											</div>
											<Button variant="outline" size="sm" onClick={() => exportCsv(chartSummary, chartFilter.start, chartFilter.end, activeMetric.parameter, activeMetric.unit)}><Download className="size-4" aria-hidden />Ekspor CSV</Button>
										</div>
										<EnergyChart summary={chartSummary} metricLabel={activeMetric.parameter} metricUnit={activeMetric.unit} />
									</>
								)}
							</FilteredChartCard>
							<FilteredChartCard
								id="consumption-comparison-chart"
								title="Perbandingan konsumsi"
								subtitle="Perubahan konsumsi energi pada rentang terpilih"
								devices={managedDeviceList}
								initialFilter={{ deviceId, ...dailyChartRange }}
								className="border-slate-200 bg-white"
							>
								{(chartSummary) => <div className="mt-4"><ConsumptionComparison summary={chartSummary} /></div>}
							</FilteredChartCard>
							<FilteredChartCard
								id="power-factor-chart"
								title="Faktor daya"
								subtitle="Tren power factor pada rentang terpilih"
								devices={managedDeviceList}
								initialFilter={{ deviceId, ...trendChartRange }}
								className="border-slate-200 bg-white"
							>
								{(chartSummary) => <div className="mt-4"><PowerFactorTrend summary={chartSummary} /></div>}
							</FilteredChartCard>
						</div>

						<div className="min-w-0">
							<Card className="overflow-hidden">
								<div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 sm:px-6">
									<div><h2 className="font-semibold text-gray-900">{period === 'live' ? 'Bacaan realtime' : 'Bacaan pada rentang waktu'}</h2><p className="mt-1 text-sm text-gray-500">{period === 'live' ? 'Pratinjau pengukuran power meter terkini' : 'Bacaan terakhir yang tercatat dalam rentang terpilih'}</p></div>
									<div className="flex items-center gap-2">
										<span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
											{period === 'live' ? `${displayedDevices.length} dari ${devices.length}` : devices.length} perangkat
										</span>
										{period === 'live' && devices.length > 5 && (
											<Button variant="ghost" size="sm" onClick={() => setShowAllReadings((shown) => !shown)}>
												{showAllReadings ? 'Tampilkan lebih sedikit' : 'Lihat semua'}
											</Button>
										)}
									</div>
								</div>
								<div className="overflow-x-auto">
									<table className="w-full min-w-[38rem] text-left text-sm">
										<thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr>{['Perangkat', 'Arus', 'Tegangan', 'Daya', 'Pembaruan', 'Pengukuran'].map((heading) => <th key={heading} className="px-5 py-3 font-medium">{heading}</th>)}</tr></thead>
									<tbody className="divide-y divide-gray-100">{displayedDevices.map((device) => <tr key={device.device_id}>
										<td className="px-5 py-3.5">
											<span className="block font-medium text-gray-900">{device.device_name || device.device_id}</span>
											<span className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
												<span className={`size-1.5 rounded-full ${device.status === 'online' ? 'bg-emerald-500' : device.status === 'error' ? 'bg-rose-500' : 'bg-slate-400'}`} />
												{device.device_id} · {device.status === 'online' ? 'Online' : device.status === 'error' ? 'Error' : 'Offline'}
											</span>
										</td>
										<td className="px-5 py-3.5 text-gray-700">{device.arus == null ? '—' : `${number(device.arus, 2)} A`}</td>
										<td className="px-5 py-3.5 text-gray-700">{device.tegangan == null ? '—' : `${number(device.tegangan, 1)} V`}</td>
										<td className="px-5 py-3.5 font-medium text-gray-900">{device.daya == null ? '—' : `${number(device.daya)} W`}</td>
										<td className="px-5 py-3.5 text-gray-500">{device.time ? formatRelative(device.time) : 'Belum ada data'}</td>
										<td className="px-5 py-3.5">
											<details className="max-w-3xl">
												<summary className="cursor-pointer font-medium text-emerald-700">Lihat {device.register_config.length} parameter Modbus</summary>
												<div className="mt-3 grid gap-4 rounded-lg bg-gray-50 p-4 sm:grid-cols-2">
													<section>
														<h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Pengukuran</h3>
														<dl className="space-y-1.5">
															{device.register_config.map(({ key, parameter, unit }) => {
																const value = device.register_values?.[key]
																return <div key={key} className="flex justify-between gap-3 text-xs">
																	<dt className="text-gray-600">{parameter}</dt>
																	<dd className="font-medium text-gray-900">{value == null ? '—' : `${number(value, 3)}${unit ? ` ${unit}` : ''}`}</dd>
																</div>
															})}
														</dl>
													</section>
												</div>
											</details>
										</td>
									</tr>)}
									{devices.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-500">Tidak ada perangkat untuk ditampilkan.</td></tr>}									</tbody>
									</table>
								</div>
							</Card>
						</div>

						<section aria-label="Prediksi konsumsi energi" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
							<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
								<div className="flex items-start gap-3">
									<span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><TrendingUp className="size-5" aria-hidden /></span>
									<div>
										<h2 className="font-semibold text-slate-900">Prediksi konsumsi energi</h2>
										<p className="mt-1 max-w-2xl text-sm text-slate-500">Belum ada hasil prediksi yang tersedia. Dashboard ini tidak menampilkan angka estimasi tanpa data dari modul forecasting.</p>
									</div>
								</div>
								<Link to="/forecasting" className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800">
									Buka Forecasting <ChevronRight className="size-4" aria-hidden />
								</Link>
							</div>
						</section>
					</>
				) : loading ? <Card className="p-12 text-center text-sm text-gray-500">Memuat data monitoring energi...</Card> : null}
			</main>
		</div>
	)
}
/**.*/