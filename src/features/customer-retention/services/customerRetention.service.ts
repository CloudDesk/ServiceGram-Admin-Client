import { buildApiUrl } from "../../../config/api";
import {
  CUSTOMER_LOYALTY_ADJUSTMENT_PATH,
  CUSTOMER_LOYALTY_LEDGER_PATH,
  CUSTOMER_PRIVACY_REVIEW_PATH,
  CUSTOMER_WALLET_ADJUSTMENT_PATH,
  CUSTOMER_WALLET_LEDGER_PATH,
  PRIVACY_DELETION_QUEUE_PATH,
  PRIVACY_EXPORT_QUEUE_PATH,
  PROMO_ABUSE_QUEUE_PATH,
  PROMO_CODE_DETAIL_PATH,
  PROMO_CODE_STATUS_PATH,
  PROMO_CODES_PATH,
  REFERRAL_ABUSE_QUEUE_PATH,
  VENDOR_OFFERS_PATH,
  VENDOR_OFFER_RESTRICTION_PATH,
} from "../../../config/customerRetentionApiPaths";
import { apiClient } from "../../../services/apiClient";
import { buildQueryParams } from "../../../utils/buildQueryParams";
import type {
  LoyaltyLedgerEntry,
  PaginationMeta,
  PrivacyDeletionRequest,
  PrivacyExportRequest,
  PromoAbuseFinding,
  PromoCode,
  PromoCodeFormPayload,
  ReferralAbuseFinding,
  WalletLedgerEntry,
  AdminVendorOffer,
  AdminVendorOffersSummary,
} from "../types/customerRetention.types";

interface ErrorEnvelope {
  code?: string;
  message?: string;
  details?: { fieldErrors?: { field: string; message: string }[] };
}

export class CustomerRetentionServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly response: ErrorEnvelope | null,
  ) {
    super(message);
    this.name = "CustomerRetentionServiceError";
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T | ErrorEnvelope) : null;

  if (!response.ok) {
    const error = payload as ErrorEnvelope | null;
    throw new CustomerRetentionServiceError(
      error?.details?.fieldErrors?.[0]?.message ??
        error?.message ??
        `Request failed with status ${response.status}.`,
      response.status,
      error?.code ?? "REQUEST_FAILED",
      error,
    );
  }

  return payload as T;
}

function withQuery(path: string, query: object) {
  const queryString = buildQueryParams(query);
  return queryString ? `${path}?${queryString}` : path;
}

