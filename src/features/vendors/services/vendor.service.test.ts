import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../../services/apiClient'
import { vendorService } from './vendor.service'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const requestSpy = vi.spyOn(apiClient, 'request')

beforeEach(() => {
  requestSpy.mockReset()
  requestSpy.mockResolvedValue(jsonResponse({ data: {} }))
})

describe('vendorService analytics request mapping', () => {
  it('maps the selected support window to the vendor analytics endpoint', async () => {
    await vendorService.getVendorAnalytics(
      'vendor/id',
      '90D',
    )

    expect(requestSpy).toHaveBeenCalledWith(
      'http://localhost:4000/api/v1/admin/vendors/vendor/id/analytics/overview?period=90D&timezone=Asia%2FKolkata&topLimit=5',
    )
  })

  it('requests a fresh persisted snapshot when an operator refreshes', async () => {
    await vendorService.getVendorAnalytics('vendor-id', '30D', true)

    expect(requestSpy).toHaveBeenCalledWith(
      'http://localhost:4000/api/v1/admin/vendors/vendor-id/analytics/overview?period=30D&refresh=true&timezone=Asia%2FKolkata&topLimit=5',
    )
  })
})
