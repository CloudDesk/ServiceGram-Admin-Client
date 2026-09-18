import type { ReactNode } from 'react'
import { cn } from '../../../utils/cn'

export interface SegmentedControlOption<TValue extends string> {
  value: TValue
  label: string
  icon?: ReactNode
}

export interface SegmentedControlProps<TValue extends string> {
  options: SegmentedControlOption<TValue>[]
  value: TValue
  onChange: (value: TValue) => void
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

export function SegmentedControl<TValue extends string>({
  'aria-label': ariaLabel,
  className,
  disabled = false,
  onChange,
  options,
  value,
}: SegmentedControlProps<TValue>) {
  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        'inline-flex flex-wrap gap-1 rounded-[0.65rem] border border-border bg-surface-muted/45 p-1',
        className,
      )}
      role="radiogroup"
    >
      {options.map((option) => {
        const isActive = option.value === value

        return (
          <button
            aria-checked={isActive}
            className={cn(
              'inline-flex min-h-7.5 items-center gap-1.5 rounded-[0.5rem] px-2.5 text-xs font-semibold transition',
              isActive
                ? 'bg-surface text-primary shadow-sm ring-1 ring-primary/25'
                : 'text-muted hover:bg-surface/75 hover:text-foreground',
              disabled && 'cursor-not-allowed opacity-60',
            )}
            disabled={disabled}
            key={option.value}
            role="radio"
            type="button"
            onClick={() => {
              if (!disabled) onChange(option.value)
            }}
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
