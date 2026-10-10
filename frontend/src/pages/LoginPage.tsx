import { Activity, Eye, EyeOff, Lock, Mail, TrendingUp, Zap } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { Alert } from '../components/ui/alert'
import { Button } from '../components/ui/button'
import { Field, Input } from '../components/ui/input'
import { ApiError } from '../lib/api'

const HIGHLIGHTS = [
  { icon: Activity, title: 'Real-time Monitoring', text: 'Pantau penggunaan energi listrik secara langsung' },
  { icon: TrendingUp, title: 'Forecasting Analytics', text: 'Prediksi tren konsumsi dengan AI dan machine learning' },
  { icon: Zap, title: 'Energy Optimization', text: 'Rekomendasi untuk efisiensi dan penghematan energi' },
]

const STATS = [
  { value: '99.9%', label: 'Uptime' },
  { value: '24/7', label: 'Monitoring' },
  { value: '95%', label: 'Akurasi' },
]

export default function LoginPage() {
  const { status, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  if (status === 'authenticated') return <Navigate to={from} replace />

  const identifierError = touched && !identifier.trim() ? 'Email atau username wajib diisi' : null
  const passwordError = touched && !password ? 'Password wajib diisi' : null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    setInfo(null)
    if (!identifier.trim() || !password) return

    setSubmitting(true)
    setError(null)
    try {
      await login(identifier.trim(), password, remember)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Terjadi kesalahan. Coba lagi.')
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Panel kiri: branding */}
      <aside className="relative hidden overflow-hidden bg-linear-to-br from-emerald-600 via-teal-600 to-cyan-700 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -left-10 top-40 size-56 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -bottom-10 right-10 size-72 rounded-full border border-white/10" />

        <div>
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-xl bg-white/20">
              <Zap className="size-6" aria-hidden />
            </span>
            <div>
              <p className="text-xl font-semibold leading-tight">SEMFS</p>
              <p className="text-sm text-white/80">Smart Energy Monitoring &amp; Forecasting System</p>
            </div>
          </div>

          <p className="mt-16 max-w-lg text-2xl font-medium leading-snug">
            Monitor konsumsi energi secara real-time dan prediksi kebutuhan masa depan dengan akurasi tinggi
          </p>

          <ul className="mt-12 space-y-6">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-center gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-white/80">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {STATS.map(({ value, label }) => (
            <div key={label} className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm">
              <p className="text-lg font-semibold">{value}</p>
              <p className="text-sm text-white/80">{label}</p>
            </div>
          ))}
        </div>
      </aside>

      {/* Panel kanan: form */}
      <main className="flex items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl shadow-gray-200/70">
          <h1 className="text-2xl font-semibold text-gray-900">Masuk ke Dashboard</h1>
          <p className="mt-1 text-gray-500">Akses sistem monitoring dan forecasting energi Anda</p>

          <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
            {error && <Alert variant="error">{error}</Alert>}
            {info && <Alert variant="info">{info}</Alert>}

            <Field label="Email atau Username" htmlFor="identifier" error={identifierError}>
              <Input
                id="identifier"
                name="username"
                autoComplete="username"
                placeholder="nama@perusahaan.com"
                icon={<Mail className="size-5" aria-hidden />}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                invalid={!!identifierError}
              />
            </Field>

            <Field label="Password" htmlFor="password" error={passwordError}>
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Masukkan password"
                icon={<Lock className="size-5" aria-hidden />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                invalid={!!passwordError}
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    className="flex size-9 items-center justify-center rounded-lg text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                }
              />
            </Field>

            <div className="flex items-center justify-between text-sm">
              <label className="flex cursor-pointer items-center gap-2 text-gray-700">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="size-4 rounded border-gray-300 accent-emerald-600"
                />
                Ingat saya
              </label>
              <button
                type="button"
                onClick={() =>
                  setInfo('Fitur reset password belum tersedia. Hubungi admin untuk mengatur ulang password.')
                }
                className="font-medium text-emerald-600 hover:text-emerald-700"
              >
                Lupa password?
              </button>
            </div>

            <Button type="submit" loading={submitting} className="w-full">
              {submitting ? 'Memproses...' : 'Masuk ke Dashboard'}
            </Button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <Lock className="size-4" aria-hidden />
            Sesi login diamankan dengan token JWT
          </div>

          <p className="mt-6 text-center text-sm text-gray-600">
            Butuh bantuan? <span className="font-medium text-emerald-600">Hubungi Support</span>
          </p>
        </div>
      </main>
    </div>
  )
}
