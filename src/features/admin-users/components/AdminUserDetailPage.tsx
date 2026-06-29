import type { FormEvent, ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Edit3,
  KeyRound,
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
import { Skeleton } from '../../../components/ui/Skeleton'
import { DetailPageHeader } from '../../../components/layout/DetailPageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import { routePaths } from '../../../config/routes'
import { usePermission } from '../../../hooks/usePermission'
import type { StatusTone } from '../../../types/status.types'
import { cn } from '../../../utils/cn'
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

function toneClass(tone: 'danger' | 'info' | 'neutral' | 'success' | 'warning') {
  if (tone === 'success') return 'text-success'
  if (tone === 'warning') return 'text-warning'
  if (tone === 'danger') return 'text-danger'
  if (tone === 'info') return 'text-primary'
  return 'text-muted'
}

function DetailField({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="min-w-0 rounded-[0.75rem] border border-border bg-surface-muted/35 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-muted">
        {label}
      </p>
      <div className="mt-2 break-words text-sm font-medium text-foreground">
        {value ?? 'Not available'}
      </div>
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  meta,
  tone,
  value,
}: {
  icon: ReactNode
  label: string
  meta: string
  tone: 'danger' | 'info' | 'neutral' | 'success' | 'warning'
  value: ReactNode
}) {
  return (
    <article className="rounded-[0.875rem] border border-border bg-surface px-3 py-3 shadow-surface">
      <div className="flex items-center justify-between gap-3">
        <p className={cn('text-xs font-semibold uppercase tracking-normal', toneClass(tone))}>
          {label}
        </p>
        <span className={toneClass(tone)}>{icon}</span>
      </div>
      <div className={cn('mt-3 text-2xl font-semibold tracking-normal', toneClass(tone))}>
        {value}
      </div>
      <p className="mt-1 text-xs text-muted">{meta}</p>
    </article>
  )
}

function SectionShell({
  actionNode,
  children,
  description,
  icon,
  title,
}: {
  actionNode?: ReactNode
  children: ReactNode
  description?: string
  icon?: ReactNode
  title: string
}) {
  return (
    <section className="rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon ? <span className="text-primary">{icon}</span> : null}
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
          </div>
          {description ? (
            <p className="mt-1 text-sm leading-5 text-muted">{description}</p>
          ) : null}
        </div>
        {actionNode ? <div className="shrink-0">{actionNode}</div> : null}
      </div>
      {children}
    </section>
  )
}

function HeaderStatus({ user }: { user: AdminUser }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={userStatusTone(user.status)}>{humanizeCode(user.status)}</Badge>
      <Badge tone={authStatusTone(user.userStatus)}>
        Auth {humanizeCode(user.userStatus)}
      </Badge>
      <Badge tone={user.role?.isActive === false ? 'warning' : 'neutral'}>
        {user.role?.roleCode ?? 'NO_ROLE'}
      </Badge>
    </div>
  )
}

function HeaderActions({
  canCreateAdminUsers,
  canForceLogout,
  canUpdateAdminUsers,
  isSubmitting,
  onSelect,
}: {
  canCreateAdminUsers: boolean
  canForceLogout: boolean
  canUpdateAdminUsers: boolean
  isSubmitting: boolean
  onSelect: (modal: ModalKind) => void
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {canCreateAdminUsers ? (
        <Link to={`${routePaths.adminUsers}/new`}>
          <Button size="sm" type="button" variant="secondary">
            <Users className="mr-2 size-4" />
            New
          </Button>
        </Link>
      ) : null}
      {canUpdateAdminUsers ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          type="button"
          variant="secondary"
          onClick={() => onSelect('EDIT')}
        >
          <Edit3 className="mr-2 size-4" />
          Edit
        </Button>
      ) : null}
      {canForceLogout ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          type="button"
          variant="secondary"
          onClick={() => onSelect('FORCE_LOGOUT')}
        >
          <LogOut className="mr-2 size-4" />
          Force Logout
        </Button>
      ) : null}
    </div>
  )
}

