import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowUpRight,
  ClipboardList,
  Edit3,
  LogOut,
  Save,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Modal } from '../../../components/ui/Modal'
import { Skeleton } from '../../../components/ui/Skeleton'
import {
  DetailPageHeader,
  DetailPageHeaderSkeleton,
} from '../../../components/layout/DetailPageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import { routePaths } from '../../../config/routes'
import { usePermission } from '../../../hooks/usePermission'
import {
  RecordBadgeGroup,
  RecordField,
  RecordFieldList,
  RecordHeaderActions,
  RecordMetricStrip,
  RecordSection,
  RecordTabs,
  RelatedRecordRow,
  type RecordAction,
  type RecordTabItem,
} from '../../../components/ui/RecordPage'
import type { StatusTone } from '../../../types/status.types'
import { buildPathWithQueryParams } from '../../../utils/buildQueryParams'
import { formatDate } from '../../../utils/formatDate'
import { rbacService } from '../../rbac/services/rbac.service'
import type { RoleSummary } from '../../rbac/types/rbac.types'
import { adminUserService } from '../services/adminUser.service'
import type {
  AdminUser,
  AdminUserStatus,
  UpdateAdminUserPayload,
} from '../types/adminUser.types'

type ModalKind = 'EDIT' | 'FORCE_LOGOUT'
export type AdminUserDetailTab = 'overview' | 'access' | 'guardrails'

const ADMIN_USER_DETAIL_TABS: AdminUserDetailTab[] = ['overview', 'access', 'guardrails']
const adminUserStatuses: AdminUserStatus[] = ['ACTIVE', 'DISABLED']

function humanizeCode(value: string | null | undefined) {
  if (!value) return 'Not available'

  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatDateSafe(value: string | null | undefined) {
  if (!value) return 'Not available'

  try {
    return formatDate(value, true)
  } catch {
    return 'Not available'
  }
}

function userStatusTone(status: AdminUserStatus): StatusTone {
  return status === 'ACTIVE' ? 'success' : 'danger'
}

function authStatusTone(status: string | null | undefined): StatusTone {
  if (status === 'ACTIVE') return 'success'
  if (status === 'DISABLED' || status === 'BLOCKED') return 'danger'
  return 'warning'
}

function getAdminUserWarnings(user: AdminUser) {
  const items: string[] = []

  if (user.status === 'DISABLED') items.push('ADMIN_DISABLED')
  if (user.userStatus && user.userStatus !== 'ACTIVE') {
    items.push(`AUTH_${user.userStatus}`)
  }
  if (!user.role) items.push('NO_ROLE_ASSIGNED')
  if (user.role?.isActive === false) items.push('ROLE_INACTIVE')
  if (!user.lastLoginAt) items.push('NEVER_LOGGED_IN')

  return items
}

function buildAdminUsersListPath(user: AdminUser) {
  return (
    buildPathWithQueryParams(routePaths.adminUsers, {
      search: user.email ?? user.fullName,
      status: user.status,
      roleId: user.role?.roleId,
    }) + '#admin-users-records'
  )
}

function buildAdminUserAuditPath(user: AdminUser) {
  const params = new URLSearchParams({
    moduleCode: 'admin_users',
    entityType: 'admin_user',
    entityId: user.adminId,
  })

  return `${routePaths.audit}?${params.toString()}`
}

function buildAdminUserActorAuditPath(user: AdminUser) {
  const params = new URLSearchParams({ actorAdminId: user.adminId })

  return `${routePaths.audit}?${params.toString()}`
}

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)

  if (parts.length === 0) return 'U'

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

function AdminUserHeroCard({ user }: { user: AdminUser }) {
  return (
    <section className="rounded-[0.875rem] border border-border bg-surface p-3 shadow-surface sm:p-4">
      <div className="flex min-w-0 items-start gap-3 sm:gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary ring-1 ring-primary/15">
          {getInitials(user.fullName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-lg font-semibold text-foreground sm:text-xl">
              {user.fullName}
            </h1>
            <Badge tone={userStatusTone(user.status)}>{humanizeCode(user.status)}</Badge>
            <Badge tone={authStatusTone(user.userStatus)}>
              Auth {humanizeCode(user.userStatus)}
            </Badge>
            <Badge tone={user.role?.isActive === false ? 'warning' : 'neutral'}>
              {user.role?.roleCode ?? 'NO_ROLE'}
            </Badge>
          </div>
          <p className="mt-1 truncate text-xs text-muted">
            {user.email ?? user.userId} · {user.adminId}
          </p>
        </div>
      </div>
    </section>
  )
}

function AdminUserDetailSectionNav({
  activeTab,
  guardrailCount,
  user,
}: {
  activeTab: AdminUserDetailTab
  guardrailCount: number
  user: AdminUser
}) {
  const items: RecordTabItem[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'access', label: 'Access', count: user.role ? 1 : 0 },
    { key: 'guardrails', label: 'Guardrails', count: guardrailCount },
  ]

  return (
    <RecordTabs
      activeTab={activeTab}
      ariaLabel="Admin user detail sections"
      basePath={`${routePaths.adminUsers}/${user.adminId}`}
      defaultTab="overview"
      items={items}
      tabPrefix="/tab"
    />
  )
}

function DetailSkeleton() {
  return (
    <PageContainer>
      <DetailPageHeaderSkeleton />
      <Skeleton className="h-24 w-full rounded-[0.875rem]" />
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton className="h-56 rounded-[0.875rem]" key={index} />
        ))}
      </div>
    </PageContainer>
  )
}

