import { cn } from '../../../utils/cn'

export interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
  disabled?: boolean
  className?: string
}

export function Switch({
  checked,
  className,
  description,
  disabled = false,
  label,
  onChange,
}: SwitchProps) {
  return (
    <label
      className={cn(
        'flex items-start justify-between gap-3 rounded-[0.75rem] border border-border bg-surface px-3 py-2.5',
        disabled && 'opacity-60',
        className,
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-muted">{description}</span>
        ) : null}
      </span>
      <button
        aria-checked={checked}
        aria-label={label}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed',
          checked ? 'bg-primary' : 'bg-border',
        )}
        disabled={disabled}
        role="switch"
        type="button"
        onClick={() => onChange(!checked)}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 size-5 rounded-full bg-surface shadow-sm transition-transform',
            checked && 'translate-x-5',
          )}
        />
      </button>
    </label>
  )
}
