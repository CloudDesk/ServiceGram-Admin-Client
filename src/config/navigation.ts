import {
  Bell,
  ClipboardList,
  CreditCard,
  FileBarChart2,
  Film,
  LayoutDashboard,
  PackageSearch,
  Settings,
  Shield,
  UserCircle2,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react'
import { permissions } from './permissions'
import { routePaths } from './routes'

export const navigationItems = [
  { label: 'Dashboard', href: routePaths.dashboard, icon: LayoutDashboard, permission: permissions.dashboard },
  { label: 'Customers', href: routePaths.customers, icon: Users, permission: permissions.customers },
  { label: 'Vendors', href: routePaths.vendors, icon: Wrench, permission: permissions.vendors },
  { label: 'Orders', href: routePaths.orders, icon: PackageSearch, permission: permissions.orders },
  { label: 'Payments', href: routePaths.payments, icon: CreditCard, permission: permissions.payments },
  { label: 'Payouts', href: routePaths.payouts, icon: Wallet, permission: permissions.payouts },
  { label: 'Reels', href: routePaths.reels, icon: Film, permission: permissions.reels },
  { label: 'Notifications', href: routePaths.notifications, icon: Bell, permission: permissions.notifications },
  { label: 'Reports', href: routePaths.reports, icon: FileBarChart2, permission: permissions.reports },
  { label: 'Settings', href: routePaths.settings, icon: Settings, permission: permissions.settings },
  { label: 'User', href: routePaths.adminUsers, icon: Shield, permission: permissions.adminUsers },
  { label: 'Audit Logs', href: routePaths.audit, icon: ClipboardList, permission: permissions.audit },
  { label: 'Profile', href: routePaths.profile, icon: UserCircle2, permission: permissions.profile },
] as const
