import { Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '../../../utils/cn'

interface ListHeaderSearchProps {
  ariaLabel?: string
  className?: string
  debounceMs?: number
  onChange: (value: string) => void
  placeholder: string
  value: string
}

export function ListHeaderSearch({
  ariaLabel = 'Search list',
  className,
  debounceMs = 300,
  onChange,
  placeholder,
  value,
}: ListHeaderSearchProps) {
  const [draftState, setDraftState] = useState({
    draftValue: value,
    value,
  })
  const onChangeRef = useRef(onChange)
  let draftValue = draftState.draftValue

  if (draftState.value !== value) {
    draftValue = value
    setDraftState({ draftValue: value, value })
  }

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (draftValue === value) return undefined

    const timer = window.setTimeout(() => {
      onChangeRef.current(draftValue)
    }, debounceMs)

    return () => window.clearTimeout(timer)
  }, [debounceMs, draftValue, value])

  const clearSearch = () => {
    setDraftState({ draftValue: '', value })
    onChangeRef.current('')
  }

  return (
    <div className={cn('relative min-w-[14rem]', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <input
        aria-label={ariaLabel}
        className="h-10 w-full rounded-[0.75rem] border border-border bg-surface px-9 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-primary/45 focus:ring-2 focus:ring-primary/10"
        placeholder={placeholder}
        type="search"
        value={draftValue}
        onChange={(event) =>
          setDraftState({ draftValue: event.target.value, value })
        }
      />
      {draftValue ? (
        <button
          aria-label="Clear search"
          className="absolute right-2 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted transition hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          type="button"
          onClick={clearSearch}
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  )
}
