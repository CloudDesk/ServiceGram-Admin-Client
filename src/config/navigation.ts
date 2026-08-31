import {
  CreditCard,
  FileBarChart2,
  FileCheck2,
  Film,
  Music2,
  BadgeCheck,
  Bell,
  ClipboardList,
  HandCoins,
  LayoutDashboard,
  PackageSearch,
  FileText,
  KeyRound,
  Megaphone,
  Rocket,
  RotateCcw,
  Settings,
  Shield,
  SlidersHorizontal,
  ToggleLeft,
  UserCircle2,
  Users,
  Wrench,
  GitBranch,
  HeartHandshake,
  Trophy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { permissions } from "./permissions";
import { routePaths } from "./routes";
import type { PermissionKey } from "../types/common.types";

/** Sidebar section a nav item belongs to. Ungrouped items render first. */
export type NavigationGroup = "release2";

export const navigationGroupLabels: Record<NavigationGroup, string> = {
  release2: "Release 2",
};

export interface NavigationItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
  /** Visible when the admin holds any one of these. Use for multi-permission screens. */
  anyPermission?: PermissionKey[];
  alwaysVisible?: boolean;
  group?: NavigationGroup;
  /** Highlight only on an exact path match. Needed for section landing pages. */
  exactMatch?: boolean;
}

export const navigationItems: NavigationItem[] = [
  {
    label: "Dashboard",
    href: routePaths.dashboard,
    icon: LayoutDashboard,
    permission: permissions.dashboard,
  },
  {
    label: "Approvals",
    href: routePaths.approvals,
    icon: GitBranch,
    permission: permissions.approvals,
  },
  {
    label: "Customers",
    href: routePaths.customers,
    icon: Users,
    permission: permissions.customers,
  },
  {
    label: "Vendors",
    href: routePaths.vendors,
    icon: Wrench,
    permission: permissions.vendors,
  },
  {
    label: "Document Review",
    href: routePaths.vendorDocuments,
    icon: FileCheck2,
    permission: permissions.vendors,
  },
  {
    label: "Orders",
    href: routePaths.orders,
    icon: PackageSearch,
    permission: permissions.orders,
  },
  {
    label: "Payments",
    href: routePaths.payments,
    icon: CreditCard,
    permission: permissions.payments,
  },
  {
    label: "Refunds",
    href: routePaths.refunds,
    icon: RotateCcw,
    permission: permissions.refunds,
  },
  {
    label: "Payouts",
    href: routePaths.payouts,
    icon: HandCoins,
    permission: permissions.payouts,
  },
  {
    label: "Reels",
    href: routePaths.reels,
    icon: Film,
    permission: permissions.reels,
  },
  {
    label: "Creator Music",
    href: routePaths.creatorMusic,
    icon: Music2,
    permission: permissions.creatorMusic,
  },
  {
    label: "Influencers",
    href: routePaths.influencers,
    icon: BadgeCheck,
    permission: permissions.influencers,
  },
  {
    label: "Notifications",
    href: routePaths.notifications,
    icon: Bell,
    permission: permissions.notifications,
  },
  {
    label: "Content",
    href: routePaths.content,
    icon: FileText,
    permission: permissions.content,
  },
  {
    label: "Marketing",
    href: routePaths.marketingCampaigns,
    icon: Megaphone,
    permission: permissions.marketingCampaigns,
  },
  {
    label: "Reports",
    href: routePaths.reports,
    icon: FileBarChart2,
    permission: permissions.reports,
  },
  {
    label: "Audit",
    href: routePaths.audit,
    icon: ClipboardList,
    permission: permissions.audit,
  },
  {
    label: "Settings",
    href: routePaths.settings,
    icon: Settings,
    permission: permissions.settings,
  },
  {
    label: "Roles",
    href: routePaths.roles,
    icon: KeyRound,
    permission: permissions.roles,
  },
  {
    label: "Users",
    href: routePaths.adminUsers,
    icon: Shield,
    permission: permissions.adminUsers,
  },
  {
    label: "Overview",
    href: routePaths.release2Overview,
    icon: Rocket,
    anyPermission: ["feature-flags:read", "settings:read"],
    exactMatch: true,
    group: "release2",
  },
  {
    label: "Customer Retention",
    href: routePaths.customerRetention,
    icon: HeartHandshake,
    anyPermission: [
      "privacy-requests:read",
      "wallet:read",
      "loyalty:read",
      "promotions:read",
    ],
    group: "release2",
  },
  {
    label: "Influencer Campaigns",
    href: routePaths.influencerCampaigns,
    icon: Trophy,
    permission: permissions.influencerCampaigns,
    group: "release2",
  },
  {
    label: "Feature Flags",
    href: routePaths.featureFlags,
    icon: ToggleLeft,
    permission: permissions.featureFlags,
    group: "release2",
  },
  {
    label: "Release 2 Settings",
    href: routePaths.release2Settings,
    icon: SlidersHorizontal,
    permission: permissions.release2Settings,
    group: "release2",
  },
  {
    label: "Profile",
    href: routePaths.profile,
    icon: UserCircle2,
    alwaysVisible: true,
  },
] as const;

export function isNavigationItemVisible(
  item: NavigationItem,
  can: (permission: string) => boolean,
) {
  if (item.alwaysVisible) {
    return true;
  }

  if (item.anyPermission?.length) {
    return item.anyPermission.some((permission) => can(permission));
  }

  return Boolean(item.permission && can(item.permission));
}
