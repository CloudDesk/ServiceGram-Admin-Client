import { FilePlus2, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../../components/ui/Button'
import { DynamicTable, TableSkeleton, type DynamicTableColumn } from '../../../components/ui/Table'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import { ListFilterBar } from '../../../components/layout/ListFilterBar'
import { routePaths } from '../../../config/routes'
import { contentService } from '../services/content.service'
import type {
  ContentPage as ContentPageRecord,
  ContentPagesQueryParams,
  ContentPageStatus,
  ContentPageType,
} from '../types/content.types'

const DEFAULT_PAGE_SIZE = 10
const statuses: ContentPageStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED']
const pageTypes: ContentPageType[] = [
  'LEGAL',
  'FAQ',
  'SUPPORT',
  'ONBOARDING',
  'POLICY',
  'MARKETING',
]

const columns: DynamicTableColumn<ContentPageRecord>[] = [
  {
    key: 'title',
    label: 'Page',
    minWidth: 280,
    renderCell: (page) => (
      <div>
        <p className="font-semibold text-foreground">{page.title}</p>
        <p className="text-xs text-muted">{page.slug}</p>
      </div>
    ),
  },
  {
    key: 'pageType',
    label: 'Type',
    format: 'status',
    statusTone: 'info',
    minWidth: 140,
  },
  {
    key: 'status',
    label: 'Status',
    format: 'status',
    statusTone: (value) =>
      value === 'PUBLISHED' ? 'success' : value === 'ARCHIVED' ? 'neutral' : 'warning',
    minWidth: 140,
  },
  {
    key: 'version',
    label: 'Version',
    minWidth: 120,
  },
  {
    key: 'isVisibleToCustomers',
    label: 'Visible',
    minWidth: 120,
    renderCell: (page) => (page.isVisibleToCustomers ? 'Yes' : 'No'),
  },
  {
    key: 'updatedAt',
    label: 'Updated',
    format: 'date',
    minWidth: 180,
    getValue: (page) => page.lifecycle.updatedAt,
  },
]

export function ContentPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'' | ContentPageStatus>('')
  const [pageType, setPageType] = useState<'' | ContentPageType>('')

  const query = useMemo<ContentPagesQueryParams>(
    () => ({
      page,
      limit,
      search: search.trim() || undefined,
      status: status || undefined,
      pageType: pageType || undefined,
    }),
    [limit, page, pageType, search, status],
  )

  const contentQuery = useQuery({
    queryKey: ['content-pages', query],
    queryFn: () => contentService.getPages(query),
  })

  const pages = contentQuery.data?.data ?? []
  const pagination = contentQuery.data?.pagination
  const isLoading = contentQuery.isLoading || contentQuery.isFetching
  const resetToFirstPage = () => setPage(1)

  return (
    <PageContainer>
      <PageContextHeader
        description="Manage app content pages, policies, FAQs, and support copy."
        placement="topbar"
        title="Content"
      />

      <div className="list-workspace">
        <ListFilterBar
          actionNode={
            <Link to={`${routePaths.content}/new`}>
              <Button size="sm">
                <FilePlus2 className="mr-2 size-4" />
                New Content
              </Button>
            </Link>
          }
          primaryFilters={
            <>
              <label className="space-y-1">
                <span className="text-sm font-medium text-foreground">Search</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                  <Input className="pl-9" placeholder="Slug, title, excerpt" value={search} onChange={(event) => { setSearch(event.target.value); resetToFirstPage() }} />
                </div>
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-foreground">Status</span>
                <select className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none" value={status} onChange={(event) => { setStatus(event.target.value as '' | ContentPageStatus); resetToFirstPage() }}>
                  <option value="">All</option>
                  {statuses.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-foreground">Type</span>
                <select className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none" value={pageType} onChange={(event) => { setPageType(event.target.value as '' | ContentPageType); resetToFirstPage() }}>
                  <option value="">All</option>
                  {pageTypes.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </>
          }
        />

        <section className="list-results-panel">
        {contentQuery.isError ? (
          <ErrorState
            description="We could not load content pages."
            title="Content unavailable"
            onRetry={() => void contentQuery.refetch()}
          />
        ) : isLoading ? (
          <TableSkeleton columns={columns} hasFooter={Boolean(pagination)} rowCount={8} />
        ) : pages.length === 0 ? (
          <EmptyState description="No content pages matched this filter." title="No content pages" />
        ) : (
          <DynamicTable
            bodyMaxHeight={560}
            columns={columns}
            data={pages}
            pagination={
              pagination
                ? {
                    page: pagination.page,
                    pageSize: pagination.limit,
                    total: pagination.totalItems,
                    onPageChange: setPage,
                    onPageSizeChange: (nextLimit) => {
                      setLimit(nextLimit)
                      setPage(1)
                    },
                    rowsPerPageOptions: [10, 20, 50, 100],
                  }
                : undefined
            }
            title="Content Pages"
            getRowId={(contentPage) => contentPage.pageId}
            onRowClick={(contentPage) =>
              navigate(`${routePaths.content}/${contentPage.pageId}`)
            }
          />
        )}
        </section>
      </div>
    </PageContainer>
  )
}
