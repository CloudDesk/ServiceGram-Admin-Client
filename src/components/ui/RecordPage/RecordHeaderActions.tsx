import { MoreHorizontal } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../../utils/cn'
import { Button } from '../Button'

export interface RecordAction {
  key: string
  label: string
  icon?: ReactNode
  /**
   * `primary` is the one action the record is asking for; at most one should
   * be marked so. `destructive` actions are never rendered as bare buttons.
   */
  intent?: 'primary' | 'secondary' | 'destructive'
  disabled?: boolean
  /** Shown on hover — use it to explain a disabled action rather than hiding it. */
  title?: string
  onSelect: () => void
}

interface RecordHeaderActionsProps {
  actions: RecordAction[]
  /** Non-mutating controls such as Refresh, rendered first. */
  utility?: ReactNode
  disabled?: boolean
}

/**
 * Record-level actions, with destructive ones held behind an overflow.
 *
 * A header that renders every available action as a flat row puts Hard delete
 * the same distance from the cursor as Approve, styled identically to Reject.
 * Constructive actions get buttons; destructive ones get a menu, so removing a
 * record is always a deliberate second step.
 */
export function RecordHeaderActions({
  actions,
  disabled = false,
  utility,
}: RecordHeaderActionsProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return undefined

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const destructive = actions.filter((action) => action.intent === 'destructive')
  const constructive = actions.filter((action) => action.intent !== 'destructive')

  return (
    <div ref={containerRef} className="relative flex flex-wrap items-center justify-end gap-2">
      {utility}

      {constructive.map((action) => (
        <Button
          disabled={disabled || action.disabled}
          key={action.key}
          size="sm"
          title={action.title ?? action.label}
          type="button"
          variant={action.intent === 'primary' ? 'primary' : 'secondary'}
          onClick={action.onSelect}
        >
          {action.icon ? <span className="mr-2">{action.icon}</span> : null}
          {action.label}
        </Button>
      ))}

      {destructive.length ? (
        <>
          <Button
            aria-expanded={open}
            aria-haspopup="menu"
            aria-label="More actions"
            className="px-2"
            disabled={disabled}
            size="sm"
            type="button"
            variant="secondary"
            onClick={() => setOpen((value) => !value)}
          >
            <MoreHorizontal className="size-4" />
          </Button>

          {open ? (
            <div
              className="absolute right-0 top-10 z-50 min-w-[12rem] rounded-[0.6rem] border border-border bg-surface p-1 shadow-lg"
              role="menu"
            >
              <p className="px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-muted">
                Destructive
              </p>
              {destructive.map((action) => (
                <button
                  className={cn(
                    'flex w-full items-center gap-2 rounded-[0.45rem] px-2 py-1.5 text-left text-sm text-danger transition hover:bg-danger/10',
                    (disabled || action.disabled) &&
                      'cursor-not-allowed opacity-60 hover:bg-transparent',
                  )}
                  disabled={disabled || action.disabled}
                  key={action.key}
                  role="menuitem"
                  title={action.title ?? action.label}
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    action.onSelect()
                  }}
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
