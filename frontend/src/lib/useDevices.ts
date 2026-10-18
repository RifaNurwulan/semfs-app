import { useCallback, useEffect, useState } from 'react'
import { getToken } from '../auth/tokenStorage'
import { api, type Device } from './api'

/** Daftar device dari API, disegarkan berkala (default tiap 30 detik, sesuai rancangan Maintenance). */
export function useDevices(intervalMs = 30_000) {
  const [devices, setDevices] = useState<Device[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const token = getToken()
    if (!token) return
    try {
      setDevices(await api.listDevices(token))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat device')
    }
  }, [])

  useEffect(() => {
    const first = setTimeout(() => void reload(), 0)
    const id = setInterval(() => void reload(), intervalMs)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [reload, intervalMs])

  return { devices, error, reload }
}
