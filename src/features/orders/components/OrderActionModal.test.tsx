import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { AdminOrderSummary } from '../types/order.types'
import { OrderActionModal, type OrderActionFormValues, type OrderActionSelection } from './OrderActionModal'

/**
 * OrderActionModal covers 7 unrelated actions in one component, each split
 * into its own field set on the shared Modal shell. These tests exist to
 * prove the split kept each action's own validation and submitted payload
 * exactly as it was before the split — nothing here changes the behavior a
 * live order screen already relies on.
 */

function order(overrides: Partial<AdminOrderSummary> = {}): AdminOrderSummary {
  return {
    orderId: 'order-1',
    publicOrderId: 'SG-1029',
    orderStatus: 'PICKUP_SCHEDULED',
    paymentStatus: 'PENDING',
    paymentMethod: 'PREPAID',
    customer: {
      customerId: 'customer-1',
      fullName: 'Asha Rao',
      mobileNumber: '9000000000',
      email: null,
      city: 'Bengaluru',
      status: 'ACTIVE',
    },
    vendor: {
      vendorId: 'vendor-1',
      publicVendorId: 'SGV-1',
      shopName: 'CleanCo',
      vendorStatus: 'ACTIVE',
      city: 'Bengaluru',
      zone: null,
    },
    category: null,
    schedule: {
      pickupDate: '2026-09-10',
      pickupSlotStart: '10:00',
      pickupSlotEnd: '12:00',
      expectedDeliveryAt: null,
      deliveredAt: null,
    },
    pricing: {
      priceEstimatePaise: 50000,
      finalPricePaise: null,
      currency: 'INR',
    },
    sourceReelId: null,
    cancellationReason: null,
    counts: null,
    warnings: [],
    availableActions: [],
    nextRecommendedAction: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}

function renderModal(action: OrderActionSelection, onSubmit = vi.fn()) {
  const onClose = vi.fn()
  render(
    <OrderActionModal
      action={action}
      isSubmitting={false}
      order={order()}
      onClose={onClose}
      onSubmit={onSubmit}
    />,
  )
  return { onClose, onSubmit }
}

describe('OrderActionModal', () => {
  it('renders nothing when there is no action selected', () => {
    const { container } = render(
      <OrderActionModal action={null} isSubmitting={false} order={order()} onClose={vi.fn()} onSubmit={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the order identity in every action modal', () => {
    renderModal({ kind: 'CANCEL' })
    expect(screen.getByText('SG-1029 · Asha Rao · CleanCo')).toBeInTheDocument()
  })

  it('cancel: refuses to submit under 3 characters and does not call onSubmit', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderModal({ kind: 'CANCEL' })

    await user.type(screen.getByLabelText(/Reason/), 'no')
    await user.click(screen.getByRole('button', { name: 'Cancel order' }))

    expect(await screen.findByText('Reason must be at least 3 characters.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('cancel: submits the trimmed reason plus both notify toggles', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn<(values: OrderActionFormValues) => void>()
    renderModal({ kind: 'CANCEL' }, onSubmit)

    await user.type(screen.getByLabelText(/Reason/), 'Customer asked to cancel')
    await user.click(screen.getByLabelText('Notify customer'))
    await user.click(screen.getByRole('button', { name: 'Cancel order' }))

    expect(onSubmit).toHaveBeenCalledWith({
      reason: 'Customer asked to cancel',
      notifyCustomer: true,
      notifyVendor: false,
    })
  })

  it('add note: requires 3+ characters and defaults pin to unchecked', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn<(values: OrderActionFormValues) => void>()
    renderModal({ kind: 'ADD_NOTE' }, onSubmit)

    await user.type(screen.getByLabelText(/Internal note/), 'ok')
    await user.click(screen.getByRole('button', { name: 'Add note' }))
    expect(await screen.findByText('Note must be at least 3 characters.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText(/Internal note/), ' picked up early')
    await user.click(screen.getByRole('button', { name: 'Add note' }))

    expect(onSubmit).toHaveBeenCalledWith({ note: 'ok picked up early', isPinned: false })
  })

  it('confirm delivery OTP: rejects anything other than a 6 digit code', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderModal({ kind: 'CONFIRM_DELIVERY_OTP' })

    await user.type(screen.getByLabelText(/Delivery OTP/), '123')
    await user.click(screen.getByRole('button', { name: 'Confirm OTP' }))

    expect(await screen.findByText('OTP must be a 6 digit code.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('confirm delivery OTP: submits a valid 6 digit code', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn<(values: OrderActionFormValues) => void>()
    renderModal({ kind: 'CONFIRM_DELIVERY_OTP' }, onSubmit)

    await user.type(screen.getByLabelText(/Delivery OTP/), '482913')
    await user.click(screen.getByRole('button', { name: 'Confirm OTP' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ otpCode: '482913' }),
    )
  })

  it('generate delivery OTP: defaults notify-customer to on and needs no reason', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn<(values: OrderActionFormValues) => void>()
    renderModal({ kind: 'GENERATE_DELIVERY_OTP' }, onSubmit)

    expect(screen.getByLabelText('Notify customer')).toBeChecked()
    expect(screen.queryByLabelText('Notify vendor')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Generate OTP' }))

    expect(onSubmit).toHaveBeenCalledWith({
      reason: undefined,
      expiresInMinutes: 15,
      notifyCustomer: true,
    })
  })

  it('request proof upload: requires a file name and a positive size', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderModal({ kind: 'CREATE_PROOF_UPLOAD_INTENT' })

    await user.click(screen.getByRole('button', { name: 'Request upload' }))

    expect(await screen.findByText('File name and size are required.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('mark status: titles itself from the target status and requires an internal note', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderModal({ kind: 'UPDATE_STATUS', targetStatus: 'PICKED_UP_FROM_CUSTOMER' })

    expect(screen.getByText('Mark Picked Up From Customer')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mark status' }))
    expect(
      await screen.findByText('Internal note must be at least 3 characters for manual logistics updates.'),
    ).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('initiate refund: requires a reason before the optional routing fields matter', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderModal({ kind: 'INITIATE_REFUND' })

    await user.click(screen.getByRole('button', { name: 'Start refund' }))

    expect(await screen.findByText('Reason must be at least 3 characters.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('close button is disabled while a submission is in flight', () => {
    render(
      <OrderActionModal action={{ kind: 'CANCEL' }} isSubmitting order={order()} onClose={vi.fn()} onSubmit={vi.fn()} />,
    )

    expect(screen.getByRole('button', { name: /Close/ })).toBeDisabled()
  })
})
