import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../../components/ui/Button'
import { ErrorState } from '../../../components/ui/ErrorState'
import { FormErrorSummary } from '../../../components/feedback/FormErrorSummary'
import { Input } from '../../../components/ui/Input'
import { DetailPageHeader } from '../../../components/layout/DetailPageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import { routePaths } from '../../../config/routes'
import { cn } from '../../../utils/cn'
import { rbacService } from '../../rbac/services/rbac.service'
import { adminUserService } from '../services/adminUser.service'
import {
  AdminUserServiceError,
  type AdminUserStatus,
} from '../types/adminUser.types'

const strongPasswordMessage =
  'Password must be at least 12 characters and include uppercase, lowercase, number, and symbol.'
const strongPasswordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/

type CreateAdminUserField = 'email' | 'fullName' | 'password' | 'roleId'
type CreateAdminUserFieldErrors = Partial<Record<CreateAdminUserField, string>>

function isCreateAdminUserField(field: string): field is CreateAdminUserField {
  return (
    field === 'email' ||
    field === 'fullName' ||
    field === 'password' ||
    field === 'roleId'
  )
}

function validateCreateAdminUserForm(input: {
  email: string
  fullName: string
  password: string
  roleId: string
}): CreateAdminUserFieldErrors {
  const errors: CreateAdminUserFieldErrors = {}

  if (!input.email.trim()) {
    errors.email = 'Email is required.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    errors.email = 'Please enter a valid email address.'
  }

  if (!input.fullName.trim()) {
    errors.fullName = 'Full name is required.'
  } else if (input.fullName.trim().length < 2) {
    errors.fullName = 'Full name must be at least 2 characters.'
  }

  if (!input.password) {
    errors.password = 'Password is required.'
  } else if (!strongPasswordPattern.test(input.password)) {
    errors.password = strongPasswordMessage
  }

  if (!input.roleId.trim()) {
    errors.roleId = 'Role is required.'
  }

  return errors
}

function mapAdminUserFieldErrors(
  error: AdminUserServiceError,
): CreateAdminUserFieldErrors {
  const errors: CreateAdminUserFieldErrors = {}
  const fieldErrors = error.response?.details?.fieldErrors ?? []

  fieldErrors.forEach((fieldError) => {
    if (isCreateAdminUserField(fieldError.field)) {
      errors[fieldError.field] = fieldError.message
    }
  })

  return errors
}

export function CreateAdminUserPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [roleId, setRoleId] = useState('')
  const [status, setStatus] = useState<AdminUserStatus>('ACTIVE')
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<CreateAdminUserFieldErrors>({})

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
      if (error instanceof AdminUserServiceError) {
        const nextFieldErrors = mapAdminUserFieldErrors(error)

        if (Object.keys(nextFieldErrors).length > 0) {
          setFieldErrors(nextFieldErrors)
          setFormError(null)
          return
        }

        setFormError(error.message)
        return
      }

      setFormError(
        error instanceof Error ? error.message : 'Admin user creation failed.',
      )
    },
  })

  const clearFieldError = (field: CreateAdminUserField) => {
    setFieldErrors((current) => {
      if (!current[field]) {
        return current
      }

      const next: CreateAdminUserFieldErrors = {}

      if (field !== 'email' && current.email) {
        next.email = current.email
      }

      if (field !== 'fullName' && current.fullName) {
        next.fullName = current.fullName
      }

      if (field !== 'password' && current.password) {
        next.password = current.password
      }

      if (field !== 'roleId' && current.roleId) {
        next.roleId = current.roleId
      }

      return next
    })
    setFormError(null)
  }

  const submitForm = () => {
    const nextFieldErrors = validateCreateAdminUserForm({
      email,
      fullName,
      password,
      roleId,
    })

    setFieldErrors(nextFieldErrors)
    setFormError(null)

    if (Object.keys(nextFieldErrors).length > 0) {
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
              hasError={Boolean(fieldErrors.email)}
              placeholder="vikram.sethi@servicegram.in"
              type="email"
              value={email}
              onChange={(event) => {
                clearFieldError('email')
                setEmail(event.target.value)
              }}
            />
            <FormErrorSummary message={fieldErrors.email} />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Full Name</span>
            <Input
              className="min-h-11"
              hasError={Boolean(fieldErrors.fullName)}
              placeholder="Vikram Sethi"
              value={fullName}
              onChange={(event) => {
                clearFieldError('fullName')
                setFullName(event.target.value)
              }}
            />
            <FormErrorSummary message={fieldErrors.fullName} />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Password</span>
            <Input
              className="min-h-11"
              hasError={Boolean(fieldErrors.password)}
              placeholder="Initial strong password"
              type="password"
              value={password}
              onChange={(event) => {
                clearFieldError('password')
                setPassword(event.target.value)
              }}
            />
            <FormErrorSummary message={fieldErrors.password} />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Role</span>
            <select
              className={cn(
                'min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-70',
                fieldErrors.roleId &&
                  'border-[color:var(--adaptive-danger-text)] focus-visible:border-[color:var(--adaptive-danger-text)]',
              )}
              disabled={rolesQuery.isLoading || rolesQuery.isError}
              value={roleId}
              onChange={(event) => {
                clearFieldError('roleId')
                setRoleId(event.target.value)
              }}
            >
              <option value="">Select role</option>
              {activeRoles.map((role) => (
                <option key={role.roleId} value={role.roleId}>
                  {role.roleName} ({role.roleCode})
                </option>
              ))}
            </select>
            <FormErrorSummary message={fieldErrors.roleId} />
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
