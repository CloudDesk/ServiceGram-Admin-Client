export const CUSTOMER_LIST_PATH = '/admin/customers'
export const CUSTOMER_DETAIL_PATH = (customerId: string) =>
  `/admin/customers/${customerId}`
export const CUSTOMER_OVERVIEW_PATH = (customerId: string) =>
  `/admin/customers/${customerId}/overview`
export const CUSTOMER_RELATED_VENDORS_PATH = (customerId: string) =>
  `/admin/customers/${customerId}/related-vendors`
export const CUSTOMER_PROFILE_UPDATE_PATH = (customerId: string) =>
  `/admin/customers/${customerId}/profile`
export const CUSTOMER_ADDRESS_LIST_PATH = (customerId: string) =>
  `/admin/customers/${customerId}/addresses`
export const CUSTOMER_ADDRESS_DETAIL_PATH = (
  customerId: string,
  addressId: string,
) => `/admin/customers/${customerId}/addresses/${addressId}`
export const CUSTOMER_ADDRESS_SET_DEFAULT_PATH = (
  customerId: string,
  addressId: string,
) => `/admin/customers/${customerId}/addresses/${addressId}/set-default`
export const CUSTOMER_ADD_NOTE_PATH = (customerId: string) =>
  `/admin/customers/${customerId}/notes`
export const CUSTOMER_BLOCK_PATH = (customerId: string) =>
  `/admin/customers/${customerId}/block`
export const CUSTOMER_UNBLOCK_PATH = (customerId: string) =>
  `/admin/customers/${customerId}/unblock`
export const CUSTOMER_WALLET_CREDIT_PATH = (customerId: string) =>
  `/admin/customers/${customerId}/wallet-credit`
