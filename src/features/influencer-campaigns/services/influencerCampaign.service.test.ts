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
