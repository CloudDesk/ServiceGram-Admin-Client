import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { rbacService } from '../../rbac/services/rbac.service'
import { adminUserService } from '../services/adminUser.service'
import { AdminUsersPage } from './AdminUsersPage'

const getAdminUsers = vi.spyOn(adminUserService, 'getAdminUsers')
const getRoles = vi.spyOn(rbacService, 'getRoles')

beforeEach(() => {
  getAdminUsers.mockReset()
  getRoles.mockReset()
  getAdminUsers.mockResolvedValue({
    data: [],
    pagination: {
      page: 1,
      limit: 50,
      totalItems: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  })
  getRoles.mockResolvedValue({ data: [] })
})

describe('AdminUsersPage', () => {
  it('shows Add user in the list toolbar when create permission is granted', async () => {
    renderWithProviders(<AdminUsersPage />, {
      initialEntry: '/app/admin-users',
      path: '/app/admin-users',
      permissions: ['admin_users:read', 'admin_users:create'],
    })

    const addUser = await screen.findByRole('button', { name: 'Add user' })
    expect(addUser).toBeEnabled()
    expect(addUser).toHaveAttribute('title', 'Add admin user')
  })

  it('keeps Add user visible with a permission explanation for read-only admins', async () => {
    renderWithProviders(<AdminUsersPage />, {
      initialEntry: '/app/admin-users',
      path: '/app/admin-users',
      permissions: ['admin_users:read'],
    })

    const addUser = await screen.findByRole('button', { name: 'Add user' })
    expect(addUser).toBeDisabled()
    expect(addUser).toHaveAttribute(
      'title',
      'Requires admin_users:create permission',
    )
  })
})
