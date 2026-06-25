import { Check, ChevronDown, Loader2, Search, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { LookupOption } from '../../../types/lookup.types'
import { cn } from '../../../utils/cn'

interface LookupMultiSelectProps {
  className?: string
  disabled?: boolean
  emptyLabel?: string
  fetchOptions: (search: string) => Promise<LookupOption[]>
  label: string
  onChange: (options: LookupOption[]) => void
  placeholder: string
  queryKey: readonly unknown[]
  searchPlaceholder?: string
  selectedOptions: LookupOption[]
}

export function LookupMultiSelect({
  className,
  disabled = false,
  emptyLabel = 'No matches found',
  fetchOptions,
  label,
  onChange,
  placeholder,
  queryKey,
  searchPlaceholder,
  selectedOptions,
}: LookupMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const containerRef = useRef<HTMLDivElement | null>(null)
  const selectedValues = useMemo(
    () => new Set(selectedOptions.map((option) => option.value)),
    [selectedOptions],
  )

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

  const openLookup = () => {
    if (disabled) return

    setIsOpen(true)
    setSearch('')
  }

  const toggleOption = (option: LookupOption) => {
    if (selectedValues.has(option.value)) {
      onChange(
        selectedOptions.filter(
          (selectedOption) => selectedOption.value !== option.value,
        ),
      )
      return
    }

    onChange([...selectedOptions, option])
  }

  const clearSelection = () => {
    onChange([])
    setIsOpen(false)
    setSearch('')
  }

  return (
    <div className={cn('space-y-1', className)} ref={containerRef}>
      <span className="text-xs font-semibold text-muted">{label}</span>
      <div className="relative">
        <button
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          className="min-h-10 w-full rounded-[0.75rem] border border-border bg-surface px-3 py-2 pr-16 text-left text-sm text-foreground outline-none transition hover:border-primary/35 focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
          type="button"
          onClick={openLookup}
        >
          {selectedOptions.length > 0 ? (
            <span className="flex flex-wrap gap-1">
              {selectedOptions.slice(0, 2).map((option) => (
                <span
                  className="max-w-full truncate rounded-full bg-surface-muted px-2 py-0.5 text-xs font-semibold text-foreground"
                  key={option.value}
                >
                  {option.label}
                </span>
              ))}
              {selectedOptions.length > 2 ? (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  +{selectedOptions.length - 2}
                </span>
              ) : null}
            </span>
          ) : (
            <span className="text-muted">{placeholder}</span>
          )}
        </button>
        {selectedOptions.length > 0 ? (
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
            <div className="border-b border-border p-1.5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <input
                  aria-label={`Search ${label}`}
                  className="h-9 w-full rounded-[0.65rem] border border-border bg-surface px-8 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-primary/45 focus:ring-2 focus:ring-primary/10"
                  placeholder={searchPlaceholder ?? placeholder}
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>
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
              {options.map((option) => {
                const isSelected = selectedValues.has(option.value)

                return (
                  <button
                    aria-selected={isSelected}
                    className={cn(
                      'flex min-h-11 w-full items-center gap-2 rounded-[0.65rem] px-2 py-1.5 text-left transition hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isSelected && 'bg-primary/10 text-primary',
                    )}
                    key={option.value}
                    role="option"
                    type="button"
                    onClick={() => toggleOption(option)}
                  >
                    <span
                      className={cn(
                        'inline-flex size-4 shrink-0 items-center justify-center rounded border border-border',
                        isSelected && 'border-primary bg-primary text-white',
                      )}
                    >
                      {isSelected ? <Check className="size-3" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {option.label}
                      </span>
                      {option.meta ? (
                        <span className="block truncate text-xs text-muted">
                          {option.meta}
                        </span>
                      ) : null}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
