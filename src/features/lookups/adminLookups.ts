import type { LookupOption } from '../../types/lookup.types'
import { customerService } from '../customers/services/customer.service'
import { orderService } from '../orders/services/order.service'
import { paymentService } from '../payments/services/payment.service'
import { settingsService } from '../settings/services/settings.service'
import { vendorService } from '../vendors/services/vendor.service'

const LOOKUP_PAGE_SIZE = 8

function compactMeta(parts: (string | null | undefined)[]) {
  return parts.filter(Boolean).join(' · ')
}

export async function searchCategoryLookupOptions(
  search: string,
): Promise<LookupOption[]> {
  const response = await settingsService.getCategories({
    isActive: true,
    limit: LOOKUP_PAGE_SIZE,
    page: 1,
    search: search || undefined,
  })

  return response.data.map((category) => ({
    label: category.name,
    meta: compactMeta([category.categoryCode, category.categoryId]),
    value: category.categoryId,
  }))
}

export async function searchVendorLookupOptions(
  search: string,
  filters: { categoryId?: string; categoryIds?: string[] } = {},
): Promise<LookupOption[]> {
  const categoryFilter =
    filters.categoryIds && filters.categoryIds.length > 0
      ? filters.categoryIds.join(',')
      : filters.categoryId

  const response = await vendorService.getVendorList({
    categoryId: categoryFilter || undefined,
    limit: LOOKUP_PAGE_SIZE,
    page: 1,
    search: search || undefined,
  })

  return response.data.map((vendor) => ({
    label: vendor.shopName,
    meta: compactMeta([
      vendor.publicVendorId,
      vendor.ownerName ?? vendor.mobileNumber,
      vendor.address.city,
    ]),
    value: vendor.vendorId,
  }))
}

export async function searchCustomerLookupOptions(
  search: string,
): Promise<LookupOption[]> {
  const response = await customerService.getCustomerList({
    limit: LOOKUP_PAGE_SIZE,
    page: 1,
    search: search || undefined,
  })

  return response.data.map((customer) => ({
    label: customer.fullName,
    meta: compactMeta([
      customer.mobileNumber ?? customer.email,
      customer.city,
      customer.customerId,
    ]),
    value: customer.customerId,
  }))
}

export async function searchZoneLookupOptions(
  search: string,
): Promise<LookupOption[]> {
  const response = await settingsService.getZones({
    isActive: true,
    limit: LOOKUP_PAGE_SIZE,
    page: 1,
    search: search || undefined,
  })

  return response.data.map((zone) => ({
    label: zone.zoneName,
    meta: compactMeta([zone.city, zone.zoneId]),
    value: zone.zoneId,
  }))
}

export async function searchOrderLookupOptions(
  search: string,
): Promise<LookupOption[]> {
  const response = await orderService.getOrderList({
    limit: LOOKUP_PAGE_SIZE,
    page: 1,
    search: search || undefined,
  })

  return response.data.map((order) => ({
    label: order.publicOrderId,
    meta: compactMeta([
      order.customer.fullName,
      order.vendor.shopName,
      order.orderStatus,
    ]),
    value: order.orderId,
  }))
}

export async function searchPaymentLookupOptions(
  search: string,
): Promise<LookupOption[]> {
  const response = await paymentService.getPaymentList({
    limit: LOOKUP_PAGE_SIZE,
    page: 1,
    search: search || undefined,
  })

  return response.data.map((payment) => ({
    label: payment.publicPaymentId,
    meta: compactMeta([
      payment.order.publicOrderId,
      payment.customer.fullName,
      payment.status,
    ]),
    value: payment.paymentId,
  }))
}
