import type { AppUser } from '../../types/common.types'

export const mockUsers: AppUser[] = [
  {
    id: 'adm_001',
    name: 'Aparna Iyer',
    email: 'aparna@servicegram.local',
    role: 'super-admin',
    permissions: [
      'dashboard.view',
      'customers.view',
      'vendors.view',
      'vendorOnboarding.view',
      'orders.view',
      'manualLogistics.view',
      'payments.view',
      'payouts.view',
      'reels.view',
      'notifications.view',
      'content.view',
      'reports.view',
      'settings.view',
      'adminUsers.view',
      'audit.view',
      'profile.view',
    ],
  },
]
