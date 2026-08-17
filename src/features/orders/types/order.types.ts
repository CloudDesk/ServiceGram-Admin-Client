import type { ApiErrorDetails } from "../../../types/api.types";

export type AdminOrderStatus =
  | "ORDER_PLACED"
  | "VENDOR_ACCEPTANCE_PENDING"
  | "PRICE_REVISION_PENDING_CUSTOMER"
  | "VENDOR_ACCEPTED"
  | "VENDOR_DECLINED"
  | "PICKUP_SCHEDULED"
  | "PICKED_UP_FROM_CUSTOMER"
  | "HANDED_OVER_TO_VENDOR"
  | "ITEM_RECEIVED_BY_VENDOR"
  | "SERVICE_IN_PROGRESS"
  | "SERVICE_COMPLETED"
  | "COLLECTED_FROM_VENDOR"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "DELIVERY_FAILED"
  | "CUSTOMER_UNAVAILABLE"
  | "ITEM_DAMAGED"
  | "ITEM_LOST"
  | "WRONG_ITEM";

export type AdminOrderPaymentStatus =
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED"
  | "COD_PENDING";

export type AdminOrderPaymentMethod = "PREPAID" | "COD" | "WALLET" | "MIXED";
type AdminOrderFilterValue<T extends string> = T | T[];
type AdminOrderIdFilterValue = string | string[];

export type LogisticsPackageCondition =
  | "GOOD"
  | "DAMAGED"
  | "OPENED"
  | "MISSING_PARTS"
  | "UNKNOWN";

export type LogisticsIssueType =
  | "DAMAGED"
  | "LOST"
  | "WRONG_ITEM"
  | "CUSTOMER_UNAVAILABLE"
  | "OTHER";

export type OrderMediaPurpose =
  | "PICKUP_PROOF"
  | "VENDOR_HANDOVER_PROOF"
  | "SERVICE_PROOF"
  | "RETURN_COLLECTION_PROOF"
  | "DELIVERY_PROOF"
  | "ISSUE_PROOF";

export type OrderProofMimeType = "image/jpeg" | "image/png" | "image/webp";

export interface AdminOrdersQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  orderStatus?: AdminOrderFilterValue<AdminOrderStatus>;
  paymentStatus?: AdminOrderFilterValue<AdminOrderPaymentStatus>;
  paymentMethod?: AdminOrderFilterValue<AdminOrderPaymentMethod>;
  city?: string;
  categoryId?: AdminOrderIdFilterValue;
  zoneId?: string;
  vendorId?: AdminOrderIdFilterValue;
  customerId?: AdminOrderIdFilterValue;
  dateFrom?: string;
  dateTo?: string;
}

export interface UpdateOrderStatusPayload {
  targetStatus: AdminOrderStatus;
  eventTime?: string;
  internalNote?: string;
  proofMediaAssetId?: string;
  packageCondition?: LogisticsPackageCondition;
  issueType?: LogisticsIssueType;
  notifyCustomer?: boolean;
  notifyVendor?: boolean;
}

export interface CancelOrderPayload {
  reason: string;
  notifyCustomer?: boolean;
  notifyVendor?: boolean;
}

export type RefundReasonCode =
  | "PRICE_ADJUSTMENT"
  | "CUSTOMER_CANCELLATION"
  | "VENDOR_CANCELLATION"
  | "SERVICE_ISSUE"
  | "DUPLICATE_PAYMENT"
  | "DISPUTE";

export interface InitiateOrderRefundPayload {
  paymentId?: string;
  amountPaise?: number;
  reason: string;
  /** Structured reason approval routing reads. */
  reasonCode?: RefundReasonCode;
  /** Omitted when nobody has assessed it — see the refund form. */
  hasDispute?: boolean;
}

export interface GenerateDeliveryOtpPayload {
  expiresInMinutes?: number;
  notifyCustomer?: boolean;
  reason?: string;
}

export interface ConfirmDeliveryOtpPayload {
  otpCode: string;
  eventTime?: string;
  internalNote?: string;
  proofMediaAssetId?: string;
  packageCondition?: LogisticsPackageCondition;
}

export interface AddOrderNotePayload {
  note: string;
  isPinned?: boolean;
}

