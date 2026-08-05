import type { FormEvent, ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowUpRight,
  CalendarClock,
  ClipboardList,
  Edit3,
  KeyRound,
  Lock,
  Plus,
  Save,
  ShieldCheck,
  TriangleAlert,
  Users,
  X,
} from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import {
  DetailPageHeader,
  DetailPageHeaderSkeleton,
} from '../../../components/layout/DetailPageHeader'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Skeleton } from '../../../components/ui/Skeleton'
import { routePaths } from '../../../config/routes'
import { usePermission } from '../../../hooks/usePermission'
import type { StatusTone } from '../../../types/status.types'
import { buildPathWithQueryParams } from '../../../utils/buildQueryParams'
import { formatDate } from '../../../utils/formatDate'
import { rbacService } from '../services/rbac.service'
import { PermissionMatrix } from './PermissionMatrix'
import type {
  PermissionGroup,
  RoleDetail,
  UpdateRolePayload,
  UpdateRolePermissionsPayload,
} from '../types/rbac.types'

type ModalKind = 'EDIT_DETAILS' | 'MANAGE_PERMISSIONS'
const roleDetailSectionIds = {
  overview: 'role-overview',
  details: 'role-details',
  lifecycle: 'role-lifecycle',
  permissions: 'role-permissions',
  related: 'role-related',
  signals: 'role-signals',
} as const
type RoleDetailSectionId =
  (typeof roleDetailSectionIds)[keyof typeof roleDetailSectionIds]

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

function statusTone(isActive: boolean): StatusTone {
  return isActive ? 'success' : 'danger'
}

function roleTypeLabel(role: RoleDetail) {
  return role.isSystem ? 'System' : 'Custom'
}

function getRoleWarnings(role: RoleDetail) {
  const items: string[] = []

  if (role.isSystem) items.push('SYSTEM_ROLE_LOCKED')
  if (!role.isActive) items.push('ROLE_INACTIVE')
  if (role.permissions.length === 0) items.push('NO_PERMISSIONS_ASSIGNED')

  return items
}

function buildRolesCataloguePath(role: RoleDetail) {
  return buildPathWithQueryParams(routePaths.roles, {
    search: role.roleCode,
    status: role.isActive ? 'active' : 'inactive',
    type: role.isSystem ? 'system' : 'custom',
  }) + '#roles-records'
}

function buildRoleAdminUsersPath(role: RoleDetail) {
  return buildPathWithQueryParams(routePaths.adminUsers, {
    roleId: role.roleId,
  }) + '#admin-users-records'
}

function buildRoleAuditPath(role: RoleDetail) {
  return buildPathWithQueryParams(routePaths.audit, {
    moduleCode: 'rbac',
    entityType: 'role',
    entityId: role.roleId,
  })
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
      className="scroll-mt-24 rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface"
      id={id}
    >
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

function RoleStatus({ role }: { role: RoleDetail }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={statusTone(role.isActive)}>
        {role.isActive ? 'Active' : 'Inactive'}
      </Badge>
      <Badge tone={role.isSystem ? 'info' : 'neutral'}>{roleTypeLabel(role)}</Badge>
      <Badge tone="neutral">{role.permissions.length} permissions</Badge>
    </div>
  )
}

function HeaderActions({
  canCreateRole,
  canManagePermissions,
  canUpdateRole,
  isSubmitting,
  role,
  onSelect,
}: {
  canCreateRole: boolean
  canManagePermissions: boolean
  canUpdateRole: boolean
  isSubmitting: boolean
  role: RoleDetail
  onSelect: (modal: ModalKind) => void
}) {
  const roleLocked = role.isSystem

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {canCreateRole ? (
        <Link to={`${routePaths.roles}/new`}>
          <Button size="sm" type="button" variant="secondary">
            <Plus className="mr-2 size-4" />
            New
          </Button>
        </Link>
      ) : null}
      {roleLocked ? (
        <Button disabled size="sm" type="button" variant="secondary">
          <Lock className="mr-2 size-4" />
          System Role
        </Button>
      ) : null}
      {canUpdateRole ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          type="button"
          variant="secondary"
          onClick={() => onSelect('EDIT_DETAILS')}
        >
          <Edit3 className="mr-2 size-4" />
          Edit
        </Button>
      ) : null}
      {canManagePermissions ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          type="button"
          onClick={() => onSelect('MANAGE_PERMISSIONS')}
        >
          <ShieldCheck className="mr-2 size-4" />
          Permissions
        </Button>
      ) : null}
    </div>
  )
}

