import { ChevronDown, Loader2, Search, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import type { LookupOption } from '../../../types/lookup.types'
import { cn } from '../../../utils/cn'

interface LookupSelectProps {
  className?: string
  disabled?: boolean
  emptyLabel?: string
  fetchOptions: (search: string) => Promise<LookupOption[]>
  label: string
  onChange: (value: string, option?: LookupOption) => void
  placeholder: string
  queryKey: readonly unknown[]
  searchPlaceholder?: string
  selectedLabel?: string
  value: string
}

export function LookupSelect({
  className,
  disabled = false,
  emptyLabel = 'No matches found',
  fetchOptions,
  label,
  onChange,
  placeholder,
  queryKey,
  searchPlaceholder,
  selectedLabel,
  value,
}: LookupSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, 250)

    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (!isOpen) return undefined

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target

      if (target instanceof Node && containerRef.current?.contains(target)) {
        return
      }

      setIsOpen(false)
      setSearch('')
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        setSearch('')
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const optionsQuery = useQuery({
    enabled: isOpen && !disabled,
    queryKey: [...queryKey, debouncedSearch],
    queryFn: () => fetchOptions(debouncedSearch),
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
  })

  const options = optionsQuery.data ?? []
  const displayValue = isOpen ? search : selectedLabel || value

  const openLookup = () => {
    if (disabled) return

    setIsOpen(true)
    setSearch('')
  }

  const selectOption = (option: LookupOption) => {
    onChange(option.value, option)
    setIsOpen(false)
    setSearch('')
  }

  const clearSelection = () => {
    onChange('', undefined)
    setIsOpen(false)
    setSearch('')
  }

  return (
    <div className={cn('space-y-1', className)} ref={containerRef}>
      <span className="text-xs font-semibold text-muted">{label}</span>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-label={label}
          className="h-10 w-full rounded-[0.75rem] border border-border bg-surface px-9 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-primary/45 focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
          placeholder={isOpen ? searchPlaceholder ?? placeholder : placeholder}
          role="combobox"
          type="text"
          value={displayValue}
          onChange={(event) => {
            setIsOpen(true)
            setSearch(event.target.value)
          }}
          onFocus={openLookup}
        />
        {value ? (
          <button
            aria-label={`Clear ${label}`}
            className="absolute right-8 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted transition hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            disabled={disabled}
            type="button"
            onClick={clearSelection}
          >
            <X className="size-3.5" />
          </button>
        ) : null}
        <button
          aria-label={`Open ${label} lookup`}
          className="absolute right-2 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted transition hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
          type="button"
          onClick={() => {
            if (isOpen) {
              setIsOpen(false)
              setSearch('')
              return
            }

            openLookup()
          }}
        >
          <ChevronDown className={cn('size-3.5 transition', isOpen && 'rotate-180')} />
        </button>

        {isOpen ? (
          <div
            className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-[70] overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface"
            role="listbox"
          >
            <div className="max-h-64 overflow-y-auto p-1.5">
              {optionsQuery.isFetching ? (
                <div className="flex min-h-10 items-center gap-2 rounded-[0.65rem] px-2 text-sm text-muted">
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                  Searching
                </div>
              ) : null}
              {!optionsQuery.isFetching && options.length === 0 ? (
                <div className="min-h-10 rounded-[0.65rem] px-2 py-2 text-sm text-muted">
                  {emptyLabel}
                </div>
              ) : null}
              {options.map((option) => (
                <button
                  className={cn(
                    'flex min-h-11 w-full flex-col items-start justify-center rounded-[0.65rem] px-2 py-1.5 text-left transition hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    option.value === value && 'bg-primary/10 text-primary',
                  )}
                  key={option.value}
                  role="option"
                  type="button"
                  onClick={() => selectOption(option)}
                >
                  <span className="w-full truncate text-sm font-medium">
                    {option.label}
                  </span>
                  {option.meta ? (
                    <span className="w-full truncate text-xs text-muted">
                      {option.meta}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
