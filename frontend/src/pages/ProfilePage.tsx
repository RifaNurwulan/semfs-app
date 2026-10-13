import { Camera, KeyRound, UserCog, UserRound } from 'lucide-react'
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useAuth, useUser } from '../auth/auth-context'
import { PageHeader } from '../components/layout/PageHeader'
import { Alert } from '../components/ui/alert'
import { Avatar } from '../components/ui/avatar'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardHeading } from '../components/ui/card'
import { Field, Input } from '../components/ui/input'
import { ApiError } from '../lib/api'
import { ROLE_LABEL } from '../lib/features'
import { AVATAR_ACCEPT, squareAvatarBlob } from '../lib/image'
import { EMAIL_RE, passwordError, USERNAME_RE } from '../lib/validation'
import { formatDate } from '../lib/utils'

export default function ProfilePage() {
  return (
    <div className="min-h-screen">
      <PageHeader
        icon={UserCog}
        iconClassName="bg-emerald-600"
        title="Edit Profil"
        subtitle="Kelola informasi akun dan keamanan Anda"
      />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        <AvatarCard />
        <AccountCard />
        <PasswordCard />
      </main>
    </div>
  )
}

function messageOf(err: unknown) {
  return err instanceof ApiError ? err.message : 'Terjadi kesalahan. Coba lagi.'
}

function AvatarCard() {
  const user = useUser()
  const { uploadAvatar, removeAvatar } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function run(action: () => Promise<unknown>, doneMessage: string) {
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await action()
      setSuccess(doneMessage)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  function handlePick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // supaya foto yang sama bisa dipilih ulang
    if (!file) return
    void run(async () => uploadAvatar(await squareAvatarBlob(file)), 'Foto profil berhasil diperbarui.')
  }

  return (
    <Card className="p-6">
      <CardHeading icon={<Camera className="size-5" />} title="Foto Profil" description="Tampil di pojok kanan atas dan menu akun" />

      <div className="mt-6 space-y-5">
        {error && <Alert variant="error">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        <div className="flex flex-wrap items-center gap-5">
          <Avatar user={user} size="lg" />
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <input
                ref={inputRef}
                type="file"
                accept={AVATAR_ACCEPT}
                onChange={handlePick}
                aria-label="Pilih file foto profil"
                data-testid="avatar-input"
                className="hidden"
              />
              <Button variant="outline" size="sm" loading={busy} onClick={() => inputRef.current?.click()}>
                {user.has_avatar ? 'Ganti Foto' : 'Pilih Foto'}
              </Button>
              {user.has_avatar && (
                <Button variant="danger" size="sm" disabled={busy} onClick={() => void run(removeAvatar, 'Foto profil dihapus.')}>
                  Hapus Foto
                </Button>
              )}
            </div>
            <p className="text-xs text-gray-500">JPG, PNG, atau WebP. Foto dipotong persegi dan diperkecil otomatis.</p>
          </div>
        </div>
      </div>
    </Card>
  )
}

function AccountCard() {
  const user = useUser()
  const { updateProfile } = useAuth()
  const [username, setUsername] = useState(user.username)
  const [email, setEmail] = useState(user.email)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [touched, setTouched] = useState(false)

  const usernameError = touched && !USERNAME_RE.test(username) ? 'Username 3-50 karakter: huruf, angka, titik, garis bawah, atau strip' : null
  const emailError = touched && !EMAIL_RE.test(email) ? 'Format email tidak valid' : null
  const changed = username !== user.username || email.toLowerCase() !== user.email

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    setSuccess(false)
    setError(null)
    if (!USERNAME_RE.test(username) || !EMAIL_RE.test(email)) return

    setSaving(true)
    try {
      const updated = await updateProfile({ username, email })
      setUsername(updated.username)
      setEmail(updated.email)
      setSuccess(true)
      setTouched(false)
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-6">
      <CardHeading icon={<UserRound className="size-5" />} title="Informasi Akun" description="Username dan email untuk login" />

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
        {error && <Alert variant="error">{error}</Alert>}
        {success && <Alert variant="success">Profil berhasil diperbarui.</Alert>}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Username" htmlFor="username" error={usernameError}>
            <Input id="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} invalid={!!usernameError} />
          </Field>
          <Field label="Email" htmlFor="email" error={emailError}>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} invalid={!!emailError} />
          </Field>
        </div>

        <dl className="flex flex-wrap gap-x-10 gap-y-3 rounded-xl bg-gray-50 px-4 py-3 text-sm">
          <div>
            <dt className="text-gray-500">Role</dt>
            <dd className="mt-1">
              <Badge tone="green">{ROLE_LABEL[user.role]}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Terdaftar sejak</dt>
            <dd className="mt-1 font-medium text-gray-900">{formatDate(user.created_at)}</dd>
          </div>
        </dl>
        <p className="text-xs text-gray-500">Role hanya dapat diubah oleh admin.</p>

        <div className="flex justify-end">
          <Button type="submit" loading={saving} disabled={!changed}>
            Simpan Perubahan
          </Button>
        </div>
      </form>
    </Card>
  )
}

function PasswordCard() {
  const { updateProfile } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [touched, setTouched] = useState(false)

  const currentError = touched && !current ? 'Password saat ini wajib diisi' : null
  const nextError = touched ? passwordError(next) ?? (next === current ? 'Password baru harus berbeda dari yang lama' : null) : null
  const confirmError = touched && confirm !== next ? 'Konfirmasi password tidak sama' : null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    setSuccess(false)
    setError(null)
    if (!current || passwordError(next) || next === current || confirm !== next) return

    setSaving(true)
    try {
      await updateProfile({ current_password: current, new_password: next })
      setCurrent('')
      setNext('')
      setConfirm('')
      setTouched(false)
      setSuccess(true)
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-6">
      <CardHeading icon={<KeyRound className="size-5" />} title="Ganti Password" description="Gunakan password yang kuat dan belum pernah dipakai" />

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
        {error && <Alert variant="error">{error}</Alert>}
        {success && <Alert variant="success">Password berhasil diganti.</Alert>}

        <Field label="Password saat ini" htmlFor="current-password" error={currentError}>
          <Input id="current-password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} invalid={!!currentError} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Password baru" htmlFor="new-password" error={nextError} hint="Minimal 8 karakter">
            <Input id="new-password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} invalid={!!nextError} />
          </Field>
          <Field label="Konfirmasi password baru" htmlFor="confirm-password" error={confirmError}>
            <Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} invalid={!!confirmError} />
          </Field>
        </div>

        <div className="flex justify-end">
          <Button type="submit" loading={saving}>
            Ganti Password
          </Button>
        </div>
      </form>
    </Card>
  )
}
