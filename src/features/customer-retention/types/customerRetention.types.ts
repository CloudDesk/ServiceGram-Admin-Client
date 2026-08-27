export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PrivacyCustomerSummary {
  customerId: string;
  fullName: string;
  city: string | null;
  status: string;
  mobileNumber: string;
}

export interface PrivacyExportRequest {
  privacyExportRequestId: string;
  status: string;
  customer: PrivacyCustomerSummary;
  failureReason: string | null;
  queuedAt: string;
  completedAt: string | null;
  failedAt: string | null;
  downloadUrlExpiresAt: string | null;
  warnings: string[];
  createdAt: string;
}

export interface PrivacyDeletionRequest {
  deletionRequestId: string;
  status: string;
  customer: PrivacyCustomerSummary;
  reason: string | null;
  reviewReason: string | null;
  reviewedByAdminId: string | null;
  reviewedAt: string | null;
  scheduledAt: string | null;
  completedAt: string | null;
  retainedUntilAt: string | null;
  availableActions: string[];
  createdAt: string;
}

export interface WalletLedgerEntry {
  walletLedgerEntryId: string;
  entryType: string;
  direction: "CREDIT" | "DEBIT";
  amountPaise: number;
  currency: string;
  sourceType: string;
  sourceId: string | null;
  balanceAfterPaise: number;
  reason: string | null;
  createdAt: string;
}

export interface LoyaltyLedgerEntry {
  loyaltyLedgerEntryId: string;
  entryType: string;
  direction: "CREDIT" | "DEBIT";
  points: number;
  sourceType: string;
  sourceId: string | null;
  balanceAfterPoints: number;
  reason: string | null;
  createdAt: string;
}

export interface PromoCode {
  promoCodeId: string;
  code: string;
  displayName: string;
  description: string | null;
  source: "PLATFORM" | "VENDOR" | "INFLUENCER";
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "EXPIRED";
  discountType: "PERCENTAGE" | "FIXED";
  discountBps: number | null;
  discountPaise: number | null;
  maxDiscountPaise: number;
  minOrderValuePaise: number;
  maxRedemptionsGlobal: number;
  maxRedemptionsPerCustomer: number;
  redemptionCount: number;
  remainingRedemptions: number;
  stackable: boolean;
  vendorId: string | null;
  categoryId: string | null;
  startsAt: string;
  endsAt: string;
  warnings: string[];
  availableActions: string[];
  nextRecommendedAction: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReferralAbuseFinding {
  referrerCustomerId: string;
  customer: {
    fullName: string;
    city: string | null;
    status: string;
    mobileNumber: string;
  };
  settledInWindow: number;
  settledTotal: number;
  pendingTotal: number;
  rejectedTotal: number;
  rewardedPaise: number;
  rewardedLabel: string;
  lastSettledAt: string | null;
  warnings: string[];
}

export interface PromoAbuseFinding {
  promoCodeId: string;
  code: string;
  customerId: string;
  customer: { fullName: string; mobileNumber: string };
  redemptions: number;
  redemptionsInWindow: number;
  reversedRedemptions: number;
  maxRedemptionsPerCustomer: number;
  discountPaise: number;
  lastRedeemedAt: string | null;
  warnings: string[];
}

export interface PromoCodeFormPayload {
  code: string;
  displayName: string;
  description?: string;
  source: PromoCode["source"];
  discountType: PromoCode["discountType"];
  discountBps?: number;
  discountPaise?: number;
  maxDiscountPaise: number;
  minOrderValuePaise: number;
  maxRedemptionsGlobal: number;
  maxRedemptionsPerCustomer: number;
  stackable: boolean;
  vendorId?: string;
  categoryId?: string;
  startsAt: string;
  endsAt: string;
  reason: string;
}

export interface AdminVendorOffer {
  id: string;
  vendorId: string;
  vendorName: string;
  categoryId: string;
  categoryName: string;
  offerType: "BUNDLE" | "LIMITED_TIME" | "COMMUNITY_GROUP" | "REPEAT_CUSTOMER" | "REEL_LINKED";
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "EXPIRED" | "REMOVED" | "ADMIN_RESTRICTED";
  title: string;
  description: string | null;
  discountType: "PERCENTAGE" | "FIXED";
  discountBps: number;
  discountPaise: number;
  maxDiscountPaise: number;
  minOrderValuePaise: number;
  maxRedemptions: number;
  redemptionCount: number;
  remainingRedemptions: number;
  startsAt: string;
  endsAt: string;
  countdownSeconds: number;
  version: number;
  restrictionReason: string | null;
  availableActions: string[];
}

export interface AdminVendorOffersSummary {
  totalItems: number;
  draft: number;
  active: number;
  paused: number;
  expired: number;
  restricted: number;
  expiringSoon: number;
  redemptions: number;
  discountExposurePaise: number;
}
