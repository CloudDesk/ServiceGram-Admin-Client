import type { ApiErrorDetails } from "../../../types/api.types";

export type InfluencerCampaignStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "UPCOMING"
  | "ACTIVE"
  | "CLOSED"
  | "REWARD_PROCESSING"
  | "COMPLETED"
  | "CANCELLED";

export type InfluencerCampaignObjective =
  | "AWARENESS"
  | "BOOKING_GROWTH"
  | "RETENTION"
  | "VENDOR_PROMOTION";

export type InfluencerCampaignRewardType =
  | "CASH"
  | "COMMISSION_BOOST"
  | "BADGE"
  | "FEATURED_PLACEMENT";

export interface InfluencerCampaignReward {
  rewardId?: string;
  rewardType: InfluencerCampaignRewardType;
  title: string;
  description?: string | null;
  amountPaise?: number | null;
  commissionBoostBps?: number | null;
  rankFrom?: number | null;
  rankTo?: number | null;
  maxWinners?: number | null;
  metadata?: Record<string, unknown>;
}

export interface InfluencerCampaignEligibilityRule {
  ruleId?: string;
  ruleType:
    | "APPROVED_INFLUENCER"
    | "CITY"
    | "CATEGORY"
    | "MIN_FOLLOWERS"
    | "MIN_REELS"
    | "INVITED_INFLUENCER";
  value: Record<string, unknown>;
  description?: string | null;
  isRequired: boolean;
  displayOrder: number;
}

export interface InfluencerCampaign {
  campaignId: string;
  publicCampaignId: string;
  campaignCode: string;
  title: string;
  summary: string;
  brief: string;
  objective: InfluencerCampaignObjective;
  status: InfluencerCampaignStatus;
  schedule: {
    startsAt: string | null;
    endsAt: string | null;
    submissionDeadlineAt: string | null;
  };
  budget: {
    amountPaise: number;
    currency: string;
  };
  maxParticipants: number | null;
  rewardSummary: string;
  rewards: InfluencerCampaignReward[];
  contentRequirements: Record<string, unknown>;
  eligibilitySummary: string;
  eligibilityRules: InfluencerCampaignEligibilityRule[];
  visibilityRules: Record<string, unknown>;
  lifecycle: {
    version: number;
    reviewSubmittedAt: string | null;
    approvedAt: string | null;
    cancelledAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  warnings: string[];
  blockingReasons: string[];
  availableActions: {
    edit: boolean;
    submitForReview: boolean;
    approve: boolean;
    cancel: boolean;
    viewSubmissions: boolean;
  };
  nextRecommendedAction: string | null;
  timeline?: {
    eventId: string;
    eventType: string;
    actorType: string;
    reason: string | null;
    previousStatus: InfluencerCampaignStatus | null;
    nextStatus: InfluencerCampaignStatus | null;
    createdAt: string;
  }[];
}

export interface InfluencerCampaignSummary {
  total: number;
  draft: number;
  pendingReview: number;
  upcoming: number;
  active: number;
  closed: number;
  rewardProcessing: number;
  completed: number;
  cancelled: number;
}

export interface CampaignPagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface InfluencerCampaignsResponse {
  data: InfluencerCampaign[];
  pagination: CampaignPagination;
  summary: InfluencerCampaignSummary;
}

export interface InfluencerCampaignResponse {
  data: InfluencerCampaign;
}

export interface InfluencerCampaignPayload {
  campaignCode: string;
  title: string;
  summary: string;
  brief: string;
  objective: InfluencerCampaignObjective;
  startsAt: string | null;
  endsAt: string | null;
  submissionDeadlineAt: string | null;
  maxParticipants: number | null;
  budgetPaise: number;
  currency: string;
  rewardSummary: string;
  rewards: Omit<InfluencerCampaignReward, "rewardId">[];
  contentRequirements: Record<string, unknown>;
  eligibilitySummary: string;
  eligibilityRules: Omit<InfluencerCampaignEligibilityRule, "ruleId">[];
  visibilityRules: Record<string, unknown>;
  metadata: Record<string, unknown>;
  reason: string;
}

export interface InfluencerCampaignApiErrorDetails extends ApiErrorDetails {
  fieldErrors?: { field: string; message: string; code: string }[];
}
