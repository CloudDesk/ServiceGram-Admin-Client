import { cn } from '../../../utils/cn'

export interface DualRangeSliderProps {
  min: number
  max: number
  step?: number
  value: [number, number]
  onChange: (value: [number, number]) => void
  formatLabel?: (value: number) => string
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

const trackClassName =
  'pointer-events-none absolute inset-0 h-full w-full appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:-mt-1.5 [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-surface [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-surface'

export function DualRangeSlider({
  'aria-label': ariaLabel,
  className,
  disabled = false,
  formatLabel = (value) => String(value),
  max,
  min,
  onChange,
  step = 1,
  value,
}: DualRangeSliderProps) {
  const [low, high] = value
  const percent = (raw: number) => ((raw - min) / (max - min || 1)) * 100

  const setLow = (next: number) => {
    onChange([Math.min(next, high), high])
  }
  const setHigh = (next: number) => {
    onChange([low, Math.max(next, low)])
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="relative h-6">
        <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-border" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary"
          style={{ left: `${percent(low)}%`, right: `${100 - percent(high)}%` }}
        />
        <input
          aria-label={ariaLabel ? `${ariaLabel} minimum` : 'Minimum'}
          className={cn(trackClassName, 'absolute inset-0')}
          disabled={disabled}
          max={max}
          min={min}
          step={step}
          type="range"
          value={low}
          onChange={(event) => setLow(Number(event.target.value))}
        />
        <input
          aria-label={ariaLabel ? `${ariaLabel} maximum` : 'Maximum'}
          className={cn(trackClassName, 'absolute inset-0')}
          disabled={disabled}
          max={max}
          min={min}
          step={step}
          type="range"
          value={high}
          onChange={(event) => setHigh(Number(event.target.value))}
        />
      </div>
      <div className="flex items-center justify-between text-xs font-medium text-muted">
        <span>{formatLabel(low)}</span>
        <span>{formatLabel(high)}</span>
      </div>
    </div>
  )
}
