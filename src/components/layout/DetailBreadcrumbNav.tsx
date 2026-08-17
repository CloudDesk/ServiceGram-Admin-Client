import { ChevronRight, Home } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { NavCrumb } from '../../types/common.types'
import { cn } from '../../utils/cn'

interface DetailBreadcrumbNavProps {
  className?: string
  items: NavCrumb[]
  variant?: 'bar' | 'inline'
}

export function DetailBreadcrumbNav({
  className,
  items,
  variant = 'bar',
}: DetailBreadcrumbNavProps) {
  const normalizedItems = items.filter((item) => item.label.trim().length > 0)
  const isInline = variant === 'inline'

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
      {/* No Back button: the parent crumb below navigates to the same place and
          names where it goes, and the browser's own Back covers history. */}
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
