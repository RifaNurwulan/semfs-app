import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode
  trailing?: ReactNode
  invalid?: boolean
}

export function Input({ className, icon, trailing, invalid, ...props }: InputProps) {
  return (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-gray-400">
          {icon}
        </span>
      )}
      <input
        aria-invalid={invalid || undefined}
        className={cn(
          'h-12 w-full rounded-xl border bg-white text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 disabled:bg-gray-50 disabled:text-gray-500',
          icon ? 'pl-11' : 'pl-3.5',
          trailing ? 'pr-11' : 'pr-3.5',
          invalid ? 'border-rose-400' : 'border-gray-200',
          className,
        )}
        {...props}
      />
      {trailing && <span className="absolute inset-y-0 right-2 flex items-center">{trailing}</span>}
    </div>
  )
}

interface FieldProps {
  label: string
  htmlFor: string
  error?: string | null
  hint?: string
  children: ReactNode
}

export function Field({ label, htmlFor, error, hint, children }: FieldProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-sm text-gray-500">{hint}</p>
      )}
    </div>
  )
}
