import { useEffect, useState } from 'react'
import { api } from './api'

interface HealthState {
  ok: boolean | null // null = belum selesai diperiksa
  checkedAt: Date | null
}

/** Cek /health ke API secara berkala (default tiap 30 detik, sesuai rancangan Maintenance). */
export function useHealth(intervalMs = 30_000): HealthState {
  const [state, setState] = useState<HealthState>({ ok: null, checkedAt: null })

  useEffect(() => {
    let active = true

    const check = async () => {
      const ok = await api.health().then(
        () => true,
        () => false,
      )
      if (active) setState({ ok, checkedAt: new Date() })
    }

    void check()
    const id = setInterval(() => void check(), intervalMs)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [intervalMs])

  return state
}