function AccountAndLifecyclePanel({ user }: { user: AdminUser }) {
  return (
    <RecordSection
      description="Identity fields and lifecycle timestamps from the admin user record."
      icon={<UserRound className="size-4" />}
      title="Account"
    >
      <RecordFieldList>
        <RecordField label="Full name" value={user.fullName} />
        <RecordField label="Email" value={user.email} />
        <RecordField
          label="Admin status"
          value={<Badge tone={userStatusTone(user.status)}>{humanizeCode(user.status)}</Badge>}
        />
        <RecordField
          label="Auth status"
          value={<Badge tone={authStatusTone(user.userStatus)}>{humanizeCode(user.userStatus)}</Badge>}
        />
        <RecordField label="Admin ID" value={user.adminId} />
        <RecordField label="Auth user ID" value={user.userId} />
        <RecordField label="Created" value={formatDateSafe(user.createdAt)} />
        <RecordField label="Last login" value={formatDateSafe(user.lastLoginAt)} />
      </RecordFieldList>
    </RecordSection>
  )
}

function RelatedRecordsPanel({
  canReadAudit,
  onNavigate,
  user,
}: {
  canReadAudit: boolean
  onNavigate: (path: string) => void
  user: AdminUser
}) {
  return (
    <RecordSection
      description="Shortcuts into the modules this admin account touches."
      icon={<ArrowUpRight className="size-4" />}
      title="Related records"
    >
      <div className="divide-y divide-border">
        <RelatedRecordRow
          actionLabel="Users"
          canOpen
          icon={<Users className="size-4" />}
          label="Admin users list"
          meta={`${humanizeCode(user.status)} · filtered to this admin`}
          value={user.email ?? user.adminId}
          onOpen={() => onNavigate(buildAdminUsersListPath(user))}
        />
        <RelatedRecordRow
          actionLabel="Audit"
          canOpen={canReadAudit}
          icon={<ClipboardList className="size-4" />}
          label="Audit trail"
          meta="Changes made to this admin's record"
          value={user.adminId}
          onOpen={() => onNavigate(buildAdminUserAuditPath(user))}
        />
        <RelatedRecordRow
          actionLabel="Activity"
          canOpen={canReadAudit}
          icon={<ClipboardList className="size-4" />}
          label="Performed actions"
          meta="Audit entries where this admin is the actor"
          value={user.fullName}
          onOpen={() => onNavigate(buildAdminUserActorAuditPath(user))}
        />
      </div>
    </RecordSection>
  )
}

function RolePanel({
  canReadRoles,
  onNavigate,
  user,
}: {
  canReadRoles: boolean
  onNavigate: (path: string) => void
  user: AdminUser
}) {
  const role = user.role

  return (
    <RecordSection
      actionNode={
        role && canReadRoles ? (
          <Button
            size="sm"
            type="button"
            variant="secondary"
            onClick={() => onNavigate(`${routePaths.roles}/${role.roleId}`)}
          >
            <ArrowUpRight className="mr-2 size-4" />
            Open role
          </Button>
        ) : null
      }
      description="Primary role assignment for this admin user. Change it from Edit in the header."
      icon={<ShieldCheck className="size-4" />}
      title="Role"
    >
      <RecordFieldList>
        <RecordField label="Role name" value={role?.roleName} />
        <RecordField label="Role code" value={role?.roleCode} />
        <RecordField label="Role ID" value={role?.roleId} />
        <RecordField label="Role type" value={role?.isSystem ? 'System' : role ? 'Custom' : null} />
        <RecordField
          label="Role active"
          value={
            role ? (
              <Badge tone={role.isActive ? 'success' : 'warning'}>
                {role.isActive ? 'Active' : 'Inactive'}
              </Badge>
            ) : null
          }
        />
      </RecordFieldList>
    </RecordSection>
  )
}

