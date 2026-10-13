import { createContext, useContext } from 'react'
import type { NotificationItem } from '../lib/api'

export interface NotificationContextValue {
  /** false untuk role yang tidak berhak melihat notifikasi (viewer) */
  enabled: boolean
  items: NotificationItem[]
  unreadCount: number
  refresh: () => Promise<void>
  markRead: (id: number) => Promise<void>
  markAllRead: () => Promise<void>
}

export const NotificationContext = createContext<NotificationContextValue | null>(null)

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications harus dipakai di dalam <NotificationProvider>')
  return ctx
}
