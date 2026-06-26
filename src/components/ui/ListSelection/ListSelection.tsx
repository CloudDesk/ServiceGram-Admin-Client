import { Check, Minus } from 'lucide-react'
import { type MouseEvent, useEffect, useRef } from 'react'
import { cn } from '../../../utils/cn'
import { Button } from '../Button'

export const LIST_SELECTION_COLUMN_WIDTH = 44

interface ListSelectionCheckboxProps {
  checked: boolean
  label: string
  className?: string
  disabled?: boolean
  indeterminate?: boolean
  onChange: (checked: boolean) => void
}

interface ListSelectionToolbarProps {
  selectedCount: number
  visibleCount: number
  allVisibleSelected: boolean
  className?: string
  onClear: () => void
  onSelectVisible: () => void
}

export function ListSelectionCheckbox({
  checked,
  className,
  disabled = false,
  indeterminate = false,
  label,
  onChange,
}: ListSelectionCheckboxProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate && !checked
    }
  }, [checked, indeterminate])

  const stopRowActivation = (event: MouseEvent<HTMLLabelElement>) => {
    event.stopPropagation()
  }

  return (
    <label
      className={cn(
        'inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-control text-foreground transition hover:bg-surface-muted focus-within:outline-none focus-within:ring-2 focus-within:ring-ring',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
      title={label}
      onClick={stopRowActivation}
    >
      <input
        ref={inputRef}
        aria-label={label}
        checked={checked}
        className="peer sr-only"
        disabled={disabled}
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        aria-hidden="true"
        className={cn(
          'flex size-4 items-center justify-center rounded-[0.3rem] border border-border bg-surface text-primary transition',
          (checked || indeterminate) && 'border-primary bg-primary text-primary-foreground',
          !disabled && 'peer-focus-visible:ring-2 peer-focus-visible:ring-ring',
        )}
      >
        {checked ? <Check className="size-3" /> : indeterminate ? <Minus className="size-3" /> : null}
      </span>
    </label>
  )
}

export function ListSelectionToolbar({
  allVisibleSelected,
  className,
  onClear,
  onSelectVisible,
  selectedCount,
  visibleCount,
}: ListSelectionToolbarProps) {
  if (selectedCount === 0) {
    return null
  }

  return (
    <div
      className={cn(
        'flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-primary/5 px-3 py-2 text-sm text-foreground',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="inline-flex min-h-7 items-center rounded-full bg-primary px-2.5 text-xs font-semibold text-primary-foreground">
          {selectedCount}
        </span>
        <span className="font-medium">
          {selectedCount === 1 ? 'record selected' : 'records selected'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {!allVisibleSelected && visibleCount > selectedCount ? (
          <Button size="sm" type="button" variant="ghost" onClick={onSelectVisible}>
            Select visible
          </Button>
        ) : null}
        <Button size="sm" type="button" variant="secondary" onClick={onClear}>
          Clear
        </Button>
      </div>
    </div>
  )
}
