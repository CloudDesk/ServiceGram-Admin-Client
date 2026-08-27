export const PRIVACY_EXPORT_QUEUE_PATH = "/admin/privacy/export-requests";
export const PRIVACY_DELETION_QUEUE_PATH = "/admin/privacy/deletion-requests";
export const CUSTOMER_PRIVACY_REVIEW_PATH = (
  customerId: string,
  deletionRequestId: string,
) =>
  `/admin/customers/${encodeURIComponent(customerId)}/privacy/deletion-requests/${encodeURIComponent(deletionRequestId)}`;

export const CUSTOMER_WALLET_LEDGER_PATH = (customerId: string) =>
  `/admin/customers/${encodeURIComponent(customerId)}/wallet/ledger`;
export const CUSTOMER_LOYALTY_LEDGER_PATH = (customerId: string) =>
  `/admin/customers/${encodeURIComponent(customerId)}/loyalty/ledger`;
export const CUSTOMER_WALLET_ADJUSTMENT_PATH = (customerId: string) =>
  `/admin/customers/${encodeURIComponent(customerId)}/wallet/adjustments`;
export const CUSTOMER_LOYALTY_ADJUSTMENT_PATH = (customerId: string) =>
  `/admin/customers/${encodeURIComponent(customerId)}/loyalty/adjustments`;

export const PROMO_CODES_PATH = "/admin/promo-codes";
export const PROMO_CODE_DETAIL_PATH = (promoCodeId: string) =>
  `/admin/promo-codes/${encodeURIComponent(promoCodeId)}`;
export const PROMO_CODE_STATUS_PATH = (promoCodeId: string) =>
  `/admin/promo-codes/${encodeURIComponent(promoCodeId)}/status`;
export const PROMO_ABUSE_QUEUE_PATH = "/admin/abuse/promo-redemptions";
export const REFERRAL_ABUSE_QUEUE_PATH = "/admin/abuse/referrals";
export const VENDOR_OFFERS_PATH = "/admin/vendor-offers";
export const VENDOR_OFFER_RESTRICTION_PATH = (offerId: string) =>
  `/admin/vendor-offers/${encodeURIComponent(offerId)}/restriction`;
