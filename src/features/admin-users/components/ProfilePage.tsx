import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  ArrowUpRight,
  CalendarClock,
  ClipboardList,
  KeyRound,
  RefreshCcw,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  Users,
} from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Skeleton } from '../../../components/ui/Skeleton'
import { PageContainer } from '../../../components/layout/PageContainer'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { routePaths } from '../../../config/routes'
import { usePermission } from '../../../hooks/usePermission'
import type { StatusTone } from '../../../types/status.types'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { adminUserService } from '../services/adminUser.service'
import type {
  AdminUserRole,
  AdminUserScope,
  AdminUserStatus,
  CurrentAdminUser,
} from '../types/adminUser.types'

function humanizeCode(value: string | null | undefined) {
  if (!value) return 'Not available'

  return value
    .toLowerCase()
    .split(/[:_-]+/)
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

function adminStatusTone(status: AdminUserStatus): StatusTone {
  return status === 'ACTIVE' ? 'success' : 'danger'
}

function authStatusTone(status: string | null | undefined): StatusTone {
  if (status === 'ACTIVE') return 'success'
  if (status === 'DISABLED' || status === 'BLOCKED') return 'danger'
  return 'warning'
}

function roleTone(role: AdminUserRole | null): StatusTone {
  if (!role) return 'warning'
  return role.isActive ? 'success' : 'warning'
}

function toneClass(tone: StatusTone) {
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
  tone: StatusTone
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
            <h2 className="text-base font-semibold tracking-normal text-foreground">
              {title}
            </h2>
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

function HeaderStatus({ profile }: { profile: CurrentAdminUser }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={adminStatusTone(profile.status)}>
        {humanizeCode(profile.status)}
      </Badge>
      <Badge tone={authStatusTone(profile.userStatus)}>
        Auth {humanizeCode(profile.userStatus)}
      </Badge>
      <Badge tone={roleTone(profile.role)}>
        {profile.role?.roleCode ?? 'NO_ROLE'}
      </Badge>
      {profile.scopes.map((scope) => (
        <Badge key={scopeKey(scope)} tone="neutral">
          {scope.scopeType}
        </Badge>
      ))}
    </div>
  )
}

function AccountPanel({ profile }: { profile: CurrentAdminUser }) {
  return (
    <SectionShell
      description="Identity and account status for the active admin session."
      icon={<UserRound className="size-4" />}
      title="Account"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailField label="Full name" value={profile.fullName} />
        <DetailField label="Email" value={profile.email} />
        <DetailField
          label="Admin status"
          value={
            <Badge tone={adminStatusTone(profile.status)}>
              {humanizeCode(profile.status)}
            </Badge>
          }
        />
        <DetailField
          label="Auth status"
          value={
            <Badge tone={authStatusTone(profile.userStatus)}>
              {humanizeCode(profile.userStatus)}
            </Badge>
          }
        />
        <DetailField label="Admin ID" value={profile.adminId} />
        <DetailField label="Auth user ID" value={profile.userId} />
      </div>
    </SectionShell>
  )
}

function RolePanel({
  canReadRoles,
  onNavigate,
  profile,
}: {
  canReadRoles: boolean
  onNavigate: (path: string) => void
  profile: CurrentAdminUser
}) {
  const role = profile.role

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
      description="Primary role and role-code claims applied to the current session."
      icon={<ShieldCheck className="size-4" />}
      title="Role"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailField label="Role name" value={role?.roleName} />
        <DetailField label="Role code" value={role?.roleCode} />
        <DetailField label="Role ID" value={role?.roleId} />
        <DetailField
          label="Role type"
          value={role?.isSystem ? 'System' : role ? 'Custom' : null}
        />
        <DetailField
          label="Role active"
          value={
            role ? (
              <Badge tone={role.isActive ? 'success' : 'warning'}>
                {role.isActive ? 'Active' : 'Inactive'}
              </Badge>
            ) : null
          }
        />
        <DetailField
          label="Role codes"
          value={
            profile.roleCodes.length ? (
              <div className="flex flex-wrap gap-2">
                {profile.roleCodes.map((roleCode) => (
                  <Badge key={roleCode} tone="neutral">
                    {roleCode}
                  </Badge>
                ))}
              </div>
            ) : null
          }
        />
      </div>
    </SectionShell>
  )
}

function LifecyclePanel({ profile }: { profile: CurrentAdminUser }) {
  return (
    <SectionShell
      description="Timestamps and permission-version marker for the current admin profile."
      icon={<CalendarClock className="size-4" />}
      title="Lifecycle"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailField label="Created" value={formatDateSafe(profile.createdAt)} />
        <DetailField label="Updated" value={formatDateSafe(profile.updatedAt)} />
        <DetailField label="Last login" value={formatDateSafe(profile.lastLoginAt)} />
        <DetailField label="Permission version" value={profile.permissionVersion} />
      </div>
    </SectionShell>
  )
}

function scopeKey(scope: AdminUserScope) {
  return `${scope.scopeType}-${scope.scopeId ?? scope.scopeRefId ?? 'global'}`
}

