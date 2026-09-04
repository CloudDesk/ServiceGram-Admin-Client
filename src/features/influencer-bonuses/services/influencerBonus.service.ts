import { buildApiUrl } from "../../../config/api";
import { apiClient } from "../../../services/apiClient";
import { buildQueryParams } from "../../../utils/buildQueryParams";
import type {
  InfluencerBonusAward,
  InfluencerBonusAwardQueryParams,
  InfluencerBonusAwardReviewPayload,
  InfluencerBonusAwardsResponse,
  InfluencerBonusRule,
  InfluencerBonusRuleActionPayload,
  InfluencerBonusRuleQueryParams,
  InfluencerBonusRulesResponse,
} from "../types/influencerBonus.types";

const RULES_ROOT = "/admin/influencer-bonus-rules";
const AWARDS_ROOT = "/admin/influencer-bonus-awards";

interface ErrorEnvelope {
  message?: string;
  error?: string;
  details?: { fieldErrors?: { field: string; message: string }[] };
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
        "Influencer bonus request failed.",
    );
  }

  return payload as T;
}

function listPath(path: string, query: object) {
  const queryString = buildQueryParams(query);

  return buildApiUrl(queryString ? `${path}?${queryString}` : path);
}

function json(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

async function listRules(query: InfluencerBonusRuleQueryParams = {}) {
  return parse<InfluencerBonusRulesResponse>(
    await apiClient.request(listPath(RULES_ROOT, query)),
  );
}

async function activateRule(
  ruleId: string,
  payload: InfluencerBonusRuleActionPayload,
) {
  return parse<{ data: InfluencerBonusRule }>(
    await apiClient.request(buildApiUrl(`${RULES_ROOT}/${ruleId}/activate`), json(payload)),
  );
}

async function pauseRule(
  ruleId: string,
  payload: InfluencerBonusRuleActionPayload,
) {
  return parse<{ data: InfluencerBonusRule }>(
    await apiClient.request(buildApiUrl(`${RULES_ROOT}/${ruleId}/pause`), json(payload)),
  );
}

async function archiveRule(
  ruleId: string,
  payload: InfluencerBonusRuleActionPayload,
) {
  return parse<{ data: InfluencerBonusRule }>(
    await apiClient.request(buildApiUrl(`${RULES_ROOT}/${ruleId}/archive`), json(payload)),
  );
}

async function listAwards(query: InfluencerBonusAwardQueryParams = {}) {
  return parse<InfluencerBonusAwardsResponse>(
    await apiClient.request(listPath(AWARDS_ROOT, query)),
  );
}

async function reviewAward(
  awardId: string,
  payload: InfluencerBonusAwardReviewPayload,
) {
  return parse<{ data: InfluencerBonusAward }>(
    await apiClient.request(buildApiUrl(`${AWARDS_ROOT}/${awardId}/review`), json(payload)),
  );
}

export const influencerBonusService = {
  activateRule,
  archiveRule,
  listAwards,
  listRules,
  pauseRule,
  reviewAward,
};
