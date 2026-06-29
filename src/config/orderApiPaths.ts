export const ORDER_LIST_PATH = "/admin/orders";
export const ORDER_CUSTOMER_LIST_PATH = (customerId: string) =>
  `/admin/customers/${customerId}/orders`;
export const ORDER_VENDOR_LIST_PATH = (vendorId: string) =>
  `/admin/vendors/${vendorId}/orders`;
export const ORDER_DETAIL_PATH = (orderId: string) =>
  `/admin/orders/${orderId}`;
export const ORDER_UPDATE_STATUS_PATH = (orderId: string) =>
  `/admin/orders/${orderId}/status`;
export const ORDER_CANCEL_PATH = (orderId: string) =>
  `/admin/orders/${orderId}/cancel`;
export const ORDER_REFUND_PATH = (orderId: string) =>
  `/admin/orders/${orderId}/refund`;
export const ORDER_GENERATE_DELIVERY_OTP_PATH = (orderId: string) =>
  `/admin/orders/${orderId}/generate-delivery-otp`;
export const ORDER_CONFIRM_DELIVERY_OTP_PATH = (orderId: string) =>
  `/admin/orders/${orderId}/confirm-delivery-otp`;
export const ORDER_ADD_NOTE_PATH = (orderId: string) =>
  `/admin/orders/${orderId}/notes`;
export const ORDER_PROOF_UPLOAD_INTENT_PATH = (orderId: string) =>
  `/admin/orders/${orderId}/proof-upload-intent`;
