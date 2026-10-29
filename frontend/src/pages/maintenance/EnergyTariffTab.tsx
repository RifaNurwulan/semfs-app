import { BadgeDollarSign, Save } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { getToken } from '../../auth/tokenStorage'
import { Alert } from '../../components/ui/alert'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { api } from '../../lib/api'

const currency = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 2,
})

export function EnergyTariffTab() {
  const [priceInput, setPriceInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadTariff = useCallback(async () => {
    const token = getToken()
    if (!token) {
      setError('Sesi login tidak tersedia. Silakan login kembali.')
      setLoading(false)
      return
    }

    try {
      const result = await api.energyTariff(token)
      setPriceInput(String(result.price_per_kwh))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat tarif energi.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadTariff(), 0)
    return () => window.clearTimeout(timer)
  }, [loadTariff])

  async function saveTariff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedPrice = priceInput.trim()
    if (!/^\d+(\.\d{1,2})?$/.test(normalizedPrice)) {
      setError('Masukkan tarif berupa angka non-negatif dengan maksimal 2 angka desimal.')
      setNotice(null)
      return
    }

    const price = Number(normalizedPrice)
    if (!Number.isFinite(price)) {
      setError('Tarif yang dimasukkan tidak valid.')
      setNotice(null)
      return
    }

    const token = getToken()
    if (!token) {
      setError('Sesi login tidak tersedia. Silakan login kembali.')
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const result = await api.updateEnergyTariff(token, price)
      setPriceInput(String(result.price_per_kwh))
      setNotice(`Tarif berhasil disimpan: ${currency.format(result.price_per_kwh)} per kWh.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan tarif energi.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}
      <Card className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <BadgeDollarSign className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-semibold text-gray-900">Tarif listrik per kWh</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              Tarif ini digunakan untuk menghitung estimasi biaya energi pada halaman Monitoring Energy.
              Perhitungan biaya mengikuti konsumsi kWh pada periode yang dipilih.
            </p>
          </div>
        </div>

        <form className="mt-6 space-y-4" onSubmit={(event) => void saveTariff(event)}>
          <div className="max-w-md">
            <label htmlFor="energy-tariff" className="mb-1.5 block text-sm font-medium text-gray-700">
              Harga per kWh (Rp)
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-500">Rp</span>
              <input
                id="energy-tariff"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                required
                value={priceInput}
                onChange={(event) => setPriceInput(event.target.value)}
                disabled={loading || saving}
                className="h-11 w-full rounded-xl border border-gray-300 bg-white pl-10 pr-3 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-gray-50"
                placeholder="Contoh: 1444.70"
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
              {loading ? 'Memuat tarif saat ini...' : `Tarif saat ini: ${currency.format(Number(priceInput) || 0)} / kWh`}
            </p>
          </div>
          <Button type="submit" disabled={loading || saving}>
            <Save className="size-4" aria-hidden />
            {saving ? 'Menyimpan...' : 'Simpan tarif'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