function RoleHeroCard({
  canCreateRole,
  canManagePermissions,
  canUpdateRole,
  isSubmitting,
  onSelect,
  role,
}: {
  canCreateRole: boolean
  canManagePermissions: boolean
  canUpdateRole: boolean
  isSubmitting: boolean
  onSelect: (modal: ModalKind) => void
  role: RoleDetail
}) {
  const moduleCount = new Set(
    role.permissions.map((permission) => permission.moduleCode),
  ).size

  return (
    <section className="rounded-[1rem] border border-border bg-surface p-3 shadow-surface sm:p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-[0.9rem] bg-primary/10 text-primary ring-1 ring-primary/15 sm:size-16">
            <KeyRound className="size-7" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">
                {role.roleName}
              </h1>
              <RoleStatus role={role} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <ShieldCheck className="size-3.5 shrink-0" />
                <span className="truncate">{role.roleCode}</span>
              </span>
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <KeyRound className="size-3.5 shrink-0" />
                <span>{role.permissions.length} permissions</span>
              </span>
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <ClipboardList className="size-3.5 shrink-0" />
                <span>{moduleCount} modules</span>
              </span>
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <CalendarClock className="size-3.5 shrink-0" />
                <span>Updated {formatDateSafe(role.updatedAt)}</span>
              </span>
            </div>
            <p className="mt-3 line-clamp-2 max-w-4xl text-sm leading-5 text-muted">
              {role.description ?? 'No role description added.'}
            </p>
          </div>
        </div>
        <HeaderActions
          canCreateRole={canCreateRole}
          canManagePermissions={canManagePermissions}
          canUpdateRole={canUpdateRole}
          isSubmitting={isSubmitting}
          role={role}
          onSelect={onSelect}
        />
      </div>
    </section>
  )
}

function RoleDetailSectionNav({
  canReadAdminUsers,
  canReadAudit,
  role,
}: {
  canReadAdminUsers: boolean
  canReadAudit: boolean
  role: RoleDetail
}) {
  const warnings = getRoleWarnings(role)
  const items = [
    { href: `#${roleDetailSectionIds.overview}`, label: 'Overview' },
    {
      count: role.permissions.length,
      href: `#${roleDetailSectionIds.permissions}`,
      label: 'Permissions',
    },
    canReadAdminUsers
      ? { href: `#${roleDetailSectionIds.related}`, label: 'Users' }
      : null,
    canReadAudit ? { href: `#${roleDetailSectionIds.related}`, label: 'Audit' } : null,
    {
      count: warnings.length,
      href: `#${roleDetailSectionIds.signals}`,
      label: 'Guardrails',
    },
    { href: `#${roleDetailSectionIds.lifecycle}`, label: 'Lifecycle' },
  ].filter(Boolean) as { count?: number; href: string; label: string }[]

  return (
    <nav
      aria-label="Role detail sections"
      className="sticky top-[3.4rem] z-40 -mx-3 overflow-x-auto border-b border-border bg-surface/95 px-3 backdrop-blur sm:-mx-4 sm:px-4 lg:-mx-6 lg:px-6"
    >
      <div className="flex min-w-max items-center gap-1.5 py-2">
        {items.map((item) => (
          <a
            className="inline-flex min-h-9 items-center gap-2 rounded-[0.65rem] px-3 text-sm font-semibold text-muted transition hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={item.href}
            key={`${item.label}-${item.href}`}
          >
            <span>{item.label}</span>
            {typeof item.count === 'number' ? (
              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted">
                {item.count}
              </span>
            ) : null}
          </a>
        ))}
      </div>
    </nav>
  )
}

