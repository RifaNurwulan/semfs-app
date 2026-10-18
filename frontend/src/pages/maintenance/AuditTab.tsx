import { ScrollText } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getToken } from '../../auth/tokenStorage'
import { Alert } from '../../components/ui/alert'
import { Button } from '../../components/ui/button'
import { Card, CardHeading } from '../../components/ui/card'
import { api, type AuditLog } from '../../lib/api'
import { formatDateTime } from '../../lib/utils'

const LABEL: Record<string, string> = {
  login: 'Login', logout: 'Logout', register: 'Daftar akun', profile_update: 'Ubah profil',
  avatar_update: 'Ganti foto profil', avatar_delete: 'Hapus foto profil',
  password_reset_request: 'Minta reset password', password_reset: 'Reset password',
  role_change: 'Ubah role', user_create: 'Tambah pengguna', support_status: 'Status pesan support',
  device_create: 'Tambah device', device_update: 'Ubah device', device_delete: 'Hapus device', device_test: 'Uji koneksi',
  config_backup: 'Backup konfigurasi', config_restore: 'Restore konfigurasi',
}

interface Loaded {
  filter: string
  items: AuditLog[]
  next: number | null
}

/** Jejak aktivitas pengguna (SRS NF-08), terbaru di atas. */
export function AuditTab() {
  const [filter, setFilter] = useState('')
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [more, setMore] = useState(false)
  const loading = data === null || data.filter !== filter

  useEffect(() => {
    const token = getToken()
    if (!token) return
    let active = true
    api
      .auditLogs(token, { action: filter || undefined })
      .then((r) => active && (setData({ filter, items: r.items, next: r.next_before_id }), setError(null)))
      .catch((e: unknown) => active && setError(e instanceof Error ? e.message : 'Gagal memuat log'))
    return () => {
      active = false
    }
  }, [filter])

  async function loadMore() {
    const token = getToken()
    if (!token || !data?.next) return
    setMore(true)
    try {
      const r = await api.auditLogs(token, { beforeId: data.next, action: filter || undefined })
      setData({ filter, items: [...data.items, ...r.items], next: r.next_before_id })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat log')
    } finally {
      setMore(false)
    }
  }

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <CardHeading icon={<ScrollText className="size-5" />} title="Log Aktivitas" description="Siapa melakukan apa, dan kapan" />
        <select aria-label="Filter aksi" value={filter} onChange={(e) => setFilter(e.target.value)} className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-emerald-500">
          <option value="">Semua aksi</option>
          {Object.entries(LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {error && <Alert variant="error" className="mt-4">{error}</Alert>}

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="border-b border-gray-200 text-gray-500">
            <tr>
              {['Waktu (WIB)', 'Pengguna', 'Aksi', 'Detail', 'IP'].map((h) => <th key={h} className="py-3 pr-4 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="py-8 text-center text-gray-500">Memuat log...</td></tr>
            ) : data.items.length === 0 ? (
              <tr><td colSpan={5} className="py-8 text-center text-gray-500">Belum ada aktivitas tercatat.</td></tr>
            ) : (
              data.items.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap py-3 pr-4 text-gray-600">{formatDateTime(l.at)}</td>
                  <td className="py-3 pr-4 font-medium text-gray-900">{l.username ?? '-'}</td>
                  <td className="py-3 pr-4 text-gray-700">{LABEL[l.action] ?? l.action}</td>
                  <td className="py-3 pr-4 text-gray-600">{[l.entity_id, l.detail].filter(Boolean).join(' - ') || '-'}</td>
                  <td className="py-3 font-mono text-xs text-gray-500">{l.ip ?? '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && data.next && (
        <div className="mt-5 flex justify-center">
          <Button variant="outline" loading={more} onClick={() => void loadMore()}>Muat lebih banyak</Button>
        </div>
      )}
    </Card>
  )
}
