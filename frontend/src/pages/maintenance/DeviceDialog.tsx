import { useState, type FormEvent } from 'react'
import { Alert } from '../../components/ui/alert'
import { Button } from '../../components/ui/button'
import { Field, Input } from '../../components/ui/input'
import { Modal } from '../../components/ui/modal'
import { getToken } from '../../auth/tokenStorage'
import { api, ApiError, type Device, type MeterRegister, type ModbusDataType, type ModbusRegisterType } from '../../lib/api'
import { isValidIp } from '../../lib/ip'

const intIn = (v: string, min: number, max: number) => /^\d+$/.test(v.trim()) && +v >= min && +v <= max
const validUnitId = (v: string) => intIn(v, 1, 247) || v.trim() === '255'
const DEFAULT_PARAMETERS = [
  { key: 'v_r_v', parameter: 'V_R (V_L1)', unit: 'V' },
  { key: 'v_s_v', parameter: 'V_S (V_L2)', unit: 'V' },
  { key: 'v_t_v', parameter: 'V_T (V_L3)', unit: 'V' },
  { key: 'v_rn_v', parameter: 'V_RN (V_L1N)', unit: 'V' },
  { key: 'v_sn_v', parameter: 'V_SN (V_L2N)', unit: 'V' },
  { key: 'v_tn_v', parameter: 'V_TN (V_L3N)', unit: 'V' },
  { key: 'i_r_a', parameter: 'I_R (I_L1)', unit: 'A' },
  { key: 'i_s_a', parameter: 'I_S (I_L2)', unit: 'A' },
  { key: 'i_t_a', parameter: 'I_T (I_L3)', unit: 'A' },
  { key: 'i_n_a', parameter: 'I_N', unit: 'A' },
  { key: 'p_total_kw', parameter: 'P_Total (kW_Total)', unit: 'kW' },
  { key: 'q_total_kvar', parameter: 'Q_Total (kVAR_Total)', unit: 'kVAR' },
  { key: 's_total_kva', parameter: 'S_Total (kVA_Total)', unit: 'kVA' },
  { key: 'power_factor', parameter: 'PF (Power_Factor)', unit: '-' },
  { key: 'frequency_hz', parameter: 'Freq (Frequency)', unit: 'Hz' },
  { key: 'kwh_del', parameter: 'kWh_Del (E_Act_Del / Import)', unit: 'kWh' },
  { key: 'kwh_rec', parameter: 'kWh_Rec (E_Act_Rec / Export)', unit: 'kWh' },
  { key: 'kvarh_del', parameter: 'kVARh_Del (E_React_Del)', unit: 'kVARh' },
  { key: 'kvarh_rec', parameter: 'kVARh_Rec (E_React_Rec)', unit: 'kVARh' },
  { key: 'kvah_del', parameter: 'kVAh_Del (E_App_Del)', unit: 'kVAh' },
] as const

const DATA_TYPE_LENGTH: Record<ModbusDataType, number> = {
  int16: 1,
  uint16: 1,
  int32: 2,
  uint32: 2,
  float32: 2,
  float64: 4,
}

const DATA_TYPES: ModbusDataType[] = ['int16', 'uint16', 'int32', 'uint32', 'float32', 'float64']
const REGISTER_TYPES: ModbusRegisterType[] = ['holding', 'input']

function defaultRegisterConfig(): MeterRegister[] {
  return DEFAULT_PARAMETERS.map((parameter, index) => ({
    ...parameter,
    register_type: 'holding',
    address: index * 2,
    data_type: 'float32',
  }))
}

function hasValidRegisterConfig(registerConfig: MeterRegister[]): boolean {
  if (registerConfig.length < 1 || registerConfig.length > 100) return false
  const keys = new Set<string>()
  for (const register of registerConfig) {
    if (!register.key || keys.has(register.key) || !register.parameter.trim() || register.unit.length > 30) return false
    const length = DATA_TYPE_LENGTH[register.data_type]
    if (!intIn(String(register.address), 0, 65535) || register.address + length > 65536) return false
    keys.add(register.key)
  }
  for (const registerType of REGISTER_TYPES) {
    const sorted = registerConfig
      .filter((register) => register.register_type === registerType)
      .sort((a, b) => a.address - b.address)
    if (sorted.some((register, index) =>
      index > 0 && register.address < sorted[index - 1].address + DATA_TYPE_LENGTH[sorted[index - 1].data_type],
    )) return false
  }
  return true
}

