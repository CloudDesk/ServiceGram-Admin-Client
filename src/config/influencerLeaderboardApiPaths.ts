export const INFLUENCER_LEADERBOARD_LIST_PATH =
  "/admin/influencer-leaderboards";
export const INFLUENCER_REPUTATION_LIST_PATH = "/admin/influencer-reputation";
export const INFLUENCER_BADGE_LIST_PATH = "/admin/influencer-badges";
export const INFLUENCER_BADGE_AWARD_REVOKE_PATH = (awardId: string) =>
  `/admin/influencer-badge-awards/${awardId}/revoke`;
export const INFLUENCER_LEADERBOARD_VISIBILITY_PATH = (rankingId: string) =>
  `/admin/influencer-leaderboards/${rankingId}/visibility`;
export const INFLUENCER_REPUTATION_BADGE_AWARD_PATH = (
  influencerProfileId: string,
) => `/admin/influencer-reputation/${influencerProfileId}/badges`;
export const INFLUENCER_REPUTATION_REVIEW_PATH = (
  influencerProfileId: string,
) => `/admin/influencer-reputation/${influencerProfileId}/review`;
