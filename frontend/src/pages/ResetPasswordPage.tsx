import { Lock } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthShell } from '../components/layout/AuthShell'
import { Alert } from '../components/ui/alert'
import { Button } from '../components/ui/button'
import { Field, Input } from '../components/ui/input'
import { api, ApiError } from '../lib/api'
import { passwordError } from '../lib/validation'

/** SRS use case "Reset Password" langkah 5-6: pengguna membuat password baru dari tautan di email. */
export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  // Token disimpan di state lalu dihapus dari alamat browser (supaya tidak tertinggal di riwayat/bookmark)
  const [token] = useState(() => params.get('token'))
  useEffect(() => {
    if (params.get('token')) navigate('/reset-password', { replace: true })
  }, [params, navigate])

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const pwError = touched ? passwordError(password) : null
  const confirmError = touched && confirm !== password ? 'Konfirmasi password tidak sama' : null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    setError(null)
    if (!token || passwordError(password) || confirm !== password) return

    setSubmitting(true)
    try {
      await api.resetPassword(token, password)
      setDone(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Terjadi kesalahan. Coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  const requestNewLink = (
    <Link to="/lupa-password" className="font-medium text-emerald-600 hover:text-emerald-700">
      Minta tautan reset baru
    </Link>
  )

  return (
    <AuthShell title="Buat Password Baru" subtitle="Masukkan password baru untuk akun Anda">
      {done ? (
        <div className="space-y-5">
          <Alert variant="success">Password berhasil diganti. Silakan login dengan password baru.</Alert>
          <Link
            to="/login"
            className="flex h-12 w-full items-center justify-center rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 text-sm font-medium text-white shadow-lg shadow-emerald-600/20"
          >
            Ke halaman login
          </Link>
        </div>
      ) : !token ? (
        <div className="space-y-4">
          <Alert variant="error">Tautan reset tidak lengkap. Buka tautan langsung dari email Anda.</Alert>
          <p className="text-sm">{requestNewLink}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {error && (
            <div className="space-y-2">
              <Alert variant="error">{error}</Alert>
              {error.toLowerCase().includes('tautan') && <p className="text-sm">{requestNewLink}</p>}
            </div>
          )}
          <Field label="Password baru" htmlFor="new-password" error={pwError} hint="Minimal 8 karakter">
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              icon={<Lock className="size-5" aria-hidden />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              invalid={!!pwError}
            />
          </Field>
          <Field label="Konfirmasi password baru" htmlFor="confirm-password" error={confirmError}>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              icon={<Lock className="size-5" aria-hidden />}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              invalid={!!confirmError}
            />
          </Field>
          <Button type="submit" loading={submitting} className="w-full">
            {submitting ? 'Menyimpan...' : 'Simpan Password Baru'}
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
