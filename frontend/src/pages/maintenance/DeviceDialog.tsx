import { useState, type FormEvent } from 'react'
import { Alert } from '../../components/ui/alert'
import { Button } from '../../components/ui/button'
import { Field, Input } from '../../components/ui/input'
import { Modal } from '../../components/ui/modal'
import { getToken } from '../../auth/tokenStorage'
import { api, ApiError, type Device } from '../../lib/api'
import { isValidIp } from '../../lib/ip'

const intIn = (v: string, min: number, max: number) => /^\d+$/.test(v.trim()) && +v >= min && +v <= max

/** Tambah / ubah konfigurasi device: IP, port, Virtual ID, register, batas daya (SRS: Maintenance). */
export function DeviceDialog({ device, onClose, onSaved }: { device: Device | null; onClose: () => void; onSaved: () => void }) {
  const editing = device !== null
  const [deviceId, setDeviceId] = useState(device?.device_id ?? '')
  const [name, setName] = useState(device?.device_name ?? '')
  const [ip, setIp] = useState(device?.ip_address ?? '')
  const [port, setPort] = useState(String(device?.port ?? 502))
  const [unit, setUnit] = useState(String(device?.virtual_id ?? 1))
  const [reg, setReg] = useState(String(device?.register_address ?? 0))
  const [location, setLocation] = useState(device?.location ?? '')
  const [limit, setLimit] = useState(device?.power_limit_w != null ? String(device.power_limit_w) : '')
  const [enabled, setEnabled] = useState(device?.enabled ?? true)
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const limitOk = limit.trim() === '' || (Number.isFinite(+limit) && +limit > 0)
  const errors = {
    deviceId: touched && !editing && !/^[A-Za-z0-9_-]{2,50}$/.test(deviceId) ? 'Device ID 2-50 karakter: huruf, angka, strip, atau garis bawah' : null,
    ip: touched && !isValidIp(ip) ? 'Format IP Invalid' : null,
    port: touched && !intIn(port, 1, 65535) ? 'Port 1-65535' : null,
    unit: touched && !intIn(unit, 0, 247) ? 'Virtual ID 0-247' : null,
    reg: touched && !intIn(reg, 0, 65535) ? 'Alamat register 0-65535' : null,
    limit: touched && !limitOk ? 'Harus berupa angka lebih dari 0, atau kosongkan' : null,
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    setError(null)
    const token = getToken()
    const valid = (editing || /^[A-Za-z0-9_-]{2,50}$/.test(deviceId)) && isValidIp(ip) && intIn(port, 1, 65535) && intIn(unit, 0, 247) && intIn(reg, 0, 65535) && limitOk
    if (!token || !valid) return

    const payload = {
      device_name: name.trim() || null,
      ip_address: ip.trim(),
      port: +port,
      virtual_id: +unit,
      register_address: +reg,
      location: location.trim() || null,
      power_limit_w: limit.trim() === '' ? null : +limit,
      enabled,
    }
    setSaving(true)
    try {
      if (editing) await api.updateDevice(token, device.device_id, payload)
      else await api.createDevice(token, { device_id: deviceId.trim(), ...payload })
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Terjadi kesalahan. Coba lagi.')
      setSaving(false)
    }
  }

  return (
    <Modal title={editing ? `Ubah Device ${device.device_id}` : 'Tambah Device'} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Device ID" htmlFor="dev-id" error={errors.deviceId}>
            <Input id="dev-id" value={deviceId} onChange={(e) => setDeviceId(e.target.value)} disabled={editing} placeholder="PM-004" invalid={!!errors.deviceId} />
          </Field>
          <Field label="Nama perangkat" htmlFor="dev-name">
            <Input id="dev-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Power Meter Lantai 1" maxLength={100} />
          </Field>
          <Field label="IP Address" htmlFor="dev-ip" error={errors.ip}>
            <Input id="dev-ip" value={ip} onChange={(e) => setIp(e.target.value)} placeholder="192.168.1.101" invalid={!!errors.ip} />
          </Field>
          <Field label="Port" htmlFor="dev-port" error={errors.port}>
            <Input id="dev-port" inputMode="numeric" value={port} onChange={(e) => setPort(e.target.value)} invalid={!!errors.port} />
          </Field>
          <Field label="Virtual ID (Unit ID Modbus)" htmlFor="dev-unit" error={errors.unit}>
            <Input id="dev-unit" inputMode="numeric" value={unit} onChange={(e) => setUnit(e.target.value)} invalid={!!errors.unit} />
          </Field>
          <Field label="Alamat register pertama" htmlFor="dev-reg" error={errors.reg} hint="Arus, tegangan, daya dibaca berurutan dari alamat ini">
            <Input id="dev-reg" inputMode="numeric" value={reg} onChange={(e) => setReg(e.target.value)} invalid={!!errors.reg} />
          </Field>
          <Field label="Lokasi" htmlFor="dev-loc">
            <Input id="dev-loc" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={150} />
          </Field>
          <Field label="Batas daya (Watt)" htmlFor="dev-limit" error={errors.limit} hint="Kosongkan = tanpa notifikasi batas">
            <Input id="dev-limit" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="3000" invalid={!!errors.limit} />
          </Field>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-4 rounded border-gray-300 accent-emerald-600" />
          Aktif (dibaca oleh pembaca Modbus)
        </label>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" loading={saving}>
            {editing ? 'Simpan Perubahan' : 'Tambah Device'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
