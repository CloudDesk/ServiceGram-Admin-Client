import { Check, ChevronDown, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { LookupOption } from '../../../types/lookup.types'
import { cn } from '../../../utils/cn'

interface MultiSelectFilterProps {
  className?: string
  disabled?: boolean
  emptyLabel?: string
  label: string
  onChange: (values: string[]) => void
  options: LookupOption[]
  placeholder?: string
  searchPlaceholder?: string
  values: string[]
}

export function MultiSelectFilter({
  className,
  disabled = false,
  emptyLabel = 'No matches found',
  label,
  onChange,
  options,
  placeholder = 'All',
  searchPlaceholder,
  values,
}: MultiSelectFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement | null>(null)
  const selectedValues = useMemo(() => new Set(values), [values])
  const selectedOptions = options.filter((option) => selectedValues.has(option.value))
  const filteredOptions = useMemo(() => {
    const term = search.trim().toLowerCase()

    if (!term) return options

    return options.filter((option) =>
      [option.label, option.meta, option.value]
        .filter(Boolean)
        .some((part) => String(part).toLowerCase().includes(term)),
    )
  }, [options, search])

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

  const toggleValue = (nextValue: string) => {
    if (selectedValues.has(nextValue)) {
      onChange(values.filter((value) => value !== nextValue))
      return
    }

    onChange([...values, nextValue])
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
          onClick={() => {
            setIsOpen((current) => !current)
            setSearch('')
          }}
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
        {values.length > 0 ? (
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
          aria-label={`Open ${label} filter`}
          className="absolute right-2 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted transition hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
          type="button"
          onClick={() => {
            setIsOpen((current) => !current)
            setSearch('')
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
                  className="h-9 w-full rounded-[0.65rem] border border-border bg-surface px-8 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-primary/45 focus:ring-2 focus:ring-primary/10"
                  placeholder={searchPlaceholder ?? `Search ${label.toLowerCase()}`}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto p-1.5">
              {filteredOptions.length === 0 ? (
                <div className="min-h-10 rounded-[0.65rem] px-2 py-2 text-sm text-muted">
                  {emptyLabel}
                </div>
              ) : null}
              {filteredOptions.map((option) => {
                const isSelected = selectedValues.has(option.value)

                return (
                  <button
                    aria-selected={isSelected}
                    className={cn(
                      'flex min-h-10 w-full items-center gap-2 rounded-[0.65rem] px-2 py-1.5 text-left text-sm transition hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isSelected && 'bg-primary/10 text-primary',
                    )}
                    key={option.value}
                    role="option"
                    type="button"
                    onClick={() => toggleValue(option.value)}
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
                      <span className="block truncate font-medium">{option.label}</span>
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
