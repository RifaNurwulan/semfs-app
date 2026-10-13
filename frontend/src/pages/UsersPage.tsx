import { LifeBuoy, ShieldCheck, UserPlus, Users } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useUser } from '../auth/auth-context'
import { getToken } from '../auth/tokenStorage'
import { PageHeader } from '../components/layout/PageHeader'
import { Alert } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardHeading } from '../components/ui/card'
import { Field, Input } from '../components/ui/input'
import { api, ApiError, type Role, type SupportRequest, type User } from '../lib/api'
import { getFeature, ROLE_LABEL } from '../lib/features'
import { formatDate, formatRelative } from '../lib/utils'
import { EMAIL_RE, passwordError, USERNAME_RE } from '../lib/validation'

const ROLES: Role[] = ['admin', 'operator', 'viewer']
const selectClass =
  'h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 disabled:bg-gray-50 disabled:text-gray-400'

const msg = (err: unknown) => (err instanceof ApiError ? err.message : 'Terjadi kesalahan. Coba lagi.')

/** Khusus admin: ubah role pengguna, tambah akun, dan baca pesan "Hubungi Support". */
export default function UsersPage() {
  const f = getFeature('pengguna')
  const [users, setUsers] = useState<User[] | null>(null)
  const [support, setSupport] = useState<SupportRequest[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    const token = getToken()
    if (!token) return
    let active = true
    Promise.all([api.listUsers(token), api.listSupport(token)])
      .then(([u, s]) => {
        if (!active) return
        setUsers(u)
        setSupport(s)
      })
      .catch((err) => active && setLoadError(msg(err)))
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="min-h-screen">
      <PageHeader icon={f.icon} iconClassName={f.headerIconBg} title={f.title} subtitle={f.subtitle} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        {loadError && <Alert variant="error">{loadError}</Alert>}
        <UsersCard users={users} setUsers={setUsers} />
        <AddUserCard onCreated={(u) => setUsers((list) => (list ? [...list, u] : [u]))} />
        <SupportCard items={support} setItems={setSupport} />
      </main>
    </div>
  )
}

function UsersCard({ users, setUsers }: { users: User[] | null; setUsers: (u: User[]) => void }) {
  const me = useUser()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)

  async function changeRole(target: User, role: Role) {
    const token = getToken()
    if (!token || role === target.role || !users) return
    setSavingId(target.id)
    setError(null)
    setSuccess(null)
    try {
      const updated = await api.changeRole(token, target.id, role)
      setUsers(users.map((u) => (u.id === updated.id ? updated : u)))
      setSuccess(`Role ${updated.username} diubah menjadi ${ROLE_LABEL[updated.role]}.`)
    } catch (err) {
      setError(msg(err))
    } finally {
      setSavingId(null)
    }
  }

  return (
    <Card className="p-6">
      <CardHeading icon={<Users className="size-5" />} title="Daftar Pengguna" description="Ubah role untuk mengatur hak akses tiap pengguna" />
      <div className="mt-5 space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}
        {users === null ? (
          <p className="py-6 text-center text-sm text-gray-500">Memuat pengguna...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 text-gray-500">
                <tr>
                  <th className="py-3 pr-4 font-medium">Pengguna</th>
                  <th className="py-3 pr-4 font-medium">Role</th>
                  <th className="py-3 font-medium">Terdaftar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="py-3 pr-4">
                      <p className="font-medium text-gray-900">
                        {u.username} {u.id === me.id && <Badge tone="green">Anda</Badge>}
                      </p>
                      <p className="text-gray-500">{u.email}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <select
                        aria-label={`Role untuk ${u.username}`}
                        className={selectClass}
                        value={u.role}
                        disabled={u.id === me.id || savingId === u.id}
                        title={u.id === me.id ? 'Tidak bisa mengubah role akun sendiri' : undefined}
                        onChange={(e) => void changeRole(u, e.target.value as Role)}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 text-gray-600">{formatDate(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  )
}

function AddUserCard({ onCreated }: { onCreated: (u: User) => void }) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('viewer')
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const errors = {
    username: touched && !USERNAME_RE.test(username) ? 'Username 3-50 karakter: huruf, angka, titik, garis bawah, atau strip' : null,
    email: touched && !EMAIL_RE.test(email.trim()) ? 'Format email tidak valid' : null,
    password: touched ? passwordError(password) : null,
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    setError(null)
    setSuccess(null)
    const token = getToken()
    if (!token || !USERNAME_RE.test(username) || !EMAIL_RE.test(email.trim()) || passwordError(password)) return

    setSaving(true)
    try {
      const created = await api.createUser(token, { username, email: email.trim(), password, role })
      onCreated(created)
      setSuccess(`Akun ${created.username} dibuat dengan role ${ROLE_LABEL[created.role]}.`)
      setUsername('')
      setEmail('')
      setPassword('')
      setRole('viewer')
      setTouched(false)
    } catch (err) {
      setError(msg(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-6">
      <CardHeading icon={<UserPlus className="size-5" />} title="Tambah Pengguna" description="Buat akun baru sekaligus menentukan role-nya" />
      <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-5">
        {error && <Alert variant="error">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Username" htmlFor="add-username" error={errors.username}>
            <Input id="add-username" value={username} onChange={(e) => setUsername(e.target.value)} invalid={!!errors.username} />
          </Field>
          <Field label="Email" htmlFor="add-email" error={errors.email}>
            <Input id="add-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} invalid={!!errors.email} />
          </Field>
          <Field label="Password awal" htmlFor="add-password" error={errors.password} hint="Minimal 8 karakter">
            <Input id="add-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} invalid={!!errors.password} />
          </Field>
          <Field label="Role" htmlFor="add-role">
            <select id="add-role" className={`${selectClass} h-12 w-full`} value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={saving}>
            Buat Akun
          </Button>
        </div>
      </form>
    </Card>
  )
}

function SupportCard({ items, setItems }: { items: SupportRequest[] | null; setItems: (i: SupportRequest[]) => void }) {
  const [error, setError] = useState<string | null>(null)

  const toggle = useCallback(
    async (item: SupportRequest) => {
      const token = getToken()
      if (!token || !items) return
      setError(null)
      try {
        const updated = await api.setSupportStatus(token, item.id, item.status === 'new' ? 'resolved' : 'new')
        setItems(items.map((i) => (i.id === updated.id ? updated : i)))
      } catch (err) {
        setError(msg(err))
      }
    },
    [items, setItems],
  )

  return (
    <Card className="p-6">
      <CardHeading icon={<LifeBuoy className="size-5" />} title="Pesan Support" description="Pesan dari tombol Hubungi Support di halaman login" />
      <div className="mt-5 space-y-3">
        {error && <Alert variant="error">{error}</Alert>}
        {items === null ? (
          <p className="py-6 text-center text-sm text-gray-500">Memuat pesan...</p>
        ) : items.length === 0 ? (
          <p className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
            <ShieldCheck className="size-4" aria-hidden /> Belum ada pesan masuk.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((i) => (
              <li key={i.id} className="flex flex-wrap items-start justify-between gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {i.name} <span className="font-normal text-gray-500">&lt;{i.email}&gt;</span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-700">{i.message}</p>
                  <p className="mt-1 text-xs text-gray-400">{formatRelative(i.created_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={i.status === 'new' ? 'blue' : 'green'}>{i.status === 'new' ? 'Baru' : 'Selesai'}</Badge>
                  <Button variant="outline" size="sm" onClick={() => void toggle(i)}>
                    {i.status === 'new' ? 'Tandai selesai' : 'Buka lagi'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}
