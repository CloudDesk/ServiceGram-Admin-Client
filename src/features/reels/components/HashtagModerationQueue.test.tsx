import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { ReelServiceError, reelService } from '../services/reel.service'
import type { AdminHashtag, AdminHashtagsListResponse } from '../types/reel.types'
import { HashtagModerationQueue } from './HashtagModerationQueue'

/**
 * The hashtag moderation queue.
 *
 * Blocking a tag removes it from discovery for every customer, so the things
 * worth gating are the ones that would make that decision wrong: acting
 * without a reason, being shown an action the tag cannot take, and being told
 * "failed" when the real problem is a stale session or someone else's edit.
 */

function hashtag(overrides: Partial<AdminHashtag> = {}): AdminHashtag {
  return {
    hashtagId: '11111111-1111-4111-8111-111111111111',
    tag: 'laundryday',
    displayTag: 'LaundryDay',
    status: 'SUSPICIOUS',
    moderationReason: null,
    version: 2,
    visibleReelCount: 14,
    usageCount7d: 9,
    usageCount30d: 40,
    lastUsedAt: '2026-08-30T06:00:00.000Z',
    aggregateRefreshedAt: '2026-08-31T06:00:00.000Z',
    availableActions: ['MARK_SUSPICIOUS', 'BLOCK'],
    ...overrides,
  }
}

function listResponse(rows: AdminHashtag[]): AdminHashtagsListResponse {
  return {
    data: rows,
    pagination: {
      page: 1,
      limit: 20,
      totalItems: rows.length,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
    summary: {
      totalItems: rows.length,
      active: 3,
      suspicious: rows.length,
      blocked: 1,
    },
  }
}

const getHashtags = vi.spyOn(reelService, 'getHashtags')
const moderateHashtag = vi.spyOn(reelService, 'moderateHashtag')

beforeEach(() => {
  getHashtags.mockReset()
  moderateHashtag.mockReset()
  getHashtags.mockResolvedValue(listResponse([hashtag()]))
  moderateHashtag.mockResolvedValue(hashtag({ status: 'BLOCKED', version: 3 }))
})

async function openQueue() {
  const user = userEvent.setup()
  renderWithProviders(<HashtagModerationQueue canModerate />)
  await user.click(screen.getByRole('button', { name: /open hashtag moderation/i }))
  await screen.findByRole('dialog')
  return user
}

describe('HashtagModerationQueue', () => {
  it('shows the tag with the usage a moderator decides on', async () => {
    await openQueue()

    expect(await screen.findByText('#LaundryDay')).toBeInTheDocument()
    expect(screen.getByText(/14 visible reels/)).toBeInTheDocument()
    expect(screen.getByText(/9 uses in 7 days/)).toBeInTheDocument()
  })

  it('offers only the actions the backend says are available', async () => {
    getHashtags.mockResolvedValue(
      listResponse([hashtag({ status: 'BLOCKED', availableActions: ['ALLOW'] })]),
    )
    await openQueue()

    expect(await screen.findByRole('button', { name: 'Allow' })).toBeInTheDocument()
    // Offering "Block" on an already-blocked tag would be a no-op the server
    // rejects, so the card must not invent it.
    expect(screen.queryByRole('button', { name: 'Block' })).not.toBeInTheDocument()
  })

  it('refuses to submit a decision without a reason', async () => {
    const user = await openQueue()
    await user.click(await screen.findByRole('button', { name: 'Block' }))
    await user.click(screen.getByRole('button', { name: /^block hashtag$/i }))

    expect(await screen.findByText(/at least 3 characters/i)).toBeInTheDocument()
    expect(moderateHashtag).not.toHaveBeenCalled()
  })

  it('sends the reason and the version it was shown', async () => {
    const user = await openQueue()
    await user.click(await screen.findByRole('button', { name: 'Block' }))
    await user.type(screen.getByLabelText(/audit reason/i), 'Coordinated spam ring')
    await user.click(screen.getByRole('button', { name: /^block hashtag$/i }))

    await waitFor(() => {
      expect(moderateHashtag).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111111',
        { action: 'BLOCK', expectedVersion: 2, reason: 'Coordinated spam ring' },
      )
    })
  })

  it('warns that blocking removes the tag from discovery', async () => {
    const user = await openQueue()
    await user.click(await screen.findByRole('button', { name: 'Block' }))

    expect(
      await screen.findByText(/removes this tag from search and discovery/i),
    ).toBeInTheDocument()
  })

  it('tells a moderator to sign in again rather than just "failed"', async () => {
    moderateHashtag.mockRejectedValue(
      new ReelServiceError('Recent authentication required.', 'AUTH_REAUTH_REQUIRED', 401),
    )
    const user = await openQueue()
    await user.click(await screen.findByRole('button', { name: 'Block' }))
    await user.type(screen.getByLabelText(/audit reason/i), 'Coordinated spam ring')
    await user.click(screen.getByRole('button', { name: /^block hashtag$/i }))

    expect(await screen.findByText(/sign in again/i)).toBeInTheDocument()
  })

  it('explains a version conflict as someone else having acted', async () => {
    moderateHashtag.mockRejectedValue(
      new ReelServiceError('Conflict', 'REEL_HASHTAG_VERSION_CONFLICT', 409),
    )
    const user = await openQueue()
    await user.click(await screen.findByRole('button', { name: 'Block' }))
    await user.type(screen.getByLabelText(/audit reason/i), 'Coordinated spam ring')
    await user.click(screen.getByRole('button', { name: /^block hashtag$/i }))

    expect(
      await screen.findByText(/someone else moderated this tag/i),
    ).toBeInTheDocument()
  })

  it('hides the actions from a read-only moderator', async () => {
    const user = userEvent.setup()
    renderWithProviders(<HashtagModerationQueue canModerate={false} />)
    await user.click(screen.getByRole('button', { name: /open hashtag moderation/i }))

    expect(await screen.findByText('#LaundryDay')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Block' })).not.toBeInTheDocument()
  })
})
