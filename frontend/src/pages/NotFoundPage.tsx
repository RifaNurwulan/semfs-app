import { SearchX } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card } from '../components/ui/card'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="max-w-md p-10 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-500">
          <SearchX className="size-7" aria-hidden />
        </span>
        <h1 className="mt-5 text-xl font-semibold text-gray-900">Halaman tidak ditemukan</h1>
        <p className="mt-2 text-sm text-gray-500">Alamat yang Anda buka tidak ada.</p>
        <Link to="/" className="mt-6 inline-block text-sm font-medium text-emerald-600 hover:text-emerald-700">
          Kembali ke Dashboard
        </Link>
      </Card>
    </div>
  )
}
