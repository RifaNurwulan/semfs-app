import { Activity, Download, Pencil, Plug, Plus, Search, Trash2, TriangleAlert, Wifi, WifiOff } from 'lucide-react'
import { useMemo, useState } from 'react'
import { getToken } from '../../auth/tokenStorage'
import { Alert } from '../../components/ui/alert'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { api, ApiError, type Device } from '../../lib/api'
import { useDevices } from '../../lib/useDevices'
import { cn, downloadBlob, formatRelative } from '../../lib/utils'
import { DeleteDialog } from './DeleteDialog'
import { DeviceDialog } from './DeviceDialog'

function statusInfo(d: Device) {
  if (!d.enabled) return { label: 'Nonaktif', dot: 'bg-gray-400', text: 'text-gray-500' }
  if (d.status === 'online') return { label: 'Online', dot: 'bg-emerald-500', text: 'text-emerald-600' }
  if (d.status === 'error') return { label: 'Error', dot: 'bg-rose-500', text: 'text-rose-600' }
  return { label: 'Offline', dot: 'bg-amber-500', text: 'text-amber-600' }
}

function uptimePill(v: number | null) {
  if (v === null) return { text: '-', cls: 'bg-gray-100 text-gray-500' }
  const cls = v >= 99 ? 'bg-emerald-100 text-emerald-700' : v >= 90 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
  return { text: `${v.toFixed(1)}%`, cls }
}

// Sel yang diawali = + - @ diberi tanda kutip agar tidak dieksekusi sebagai rumus di Excel
const csvCell = (v: string | number | null) => {
  let s = v === null ? '' : String(v)
  if (/^[=+\-@]/.test(s)) s = `'${s}`
  return `"${s.replaceAll('"', '""')}"`
}

