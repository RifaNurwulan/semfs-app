import { useEffect, useState } from 'react'
import { api, type User } from '../lib/api'
import { getToken } from './tokenStorage'

/**
 * Foto profil dilindungi login, jadi tidak bisa dipasang langsung di <img src>.
 * Hook ini mengambilnya dengan token lalu membuat alamat sementara (blob:) untuk ditampilkan.
 * Mengembalikan null kalau belum ada foto (tampilkan inisial).
 */
export function useAvatarUrl(user: User): string | null {
  const [loaded, setLoaded] = useState<{ key: string; url: string } | null>(null)
  // Berubah setiap foto diganti, sehingga foto baru otomatis diambil ulang
  const key = user.has_avatar ? `${user.id}:${user.avatar_updated_at ?? ''}` : null

  useEffect(() => {
    if (!key) return
    const token = getToken()
    if (!token) return
    let active = true
    let objectUrl: string | null = null

    api
      .getAvatar(token)
      .then((blob) => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setLoaded({ key, url: objectUrl })
      })
      .catch(() => undefined) // gagal ambil foto -> tetap tampil inisial

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [key])

  return key && loaded?.key === key ? loaded.url : null
}