function DetailSkeleton() {
  return (
    <PageContainer>
      <DetailPageHeaderSkeleton />
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

function LifecyclePanel({ role }: { role: RoleDetail }) {
  return (
    <SectionShell
      description="Role metadata and timestamps returned by the RBAC API."
      icon={<CalendarClock className="size-4" />}
      id={roleDetailSectionIds.lifecycle}
      title="Lifecycle"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailField label="Created" value={formatDateSafe(role.createdAt)} />
        <DetailField label="Updated" value={formatDateSafe(role.updatedAt)} />
        <DetailField label="Role ID" value={role.roleId} />
        <DetailField label="Role code" value={role.roleCode} />
        <DetailField
          label="Role type"
          value={<Badge tone={role.isSystem ? 'info' : 'neutral'}>{roleTypeLabel(role)}</Badge>}
        />
        <DetailField
          label="Status"
          value={
            <Badge tone={statusTone(role.isActive)}>
              {role.isActive ? 'Active' : 'Inactive'}
            </Badge>
          }
        />
      </div>
    </SectionShell>
  )
}

function DetailsPanel({ role }: { role: RoleDetail }) {
  return (
    <SectionShell
      description="Human-readable role purpose and assignment status."
      icon={<KeyRound className="size-4" />}
      id={roleDetailSectionIds.details}
      title="Role details"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailField label="Role name" value={role.roleName} />
        <DetailField label="Role code" value={role.roleCode} />
        <DetailField label="Description" value={role.description} />
        <DetailField label="Permission count" value={role.permissions.length} />
      </div>
    </SectionShell>
  )
}

function SignalsPanel({
  canManagePermissions,
  canReadAdminUsers,
  canReadAudit,
  canUpdateRole,
  role,
}: {
  canManagePermissions: boolean
  canReadAdminUsers: boolean
  canReadAudit: boolean
  canUpdateRole: boolean
  role: RoleDetail
}) {
  const warnings = useMemo(() => getRoleWarnings(role), [role])

  const controls = useMemo(() => {
    const items: string[] = []

    if (canUpdateRole) items.push('EDIT_ROLE_DETAILS')
    if (canManagePermissions) items.push('REPLACE_PERMISSION_SET')
    if (canReadAdminUsers) items.push('OPEN_ADMIN_USERS')
    if (canReadAudit) items.push('OPEN_AUDIT')

    return items
  }, [canManagePermissions, canReadAdminUsers, canReadAudit, canUpdateRole])

  return (
    <SectionShell
      description="Access warnings and controls available to the current admin."
      icon={<TriangleAlert className="size-4" />}
      id={roleDetailSectionIds.signals}
      title="Guardrails"
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
  canManagePermissions,
  canReadAdminUsers,
  canReadAudit,
  canUpdateRole,
  onManagePermissions,
  onNavigate,
  onOpenSection,
  onUpdateRole,
  role,
}: {
  canManagePermissions: boolean
  canReadAdminUsers: boolean
  canReadAudit: boolean
  canUpdateRole: boolean
  onManagePermissions: () => void
  onNavigate: (path: string) => void
  onOpenSection: (sectionId: RoleDetailSectionId) => void
  onUpdateRole: () => void
  role: RoleDetail
}) {
  return (
    <SectionShell
      description="Admins, audit records, and role catalogue shortcuts."
      icon={<ArrowUpRight className="size-4" />}
      id={roleDetailSectionIds.related}
      title="Connected access"
    >
      <div className="divide-y divide-border">
        <RelatedRecordRow
          actionLabel="Roles"
          canOpen
          icon={<ShieldCheck className="size-4" />}
          label="Role catalogue"
          meta={`${roleTypeLabel(role)} role`}
          value={role.roleCode}
          onOpen={() => onNavigate(buildRolesCataloguePath(role))}
        />
        <RelatedRecordRow
          actionLabel="Admins"
          canOpen={canReadAdminUsers}
          icon={<Users className="size-4" />}
          label="Assigned admin users"
          meta="Use role filter on the admin users list"
          value={role.roleName}
          onOpen={() => onNavigate(buildRoleAdminUsersPath(role))}
        />
        <RelatedRecordRow
          actionLabel="Audit"
          canOpen={canReadAudit}
          icon={<ClipboardList className="size-4" />}
          label="Audit trail"
          meta="Filtered by RBAC module, role entity, and role id"
          value={role.roleId}
          onOpen={() => onNavigate(buildRoleAuditPath(role))}
        />
        <RelatedRecordRow
          actionLabel="View"
          canOpen
          icon={<ShieldCheck className="size-4" />}
          label="Assigned permissions"
          meta="Permission matrix inside this role detail"
          value={`${role.permissions.length} permissions`}
          onOpen={() => onOpenSection(roleDetailSectionIds.permissions)}
        />
        <RelatedRecordRow
          actionLabel="Edit"
          canOpen={canUpdateRole}
          icon={<Edit3 className="size-4" />}
          label="Role controls"
          meta="Name, description, and assignability"
          value={role.isSystem ? 'Locked' : humanizeCode(role.isActive ? 'ACTIVE' : 'INACTIVE')}
          onOpen={onUpdateRole}
        />
        <RelatedRecordRow
          actionLabel="Manage"
          canOpen={canManagePermissions}
          icon={<KeyRound className="size-4" />}
          label="Permission set"
          meta="Full replacement assignment"
          value={`${role.permissions.length} permissions`}
          onOpen={onManagePermissions}
        />
      </div>
    </SectionShell>
  )
}

function PermissionsPanel({
  canReadPermissions,
  permissionGroups,
  permissionsLoading,
  permissionsError,
  role,
  selectedPermissionIds,
  onRetry,
}: {
  canReadPermissions: boolean
  permissionGroups: PermissionGroup[]
  permissionsLoading: boolean
  permissionsError: Error | null
  role: RoleDetail
  selectedPermissionIds: Set<string>
  onRetry: () => void
}) {
  const moduleCount = new Set(role.permissions.map((permission) => permission.moduleCode)).size

  return (
    <SectionShell
      description={`${role.permissions.length} permissions across ${moduleCount} module${moduleCount === 1 ? '' : 's'}.`}
      icon={<ShieldCheck className="size-4" />}
      id={roleDetailSectionIds.permissions}
      title="Permissions"
    >
      {!canReadPermissions ? (
        <EmptyState
          description="Permission catalogue access is required to view the full role permission matrix."
          title="Permission matrix locked"
        />
      ) : permissionsError ? (
        <ErrorState
          description={permissionsError.message}
          title="Permissions unavailable"
          onRetry={onRetry}
        />
      ) : permissionsLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-[0.875rem]" />
          <Skeleton className="h-24 w-full rounded-[0.875rem]" />
          <Skeleton className="h-24 w-full rounded-[0.875rem]" />
        </div>
      ) : permissionGroups.length === 0 ? (
        <EmptyState
          description="No permissions are available for this role."
          title="No permissions"
        />
      ) : (
        <PermissionMatrix
          disabled
          groups={permissionGroups}
          selectedPermissionIds={selectedPermissionIds}
          onToggle={() => undefined}
        />
      )}
    </SectionShell>
  )
}

function EditRoleModal({
  error,
  isSubmitting,
  onClose,
  onSubmit,
  role,
}: {
  error: string | null
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (payload: UpdateRolePayload) => void
  role: RoleDetail
}) {
  const [roleName, setRoleName] = useState(role.roleName)
  const [description, setDescription] = useState(role.description ?? '')
  const [isActive, setIsActive] = useState(role.isActive)
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    const trimmedRoleName = roleName.trim()
    const trimmedDescription = description.trim()
    const trimmedReason = reason.trim()

    if (trimmedRoleName.length < 2) {
      setFormError('Role name must be at least 2 characters.')
      return
    }

    if (trimmedDescription.length > 500) {
      setFormError('Description must be 500 characters or fewer.')
      return
    }

    if (trimmedReason.length < 3) {
      setFormError('Reason must be at least 3 characters.')
      return
    }

    onSubmit({
      roleName: trimmedRoleName,
      description: trimmedDescription || null,
      isActive,
      reason: trimmedReason,
    })
  }

  return (
    <div className="premium-overlay flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-[0.875rem] border border-border bg-surface shadow-[var(--shadow-overlay)]">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Edit role</h2>
            <p className="mt-1 text-sm text-muted">
              Role detail changes are audited and affect future assignments.
            </p>
          </div>
          <button
            aria-label="Close edit role"
            className="rounded-full p-2 text-muted transition hover:bg-surface-muted hover:text-foreground"
            disabled={isSubmitting}
            type="button"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="space-y-4 px-5 py-5 sm:px-6">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">Role name</span>
              <input
                className="form-input"
                value={roleName}
                onChange={(event) => setRoleName(event.target.value)}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">Status</span>
              <select
                className="form-input"
                value={isActive ? 'ACTIVE' : 'INACTIVE'}
                onChange={(event) => setIsActive(event.target.value === 'ACTIVE')}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">Description</span>
              <textarea
                className="form-input min-h-24 resize-y"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">
                Reason <span className="text-danger">*</span>
              </span>
              <textarea
                className="form-input min-h-20 resize-y"
                placeholder="Scope updated after operations review."
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>

            {formError || error ? (
              <div className="rounded-[0.75rem] border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
                {formError ?? error}
              </div>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 border-t border-border px-5 py-4 sm:px-6">
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

function ManagePermissionsModal({
  error,
  isSubmitting,
  onClose,
  onSubmit,
  permissionGroups,
  permissionsError,
  permissionsLoading,
  role,
}: {
  error: string | null
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (payload: UpdateRolePermissionsPayload) => void
  permissionGroups: PermissionGroup[]
  permissionsError: Error | null
  permissionsLoading: boolean
  role: RoleDetail
}) {
  const currentPermissionIds = useMemo(
    () => new Set(role.permissions.map((permission) => permission.permissionId)),
    [role.permissions],
  )
  const [selectedPermissionIds, setSelectedPermissionIds] = useState(
    () => new Set(currentPermissionIds),
  )
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const selectedCount = selectedPermissionIds.size
  const removedCount = role.permissions.filter(
    (permission) => !selectedPermissionIds.has(permission.permissionId),
  ).length
  const addedCount = Array.from(selectedPermissionIds).filter(
    (permissionId) => !currentPermissionIds.has(permissionId),
  ).length

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

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    const trimmedReason = reason.trim()

    if (trimmedReason.length < 3) {
      setFormError('Reason must be at least 3 characters.')
      return
    }

    onSubmit({
      permissionIds: Array.from(selectedPermissionIds),
      reason: trimmedReason,
    })
  }

  return (
    <div className="premium-overlay flex items-start justify-center overflow-y-auto p-3 sm:p-6 lg:items-center">
      <div className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-[var(--shadow-overlay)] sm:max-h-[calc(100vh-3rem)]">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Manage permissions
            </h2>
            <p className="mt-1 text-sm text-muted">
              This replaces the full permission set for {role.roleName}.
            </p>
          </div>
          <button
            aria-label="Close manage permissions"
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
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <DetailField label="Selected" value={selectedCount} />
              <DetailField label="Added" value={addedCount} />
              <DetailField label="Removed" value={removedCount} />
            </div>

            {permissionsError ? (
              <ErrorState
                description={permissionsError.message}
                title="Permissions unavailable"
              />
            ) : permissionsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-24 w-full rounded-[0.875rem]" />
                <Skeleton className="h-24 w-full rounded-[0.875rem]" />
                <Skeleton className="h-24 w-full rounded-[0.875rem]" />
              </div>
            ) : permissionGroups.length === 0 ? (
              <EmptyState
                description="No permissions are available for this role."
                title="No permissions"
              />
            ) : (
              <PermissionMatrix
                groups={permissionGroups}
                selectedPermissionIds={selectedPermissionIds}
                onToggle={togglePermission}
              />
            )}

            <label className="mt-5 block space-y-2">
              <span className="text-sm font-semibold text-foreground">
                Reason <span className="text-danger">*</span>
              </span>
              <textarea
                className="form-input min-h-20 resize-y"
                placeholder="Added vendor approval access."
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>

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
            <Button
              disabled={Boolean(permissionsError) || permissionsLoading}
              isLoading={isSubmitting}
              size="sm"
              type="submit"
            >
              <ShieldCheck className="mr-2 size-4" />
              Replace permissions
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function RoleDetailPage() {
  const { roleId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canCreateRole = usePermission('roles:create')
  const canUpdateRolePermission = usePermission('roles:update')
  const canManageRolePermissions = usePermission('roles:manage_permissions')
  const canReadPermissions = usePermission('permissions:read')
  const canReadAdminUsers = usePermission('admin_users:read')
  const canReadAudit = usePermission('audit:read')
  const [activeModal, setActiveModal] = useState<ModalKind | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const roleQuery = useQuery({
    enabled: Boolean(roleId),
    queryKey: ['rbac', 'roles', roleId],
    queryFn: () => rbacService.getRoleById(roleId as string),
  })

  const permissionsQuery = useQuery({
    enabled: canReadPermissions,
    queryKey: ['rbac', 'permissions'],
    queryFn: () => rbacService.getPermissions(),
  })

  const role = roleQuery.data?.data
  const permissionGroups = permissionsQuery.data?.data ?? []
  const selectedPermissionIds = useMemo(
    () => new Set(role?.permissions.map((permission) => permission.permissionId) ?? []),
    [role?.permissions],
  )
  const canUpdateRole = Boolean(role && !role.isSystem && canUpdateRolePermission)
  const canManagePermissions = Boolean(
    role && !role.isSystem && canManageRolePermissions && canReadPermissions,
  )

  useEffect(() => {
    if (!role) return

    const sectionId = window.location.hash.replace('#', '')

    if (
      !Object.values(roleDetailSectionIds).includes(
        sectionId as RoleDetailSectionId,
      )
    ) {
      return
    }

    window.requestAnimationFrame(() => {
      document
        .getElementById(sectionId)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [role])

  const openSection = (sectionId: RoleDetailSectionId) => {
    const section = document.getElementById(sectionId)

    section?.scrollIntoView({ behavior: 'smooth', block: 'start' })

    if (section) {
      window.history.replaceState(null, '', `#${sectionId}`)
    }
  }

  const refreshRole = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['rbac', 'roles'] }),
      queryClient.invalidateQueries({ queryKey: ['rbac', 'roles', roleId] }),
    ])
  }

  const updateDetailsMutation = useMutation({
    mutationFn: (payload: UpdateRolePayload) => {
      if (!roleId) {
        throw new Error('Role id is missing.')
      }

      return rbacService.updateRole(roleId, payload)
    },
    onMutate: () => {
      setActionError(null)
      setActionMessage(null)
    },
    onSuccess: async (response) => {
      setActionMessage(response.message ?? 'Role details updated.')
      await refreshRole()
      setActiveModal(null)
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : 'Role details update failed.',
      )
    },
  })

  const updatePermissionsMutation = useMutation({
    mutationFn: (payload: UpdateRolePermissionsPayload) => {
      if (!roleId) {
        throw new Error('Role id is missing.')
      }

      return rbacService.updateRolePermissions(roleId, payload)
    },
    onMutate: () => {
      setActionError(null)
      setActionMessage(null)
    },
    onSuccess: async (response) => {
      setActionMessage(response.message ?? 'Role permissions updated.')
      await refreshRole()
      setActiveModal(null)
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : 'Role permissions update failed.',
      )
    },
  })

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
    return <DetailSkeleton />
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
    <PageContainer className="!px-3 !py-3 space-y-3 sm:!px-4 lg:!px-6">
      <DetailPageHeader
        listHref={routePaths.roles}
        listLabel="Roles"
        recordName={role.roleName}
      />

      <RoleHeroCard
        canCreateRole={canCreateRole}
        canManagePermissions={canManagePermissions}
        canUpdateRole={canUpdateRole}
        isSubmitting={
          updateDetailsMutation.isPending || updatePermissionsMutation.isPending
        }
        role={role}
        onSelect={(modal) => {
          setActionError(null)
          setActiveModal(modal)
        }}
      />

      <RoleDetailSectionNav
        canReadAdminUsers={canReadAdminUsers}
        canReadAudit={canReadAudit}
        role={role}
      />

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
      {role.isSystem ? (
        <div className="rounded-[0.875rem] border border-info/25 bg-info/10 p-3 text-sm text-info">
          System roles are locked by the backend. Create or edit a custom role to
          change access.
        </div>
      ) : null}
      {!canReadPermissions ? (
        <div className="rounded-[0.875rem] border border-warning/25 bg-warning/10 p-3 text-sm text-warning">
          Permission catalogue access is required to view and manage the full
          permission matrix.
        </div>
      ) : null}

      <section
        className="scroll-mt-24 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.55fr)]"
        id={roleDetailSectionIds.overview}
      >
        <DetailsPanel role={role} />
        <LifecyclePanel role={role} />
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.55fr)]">
        <div className="space-y-3">
          <PermissionsPanel
            canReadPermissions={canReadPermissions}
            permissionGroups={permissionGroups}
            permissionsError={
              permissionsQuery.isError
                ? permissionsQuery.error instanceof Error
                  ? permissionsQuery.error
                  : new Error('Permissions could not be loaded.')
                : null
            }
            permissionsLoading={permissionsQuery.isLoading}
            role={role}
            selectedPermissionIds={selectedPermissionIds}
            onRetry={() => void permissionsQuery.refetch()}
          />
        </div>
        <div className="space-y-3">
          <RelatedRecordsPanel
            canManagePermissions={canManagePermissions}
            canReadAdminUsers={canReadAdminUsers}
            canReadAudit={canReadAudit}
            canUpdateRole={canUpdateRole}
            role={role}
            onManagePermissions={() => {
              setActionError(null)
              setActiveModal('MANAGE_PERMISSIONS')
            }}
            onNavigate={navigate}
            onOpenSection={openSection}
            onUpdateRole={() => {
              setActionError(null)
              setActiveModal('EDIT_DETAILS')
            }}
          />
          <SignalsPanel
            canManagePermissions={canManagePermissions}
            canReadAdminUsers={canReadAdminUsers}
            canReadAudit={canReadAudit}
            canUpdateRole={canUpdateRole}
            role={role}
          />
        </div>
      </section>

      {activeModal === 'EDIT_DETAILS' ? (
        <EditRoleModal
          error={actionError}
          isSubmitting={updateDetailsMutation.isPending}
          role={role}
          onClose={() => {
            if (!updateDetailsMutation.isPending) setActiveModal(null)
          }}
          onSubmit={(payload) => updateDetailsMutation.mutate(payload)}
        />
      ) : null}

      {activeModal === 'MANAGE_PERMISSIONS' ? (
        <ManagePermissionsModal
          error={actionError}
          isSubmitting={updatePermissionsMutation.isPending}
          permissionGroups={permissionGroups}
          permissionsError={
            permissionsQuery.isError
              ? permissionsQuery.error instanceof Error
                ? permissionsQuery.error
                : new Error('Permissions could not be loaded.')
              : null
          }
          permissionsLoading={permissionsQuery.isLoading}
          role={role}
          onClose={() => {
            if (!updatePermissionsMutation.isPending) setActiveModal(null)
          }}
          onSubmit={(payload) => updatePermissionsMutation.mutate(payload)}
        />
      ) : null}
    </PageContainer>
  )
}
