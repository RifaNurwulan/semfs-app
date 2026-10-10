import { ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { Card } from '../components/ui/card'
import { ROLE_LABEL } from '../lib/features'

export default function ForbiddenPage() {
  const { user } = useAuth()
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="max-w-md p-10 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
          <ShieldAlert className="size-7" aria-hidden />
        </span>
        <h1 className="mt-5 text-xl font-semibold text-gray-900">Akses ditolak</h1>
        <p className="mt-2 text-sm text-gray-500">
          {user
            ? `Role ${ROLE_LABEL[user.role]} tidak memiliki izin untuk membuka halaman ini.`
            : 'Anda tidak memiliki izin untuk membuka halaman ini.'}
        </p>
        <Link to="/" className="mt-6 inline-block text-sm font-medium text-emerald-600 hover:text-emerald-700">
          Kembali ke Dashboard
        </Link>
      </Card>
    </div>
  )
}
