import { Save } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../../components/ui/Button'
import { DetailPageHeader } from '../../../components/layout/DetailPageHeader'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Skeleton } from '../../../components/ui/Skeleton'
import { routePaths } from '../../../config/routes'
import { useAuthStore } from '../../../store/authStore'
import { rbacService } from '../services/rbac.service'
import { PermissionMatrix } from './PermissionMatrix'

export function CreateRolePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const can = useAuthStore((state) => state.can)
  const [roleCode, setRoleCode] = useState('')
  const [roleName, setRoleName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [formError, setFormError] = useState<string | null>(null)
  const canCreateRoles = can('roles:create')
  const canReadPermissions = can('permissions:read')

  const permissionsQuery = useQuery({
    enabled: canCreateRoles && canReadPermissions,
    queryKey: ['rbac', 'permissions'],
    queryFn: () => rbacService.getPermissions(),
  })

  const groups = useMemo(
    () => permissionsQuery.data?.data ?? [],
    [permissionsQuery.data?.data],
  )

  const createMutation = useMutation({
    mutationFn: () => {
      if (!canCreateRoles) {
        throw new Error('Role create access is required.')
      }

      if (!canReadPermissions) {
        throw new Error('Permission catalogue access is required to create roles.')
      }

      return rbacService.createRole({
        roleCode: roleCode.trim(),
        roleName: roleName.trim(),
        description: description.trim() || undefined,
        permissionIds: Array.from(selectedPermissionIds),
      })
    },
    onMutate: () => setFormError(null),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['rbac', 'roles'] })
      navigate(`${routePaths.roles}/${response.data.roleId}`)
    },
    onError: (error) => {
      setFormError(error instanceof Error ? error.message : 'Role creation failed.')
    },
  })

  const togglePermission = (permissionId: string, checked: boolean) => {
    setSelectedPermissionIds((current) => {
      const next = new Set(current)

      if (checked) {
        next.add(permissionId)
      } else {
        next.delete(permissionId)
      }

      return next
    })
  }

  const submitForm = () => {
    if (!canCreateRoles) {
      setFormError('You do not have access to create roles.')
      return
    }

    if (!canReadPermissions) {
      setFormError('Permission catalogue access is required to create roles.')
      return
    }

    if (!roleCode.trim() || !roleName.trim()) {
      setFormError('Role code and role name are required.')
      return
    }

    void createMutation.mutateAsync()
  }

  if (!canCreateRoles) {
    return (
      <PageContainer>
        <ErrorState
          description="Your current admin role cannot create roles."
          title="Role creation unavailable"
        />
      </PageContainer>
    )
  }

  if (!canReadPermissions) {
    return (
      <PageContainer>
        <DetailPageHeader
          description="Permission catalogue access is required before assigning role access."
          listHref={routePaths.roles}
          listLabel="Roles"
          recordName="Create Role"
        />
        <ErrorState
          description="You can review existing roles, but creating a role requires permission catalogue access so the starting access set can be selected safely."
          title="Permission access required"
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <DetailPageHeader
        actionNode={
          <Button
            disabled={createMutation.isPending || permissionsQuery.isLoading}
            size="sm"
            onClick={submitForm}
          >
            <Save className="mr-2 size-4" />
            Create Role
          </Button>
        }
        description="Create a custom admin role and assign its starting access."
        listHref={routePaths.roles}
        listLabel="Roles"
        recordName="Create Role"
      />

      {formError ? (
        <ErrorState description={formError} title="Cannot create role" />
      ) : null}

      <section className="space-y-4 rounded-[1rem] border border-border bg-surface p-4">
        <h2 className="text-base font-semibold text-foreground">Role Details</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Role Code</span>
            <Input
              className="min-h-11"
              placeholder="CITY_OPERATIONS_LEAD"
              value={roleCode}
              onChange={(event) =>
                setRoleCode(event.target.value.toUpperCase().replace(/\s+/g, '_'))
              }
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Role Name</span>
            <Input
              className="min-h-11"
              placeholder="City Operations Lead"
              value={roleName}
              onChange={(event) => setRoleName(event.target.value)}
            />
          </label>
          <label className="space-y-1 lg:col-span-2">
            <span className="text-sm font-medium text-foreground">Description</span>
            <textarea
              className="min-h-24 w-full rounded-[0.9rem] border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none"
              placeholder="Role purpose and responsibility"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="space-y-4 rounded-[1rem] border border-border bg-surface p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Permissions
            </h2>
            <p className="text-sm text-muted">
              {selectedPermissionIds.size} selected
            </p>
          </div>
        </div>

        {permissionsQuery.isError ? (
          <ErrorState
            description={
              permissionsQuery.error instanceof Error
                ? permissionsQuery.error.message
                : 'We could not load permissions. Please retry.'
            }
            title="Permissions unavailable"
            onRetry={() => void permissionsQuery.refetch()}
          />
        ) : permissionsQuery.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : groups.length === 0 ? (
          <EmptyState
            description="No permissions are available for role setup."
            title="No permissions"
          />
        ) : (
          <PermissionMatrix
            groups={groups}
            selectedPermissionIds={selectedPermissionIds}
            onToggle={togglePermission}
          />
        )}
      </section>
    </PageContainer>
  )
}
