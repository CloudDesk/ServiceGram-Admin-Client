import type { ReactNode } from 'react'
import type { NavCrumb } from '../../../types/common.types'
import { Breadcrumbs } from '../Breadcrumbs'

interface PageHeaderProps {
  breadcrumbs?: NavCrumb[]
  title: string
  description?: string
  titleMetaNode?: ReactNode
  actionNode?: ReactNode
  utilityNode?: ReactNode
  statsNode?: ReactNode
  tabsNode?: ReactNode
  compact?: boolean
}

export function PageContextHeader({
  actionNode,
  description,
  breadcrumbs,
  compact = false,
  statsNode,
  tabsNode,
  title,
  titleMetaNode,
  utilityNode,
}: PageHeaderProps) {
  return (
    <div className="space-y-3">
      {breadcrumbs?.length ? <Breadcrumbs items={breadcrumbs} /> : null}

      <div className="space-y-1.5">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1
              className={
                compact
                  ? 'text-[1.2rem] font-semibold tracking-[-0.03em] text-foreground'
                  : 'text-[1.55rem] font-semibold tracking-[-0.04em] text-foreground'
              }
            >
              {title}
            </h1>
            {titleMetaNode ? <div>{titleMetaNode}</div> : null}
          </div>
          {actionNode || utilityNode ? (
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {utilityNode}
              {actionNode}
            </div>
          ) : null}
        </div>
        {description ? (
          <p className="max-w-3xl text-sm leading-6 text-muted">{description}</p>
        ) : null}
      </div>

      {statsNode ? <div>{statsNode}</div> : null}
      {tabsNode ? <div>{tabsNode}</div> : null}
    </div>
  )
}

export const PageHeader = PageContextHeader
