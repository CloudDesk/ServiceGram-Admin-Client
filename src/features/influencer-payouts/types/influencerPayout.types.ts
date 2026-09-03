import type { ApiErrorDetails } from "../../../types/api.types";

export type InfluencerBankAccountStatus =
  "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED" | "DISABLED";

export type InfluencerKycCheckStatus =
  "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "EXPIRED";

export type InfluencerKycCheckType = "PAN" | "AADHAAR" | "MANUAL_ID";

export type InfluencerPayoutStatus =
  | "PENDING"
  | "UNDER_REVIEW"
  | "HELD"
  | "APPROVED"
  | "PROCESSING"
  | "PAID"
  | "FAILED"
  | "CANCELLED";

export type InfluencerPayoutMethod = "MANUAL_BANK_TRANSFER" | "UPI" | "OTHER";
type QueryValue<T extends string> = T | T[];

export interface InfluencerPayoutPagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface InfluencerPayoutQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  influencerProfileId?: string;
}

export interface InfluencerBankAccountQueryParams extends InfluencerPayoutQueryParams {
  status?: QueryValue<InfluencerBankAccountStatus>;
}

export interface InfluencerKycQueryParams extends InfluencerPayoutQueryParams {
  status?: QueryValue<InfluencerKycCheckStatus>;
  checkType?: QueryValue<InfluencerKycCheckType>;
}

export interface InfluencerPayoutListQueryParams extends InfluencerPayoutQueryParams {
  status?: QueryValue<InfluencerPayoutStatus>;
}

export interface InfluencerAdminProfileSummary {
  id: string;
  publicInfluencerId: string;
  displayName: string;
  socialHandle: string | null;
  status: string;
}

export interface InfluencerBankAccount {
  id: string;
  influencerProfileId: string;
  accountHolderName: string;
  bankName: string;
  accountType: "SAVINGS" | "CURRENT";
  accountNumberMasked: string;
  ifscCode: string;
  upiId: string | null;
  status: InfluencerBankAccountStatus;
  isPrimary: boolean;
  rejectionReason: string | null;
  verifiedByAdminId: string | null;
  verifiedAt: string | null;
  version: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface InfluencerBankAccountReviewRow extends InfluencerBankAccount {
  influencer: InfluencerAdminProfileSummary;
  availableActions: string[];
}

export interface InfluencerKycCheck {
  id: string;
  influencerProfileId: string;
  checkType: InfluencerKycCheckType;
  status: InfluencerKycCheckStatus;
  documentNumberMasked: string | null;
  provider: string | null;
  providerReference: string | null;
  submittedAt: string | null;
  reviewedByAdminId: string | null;
  reviewedAt: string | null;
  reviewReason: string | null;
  expiresAt: string | null;
  version: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface InfluencerKycReviewRow extends InfluencerKycCheck {
  influencer: InfluencerAdminProfileSummary;
  availableActions: string[];
}

export interface InfluencerPayout {
  id: string;
  publicPayoutId: string;
  influencerProfileId: string;
  bankAccountId: string | null;
  batchKey: string;
  periodStart: string | null;
  periodEnd: string | null;
  totalAmountPaise: number;
  currency: string;
  status: InfluencerPayoutStatus;
  payoutMethod: InfluencerPayoutMethod;
  utrReference: string | null;
  approvedByAdminId: string | null;
  approvedAt: string | null;
  processingAt: string | null;
  paidAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  holdReason: string | null;
  version: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface InfluencerPayoutRow extends InfluencerPayout {
  influencer: InfluencerAdminProfileSummary;
  bankAccount: InfluencerBankAccount | null;
  availableActions: string[];
  nextRecommendedAction: string | null;
  warnings: string[];
}

export interface InfluencerPayoutSummary {
  total: number;
  PENDING: number;
  UNDER_REVIEW: number;
  HELD: number;
  APPROVED: number;
  PROCESSING: number;
  PAID: number;
  FAILED: number;
  CANCELLED: number;
  totalAmountPaise: number;
  paidAmountPaise: number;
  pendingAmountPaise: number;
}

export interface InfluencerBankAccountSummary {
  total: number;
  PENDING_VERIFICATION: number;
  VERIFIED: number;
  REJECTED: number;
  DISABLED: number;
}

export interface InfluencerKycSummary {
  total: number;
  PENDING_REVIEW: number;
  APPROVED: number;
  REJECTED: number;
  EXPIRED: number;
}

export interface InfluencerPayoutBatchCandidate {
  influencerProfileId: string;
  bankAccountId: string | null;
  totalAmountPaise: number;
  currency: string;
  itemCount: number;
}

export interface InfluencerPayoutBatchResult {
  dryRun: boolean;
  batchKey: string;
  minimumPaise: number;
  candidates: number | InfluencerPayoutBatchCandidate[];
  belowThreshold: number | InfluencerPayoutBatchCandidate[];
  created: InfluencerPayout[];
}

export interface ReviewBankAccountPayload {
  decision: "VERIFIED" | "REJECTED";
  expectedVersion: number;
  reason: string;
}

export interface ReviewKycPayload {
  decision: "APPROVED" | "REJECTED";
  expectedVersion: number;
  reason: string;
}

export interface CreatePayoutBatchPayload {
  batchKey?: string;
  limit?: number;
  dryRun?: boolean;
}

export interface PayoutActionPayload {
  expectedVersion: number;
  reason: string;
}

export interface MarkPayoutPaidPayload extends PayoutActionPayload {
  utrReference: string;
}

export interface MarkPayoutFailedPayload extends PayoutActionPayload {
  failureReason: string;
}

export interface InfluencerPayoutApiResponse<TData> {
  code?: string;
  message?: string;
  data: TData;
}

export interface InfluencerPayoutListResponse<
  TData,
> extends InfluencerPayoutApiResponse<TData[]> {
  pagination: InfluencerPayoutPagination;
}

export interface InfluencerBankAccountListResponse extends InfluencerPayoutListResponse<InfluencerBankAccountReviewRow> {
  summary?: InfluencerBankAccountSummary;
}

export interface InfluencerKycListResponse extends InfluencerPayoutListResponse<InfluencerKycReviewRow> {
  summary?: InfluencerKycSummary;
}

export interface InfluencerPayoutsListResponse extends InfluencerPayoutListResponse<InfluencerPayoutRow> {
  summary?: InfluencerPayoutSummary;
}

export interface InfluencerPayoutApiErrorDetails extends ApiErrorDetails {
  fieldErrors?: {
    field: string;
    code: string;
    message: string;
  }[];
}
