import { ArrowLeft, ChevronRight, Home } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { routePaths } from '../../config/routes'
import type { NavCrumb } from '../../types/common.types'
import { cn } from '../../utils/cn'

interface DetailBreadcrumbNavProps {
  backHref?: string
  backLabel?: string
  className?: string
  items: NavCrumb[]
  variant?: 'bar' | 'inline'
}

function getBackHref(items: NavCrumb[], backHref?: string) {
  if (backHref) return backHref

  const previousLinkedCrumb = [...items]
    .reverse()
    .find((item) => Boolean(item.href))

  return previousLinkedCrumb?.href ?? routePaths.dashboard
}

export function DetailBreadcrumbNav({
  backHref,
  backLabel = 'Back',
  className,
  items,
  variant = 'bar',
}: DetailBreadcrumbNavProps) {
  const navigate = useNavigate()
  const normalizedItems = items.filter((item) => item.label.trim().length > 0)
  const resolvedBackHref = getBackHref(normalizedItems, backHref)
  const isInline = variant === 'inline'

  const goBack = () => {
    const historyIndex = window.history.state?.idx

    if (typeof historyIndex === 'number' && historyIndex > 0) {
      navigate(-1)
      return
    }

    navigate(resolvedBackHref)
  }

  if (!normalizedItems.length) {
    return null
  }

  return (
    <nav
      aria-label="Detail breadcrumb"
      className={cn(
        isInline
          ? 'flex min-w-0 flex-1 items-center gap-2'
          : 'flex min-w-0 items-center gap-2 rounded-[0.875rem] border border-border bg-surface px-2.5 py-2 shadow-surface',
        className,
      )}
    >
      <button
        className={cn(
          'inline-flex shrink-0 items-center gap-2 rounded-[0.7rem] text-sm font-semibold text-foreground transition hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isInline ? 'h-8 px-2' : 'h-9 px-2.5',
        )}
        type="button"
        onClick={goBack}
      >
        <ArrowLeft className="size-4" />
        <span>{backLabel}</span>
      </button>

      <span
        aria-hidden="true"
        className={cn('w-px shrink-0 bg-border', isInline ? 'h-4' : 'h-5')}
      />

      <ol
        className={cn(
          'flex min-w-0 flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap pr-1 text-muted',
          isInline ? 'text-xs sm:text-sm' : 'text-sm',
        )}
      >
        {normalizedItems.map((item, index) => {
          const isLast = index === normalizedItems.length - 1
          const isHome = item.label === 'Home'
          const content = (
            <>
              {isHome ? <Home aria-hidden="true" className="size-3.5" /> : null}
              <span className="truncate">{item.label}</span>
            </>
          )

          return (
            <li
              className="flex min-w-0 shrink-0 items-center gap-1"
              key={`${item.label}-${item.href ?? 'current'}-${index}`}
            >
              {item.href && !isLast ? (
                <Link
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-[0.65rem] transition hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isInline
                      ? 'max-w-[9rem] px-1.5 py-0.5 lg:max-w-[12rem]'
                      : 'max-w-[12rem] px-2 py-1',
                  )}
                  title={item.label}
                  to={item.href}
                >
                  {content}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={cn(
                    'inline-flex items-center gap-1.5 truncate rounded-[0.65rem] font-medium text-foreground',
                    isInline
                      ? 'max-w-[10rem] px-1.5 py-0.5 lg:max-w-[14rem]'
                      : 'max-w-[18rem] px-2 py-1',
                  )}
                  title={item.label}
                >
                  {content}
                </span>
              )}
              {!isLast ? (
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted/70"
                />
              ) : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
