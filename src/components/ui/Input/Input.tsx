import type { InputHTMLAttributes } from 'react'
import { cn } from '../../../utils/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean
}

export function Input({ className, hasError = false, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'min-h-11 w-full rounded-control border bg-surface px-3 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25',
        hasError ? 'border-danger' : 'border-border',
        className,
      )}
      {...props}
    />
  )
}
