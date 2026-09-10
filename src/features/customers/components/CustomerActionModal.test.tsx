import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { AdminCustomerListItem } from '../types/customer.types'
import {
  CustomerActionModal,
  type CustomerActionFormValues,
  type CustomerActionSelection,
} from './CustomerActionModal'

/**
 * Split from one component branching on 4 kinds into one field set per kind
 * on the shared Modal shell (the same move made for OrderActionModal, which
 * caught a submit-button-outside-the-form bug there). These tests exist to
 * prove that split kept every kind's validation and submitted payload intact.
 */

function customer(overrides: Partial<AdminCustomerListItem> = {}): AdminCustomerListItem {
  return {
    customerId: 'customer-1',
    userId: 'user-1',
    fullName: 'Asha Rao',
    mobileNumber: '9000000000',
    email: 'asha@example.com',
    city: 'Bengaluru',
    zone: null,
    status: 'ACTIVE',
    userStatus: 'ACTIVE',
    orderSummary: { totalOrders: 3, activeOrders: 1, lifetimeSpendPaise: 150000, lastOrderAt: null },
    walletSummary: { creditBalancePaise: 2000, providerStatus: 'ACTIVE' },
    noteSummary: { totalNotes: 0, lastNoteAt: null },
    warnings: [],
    availableActions: [],
    nextRecommendedAction: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    lastLoginAt: null,
    ...overrides,
  }
}

function renderModal(action: CustomerActionSelection, onSubmit = vi.fn()) {
  const onClose = vi.fn()
  render(
    <CustomerActionModal
      action={action}
      customer={customer()}
      isSubmitting={false}
      onClose={onClose}
      onSubmit={onSubmit}
    />,
  )
  return { onClose, onSubmit }
}

describe('CustomerActionModal', () => {
  it('renders nothing when there is no action selected', () => {
    const { container } = render(
      <CustomerActionModal action={null} customer={customer()} isSubmitting={false} onClose={vi.fn()} onSubmit={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the customer identity in every action modal', () => {
    renderModal({ kind: 'ADD_NOTE' })
    expect(screen.getByText('9000000000 · asha@example.com')).toBeInTheDocument()
  })

  it('add note: requires a note and submits it trimmed', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn<(values: CustomerActionFormValues) => void>()
    renderModal({ kind: 'ADD_NOTE' }, onSubmit)

    await user.click(screen.getByRole('button', { name: 'Add note' }))
    expect(await screen.findByText('Internal note is required.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText(/Internal note/), '  Called about a late delivery  ')
    await user.click(screen.getByRole('button', { name: 'Add note' }))

    expect(onSubmit).toHaveBeenCalledWith({ note: 'Called about a late delivery' })
  })

  it('block: requires a reason and submits it, with the danger button variant', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn<(values: CustomerActionFormValues) => void>()
    renderModal({ kind: 'BLOCK' }, onSubmit)

    expect(screen.getByRole('heading', { name: 'Block customer' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Block customer' }))
    expect(await screen.findByText('Reason is required.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText(/Reason/), 'Repeated abusive language with support')
    await user.click(screen.getByRole('button', { name: 'Block customer' }))

    expect(onSubmit).toHaveBeenCalledWith({ reason: 'Repeated abusive language with support' })
  })

  it('unblock: uses the unblock copy and submits a reason', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn<(values: CustomerActionFormValues) => void>()
    renderModal({ kind: 'UNBLOCK' }, onSubmit)

    expect(screen.getByRole('heading', { name: 'Unblock customer' })).toBeInTheDocument()
    await user.type(screen.getByLabelText(/Reason/), 'Appeal reviewed and approved')
    await user.click(screen.getByRole('button', { name: 'Unblock customer' }))

    expect(onSubmit).toHaveBeenCalledWith({ reason: 'Appeal reviewed and approved' })
  })

  it('wallet credit: requires a reason and a positive whole-number amount', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderModal({ kind: 'WALLET_CREDIT' })

    await user.type(screen.getByLabelText(/Reason/), 'Goodwill credit for delayed order')
    await user.click(screen.getByRole('button', { name: 'Apply credit' }))

    expect(
      await screen.findByText('Wallet credit amount in paise must be a positive whole number.'),
    ).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('wallet credit: submits amount, currency, and an optional reference', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn<(values: CustomerActionFormValues) => void>()
    renderModal({ kind: 'WALLET_CREDIT' }, onSubmit)

    await user.type(screen.getByLabelText(/Reason/), 'Goodwill credit for delayed order')
    await user.type(screen.getByLabelText(/Amount \(paise\)/), '5000')
    await user.type(screen.getByLabelText('Reference ID'), 'SUPPORT-991')
    await user.click(screen.getByRole('button', { name: 'Apply credit' }))

    expect(onSubmit).toHaveBeenCalledWith({
      reason: 'Goodwill credit for delayed order',
      amountPaise: 5000,
      currency: 'INR',
      referenceId: 'SUPPORT-991',
    })
  })

  it('close button is disabled while a submission is in flight', () => {
    render(
      <CustomerActionModal action={{ kind: 'BLOCK' }} customer={customer()} isSubmitting onClose={vi.fn()} onSubmit={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: /Close/ })).toBeDisabled()
  })
})
