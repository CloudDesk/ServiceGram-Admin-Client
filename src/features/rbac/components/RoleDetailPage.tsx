import type { ReactNode } from 'react'
import { CalendarClock, KeyRound, Lock, Save, ShieldCheck, ToggleLeft } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { DetailPageHeader } from '../../../components/layout/DetailPageHeader'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Skeleton } from '../../../components/ui/Skeleton'
import { routePaths } from '../../../config/routes'
import { useAuthStore } from '../../../store/authStore'
import { formatDate } from '../../../utils/formatDate'
import { rbacService } from '../services/rbac.service'
import { PermissionMatrix } from './PermissionMatrix'
import type { RoleDetail } from '../types/rbac.types'

interface RoleDraft {
  roleId: string
  roleName: string
  description: string
  isActive: boolean
  permissionIds: Set<string>
}

function DetailField({
  label,
  value,
}: {
  label: string
  value: string | number | null | undefined
}) {
  return (
    <div className="min-w-0 rounded-[0.75rem] border border-border bg-surface-muted/60 p-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-muted">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-foreground">
        {value ?? 'Not available'}
      </p>
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  meta,
  value,
}: {
  icon: ReactNode
  label: string
  meta: string
  value: ReactNode
}) {
  return (
    <div className="min-h-[4.35rem] rounded-[0.75rem] border border-border bg-surface p-2.5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-muted">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tracking-normal text-foreground">
        {value}
      </div>
      <p className="mt-0.5 text-xs leading-4 text-muted">{meta}</p>
    </div>
  )
}

function RoleStatus({ role }: { role: RoleDetail }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={role.isActive ? 'success' : 'danger'}>
        {role.isActive ? 'Active' : 'Inactive'}
      </Badge>
      <Badge tone={role.isSystem ? 'info' : 'neutral'}>
        {role.isSystem ? 'System' : 'Custom'}
      </Badge>
      <Badge tone="neutral">{role.permissions.length} permissions</Badge>
    </div>
  )
}

function areSetsEqual(left: Set<string>, right: Set<string>) {
  if (left.size !== right.size) {
    return false
  }

  for (const value of left) {
    if (!right.has(value)) {
      return false
    }
  }

  return true
}