function GuardrailsPanel({
  canForceLogout,
  canReadAudit,
  canReadRoles,
  canUpdateAdminUsers,
  user,
}: {
  canForceLogout: boolean
  canReadAudit: boolean
  canReadRoles: boolean
  canUpdateAdminUsers: boolean
  user: AdminUser
}) {
  const warnings = useMemo(() => getAdminUserWarnings(user), [user])
  const controls = useMemo(() => {
    const items: string[] = []

    if (canUpdateAdminUsers) items.push('EDIT_PROFILE_ROLE_STATUS')
    if (canForceLogout) items.push('FORCE_LOGOUT_SESSIONS')
    if (canReadRoles && user.role) items.push('OPEN_ROLE')
    if (canReadAudit) items.push('OPEN_AUDIT')

    return items
  }, [canForceLogout, canReadAudit, canReadRoles, canUpdateAdminUsers, user.role])

  return (
    <RecordSection
      description="Access warnings and controls available to the current admin."
      icon={<TriangleAlert className="size-4" />}
      title="Guardrails"
    >
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">Warnings</p>
          <RecordBadgeGroup emptyLabel="No warnings" items={warnings} tone="warning" formatItem={humanizeCode} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
            Available to you
          </p>
          <RecordBadgeGroup emptyLabel="No permitted controls" items={controls} tone="info" formatItem={humanizeCode} />
        </div>
      </div>
    </RecordSection>
  )
}

