import { Lock, Mail, UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthShell } from '../components/layout/AuthShell'
import { Alert } from '../components/ui/alert'
import { Button } from '../components/ui/button'
import { Field, Input } from '../components/ui/input'
import { api, ApiError } from '../lib/api'
import { useTranslation } from '../lib/i18n'
import { EMAIL_RE, passwordError, USERNAME_RE } from '../lib/validation'


export default function RegisterPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const errors = {
    username: touched && !USERNAME_RE.test(username) ? t('Username 3-50 karakter: huruf, angka, titik, garis bawah, atau strip') : null,
    email: touched && !EMAIL_RE.test(email.trim()) ? t('Format email tidak valid') : null,
    password: touched ? passwordError(password) : null,
    confirm: touched && confirm !== password ? t('Konfirmasi password tidak sama') : null,
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    setError(null)
    if (!USERNAME_RE.test(username) || !EMAIL_RE.test(email.trim()) || passwordError(password) || confirm !== password) return

    setSubmitting(true)
    try {
      await api.register({ username, email: email.trim(), password })
      navigate('/verifikasi-email', {
        replace: true,
        state: {
          email: email.trim(),
          notice: t('Akun berhasil dibuat. Masukkan kode OTP yang dikirim ke email Anda.'),
        },
      })
    } catch (err) {
      setError(err instanceof ApiError ? t(err.message) : t('Terjadi kesalahan. Coba lagi.'))
      setSubmitting(false)
    }
  }

  return (
    <AuthShell title={t('Buat Akun')} subtitle={t('Daftar untuk mendapat akses ke dashboard SEMFS')}>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {error && <Alert variant="error">{error}</Alert>}
        <Field label={t('Username')} htmlFor="reg-username" error={errors.username}>
          <Input id="reg-username" autoComplete="username" icon={<UserRound className="size-5" aria-hidden />} value={username} onChange={(e) => setUsername(e.target.value)} invalid={!!errors.username} />
        </Field>
        <Field label={t('Email')} htmlFor="reg-email" error={errors.email}>
          <Input id="reg-email" type="email" autoComplete="email" placeholder={t('nama@perusahaan.com')} icon={<Mail className="size-5" aria-hidden />} value={email} onChange={(e) => setEmail(e.target.value)} invalid={!!errors.email} />
        </Field>
        <Field label={t('Password')} htmlFor="reg-password" error={errors.password} hint={t('Minimal 8 karakter')}>
          <Input id="reg-password" type="password" autoComplete="new-password" icon={<Lock className="size-5" aria-hidden />} value={password} onChange={(e) => setPassword(e.target.value)} invalid={!!errors.password} />
        </Field>
        <Field label={t('Konfirmasi password')} htmlFor="reg-confirm" error={errors.confirm}>
          <Input id="reg-confirm" type="password" autoComplete="new-password" icon={<Lock className="size-5" aria-hidden />} value={confirm} onChange={(e) => setConfirm(e.target.value)} invalid={!!errors.confirm} />
        </Field>
        <Button type="submit" loading={submitting} className="w-full">
          {submitting ? t('Mendaftar...') : t('Daftar')}
        </Button>
        <p className="text-xs text-gray-500">{t('Akun baru otomatis berperan Viewer. Admin dapat mengubah role Anda.')}</p>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        {t('Sudah punya akun?')}{' '}
        <Link to="/login" className="font-medium text-emerald-600 hover:text-emerald-700">
          {t('Masuk')}
        </Link>
      </p>
    </AuthShell>
  )
}
