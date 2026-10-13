import { Mail, UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthShell } from '../components/layout/AuthShell'
import { Alert } from '../components/ui/alert'
import { Button } from '../components/ui/button'
import { Field, Input, Textarea } from '../components/ui/input'
import { api, ApiError } from '../lib/api'
import { EMAIL_RE } from '../lib/validation'

const MAX = 2000

/** "Hubungi Support": pesan disimpan dan diteruskan ke email tim support. Tidak perlu login. */
export default function SupportPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const errors = {
    name: touched && name.trim().length < 2 ? 'Nama minimal 2 karakter' : null,
    email: touched && !EMAIL_RE.test(email.trim()) ? 'Format email tidak valid' : null,
    message: touched && message.trim().length < 10 ? 'Pesan minimal 10 karakter' : null,
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    setError(null)
    if (name.trim().length < 2 || !EMAIL_RE.test(email.trim()) || message.trim().length < 10) return

    setSubmitting(true)
    try {
      const res = await api.sendSupport({ name: name.trim(), email: email.trim(), message: message.trim() })
      setDone(res.message)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Terjadi kesalahan. Coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell title="Hubungi Support" subtitle="Ceritakan kendala Anda, tim kami akan membalas lewat email">
      {done ? (
        <div className="space-y-5">
          <Alert variant="success">{done}</Alert>
          <Link
            to="/login"
            className="flex h-12 w-full items-center justify-center rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 text-sm font-medium text-white shadow-lg shadow-emerald-600/20"
          >
            Kembali ke halaman login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {error && <Alert variant="error">{error}</Alert>}
          <Field label="Nama" htmlFor="sup-name" error={errors.name}>
            <Input id="sup-name" autoComplete="name" icon={<UserRound className="size-5" aria-hidden />} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} invalid={!!errors.name} />
          </Field>
          <Field label="Email untuk balasan" htmlFor="sup-email" error={errors.email}>
            <Input id="sup-email" type="email" autoComplete="email" placeholder="nama@perusahaan.com" icon={<Mail className="size-5" aria-hidden />} value={email} onChange={(e) => setEmail(e.target.value)} invalid={!!errors.email} />
          </Field>
          <Field label="Pesan" htmlFor="sup-message" error={errors.message} hint={`${message.length}/${MAX} karakter`}>
            <Textarea id="sup-message" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={MAX} invalid={!!errors.message} />
          </Field>
          <Button type="submit" loading={submitting} className="w-full">
            {submitting ? 'Mengirim...' : 'Kirim Pesan'}
          </Button>
          <p className="text-center text-sm text-gray-600">
            <Link to="/login" className="font-medium text-emerald-600 hover:text-emerald-700">
              Kembali ke halaman login
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  )
}
