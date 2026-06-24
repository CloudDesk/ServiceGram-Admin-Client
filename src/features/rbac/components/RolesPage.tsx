import { Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
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
import { useAuthStore } from '../../../store/authStore'
import { rbacService } from '../services/rbac.service'
import type { RoleSummary } from '../types/rbac.types'

const roleColumns: DynamicTableColumn<RoleSummary>[] = [
  {
    key: 'roleName',
    label: 'Role',
    minWidth: 260,
    renderCell: (row) => (
      <div>
        <p className="font-medium">{row.roleName}</p>
        <p className="break-words text-xs text-muted">{row.roleCode}</p>
      </div>
    ),
  },
  {
    key: 'type',
    label: 'Type',
    minWidth: 140,
    renderCell: (row) => (
      <Badge tone={row.isSystem ? 'info' : 'neutral'}>
        {row.isSystem ? 'System' : 'Custom'}
      </Badge>
    ),
  },
  {
    key: 'isActive',
    label: 'Status',
    minWidth: 140,
    renderCell: (row) => (
      <Badge tone={row.isActive ? 'success' : 'danger'}>
        {row.isActive ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
  {
    key: 'permissionCount',
    label: 'Permissions',
    minWidth: 150,
  },
  {
    key: 'description',
    label: 'Description',
    minWidth: 300,
    placeholder: 'Not available',
  },
  {
    key: 'updatedAt',
    label: 'Updated',
    format: 'date',
    minWidth: 180,
  },
]

export function RolesPage() {
  const navigate = useNavigate()
  const can = useAuthStore((state) => state.can)
  const [search, setSearch] = useState('')

  const rolesQuery = useQuery({
    queryKey: ['rbac', 'roles'],
    queryFn: () => rbacService.getRoles(),
  })

  const filteredRoles = useMemo(() => {
    const roles = rolesQuery.data?.data ?? []
    const query = search.trim().toLowerCase()

    if (!query) {
      return roles
    }

    return roles.filter((role) =>
      [role.roleName, role.roleCode, role.description ?? ''].some((value) =>
        value.toLowerCase().includes(query),
      ),
    )
  }, [rolesQuery.data?.data, search])
  const canCreateRoles = can('roles:create')
  const isLoading = rolesQuery.isLoading || rolesQuery.isFetching

  return (
    <PageContainer>
      <PageContextHeader
        description="Manage admin role access across platform modules."
        placement="topbar"
        title="Roles"
      />

      <div className="list-workspace">
        <ListFilterBar
          actionNode={
            canCreateRoles ? (
              <Link to={`${routePaths.roles}/new`}>
                <Button size="sm">
                  <Plus className="mr-2 size-4" />
                  New Role
                </Button>
              </Link>
            ) : null
          }
          primaryFilters={
            <label className="space-y-1">
              <span className="text-sm font-medium text-foreground">Search</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <Input className="min-h-11 pl-9" placeholder="Search by role name, code, or description" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
            </label>
          }
        />

        <section className="list-results-panel">
        {rolesQuery.isError ? (
          <ErrorState
            description={
              rolesQuery.error instanceof Error
                ? rolesQuery.error.message
                : 'We could not load roles. Please retry.'
            }
            title="Roles unavailable"
            onRetry={() => void rolesQuery.refetch()}
          />
        ) : isLoading ? (
          <TableSkeleton columns={roleColumns} rowCount={8} />
        ) : filteredRoles.length === 0 ? (
          <EmptyState
            description="No roles matched the selected filters."
            title="No roles"
          />
        ) : (
          <DynamicTable
            bodyMaxHeight={600}
            columns={roleColumns}
            data={filteredRoles}
            pagination={{
              page: 1,
              pageSize: filteredRoles.length || 1,
              total: filteredRoles.length,
            }}
            title="Roles"
            getRowId={(row) => row.roleId}
            onRowClick={(row) => navigate(`${routePaths.roles}/${row.roleId}`)}
          />
        )}
        </section>
      </div>
    </PageContainer>
  )
}
