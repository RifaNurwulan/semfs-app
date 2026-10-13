import { Zap } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/** Kerangka halaman publik sederhana (Lupa Password, Reset Password): logo + kartu di tengah. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md">
        <Link to="/login" className="mb-6 flex items-center justify-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <Zap className="size-5" aria-hidden />
          </span>
          <span className="text-lg font-semibold text-gray-900">SEMFS</span>
        </Link>
        <div className="rounded-2xl bg-white p-8 shadow-xl shadow-gray-200/70">
          <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
          <p className="mt-1 text-gray-500">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  )
}
