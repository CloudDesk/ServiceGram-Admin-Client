export const INFLUENCER_BANK_ACCOUNT_LIST_PATH =
  "/admin/influencer-bank-accounts";
export const INFLUENCER_BANK_ACCOUNT_REVIEW_PATH = (bankAccountId: string) =>
  `/admin/influencer-bank-accounts/${bankAccountId}/review`;

export const INFLUENCER_KYC_CHECK_LIST_PATH = "/admin/influencer-kyc-checks";
export const INFLUENCER_KYC_CHECK_REVIEW_PATH = (kycCheckId: string) =>
  `/admin/influencer-kyc-checks/${kycCheckId}/review`;

export const INFLUENCER_PAYOUT_LIST_PATH = "/admin/influencer-payouts";
export const INFLUENCER_PAYOUT_BATCH_PATH = "/admin/influencer-payouts/batches";
export const INFLUENCER_PAYOUT_APPROVE_PATH = (payoutId: string) =>
  `/admin/influencer-payouts/${payoutId}/approve`;
export const INFLUENCER_PAYOUT_HOLD_PATH = (payoutId: string) =>
  `/admin/influencer-payouts/${payoutId}/hold`;
export const INFLUENCER_PAYOUT_RETRY_PATH = (payoutId: string) =>
  `/admin/influencer-payouts/${payoutId}/retry`;
export const INFLUENCER_PAYOUT_MARK_PAID_PATH = (payoutId: string) =>
  `/admin/influencer-payouts/${payoutId}/mark-paid`;
export const INFLUENCER_PAYOUT_MARK_FAILED_PATH = (payoutId: string) =>
  `/admin/influencer-payouts/${payoutId}/mark-failed`;
export const INFLUENCER_PAYOUT_CANCEL_PATH = (payoutId: string) =>
  `/admin/influencer-payouts/${payoutId}/cancel`;
