import { buildApiUrl } from "../../../config/api";
import { apiClient } from "../../../services/apiClient";
import { buildQueryParams } from "../../../utils/buildQueryParams";
import type {
  InfluencerCampaignApiErrorDetails,
  InfluencerCampaignPayload,
  InfluencerCampaignResponse,
  InfluencerCampaignsResponse,
  InfluencerCampaignStatus,
} from "../types/influencerCampaign.types";

const ROOT = "/admin/influencer-campaigns";

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

export const influencerCampaignService = {
  approve,
  cancel,
  create,
  detail,
  list,
  submitForReview,
  update,
};
