import { createContext, useContext } from 'react'
import type { UpdateProfilePayload, User } from '../lib/api'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

export interface AuthContextValue {
  user: User | null
  status: AuthStatus
  login: (identifier: string, password: string, remember: boolean) => Promise<User>
  logout: () => Promise<void>
  updateProfile: (payload: UpdateProfilePayload) => Promise<User>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>')
  return ctx
}

/** Untuk halaman yang sudah pasti login (di dalam RequireAuth). */
export function useUser(): User {
  const { user } = useAuth()
  if (!user) throw new Error('useUser dipakai saat belum login')
  return user
}
