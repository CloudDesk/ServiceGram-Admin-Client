import { type ReactNode, useMemo } from 'react'
import type { NavCrumb } from '../../types/common.types'
import { getPreferredRecoveryItem } from '../../routes/adminRouteRecovery'
import { useAuthStore } from '../../store/authStore'
import { PageContextHeader } from '../ui/PageHeader'
import { Skeleton } from '../ui/Skeleton'
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

const detailHeaderDockClassName =
  'sticky top-0 z-20 -mx-4 pb-3 premium-page-surface sm:-mx-6 lg:-mx-10'
const detailHeaderBarClassName =
  'border-y border-border bg-surface/95 px-4 py-2 shadow-[0_10px_24px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:px-6 lg:px-10'

export function DetailPageHeaderSkeleton() {
  return (
    <section aria-hidden="true" className={detailHeaderDockClassName}>
      <div className={detailHeaderBarClassName}>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-20" />
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-28" />
          </div>
        </div>
      </div>
    </section>
  )
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
  const can = useAuthStore((state) => state.can)
  const resolvedTitle = title ?? recordName
  const homeHref = useMemo(
    () => getPreferredRecoveryItem(can)?.href ?? listHref,
    [can, listHref],
  )
  const breadcrumbItems = breadcrumbs ?? [
    { label: 'Home', href: homeHref },
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
        <section className={detailHeaderDockClassName}>
          <div className={detailHeaderBarClassName}>
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
          </div>
        </section>
      ) : null}
    </>
  )
}
