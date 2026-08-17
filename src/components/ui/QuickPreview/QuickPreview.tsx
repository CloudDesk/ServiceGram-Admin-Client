import { MoreHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '../Button'
import { cn } from '../../../utils/cn'
import type { ButtonProps } from '../Button/Button.types'

export interface QuickPreviewAction {
  disabled?: boolean
  icon?: ReactNode
  key: string
  label: string
  onClick: () => void
  title?: string
  variant?: ButtonProps['variant']
}

export const quickPreviewOverlayClassName =
  'fixed inset-0 z-40 bg-black/20 xl:hidden'

export const quickPreviewOverlayUntil2xlClassName =
  'fixed inset-0 z-40 bg-black/20 2xl:hidden'

export const quickPreviewPanelClassName =
  'fixed inset-x-3 bottom-3 top-20 z-50 flex min-h-0 flex-col overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface xl:static xl:z-auto xl:h-full xl:w-[26rem] xl:self-stretch'

export const quickPreviewCompactPanelClassName =
  'fixed inset-x-3 bottom-3 top-20 z-50 flex min-h-0 flex-col overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface xl:static xl:z-auto xl:h-full xl:w-[22rem] xl:self-stretch'

export const quickPreviewMediumPanelClassName =
  'fixed inset-x-3 bottom-3 top-20 z-50 flex min-h-0 flex-col overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface xl:static xl:z-auto xl:h-full xl:w-96 xl:self-stretch'

export const quickPreviewPanelUntil2xlClassName =
  'fixed inset-x-3 bottom-3 top-20 z-50 flex min-h-0 flex-col overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface sm:left-auto sm:w-[22rem] 2xl:static 2xl:z-auto 2xl:h-full 2xl:w-[22rem] 2xl:self-stretch'

interface QuickPreviewActionsProps {
  detailAction?: QuickPreviewAction | null
  primaryAction?: QuickPreviewAction | null
  secondaryActions?: QuickPreviewAction[]
}

function actionToneClass(variant: ButtonProps['variant']) {
  if (variant === 'danger') {
    return 'text-danger hover:bg-danger/10'
  }

  if (variant === 'primary') {
    return 'text-primary hover:bg-primary/10'
  }

  return 'text-foreground hover:bg-surface-muted'
}

function PreviewActionContent({ action }: { action: QuickPreviewAction }) {
  return (
    <>
      {action.icon ? (
        <span className="mr-2 shrink-0 text-current">{action.icon}</span>
      ) : null}
      <span className="min-w-0 truncate">{action.label}</span>
    </>
  )
}

export function QuickPreviewActions({
  detailAction,
  primaryAction,
  secondaryActions = [],
}: QuickPreviewActionsProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const availableSecondaryActions = secondaryActions.filter(Boolean)

  useEffect(() => {
    if (!isMenuOpen) return undefined

    function onPointerDown(event: PointerEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false)
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isMenuOpen])

  return (
    <div className="shrink-0 border-t border-border bg-surface/95 p-2.5 backdrop-blur">
      <div className="flex min-w-0 items-center gap-2">
        {primaryAction ? (
          <Button
            className="min-w-0 flex-1 px-3"
            disabled={primaryAction.disabled}
            size="sm"
            title={primaryAction.title}
            type="button"
            variant={primaryAction.variant ?? 'primary'}
            onClick={primaryAction.onClick}
          >
            <PreviewActionContent action={primaryAction} />
          </Button>
        ) : null}

        {detailAction ? (
          <Button
            className={cn('min-w-0 px-3', primaryAction ? 'shrink-0' : 'flex-1')}
            disabled={detailAction.disabled}
            size="sm"
            title={detailAction.title}
            type="button"
            variant={detailAction.variant ?? (primaryAction ? 'secondary' : 'primary')}
            onClick={detailAction.onClick}
          >
            <PreviewActionContent action={detailAction} />
          </Button>
        ) : null}

        {availableSecondaryActions.length ? (
          <div className="relative shrink-0" ref={menuRef}>
            <Button
              aria-expanded={isMenuOpen}
              aria-haspopup="menu"
              className="px-3"
              size="sm"
              title="More actions"
              type="button"
              variant="secondary"
              onClick={() => setIsMenuOpen((open) => !open)}
            >
              <MoreHorizontal className="mr-2 size-4" />
              More
            </Button>

            {isMenuOpen ? (
              <div
                className="absolute bottom-[calc(100%+0.5rem)] right-0 z-20 w-56 overflow-hidden rounded-[0.75rem] border border-border bg-surface p-1.5 shadow-overlay"
                role="menu"
              >
                {availableSecondaryActions.map((action) => (
                  <button
                    className={cn(
                      'flex min-h-9 w-full items-center gap-2 rounded-[0.65rem] px-2.5 text-left text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-55',
                      actionToneClass(action.variant),
                    )}
                    disabled={action.disabled}
                    key={action.key}
                    role="menuitem"
                    title={action.title}
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false)
                      action.onClick()
                    }}
                  >
                    {action.icon ? (
                      <span className="shrink-0 text-current">{action.icon}</span>
                    ) : null}
                    <span className="min-w-0 truncate">{action.label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

interface QuickPreviewTab {
  key: string
  label: string
}

interface QuickPreviewTabsProps<TTab extends QuickPreviewTab> {
  activeTab: TTab['key']
  ariaLabel: string
  onChange: (tab: TTab['key']) => void
  tabs: readonly TTab[]
}

export function QuickPreviewTabs<TTab extends QuickPreviewTab>({
  activeTab,
  ariaLabel,
  onChange,
  tabs,
}: QuickPreviewTabsProps<TTab>) {
  return (
    <div className="shrink-0 border-b border-border bg-surface px-3">
      <div
        aria-label={ariaLabel}
        className="flex gap-4 overflow-x-auto"
        role="tablist"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key

          return (
            <button
              aria-selected={isActive}
              className={cn(
                'relative min-h-10 shrink-0 text-sm font-semibold transition',
                isActive
                  ? 'text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary'
                  : 'text-muted hover:text-foreground',
              )}
              key={tab.key}
              role="tab"
              type="button"
              onClick={() => onChange(tab.key)}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface QuickPreviewFactProps {
  label: string
  tone?: 'neutral' | 'warning' | 'success' | 'danger' | 'info'
  value: ReactNode
}

const factToneClasses: Record<NonNullable<QuickPreviewFactProps['tone']>, string> = {
  danger: 'border border-danger/20 bg-danger/10',
  info: 'border border-info/20 bg-info/10',
  neutral: 'bg-surface-muted/45',
  success: 'border border-success/20 bg-success/10',
  warning: 'border border-warning/25 bg-warning/10',
}

export function QuickPreviewFact({
  label,
  tone = 'neutral',
  value,
}: QuickPreviewFactProps) {
  return (
    <div className={cn('min-w-0 rounded-[0.65rem] px-2.5 py-2', factToneClasses[tone])}>
      <p className="text-xs font-semibold uppercase tracking-normal text-muted">
        {label}
      </p>
      <div className="mt-1 min-w-0 break-words text-sm font-semibold text-foreground">
        {value}
      </div>
    </div>
  )
}

export function QuickPreviewFactGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>
}
