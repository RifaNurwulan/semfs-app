import { CheckCircle2, Info, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

const styles = {
  error: { box: 'border-rose-200 bg-rose-50 text-rose-800', Icon: TriangleAlert },
  success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-800', Icon: CheckCircle2 },
  info: { box: 'border-blue-200 bg-blue-50 text-blue-800', Icon: Info },
}

interface AlertProps {
  variant: keyof typeof styles
  children: ReactNode
  className?: string
}

export function Alert({ variant, children, className }: AlertProps) {
  const { box, Icon } = styles[variant]
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm', box, className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  )
}