function ScopesPanel({ scopes }: { scopes: AdminUserScope[] }) {
  return (
    <SectionShell
      description="Object scope claims returned with the active admin session."
      icon={<KeyRound className="size-4" />}
      title="Scopes"
    >
      {scopes.length ? (
        <div className="divide-y divide-border">
          {scopes.map((scope) => {
            const scopeRef = scope.scopeId ?? scope.scopeRefId

            return (
              <div
                className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                key={scopeKey(scope)}
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {scope.scopeType}
                  </p>
                  <p className="mt-1 break-all text-xs text-muted">
                    {scopeRef ?? 'Platform-wide'}
                  </p>
                </div>
                <Badge tone={scopeRef ? 'info' : 'success'}>
                  {scopeRef ? 'Scoped' : 'Global'}
                </Badge>
              </div>
            )
          })}
        </div>
      ) : (
        <Badge tone="warning">No scopes returned</Badge>
      )}
    </SectionShell>
  )
}

function groupPermissions(permissions: string[]) {
  const groups = new Map<string, string[]>()

  permissions.forEach((permission) => {
    const [rawModuleCode, rawActionCode] = permission.split(':')
    const moduleCode = rawModuleCode || 'unknown'
    const actionCode = rawActionCode || permission
    const existing = groups.get(moduleCode) ?? []
    existing.push(actionCode)
    groups.set(moduleCode, existing)
  })

  return Array.from(groups.entries())
    .map(([moduleCode, actions]) => ({
      actions: actions.sort((first, second) => first.localeCompare(second)),
      moduleCode,
    }))
    .sort((first, second) => first.moduleCode.localeCompare(second.moduleCode))
}

