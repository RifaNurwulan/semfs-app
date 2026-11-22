import { Clock3, Globe2, Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useUser } from '../auth/auth-context'
import { getToken } from '../auth/tokenStorage'
import { PageHeader } from '../components/layout/PageHeader'
import { Alert } from '../components/ui/alert'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { api, type SystemSettings } from '../lib/api'
import { applySystemLanguage, currentSystemLanguage, saveSystemLanguageSetting, useSettingsI18n } from '../lib/systemSettings'
import { setSystemTimezone } from '../lib/utils'

const TIMEZONES: SystemSettings['timezone'][] = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'UTC']

function validPollingInterval(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 3600
}

export default function SettingsPage() {
  const { t } = useSettingsI18n()
  const user = useUser()
  const canManage = user.role === 'admin'
  const [settings, setSettings] = useState<Pick<SystemSettings, 'timezone' | 'language' | 'poll_interval_seconds'> | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const token = getToken()
      if (!token) {
        setError('Sesi login tidak tersedia. Silakan login kembali.')
        setLoading(false)
        return
      }
      void api.systemSettings(token).then((value) => {
        if (!validPollingInterval(value.poll_interval_seconds)) {
          throw new Error('Backend API belum mendukung interval polling. Restart API dari folder backend.')
        }
        applySystemLanguage(value.language)
        setSettings({
          timezone: value.timezone,
          language: currentSystemLanguage(),
          poll_interval_seconds: value.poll_interval_seconds,
        })
        setSystemTimezone(value.timezone)
        setError(null)
      }).catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Gagal memuat pengaturan.')
      }).finally(() => setLoading(false))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  async function save() {
    const token = getToken()
    if (!token || !settings) return
    if (!validPollingInterval(settings.poll_interval_seconds)) {
      setError(t('Interval polling harus berupa bilangan bulat antara 1 dan 3600 detik.'))
      return
    }
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      const updated = await api.updateSystemSettings(token, settings)
      if (!validPollingInterval(updated.poll_interval_seconds)) {
        throw new Error('Backend API belum mendukung interval polling. Restart API dari folder backend.')
      }
      setSettings({
        timezone: updated.timezone,
        language: updated.language,
        poll_interval_seconds: updated.poll_interval_seconds,
      })
      setSystemTimezone(updated.timezone)
      saveSystemLanguageSetting(updated.language)
      setMessage('Pengaturan berhasil disimpan.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.')
    } finally {
      setSaving(false)
    }
  }

  const localTime = new Intl.DateTimeFormat(settings?.language === 'en' ? 'en-US' : 'id-ID', {
    dateStyle: 'full',
    timeStyle: 'medium',
    timeZone: settings?.timezone ?? 'Asia/Jakarta',
  }).format(now)

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader iconClassName="bg-purple-600" icon={Settings} title={t('Pengaturan Sistem')} subtitle={t('Konfigurasi zona waktu, bahasa, dan interval polling')} />
      <main className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_290px]">
          <section className="space-y-4">
            {error && <Alert variant="error">{t(error)}</Alert>}
            {message && <Alert variant="success">{t(message)}</Alert>}
            {loading ? <Card className="p-8 text-center text-sm text-slate-500">{t('Memuat pengaturan...')}</Card> : settings && (
              <>
                <Card className="p-4 sm:p-5">
                  <label htmlFor="settings-timezone" className="flex items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600"><Clock3 className="size-5" aria-hidden /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-slate-900">{t('Zona Waktu')}</span>
                      <span className="block text-xs text-slate-500">{settings.timezone} · {settings.timezone === 'UTC' ? t('Universal Time Coordinated') : t(`Waktu Indonesia ${settings.timezone === 'Asia/Jakarta' ? 'Barat (GMT+7)' : settings.timezone === 'Asia/Makassar' ? 'Tengah (GMT+8)' : 'Timur (GMT+9)'}`)}</span>
                    </span>
                    <select id="settings-timezone" value={settings.timezone} disabled={!canManage} onChange={(event) => setSettings({ ...settings, timezone: event.target.value as SystemSettings['timezone'] })} className="max-w-40 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-700 disabled:bg-slate-100">
                      {TIMEZONES.map((timezone) => <option key={timezone} value={timezone}>{timezone}</option>)}
                    </select>
                  </label>
                </Card>
                <Card className="p-4 sm:p-5">
                  <label htmlFor="settings-language" className="flex items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Globe2 className="size-5" aria-hidden /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-slate-900">{t('Bahasa')}</span>
                      <span className="block text-xs text-slate-500">{settings.language === 'id' ? 'ID · Bahasa Indonesia' : 'EN · English'}</span>
                    </span>
                    <select id="settings-language" value={settings.language} disabled={!canManage} onChange={(event) => {
                      const language = event.target.value as SystemSettings['language']
                      setSettings((current) => current ? { ...current, language } : current)
                      applySystemLanguage(language)
                    }} className="max-w-40 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-700 disabled:bg-slate-100">
                      <option value="id">{t('Bahasa Indonesia')}</option>
                      <option value="en">English</option>
                    </select>
                  </label>
                </Card>
                <Card className="p-4 sm:p-5">
                  <label htmlFor="settings-poll-interval" className="flex flex-wrap items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Clock3 className="size-5" aria-hidden /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-slate-900">{t('Interval Polling')}</span>
                      <span className="block text-xs text-slate-500">{t('Jeda pembacaan semua power meter. Perubahan berlaku otomatis setelah konfigurasi reader diperbarui.')}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <input id="settings-poll-interval" type="number" min={1} max={3600} step={1} required disabled={!canManage} value={settings.poll_interval_seconds} onChange={(event) => {
                        const value = Number(event.target.value)
                        setSettings((current) => current ? { ...current, poll_interval_seconds: value } : current)
                      }} className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 disabled:bg-slate-100" />
                      <span className="text-sm text-slate-500">{t('detik')}</span>
                    </span>
                  </label>
                </Card>
                {canManage ? <div className="flex justify-end"><Button onClick={() => void save()} loading={saving}>{t('Simpan Pengaturan')}</Button></div> : <Alert variant="info">{t('Hanya Admin yang dapat mengubah pengaturan sistem.')}</Alert>}
              </>
            )}
          </section>

          <aside>
            <Card className="p-4">
              <h2 className="text-sm font-medium text-slate-700">{t('Preview')}</h2>
              {settings ? (
                <div className="mt-3 space-y-3">
                  <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 text-purple-800">
                    <p className="flex items-center gap-2 text-xs font-medium"><Clock3 className="size-4" aria-hidden />{t('Waktu Saat Ini')}</p>
                    <p className="mt-3 text-sm">{localTime}</p>
                    <p className="mt-1 text-xs">{settings.timezone}</p>
                  </div>
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-indigo-800">
                    <p className="flex items-center gap-2 text-xs font-medium"><Globe2 className="size-4" aria-hidden />{t('Bahasa Aktif')}</p>
                    <p className="mt-3 text-sm">{settings.language === 'id' ? t('Bahasa Indonesia') : 'English'}</p>
                    <p className="mt-1 text-xs">{settings.language}</p>
                  </div>
                </div>
              ) : <p className="mt-3 text-sm text-slate-500">{t('Pratinjau tersedia setelah pengaturan dimuat.')}</p>}
            </Card>
          </aside>
        </div>
      </main>
    </div>
  )
}
