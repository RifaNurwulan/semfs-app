
import { Globe, Save, Settings2 } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react'

import { getToken } from '../auth/tokenStorage'
import { Alert } from '../components/ui/alert'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { setLanguage, tr, useI18n } from '../lib/i18n'

const API_BASE: string =
  import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

const TIMEZONES = [
  { value: 'Asia/Jakarta', label: 'WIB (Asia/Jakarta)' },
  { value: 'Asia/Makassar', label: 'WITA (Asia/Makassar)' },
  { value: 'Asia/Jayapura', label: 'WIT (Asia/Jayapura)' },
  { value: 'UTC', label: 'UTC' },
]

const LANGUAGES = [
  { value: 'id', label: 'Bahasa Indonesia' },
  { value: 'en', label: 'English' },
] as const

type Lang = 'id' | 'en'

type SystemSettings = {
  timezone: string
  language: Lang
  updated_at: string
}

type UserInfo = {
  role?: string
}

async function request<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...init?.headers,
      },
    })
  } catch {
    throw new Error(tr('err.connect'))
  }

  if (!response.ok) {
    let detail = tr('err.request', {
      code: response.status,
    })

    try {
      const data = await response.json()

      if (typeof data?.detail === 'string') {
        detail = data.detail
      }
    } catch {
      // Gunakan pesan error default.
    }

    throw new Error(detail)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export default function SettingsPage() {
  const { t, lang } = useI18n()

  const [timezone, setTimezone] = useState('Asia/Jakarta')
  const [language, setLanguageValue] = useState<Lang>('id')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  const [canEdit, setCanEdit] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Simpan bahasa terakhir yang berhasil dimuat/disimpan.
  const [savedLanguage, setSavedLanguage] = useState<Lang>('id')

  // ==========================================
  // LOAD SETTINGS
  // ==========================================

  const load = useCallback(async () => {
    const token = getToken()

    if (!token) {
      t('err.noSession')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [settings, me] = await Promise.all([
        request<SystemSettings>(
          '/maintenance/settings',
          token,
        ),
        request<UserInfo>('/auth/me', token),
      ])

      const validLanguage: Lang =
        settings.language === 'en' ? 'en' : 'id'

      setTimezone(settings.timezone || 'Asia/Jakarta')
      setLanguageValue(validLanguage)
      setSavedLanguage(validLanguage)
      setUpdatedAt(settings.updated_at ?? null)
      setCanEdit(me.role === 'admin')

      // Terapkan bahasa dari server.
      setLanguage(validLanguage)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('err.load'),
      )
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  // ==========================================
  // LANGUAGE CHANGE
  // ==========================================

  function handleLanguageChange(value: string) {
    if (value !== 'id' && value !== 'en') return

    const nextLanguage = value as Lang

    setLanguageValue(nextLanguage)

    // Terapkan bahasa langsung tanpa menunggu Save.
    setLanguage(nextLanguage)

    setNotice(null)
    setError(null)
  }

  // ==========================================
  // SAVE SETTINGS
  // ==========================================

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canEdit || saving) return

    const token = getToken()

    if (!token) {
      t('err.noSession')
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      const result = await request<SystemSettings>(
        '/maintenance/settings',
        token,
        {
          method: 'PUT',
          body: JSON.stringify({
            timezone,
            language,
          }),
        },
      )

      const validLanguage: Lang =
        result.language === 'en' ? 'en' : 'id'

      setTimezone(result.timezone)
      setLanguageValue(validLanguage)
      setSavedLanguage(validLanguage)
      setUpdatedAt(result.updated_at ?? null)

      setLanguage(validLanguage)

      setNotice(tr('settings.saved'))
    } catch (err) {
      // Jika API gagal, kembalikan bahasa ke
      // pengaturan terakhir yang berhasil disimpan.
      setLanguageValue(savedLanguage)
      setLanguage(savedLanguage)

      setError(
        err instanceof Error
          ? err.message
          : t('err.save'),
      )
    } finally {
      setSaving(false)
    }
  }

  // ==========================================
  // STYLES
  // ==========================================

  const selectClass =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 ' +
    'focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 ' +
    'disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500'

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">

      {/* HEADER */}

      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
          <Settings2 className="size-5" aria-hidden />
        </span>

        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {t('settings.title')}
          </h1>

          <p className="text-sm text-slate-600">
            {t('settings.subtitle')}
          </p>
        </div>
      </div>

      {/* ALERT */}

      {error && (
        <Alert variant="error">
          {error}
        </Alert>
      )}

      {notice && (
        <Alert variant="success">
          {notice}
        </Alert>
      )}

      {!loading && !canEdit && !error && (
        <Alert variant="error">
          {t('settings.readOnly')}
        </Alert>
      )}

      {/* SETTINGS CARD */}

      <Card className="p-5 sm:p-6">

        {loading ? (
          <div className="py-4 text-sm text-slate-600">
            {t('settings.loading')}
          </div>
        ) : (
          <form
            onSubmit={save}
            className="space-y-5"
          >

            {/* SECTION HEADER */}

            <div className="flex items-center gap-2 text-slate-900">
              <Globe className="size-4" aria-hidden />

              <h2 className="font-semibold">
                {t('settings.section')}
              </h2>
            </div>

            {/* TIMEZONE */}

            <div className="space-y-1.5">
              <label
                htmlFor="timezone"
                className="text-sm font-medium text-slate-800"
              >
                {t('settings.timezone')}
              </label>

              <select
                id="timezone"
                name="timezone"
                className={selectClass}
                value={timezone}
                onChange={(event) =>
                  setTimezone(event.target.value)
                }
                disabled={!canEdit || saving}
              >
                {TIMEZONES.map((item) => (
                  <option
                    key={item.value}
                    value={item.value}
                  >
                    {item.label}
                  </option>
                ))}
              </select>

              <p className="text-xs text-slate-500">
                {t('settings.timezoneHint')}
              </p>
            </div>

            {/* LANGUAGE */}

            <div className="space-y-1.5">
              <label
                htmlFor="language"
                className="text-sm font-medium text-slate-800"
              >
                {t('settings.language')}
              </label>

              <select
                id="language"
                name="language"
                className={selectClass}
                value={language}
                onChange={(event) =>
                  handleLanguageChange(event.target.value)
                }
                disabled={!canEdit || saving}
              >
                {LANGUAGES.map((item) => (
                  <option
                    key={item.value}
                    value={item.value}
                  >
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            {/* FOOTER */}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">

              <p className="text-xs text-slate-500">
                {updatedAt
                  ? `${t('settings.lastChanged')}: ${new Date(
                      updatedAt,
                    ).toLocaleString(
                      lang === 'en' ? 'en-US' : 'id-ID',
                    )}`
                  : t('settings.neverChanged')}
              </p>

              {canEdit && (
                <Button
                  type="submit"
                  disabled={saving}
                >
                  <Save
                    className="size-4"
                    aria-hidden
                  />

                  {saving
                    ? t('settings.saving')
                    : t('settings.save')}
                </Button>
              )}
            </div>

          </form>
        )}

      </Card>
    </div>
  )
}
