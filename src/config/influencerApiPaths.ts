export const INFLUENCER_LIST_PATH = '/admin/influencers'
export const INFLUENCER_DETAIL_PATH = (profileId: string) =>
  `/admin/influencers/${profileId}`
export const INFLUENCER_APPROVE_PATH = (profileId: string) =>
  `/admin/influencers/${profileId}/approve`
export const INFLUENCER_REJECT_PATH = (profileId: string) =>
  `/admin/influencers/${profileId}/reject`
export const INFLUENCER_SUSPEND_PATH = (profileId: string) =>
  `/admin/influencers/${profileId}/suspend`
export const INFLUENCER_REACTIVATE_PATH = (profileId: string) =>
  `/admin/influencers/${profileId}/reactivate`
