import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../../components/ui/Button'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { DetailPageHeader } from '../../../components/layout/DetailPageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import { routePaths } from '../../../config/routes'
import { rbacService } from '../../rbac/services/rbac.service'
import { adminUserService } from '../services/adminUser.service'
import type { AdminUserStatus } from '../types/adminUser.types'

export function CreateAdminUserPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [roleId, setRoleId] = useState('')
  const [status, setStatus] = useState<AdminUserStatus>('ACTIVE')
  const [formError, setFormError] = useState<string | null>(null)

  const rolesQuery = useQuery({
    queryKey: ['rbac', 'roles'],
    queryFn: () => rbacService.getRoles(),
  })
  const activeRoles = rolesQuery.data?.data.filter((role) => role.isActive) ?? []

  const createMutation = useMutation({
    mutationFn: () =>
      adminUserService.createAdminUser({
        email: email.trim(),
        fullName: fullName.trim(),
        password,
        roleId: roleId.trim(),
        status,
      }),
    onMutate: () => setFormError(null),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      navigate(`${routePaths.adminUsers}/${response.data.adminId}`)
    },
    onError: (error) => {
      setFormError(
        error instanceof Error ? error.message : 'Admin user creation failed.',
      )
    },
  })

  const submitForm = () => {
    if (!email.trim() || !fullName.trim() || !password || !roleId.trim()) {
      setFormError('Email, full name, password, and role are required.')
      return
    }

    void createMutation.mutateAsync()
  }

  return (
    <PageContainer>
      <DetailPageHeader
        actionNode={
          <Button
            disabled={createMutation.isPending}
            size="sm"
            onClick={submitForm}
          >
            Create User
          </Button>
        }
        description="Create an admin portal user with an assigned primary role."
        listHref={routePaths.adminUsers}
        listLabel="Users"
        recordName="Create Admin User"
      />

      {formError ? (
        <ErrorState
          description={formError}
          title="Cannot create admin user"
        />
      ) : null}

      <section className="space-y-4 rounded-[1rem] border border-border bg-surface p-4">
        <h2 className="text-base font-semibold text-foreground">
          Admin User Details
        </h2>
        <div className="grid gap-3 lg:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Email</span>
            <Input
              className="min-h-11"
              placeholder="vikram.sethi@servicegram.in"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Full Name</span>
            <Input
              className="min-h-11"
              placeholder="Vikram Sethi"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Password</span>
            <Input
              className="min-h-11"
              placeholder="Initial strong password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Role</span>
            <select
              className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-70"
              disabled={rolesQuery.isLoading || rolesQuery.isError}
              value={roleId}
              onChange={(event) => setRoleId(event.target.value)}
            >
              <option value="">Select role</option>
              {activeRoles.map((role) => (
                <option key={role.roleId} value={role.roleId}>
                  {role.roleName} ({role.roleCode})
                </option>
              ))}
            </select>
            {rolesQuery.isError ? (
              <p className="text-xs text-danger">
                {rolesQuery.error instanceof Error
                  ? rolesQuery.error.message
                  : 'Roles could not be loaded.'}
              </p>
            ) : null}
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Status</span>
            <select
              className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
              value={status}
              onChange={(event) => setStatus(event.target.value as AdminUserStatus)}
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="DISABLED">DISABLED</option>
            </select>
          </label>
        </div>
      </section>
    </PageContainer>
  )
}
