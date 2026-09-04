import { buildApiUrl } from "../../../config/api";
import {
  INFLUENCER_LEADERBOARD_LIST_PATH,
  INFLUENCER_REPUTATION_LIST_PATH,
} from "../../../config/influencerLeaderboardApiPaths";
import { apiClient } from "../../../services/apiClient";
import { buildQueryParams } from "../../../utils/buildQueryParams";
import type {
  InfluencerLeaderboardListQueryParams,
  InfluencerLeaderboardListResponse,
  InfluencerReputationListQueryParams,
  InfluencerReputationListResponse,
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

export const influencerLeaderboardService = {
  listLeaderboards,
  listReputations,
};