function jsonRequest(method: "POST" | "PUT" | "DELETE", payload: object) {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

async function request<T>(path: string, init?: RequestInit) {
  return parseJsonResponse<T>(await apiClient.request(buildApiUrl(path), init));
}

export const customerRetentionService = {
  listPrivacyExports(query: {
    page?: number;
    limit?: number;
    status?: string;
  }) {
    return request<{
      data: PrivacyExportRequest[];
      pagination: PaginationMeta;
      summary: Record<string, number>;
    }>(withQuery(PRIVACY_EXPORT_QUEUE_PATH, query));
  },

  listPrivacyDeletions(query: {
    page?: number;
    limit?: number;
    status?: string;
  }) {
    return request<{
      data: PrivacyDeletionRequest[];
      pagination: PaginationMeta;
      summary: Record<string, number>;
    }>(withQuery(PRIVACY_DELETION_QUEUE_PATH, query));
  },

  reviewDeletion(
    customerId: string,
    deletionRequestId: string,
    payload: {
      status: string;
      reason: string;
      scheduledAt?: string | null;
      retainedUntilAt?: string | null;
    },
  ) {
    return request<{ data: PrivacyDeletionRequest }>(
      CUSTOMER_PRIVACY_REVIEW_PATH(customerId, deletionRequestId),
      jsonRequest("PUT", payload),
    );
  },

  getWalletLedger(customerId: string, page = 1, limit = 20) {
    return request<{
      data: {
        account: {
          currency: string;
          availableBalancePaise: number;
          reservedBalancePaise: number;
          lifetimeCreditPaise: number;
          lifetimeDebitPaise: number;
        };
        data: WalletLedgerEntry[];
        pagination: {
          page: number;
          limit: number;
          hasNextPage: boolean;
          hasPreviousPage: boolean;
        };
      };
    }>(withQuery(CUSTOMER_WALLET_LEDGER_PATH(customerId), { page, limit }));
  },

  getLoyaltyLedger(customerId: string, page = 1, limit = 20) {
    return request<{
      data: {
        account: {
          pointsBalance: number;
          lifetimeEarnedPoints: number;
          lifetimeRedeemedPoints: number;
          lifetimeExpiredPoints: number;
          minRedeemPoints: number;
        };
        data: LoyaltyLedgerEntry[];
        pagination: {
          page: number;
          limit: number;
          hasNextPage: boolean;
          hasPreviousPage: boolean;
        };
      };
    }>(withQuery(CUSTOMER_LOYALTY_LEDGER_PATH(customerId), { page, limit }));
  },

  adjustWallet(
    customerId: string,
    payload: {
      direction: "CREDIT" | "DEBIT";
      amountPaise: number;
      reason: string;
      referenceId?: string;
    },
  ) {
    return request<{
      data: { availableBalancePaise: number; warnings: string[] };
    }>(
      CUSTOMER_WALLET_ADJUSTMENT_PATH(customerId),
      jsonRequest("POST", payload),
    );
  },

  adjustLoyalty(
    customerId: string,
    payload: {
      direction: "CREDIT" | "DEBIT";
      points: number;
      reason: string;
      referenceId?: string;
    },
  ) {
    return request<{ data: { pointsBalance: number; warnings: string[] } }>(
      CUSTOMER_LOYALTY_ADJUSTMENT_PATH(customerId),
      jsonRequest("POST", payload),
    );
  },

  listPromoCodes(query: {
    page?: number;
    limit?: number;
    status?: string;
    source?: string;
    search?: string;
  }) {
    return request<{
      data: PromoCode[];
      pagination: PaginationMeta;
      summary: Record<string, number>;
    }>(withQuery(PROMO_CODES_PATH, query));
  },

  createPromoCode(payload: PromoCodeFormPayload) {
    return request<{ data: PromoCode }>(
      PROMO_CODES_PATH,
      jsonRequest("POST", payload),
    );
  },

  updatePromoCode(
    promoCodeId: string,
    payload: Omit<
      Partial<PromoCodeFormPayload>,
      "code" | "source" | "discountType"
    > & {
      reason: string;
    },
  ) {
    return request<{ data: PromoCode }>(
      PROMO_CODE_DETAIL_PATH(promoCodeId),
      jsonRequest("PUT", payload),
    );
  },

  changePromoStatus(
    promoCodeId: string,
    payload: { status: "ACTIVE" | "PAUSED" | "EXPIRED"; reason: string },
  ) {
    return request<{ data: PromoCode }>(
      PROMO_CODE_STATUS_PATH(promoCodeId),
      jsonRequest("POST", payload),
    );
  },

  deletePromoCode(promoCodeId: string, reason: string) {
    return request<{ data: PromoCode }>(
      PROMO_CODE_DETAIL_PATH(promoCodeId),
      jsonRequest("DELETE", { status: "EXPIRED", reason }),
    );
  },

  listPromoAbuse(query: {
    page?: number;
    limit?: number;
    windowHours?: number;
  }) {
    return request<{
      data: PromoAbuseFinding[];
      pagination: { page: number; limit: number };
    }>(withQuery(PROMO_ABUSE_QUEUE_PATH, query));
  },

  listReferralAbuse(query: {
    page?: number;
    limit?: number;
    windowHours?: number;
  }) {
    return request<{
      data: ReferralAbuseFinding[];
      pagination: { page: number; limit: number };
    }>(withQuery(REFERRAL_ABUSE_QUEUE_PATH, query));
  },

  listVendorOffers(query: {
    page?: number;
    limit?: number;
    status?: string;
    offerType?: string;
    search?: string;
    riskOnly?: boolean;
  }) {
    return request<{
      data: AdminVendorOffer[];
      pagination: PaginationMeta;
      summary: AdminVendorOffersSummary;
    }>(withQuery(VENDOR_OFFERS_PATH, query));
  },

  updateVendorOfferRestriction(
    offerId: string,
    payload: {
      action: "RESTRICT" | "RESTORE";
      expectedVersion: number;
      reason: string;
    },
  ) {
    return request<{ data: AdminVendorOffer }>(
      VENDOR_OFFER_RESTRICTION_PATH(offerId),
      jsonRequest("POST", payload),
    );
  },
};
