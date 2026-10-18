import { DatabaseBackup, FileUp } from 'lucide-react'
import { useRef, useState, type ChangeEvent } from 'react'
import { getToken } from '../../auth/tokenStorage'
import { Alert } from '../../components/ui/alert'
import { Button } from '../../components/ui/button'
import { Card, CardHeading } from '../../components/ui/card'
import { Modal } from '../../components/ui/modal'
import { api, ApiError } from '../../lib/api'
import { downloadBlob } from '../../lib/utils'

const MAX_BYTES = 1_000_000
type Notice = { variant: 'success' | 'error'; text: string } | null

/** Backup & restore konfigurasi device (SRS: Backup Konfigurasi, Restore Konfigurasi). */
export function BackupTab() {
  const [backupNotice, setBackupNotice] = useState<Notice>(null)
  const [restoreNotice, setRestoreNotice] = useState<Notice>(null)
  const [busy, setBusy] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [confirming, setConfirming] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function backup() {
    const token = getToken()
    if (!token) return
    setBusy(true)
    setBackupNotice(null)
    try {
      const blob = await api.backupConfig(token)
      const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, (c) => (c === 'T' ? '-' : ''))
      downloadBlob(blob, `semfs-config-${stamp}.json`)
      setBackupNotice({ variant: 'success', text: 'Backup konfigurasi diunduh. Simpan file ini di tempat aman.' })
    } catch (err) {
      setBackupNotice({ variant: 'error', text: err instanceof ApiError ? err.message : 'Backup gagal' })
    } finally {
      setBusy(false)
    }
  }

  function pick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    e.target.value = ''
    setRestoreNotice(null)
    if (f && f.size > MAX_BYTES) {
      setFile(null)
      setRestoreNotice({ variant: 'error', text: 'File terlalu besar (maksimal 1 MB).' })
      return
    }
    setFile(f)
  }

  async function restore() {
    const token = getToken()
    if (!token || !file) return
    setBusy(true)
    try {
      const r = await api.restoreConfig(token, new Blob([await file.text()], { type: 'application/json' }))
      setRestoreNotice({ variant: 'success', text: r.message })
      setFile(null)
    } catch (err) {
      setRestoreNotice({ variant: 'error', text: err instanceof ApiError ? err.message : 'Restore gagal' })
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-6">
        <CardHeading icon={<DatabaseBackup className="size-5" />} title="Backup Konfigurasi" description="Simpan konfigurasi semua device ke satu file" />
        <div className="mt-5 space-y-4">
          {backupNotice && <Alert variant={backupNotice.variant}>{backupNotice.text}</Alert>}
          <p className="text-sm text-gray-600">
            File berisi IP, port, Virtual ID, register, lokasi, dan batas daya tiap device. Data pembacaan, akun, dan password tidak ikut disimpan.
          </p>
          <Button loading={busy} onClick={() => void backup()}>Unduh Backup</Button>
        </div>
      </Card>

      <Card className="p-6">
        <CardHeading icon={<FileUp className="size-5" />} title="Restore Konfigurasi" description="Pulihkan konfigurasi dari file backup" />
        <div className="mt-5 space-y-4">
          {restoreNotice && <Alert variant={restoreNotice.variant}>{restoreNotice.text}</Alert>}
          <p className="text-sm text-gray-600">
            Device dengan ID yang sama akan ditimpa konfigurasinya, device baru ditambahkan. Device yang tidak ada di file <strong>tidak dihapus</strong>. Jika ada satu data yang salah, tidak ada yang diubah.
          </p>
          <input ref={inputRef} type="file" accept=".json,application/json" onChange={pick} aria-label="Pilih file backup" data-testid="restore-input" className="hidden" />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => inputRef.current?.click()}>Pilih File Backup</Button>
            {file && <span className="text-sm text-gray-600">{file.name} ({Math.max(1, Math.round(file.size / 1024))} KB)</span>}
          </div>
          <Button disabled={!file} onClick={() => setConfirming(true)}>Pulihkan</Button>
        </div>
      </Card>

      {confirming && file && (
        <Modal title="Pulihkan konfigurasi?" onClose={() => setConfirming(false)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Konfigurasi dari <strong>{file.name}</strong> akan diterapkan. Konfigurasi device dengan ID yang sama akan ditimpa.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setConfirming(false)}>Batal</Button>
              <Button loading={busy} onClick={() => void restore()}>Ya, Pulihkan</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
