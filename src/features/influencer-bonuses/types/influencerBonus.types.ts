export type InfluencerBonusRuleType =
  | "VIEW_MILESTONE"
  | "SHARE_MILESTONE"
  | "BOOKING_CONVERSION_MILESTONE"
  | "CONSISTENCY_BONUS"
  | "NEIGHBOURHOOD_CHAMPION";

export type InfluencerBonusRuleStatus =
  | "DRAFT"
  | "ACTIVE"
  | "PAUSED"
  | "ARCHIVED";

export type InfluencerBonusAwardStatus =
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "HELD"
  | "PAID";

export type InfluencerBonusReviewDecision = "APPROVED" | "REJECTED";

export interface InfluencerBonusPagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface InfluencerBonusRule {
  id: string;
  publicRuleId: string;
  ruleCode: string;
  title: string;
  description: string | null;
  ruleType: InfluencerBonusRuleType;
  status: InfluencerBonusRuleStatus;
  windowDays: number;
  metricThreshold: number;
  amountPaise: number;
  currency: string;
  requiresManualReview: boolean;
  maxAwardsPerInfluencerPerWindow: number;
  startsAt: string | null;
  endsAt: string | null;
  version: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface InfluencerBonusRuleSummary {
  total: number;
  draft: number;
  active: number;
  paused: number;
  archived: number;
}

export interface InfluencerBonusRulesResponse {
  code?: string;
  message?: string;
  data: InfluencerBonusRule[];
  pagination: InfluencerBonusPagination;
  summary: InfluencerBonusRuleSummary;
}

export interface InfluencerBonusAward {
  id: string;
  publicAwardId: string;
  ruleId: string;
  influencerProfileId: string;
  campaignId: string | null;
  sourceReelId: string | null;
  periodKey: string;
  windowStart: string;
  windowEnd: string;
  metricValue: number;
  amountPaise: number;
  currency: string;
  status: InfluencerBonusAwardStatus;
  ruleVersion: number;
  reviewedAt: string | null;
  reviewReason: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  heldAt: string | null;
  paidAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  rule: {
    id: string;
    publicRuleId: string;
    ruleCode: string;
    title: string;
    ruleType: InfluencerBonusRuleType;
  };
  influencer: {
    id: string;
    publicInfluencerId: string;
    displayName: string;
    socialHandle: string | null;
  };
}

export interface InfluencerBonusAwardSummary {
  total: number;
  totalAmountPaise: number;
  approvedAmountPaise: number;
  pendingReviewAmountPaise: number;
  PENDING_REVIEW?: number;
  APPROVED?: number;
  REJECTED?: number;
  HELD?: number;
  PAID?: number;
}

export interface InfluencerBonusAwardsResponse {
  code?: string;
  message?: string;
  data: InfluencerBonusAward[];
  pagination: InfluencerBonusPagination;
  summary: InfluencerBonusAwardSummary;
}

export interface InfluencerBonusRuleQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: InfluencerBonusRuleStatus | InfluencerBonusRuleStatus[];
  ruleType?: InfluencerBonusRuleType | InfluencerBonusRuleType[];
}

export interface InfluencerBonusAwardQueryParams {
  page?: number;
  limit?: number;
  status?: InfluencerBonusAwardStatus | InfluencerBonusAwardStatus[];
  ruleId?: string;
  influencerProfileId?: string;
}

export interface InfluencerBonusRuleActionPayload {
  expectedVersion: number;
  reason: string;
}

export interface InfluencerBonusAwardReviewPayload {
  decision: InfluencerBonusReviewDecision;
  expectedVersion: number;
  reason: string;
}
