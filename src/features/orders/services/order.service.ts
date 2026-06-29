import { buildApiUrl } from "../../../config/api";
import {
  ORDER_ADD_NOTE_PATH,
  ORDER_CANCEL_PATH,
  ORDER_CUSTOMER_LIST_PATH,
  ORDER_CONFIRM_DELIVERY_OTP_PATH,
  ORDER_DETAIL_PATH,
  ORDER_GENERATE_DELIVERY_OTP_PATH,
  ORDER_LIST_PATH,
  ORDER_PROOF_UPLOAD_INTENT_PATH,
  ORDER_REFUND_PATH,
  ORDER_UPDATE_STATUS_PATH,
  ORDER_VENDOR_LIST_PATH,
} from "../../../config/orderApiPaths";
import { apiClient } from "../../../services/apiClient";
import { buildQueryParams } from "../../../utils/buildQueryParams";
import type {
  AddOrderNotePayload,
  AddOrderNoteResponse,
  AdminOrderDetailResponse,
  AdminOrdersListResponse,
  AdminOrdersQueryParams,
  CancelOrderPayload,
  CancelOrderResponse,
  ConfirmDeliveryOtpPayload,
  ConfirmDeliveryOtpResponse,
  CreateOrderProofUploadIntentPayload,
  CreateOrderProofUploadIntentResponse,
  GenerateDeliveryOtpPayload,
  GenerateDeliveryOtpResponse,
  InitiateOrderRefundPayload,
  InitiateOrderRefundResponse,
  UpdateOrderStatusPayload,
  UpdateOrderStatusResponse,
} from "../types/order.types";

interface ErrorEnvelope {
  message?: string;
  error?: string;
  details?: {
    fieldErrors?: {
      field: string;
      message: string;
    }[];
  };
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | T
    | ErrorEnvelope
    | null;

  if (!response.ok) {
    const fieldMessage =
      payload && typeof payload === "object" && "details" in payload
        ? payload.details?.fieldErrors?.[0]?.message
        : undefined;
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? payload.message
        : undefined;
    const error =
      payload && typeof payload === "object" && "error" in payload
        ? payload.error
        : undefined;

    throw new Error(fieldMessage ?? message ?? error ?? "Order request failed.");
  }

  return payload as T;
}

function postJson<TPayload>(payload: TPayload) {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  };
}

async function getOrderList(
  query: AdminOrdersQueryParams = {},
): Promise<AdminOrdersListResponse> {
  const queryString = buildQueryParams(query);
  const response = await apiClient.request(
    buildApiUrl(
      queryString ? `${ORDER_LIST_PATH}?${queryString}` : ORDER_LIST_PATH,
    ),
  );

  return parseJsonResponse<AdminOrdersListResponse>(response);
}

async function getVendorOrders(
  vendorId: string,
  query: AdminOrdersQueryParams = {},
): Promise<AdminOrdersListResponse> {
  const queryString = buildQueryParams(query);
  const path = ORDER_VENDOR_LIST_PATH(vendorId);
  const response = await apiClient.request(
    buildApiUrl(queryString ? `${path}?${queryString}` : path),
  );

  return parseJsonResponse<AdminOrdersListResponse>(response);
}

async function getCustomerOrders(
  customerId: string,
  query: AdminOrdersQueryParams = {},
): Promise<AdminOrdersListResponse> {
  const queryString = buildQueryParams(query);
  const path = ORDER_CUSTOMER_LIST_PATH(customerId);
  const response = await apiClient.request(
    buildApiUrl(queryString ? `${path}?${queryString}` : path),
  );

  return parseJsonResponse<AdminOrdersListResponse>(response);
}

async function getOrderById(
  orderId: string,
): Promise<AdminOrderDetailResponse> {
  const response = await apiClient.request(
    buildApiUrl(ORDER_DETAIL_PATH(orderId)),
  );

  return parseJsonResponse<AdminOrderDetailResponse>(response);
}

async function updateOrderStatus(
  orderId: string,
  payload: UpdateOrderStatusPayload,
): Promise<UpdateOrderStatusResponse> {
  const response = await apiClient.request(
    buildApiUrl(ORDER_UPDATE_STATUS_PATH(orderId)),
    postJson(payload),
  );

  return parseJsonResponse<UpdateOrderStatusResponse>(response);
}

async function cancelOrder(
  orderId: string,
  payload: CancelOrderPayload,
): Promise<CancelOrderResponse> {
  const response = await apiClient.request(
    buildApiUrl(ORDER_CANCEL_PATH(orderId)),
    postJson(payload),
  );

  return parseJsonResponse<CancelOrderResponse>(response);
}

async function initiateOrderRefund(
  orderId: string,
  payload: InitiateOrderRefundPayload,
): Promise<InitiateOrderRefundResponse> {
  const response = await apiClient.request(
    buildApiUrl(ORDER_REFUND_PATH(orderId)),
    postJson(payload),
  );

  return parseJsonResponse<InitiateOrderRefundResponse>(response);
}

async function generateDeliveryOtp(
  orderId: string,
  payload: GenerateDeliveryOtpPayload = {},
): Promise<GenerateDeliveryOtpResponse> {
  const response = await apiClient.request(
    buildApiUrl(ORDER_GENERATE_DELIVERY_OTP_PATH(orderId)),
    postJson(payload),
  );

  return parseJsonResponse<GenerateDeliveryOtpResponse>(response);
}

async function confirmDeliveryOtp(
  orderId: string,
  payload: ConfirmDeliveryOtpPayload,
): Promise<ConfirmDeliveryOtpResponse> {
  const response = await apiClient.request(
    buildApiUrl(ORDER_CONFIRM_DELIVERY_OTP_PATH(orderId)),
    postJson(payload),
  );

  return parseJsonResponse<ConfirmDeliveryOtpResponse>(response);
}

async function addOrderNote(
  orderId: string,
  payload: AddOrderNotePayload,
): Promise<AddOrderNoteResponse> {
  const response = await apiClient.request(
    buildApiUrl(ORDER_ADD_NOTE_PATH(orderId)),
    postJson(payload),
  );

  return parseJsonResponse<AddOrderNoteResponse>(response);
}

async function createProofUploadIntent(
  orderId: string,
  payload: CreateOrderProofUploadIntentPayload,
): Promise<CreateOrderProofUploadIntentResponse> {
  const response = await apiClient.request(
    buildApiUrl(ORDER_PROOF_UPLOAD_INTENT_PATH(orderId)),
    postJson(payload),
  );

  return parseJsonResponse<CreateOrderProofUploadIntentResponse>(response);
}

export const orderService = {
  getOrderList,
  getCustomerOrders,
  getVendorOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  initiateOrderRefund,
  generateDeliveryOtp,
  confirmDeliveryOtp,
  addOrderNote,
  createProofUploadIntent,
};
