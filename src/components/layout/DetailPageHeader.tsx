import type { ReactNode } from 'react'
import { routePaths } from '../../config/routes'
import type { NavCrumb } from '../../types/common.types'
import { PageContextHeader } from '../ui/PageHeader'
import { DetailBreadcrumbNav } from './DetailBreadcrumbNav'

interface DetailPageHeaderProps {
  backHref?: string
  backLabel?: string
  breadcrumbs?: NavCrumb[]
  listHref: string
  listLabel: string
  recordName: string
  showBreadcrumbs?: boolean
  title?: string
  description?: string
  titleMetaNode?: ReactNode
  actionNode?: ReactNode
}

export function DetailPageHeader({
  actionNode,
  backHref,
  backLabel,
  breadcrumbs,
  description,
  listHref,
  listLabel,
  recordName,
  showBreadcrumbs = true,
  title,
  titleMetaNode,
}: DetailPageHeaderProps) {
  const resolvedTitle = title ?? recordName
  const breadcrumbItems = breadcrumbs ?? [
    { label: 'Home', href: routePaths.dashboard },
    { label: listLabel, href: listHref },
    { label: recordName },
  ]

  return (
    <>
      <PageContextHeader
        description={description}
        placement="topbar"
        title={resolvedTitle}
      />
      {showBreadcrumbs || actionNode || titleMetaNode ? (
        <section className="sticky top-0 z-20 rounded-[0.875rem] border border-border bg-surface/95 px-3 py-2 shadow-[0_10px_24px_rgba(15,23,42,0.06)] backdrop-blur-xl">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            {showBreadcrumbs ? (
              <DetailBreadcrumbNav
                backHref={backHref ?? listHref}
                backLabel={backLabel}
                items={breadcrumbItems}
                variant="inline"
              />
            ) : null}
            {titleMetaNode || actionNode ? (
              <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
                {titleMetaNode ? (
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {titleMetaNode}
                  </div>
                ) : null}
                {actionNode ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {actionNode}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  )
}
