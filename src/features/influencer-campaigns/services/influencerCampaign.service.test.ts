import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../../../services/apiClient";
import { influencerCampaignService } from "./influencerCampaign.service";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

const requestSpy = vi.spyOn(apiClient, "request");

beforeEach(() => {
  requestSpy.mockReset();
  requestSpy.mockResolvedValue(jsonResponse({ data: {} }));
});

describe("influencerCampaignService performance request mapping", () => {
  it("maps campaign performance reads to the analytics endpoint", async () => {
    await influencerCampaignService.performance("campaign-1", "90D");

    expect(requestSpy).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/admin/influencer-campaigns/campaign-1/performance?period=90D&timezone=Asia%2FKolkata&topLimit=5",
    );
  });

  it("requests a refreshed snapshot when the admin asks for one", async () => {
    await influencerCampaignService.performance("campaign-1", "30D", true);

    expect(requestSpy).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/admin/influencer-campaigns/campaign-1/performance?period=30D&refresh=true&timezone=Asia%2FKolkata&topLimit=5",
    );
  });
});

describe("influencerCampaignService campaign update mapping", () => {
  it("includes the campaign version in update requests", async () => {
    await influencerCampaignService.update("campaign-1", {
      campaignCode: "creator-campaign",
      title: "Creator campaign",
      summary: "Campaign summary",
      brief: "A campaign brief long enough to be valid.",
      objective: "AWARENESS",
      startsAt: null,
      endsAt: null,
      submissionDeadlineAt: null,
      maxParticipants: 10,
      budgetPaise: 100000,
      currency: "INR",
      rewardSummary: "Winner receives a cash reward.",
      rewards: [
        {
          rewardType: "CASH",
          title: "Winner reward",
          amountPaise: 100000,
          metadata: {},
        },
      ],
      contentRequirements: {},
      eligibilitySummary: "Approved influencers only.",
      eligibilityRules: [
        {
          ruleType: "APPROVED_INFLUENCER",
          value: {},
          isRequired: true,
          displayOrder: 1,
        },
      ],
      visibilityRules: {},
      metadata: {},
      reason: "Update campaign details.",
      expectedVersion: 4,
    });

    expect(requestSpy).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/admin/influencer-campaigns/campaign-1",
      expect.objectContaining({
        body: expect.stringContaining('"expectedVersion":4'),
        method: "PUT",
      }),
    );
  });
});

describe("influencerCampaignService reward award request mapping", () => {
  it("maps reward award queue filters to the admin endpoint", async () => {
    await influencerCampaignService.listRewardAwards({
      campaignId: "campaign-1",
      influencerProfileId: "influencer-1",
      rewardType: "CASH",
      status: "PENDING_REVIEW",
    });

    expect(requestSpy).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/admin/influencer-campaign-reward-awards?page=1&limit=50&campaignId=campaign-1&influencerProfileId=influencer-1&status=PENDING_REVIEW&rewardType=CASH",
    );
  });

  it("maps reward award review actions with expected version", async () => {
    await influencerCampaignService.reviewRewardAward("award-1", {
      decision: "APPROVED",
      expectedVersion: 2,
      reason: "Winner validated.",
    });

    expect(requestSpy).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/admin/influencer-campaign-reward-awards/award-1/review",
      {
        body: JSON.stringify({
          decision: "APPROVED",
          expectedVersion: 2,
          reason: "Winner validated.",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );
  });
});
