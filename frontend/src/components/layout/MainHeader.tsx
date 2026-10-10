import { Bell, LogOut, User as UserIcon, UserCog, Zap } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, useUser } from '../../auth/auth-context'
import { ROLE_LABEL } from '../../lib/features'

/** Header Dashboard: logo SEMFS, notifikasi, dan menu akun (Edit Profil / Keluar). */
export function MainHeader({ alertCount = 0 }: { alertCount?: number }) {
  const user = useUser()

  return (
    <header className="border-b border-gray-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link to="/" className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <Zap className="size-5" aria-hidden />
          </span>
          <span>
            <span className="block text-lg font-semibold leading-tight text-gray-900">SEMFS</span>
            <span className="hidden text-sm text-gray-500 sm:block">
              Smart Energy Monitoring &amp; Forecasting System
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-label="Notifikasi"
            title="Notifikasi"
            className="relative flex size-10 items-center justify-center rounded-xl text-gray-600 transition hover:bg-gray-100"
          >
            <Bell className="size-5" aria-hidden />
            {alertCount > 0 && (
              <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-red-500 ring-2 ring-white" />
            )}
          </button>
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-gray-900">{user.username}</p>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>
          <UserMenu />
        </div>
      </div>
    </header>
  )
}

function UserMenu() {
  const user = useUser()
  const { logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Menu akun"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex size-11 items-center justify-center rounded-xl bg-emerald-600 text-white transition hover:bg-emerald-700"
      >
        <UserIcon className="size-5" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
        >
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-medium text-gray-900">{user.username}</p>
            <p className="text-xs text-gray-500">Role: {ROLE_LABEL[user.role]}</p>
          </div>
          <Link
            to="/profil"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            <UserCog className="size-4" aria-hidden />
            Edit Profil
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => void logout()}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50"
          >
            <LogOut className="size-4" aria-hidden />
            Keluar
          </button>
        </div>
      )}
    </div>
  )
}