/** Tambah / ubah konfigurasi device: IP, port, Virtual ID, register, batas daya (SRS: Maintenance). */
export function DeviceDialog({ device, onClose, onSaved }: { device: Device | null; onClose: () => void; onSaved: () => void }) {
  const editing = device !== null
  const [deviceId, setDeviceId] = useState(device?.device_id ?? '')
  const [name, setName] = useState(device?.device_name ?? '')
  const [ip, setIp] = useState(device?.ip_address ?? '')
  const [port, setPort] = useState(String(device?.port ?? 502))
  const [unit, setUnit] = useState(String(device?.virtual_id ?? 1))
  const [registerConfig, setRegisterConfig] = useState<MeterRegister[]>(
    () => device?.register_config?.map((item) => ({ ...item })) ?? defaultRegisterConfig(),
  )
  const [location, setLocation] = useState(device?.location ?? '')
  const [limit, setLimit] = useState(device?.power_limit_w != null ? String(device.power_limit_w) : '')
  const [enabled, setEnabled] = useState(device?.enabled ?? true)
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const limitOk = limit.trim() === '' || (Number.isFinite(+limit) && +limit > 0)
  const registerConfigValid = hasValidRegisterConfig(registerConfig)
  const errors = {
    deviceId: touched && !editing && !/^[A-Za-z0-9_-]{2,50}$/.test(deviceId) ? 'Device ID 2-50 karakter: huruf, angka, strip, atau garis bawah' : null,
    ip: touched && !isValidIp(ip) ? 'Format IP Invalid' : null,
    port: touched && !intIn(port, 1, 65535) ? 'Port 1-65535' : null,
    unit: touched && !validUnitId(unit) ? 'Virtual ID 1-247, atau 255 untuk server TCP langsung (0 dan 248-254 dicadangkan)' : null,
    registerConfig: !registerConfigValid,
    limit: touched && !limitOk ? 'Harus berupa angka lebih dari 0, atau kosongkan' : null,
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    setError(null)
    const token = getToken()
    const valid = (editing || /^[A-Za-z0-9_-]{2,50}$/.test(deviceId)) && isValidIp(ip) && intIn(port, 1, 65535) && validUnitId(unit) && registerConfigValid && limitOk
    if (!token || !valid) return

    const payload = {
      device_name: name.trim() || null,
      ip_address: ip.trim(),
      port: +port,
      virtual_id: +unit,
      register_config: registerConfig,
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
          <Field label="IP Address" htmlFor="dev-ip" error={errors.ip} hint="IP sama boleh dipakai beberapa device. localhost menunjuk ke komputer tempat reader Modbus berjalan.">
            <Input id="dev-ip" value={ip} onChange={(e) => setIp(e.target.value)} placeholder="localhost atau 192.168.1.101" invalid={!!errors.ip} />
          </Field>
          <Field label="Port" htmlFor="dev-port" error={errors.port} hint="Port standar Modbus TCP: 502">
            <Input id="dev-port" inputMode="numeric" value={port} onChange={(e) => setPort(e.target.value)} invalid={!!errors.port} />
          </Field>
          <Field label="Virtual ID (Unit ID Modbus)" htmlFor="dev-unit" error={errors.unit} hint="ID 1-247 untuk meter/gateway; 255 untuk server TCP langsung. Jika IP dan port sama, gunakan ID berbeda.">
            <Input id="dev-unit" inputMode="numeric" value={unit} onChange={(e) => setUnit(e.target.value)} invalid={!!errors.unit} />
          </Field>
          <Field label="Lokasi" htmlFor="dev-loc">
            <Input id="dev-loc" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={150} />
          </Field>
          <Field label="Batas daya (Watt)" htmlFor="dev-limit" error={errors.limit} hint="Kosongkan = tanpa notifikasi batas">
            <Input id="dev-limit" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="3000" invalid={!!errors.limit} />
          </Field>
        </div>
        <section className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
            <h3 className="text-sm font-semibold text-gray-900">Konfigurasi parameter Modbus</h3>
            <p className="mt-1 text-xs text-gray-500">Isi nama parameter, satuan, jenis register, format data, dan alamat awal PDU 0-based sesuai manual meter. Panjang register mengikuti format data; byte order big-endian.</p>
            {touched && errors.registerConfig && <p className="mt-1 text-xs text-rose-600">Periksa konfigurasi parameter, jenis register, format data, panjang, dan alamat.</p>}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRegisterConfig((current) => [...current, {
                key: `custom_${Date.now()}_${current.length}`,
                parameter: '',
                unit: '',
                register_type: 'holding',
                address: 0,
                data_type: 'float32',
              }])}
            >
              Tambah Parameter
            </Button>
          </div>
          <div className="max-h-72 overflow-auto rounded-lg border border-gray-200">
            <table className="w-full min-w-[70rem] text-left text-sm">
              <thead className="sticky top-0 bg-gray-50 text-xs text-gray-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Parameter</th>
                  <th className="px-3 py-2 font-medium">Satuan</th>
                  <th className="px-3 py-2 font-medium">Jenis register</th>
                  <th className="px-3 py-2 font-medium">Format data</th>
                  <th className="px-3 py-2 font-medium">Panjang (register)</th>
                  <th className="px-3 py-2 font-medium">Alamat awal</th>
                  <th className="px-3 py-2 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {registerConfig.map((register, index) => {
                  const address = register.address >= 0 ? String(register.address) : ''
                  return (
                    <tr key={register.key}>
                      <td className="px-3 py-2">
                        <Input
                          aria-label={`Parameter ${index + 1}`}
                          value={register.parameter}
                          maxLength={100}
                          onChange={(event) => setRegisterConfig((current) => current.map((item) =>
                            item.key === register.key ? { ...item, parameter: event.target.value } : item,
                          ))}
                          className="h-9 min-w-48"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          aria-label={`Satuan ${register.parameter || index + 1}`}
                          value={register.unit}
                          maxLength={30}
                          onChange={(event) => setRegisterConfig((current) => current.map((item) =>
                            item.key === register.key ? { ...item, unit: event.target.value } : item,
                          ))}
                          className="h-9 w-24"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          aria-label={`Jenis register ${register.parameter || index + 1}`}
                          value={register.register_type}
                          onChange={(event) => setRegisterConfig((current) => current.map((item) =>
                            item.key === register.key ? { ...item, register_type: event.target.value as ModbusRegisterType } : item,
                          ))}
                          className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm"
                        >
                          <option value="holding">Holding Register</option>
                          <option value="input">Input Register</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          aria-label={`Format data ${register.parameter || index + 1}`}
                          value={register.data_type}
                          onChange={(event) => setRegisterConfig((current) => current.map((item) =>
                            item.key === register.key ? { ...item, data_type: event.target.value as ModbusDataType } : item,
                          ))}
                          className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm"
                        >
                          {DATA_TYPES.map((dataType) => <option key={dataType} value={dataType}>{dataType}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-gray-600">{DATA_TYPE_LENGTH[register.data_type]}</td>
                      <td className="px-3 py-2">
                        <Input
                          aria-label={`Alamat register ${register.parameter || index + 1}`}
                          inputMode="numeric"
                          value={address}
                          onChange={(event) => setRegisterConfig((current) => current.map((item) =>
                            item.key === register.key
                              ? { ...item, address: event.target.value === '' ? -1 : Number(event.target.value) }
                              : item,
                          ))}
                          className="h-9 max-w-36"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          aria-label={`Hapus parameter ${register.parameter || index + 1}`}
                          onClick={() => setRegisterConfig((current) => current.filter((item) => item.key !== register.key))}
                          className="rounded px-2 py-1 text-rose-600 hover:bg-rose-50"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
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
