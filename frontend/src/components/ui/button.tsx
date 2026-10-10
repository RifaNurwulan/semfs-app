import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

const variants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:pointer-events-none disabled:opacity-60',
  {
    variants: {
      variant: {
        primary:
          'bg-linear-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/20 hover:from-emerald-700 hover:to-teal-700',
        outline: 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
        ghost: 'text-gray-600 hover:bg-gray-100',
        danger: 'text-rose-600 hover:bg-rose-50',
      },
      size: { md: 'h-12 px-4', sm: 'h-9 px-3', icon: 'size-10' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof variants> {
  loading?: boolean
}

export function Button({
  className,
  variant,
  size,
  loading,
  disabled,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(variants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}
