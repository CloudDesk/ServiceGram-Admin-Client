import { ChevronRight, Home } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { NavCrumb } from '../../../types/common.types'

interface BreadcrumbsProps {
  items: NavCrumb[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const isHome = item.label === 'Home'
          const content = (
            <>
              {isHome ? <Home aria-hidden="true" className="size-3.5" /> : null}
              <span>{item.label}</span>
            </>
          )

          return (
            <li className="flex items-center gap-1.5" key={`${item.label}-${index}`}>
              {item.href ? (
                <Link
                  className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors hover:bg-surface-muted hover:text-foreground"
                  to={item.href}
                >
                  {content}
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 font-medium text-foreground">
                  {content}
                </span>
              )}
              {index < items.length - 1 ? <ChevronRight className="size-4 text-muted/70" /> : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