export interface CreateOrderProofUploadIntentPayload {
  purpose: OrderMediaPurpose;
  fileName: string;
  mimeType: OrderProofMimeType;
  sizeBytes: number;
}

export interface AdminOrderCustomer {
  customerId: string;
  fullName: string;
  mobileNumber: string | null;
  email: string | null;
  city: string | null;
  status: string;
}

export interface AdminOrderZone {
  zoneId: string;
  city: string;
  zoneName: string;
}

export interface AdminOrderVendor {
  vendorId: string;
  publicVendorId: string;
  shopName: string;
  vendorStatus: string;
  city: string;
  zone: AdminOrderZone | null;
}

export interface AdminOrderCategory {
  categoryId: string;
  categoryCode: string;
  name: string;
}

export interface AdminOrderSchedule {
  pickupDate: string;
  pickupSlotStart: string;
  pickupSlotEnd: string;
  expectedDeliveryAt: string | null;
  deliveredAt: string | null;
}

export interface AdminOrderPendingPriceRevision {
  priceRevisionId: string;
  status: string;
  previousPricePaise: number;
  revisedPricePaise: number;
  differencePaise: number;
  currency: string;
  reason: string | null;
  requestedAt: string;
}

export interface AdminOrderPricing {
  priceEstimatePaise: number;
  finalPricePaise: number | null;
  payableAmountPaise?: number | null;
  priceApprovalRequired?: boolean;
  pendingPriceRevision?: AdminOrderPendingPriceRevision | null;
  currency: string;
}

export interface AdminOrderCounts {
  itemCount: number;
  noteCount: number;
  logisticsEventCount: number;
  refundCount: number;
  activeOtpCount: number;
}

