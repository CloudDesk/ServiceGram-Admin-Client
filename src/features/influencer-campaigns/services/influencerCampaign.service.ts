import { buildApiUrl } from "../../../config/api";
import { apiClient } from "../../../services/apiClient";
import { buildQueryParams } from "../../../utils/buildQueryParams";
import type {
  InfluencerCampaignApiErrorDetails,
  InfluencerCampaignAnalyticsPeriod,
  InfluencerCampaignParticipantStatus,
  InfluencerCampaignParticipantsResponse,
  InfluencerCampaignPayload,
  InfluencerCampaignPerformanceResponse,
  InfluencerCampaignResponse,
  InfluencerCampaignRewardAwardReviewDecision,
  InfluencerCampaignRewardAwardsResponse,
  InfluencerCampaignRewardAwardStatus,
  InfluencerCampaignRewardType,
  InfluencerCampaignSponsorshipReviewDecision,
  InfluencerCampaignSponsorshipsResponse,
  InfluencerCampaignSponsorshipStatus,
  InfluencerCampaignSubmissionStatus,
  InfluencerCampaignSubmissionsResponse,
  InfluencerCampaignsResponse,
  InfluencerCampaignStatus,
} from "../types/influencerCampaign.types";

const ROOT = "/admin/influencer-campaigns";
const REWARD_AWARDS_ROOT = "/admin/influencer-campaign-reward-awards";
const SUBMISSIONS_ROOT = "/admin/influencer-campaign-submissions";
const SPONSORSHIPS_ROOT = "/admin/influencer-campaign-sponsorships";

interface ErrorEnvelope {
  message?: string;
  error?: string;
  details?: InfluencerCampaignApiErrorDetails;
}

async function parse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | T
    | ErrorEnvelope
    | null;

  if (!response.ok) {
    const errorPayload =
      payload && typeof payload === "object" ? (payload as ErrorEnvelope) : null;
    const fieldMessage = errorPayload?.details?.fieldErrors?.[0]?.message;
    throw new Error(
      fieldMessage ??
        errorPayload?.message ??
        errorPayload?.error ??
        "Influencer campaign request failed.",
    );
  }

  return payload as T;
}

