import { Loader2 } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { canAccess, getFeature, type FeatureKey } from '../lib/features'
import ForbiddenPage from '../pages/ForbiddenPage'
import { useAuth } from './auth-context'

/** Halaman di dalamnya wajib login. Belum login -> diarahkan ke /login. */
export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500" role="status">
        <Loader2 className="mr-2 size-5 animate-spin" aria-hidden />
        Memuat sesi...
      </div>
    )
  }
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

/** Membatasi halaman berdasarkan role (RBAC). Role tidak cocok -> halaman 403. */
export function RequireRole({ feature, children }: { feature: FeatureKey; children: ReactNode }) {
  const { user } = useAuth()
  if (!user || !canAccess(user.role, getFeature(feature))) return <ForbiddenPage />
  return children
}