export interface AdminOrderSummary {
  orderId: string;
  publicOrderId: string;
  orderStatus: AdminOrderStatus;
  paymentStatus: AdminOrderPaymentStatus;
  paymentMethod: AdminOrderPaymentMethod;
  customer: AdminOrderCustomer;
  vendor: AdminOrderVendor;
  category: AdminOrderCategory | null;
  schedule: AdminOrderSchedule;
  pricing: AdminOrderPricing;
  sourceReelId: string | null;
  cancellationReason: string | null;
  counts: AdminOrderCounts | null;
  warnings: string[];
  availableActions: string[];
  nextRecommendedAction: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrderItem {
  orderItemId: string;
  serviceTypeId: string | null;
  itemName: string;
  quantity: number;
  unitPricePaise: number | null;
  totalPricePaise: number | null;
  itemDetails: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrderStatusHistoryItem {
  statusHistoryId: string;
  fromStatus: AdminOrderStatus | null;
  toStatus: AdminOrderStatus;
  changedByUserId: string | null;
  changedByAdminId: string | null;
  actorType: string;
  note: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface AdminOrderLogisticsTimelineItem {
  logisticsEventId: string;
  eventType: string;
  adminId: string;
  eventTime: string;
  internalNote: string | null;
  proofMediaAssetId: string | null;
  packageCondition: LogisticsPackageCondition | null;
  issueType: LogisticsIssueType | null;
  customerNotificationSent: boolean;
  vendorNotificationSent: boolean;
  metadata: unknown;
  createdAt: string;
}

export interface AdminOrderNote {
  orderNoteId: string;
  adminId: string | null;
  note: string;
  isPinned: boolean;
  metadata?: unknown;
  createdAt: string;
}

export interface AdminOrderMediaAsset {
  orderMediaAssetId: string;
  mediaAssetId: string;
  purpose: OrderMediaPurpose | string;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
  status: string;
  accessLevel: string;
  createdAt: string;
}

export interface AdminOrderPayment {
  paymentId: string;
  publicPaymentId: string;
  amountPaise: number;
  currency: string;
  method: string;
  gateway: string;
  status: string;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrderRefund {
  refundId: string;
  paymentId: string;
  amountPaise: number;
  reason: string;
  status: string;
  initiatedByAdminId: string | null;
  approvedByAdminId: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrderActiveDeliveryOtp {
  deliveryOtpId: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: string;
  createdAt: string;
}

export interface AdminOrderDetail extends AdminOrderSummary {
  items: AdminOrderItem[];
  statusHistory: AdminOrderStatusHistoryItem[];
  logisticsTimeline: AdminOrderLogisticsTimelineItem[];
  notes: AdminOrderNote[];
  mediaAssets: AdminOrderMediaAsset[];
  payments: AdminOrderPayment[];
  refunds: AdminOrderRefund[];
  activeDeliveryOtp: AdminOrderActiveDeliveryOtp | null;
}

export interface AdminOrderStatusActionResult extends AdminOrderSummary {
  statusHistoryEventId: string | null;
  logisticsEventId: string | null;
}

export interface AdminOrderCancelActionResult extends AdminOrderSummary {
  statusHistoryEventId: string | null;
}

export interface AdminOrderRefundActionResult extends AdminOrderSummary {
  refund: {
    refundId: string;
    paymentId: string;
    amountPaise: number;
    reason: string;
    status: string;
    createdAt: string;
  } | null;
}

export interface AdminOrderDeliveryOtpResult {
  deliveryOtpId: string;
  orderId: string;
  status: string;
  expiresAt: string;
  maxAttempts: number;
  notificationDispatch: {
    requested: boolean;
    status: string;
  };
}

export interface AdminOrderConfirmDeliveryOtpResult extends AdminOrderStatusActionResult {
  deliveryOtpId: string;
}

export interface AdminOrderAddNoteResult extends AdminOrderSummary {
  addedNote: {
    orderNoteId: string;
    adminId: string | null;
    note: string;
    isPinned: boolean;
    createdAt: string;
  } | null;
}

export interface AdminOrderProofUploadIntentResult {
  mediaAssetId: string;
  orderMediaAssetId: string;
  purpose: OrderMediaPurpose;
  fileName: string;
  mimeType: OrderProofMimeType;
  sizeBytes: number;
  status: string;
  uploadUrl: string | null;
  expiresAt: string | null;
  headers: Record<string, string>;
  providerStatus: string;
  warnings: string[];
}

export interface AdminOrdersPagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface AdminOrderQueueSummary {
  allOrders: number;
  priceReview: number;
  vendorAcceptance: number;
  inProgress: number;
  delivery: number;
  paymentReview: number;
  completed: number;
  cancelled: number;
}

export interface AdminOrdersSummary {
  total: number;
  active: number;
  delivered: number;
  cancelled: number;
  needsAttention: number;
  paymentReview: number;
  totalValuePaise: number;
  currency: string;
  byOrderStatus: Partial<Record<AdminOrderStatus, number>>;
  byPaymentStatus: Partial<Record<AdminOrderPaymentStatus, number>>;
  queueSummary?: AdminOrderQueueSummary;
}

export interface AdminOrdersApiResponse<TData> {
  success?: boolean;
  code?: string;
  message?: string;
  data: TData;
  meta?: {
    requestId?: string;
    timestamp?: string;
    path?: string;
    method?: string;
    durationMs?: number;
    apiVersion?: string;
  };
}

export interface AdminOrdersListResponse extends AdminOrdersApiResponse<
  AdminOrderSummary[]
> {
  data: AdminOrderSummary[];
  pagination: AdminOrdersPagination;
  summary?: AdminOrdersSummary;
}

export type AdminOrderDetailResponse = AdminOrdersApiResponse<AdminOrderDetail>;

export type UpdateOrderStatusResponse =
  AdminOrdersApiResponse<AdminOrderStatusActionResult>;

export type CancelOrderResponse =
  AdminOrdersApiResponse<AdminOrderCancelActionResult>;

export type InitiateOrderRefundResponse =
  AdminOrdersApiResponse<AdminOrderRefundActionResult>;

export type GenerateDeliveryOtpResponse =
  AdminOrdersApiResponse<AdminOrderDeliveryOtpResult>;

export type ConfirmDeliveryOtpResponse =
  AdminOrdersApiResponse<AdminOrderConfirmDeliveryOtpResult>;

export type AddOrderNoteResponse =
  AdminOrdersApiResponse<AdminOrderAddNoteResult>;

export type CreateOrderProofUploadIntentResponse =
  AdminOrdersApiResponse<AdminOrderProofUploadIntentResult>;

export interface AdminOrdersApiErrorDetails extends ApiErrorDetails {
  fieldErrors?: {
    field: string;
    code: string;
    message: string;
  }[];
}
