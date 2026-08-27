import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../../services/apiClient'
import { reelService } from './reel.service'

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
