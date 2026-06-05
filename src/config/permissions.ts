import type { PermissionKey } from '../types/common.types'

export const permissions: Record<string, PermissionKey> = {
  dashboard: 'dashboard.view',
  customers: 'customers.view',
  vendors: 'vendors.view',
  vendorOnboarding: 'vendorOnboarding.view',
  orders: 'orders.view',
  manualLogistics: 'manualLogistics.view',
  payments: 'payments.view',
  payouts: 'payouts.view',
  reels: 'reels.view',
  notifications: 'notifications.view',
  content: 'content.view',
  reports: 'reports.view',
  settings: 'settings.view',
  adminUsers: 'adminUsers.view',
  audit: 'audit.view',
  profile: 'profile.view',
}
