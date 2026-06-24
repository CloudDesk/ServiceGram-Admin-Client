import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { PageContainer } from '../../../components/layout/PageContainer'
import { ListFilterBar } from '../../../components/layout/ListFilterBar'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import {
  DynamicTable,
  TableSkeleton,
  type DynamicTableColumn,
} from '../../../components/ui/Table'
import { routePaths } from '../../../config/routes'
import { adminUserService } from '../services/adminUser.service'
import type {
  AdminUser,
  AdminUsersQueryParams,
  AdminUserStatus,
} from '../types/adminUser.types'

const DEFAULT_PAGE_SIZE = 10

const adminUserColumns: DynamicTableColumn<AdminUser>[] = [
  {
    key: 'fullName',
    label: 'User',
    minWidth: 260,
    renderCell: (row) => (
      <div>
        <p className="font-medium">{row.fullName}</p>
        <p className="text-xs text-muted">{row.email ?? 'No email'}</p>
      </div>
    ),
  },
  {
    key: 'role',
    label: 'Role',
    minWidth: 220,
    getValue: (row) => row.role?.roleName ?? 'Unassigned',
    renderCell: (row) => (
      <div>
        <p className="font-medium">{row.role?.roleName ?? 'Unassigned'}</p>
        <p className="text-xs text-muted">{row.role?.roleCode ?? 'No role code'}</p>
      </div>
    ),
  },
  {
    key: 'status',
    label: 'Admin Status',
    format: 'status',
    statusTone: (value) => (value === 'ACTIVE' ? 'success' : 'danger'),
    minWidth: 160,
  },
  {
    key: 'userStatus',
    label: 'User Status',
    format: 'status',
    minWidth: 160,
  },
  {
    key: 'permissionVersion',
    label: 'Permission Version',
    minWidth: 170,
  },
  {
    key: 'lastLoginAt',
    label: 'Last Login',
    format: 'date',
    minWidth: 180,
    placeholder: 'Never',
  },
  {
    key: 'updatedAt',
    label: 'Updated',
    format: 'date',
    minWidth: 180,
  },
]

export function AdminUsersPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'' | AdminUserStatus>('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)

  const query = useMemo<AdminUsersQueryParams>(
    () => ({
      page,
      limit,
      search: search.trim() || undefined,
      status: status || undefined,
    }),
    [limit, page, search, status],
  )

  const adminUsersQuery = useQuery({
    queryKey: ['admin-users', query],
    queryFn: () => adminUserService.getAdminUsers(query),
  })

  const users = adminUsersQuery.data?.data ?? []
  const pagination = adminUsersQuery.data?.pagination
  const isLoading = adminUsersQuery.isLoading || adminUsersQuery.isFetching
  const resetToFirstPage = () => setPage(1)

  return (
    <PageContainer>
      <PageContextHeader
        description="Manage admin access, status, and assigned roles."
        placement="topbar"
        title="Users"
      />

      <div className="list-workspace">
        <ListFilterBar
          actionNode={
            <Link to={`${routePaths.adminUsers}/new`}>
              <Button size="sm">Add User</Button>
            </Link>
          }
          primaryFilters={
            <>
              <label className="space-y-1">
                <span className="text-sm font-medium text-foreground">Search</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                  <Input className="min-h-11 pl-9" placeholder="Search by admin name or email" value={search} onChange={(event) => { setSearch(event.target.value); resetToFirstPage() }} />
                </div>
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-foreground">Status</span>
                <select className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none" value={status} onChange={(event) => { setStatus(event.target.value as '' | AdminUserStatus); resetToFirstPage() }}>
                  <option value="">All</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="DISABLED">DISABLED</option>
                </select>
              </label>
            </>
          }
        />

        <section className="list-results-panel">
        {adminUsersQuery.isError ? (
          <ErrorState
            description="We could not load admin users. Please retry."
            title="Admin users unavailable"
            onRetry={() => void adminUsersQuery.refetch()}
          />
        ) : isLoading ? (
          <TableSkeleton
            columns={adminUserColumns}
            hasFooter={Boolean(pagination)}
            rowCount={8}
          />
        ) : users.length === 0 ? (
          <EmptyState
            description="No admin users matched the selected filters."
            title="No admin users"
          />
        ) : (
          <DynamicTable
            bodyMaxHeight={560}
            columns={adminUserColumns}
            data={users}
            pagination={
              pagination
                ? {
                    page: pagination.page,
                    pageSize: pagination.limit,
                    total: pagination.totalItems,
                    onPageChange: (nextPage) => setPage(nextPage),
                    onPageSizeChange: (nextLimit) => {
                      setLimit(nextLimit)
                      setPage(1)
                    },
                    rowsPerPageOptions: [10, 20, 50, 100],
                  }
                : {
                    page: 1,
                    pageSize: users.length || 1,
                    total: users.length,
                  }
            }
            title="Admin users"
            getRowId={(row) => row.adminId}
            onRowClick={(row) =>
              navigate(`${routePaths.adminUsers}/${row.adminId}`)
            }
          />
        )}

        </section>
      </div>
    </PageContainer>
  )
}
