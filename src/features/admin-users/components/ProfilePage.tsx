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
import { buildPathWithQueryParams } from '../../../utils/buildQueryParams'
import { formatDate } from '../../../utils/formatDate'
import { adminUserService } from '../services/adminUser.service'
import type {
  AdminUserRole,
  AdminUserScope,
  AdminUserStatus,
  CurrentAdminUser,
} from '../types/adminUser.types'

const profileSectionIds = {
  account: 'profile-account',
  lifecycle: 'profile-lifecycle',
  permissions: 'profile-permissions',
  related: 'profile-related',
  role: 'profile-role',
  scopes: 'profile-scopes',
  session: 'profile-session',
  signals: 'profile-signals',
} as const
type ProfileSectionId = (typeof profileSectionIds)[keyof typeof profileSectionIds]

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

function getProfileWarnings(profile: CurrentAdminUser) {
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
}

function initialsForName(value: string | null | undefined) {
  const parts = (value ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (!parts.length) return 'AD'

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

function formatRemainingSeconds(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'Not available'
  }

  if (value <= 0) return 'Expired'

  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  return `${Math.max(minutes, 1)}m`
}

function buildProfileAdminUsersListPath(profile: CurrentAdminUser) {
  return buildPathWithQueryParams(routePaths.adminUsers, {
    roleId: profile.role?.roleId,
    search: profile.email ?? profile.fullName,
    status: profile.status,
  }) + '#admin-users-records'
}

function buildProfileActorAuditPath(profile: CurrentAdminUser) {
  return buildPathWithQueryParams(routePaths.audit, {
    actorAdminId: profile.adminId,
  })
}

function buildProfileEntityAuditPath(profile: CurrentAdminUser) {
  return buildPathWithQueryParams(routePaths.audit, {
    entityId: profile.adminId,
    entityType: 'admin_user',
    moduleCode: 'admin_users',
  })
}

function buildProfileRoleCataloguePath(profile: CurrentAdminUser) {
  return buildPathWithQueryParams(routePaths.roles, {
    search: profile.role?.roleCode,
    status: profile.role?.isActive ? 'active' : 'inactive',
    type: profile.role?.isSystem ? 'system' : 'custom',
  }) + '#roles-records'
}

function DetailField({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="min-w-0 rounded-[0.75rem] border border-border bg-surface-muted/35 px-3 py-2.5">
      <p className="text-xs font-semibold uppercase tracking-normal text-muted">
        {label}
      </p>
      <div className="mt-1.5 break-words text-sm font-medium text-foreground">
        {value ?? 'Not available'}
      </div>
    </div>
  )
}

function ProfileFact({
  label,
  meta,
  value,
}: {
  label: string
  meta?: ReactNode
  value: ReactNode
}) {
  return (
    <div className="min-w-0 border-border/80 py-1 sm:border-l sm:pl-4 sm:first:border-l-0 sm:first:pl-0">
      <p className="text-xs font-semibold uppercase tracking-normal text-muted">
        {label}
      </p>
      <div className="mt-1 truncate text-sm font-semibold text-foreground">
        {value ?? 'Not available'}
      </div>
      {meta ? <p className="mt-0.5 truncate text-xs text-muted">{meta}</p> : null}
    </div>
  )
}

function ProfileHeroCard({
  canReadAdminUsers,
  canReadAudit,
  canUpdateAdminUsers,
  isRefreshing,
  onNavigate,
  onRefresh,
  profile,
}: {
  canReadAdminUsers: boolean
  canReadAudit: boolean
  canUpdateAdminUsers: boolean
  isRefreshing: boolean
  onNavigate: (path: string) => void
  onRefresh: () => void
  profile: CurrentAdminUser
}) {
  return (
    <section className="rounded-[1rem] border border-border bg-surface p-4 shadow-surface">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-base font-semibold text-primary">
            {initialsForName(profile.fullName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">
                {profile.fullName}
              </h1>
              <HeaderStatus profile={profile} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <UserRound className="size-3.5 shrink-0" />
                <span className="truncate">{profile.adminId}</span>
              </span>
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <KeyRound className="size-3.5 shrink-0" />
                <span className="truncate">{profile.email ?? profile.userId}</span>
              </span>
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <ShieldCheck className="size-3.5 shrink-0" />
                <span className="truncate">
                  {profile.role?.roleName ?? 'No role'}
                </span>
              </span>
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <CalendarClock className="size-3.5 shrink-0" />
                <span>Last login {formatDateSafe(profile.lastLoginAt)}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 xl:justify-end">
          {canReadAdminUsers && canUpdateAdminUsers ? (
            <Button
              size="sm"
              type="button"
              onClick={() => onNavigate(`${routePaths.adminUsers}/${profile.adminId}`)}
            >
              <UserRound className="mr-2 size-4" />
              Manage
            </Button>
          ) : null}
          {canReadAdminUsers ? (
            <Button
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => onNavigate(`${routePaths.adminUsers}/${profile.adminId}`)}
            >
              <ArrowUpRight className="mr-2 size-4" />
              Record
            </Button>
          ) : null}
          {canReadAudit ? (
            <Button
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => onNavigate(buildProfileActorAuditPath(profile))}
            >
              <ClipboardList className="mr-2 size-4" />
              Audit
            </Button>
          ) : null}
          <Button
            isLoading={isRefreshing}
            size="sm"
            type="button"
            variant="secondary"
            onClick={onRefresh}
          >
            <RefreshCcw className="mr-2 size-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 rounded-[0.875rem] border border-border bg-surface-muted/35 px-4 py-3 sm:grid-cols-2 xl:grid-cols-4">
        <ProfileFact
          label="Role"
          meta={profile.role?.isSystem ? 'System role' : profile.role ? 'Custom role' : null}
          value={profile.role?.roleCode ?? 'NO_ROLE'}
        />
        <ProfileFact
          label="Permissions"
          meta={`${profile.scopes.length} scope${profile.scopes.length === 1 ? '' : 's'}`}
          value={profile.permissions.length}
        />
        <ProfileFact
          label="Session"
          meta={formatDateSafe(profile.session?.expiresAt)}
          value={formatRemainingSeconds(profile.session?.remainingSeconds)}
        />
        <ProfileFact
          label="Updated"
          meta={`Permission v${profile.permissionVersion}`}
          value={formatDateSafe(profile.updatedAt)}
        />
      </div>
    </section>
  )
}

function SectionShell({
  actionNode,
  children,
  description,
  icon,
  id,
  title,
}: {
  actionNode?: ReactNode
  children: ReactNode
  description?: string
  icon?: ReactNode
  id?: string
  title: string
}) {
  return (
    <section
      className="scroll-mt-24 rounded-[0.875rem] border border-border bg-surface p-3 shadow-surface"
      id={id}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon ? <span className="text-primary">{icon}</span> : null}
            <h2 className="text-base font-semibold tracking-normal text-foreground">
              {title}
            </h2>
          </div>
          {description ? (
            <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
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
    <PageContainer className="flex h-full min-h-0 flex-col !overflow-y-auto !px-3 !py-3 !pb-6 space-y-3 scroll-smooth sm:!px-4 lg:!px-6">
      <Skeleton className="h-36 w-full rounded-[1rem]" />
      <Skeleton className="h-12 w-full rounded-[0.875rem]" />
      <div className="grid gap-3 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton className="h-48 rounded-[0.875rem]" key={index} />
        ))}
      </div>
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

function ProfileSectionNav({
  onOpenSection,
  warningCount,
}: {
  onOpenSection: (sectionId: ProfileSectionId) => void
  warningCount: number
}) {
  const items = [
    { label: 'Overview', sectionId: profileSectionIds.account },
    { label: 'Access', sectionId: profileSectionIds.permissions },
    { label: 'Security', sectionId: profileSectionIds.session },
    { label: 'Activity', sectionId: profileSectionIds.related },
    {
      count: warningCount,
      label: 'Guardrails',
      sectionId: profileSectionIds.signals,
    },
  ]

  return (
    <nav
      aria-label="Profile detail sections"
      className="sticky top-0 z-40 -mx-3 overflow-x-auto border-b border-border bg-surface/95 px-3 backdrop-blur sm:-mx-4 sm:px-4 lg:-mx-6 lg:px-6"
    >
      <div className="flex min-w-max items-center gap-1.5 py-2">
        {items.map((item) => (
          <button
            className="inline-flex min-h-9 items-center gap-2 rounded-[0.65rem] px-3 text-sm font-semibold text-muted transition hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            key={`${item.label}-${item.sectionId}`}
            type="button"
            onClick={() => onOpenSection(item.sectionId)}
          >
            <span>{item.label}</span>
            {typeof item.count === 'number' ? (
              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted">
                {item.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </nav>
  )
}

function AccountPanel({ profile }: { profile: CurrentAdminUser }) {
  return (
    <SectionShell
      icon={<UserRound className="size-4" />}
      id={profileSectionIds.account}
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
      icon={<ShieldCheck className="size-4" />}
      id={profileSectionIds.role}
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
      icon={<CalendarClock className="size-4" />}
      id={profileSectionIds.lifecycle}
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
      icon={<KeyRound className="size-4" />}
      id={profileSectionIds.scopes}
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

function SessionPanel({ profile }: { profile: CurrentAdminUser }) {
  const session = profile.session

  return (
    <SectionShell
      icon={<KeyRound className="size-4" />}
      id={profileSectionIds.session}
      title="Session"
    >
      {session ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <DetailField
            label="Authenticated"
            value={formatDateSafe(session.authenticatedAt)}
          />
          <DetailField label="Expires" value={formatDateSafe(session.expiresAt)} />
          <DetailField
            label="Session remaining"
            value={formatRemainingSeconds(session.remainingSeconds)}
          />
          <DetailField
            label="Recent auth expires"
            value={formatDateSafe(session.recentAuthExpiresAt)}
          />
          <DetailField
            label="Recent auth remaining"
            value={formatRemainingSeconds(session.recentAuthRemainingSeconds)}
          />
        </div>
      ) : (
        <Badge tone="warning">No session metadata returned</Badge>
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
      icon={<ShieldCheck className="size-4" />}
      id={profileSectionIds.permissions}
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
  canUpdateAdminUsers,
  profile,
}: {
  canReadAdminUsers: boolean
  canReadAudit: boolean
  canReadRoles: boolean
  canUpdateAdminUsers: boolean
  profile: CurrentAdminUser
}) {
  const warnings = useMemo(() => getProfileWarnings(profile), [profile])

  const drillDowns = useMemo(() => {
    const items: string[] = []

    if (canReadAdminUsers) items.push('OPEN_ADMIN_RECORD')
    if (canReadAdminUsers && canUpdateAdminUsers) items.push('MANAGE_ADMIN_RECORD')
    if (canReadRoles && profile.role) items.push('OPEN_ROLE')
    if (canReadAudit) items.push('OPEN_AUDIT_TRAIL')
    if (profile.session) items.push('VIEW_SESSION_STATE')

    return items
  }, [
    canReadAdminUsers,
    canReadAudit,
    canReadRoles,
    canUpdateAdminUsers,
    profile.role,
    profile.session,
  ])

  return (
    <SectionShell
      icon={<TriangleAlert className="size-4" />}
      id={profileSectionIds.signals}
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
  canUpdateAdminUsers,
  onNavigate,
  onOpenSection,
  profile,
}: {
  canReadAdminUsers: boolean
  canReadAudit: boolean
  canReadRoles: boolean
  canUpdateAdminUsers: boolean
  onNavigate: (path: string) => void
  onOpenSection: (sectionId: ProfileSectionId) => void
  profile: CurrentAdminUser
}) {
  return (
    <SectionShell
      icon={<ArrowUpRight className="size-4" />}
      id={profileSectionIds.related}
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
          actionLabel="Users"
          canOpen={canReadAdminUsers}
          icon={<Users className="size-4" />}
          label="Admin users list"
          meta="Filtered by this profile and role when available"
          value={profile.fullName}
          onOpen={() => onNavigate(buildProfileAdminUsersListPath(profile))}
        />
        <RelatedRecordRow
          actionLabel="Manage"
          canOpen={canReadAdminUsers && canUpdateAdminUsers}
          icon={<UserRound className="size-4" />}
          label="Profile edit path"
          meta="Profile edits are handled from the admin user detail page"
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
          actionLabel="Roles"
          canOpen={Boolean(profile.role && canReadRoles)}
          icon={<ShieldCheck className="size-4" />}
          label="Role catalogue"
          meta={profile.role?.isSystem ? 'System role' : 'Custom role'}
          value={profile.role?.roleCode ?? 'No role'}
          onOpen={() => onNavigate(buildProfileRoleCataloguePath(profile))}
        />
        <RelatedRecordRow
          actionLabel="Activity"
          canOpen={canReadAudit}
          icon={<ClipboardList className="size-4" />}
          label="Performed actions"
          meta="Filtered by actor admin ID"
          value={profile.adminId}
          onOpen={() => onNavigate(buildProfileActorAuditPath(profile))}
        />
        <RelatedRecordRow
          actionLabel="Audit"
          canOpen={canReadAudit}
          icon={<ClipboardList className="size-4" />}
          label="Profile changes"
          meta="Filtered by admin user record"
          value={profile.adminId}
          onOpen={() => onNavigate(buildProfileEntityAuditPath(profile))}
        />
        <RelatedRecordRow
          actionLabel="Session"
          canOpen
          icon={<KeyRound className="size-4" />}
          label="Auth user"
          meta="Identity user backing the admin account"
          value={profile.userId}
          onOpen={() => onOpenSection(profileSectionIds.session)}
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
  const canUpdateAdminUsers = usePermission('admin_users:update')
  const profileQuery = useQuery({
    queryKey: ['admin-me'],
    queryFn: adminUserService.getMe,
  })

  const profile = profileQuery.data?.data

  const openSection = (sectionId: ProfileSectionId) => {
    const section = document.getElementById(sectionId)

    section?.scrollIntoView({ behavior: 'smooth', block: 'start' })

    if (section) {
      window.history.replaceState(null, '', `#${sectionId}`)
    }
  }

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

  const profileWarnings = getProfileWarnings(profile)

  return (
    <PageContainer className="flex h-full min-h-0 flex-col !overflow-y-auto !px-3 !py-3 !pb-6 space-y-3 scroll-smooth sm:!px-4 lg:!px-6">
      <PageContextHeader layout="workspace" placement="topbar" title="Profile" />

      <ProfileHeroCard
        canReadAdminUsers={canReadAdminUsers}
        canReadAudit={canReadAudit}
        canUpdateAdminUsers={canUpdateAdminUsers}
        isRefreshing={profileQuery.isRefetching}
        profile={profile}
        onNavigate={navigate}
        onRefresh={() => void profileQuery.refetch()}
      />

      <ProfileSectionNav
        warningCount={profileWarnings.length}
        onOpenSection={openSection}
      />

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.55fr)]">
        <AccountPanel profile={profile} />
        <RolePanel
          canReadRoles={canReadRoles}
          profile={profile}
          onNavigate={navigate}
        />
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.55fr)]">
        <PermissionsPanel permissions={profile.permissions} />
        <ScopesPanel scopes={profile.scopes} />
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.55fr)]">
        <SessionPanel profile={profile} />
        <LifecyclePanel profile={profile} />
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.55fr)]">
        <RelatedRecordsPanel
          canReadAdminUsers={canReadAdminUsers}
          canReadAudit={canReadAudit}
          canReadRoles={canReadRoles}
          canUpdateAdminUsers={canUpdateAdminUsers}
          profile={profile}
          onNavigate={navigate}
          onOpenSection={openSection}
        />
        <SignalsPanel
          canReadAdminUsers={canReadAdminUsers}
          canReadAudit={canReadAudit}
          canReadRoles={canReadRoles}
          canUpdateAdminUsers={canUpdateAdminUsers}
          profile={profile}
        />
      </section>
    </PageContainer>
  )
}
