import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../../../services/apiClient";
import { influencerBonusService } from "./influencerBonus.service";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

const requestSpy = vi.spyOn(apiClient, "request");

beforeEach(() => {
  requestSpy.mockReset();
  requestSpy.mockResolvedValue(jsonResponse({ data: [], pagination: {} }));
});

describe("influencerBonusService request mapping", () => {
  it("maps rule and award list filters to backend admin endpoints", async () => {
    await influencerBonusService.listRules({
      page: 2,
      limit: 50,
      search: "monthly",
      status: ["ACTIVE", "PAUSED"],
      ruleType: "VIEW_MILESTONE",
    });

    expect(requestSpy).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/admin/influencer-bonus-rules?page=2&limit=50&search=monthly&status=ACTIVE%2CPAUSED&ruleType=VIEW_MILESTONE",
    );

    await influencerBonusService.listAwards({
      page: 1,
      limit: 25,
      status: "PENDING_REVIEW",
      ruleId: "rule-1",
    });

    expect(requestSpy).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/admin/influencer-bonus-awards?page=1&limit=25&status=PENDING_REVIEW&ruleId=rule-1",
    );
  });

  it("maps versioned rule actions and award review payloads", async () => {
    requestSpy.mockResolvedValue(jsonResponse({ data: {} }));

    await influencerBonusService.pauseRule("rule-1", {
      expectedVersion: 3,
      reason: "Temporarily pausing for audit.",
    });

    expect(requestSpy).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/admin/influencer-bonus-rules/rule-1/pause",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: 3,
          reason: "Temporarily pausing for audit.",
        }),
      },
    );

    await influencerBonusService.reviewAward("award-1", {
      decision: "APPROVED",
      expectedVersion: 4,
      reason: "Metric proof matched the rule.",
    });

    expect(requestSpy).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/admin/influencer-bonus-awards/award-1/review",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: "APPROVED",
          expectedVersion: 4,
          reason: "Metric proof matched the rule.",
        }),
      },
    );
  });
});
