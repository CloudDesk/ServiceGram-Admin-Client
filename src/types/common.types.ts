import type { Role } from "../constants/roles";

export interface NavCrumb {
  label: string;
  href?: string;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  permissions: string[];
}

export interface ModuleMetric {
  label: string;
  value: string;
  tone?: "info" | "success" | "warning" | "danger" | "neutral";
}

export interface ModuleRecord {
  id: string;
  name: string;
  subtitle: string;
  status: string;
  updatedAt: string;
}

export type PermissionKey =
  | "rbac:manage"
  | "permissions:read"
  | "roles:read"
  | "roles:create"
  | "roles:update"
  | "roles:manage_permissions"
  | "admin_users:read"
  | "admin_users:create"
  | "admin_users:update"
  | "admin_users:force_logout"
  | "dashboard:read"
  | "approvals:read"
  | "approvals:manage"
  | "approvals:simulate"
  | "approvals:publish"
  | "approvals:override"
  | "approvals:delegate"
  | "customers:read"
  | "customers:update"
  | "customers:wallet_credit"
  | "vendors:read"
  | "vendors:update"
  | "vendors:approve"
  | "orders:read"
  | "orders:update_status"
  | "payments:read"
  | "payments:reconcile"
  | "payments:refund"
  | "payouts:read"
  | "payouts:approve"
  | "reels:read"
  | "reels:moderate"
  | "reels:delete"
  | "influencers:read"
  | "influencers:review"
  | "notifications:read"
  | "notifications:update"
  | "notifications:send"
  | "content:read"
  | "content:update"
  | "content:publish"
  | "marketing_campaigns:read"
  | "marketing_campaigns:update"
  | "marketing_campaigns:publish"
  | "reports:read"
  | "reports:export"
  | "settings:read"
  | "settings:update"
  | "feature-flags:read"
  | "feature-flags:update"
  | "release2-finance-settings:update"
  | "privacy-requests:read"
  | "privacy-requests:update"
  | "wallet:read"
  | "wallet:update"
  | "loyalty:read"
  | "loyalty:update"
  | "promotions:read"
  | "promotions:update"
  | "audit:read";
