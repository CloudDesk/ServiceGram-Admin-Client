import {
  CreditCard,
  FileBarChart2,
  FileCheck2,
  Film,
  BadgeCheck,
  Bell,
  ClipboardList,
  HandCoins,
  LayoutDashboard,
  PackageSearch,
  FileText,
  KeyRound,
  RotateCcw,
  Settings,
  Shield,
  UserCircle2,
  Users,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { permissions } from './permissions'
import { routePaths } from './routes'

export interface NavigationItem {
  label: string
  href: string
  icon: LucideIcon
  permission?: string
  alwaysVisible?: boolean
}

export const navigationItems: NavigationItem[] = [
  { label: 'Dashboard', href: routePaths.dashboard, icon: LayoutDashboard, permission: permissions.dashboard },
  { label: 'Customers', href: routePaths.customers, icon: Users, permission: permissions.customers },
  { label: 'Vendors', href: routePaths.vendors, icon: Wrench, permission: permissions.vendors },
  { label: 'Document Review', href: routePaths.vendorDocuments, icon: FileCheck2, permission: permissions.vendors },
  { label: 'Orders', href: routePaths.orders, icon: PackageSearch, permission: permissions.orders },
  { label: 'Payments', href: routePaths.payments, icon: CreditCard, permission: permissions.payments },
  { label: 'Refunds', href: routePaths.refunds, icon: RotateCcw, permission: permissions.refunds },
  { label: 'Payouts', href: routePaths.payouts, icon: HandCoins, permission: permissions.payouts },
  { label: 'Reels', href: routePaths.reels, icon: Film, permission: permissions.reels },
  { label: 'Influencers', href: routePaths.influencers, icon: BadgeCheck, permission: permissions.influencers },
  { label: 'Notifications', href: routePaths.notifications, icon: Bell, permission: permissions.notifications },
  { label: 'Content', href: routePaths.content, icon: FileText, permission: permissions.content },
  { label: 'Reports', href: routePaths.reports, icon: FileBarChart2, permission: permissions.reports },
  { label: 'Audit', href: routePaths.audit, icon: ClipboardList, permission: permissions.audit },
  { label: 'Settings', href: routePaths.settings, icon: Settings, permission: permissions.settings },
  { label: 'Roles', href: routePaths.roles, icon: KeyRound, permission: permissions.roles },
  { label: 'Users', href: routePaths.adminUsers, icon: Shield, permission: permissions.adminUsers },
  { label: 'Profile', href: routePaths.profile, icon: UserCircle2, alwaysVisible: true },
] as const
