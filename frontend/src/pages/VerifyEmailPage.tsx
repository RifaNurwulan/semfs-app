import { KeyRound, Mail } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthShell } from '../components/layout/AuthShell'
import { Alert } from '../components/ui/alert'
import { Button } from '../components/ui/button'
import { Field, Input } from '../components/ui/input'
import { api, ApiError } from '../lib/api'
import { useTranslation } from '../lib/i18n'
import { EMAIL_RE } from '../lib/validation'

const OTP_RE = /^\d{6}$/

export default function VerifyEmailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const state = location.state as { email?: string; notice?: string } | null

  const [email, setEmail] = useState(() => (state?.email ?? params.get('email') ?? '').trim())
  const [code, setCode] = useState('')
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(state?.notice ?? null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => setCooldown((value) => (value > 0 ? value - 1 : 0)), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const emailError = touched && !EMAIL_RE.test(email.trim()) ? t('Masukkan email yang valid') : null
  const codeError = touched && !OTP_RE.test(code) ? t('Kode OTP harus 6 digit angka') : null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    setError(null)
    if (!EMAIL_RE.test(email.trim()) || !OTP_RE.test(code)) return

    setSubmitting(true)
    try {
      const res = await api.verifyEmail(email.trim(), code)
      navigate('/login', { replace: true, state: { notice: t(res.message) } })
    } catch (err) {
      setError(err instanceof ApiError ? t(err.message) : t('Terjadi kesalahan. Coba lagi.'))
      setSubmitting(false)
    }
  }

  async function handleResend() {
    if (!EMAIL_RE.test(email.trim())) {
      setTouched(true)
      return
    }
    setResending(true)
    setError(null)
    try {
      const res = await api.resendVerification(email.trim())
      setNotice(t(res.message))
      setCooldown(60)
    } catch (err) {
      setError(err instanceof ApiError ? t(err.message) : t('Terjadi kesalahan. Coba lagi.'))
    } finally {
      setResending(false)
    }
  }

  return (
    <AuthShell title={t('Verifikasi Email')} subtitle={t('Masukkan kode OTP 6 digit yang kami kirim ke email Anda')}>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {error && <Alert variant="error">{error}</Alert>}
        {notice && !error && <Alert variant="success">{notice}</Alert>}
        <Field label={t('Email')} htmlFor="verify-email" error={emailError}>
          <Input
            id="verify-email"
            type="email"
            autoComplete="email"
            placeholder={t('nama@perusahaan.com')}
            icon={<Mail className="size-5" aria-hidden />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            invalid={!!emailError}
          />
        </Field>
        <Field label={t('Kode OTP')} htmlFor="verify-code" error={codeError} hint={t('Berlaku 10 menit')}>
          <Input
            id="verify-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            icon={<KeyRound className="size-5" aria-hidden />}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            invalid={!!codeError}
          />
        </Field>
        <Button type="submit" loading={submitting} className="w-full">
          {submitting ? t('Memverifikasi...') : t('Verifikasi Email')}
        </Button>
      </form>

      <div className="mt-5 space-y-3 text-center text-sm text-gray-600">
        <p>{t('Belum menerima kode?')}</p>
        <Button
          variant="outline"
          className="w-full"
          onClick={handleResend}
          loading={resending}
          disabled={cooldown > 0}
        >
          {cooldown > 0 ? `${t('Kirim ulang kode')} (${cooldown}s)` : t('Kirim ulang kode')}
        </Button>
        <p>
          <Link to="/login" className="font-medium text-emerald-600 hover:text-emerald-700">
            {t('Kembali ke halaman login')}
          </Link>
        </p>
      </div>
    </AuthShell>
  )
}
