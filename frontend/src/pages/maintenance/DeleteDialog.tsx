import { useState } from 'react'
import { Alert } from '../../components/ui/alert'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Modal } from '../../components/ui/modal'
import { getToken } from '../../auth/tokenStorage'
import { api, ApiError, type Device } from '../../lib/api'

/** Hapus device. Kalau punya data historis, perlu konfirmasi ketik Device ID untuk menghapus beserta datanya. */
export function DeleteDialog({ device, onClose, onDeleted }: { device: Device; onClose: () => void; onDeleted: () => void }) {
  const [needPurge, setNeedPurge] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(purge: boolean) {
    const token = getToken()
    if (!token) return
    setBusy(true)
    setError(null)
    try {
      await api.deleteDevice(token, device.device_id, purge)
      onDeleted()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.message.includes('data historis')) setNeedPurge(true)
      else setError(err instanceof ApiError ? err.message : 'Terjadi kesalahan. Coba lagi.')
      setBusy(false)
    }
  }

  return (
    <Modal title={`Hapus ${device.device_id}?`} onClose={onClose}>
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        {needPurge ? (
          <>
            <Alert variant="error">
              Device ini punya data historis (pembacaan, forecast, anomali). Menghapusnya akan menghapus seluruh data itu
              secara permanen. Pertimbangkan menonaktifkan device lewat tombol Ubah.
            </Alert>
            <label className="block space-y-2 text-sm text-gray-700">
              Ketik <strong>{device.device_id}</strong> untuk melanjutkan
              <Input aria-label="Konfirmasi Device ID" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </label>
          </>
        ) : (
          <p className="text-sm text-gray-600">
            Device <strong>{device.device_name ?? device.device_id}</strong> ({device.ip_address}) akan dihapus dari konfigurasi.
          </p>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          {needPurge ? (
            <Button className="bg-none bg-rose-600 shadow-none hover:bg-rose-700" loading={busy} disabled={confirm !== device.device_id} onClick={() => void run(true)}>
              Hapus beserta semua datanya
            </Button>
          ) : (
            <Button className="bg-none bg-rose-600 shadow-none hover:bg-rose-700" loading={busy} onClick={() => void run(false)}>
              Hapus Device
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
