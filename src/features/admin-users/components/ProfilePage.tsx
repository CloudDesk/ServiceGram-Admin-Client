import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  ArrowUpRight,
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
import {
  RecordBadgeGroup,
  RecordField,
  RecordFieldList,
  RecordMetricStrip,
  RecordSection,
  RelatedRecordRow,
} from '../../../components/ui/RecordPage'
import { routePaths } from '../../../config/routes'
import { usePermission } from '../../../hooks/usePermission'
import type { StatusTone } from '../../../types/status.types'
import { buildPathWithQueryParams } from '../../../utils/buildQueryParams'
import { formatDate } from '../../../utils/formatDate'
import { adminUserService } from '../services/adminUser.service'
import type {
  AdminUserRole,
  AdminUserScope,
  CurrentAdminUser,
} from '../types/adminUser.types'

function humanizeCode(value: string | null | undefined) {
  if (!value) return 'Not available'

  return value
    .replace(/^release2[-_:]?/i, '')
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

function adminStatusTone(status: string): StatusTone {
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
  const parts = (value ?? '').trim().split(/\s+/).filter(Boolean)

  if (!parts.length) return 'AD'

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

function buildProfileAdminUsersListPath(profile: CurrentAdminUser) {
  return (
    buildPathWithQueryParams(routePaths.adminUsers, {
      roleId: profile.role?.roleId,
      search: profile.email ?? profile.fullName,
      status: profile.status,
    }) + '#admin-users-records'
  )
}

function buildProfileActorAuditPath(profile: CurrentAdminUser) {
  return buildPathWithQueryParams(routePaths.audit, { actorAdminId: profile.adminId })
}

function buildProfileEntityAuditPath(profile: CurrentAdminUser) {
  return buildPathWithQueryParams(routePaths.audit, {
    entityId: profile.adminId,
    entityType: 'admin_user',
    moduleCode: 'admin_users',
  })
}

function buildProfileRoleCataloguePath(profile: CurrentAdminUser) {
  return (
    buildPathWithQueryParams(routePaths.roles, {
      search: profile.role?.roleCode,
      status: profile.role?.isActive ? 'active' : 'inactive',
      type: profile.role?.isSystem ? 'system' : 'custom',
    }) + '#roles-records'
  )
}

function HeaderStatus({ profile }: { profile: CurrentAdminUser }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={adminStatusTone(profile.status)}>{humanizeCode(profile.status)}</Badge>
      <Badge tone={authStatusTone(profile.userStatus)}>
        Auth {humanizeCode(profile.userStatus)}
      </Badge>
      <Badge tone={roleTone(profile.role)}>{profile.role?.roleCode ?? 'NO_ROLE'}</Badge>
      {profile.scopes.map((scope) => (
        <Badge key={scopeKey(scope)} tone="neutral">
          {scope.scopeType}
        </Badge>
      ))}
    </div>
  )
}

function ProfileHeroCard({
  canReadAdminUsers,
  canReadAudit,
  isRefreshing,
  onNavigate,
  onRefresh,
  profile,
}: {
  canReadAdminUsers: boolean
  canReadAudit: boolean
  isRefreshing: boolean
  onNavigate: (path: string) => void
  onRefresh: () => void
  profile: CurrentAdminUser
}) {
  return (
    <section className="rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface">
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
            <p className="mt-1.5 truncate text-xs text-muted">
              {profile.email ?? profile.userId} · {profile.adminId}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 xl:justify-end">
          {canReadAdminUsers ? (
            <Button
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => onNavigate(`${routePaths.adminUsers}/${profile.adminId}`)}
            >
              <ArrowUpRight className="mr-2 size-4" />
              Manage
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
          <Button isLoading={isRefreshing} size="sm" type="button" variant="secondary" onClick={onRefresh}>
            <RefreshCcw className="mr-2 size-4" />
            Refresh
          </Button>
        </div>
      </div>
    </section>
  )
}

function scopeKey(scope: AdminUserScope) {
  return `${scope.scopeType}-${scope.scopeId ?? scope.scopeRefId ?? 'global'}`
}

function ScopesPanel({ scopes }: { scopes: AdminUserScope[] }) {
  return (
    <RecordSection icon={<KeyRound className="size-4" />} title="Scopes">
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
                  <p className="text-sm font-semibold text-foreground">{scope.scopeType}</p>
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
    </RecordSection>
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
    <RecordSection icon={<ShieldCheck className="size-4" />} title="Permissions">
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
    </RecordSection>
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
  }, [canReadAdminUsers, canReadAudit, canReadRoles, canUpdateAdminUsers, profile.role, profile.session])

  return (
    <RecordSection icon={<TriangleAlert className="size-4" />} title="Signals">
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">Warnings</p>
          <RecordBadgeGroup emptyLabel="No warnings" items={warnings} tone="warning" formatItem={humanizeCode} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
            Available drill-downs
          </p>
          <RecordBadgeGroup emptyLabel="No related access" items={drillDowns} tone="info" formatItem={humanizeCode} />
        </div>
      </div>
    </RecordSection>
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
    <RecordSection icon={<ArrowUpRight className="size-4" />} title="Related records">
      <div className="divide-y divide-border">
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
      </div>
    </RecordSection>
  )
}

function DetailSkeleton() {
  return (
    <PageContainer className="space-y-3">
      <Skeleton className="h-32 w-full rounded-[0.875rem]" />
      <div className="grid gap-3 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton className="h-48 rounded-[0.875rem]" key={index} />
        ))}
      </div>
    </PageContainer>
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
        <EmptyState description="The profile API returned no admin user data." title="Profile not found" />
      </PageContainer>
    )
  }

  return (
    <PageContainer className="space-y-3">
      <PageContextHeader layout="workspace" placement="topbar" title="Profile" />

      <ProfileHeroCard
        canReadAdminUsers={canReadAdminUsers}
        canReadAudit={canReadAudit}
        isRefreshing={profileQuery.isRefetching}
        profile={profile}
        onNavigate={navigate}
        onRefresh={() => void profileQuery.refetch()}
      />

      <RecordMetricStrip
        metrics={[
          { label: 'Permissions', value: String(profile.permissions.length) },
          { label: 'Scopes', value: String(profile.scopes.length) },
          { label: 'Updated', value: formatDateSafe(profile.updatedAt) },
        ]}
      />

      <section className="grid gap-3 xl:grid-cols-2">
        <RecordSection icon={<UserRound className="size-4" />} title="Account">
          <RecordFieldList>
            <RecordField label="Full name" value={profile.fullName} />
            <RecordField label="Email" value={profile.email} />
            <RecordField
              label="Admin status"
              value={<Badge tone={adminStatusTone(profile.status)}>{humanizeCode(profile.status)}</Badge>}
            />
            <RecordField
              label="Auth status"
              value={<Badge tone={authStatusTone(profile.userStatus)}>{humanizeCode(profile.userStatus)}</Badge>}
            />
            <RecordField label="Admin ID" value={profile.adminId} />
            <RecordField label="Auth user ID" value={profile.userId} />
            <RecordField label="Created" value={formatDateSafe(profile.createdAt)} />
            <RecordField label="Last login" value={formatDateSafe(profile.lastLoginAt)} />
          </RecordFieldList>
        </RecordSection>

        <RecordSection
          actionNode={
            profile.role && canReadRoles ? (
              <Button
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => navigate(`${routePaths.roles}/${profile.role?.roleId}`)}
              >
                <ArrowUpRight className="mr-2 size-4" />
                Open
              </Button>
            ) : null
          }
          icon={<ShieldCheck className="size-4" />}
          title="Role"
        >
          <RecordFieldList>
            <RecordField label="Role name" value={profile.role?.roleName} />
            <RecordField label="Role code" value={profile.role?.roleCode} />
            <RecordField label="Role type" value={profile.role?.isSystem ? 'System' : profile.role ? 'Custom' : null} />
            <RecordField
              label="Role active"
              value={
                profile.role ? (
                  <Badge tone={profile.role.isActive ? 'success' : 'warning'}>
                    {profile.role.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                ) : null
              }
            />
            <RecordField
              label="Role codes"
              value={
                profile.roleCodes.length ? (
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {profile.roleCodes.map((roleCode) => (
                      <Badge key={roleCode} tone="neutral">
                        {roleCode}
                      </Badge>
                    ))}
                  </div>
                ) : null
              }
            />
          </RecordFieldList>
        </RecordSection>
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        <PermissionsPanel permissions={profile.permissions} />
        <ScopesPanel scopes={profile.scopes} />
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        <RelatedRecordsPanel
          canReadAdminUsers={canReadAdminUsers}
          canReadAudit={canReadAudit}
          canReadRoles={canReadRoles}
          profile={profile}
          onNavigate={navigate}
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
