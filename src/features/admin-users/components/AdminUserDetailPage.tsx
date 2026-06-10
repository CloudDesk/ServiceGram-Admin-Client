import { LogOut, Save } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { Skeleton } from '../../../components/ui/Skeleton'
import { DetailPageHeader } from '../../../components/layout/DetailPageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import { routePaths } from '../../../config/routes'
import { adminUserService } from '../services/adminUser.service'
import type { AdminUser, AdminUserStatus } from '../types/adminUser.types'

function DetailField({
  label,
  value,
}: {
  label: string
  value: string | number | null | undefined
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase text-muted">{label}</p>
      <p className="break-words text-sm text-foreground">{value ?? 'Not available'}</p>
    </div>
  )
}

function AdminUserHeaderStatus({ user }: { user: AdminUser }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={user.status === 'ACTIVE' ? 'success' : 'danger'}>
        {user.status}
      </Badge>
      <Badge tone={user.role?.isActive === false ? 'warning' : 'neutral'}>
        {user.role?.roleCode ?? 'NO_ROLE'}
      </Badge>
    </div>
  )
}

export function AdminUserDetailPage() {
  const { adminUserId } = useParams()
  const queryClient = useQueryClient()
  const [fullName, setFullName] = useState('')
  const [roleId, setRoleId] = useState('')
  const [status, setStatus] = useState<'' | AdminUserStatus>('')
  const [forceLogout, setForceLogout] = useState(false)
  const [reason, setReason] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const usersQuery = useQuery({
    enabled: Boolean(adminUserId),
    queryKey: ['admin-users', 'detail-resolver'],
    queryFn: () => adminUserService.getAdminUsers({ page: 1, limit: 100 }),
  })

  const user = useMemo(
    () => usersQuery.data?.data.find((item) => item.adminId === adminUserId),
    [adminUserId, usersQuery.data?.data],
  )

  const refreshUsers = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
  }

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!adminUserId) {
        throw new Error('Admin user id is missing.')
      }

      return adminUserService.updateAdminUser(adminUserId, {
        fullName: fullName.trim() || undefined,
        roleId: roleId.trim() || undefined,
        status: status || undefined,
        forceLogout,
        reason: reason.trim() || undefined,
      })
    },
    onMutate: () => {
      setActionError(null)
      setActionMessage(null)
    },
    onSuccess: async (response) => {
      setActionMessage(response.message ?? 'Admin user updated.')
      await refreshUsers()
      setFullName('')
      setRoleId('')
      setStatus('')
      setForceLogout(false)
      setReason('')
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : 'Admin user update failed.',
      )
    },
  })

  const forceLogoutMutation = useMutation({
    mutationFn: () => {
      if (!adminUserId) {
        throw new Error('Admin user id is missing.')
      }

      return adminUserService.forceLogoutAdminUser(adminUserId)
    },
    onMutate: () => {
      setActionError(null)
      setActionMessage(null)
    },
    onSuccess: (response) => {
      setActionMessage(
        `${response.data.revokedSessionCount} active session(s) revoked.`,
      )
      void refreshUsers()
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : 'Force logout failed.',
      )
    },
  })

  if (!adminUserId) {
    return (
      <PageContainer>
        <ErrorState
          description="The admin user route is missing an admin user id."
          title="Admin user not found"
        />
      </PageContainer>
    )
  }

  if (usersQuery.isLoading) {
    return (
      <PageContainer>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[28rem] w-full" />
      </PageContainer>
    )
  }

  if (usersQuery.isError) {
    return (
      <PageContainer>
        <ErrorState
          description="We could not load admin user details. Please retry."
          title="Admin user unavailable"
          onRetry={() => void usersQuery.refetch()}
        />
      </PageContainer>
    )
  }

  if (!user) {
    return (
      <PageContainer>
        <EmptyState
          description="Swagger does not expose a single admin-user detail endpoint. This page can only resolve users available from the list API response."
          title="Admin user not found"
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <DetailPageHeader
        actionNode={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              disabled={forceLogoutMutation.isPending}
              size="sm"
              variant="secondary"
              onClick={() => void forceLogoutMutation.mutateAsync()}
            >
              <LogOut className="mr-2 size-4" />
              Force Logout
            </Button>
            <Button
              disabled={updateMutation.isPending}
              size="sm"
              onClick={() => void updateMutation.mutateAsync()}
            >
              <Save className="mr-2 size-4" />
              Save Changes
            </Button>
          </div>
        }
        description={user.email ?? user.userId}
        listHref={routePaths.adminUsers}
        listLabel="Users"
        recordName={user.fullName}
        titleMetaNode={<AdminUserHeaderStatus user={user} />}
      />

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

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 rounded-[1rem] border border-border bg-surface p-4 lg:col-span-2">
          <h2 className="text-base font-semibold text-foreground">
            Admin User Information
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Admin ID" value={user.adminId} />
            <DetailField label="User ID" value={user.userId} />
            <DetailField label="Email" value={user.email} />
            <DetailField label="User Status" value={user.userStatus} />
            <DetailField label="Permission Version" value={user.permissionVersion} />
            <DetailField label="Last Login" value={user.lastLoginAt} />
            <DetailField label="Created At" value={user.createdAt} />
            <DetailField label="Updated At" value={user.updatedAt} />
          </div>
        </div>

        <div className="space-y-4 rounded-[1rem] border border-border bg-surface p-4">
          <h2 className="text-base font-semibold text-foreground">Role</h2>
          <DetailField label="Role Name" value={user.role?.roleName} />
          <DetailField label="Role Code" value={user.role?.roleCode} />
          <DetailField label="Role ID" value={user.role?.roleId} />
          <DetailField
            label="Role Type"
            value={user.role?.isSystem ? 'System' : 'Custom'}
          />
          <DetailField
            label="Role Active"
            value={
              user.role ? (user.role.isActive ? 'Active' : 'Inactive') : null
            }
          />
        </div>
      </section>

      <section className="space-y-4 rounded-[1rem] border border-border bg-surface p-4">
        <h2 className="text-base font-semibold text-foreground">Update User</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Full Name</span>
            <Input
              className="min-h-11"
              value={fullName || user.fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Role ID</span>
            <Input
              className="min-h-11"
              value={roleId || (user.role?.roleId ?? '')}
              onChange={(event) => setRoleId(event.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Status</span>
            <select
              className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
              value={status || user.status}
              onChange={(event) => setStatus(event.target.value as AdminUserStatus)}
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="DISABLED">DISABLED</option>
            </select>
          </label>
          <label className="flex items-center gap-2 pt-7 text-sm text-foreground">
            <input
              checked={forceLogout}
              type="checkbox"
              onChange={(event) => setForceLogout(event.target.checked)}
            />
            Force logout after update
          </label>
          <label className="space-y-1 lg:col-span-2">
            <span className="text-sm font-medium text-foreground">
              Audit Reason
            </span>
            <textarea
              className="min-h-24 w-full rounded-[0.9rem] border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none"
              placeholder="Reason for this admin user change"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
        </div>
      </section>
    </PageContainer>
  )
}
