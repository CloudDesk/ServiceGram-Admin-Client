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
  const resolvedTitle = title ?? recordName

  return (
    <>
      <PageContextHeader
        breadcrumbs={[
          { label: 'Home', href: routePaths.dashboard },
          { label: listLabel, href: listHref },
          { label: recordName },
        ]}
        description={description}
        placement="topbar"
        title={resolvedTitle}
      />
      {actionNode || titleMetaNode ? (
        <section className="sticky top-0 z-20 rounded-[1rem] border border-border bg-surface/95 px-4 py-3 shadow-[0_14px_34px_rgba(15,23,42,0.07)] backdrop-blur-xl sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {titleMetaNode ? (
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {titleMetaNode}
              </div>
            ) : (
              <span className="text-sm font-medium text-muted">
                {listLabel} actions
              </span>
            )}
            {actionNode ? (
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {actionNode}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  )
}