function EditAdminUserModal({
  canForceLogout,
  canReadRoles,
  error,
  isSubmitting,
  onClose,
  onSubmit,
  roleOptions,
  rolesError,
  rolesLoading,
  user,
}: {
  canForceLogout: boolean
  canReadRoles: boolean
  error: string | null
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (payload: UpdateAdminUserPayload) => void
  roleOptions: RoleSummary[]
  rolesError: string | null
  rolesLoading: boolean
  user: AdminUser
}) {
  const [fullName, setFullName] = useState(user.fullName)
  const [roleId, setRoleId] = useState(user.role?.roleId ?? '')
  const [status, setStatus] = useState<AdminUserStatus>(user.status)
  const [forceLogout, setForceLogout] = useState(false)
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    const trimmedFullName = fullName.trim()
    const trimmedReason = reason.trim()

    if (trimmedFullName.length < 2) {
      setFormError('Full name must be at least 2 characters.')
      return
    }

    if (trimmedReason.length < 3) {
      setFormError('Reason must be at least 3 characters.')
      return
    }

    onSubmit({
      fullName: trimmedFullName,
      roleId: canReadRoles && roleId ? roleId : undefined,
      status,
      forceLogout: canForceLogout && forceLogout,
      reason: trimmedReason,
    })
  }

  return (
    <Modal
      description="Changes are audited and may invalidate active sessions."
      size="xl"
      title="Edit admin user"
      closeDisabled={isSubmitting}
      onClose={onClose}
    >
      <form className="space-y-4" onSubmit={submit}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">
              Full name <span className="text-danger">*</span>
            </span>
            <input
              className="form-input"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">Status</span>
            <select
              className="form-input"
              value={status}
              onChange={(event) => setStatus(event.target.value as AdminUserStatus)}
            >
              {adminUserStatuses.map((item) => (
                <option key={item} value={item}>
                  {humanizeCode(item)}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-foreground">Role</span>
            <select
              className="form-input"
              disabled={!canReadRoles || rolesLoading || Boolean(rolesError)}
              value={roleId}
              onChange={(event) => setRoleId(event.target.value)}
            >
              <option value="">
                {canReadRoles ? 'Select role' : user.role?.roleName ?? 'Role locked'}
              </option>
              {user.role && !roleOptions.some((role) => role.roleId === user.role?.roleId) ? (
                <option value={user.role.roleId}>
                  {user.role.roleName} ({user.role.roleCode})
                </option>
              ) : null}
              {roleOptions.map((role) => (
                <option key={role.roleId} value={role.roleId}>
                  {role.roleName} ({role.roleCode})
                </option>
              ))}
            </select>
            {!canReadRoles ? (
              <p className="text-xs text-muted">Role changes require roles read access.</p>
            ) : rolesError ? (
              <p className="text-xs text-danger">{rolesError}</p>
            ) : null}
          </label>
          {canForceLogout ? (
            <label className="flex min-h-11 items-center gap-2 rounded-[0.75rem] border border-border bg-surface-muted/45 px-3 text-sm font-medium text-foreground md:col-span-2">
              <input
                checked={forceLogout}
                type="checkbox"
                onChange={(event) => setForceLogout(event.target.checked)}
              />
              Force logout after update
            </label>
          ) : null}
          <label className="block space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-foreground">
              Reason <span className="text-danger">*</span>
            </span>
            <textarea
              className="form-input min-h-24 resize-y"
              placeholder="Role changed after operations team transfer."
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
        </div>

        {formError || error ? (
          <div className="rounded-[0.75rem] border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
            {formError ?? error}
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          <Button disabled={isSubmitting} size="sm" type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button isLoading={isSubmitting} size="sm" type="submit">
            <Save className="mr-2 size-4" />
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function ForceLogoutModal({
  error,
  isSubmitting,
  onClose,
  onConfirm,
  user,
}: {
  error: string | null
  isSubmitting: boolean
  onClose: () => void
  onConfirm: () => void
  user: AdminUser
}) {
  return (
    <div className="premium-overlay flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-[0.875rem] border border-border bg-surface p-5 shadow-[var(--shadow-overlay)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Force logout</h2>
            <p className="mt-1 text-sm text-muted">
              Active sessions for {user.fullName} will be revoked immediately.
            </p>
          </div>
          <button
            aria-label="Close force logout"
            className="rounded-full p-2 text-muted transition hover:bg-surface-muted hover:text-foreground"
            disabled={isSubmitting}
            type="button"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5 rounded-[0.75rem] border border-warning/20 bg-warning/5 p-3 text-sm text-warning">
          This does not change role or account status.
        </div>

        {error ? (
          <div className="mt-4 rounded-[0.75rem] border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
            {error}
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
          <Button disabled={isSubmitting} size="sm" type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            isLoading={isSubmitting}
            size="sm"
            type="button"
            variant="danger"
            onClick={onConfirm}
          >
            <LogOut className="mr-2 size-4" />
            Force logout
          </Button>
        </div>
      </div>
    </div>
  )
}

export function AdminUserDetailPage() {
  const { adminUserId, tab: tabParam } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canCreateAdminUsers = usePermission('admin_users:create')
  const canUpdateAdminUsers = usePermission('admin_users:update')
  const canForceLogout = usePermission('admin_users:force_logout')
  const canReadRoles = usePermission('roles:read')
  const canReadAudit = usePermission('audit:read')
  const [activeModal, setActiveModal] = useState<ModalKind | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const activeTab: AdminUserDetailTab = ADMIN_USER_DETAIL_TABS.includes(
    tabParam as AdminUserDetailTab,
  )
    ? (tabParam as AdminUserDetailTab)
    : 'overview'

  const userQuery = useQuery({
    enabled: Boolean(adminUserId),
    queryKey: ['admin-users', adminUserId],
    queryFn: () => adminUserService.getAdminUser(adminUserId as string),
  })

  const rolesQuery = useQuery({
    enabled: canReadRoles,
    queryKey: ['rbac', 'roles'],
    queryFn: () => rbacService.getRoles(),
  })

  const user = userQuery.data?.data
  const roleOptions = useMemo(
    () =>
      rolesQuery.data?.data.filter(
        (role) => role.isActive || role.roleId === user?.role?.roleId,
      ) ?? [],
    [rolesQuery.data?.data, user?.role?.roleId],
  )

  const refreshUsers = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-users', adminUserId] }),
    ])
  }

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateAdminUserPayload) => {
      if (!adminUserId) throw new Error('Admin user id is missing.')
      return adminUserService.updateAdminUser(adminUserId, payload)
    },
    onMutate: () => {
      setActionError(null)
      setActionMessage(null)
    },
    onSuccess: async (response) => {
      setActionMessage(response.message ?? 'Admin user updated.')
      await refreshUsers()
      setActiveModal(null)
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : 'Admin user update failed.')
    },
  })

  const forceLogoutMutation = useMutation({
    mutationFn: () => {
      if (!adminUserId) throw new Error('Admin user id is missing.')
      return adminUserService.forceLogoutAdminUser(adminUserId)
    },
    onMutate: () => {
      setActionError(null)
      setActionMessage(null)
    },
    onSuccess: async (response) => {
      setActionMessage(`${response.data.revokedSessionCount} active session(s) revoked.`)
      await refreshUsers()
      setActiveModal(null)
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : 'Force logout failed.')
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

  if (userQuery.isLoading) {
    return <DetailSkeleton />
  }

  if (userQuery.isError) {
    return (
      <PageContainer>
        <ErrorState
          description="We could not load admin user details. Please retry."
          title="Admin user unavailable"
          onRetry={() => void userQuery.refetch()}
        />
      </PageContainer>
    )
  }

  if (!user) {
    return (
      <PageContainer>
        <EmptyState
          description="This admin user is not available in the current list view."
          title="Admin user not found"
        />
      </PageContainer>
    )
  }

  const headerActions: RecordAction[] = [
    ...(canUpdateAdminUsers
      ? [
          {
            key: 'edit',
            label: 'Edit',
            icon: <Edit3 className="size-4" />,
            intent: 'secondary' as const,
            onSelect: () => {
              setActionError(null)
              setActiveModal('EDIT')
            },
          },
        ]
      : []),
    ...(canForceLogout
      ? [
          {
            key: 'force-logout',
            label: 'Force logout',
            icon: <LogOut className="size-4" />,
            intent: 'destructive' as const,
            onSelect: () => {
              setActionError(null)
              setActiveModal('FORCE_LOGOUT')
            },
          },
        ]
      : []),
  ]

  const guardrailCount = getAdminUserWarnings(user).length

  return (
    <PageContainer className="space-y-3">
      <DetailPageHeader
        actionNode={
          <RecordHeaderActions
            actions={headerActions}
            disabled={updateMutation.isPending || forceLogoutMutation.isPending}
            utility={
              canCreateAdminUsers ? (
                <Button
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => navigate(`${routePaths.adminUsers}/new`)}
                >
                  <Users className="mr-2 size-4" />
                  New
                </Button>
              ) : undefined
            }
          />
        }
        listHref={routePaths.adminUsers}
        listLabel="Users"
        recordName={user.fullName}
      />

      <AdminUserHeroCard user={user} />

      <RecordMetricStrip
        metrics={[
          { label: 'Permission version', value: String(user.permissionVersion) },
          { label: 'Last login', value: formatDateSafe(user.lastLoginAt) },
          { label: 'Updated', value: formatDateSafe(user.updatedAt) },
          ...(guardrailCount > 0
            ? [{ label: 'Guardrail warnings', value: String(guardrailCount), tone: 'warning' as const }]
            : []),
        ]}
      />

      <AdminUserDetailSectionNav activeTab={activeTab} guardrailCount={guardrailCount} user={user} />

      {actionError && !activeModal ? (
        <div className="rounded-[0.875rem] border border-danger/25 bg-danger/10 p-3 text-sm text-danger">
          {actionError}
        </div>
      ) : null}
      {actionMessage ? (
        <div className="rounded-[0.875rem] border border-success/25 bg-success/10 p-3 text-sm text-success">
          {actionMessage}
        </div>
      ) : null}

      {activeTab === 'overview' ? (
        <section className="grid gap-3 xl:grid-cols-2">
          <AccountAndLifecyclePanel user={user} />
          <RelatedRecordsPanel canReadAudit={canReadAudit} user={user} onNavigate={navigate} />
        </section>
      ) : null}

      {activeTab === 'access' ? (
        <RolePanel canReadRoles={canReadRoles} user={user} onNavigate={navigate} />
      ) : null}

      {activeTab === 'guardrails' ? (
        <GuardrailsPanel
          canForceLogout={canForceLogout}
          canReadAudit={canReadAudit}
          canReadRoles={canReadRoles}
          canUpdateAdminUsers={canUpdateAdminUsers}
          user={user}
        />
      ) : null}

      {activeModal === 'EDIT' ? (
        <EditAdminUserModal
          canForceLogout={canForceLogout}
          canReadRoles={canReadRoles}
          error={actionError}
          isSubmitting={updateMutation.isPending}
          roleOptions={roleOptions}
          rolesError={
            rolesQuery.isError
              ? rolesQuery.error instanceof Error
                ? rolesQuery.error.message
                : 'Roles could not be loaded.'
              : null
          }
          rolesLoading={rolesQuery.isLoading}
          user={user}
          onClose={() => {
            if (!updateMutation.isPending) setActiveModal(null)
          }}
          onSubmit={(payload) => updateMutation.mutate(payload)}
        />
      ) : null}

      {activeModal === 'FORCE_LOGOUT' ? (
        <ForceLogoutModal
          error={actionError}
          isSubmitting={forceLogoutMutation.isPending}
          user={user}
          onClose={() => {
            if (!forceLogoutMutation.isPending) setActiveModal(null)
          }}
          onConfirm={() => forceLogoutMutation.mutate()}
        />
      ) : null}
    </PageContainer>
  )
}
