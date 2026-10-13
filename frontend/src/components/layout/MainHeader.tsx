import { LogOut, UserCog, Zap } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, useUser } from '../../auth/auth-context'
import { ROLE_LABEL } from '../../lib/features'
import { useDismiss } from '../../lib/useDismiss'
import { useNotifications } from '../../notifications/notification-context'
import { Avatar } from '../ui/avatar'
import { NotificationBell } from './NotificationBell'

/** Header Dashboard: logo SEMFS, notifikasi, dan menu akun (Edit Profil / Keluar). */
export function MainHeader() {
  const user = useUser()
  const { enabled } = useNotifications()

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
          {enabled && <NotificationBell />}
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
  useDismiss(ref, open, setOpen)

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Menu akun"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="rounded-xl transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
      >
        <Avatar user={user} />
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