function DetailSkeleton() {
  return (
    <PageContainer>
      <Skeleton className="h-16 w-full rounded-[0.875rem]" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton className="h-28 rounded-[0.875rem]" key={index} />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-[0.875rem]" />
    </PageContainer>
  )
}

function SignalBadgeGroup({
  emptyLabel,
  items,
  tone,
}: {
  emptyLabel: string
  items: string[]
  tone: StatusTone
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.length ? (
        items.map((item) => (
          <Badge key={item} tone={tone}>
            {humanizeCode(item)}
          </Badge>
        ))
      ) : (
        <Badge tone="success">{emptyLabel}</Badge>
      )}
    </div>
  )
}

function RelatedRecordRow({
  actionLabel = 'Open',
  canOpen,
  icon,
  label,
  meta,
  onOpen,
  value,
}: {
  actionLabel?: string
  canOpen: boolean
  icon: ReactNode
  label: string
  meta: string
  onOpen?: () => void
  value: string
}) {
  return (
    <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 text-primary">{icon}</span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
            {label}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">
            {value}
          </p>
          <p className="mt-1 truncate text-xs text-muted">{meta}</p>
        </div>
      </div>
      {canOpen && onOpen ? (
        <Button
          className="shrink-0"
          size="sm"
          type="button"
          variant="secondary"
          onClick={onOpen}
        >
          <ArrowUpRight className="mr-2 size-4" />
          {actionLabel}
        </Button>
      ) : (
        <Badge tone="neutral">View only</Badge>
      )}
    </div>
  )
}

function LifecyclePanel({ user }: { user: AdminUser }) {
  return (
    <SectionShell
      description="Core admin profile timestamps and session invalidation marker."
      icon={<CalendarClock className="size-4" />}
      title="Lifecycle"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailField label="Created" value={formatDateSafe(user.createdAt)} />
        <DetailField label="Updated" value={formatDateSafe(user.updatedAt)} />
        <DetailField label="Last login" value={formatDateSafe(user.lastLoginAt)} />
        <DetailField label="Permission version" value={user.permissionVersion} />
        <DetailField label="Admin ID" value={user.adminId} />
        <DetailField label="Auth user ID" value={user.userId} />
      </div>
    </SectionShell>
  )
}

function AccountPanel({ user }: { user: AdminUser }) {
  return (
    <SectionShell
      description="Identity fields returned by the admin user detail API."
      icon={<UserRound className="size-4" />}
      title="Account"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailField label="Full name" value={user.fullName} />
        <DetailField label="Email" value={user.email} />
        <DetailField
          label="Admin status"
          value={<Badge tone={userStatusTone(user.status)}>{humanizeCode(user.status)}</Badge>}
        />
        <DetailField
          label="Auth status"
          value={<Badge tone={authStatusTone(user.userStatus)}>{humanizeCode(user.userStatus)}</Badge>}
        />
      </div>
    </SectionShell>
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
    <SectionShell
      actionNode={
        role && canReadRoles ? (
          <Button
            size="sm"
            type="button"
            variant="secondary"
            onClick={() => onNavigate(`${routePaths.roles}/${role.roleId}`)}
          >
            <ArrowUpRight className="mr-2 size-4" />
            Open
          </Button>
        ) : null
      }
      description="Primary role assignment for this admin user."
      icon={<ShieldCheck className="size-4" />}
      title="Role"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailField label="Role name" value={role?.roleName} />
        <DetailField label="Role code" value={role?.roleCode} />
        <DetailField label="Role ID" value={role?.roleId} />
        <DetailField label="Role type" value={role?.isSystem ? 'System' : role ? 'Custom' : null} />
        <DetailField
          label="Role active"
          value={role ? (
            <Badge tone={role.isActive ? 'success' : 'warning'}>
              {role.isActive ? 'Active' : 'Inactive'}
            </Badge>
          ) : null}
        />
      </div>
    </SectionShell>
  )
}

