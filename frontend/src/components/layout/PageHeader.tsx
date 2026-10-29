import { ArrowLeft, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'

interface PageHeaderProps {
  icon: LucideIcon
  iconClassName: string
  title: string
  subtitle: string
  className?: string
}

/** Header halaman fitur: tombol kembali + ikon berwarna + judul (sesuai rancangan). */
export function PageHeader({ icon: Icon, iconClassName, title, subtitle, className }: PageHeaderProps) {
  return (
    <header className={cn('border-b border-gray-200 bg-white shadow-sm', className)}>
      <div className="flex w-full items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          aria-label="Kembali ke Dashboard"
          className="flex size-10 items-center justify-center rounded-xl text-gray-600 transition hover:bg-gray-100"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <span className={cn('flex size-11 items-center justify-center rounded-xl text-white', iconClassName)}>
          <Icon className="size-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
      </div>
    </header>
  )
}
