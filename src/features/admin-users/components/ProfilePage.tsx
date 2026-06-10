import { useQuery } from '@tanstack/react-query'
import { Badge } from '../../../components/ui/Badge'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Skeleton } from '../../../components/ui/Skeleton'
import { PageContainer } from '../../../components/layout/PageContainer'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { adminUserService } from '../services/adminUser.service'

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

export function ProfilePage() {
  const profileQuery = useQuery({
    queryKey: ['admin-me'],
    queryFn: adminUserService.getMe,
  })

  const profile = profileQuery.data?.data

  if (profileQuery.isLoading) {
    return (
      <PageContainer>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[20rem] w-full" />
      </PageContainer>
    )
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
        description={profile.email ?? profile.userId}
        title="My Profile"
        titleMetaNode={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={profile.status === 'ACTIVE' ? 'success' : 'danger'}>
              {profile.status}
            </Badge>
            {profile.roleCodes.map((roleCode) => (
              <Badge key={roleCode} tone="neutral">
                {roleCode}
              </Badge>
            ))}
          </div>
        }
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 rounded-[1rem] border border-border bg-surface p-4 lg:col-span-2">
          <h2 className="text-base font-semibold text-foreground">
            Logged In User
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Full Name" value={profile.fullName} />
            <DetailField label="Email" value={profile.email} />
            <DetailField label="Admin ID" value={profile.adminId} />
            <DetailField label="User ID" value={profile.userId} />
            <DetailField label="User Status" value={profile.userStatus} />
            <DetailField label="Permission Version" value={profile.permissionVersion} />
            <DetailField label="Last Login" value={profile.lastLoginAt} />
            <DetailField label="Created At" value={profile.createdAt} />
            <DetailField label="Updated At" value={profile.updatedAt} />
          </div>
        </div>

        <div className="space-y-4 rounded-[1rem] border border-border bg-surface p-4">
          <h2 className="text-base font-semibold text-foreground">Role</h2>
          <DetailField label="Role Name" value={profile.role?.roleName} />
          <DetailField label="Role Code" value={profile.role?.roleCode} />
          <DetailField label="Role ID" value={profile.role?.roleId} />
          <DetailField
            label="Scopes"
            value={
              profile.scopes.length
                ? profile.scopes.map((scope) => scope.scopeType).join(', ')
                : null
            }
          />
        </div>
      </section>

      <section className="space-y-3 rounded-[1rem] border border-border bg-surface p-4">
        <h2 className="text-base font-semibold text-foreground">Permissions</h2>
        <div className="flex flex-wrap gap-2">
          {profile.permissions.map((permission) => (
            <Badge key={permission} tone="neutral">
              {permission}
            </Badge>
          ))}
        </div>
      </section>
    </PageContainer>
  )
}
