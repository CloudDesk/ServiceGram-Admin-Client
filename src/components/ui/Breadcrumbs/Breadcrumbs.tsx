import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { NavCrumb } from '../../../types/common.types'

interface BreadcrumbsProps {
  items: NavCrumb[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, index) => (
          <li className="flex items-center gap-2" key={`${item.label}-${index}`}>
            {item.href ? (
              <Link className="transition-colors hover:text-foreground" to={item.href}>
                {item.label}
              </Link>
            ) : (
              <span className="text-foreground">{item.label}</span>
            )}
            {index < items.length - 1 ? <ChevronRight className="size-4" /> : null}
          </li>
        ))}
      </ol>
    </nav>
  )
}
