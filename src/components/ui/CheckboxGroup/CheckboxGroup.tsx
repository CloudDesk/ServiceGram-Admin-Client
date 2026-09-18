import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '../../../utils/cn'

export interface CheckboxGroupOption {
  value: string
  label: string
  icon?: ReactNode
}

export interface CheckboxGroupProps {
  options: CheckboxGroupOption[]
  value: string[]
  onChange: (value: string[]) => void
  disabled?: boolean
  columns?: 2 | 3 | 4
  className?: string
  'aria-label'?: string
}

export function CheckboxGroup({
  'aria-label': ariaLabel,
  className,
  columns = 3,
  disabled = false,
  onChange,
  options,
  value,
}: CheckboxGroupProps) {
  const toggle = (optionValue: string) => {
    if (disabled) return

    onChange(
      value.includes(optionValue)
        ? value.filter((item) => item !== optionValue)
        : [...value, optionValue],
    )
  }

  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        'grid gap-2',
        columns === 2 && 'grid-cols-2',
        columns === 3 && 'grid-cols-2 sm:grid-cols-3',
        columns === 4 && 'grid-cols-2 sm:grid-cols-4',
        className,
      )}
      role="group"
    >
      {options.map((option) => {
        const checked = value.includes(option.value)

        return (
          <label
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-[0.55rem] border px-2.5 py-2 text-sm font-medium transition-colors',
              checked
                ? 'border-primary/40 bg-primary/5 text-foreground'
                : 'border-border bg-surface text-muted hover:text-foreground',
              disabled && 'cursor-not-allowed opacity-60',
            )}
            key={option.value}
          >
            <input
              checked={checked}
              className="sr-only"
              disabled={disabled}
              type="checkbox"
              onChange={() => toggle(option.value)}
            />
            <span
              className={cn(
                'flex size-4 shrink-0 items-center justify-center rounded-[0.3rem] border',
                checked
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-surface',
              )}
            >
              {checked ? <Check className="size-3" /> : null}
            </span>
            {option.icon}
            <span className="min-w-0 truncate">{option.label}</span>
          </label>
        )
      })}
    </div>
  )
}