export function DevicesTab() {
  const { devices, error: loadError, reload } = useDevices()
  const [query, setQuery] = useState('')
  const [dialog, setDialog] = useState<{ device: Device | null } | null>(null)
  const [deleting, setDeleting] = useState<Device | null>(null)
  const [notice, setNotice] = useState<{ variant: 'success' | 'error'; text: string } | null>(null)
  const [probing, setProbing] = useState<string | null>(null)

  const list = useMemo(() => devices ?? [], [devices])
  const stats = {
    total: list.length,
    online: list.filter((d) => d.enabled && d.status === 'online').length,
    offline: list.filter((d) => d.enabled && d.status === 'offline').length,
    error: list.filter((d) => d.enabled && d.status === 'error').length,
  }
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? list.filter((d) => [d.device_id, d.device_name, d.ip_address, d.location].some((x) => x?.toLowerCase().includes(q))) : list
  }, [list, query])

  async function probe(d: Device) {
    const token = getToken()
    if (!token) return
    setProbing(d.device_id)
    setNotice(null)
    try {
      const r = await api.testDevice(token, d.device_id)
      setNotice({
        variant: r.ok ? 'success' : 'error',
        text: r.ok ? `${d.device_id}: ${r.message}. Arus ${r.arus} A, tegangan ${r.tegangan} V, daya ${r.daya} W.` : `${d.device_id}: ${r.message}`,
      })
    } catch (err) {
      setNotice({ variant: 'error', text: err instanceof ApiError ? err.message : 'Uji koneksi gagal' })
    } finally {
      setProbing(null)
    }
  }

  function exportCsv() {
    const head = ['Status', 'Nama', 'Device ID', 'IP Address', 'Port', 'Virtual ID', 'Register', 'Lokasi', 'Batas Daya (W)', 'Last Sync', 'Uptime 24 jam (%)']
    const rows = shown.map((d) => [statusInfo(d).label, d.device_name, d.device_id, d.ip_address, d.port, d.virtual_id, d.register_address, d.location, d.power_limit_w, d.last_seen_at, d.uptime_24h])
    const csv = [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')
    downloadBlob(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }), 'daftar-device.csv')
  }

  const cards = [
    { label: 'Total Device', value: stats.total, icon: Activity, cls: 'bg-blue-100 text-blue-600' },
    { label: 'Online', value: stats.online, icon: Wifi, cls: 'bg-emerald-100 text-emerald-600' },
    { label: 'Offline', value: stats.offline, icon: WifiOff, cls: 'bg-gray-100 text-gray-500' },
    { label: 'Error', value: stats.error, icon: TriangleAlert, cls: 'bg-rose-100 text-rose-600' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, cls }) => (
          <Card key={label} className="flex items-center gap-4 p-5">
            <span className={cn('flex size-12 items-center justify-center rounded-xl', cls)}>
              <Icon className="size-6" aria-hidden />
            </span>
            <div>
              <p className="text-xl font-semibold text-gray-900" data-testid={`stat-${label}`}>{value}</p>
              <p className="text-sm text-gray-500">{label}</p>
            </div>
          </Card>
        ))}
      </div>

      {(loadError || notice) && <Alert variant={loadError ? 'error' : notice!.variant}>{loadError ?? notice!.text}</Alert>}

      <Card className="flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-48 flex-1">
          <Input aria-label="Cari device" placeholder="Cari device..." icon={<Search className="size-5" aria-hidden />} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Button variant="outline" onClick={exportCsv}>
          <Download className="size-4" aria-hidden /> Export
        </Button>
        <Button className="bg-linear-to-r from-red-500 to-rose-600 shadow-rose-600/20 hover:from-red-600 hover:to-rose-700" onClick={() => setDialog({ device: null })}>
          <Plus className="size-4" aria-hidden /> Tambah Device
        </Button>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="border-b border-gray-200 text-gray-700">
            <tr>
              {['Status', 'Nama Perangkat', 'Device ID', 'IP Address', 'Last Sync', 'Uptime', 'Aksi'].map((h) => (
                <th key={h} className="px-5 py-4 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {devices === null ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-500">Memuat device...</td></tr>
            ) : shown.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-500">{list.length === 0 ? 'Belum ada device. Klik Tambah Device.' : 'Tidak ada device yang cocok.'}</td></tr>
            ) : (
              shown.map((d) => {
                const st = statusInfo(d)
                const up = uptimePill(d.uptime_24h)
                return (
                  <tr key={d.device_id} data-testid={`row-${d.device_id}`}>
                    <td className="px-5 py-4">
                      <span className={cn('flex items-center gap-2 font-medium', st.text)}>
                        <span className={cn('size-2.5 rounded-full', st.dot)} /> {st.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-900">{d.device_name ?? '-'}</td>
                    <td className="px-5 py-4 font-mono text-gray-700">{d.device_id}</td>
                    <td className="px-5 py-4 font-mono text-gray-700">{d.ip_address}<span className="text-gray-400">:{d.port}</span></td>
                    <td className="px-5 py-4 text-gray-600">{d.last_seen_at ? formatRelative(d.last_seen_at) : 'Belum pernah'}</td>
                    <td className="px-5 py-4"><span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', up.cls)}>{up.text}</span></td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1">
                        <button type="button" aria-label={`Uji koneksi ${d.device_id}`} title="Uji koneksi" disabled={probing === d.device_id} onClick={() => void probe(d)} className="flex size-9 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"><Plug className="size-4" aria-hidden /></button>
                        <button type="button" aria-label={`Ubah ${d.device_id}`} title="Ubah" onClick={() => setDialog({ device: d })} className="flex size-9 items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50"><Pencil className="size-4" aria-hidden /></button>
                        <button type="button" aria-label={`Hapus ${d.device_id}`} title="Hapus" onClick={() => setDeleting(d)} className="flex size-9 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50"><Trash2 className="size-4" aria-hidden /></button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </Card>

      <Alert variant="info">
        <strong className="block">Informasi</strong>
        Pastikan IP Address unik untuk setiap device. Sistem akan otomatis mendeteksi status online/offline setiap 30 detik.
      </Alert>

      {dialog && (
        <DeviceDialog
          device={dialog.device}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null)
            setNotice({ variant: 'success', text: 'Konfigurasi device disimpan. Pembaca Modbus akan memakainya otomatis.' })
            void reload()
          }}
        />
      )}
      {deleting && (
        <DeleteDialog
          device={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setNotice({ variant: 'success', text: `Device ${deleting.device_id} dihapus.` })
            setDeleting(null)
            void reload()
          }}
        />
      )}
    </div>
  )
}