function PermissionsPanel({ permissions }: { permissions: string[] }) {
  const permissionGroups = useMemo(() => groupPermissions(permissions), [permissions])

  return (
    <SectionShell
      description="Effective permissions loaded from the current admin session."
      icon={<ShieldCheck className="size-4" />}
      title="Permissions"
    >
      {permissionGroups.length ? (
        <div className="divide-y divide-border">
          {permissionGroups.map((group) => (
            <div
              className="grid gap-3 py-3 first:pt-0 last:pb-0 md:grid-cols-[12rem_1fr]"
              key={group.moduleCode}
            >
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {humanizeCode(group.moduleCode)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {group.actions.length} action{group.actions.length === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {group.actions.map((action) => (
                  <Badge key={`${group.moduleCode}:${action}`} tone="neutral">
                    {action}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Badge tone="warning">No permissions returned</Badge>
      )}
    </SectionShell>
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

function SignalsPanel({
  canReadAdminUsers,
  canReadAudit,
  canReadRoles,
  profile,
}: {
  canReadAdminUsers: boolean
  canReadAudit: boolean
  canReadRoles: boolean
  profile: CurrentAdminUser
}) {
  const warnings = useMemo(() => {
    const items: string[] = []

    if (profile.status === 'DISABLED') items.push('ADMIN_DISABLED')
    if (profile.userStatus && profile.userStatus !== 'ACTIVE') {
      items.push(`AUTH_${profile.userStatus}`)
    }
    if (!profile.role) items.push('NO_ROLE_ASSIGNED')
    if (profile.role?.isActive === false) items.push('ROLE_INACTIVE')
    if (!profile.lastLoginAt) items.push('NEVER_LOGGED_IN')
    if (!profile.permissions.length) items.push('NO_PERMISSIONS_RETURNED')
    if (!profile.scopes.length) items.push('NO_SCOPES_RETURNED')

    return items
  }, [
    profile.lastLoginAt,
    profile.permissions.length,
    profile.role,
    profile.scopes.length,
    profile.status,
    profile.userStatus,
  ])

  const drillDowns = useMemo(() => {
    const items: string[] = []

    if (canReadAdminUsers) items.push('OPEN_ADMIN_RECORD')
    if (canReadRoles && profile.role) items.push('OPEN_ROLE')
    if (canReadAudit) items.push('OPEN_AUDIT_TRAIL')

    return items
  }, [canReadAdminUsers, canReadAudit, canReadRoles, profile.role])

  return (
    <SectionShell
      description="Derived account warnings and permission-backed drill-downs."
      icon={<TriangleAlert className="size-4" />}
      title="Signals"
    >
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
            Warnings
          </p>
          <SignalBadgeGroup
            emptyLabel="No warnings"
            items={warnings}
            tone="warning"
          />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
            Available drill-downs
          </p>
          <SignalBadgeGroup
            emptyLabel="No related access"
            items={drillDowns}
            tone="info"
          />
        </div>
      </div>
    </SectionShell>
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

function RelatedRecordsPanel({
  canReadAdminUsers,
  canReadAudit,
  canReadRoles,
  onNavigate,
  profile,
}: {
  canReadAdminUsers: boolean
  canReadAudit: boolean
  canReadRoles: boolean
  onNavigate: (path: string) => void
  profile: CurrentAdminUser
}) {
  return (
    <SectionShell
      description="Connected admin modules for this account."
      icon={<ArrowUpRight className="size-4" />}
      title="Related records"
    >
      <div className="divide-y divide-border">
        <RelatedRecordRow
          actionLabel="Record"
          canOpen={canReadAdminUsers}
          icon={<Users className="size-4" />}
          label="Admin user record"
          meta={humanizeCode(profile.status)}
          value={profile.email ?? profile.adminId}
          onOpen={() => onNavigate(`${routePaths.adminUsers}/${profile.adminId}`)}
        />
        <RelatedRecordRow
          actionLabel="Role"
          canOpen={Boolean(profile.role && canReadRoles)}
          icon={<ShieldCheck className="size-4" />}
          label="Assigned role"
          meta={profile.role?.roleCode ?? 'No assigned role'}
          value={profile.role?.roleName ?? 'Unassigned'}
          onOpen={() => {
            if (profile.role) onNavigate(`${routePaths.roles}/${profile.role.roleId}`)
          }}
        />
        <RelatedRecordRow
          actionLabel="Audit"
          canOpen={canReadAudit}
          icon={<ClipboardList className="size-4" />}
          label="Audit trail"
          meta="Filtered by actor admin ID"
          value={profile.adminId}
          onOpen={() => {
            onNavigate(`${routePaths.audit}?actorAdminId=${encodeURIComponent(profile.adminId)}`)
          }}
        />
        <RelatedRecordRow
          canOpen={false}
          icon={<KeyRound className="size-4" />}
          label="Auth user"
          meta="Identity user backing the admin account"
          value={profile.userId}
        />
      </div>
    </SectionShell>
  )
}

export function ProfilePage() {
  const navigate = useNavigate()
  const canReadAdminUsers = usePermission('admin_users:read')
  const canReadAudit = usePermission('audit:read')
  const canReadRoles = usePermission('roles:read')
  const profileQuery = useQuery({
    queryKey: ['admin-me'],
    queryFn: adminUserService.getMe,
  })

  const profile = profileQuery.data?.data

  if (profileQuery.isLoading) {
    return <DetailSkeleton />
  }

  if (profileQuery.isError) {
    return (
      <PageContainer>
        <ErrorState
          description="We could not load your profile. Please retry."
          title="Profile unavailable"
          onRetry={() => void profileQuery.refetch()}
        />
      </PageContainer>
    )
  }

  if (!profile) {
    return (
      <PageContainer>
        <EmptyState
          description="The profile API returned no admin user data."
          title="Profile not found"
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <PageContextHeader
        actionNode={
          <div className="flex flex-wrap items-center gap-2">
            {canReadAdminUsers ? (
              <Button
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => navigate(`${routePaths.adminUsers}/${profile.adminId}`)}
              >
                <ArrowUpRight className="mr-2 size-4" />
                Record
              </Button>
            ) : null}
            <Button
              isLoading={profileQuery.isRefetching}
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => void profileQuery.refetch()}
            >
              <RefreshCcw className="mr-2 size-4" />
              Refresh
            </Button>
          </div>
        }
        description={profile.email ?? profile.userId}
        title="My Profile"
        titleMetaNode={<HeaderStatus profile={profile} />}
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<UserRound className="size-4" />}
          label="Admin"
          meta="Account lifecycle status"
          tone={adminStatusTone(profile.status)}
          value={humanizeCode(profile.status)}
        />
        <SummaryCard
          icon={<KeyRound className="size-4" />}
          label="Auth"
          meta="Identity provider user status"
          tone={authStatusTone(profile.userStatus)}
          value={humanizeCode(profile.userStatus)}
        />
        <SummaryCard
          icon={<ShieldCheck className="size-4" />}
          label="Role"
          meta={profile.role?.roleName ?? 'No role assigned'}
          tone={roleTone(profile.role)}
          value={profile.role?.roleCode ?? 'NO_ROLE'}
        />
        <SummaryCard
          icon={<ClipboardList className="size-4" />}
          label="Access"
          meta={`${profile.scopes.length} scope${profile.scopes.length === 1 ? '' : 's'}`}
          tone={profile.permissions.length ? 'info' : 'warning'}
          value={profile.permissions.length}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-4">
          <AccountPanel profile={profile} />
          <PermissionsPanel permissions={profile.permissions} />
        </div>
        <div className="space-y-4">
          <RolePanel
            canReadRoles={canReadRoles}
            profile={profile}
            onNavigate={navigate}
          />
          <ScopesPanel scopes={profile.scopes} />
          <LifecyclePanel profile={profile} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <SignalsPanel
          canReadAdminUsers={canReadAdminUsers}
          canReadAudit={canReadAudit}
          canReadRoles={canReadRoles}
          profile={profile}
        />
        <RelatedRecordsPanel
          canReadAdminUsers={canReadAdminUsers}
          canReadAudit={canReadAudit}
          canReadRoles={canReadRoles}
          profile={profile}
          onNavigate={navigate}
        />
      </section>
    </PageContainer>
  )
}
