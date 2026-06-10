import type { ReactNode } from 'react'
import { routePaths } from '../../config/routes'
import { PageContextHeader } from '../ui/PageHeader'

interface DetailPageHeaderProps {
  listHref: string
  listLabel: string
  recordName: string
  title?: string
  description?: string
  titleMetaNode?: ReactNode
  actionNode?: ReactNode
}

export function DetailPageHeader({
  actionNode,
  description,
  listHref,
  listLabel,
  recordName,
  title,
  titleMetaNode,
}: DetailPageHeaderProps) {
  return (
    <section className="sticky top-0 z-40 rounded-2xl border border-border bg-surface/95 px-4 py-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:px-5 sm:py-5">
      <PageContextHeader
        actionNode={actionNode}
        breadcrumbs={[
          { label: 'Home', href: routePaths.dashboard },
          { label: listLabel, href: listHref },
          { label: recordName },
        ]}
        description={description}
        title={title ?? recordName}
        titleMetaNode={titleMetaNode}
      />
    </section>
  )
}