function json(method: "POST" | "PUT", body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

async function list(filters: {
  search?: string;
  status?: InfluencerCampaignStatus | "ALL";
}) {
  const params = buildQueryParams({
    page: 1,
    limit: 50,
    search: filters.search || undefined,
    status:
      filters.status && filters.status !== "ALL" ? [filters.status] : undefined,
  });

  return parse<InfluencerCampaignsResponse>(
    await apiClient.request(buildApiUrl(params ? `${ROOT}?${params}` : ROOT)),
  );
}

async function detail(campaignId: string) {
  return parse<InfluencerCampaignResponse>(
    await apiClient.request(buildApiUrl(`${ROOT}/${campaignId}`)),
  );
}

async function create(body: InfluencerCampaignPayload) {
  return parse<InfluencerCampaignResponse>(
    await apiClient.request(buildApiUrl(ROOT), json("POST", body)),
  );
}

async function update(campaignId: string, body: InfluencerCampaignPayload) {
  return parse<InfluencerCampaignResponse>(
    await apiClient.request(buildApiUrl(`${ROOT}/${campaignId}`), json("PUT", body)),
  );
}

async function submitForReview(campaignId: string, reason: string) {
  return parse<InfluencerCampaignResponse>(
    await apiClient.request(
      buildApiUrl(`${ROOT}/${campaignId}/submit-review`),
      json("POST", { reason }),
    ),
  );
}

async function approve(campaignId: string, reason: string) {
  return parse<InfluencerCampaignResponse>(
    await apiClient.request(
      buildApiUrl(`${ROOT}/${campaignId}/approve`),
      json("POST", { reason }),
    ),
  );
}

async function cancel(campaignId: string, reason: string) {
  return parse<InfluencerCampaignResponse>(
    await apiClient.request(
      buildApiUrl(`${ROOT}/${campaignId}/cancel`),
      json("POST", { reason }),
    ),
  );
}

async function listSubmissions(filters: {
  campaignId?: string;
  status?: InfluencerCampaignSubmissionStatus | "ALL";
}) {
  const params = buildQueryParams({
    page: 1,
    limit: 50,
    campaignId: filters.campaignId || undefined,
    status:
      filters.status && filters.status !== "ALL"
        ? [filters.status]
        : undefined,
  });

  return parse<InfluencerCampaignSubmissionsResponse>(
    await apiClient.request(
      buildApiUrl(params ? `${SUBMISSIONS_ROOT}?${params}` : SUBMISSIONS_ROOT),
    ),
  );
}

async function listRewardAwards(filters: {
  campaignId?: string;
  influencerProfileId?: string;
  status?: InfluencerCampaignRewardAwardStatus | "ALL";
  rewardType?: InfluencerCampaignRewardType | "ALL";
}) {
  const params = buildQueryParams({
    page: 1,
    limit: 50,
    campaignId: filters.campaignId || undefined,
    influencerProfileId: filters.influencerProfileId || undefined,
    status:
      filters.status && filters.status !== "ALL" ? [filters.status] : undefined,
    rewardType:
      filters.rewardType && filters.rewardType !== "ALL"
        ? [filters.rewardType]
        : undefined,
  });

  return parse<InfluencerCampaignRewardAwardsResponse>(
    await apiClient.request(
      buildApiUrl(
        params ? `${REWARD_AWARDS_ROOT}?${params}` : REWARD_AWARDS_ROOT,
      ),
    ),
  );
}

async function listParticipants(
  campaignId: string,
  filters: { status?: InfluencerCampaignParticipantStatus | "ALL" } = {},
) {
  const params = buildQueryParams({
    page: 1,
    limit: 50,
    status:
      filters.status && filters.status !== "ALL"
        ? [filters.status]
        : undefined,
  });

  return parse<InfluencerCampaignParticipantsResponse>(
    await apiClient.request(
      buildApiUrl(
        params
          ? `${ROOT}/${campaignId}/participants?${params}`
          : `${ROOT}/${campaignId}/participants`,
      ),
    ),
  );
}

async function performance(
  campaignId: string,
  period: InfluencerCampaignAnalyticsPeriod = "30D",
  refresh = false,
) {
  const params = buildQueryParams({
    period,
    refresh: refresh || undefined,
    timezone: "Asia/Kolkata",
    topLimit: 5,
  });

  return parse<InfluencerCampaignPerformanceResponse>(
    await apiClient.request(
      buildApiUrl(`${ROOT}/${campaignId}/performance?${params}`),
    ),
  );
}

async function listSponsorships(filters: {
  search?: string;
  status?: InfluencerCampaignSponsorshipStatus | "ALL";
}) {
  const params = buildQueryParams({
    page: 1,
    limit: 50,
    search: filters.search || undefined,
    status:
      filters.status && filters.status !== "ALL"
        ? [filters.status]
        : undefined,
  });

  return parse<InfluencerCampaignSponsorshipsResponse>(
    await apiClient.request(
      buildApiUrl(params ? `${SPONSORSHIPS_ROOT}?${params}` : SPONSORSHIPS_ROOT),
    ),
  );
}

async function reviewSponsorship(
  sponsorshipRequestId: string,
  body: {
    decision: InfluencerCampaignSponsorshipReviewDecision;
    expectedVersion: number;
    reason: string;
    notes?: string;
  },
) {
  return parse(
    await apiClient.request(
      buildApiUrl(`${SPONSORSHIPS_ROOT}/${sponsorshipRequestId}/review`),
      json("POST", body),
    ),
  );
}

async function actionSponsorship(
  sponsorshipRequestId: string,
  body: {
    action: "CANCEL" | "RESTRICT";
    expectedVersion: number;
    reason: string;
  },
) {
  return parse(
    await apiClient.request(
      buildApiUrl(`${SPONSORSHIPS_ROOT}/${sponsorshipRequestId}/action`),
      json("POST", body),
    ),
  );
}

async function reviewSubmission(
  submissionId: string,
  body: {
    decision: "APPROVED" | "REJECTED";
    reason: string;
  },
) {
  return parse(
    await apiClient.request(
      buildApiUrl(`${SUBMISSIONS_ROOT}/${submissionId}/review`),
      json("POST", body),
    ),
  );
}

async function reviewRewardAward(
  awardId: string,
  body: {
    decision: InfluencerCampaignRewardAwardReviewDecision;
    expectedVersion: number;
    reason: string;
  },
) {
  return parse(
    await apiClient.request(
      buildApiUrl(`${REWARD_AWARDS_ROOT}/${awardId}/review`),
      json("POST", body),
    ),
  );
}

export const influencerCampaignService = {
  actionSponsorship,
  approve,
  cancel,
  create,
  detail,
  list,
  listParticipants,
  listRewardAwards,
  listSponsorships,
  listSubmissions,
  performance,
  reviewSponsorship,
  reviewRewardAward,
  reviewSubmission,
  submitForReview,
  update,
};
