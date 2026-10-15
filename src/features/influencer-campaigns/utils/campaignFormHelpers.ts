import type { InfluencerCampaignRewardType } from "../types/influencerCampaign.types";

export const inputClass =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/30";

export const rewardTypes: ("ALL" | InfluencerCampaignRewardType)[] = [
  "ALL",
  "CASH",
  "COMMISSION_BOOST",
  "BADGE",
  "FEATURED_PLACEMENT",
];

export function humanize(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
