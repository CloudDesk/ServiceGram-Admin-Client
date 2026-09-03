import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../../../services/apiClient";
import { influencerPayoutService } from "./influencerPayout.service";

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

describe("influencerPayoutService request mapping", () => {
  it("maps review queue reads to the backend admin endpoints", async () => {
    await influencerPayoutService.listBankAccounts({
      page: 2,
      limit: 25,
      status: ["PENDING_VERIFICATION"],
      search: "creator",
    });

    expect(requestSpy).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/admin/influencer-bank-accounts?page=2&limit=25&status=PENDING_VERIFICATION&search=creator",
    );

    await influencerPayoutService.listKycChecks({
      checkType: ["PAN"],
      status: ["PENDING_REVIEW"],
    });

    expect(requestSpy).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/admin/influencer-kyc-checks?checkType=PAN&status=PENDING_REVIEW",
    );
  });

  it("maps bank, kyc and payout actions with versioned reason payloads", async () => {
    requestSpy.mockResolvedValue(jsonResponse({ data: {} }));

    await influencerPayoutService.reviewBankAccount("bank-1", {
      decision: "VERIFIED",
      expectedVersion: 3,
      reason: "Bank proof matched.",
    });

    expect(requestSpy).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/admin/influencer-bank-accounts/bank-1/review",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: "VERIFIED",
          expectedVersion: 3,
          reason: "Bank proof matched.",
        }),
      },
    );

    await influencerPayoutService.reviewKycCheck("kyc-1", {
      decision: "REJECTED",
      expectedVersion: 4,
      reason: "Document is unreadable.",
    });

    expect(requestSpy).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/admin/influencer-kyc-checks/kyc-1/review",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: "REJECTED",
          expectedVersion: 4,
          reason: "Document is unreadable.",
        }),
      },
    );

    await influencerPayoutService.markPayoutPaid("payout-1", {
      expectedVersion: 5,
      reason: "Manual transfer completed.",
      utrReference: "UTR12345",
    });

    expect(requestSpy).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/admin/influencer-payouts/payout-1/mark-paid",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: 5,
          reason: "Manual transfer completed.",
          utrReference: "UTR12345",
        }),
      },
    );
  });

  it("maps payout batch creation and payout queue filters", async () => {
    await influencerPayoutService.createPayoutBatch({
      batchKey: "influencer-2026-09-03",
      dryRun: true,
      limit: 100,
    });

    expect(requestSpy).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/admin/influencer-payouts/batches",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchKey: "influencer-2026-09-03",
          dryRun: true,
          limit: 100,
        }),
      },
    );

    await influencerPayoutService.listPayouts({
      page: 1,
      limit: 50,
      status: ["APPROVED", "HELD"],
    });

    expect(requestSpy).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/admin/influencer-payouts?page=1&limit=50&status=APPROVED%2CHELD",
    );
  });
});
