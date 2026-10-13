import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, setUnauthorizedHandler, type User } from '../lib/api'
import { AuthContext, type AuthContextValue, type AuthStatus } from './auth-context'
import { clearToken, getToken, saveToken } from './tokenStorage'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthStatus>(() => (getToken() ? 'loading' : 'anonymous'))

  const clearSession = useCallback(() => {
    clearToken()
    setUser(null)
    setStatus('anonymous')
  }, [])

  // Saat halaman dibuka: kalau ada token tersimpan, cek ke server siapa pemiliknya.
  useEffect(() => {
    const token = getToken()
    if (!token) return
    let active = true
    api
      .me(token)
      .then((me) => {
        if (!active) return
        setUser(me)
        setStatus('authenticated')
      })
      .catch(() => {
        // 401 (token kedaluwarsa/tidak valid) sudah dibersihkan oleh unauthorizedHandler.
        // Kalau penyebabnya server mati / jaringan putus, token dibiarkan: begitu server
        // hidup lagi dan halaman dimuat ulang, user otomatis masuk kembali.
        if (active) setStatus('anonymous')
      })
    return () => {
      active = false
    }
  }, [clearSession])

  // Token kedaluwarsa di tengah pemakaian -> otomatis keluar
  useEffect(() => {
    setUnauthorizedHandler(clearSession)
    return () => setUnauthorizedHandler(null)
  }, [clearSession])

  const login = useCallback<AuthContextValue['login']>(async (identifier, password, remember) => {
    const res = await api.login(identifier, password)
    saveToken(res.access_token, remember)
    setUser(res.user)
    setStatus('authenticated')
    return res.user
  }, [])

  const logout = useCallback<AuthContextValue['logout']>(async () => {
    const token = getToken()
    if (token) {
      // JWT stateless: yang penting token dihapus di sini. Panggilan ke server hanya formalitas.
      await api.logout(token).catch(() => undefined)
    }
    clearSession()
  }, [clearSession])

  const updateProfile = useCallback<AuthContextValue['updateProfile']>(async (payload) => {
    const token = getToken()
    if (!token) throw new Error('Sesi tidak ditemukan')
    const updated = await api.updateProfile(token, payload)
    setUser(updated)
    return updated
  }, [])

  const uploadAvatar = useCallback<AuthContextValue['uploadAvatar']>(async (image) => {
    const token = getToken()
    if (!token) throw new Error('Sesi tidak ditemukan')
    const updated = await api.uploadAvatar(token, image)
    setUser(updated)
    return updated
  }, [])

  const removeAvatar = useCallback<AuthContextValue['removeAvatar']>(async () => {
    const token = getToken()
    if (!token) throw new Error('Sesi tidak ditemukan')
    const updated = await api.deleteAvatar(token)
    setUser(updated)
    return updated
  }, [])

  const value = useMemo(
    () => ({ user, status, login, logout, updateProfile, uploadAvatar, removeAvatar }),
    [user, status, login, logout, updateProfile, uploadAvatar, removeAvatar],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
