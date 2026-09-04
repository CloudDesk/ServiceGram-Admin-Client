import { buildApiUrl } from "../../../config/api";
import {
  INFLUENCER_BADGE_AWARD_REVOKE_PATH,
  INFLUENCER_BADGE_LIST_PATH,
  INFLUENCER_LEADERBOARD_LIST_PATH,
  INFLUENCER_LEADERBOARD_VISIBILITY_PATH,
  INFLUENCER_REPUTATION_BADGE_AWARD_PATH,
  INFLUENCER_REPUTATION_LIST_PATH,
  INFLUENCER_REPUTATION_REVIEW_PATH,
} from "../../../config/influencerLeaderboardApiPaths";
import { apiClient } from "../../../services/apiClient";
import { buildQueryParams } from "../../../utils/buildQueryParams";
import type {
  AwardInfluencerBadgePayload,
  InfluencerBadgeListResponse,
  InfluencerLeaderboardListQueryParams,
  InfluencerLeaderboardListResponse,
  InfluencerLeaderboardRow,
  InfluencerReputationListQueryParams,
  InfluencerReputationListResponse,
  InfluencerReputationRow,
  ReviewInfluencerReputationPayload,
  RevokeInfluencerBadgePayload,
  UpdateLeaderboardVisibilityPayload,
} from "../types/influencerLeaderboard.types";

interface ErrorEnvelope {
  message?: string;
  error?: string;
}

async function parse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | T
    | ErrorEnvelope
    | null;

  if (!response.ok) {
    const errorPayload =
      payload && typeof payload === "object"
        ? (payload as ErrorEnvelope)
        : null;

    throw new Error(
      errorPayload?.message ??
        errorPayload?.error ??
        "Influencer leaderboard request failed.",
    );
  }

  return payload as T;
}

function listPath(path: string, query: object) {
  const queryString = buildQueryParams(query);
  return buildApiUrl(queryString ? `${path}?${queryString}` : path);
}

function jsonRequest(method: "POST" | "PUT", body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

async function listLeaderboards(
  query: InfluencerLeaderboardListQueryParams = {},
) {
  return parse<InfluencerLeaderboardListResponse>(
    await apiClient.request(listPath(INFLUENCER_LEADERBOARD_LIST_PATH, query)),
  );
}

async function listReputations(
  query: InfluencerReputationListQueryParams = {},
) {
  return parse<InfluencerReputationListResponse>(
    await apiClient.request(listPath(INFLUENCER_REPUTATION_LIST_PATH, query)),
  );
}

async function listBadges() {
  return parse<InfluencerBadgeListResponse>(
    await apiClient.request(buildApiUrl(INFLUENCER_BADGE_LIST_PATH)),
  );
}

async function updateLeaderboardVisibility(
  rankingId: string,
  payload: UpdateLeaderboardVisibilityPayload,
) {
  return parse<{ data: InfluencerLeaderboardRow }>(
    await apiClient.request(
      buildApiUrl(INFLUENCER_LEADERBOARD_VISIBILITY_PATH(rankingId)),
      jsonRequest("PUT", payload),
    ),
  );
}

async function reviewReputation(
  influencerProfileId: string,
  payload: ReviewInfluencerReputationPayload,
) {
  return parse<{ data: InfluencerReputationRow }>(
    await apiClient.request(
      buildApiUrl(INFLUENCER_REPUTATION_REVIEW_PATH(influencerProfileId)),
      jsonRequest("POST", payload),
    ),
  );
}

async function awardBadge(
  influencerProfileId: string,
  payload: AwardInfluencerBadgePayload,
) {
  return parse<{ data: InfluencerReputationRow }>(
    await apiClient.request(
      buildApiUrl(INFLUENCER_REPUTATION_BADGE_AWARD_PATH(influencerProfileId)),
      jsonRequest("POST", payload),
    ),
  );
}

async function revokeBadge(
  awardId: string,
  payload: RevokeInfluencerBadgePayload,
) {
  return parse<{ data: InfluencerReputationRow }>(
    await apiClient.request(
      buildApiUrl(INFLUENCER_BADGE_AWARD_REVOKE_PATH(awardId)),
      jsonRequest("POST", payload),
    ),
  );
}

export const influencerLeaderboardService = {
  awardBadge,
  listBadges,
  listLeaderboards,
  listReputations,
  reviewReputation,
  revokeBadge,
  updateLeaderboardVisibility,
};
