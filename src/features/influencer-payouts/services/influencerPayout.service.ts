import { buildApiUrl } from "../../../config/api";
import {
  INFLUENCER_BANK_ACCOUNT_LIST_PATH,
  INFLUENCER_BANK_ACCOUNT_REVIEW_PATH,
  INFLUENCER_KYC_CHECK_LIST_PATH,
  INFLUENCER_KYC_CHECK_REVIEW_PATH,
  INFLUENCER_PAYOUT_APPROVE_PATH,
  INFLUENCER_PAYOUT_BATCH_PATH,
  INFLUENCER_PAYOUT_CANCEL_PATH,
  INFLUENCER_PAYOUT_HOLD_PATH,
  INFLUENCER_PAYOUT_LIST_PATH,
  INFLUENCER_PAYOUT_MARK_FAILED_PATH,
  INFLUENCER_PAYOUT_MARK_PAID_PATH,
  INFLUENCER_PAYOUT_RETRY_PATH,
} from "../../../config/influencerPayoutApiPaths";
import { apiClient } from "../../../services/apiClient";
import { buildQueryParams } from "../../../utils/buildQueryParams";
import type {
  CreatePayoutBatchPayload,
  InfluencerBankAccountListResponse,
  InfluencerBankAccountQueryParams,
  InfluencerBankAccountReviewRow,
  InfluencerKycListResponse,
  InfluencerKycQueryParams,
  InfluencerKycReviewRow,
  InfluencerPayoutApiErrorDetails,
  InfluencerPayoutApiResponse,
  InfluencerPayoutBatchResult,
  InfluencerPayoutListQueryParams,
  InfluencerPayoutRow,
  InfluencerPayoutsListResponse,
  MarkPayoutFailedPayload,
  MarkPayoutPaidPayload,
  PayoutActionPayload,
  ReviewBankAccountPayload,
  ReviewKycPayload,
} from "../types/influencerPayout.types";

interface ErrorEnvelope {
  message?: string;
  error?: string;
  details?: InfluencerPayoutApiErrorDetails;
}

async function parse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    T | ErrorEnvelope | null;

  if (!response.ok) {
    const errorPayload =
      payload && typeof payload === "object"
        ? (payload as ErrorEnvelope)
        : null;
    const fieldMessage = errorPayload?.details?.fieldErrors?.[0]?.message;

    throw new Error(
      fieldMessage ??
        errorPayload?.message ??
        errorPayload?.error ??
        "Influencer payout request failed.",
    );
  }

  return payload as T;
}

function json(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function listPath(path: string, query: object) {
  const queryString = buildQueryParams(query);
  return buildApiUrl(queryString ? `${path}?${queryString}` : path);
}

async function listBankAccounts(query: InfluencerBankAccountQueryParams = {}) {
  return parse<InfluencerBankAccountListResponse>(
    await apiClient.request(listPath(INFLUENCER_BANK_ACCOUNT_LIST_PATH, query)),
  );
}

async function reviewBankAccount(
  bankAccountId: string,
  payload: ReviewBankAccountPayload,
) {
  return parse<InfluencerPayoutApiResponse<InfluencerBankAccountReviewRow>>(
    await apiClient.request(
      buildApiUrl(INFLUENCER_BANK_ACCOUNT_REVIEW_PATH(bankAccountId)),
      json(payload),
    ),
  );
}

async function listKycChecks(query: InfluencerKycQueryParams = {}) {
  return parse<InfluencerKycListResponse>(
    await apiClient.request(listPath(INFLUENCER_KYC_CHECK_LIST_PATH, query)),
  );
}

async function reviewKycCheck(kycCheckId: string, payload: ReviewKycPayload) {
  return parse<InfluencerPayoutApiResponse<InfluencerKycReviewRow>>(
    await apiClient.request(
      buildApiUrl(INFLUENCER_KYC_CHECK_REVIEW_PATH(kycCheckId)),
      json(payload),
    ),
  );
}

async function listPayouts(query: InfluencerPayoutListQueryParams = {}) {
  return parse<InfluencerPayoutsListResponse>(
    await apiClient.request(listPath(INFLUENCER_PAYOUT_LIST_PATH, query)),
  );
}

async function createPayoutBatch(payload: CreatePayoutBatchPayload) {
  return parse<InfluencerPayoutApiResponse<InfluencerPayoutBatchResult>>(
    await apiClient.request(
      buildApiUrl(INFLUENCER_PAYOUT_BATCH_PATH),
      json(payload),
    ),
  );
}

async function approvePayout(payoutId: string, payload: PayoutActionPayload) {
  return parse<InfluencerPayoutApiResponse<InfluencerPayoutRow>>(
    await apiClient.request(
      buildApiUrl(INFLUENCER_PAYOUT_APPROVE_PATH(payoutId)),
      json(payload),
    ),
  );
}

async function holdPayout(payoutId: string, payload: PayoutActionPayload) {
  return parse<InfluencerPayoutApiResponse<InfluencerPayoutRow>>(
    await apiClient.request(
      buildApiUrl(INFLUENCER_PAYOUT_HOLD_PATH(payoutId)),
      json(payload),
    ),
  );
}

async function retryPayout(payoutId: string, payload: PayoutActionPayload) {
  return parse<InfluencerPayoutApiResponse<InfluencerPayoutRow>>(
    await apiClient.request(
      buildApiUrl(INFLUENCER_PAYOUT_RETRY_PATH(payoutId)),
      json(payload),
    ),
  );
}

async function markPayoutPaid(
  payoutId: string,
  payload: MarkPayoutPaidPayload,
) {
  return parse<InfluencerPayoutApiResponse<InfluencerPayoutRow>>(
    await apiClient.request(
      buildApiUrl(INFLUENCER_PAYOUT_MARK_PAID_PATH(payoutId)),
      json(payload),
    ),
  );
}

async function markPayoutFailed(
  payoutId: string,
  payload: MarkPayoutFailedPayload,
) {
  return parse<InfluencerPayoutApiResponse<InfluencerPayoutRow>>(
    await apiClient.request(
      buildApiUrl(INFLUENCER_PAYOUT_MARK_FAILED_PATH(payoutId)),
      json(payload),
    ),
  );
}

async function cancelPayout(payoutId: string, payload: PayoutActionPayload) {
  return parse<InfluencerPayoutApiResponse<InfluencerPayoutRow>>(
    await apiClient.request(
      buildApiUrl(INFLUENCER_PAYOUT_CANCEL_PATH(payoutId)),
      json(payload),
    ),
  );
}

export const influencerPayoutService = {
  approvePayout,
  cancelPayout,
  createPayoutBatch,
  holdPayout,
  listBankAccounts,
  listKycChecks,
  listPayouts,
  markPayoutFailed,
  markPayoutPaid,
  retryPayout,
  reviewBankAccount,
  reviewKycCheck,
};
