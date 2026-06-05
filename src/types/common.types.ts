import type { Role } from '../constants/roles'

export interface NavCrumb {
  label: string
  href?: string
}

export interface AppUser {
  id: string
  name: string
  email: string
  role: Role
  permissions: PermissionKey[]
}

export interface ModuleMetric {
  label: string
  value: string
  tone?: 'info' | 'success' | 'warning' | 'danger' | 'neutral'
}

export interface ModuleRecord {
  id: string
  name: string
  subtitle: string
  status: string
  updatedAt: string
}

export type PermissionKey =
  | 'dashboard.view'
  | 'customers.view'
  | 'vendors.view'
  | 'vendorOnboarding.view'
  | 'orders.view'
  | 'manualLogistics.view'
  | 'payments.view'
  | 'payouts.view'
  | 'reels.view'
  | 'notifications.view'
  | 'content.view'
  | 'reports.view'
  | 'settings.view'
  | 'adminUsers.view'
  | 'audit.view'
  | 'profile.view'
