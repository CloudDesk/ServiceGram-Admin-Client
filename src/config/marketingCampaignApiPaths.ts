export const MARKETING_CAMPAIGNS_PATH = '/admin/marketing-campaigns'

export const MARKETING_CAMPAIGN_DETAIL_PATH = (campaignId: string) =>
  `${MARKETING_CAMPAIGNS_PATH}/${campaignId}`

export const MARKETING_CAMPAIGN_PUBLISH_PATH = (campaignId: string) =>
  `${MARKETING_CAMPAIGNS_PATH}/${campaignId}/publish`

export const MARKETING_CAMPAIGN_PAUSE_PATH = (campaignId: string) =>
  `${MARKETING_CAMPAIGNS_PATH}/${campaignId}/pause`

export const MARKETING_CAMPAIGN_ARCHIVE_PATH = (campaignId: string) =>
  `${MARKETING_CAMPAIGNS_PATH}/${campaignId}/archive`

export const MARKETING_CAMPAIGN_IMAGE_UPLOAD_INTENT_PATH = (
  campaignId: string,
) => `${MARKETING_CAMPAIGNS_PATH}/${campaignId}/image-upload-intent`

export const MARKETING_CAMPAIGN_IMAGE_CONFIRM_UPLOAD_PATH = (
  campaignId: string,
) => `${MARKETING_CAMPAIGNS_PATH}/${campaignId}/image-confirm-upload`
