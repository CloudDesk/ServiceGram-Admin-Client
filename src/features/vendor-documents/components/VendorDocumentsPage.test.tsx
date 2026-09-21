import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { vendorService } from '../../vendors/services/vendor.service'
import type { VendorDocumentReviewGroup } from '../../vendors/types/vendor.types'
import { VendorDocumentsPage } from './VendorDocumentsPage'

const listDocuments = vi.spyOn(vendorService, 'getVendorDocuments')

function group(
  vendorId: string,
  shopName: string,
  counts: VendorDocumentReviewGroup['counts'],
): VendorDocumentReviewGroup {
  return {
    vendor: {
      vendorId,
      publicVendorId: `VND-${vendorId}`,
      shopName,
      ownerName: 'Priya Menon',
      mobileNumber: '+919876543210',
      businessEmail: null,
      city: 'Bengaluru',
      category: {
        categoryId: 'category-1',
        categoryCode: 'LAUNDRY',
        name: 'Laundry',
      },
      zone: null,
      onboardingStatus: 'UNDER_REVIEW',
      vendorStatus: 'PENDING',
    },
    counts,
    latestUpdatedAt: '2026-09-18T10:00:00.000Z',
    requiresReview: counts.pending > 0,
    warnings: [],
    availableActions: ['OPEN_VENDOR', 'VIEW_DOCUMENT'],
    nextRecommendedAction:
      counts.pending > 0 ? 'REVIEW_DOCUMENTS' : 'OPEN_REVIEW',
  }
}

const rows = [
  group('vendor-1', 'Sparkle Laundry', {
    total: 3,
    pending: 1,
    verified: 2,
    rejected: 0,
    expired: 0,
    mediaIssues: 0,
    warnings: 0,
  }),
  group('vendor-2', 'QuickFix Mobiles', {
    total: 2,
    pending: 1,
    verified: 0,
    rejected: 1,
    expired: 0,
    mediaIssues: 1,
    warnings: 1,
  }),
]

beforeEach(() => {
  listDocuments.mockReset()
  listDocuments.mockResolvedValue({
    data: rows,
    summary: { totalVendors: 2, totalMatchingDocuments: 5 },
    pagination: {
      page: 1,
      limit: 20,
      totalItems: 2,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  })
})

describe('VendorDocumentsPage', () => {
  it('keeps vendor selection separate from the matching document total', async () => {
    const user = userEvent.setup()
    renderWithProviders(<VendorDocumentsPage />, {
      initialEntry: '/app/vendor-documents',
      path: '/app/vendor-documents',
      permissions: ['vendors:read'],
    })

    expect(await screen.findByText('Sparkle Laundry')).toBeInTheDocument()
    expect(screen.getByText(/1–2 of 2 vendors/)).toBeInTheDocument()
    expect(screen.getByText('5 documents')).toBeInTheDocument()

    await user.click(
      screen.getByRole('checkbox', { name: 'Select visible vendors' }),
    )

    expect(
      screen.getByText('vendors selected').parentElement,
    ).toHaveTextContent(/2\s*vendors selected/)
    expect(
      screen.getByRole('button', { name: 'Export vendors' }),
    ).toBeInTheDocument()
  })

  it('requests the media-issue queue from the server and clears selection', async () => {
    const user = userEvent.setup()
    renderWithProviders(<VendorDocumentsPage />, {
      initialEntry: '/app/vendor-documents',
      path: '/app/vendor-documents',
      permissions: ['vendors:read'],
    })

    await screen.findByText('Sparkle Laundry')
    await user.click(
      screen.getByRole('checkbox', { name: 'Select visible vendors' }),
    )
    await user.click(screen.getByRole('button', { name: 'Media issue' }))

    await waitFor(() =>
      expect(listDocuments).toHaveBeenLastCalledWith(
        expect.objectContaining({ reviewQueue: 'MEDIA_ISSUE', page: 1 }),
      ),
    )
    expect(screen.queryByText('vendors selected')).not.toBeInTheDocument()
  })
})
