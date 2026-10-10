import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

const variants = cva('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', {
  variants: {
    tone: {
      green: 'bg-emerald-100 text-emerald-700',
      blue: 'bg-blue-100 text-blue-700',
      purple: 'bg-purple-100 text-purple-700',
      gray: 'bg-gray-100 text-gray-700',
      glass: 'bg-white/20 text-white',
    },
  },
  defaultVariants: { tone: 'gray' },
})

interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof variants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(variants({ tone }), className)} {...props} />
}