function SignalsPanel({
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
  const warnings = useMemo(() => {
    const items: string[] = []

    if (user.status === 'DISABLED') items.push('ADMIN_DISABLED')
    if (user.userStatus && user.userStatus !== 'ACTIVE') {
      items.push(`AUTH_${user.userStatus}`)
    }
    if (!user.role) items.push('NO_ROLE_ASSIGNED')
    if (user.role?.isActive === false) items.push('ROLE_INACTIVE')
    if (!user.lastLoginAt) items.push('NEVER_LOGGED_IN')

    return items
  }, [user.lastLoginAt, user.role, user.status, user.userStatus])

  const controls = useMemo(() => {
    const items: string[] = []

    if (canUpdateAdminUsers) items.push('EDIT_PROFILE_ROLE_STATUS')
    if (canForceLogout) items.push('FORCE_LOGOUT_SESSIONS')
    if (canReadRoles && user.role) items.push('OPEN_ROLE')
    if (canReadAudit) items.push('OPEN_AUDIT')

    return items
  }, [canForceLogout, canReadAudit, canReadRoles, canUpdateAdminUsers, user.role])

  return (
    <SectionShell
      description="Derived account warnings and controls available to the current admin."
      icon={<TriangleAlert className="size-4" />}
      title="Signals"
    >
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
            Warnings
          </p>
          <SignalBadgeGroup emptyLabel="No warnings" items={warnings} tone="warning" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
            Available to you
          </p>
          <SignalBadgeGroup
            emptyLabel="No permitted controls"
            items={controls}
            tone="info"
          />
        </div>
      </div>
    </SectionShell>
  )
}

function RelatedRecordsPanel({
  canReadAudit,
  canReadRoles,
  canUpdateAdminUsers,
  onEdit,
  onNavigate,
  user,
}: {
  canReadAudit: boolean
  canReadRoles: boolean
  canUpdateAdminUsers: boolean
  onEdit: () => void
  onNavigate: (path: string) => void
  user: AdminUser
}) {
  return (
    <SectionShell
      description="Records and modules connected to this admin user."
      icon={<ArrowUpRight className="size-4" />}
      title="Related records"
    >
      <div className="divide-y divide-border">
        <RelatedRecordRow
          actionLabel="Users"
          canOpen
          icon={<Users className="size-4" />}
          label="Admin users"
          meta={`${humanizeCode(user.status)} profile`}
          value={user.email ?? user.adminId}
          onOpen={() => onNavigate(routePaths.adminUsers)}
        />
        <RelatedRecordRow
          actionLabel="Role"
          canOpen={Boolean(user.role && canReadRoles)}
          icon={<ShieldCheck className="size-4" />}
          label="Role detail"
          meta={user.role?.roleCode ?? 'No assigned role'}
          value={user.role?.roleName ?? 'Unassigned'}
          onOpen={() => {
            if (user.role) onNavigate(`${routePaths.roles}/${user.role.roleId}`)
          }}
        />
        <RelatedRecordRow
          actionLabel="Audit"
          canOpen={canReadAudit}
          icon={<ClipboardList className="size-4" />}
          label="Audit trail"
          meta="Filter by admin_users module activity"
          value={user.adminId}
          onOpen={() => onNavigate(routePaths.audit)}
        />
        <RelatedRecordRow
          canOpen={false}
          icon={<KeyRound className="size-4" />}
          label="Auth user"
          meta="Auth profile backing this admin account"
          value={user.userId}
        />
        <RelatedRecordRow
          actionLabel="Edit"
          canOpen={canUpdateAdminUsers}
          icon={<Edit3 className="size-4" />}
          label="Admin controls"
          meta="Profile, role, status, and optional session revocation"
          value={humanizeCode(user.status)}
          onOpen={onEdit}
        />
      </div>
    </SectionShell>
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
    <div className="premium-overlay flex items-start justify-center overflow-y-auto p-3 sm:p-6 lg:items-center">
      <div className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-[var(--shadow-overlay)] sm:max-h-[calc(100vh-3rem)]">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Edit admin user</h2>
            <p className="mt-1 text-sm text-muted">
              Changes are audited and may invalidate active sessions.
            </p>
          </div>
          <button
            aria-label="Close edit admin user"
            className="rounded-full p-2 text-muted transition hover:bg-surface-muted hover:text-foreground"
            disabled={isSubmitting}
            type="button"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">
                  Full name
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
                  {user.role &&
                  !roleOptions.some((role) => role.roleId === user.role?.roleId) ? (
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
                  <p className="text-xs text-muted">
                    Role changes require roles read access.
                  </p>
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
              <div className="mt-4 rounded-[0.75rem] border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
                {formError ?? error}
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-surface px-5 py-4 sm:px-6">
            <Button
              disabled={isSubmitting}
              size="sm"
              type="button"
              variant="ghost"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button isLoading={isSubmitting} size="sm" type="submit">
              <Save className="mr-2 size-4" />
              Save changes
            </Button>
          </div>
        </form>
      </div>
    </div>
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
            <h2 className="text-lg font-semibold text-foreground">
              Force logout
            </h2>
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
          <Button
            disabled={isSubmitting}
            size="sm"
            type="button"
            variant="ghost"
            onClick={onClose}
          >
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
  const { adminUserId } = useParams()
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
      if (!adminUserId) {
        throw new Error('Admin user id is missing.')
      }

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
    onSuccess: async (response) => {
      setActionMessage(
        `${response.data.revokedSessionCount} active session(s) revoked.`,
      )
      await refreshUsers()
      setActiveModal(null)
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

  const roleTone = user.role?.isActive === false ? 'warning' : user.role ? 'info' : 'danger'
  const roleMeta = user.role?.roleCode ?? 'No role assigned'

  return (
    <PageContainer className="!px-3 !py-4 sm:!px-4 lg:!px-6">
      <DetailPageHeader
        actionNode={
          <HeaderActions
            canCreateAdminUsers={canCreateAdminUsers}
            canForceLogout={canForceLogout}
            canUpdateAdminUsers={canUpdateAdminUsers}
            isSubmitting={updateMutation.isPending || forceLogoutMutation.isPending}
            onSelect={(modal) => {
              setActionError(null)
              setActiveModal(modal)
            }}
          />
        }
        description={user.email ?? user.userId}
        listHref={routePaths.adminUsers}
        listLabel="Users"
        recordName={user.fullName}
        titleMetaNode={<HeaderStatus user={user} />}
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<CheckCircle2 className="size-4" />}
          label="Admin status"
          meta="Admin profile access"
          tone={userStatusTone(user.status)}
          value={humanizeCode(user.status)}
        />
        <SummaryCard
          icon={<ShieldCheck className="size-4" />}
          label="Role"
          meta={roleMeta}
          tone={roleTone}
          value={user.role?.roleName ?? 'Unassigned'}
        />
        <SummaryCard
          icon={<KeyRound className="size-4" />}
          label="Permission version"
          meta="Session invalidation marker"
          tone="warning"
          value={user.permissionVersion}
        />
        <SummaryCard
          icon={<CalendarClock className="size-4" />}
          label="Last login"
          meta="Admin session activity"
          tone={user.lastLoginAt ? 'success' : 'neutral'}
          value={formatDateSafe(user.lastLoginAt)}
        />
      </section>

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

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.55fr)]">
        <LifecyclePanel user={user} />
        <SignalsPanel
          canForceLogout={canForceLogout}
          canReadAudit={canReadAudit}
          canReadRoles={canReadRoles}
          canUpdateAdminUsers={canUpdateAdminUsers}
          user={user}
        />
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.55fr)]">
        <div className="space-y-3">
          <AccountPanel user={user} />
          <RolePanel canReadRoles={canReadRoles} onNavigate={navigate} user={user} />
        </div>
        <RelatedRecordsPanel
          canReadAudit={canReadAudit}
          canReadRoles={canReadRoles}
          canUpdateAdminUsers={canUpdateAdminUsers}
          onEdit={() => {
            setActionError(null)
            setActiveModal('EDIT')
          }}
          onNavigate={navigate}
          user={user}
        />
      </section>

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
