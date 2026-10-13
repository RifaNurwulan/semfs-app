import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/auth-context'
import { getToken } from '../auth/tokenStorage'
import { api, type NotificationItem } from '../lib/api'
import { NotificationContext, type NotificationContextValue } from './notification-context'

const POLL_MS = 30_000 // cek notifikasi baru tiap 30 detik

interface Snapshot {
  userId: number | null
  items: NotificationItem[]
  unread: number
}
const EMPTY: Snapshot = { userId: null, items: [], unread: 0 }

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const enabled = user?.role === 'admin' || user?.role === 'operator'
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY)

  // Data milik user sebelumnya tidak boleh terlihat setelah ganti akun
  const mine = snapshot.userId === userId ? snapshot : EMPTY

  const refresh = useCallback(async () => {
    const token = getToken()
    if (!token || !enabled || userId === null) return
    try {
      const res = await api.notifications(token)
      setSnapshot({ userId, items: res.items, unread: res.unread_count })
    } catch {
      /* gagal sementara (server mati dsb): dicoba lagi pada polling berikutnya */
    }
  }, [enabled, userId])

  useEffect(() => {
    if (!enabled) return
    const first = setTimeout(() => void refresh(), 0) // ambil data segera, lalu ulangi berkala
    const id = setInterval(() => void refresh(), POLL_MS)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [enabled, refresh])

  const markRead = useCallback(
    async (id: number) => {
      const token = getToken()
      if (!token || userId === null) return
      // Tampilan langsung berubah, server menyusul
      setSnapshot((s) => {
        const target = s.items.find((i) => i.id === id)
        if (!target || target.read) return s
        return { ...s, items: s.items.map((i) => (i.id === id ? { ...i, read: true } : i)), unread: Math.max(0, s.unread - 1) }
      })
      try {
        await api.markNotificationRead(token, id)
      } catch {
        await refresh()
      }
    },
    [refresh, userId],
  )

  const markAllRead = useCallback(async () => {
    const token = getToken()
    if (!token || userId === null) return
    setSnapshot((s) => ({ ...s, items: s.items.map((i) => ({ ...i, read: true })), unread: 0 }))
    try {
      await api.markAllNotificationsRead(token)
    } catch {
      await refresh()
    }
  }, [refresh, userId])

  const value = useMemo<NotificationContextValue>(
    () => ({ enabled, items: mine.items, unreadCount: mine.unread, refresh, markRead, markAllRead }),
    [enabled, mine.items, mine.unread, refresh, markRead, markAllRead],
  )

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}
