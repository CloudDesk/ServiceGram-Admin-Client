import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../../services/apiClient'
import { ReelServiceError, reelService } from './reel.service'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const requestSpy = vi.spyOn(apiClient, 'request')

beforeEach(() => {
  requestSpy.mockReset()
  requestSpy.mockResolvedValue(
    jsonResponse({
      data: [],
      pagination: {
        page: 1,
        limit: 20,
        totalItems: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
      summary: {
        totalItems: 0,
        keywordFiltered: 0,
        reported: 0,
        hidden: 0,
        removed: 0,
      },
    }),
  )
})

describe('reel comment moderation service', () => {
  it('maps exact queue filters to the Release 2 comment endpoint', async () => {
    await reelService.getReelComments({
      page: 2,
      limit: 20,
      search: 'laundry',
      status: 'REPORTED',
    })

    expect(requestSpy).toHaveBeenCalledWith(
      'http://localhost:4000/api/v1/admin/reel-comments?page=2&limit=20&search=laundry&status=REPORTED',
    )
  })

  it('sends the action, optimistic version, and audit reason', async () => {
    requestSpy.mockResolvedValueOnce(jsonResponse({ data: {} }))

    await reelService.moderateReelComment('comment/id', {
      action: 'HIDE',
      expectedVersion: 4,
      reason: 'Contains targeted harassment.',
    })

    const call = requestSpy.mock.calls.at(-1)
    expect(call?.[0]).toBe(
      'http://localhost:4000/api/v1/admin/reel-comments/comment%2Fid/moderation',
    )
    expect(call?.[1]?.method).toBe('PATCH')
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      action: 'HIDE',
      expectedVersion: 4,
      reason: 'Contains targeted harassment.',
    })
  })
})

describe('hashtag moderation service', () => {
  it('maps queue filters to the social moderation endpoint', async () => {
    requestSpy.mockResolvedValueOnce(
      jsonResponse({
        data: [],
        pagination: {
          page: 2,
          limit: 20,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        summary: { totalItems: 0, active: 0, suspicious: 0, blocked: 0 },
      }),
    )

    await reelService.getHashtags({
      page: 2,
      limit: 20,
      search: 'laundry',
      status: 'SUSPICIOUS',
    })

    const url = String(requestSpy.mock.calls[0]?.[0])
    expect(url).toContain('/admin/social-moderation/hashtags')
    expect(url).toContain('page=2')
    expect(url).toContain('search=laundry')
    expect(url).toContain('status=SUSPICIOUS')
  })

  it('sends the action, expected version and reason when moderating', async () => {
    requestSpy.mockResolvedValueOnce(
      jsonResponse({
        code: 'ADMIN_REEL_HASHTAG_MODERATED',
        message: 'ok',
        data: { hashtagId: 'h1', displayTag: 'Laundry', status: 'BLOCKED', version: 3 },
      }),
    )

    const result = await reelService.moderateHashtag('h1', {
      action: 'BLOCK',
      expectedVersion: 2,
      reason: 'Spam ring',
    })

    const [url, init] = requestSpy.mock.calls[0] ?? []
    expect(String(url)).toContain('/admin/social-moderation/hashtags/h1/moderation')
    expect((init as RequestInit).method).toBe('PATCH')
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      action: 'BLOCK',
      expectedVersion: 2,
      reason: 'Spam ring',
    })
    // The envelope is unwrapped so callers get the hashtag, not { data }.
    expect(result.status).toBe('BLOCKED')
  })

  it('surfaces the server message when a version conflict is rejected', async () => {
    requestSpy.mockResolvedValueOnce(
      jsonResponse({ message: 'This hashtag was changed by someone else.' }, 409),
    )

    await expect(
      reelService.moderateHashtag('h1', {
        action: 'BLOCK',
        expectedVersion: 1,
        reason: 'Spam ring',
      }),
    ).rejects.toThrow('This hashtag was changed by someone else.')
  })
})

describe('reel service errors', () => {
  it('keeps the backend code so callers can tell failures apart', async () => {
    requestSpy.mockResolvedValueOnce(
      jsonResponse(
        { code: 'AUTH_REAUTH_REQUIRED', message: 'Recent authentication required.' },
        401,
      ),
    )

    // The message alone cannot distinguish a stale session from a version
    // conflict, and those need different instructions to the moderator.
    const error = await reelService
      .moderateHashtag('h1', { action: 'BLOCK', expectedVersion: 1, reason: 'Spam' })
      .catch((thrown: unknown) => thrown)

    expect(error).toBeInstanceOf(ReelServiceError)
    expect((error as ReelServiceError).code).toBe('AUTH_REAUTH_REQUIRED')
    expect((error as ReelServiceError).status).toBe(401)
  })

  it('falls back to a null code when the body carries none', async () => {
    requestSpy.mockResolvedValueOnce(jsonResponse({ message: 'Boom' }, 500))

    const error = await reelService
      .getHashtags()
      .catch((thrown: unknown) => thrown)

    expect((error as ReelServiceError).code).toBeNull()
    expect((error as Error).message).toBe('Boom')
  })
})

