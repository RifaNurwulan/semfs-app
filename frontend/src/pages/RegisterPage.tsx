import { Lock, Mail, UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthShell } from '../components/layout/AuthShell'
import { Alert } from '../components/ui/alert'
import { Button } from '../components/ui/button'
import { Field, Input } from '../components/ui/input'
import { api, ApiError } from '../lib/api'
import { EMAIL_RE, passwordError, USERNAME_RE } from '../lib/validation'

/** SRS use case "Register Akun": isi username, email, password -> sistem memvalidasi dan menyimpan. */
export default function RegisterPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const errors = {
    username: touched && !USERNAME_RE.test(username) ? 'Username 3-50 karakter: huruf, angka, titik, garis bawah, atau strip' : null,
    email: touched && !EMAIL_RE.test(email.trim()) ? 'Format email tidak valid' : null,
    password: touched ? passwordError(password) : null,
    confirm: touched && confirm !== password ? 'Konfirmasi password tidak sama' : null,
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    setError(null)
    if (!USERNAME_RE.test(username) || !EMAIL_RE.test(email.trim()) || passwordError(password) || confirm !== password) return

    setSubmitting(true)
    try {
      await api.register({ username, email: email.trim(), password })
      navigate('/login', { replace: true, state: { notice: 'Akun berhasil dibuat. Silakan login.' } })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Terjadi kesalahan. Coba lagi.')
      setSubmitting(false)
    }
  }

  return (
    <AuthShell title="Buat Akun" subtitle="Daftar untuk mendapat akses ke dashboard SEMFS">
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {error && <Alert variant="error">{error}</Alert>}
        <Field label="Username" htmlFor="reg-username" error={errors.username}>
          <Input id="reg-username" autoComplete="username" icon={<UserRound className="size-5" aria-hidden />} value={username} onChange={(e) => setUsername(e.target.value)} invalid={!!errors.username} />
        </Field>
        <Field label="Email" htmlFor="reg-email" error={errors.email}>
          <Input id="reg-email" type="email" autoComplete="email" placeholder="nama@perusahaan.com" icon={<Mail className="size-5" aria-hidden />} value={email} onChange={(e) => setEmail(e.target.value)} invalid={!!errors.email} />
        </Field>
        <Field label="Password" htmlFor="reg-password" error={errors.password} hint="Minimal 8 karakter">
          <Input id="reg-password" type="password" autoComplete="new-password" icon={<Lock className="size-5" aria-hidden />} value={password} onChange={(e) => setPassword(e.target.value)} invalid={!!errors.password} />
        </Field>
        <Field label="Konfirmasi password" htmlFor="reg-confirm" error={errors.confirm}>
          <Input id="reg-confirm" type="password" autoComplete="new-password" icon={<Lock className="size-5" aria-hidden />} value={confirm} onChange={(e) => setConfirm(e.target.value)} invalid={!!errors.confirm} />
        </Field>
        <Button type="submit" loading={submitting} className="w-full">
          {submitting ? 'Mendaftar...' : 'Daftar'}
        </Button>
        <p className="text-xs text-gray-500">Akun baru otomatis berperan Viewer. Admin dapat mengubah role Anda.</p>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        Sudah punya akun?{' '}
        <Link to="/login" className="font-medium text-emerald-600 hover:text-emerald-700">
          Masuk
        </Link>
      </p>
    </AuthShell>
  )
}