export function RoleDetailPage() {
  const { roleId } = useParams()
  const queryClient = useQueryClient()
  const can = useAuthStore((state) => state.can)
  const [draft, setDraft] = useState<RoleDraft | null>(null)
  const [detailsReason, setDetailsReason] = useState('')
  const [permissionsReason, setPermissionsReason] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const roleQuery = useQuery({
    enabled: Boolean(roleId),
    queryKey: ['rbac', 'roles', roleId],
    queryFn: () => rbacService.getRoleById(roleId as string),
  })

  const permissionsQuery = useQuery({
    queryKey: ['rbac', 'permissions'],
    queryFn: () => rbacService.getPermissions(),
  })

  const role = roleQuery.data?.data
  const permissionGroups = permissionsQuery.data?.data ?? []
  const canUpdateRole =
    Boolean(role) &&
    !role?.isSystem &&
    can('roles:update')
  const canManagePermissions =
    Boolean(role) &&
    !role?.isSystem &&
    can('roles:manage_permissions')
  const currentPermissionIds = useMemo(
    () => new Set(role?.permissions.map((permission) => permission.permissionId) ?? []),
    [role?.permissions],
  )
  const activeDraft = draft?.roleId === role?.roleId ? draft : null
  const roleName = activeDraft?.roleName ?? role?.roleName ?? ''
  const description = activeDraft?.description ?? role?.description ?? ''
  const isActive = activeDraft?.isActive ?? role?.isActive ?? true
  const selectedPermissionIds = activeDraft?.permissionIds ?? currentPermissionIds
  const permissionsChanged = !areSetsEqual(
    selectedPermissionIds,
    currentPermissionIds,
  )
  const detailsChanged = Boolean(
    role &&
      (roleName.trim() !== role.roleName ||
        (description.trim() || null) !== role.description ||
        isActive !== role.isActive),
  )

  const updateDraft = (updater: (current: RoleDraft) => RoleDraft) => {
    if (!role) {
      return
    }

    setDraft((current) => {
      const base =
        current?.roleId === role.roleId
          ? current
          : {
              roleId: role.roleId,
              roleName: role.roleName,
              description: role.description ?? '',
              isActive: role.isActive,
              permissionIds: new Set(currentPermissionIds),
            }

      return updater(base)
    })
  }

  const refreshRole = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['rbac', 'roles'] }),
      queryClient.invalidateQueries({ queryKey: ['rbac', 'roles', roleId] }),
    ])
  }

  const updateDetailsMutation = useMutation({
    mutationFn: () => {
      if (!roleId) {
        throw new Error('Role id is missing.')
      }

      return rbacService.updateRole(roleId, {
        roleName: roleName.trim(),
        description: description.trim() || null,
        isActive,
        reason: detailsReason.trim(),
      })
    },
    onMutate: () => {
      setActionError(null)
      setActionMessage(null)
    },
    onSuccess: async (response) => {
      setActionMessage(response.message ?? 'Role details updated.')
      setDetailsReason('')
      setDraft(null)
      await refreshRole()
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : 'Role details update failed.',
      )
    },
  })

  const updatePermissionsMutation = useMutation({
    mutationFn: () => {
      if (!roleId) {
        throw new Error('Role id is missing.')
      }

      return rbacService.updateRolePermissions(roleId, {
        permissionIds: Array.from(selectedPermissionIds),
        reason: permissionsReason.trim(),
      })
    },
    onMutate: () => {
      setActionError(null)
      setActionMessage(null)
    },
    onSuccess: async (response) => {
      setActionMessage(response.message ?? 'Role permissions updated.')
      setPermissionsReason('')
      setDraft(null)
      await refreshRole()
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : 'Role permissions update failed.',
      )
    },
  })

  const togglePermission = (permissionId: string, checked: boolean) => {
    updateDraft((current) => {
      const next = new Set(current.permissionIds)

      if (checked) {
        next.add(permissionId)
      } else {
        next.delete(permissionId)
      }

      return {
        ...current,
        permissionIds: next,
      }
    })
  }

  const saveDetails = () => {
    if (!detailsReason.trim()) {
      setActionError('Audit reason is required for role detail changes.')
      return
    }

    void updateDetailsMutation.mutateAsync()
  }

  const savePermissions = () => {
    if (!permissionsReason.trim()) {
      setActionError('Audit reason is required for permission changes.')
      return
    }

    void updatePermissionsMutation.mutateAsync()
  }

  if (!roleId) {
    return (
      <PageContainer>
        <ErrorState
          description="The role route is missing a role id."
          title="Role not found"
        />
      </PageContainer>
    )
  }

  if (roleQuery.isLoading) {
    return (
      <PageContainer>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[28rem] w-full" />
      </PageContainer>
    )
  }

  if (roleQuery.isError || !role) {
    return (
      <PageContainer>
        <ErrorState
          description={
            roleQuery.error instanceof Error
              ? roleQuery.error.message
              : 'We could not load this role. Please retry.'
          }
          title="Role unavailable"
          onRetry={() => void roleQuery.refetch()}
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <DetailPageHeader
        actionNode={
          <div className="flex flex-wrap justify-end gap-2">
            {role.isSystem ? (
              <Button disabled size="sm" variant="secondary">
                <Lock className="mr-2 size-4" />
                System Role
              </Button>
            ) : null}
            {canUpdateRole ? (
              <Button
                disabled={!detailsChanged || updateDetailsMutation.isPending}
                size="sm"
                variant="secondary"
                onClick={saveDetails}
              >
                <Save className="mr-2 size-4" />
                Save Details
              </Button>
            ) : null}
            {canManagePermissions ? (
              <Button
                disabled={
                  !permissionsChanged || updatePermissionsMutation.isPending
                }
                size="sm"
                onClick={savePermissions}
              >
                <ShieldCheck className="mr-2 size-4" />
                Save Permissions
              </Button>
            ) : null}
          </div>
        }
        description={role.description ?? role.roleCode}
        listHref={routePaths.roles}
        listLabel="Roles"
        recordName={role.roleName}
        titleMetaNode={<RoleStatus role={role} />}
      />

      <section className="grid shrink-0 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<ToggleLeft className="size-4 text-success" />}
          label="Status"
          meta="Role availability"
          value={
            <Badge tone={role.isActive ? 'success' : 'danger'}>
              {role.isActive ? 'Active' : 'Inactive'}
            </Badge>
          }
        />
        <SummaryCard
          icon={<KeyRound className="size-4 text-info" />}
          label="Type"
          meta={role.roleCode}
          value={role.isSystem ? 'System' : 'Custom'}
        />
        <SummaryCard
          icon={<ShieldCheck className="size-4 text-warning" />}
          label="Permissions"
          meta="Assigned to role"
          value={role.permissions.length}
        />
        <SummaryCard
          icon={<CalendarClock className="size-4 text-primary" />}
          label="Updated"
          meta="Backend timestamp"
          value={formatDate(role.updatedAt, true)}
        />
      </section>

      {actionError ? (
        <div className="rounded-[1rem] border border-danger/25 bg-danger/10 p-3 text-sm text-danger">
          {actionError}
        </div>
      ) : null}
      {actionMessage ? (
        <div className="rounded-[1rem] border border-success/25 bg-success/10 p-3 text-sm text-success">
          {actionMessage}
        </div>
      ) : null}
      {role.isSystem ? (
        <div className="rounded-[0.875rem] border border-info/25 bg-info/10 p-3 text-sm text-info">
          System roles are locked. Create or edit a custom role to change access.
        </div>
      ) : null}

      <section className="grid gap-3 lg:grid-cols-3">
        <div className="space-y-4 rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface">
          <h2 className="text-base font-semibold text-foreground">Role Summary</h2>
          <div className="grid gap-3">
            <DetailField label="Role ID" value={role.roleId} />
            <DetailField label="Role Code" value={role.roleCode} />
            <DetailField label="Created At" value={formatDate(role.createdAt, true)} />
            <DetailField label="Updated At" value={formatDate(role.updatedAt, true)} />
          </div>
        </div>

        <div className="space-y-4 rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface lg:col-span-2">
          <h2 className="text-base font-semibold text-foreground">Role Details</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-foreground">Role Name</span>
              <Input
                className="min-h-11"
                disabled={!canUpdateRole}
                value={roleName}
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    roleName: event.target.value,
                  }))
                }
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-foreground">Status</span>
              <select
                className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-70"
                disabled={!canUpdateRole}
                value={isActive ? 'ACTIVE' : 'INACTIVE'}
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    isActive: event.target.value === 'ACTIVE',
                  }))
                }
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </label>
            <label className="space-y-1 lg:col-span-2">
              <span className="text-sm font-medium text-foreground">Description</span>
              <textarea
                className="min-h-24 w-full rounded-[0.9rem] border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-70"
                disabled={!canUpdateRole}
                value={description}
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </label>
            {canUpdateRole ? (
              <label className="space-y-1 lg:col-span-2">
                <span className="text-sm font-medium text-foreground">
                  Audit Reason
                </span>
                <textarea
                  className="min-h-20 w-full rounded-[0.9rem] border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none"
                  placeholder="Reason for role detail changes"
                  value={detailsReason}
                  onChange={(event) => setDetailsReason(event.target.value)}
                />
              </label>
            ) : null}
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Permissions
            </h2>
            <p className="text-sm text-muted">
              {selectedPermissionIds.size} selected
            </p>
          </div>
          {canManagePermissions ? (
            <label className="w-full space-y-1 lg:max-w-xl">
              <span className="text-sm font-medium text-foreground">
                Audit Reason
              </span>
              <textarea
                className="min-h-20 w-full rounded-[0.9rem] border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none"
                placeholder="Reason for permission changes"
                value={permissionsReason}
                onChange={(event) => setPermissionsReason(event.target.value)}
              />
            </label>
          ) : null}
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
        ) : (
          <PermissionMatrix
            disabled={!canManagePermissions}
            groups={permissionGroups}
            selectedPermissionIds={selectedPermissionIds}
            onToggle={togglePermission}
          />
        )}
      </section>
    </PageContainer>
  )
}
