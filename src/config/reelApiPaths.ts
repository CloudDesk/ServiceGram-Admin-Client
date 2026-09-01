export const REEL_PENDING_LIST_PATH = '/admin/reels/pending'
export const REEL_LIVE_LIST_PATH = '/admin/reels/live'
export const REEL_VENDOR_LIST_PATH = (vendorId: string) =>
  `/admin/vendors/${vendorId}/reels`
export const REEL_DETAIL_PATH = (reelId: string) => `/admin/reels/${reelId}`
export const REEL_APPROVE_PATH = (reelId: string) =>
  `/admin/reels/${reelId}/approve`
export const REEL_REJECT_PATH = (reelId: string) =>
  `/admin/reels/${reelId}/reject`
export const REEL_REQUEST_EDIT_PATH = (reelId: string) =>
  `/admin/reels/${reelId}/request-edit`
export const REEL_PAUSE_PATH = (reelId: string) =>
  `/admin/reels/${reelId}/pause`
export const REEL_REMOVE_PATH = (reelId: string) =>
  `/admin/reels/${reelId}/remove`
export const REEL_DELETE_PATH = (reelId: string) => `/admin/reels/${reelId}`
export const REEL_COMMENTS_PATH = '/admin/reel-comments'
export const REEL_COMMENT_MODERATION_PATH = (commentId: string) =>
  `/admin/reel-comments/${encodeURIComponent(commentId)}/moderation`

export const HASHTAG_MODERATION_LIST_PATH = '/admin/social-moderation/hashtags'
export const HASHTAG_MODERATION_ACTION_PATH = (hashtagId: string) =>
  `/admin/social-moderation/hashtags/${encodeURIComponent(hashtagId)}/moderation`
