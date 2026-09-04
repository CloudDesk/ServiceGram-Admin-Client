export type InfluencerLeaderboardCategory =
  | "BOOKINGS_GENERATED"
  | "HIGHEST_VIEWS"
  | "MOST_SHARED_REEL"
  | "FASTEST_GROWING";

export type InfluencerReputationGrade =
  | "NEW"
  | "RISING"
  | "TRUSTED"
  | "ELITE"
  | "UNDER_REVIEW";

export interface InfluencerLeaderboardPagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface InfluencerProfileSummary {
  id: string;
  publicInfluencerId: string;
  displayName: string;
  socialHandle: string | null;
  status: string;
}

export interface InfluencerBadgeSummary {
  awardId: string;
  badgeId: string;
  publicBadgeId: string;
  badgeCode: string;
  title: string;
  description: string | null;
  iconName: string | null;
  awardedAt: string;
  expiresAt: string | null;
}

export interface InfluencerReputationSummary {
  score: number | null;
  grade: InfluencerReputationGrade;
  provisional: boolean;
  sampleSize: number;
  minimumSampleSize: number;
  lastCalculatedAt: string | null;
  components?: {
    contentQualityScore: number;
    bookingConversionBps: number;
    audienceEngagementBps: number;
    vendorFeedbackScore: number;
  };
  fraudReviewStatus?: string;
  version?: number;
  reviewReason?: string | null;
}

export interface InfluencerLeaderboardRow {
  id: string;
  periodMonth: string;
  category: InfluencerLeaderboardCategory;
  rank: number;
  previousRank: number | null;
  rankDelta: number | null;
  metricValue: number;
  tieGroup: number | null;
  sampleSize: number;
  minimumSampleSize: number;
  minSampleMet: boolean;
  isVisible: boolean;
  generatedAt: string | null;
  influencer: InfluencerProfileSummary;
  reputation: InfluencerReputationSummary | null;
  badges: InfluencerBadgeSummary[];
  warnings: string[];
}

export interface InfluencerReputationRow {
  influencer: InfluencerProfileSummary;
  reputation: InfluencerReputationSummary;
  badges: InfluencerBadgeSummary[];
  availableActions: string[];
  nextRecommendedAction: string | null;
}

export interface InfluencerLeaderboardListQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  periodMonth?: string;
  category?: InfluencerLeaderboardCategory[];
  visible?: boolean;
  minSampleMet?: boolean;
}

export interface InfluencerReputationListQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  grade?: InfluencerReputationGrade[];
  fraudReviewStatus?: string;
}

export interface InfluencerLeaderboardSummary {
  total: number;
  BOOKINGS_GENERATED: number;
  HIGHEST_VIEWS: number;
  MOST_SHARED_REEL: number;
  FASTEST_GROWING: number;
}

export interface InfluencerReputationGradeSummary {
  total: number;
  NEW: number;
  RISING: number;
  TRUSTED: number;
  ELITE: number;
  UNDER_REVIEW: number;
}

export interface InfluencerLeaderboardApiResponse<TData> {
  code?: string;
  message?: string;
  data: TData;
}

export interface InfluencerLeaderboardListResponse
  extends InfluencerLeaderboardApiResponse<InfluencerLeaderboardRow[]> {
  pagination: InfluencerLeaderboardPagination;
  summary: InfluencerLeaderboardSummary;
}

export interface InfluencerReputationListResponse
  extends InfluencerLeaderboardApiResponse<InfluencerReputationRow[]> {
  pagination: InfluencerLeaderboardPagination;
  summary: InfluencerReputationGradeSummary;
}
