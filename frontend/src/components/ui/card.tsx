import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl border border-gray-200 bg-white shadow-sm', className)} {...props} />
}

interface CardHeadingProps {
  icon: ReactNode
  title: string
  description?: string
}

export function CardHeading({ icon, title, description }: CardHeadingProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
        {icon}
      </span>
      <div>
        <h2 className="font-semibold text-gray-900">{title}</h2>
        {description && <p className="text-sm text-gray-500">{description}</p>}
      </div>
    </div>
  )
}
