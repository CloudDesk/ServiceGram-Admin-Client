import { Minus, Plus } from 'lucide-react'
import { cn } from '../../../utils/cn'

export interface NumberStepperProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

export function NumberStepper({
  'aria-label': ariaLabel,
  className,
  disabled = false,
  max,
  min = 0,
  onChange,
  step = 1,
  suffix,
  value,
}: NumberStepperProps) {
  const clamp = (next: number) => {
    let clamped = next
    if (typeof min === 'number') clamped = Math.max(min, clamped)
    if (typeof max === 'number') clamped = Math.min(max, clamped)
    return clamped
  }

  return (
    <div
      className={cn(
        'flex h-9 items-stretch overflow-hidden rounded-[0.55rem] border border-border bg-surface',
        disabled && 'opacity-60',
        className,
      )}
    >
      <button
        aria-label="Decrease"
        className="flex w-8 shrink-0 items-center justify-center text-muted transition-colors hover:bg-surface-muted hover:text-foreground disabled:cursor-not-allowed"
        disabled={disabled}
        type="button"
        onClick={() => onChange(clamp(value - step))}
      >
        <Minus className="size-3.5" />
      </button>
      <div className="flex min-w-0 flex-1 items-center justify-center gap-1 px-1">
        <input
          aria-label={ariaLabel}
          className="w-full min-w-0 bg-transparent text-center text-sm font-semibold text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          disabled={disabled}
          inputMode="decimal"
          max={max}
          min={min}
          type="number"
          value={Number.isFinite(value) ? value : 0}
          onChange={(event) => {
            const nextValue = Number(event.target.value)
            onChange(Number.isFinite(nextValue) ? clamp(nextValue) : min)
          }}
        />
        {suffix ? (
          <span className="shrink-0 text-xs text-muted">{suffix}</span>
        ) : null}
      </div>
      <button
        aria-label="Increase"
        className="flex w-8 shrink-0 items-center justify-center text-muted transition-colors hover:bg-surface-muted hover:text-foreground disabled:cursor-not-allowed"
        disabled={disabled}
        type="button"
        onClick={() => onChange(clamp(value + step))}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  )
}
