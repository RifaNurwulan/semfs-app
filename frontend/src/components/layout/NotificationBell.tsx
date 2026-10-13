import { Bell, Info, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import type { Severity } from '../../lib/api'
import { useDismiss } from '../../lib/useDismiss'
import { cn, formatRelative } from '../../lib/utils'
import { useNotifications } from '../../notifications/notification-context'

const SEVERITY: Record<Severity, { icon: LucideIcon; className: string }> = {
  info: { icon: Info, className: 'bg-blue-100 text-blue-600' },
  warning: { icon: TriangleAlert, className: 'bg-amber-100 text-amber-600' },
  critical: { icon: OctagonAlert, className: 'bg-rose-100 text-rose-600' },
}

/** Lonceng notifikasi (admin & operator): jumlah belum dibaca + daftar notifikasi terbaru. */
export function NotificationBell() {
  const { items, unreadCount, refresh, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(ref, open, setOpen)

  function toggle() {
    if (!open) void refresh() // saat dibuka, ambil yang terbaru
    setOpen(!open)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={unreadCount > 0 ? `Notifikasi, ${unreadCount} belum dibaca` : 'Notifikasi'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
        className="relative flex size-10 items-center justify-center rounded-xl text-gray-600 transition hover:bg-gray-100"
      >
        <Bell className="size-5" aria-hidden />
        {unreadCount > 0 && (
          <span
            data-testid="notif-badge"
            className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white ring-2 ring-white"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifikasi"
          className="fixed inset-x-4 top-20 z-20 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-88"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Notifikasi</h2>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
              >
                Tandai semua dibaca
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-gray-500">Belum ada notifikasi.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-gray-100 overflow-y-auto">
              {items.map((n) => {
                const { icon: Icon, className } = SEVERITY[n.severity]
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => void markRead(n.id)}
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-gray-50',
                        !n.read && 'bg-emerald-50/50',
                      )}
                    >
                      <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg', className)}>
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn('block text-sm text-gray-900', !n.read && 'font-semibold')}>{n.title}</span>
                        {n.message && <span className="mt-0.5 line-clamp-2 block text-sm text-gray-500">{n.message}</span>}
                        <span className="mt-1 block text-xs text-gray-400">{formatRelative(n.created_at)}</span>
                      </span>
                      {!n.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-emerald-500" aria-label="Belum dibaca" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
