import { Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthShell } from '../components/layout/AuthShell'
import { Alert } from '../components/ui/alert'
import { Button } from '../components/ui/button'
import { Field, Input } from '../components/ui/input'
import { api, ApiError } from '../lib/api'
import { EMAIL_RE } from '../lib/validation'

/** SRS use case "Reset Password" langkah 1-4: pengguna memasukkan email, sistem mengirim tautan reset. */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doneMessage, setDoneMessage] = useState<string | null>(null)

  const emailError = touched && !EMAIL_RE.test(email.trim()) ? 'Masukkan email yang valid' : null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    setError(null)
    if (!EMAIL_RE.test(email.trim())) return

    setSubmitting(true)
    try {
      const res = await api.forgotPassword(email.trim())
      setDoneMessage(res.message)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Terjadi kesalahan. Coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell title="Lupa Password" subtitle="Masukkan email akun Anda, kami kirimkan tautan untuk membuat password baru">
      {doneMessage ? (
        <div className="space-y-5">
          <Alert variant="success">{doneMessage}</Alert>
          <p className="text-sm text-gray-600">
            Periksa kotak masuk (dan folder spam) email Anda. Tautan hanya berlaku sementara dan hanya bisa dipakai satu kali.
          </p>
          <Button variant="outline" className="w-full" onClick={() => setDoneMessage(null)}>
            Kirim ulang tautan
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {error && <Alert variant="error">{error}</Alert>}
          <Field label="Email" htmlFor="email" error={emailError}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="nama@perusahaan.com"
              icon={<Mail className="size-5" aria-hidden />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              invalid={!!emailError}
            />
          </Field>
          <Button type="submit" loading={submitting} className="w-full">
            {submitting ? 'Mengirim...' : 'Kirim Tautan Reset'}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-gray-600">
        <Link to="/login" className="font-medium text-emerald-600 hover:text-emerald-700">
          Kembali ke halaman login
        </Link>
      </p>
    </AuthShell>
  )
}
