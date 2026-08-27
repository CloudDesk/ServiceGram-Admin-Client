import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../../../services/apiClient";
import {
  customerRetentionService,
  CustomerRetentionServiceError,
} from "./customerRetention.service";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const requestSpy = vi.spyOn(apiClient, "request");

beforeEach(() => {
  requestSpy.mockReset();
  requestSpy.mockResolvedValue(jsonResponse({ data: {} }));
});

describe("customerRetentionService request mapping", () => {
  it("maps privacy queue filters to the cross-customer endpoint", async () => {
    await customerRetentionService.listPrivacyExports({
      page: 2,
      limit: 25,
      status: "FAILED",
    });

    expect(requestSpy).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/admin/privacy/export-requests?page=2&limit=25&status=FAILED",
      undefined,
    );
  });

  it("maps a wallet adjustment to an audited customer endpoint", async () => {
    await customerRetentionService.adjustWallet("customer/id", {
      direction: "CREDIT",
      amountPaise: 5000,
      reason: "Correct failed referral credit.",
    });

    const call = requestSpy.mock.calls.at(-1);
    expect(call?.[0]).toBe(
      "http://localhost:4000/api/v1/admin/customers/customer%2Fid/wallet/adjustments",
    );
    expect(call?.[1]?.method).toBe("POST");
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      direction: "CREDIT",
      amountPaise: 5000,
      reason: "Correct failed referral credit.",
    });
  });

  it("uses the dedicated status lifecycle endpoint for promos", async () => {
    await customerRetentionService.changePromoStatus("promo/id", {
      status: "PAUSED",
      reason: "Pause while abuse activity is reviewed.",
    });

    const call = requestSpy.mock.calls.at(-1);
    expect(call?.[0]).toBe(
      "http://localhost:4000/api/v1/admin/promo-codes/promo%2Fid/status",
    );
    expect(call?.[1]?.method).toBe("POST");
  });

  it("maps exact vendor-offer risk filters to the admin endpoint", async () => {
    await customerRetentionService.listVendorOffers({
      limit: 100,
      status: "ACTIVE",
      search: "weekend",
      riskOnly: true,
    });

    expect(requestSpy).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/admin/vendor-offers?limit=100&status=ACTIVE&search=weekend&riskOnly=true",
      undefined,
    );
  });

  it("sends optimistic version and reason when restricting a vendor offer", async () => {
    await customerRetentionService.updateVendorOfferRestriction("offer/id", {
      action: "RESTRICT",
      expectedVersion: 4,
      reason: "Discount exceeds the approved support exception.",
    });

    const call = requestSpy.mock.calls.at(-1);
    expect(call?.[0]).toBe(
      "http://localhost:4000/api/v1/admin/vendor-offers/offer%2Fid/restriction",
    );
    expect(call?.[1]?.method).toBe("POST");
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      action: "RESTRICT",
      expectedVersion: 4,
      reason: "Discount exceeds the approved support exception.",
    });
  });

  it("surfaces backend field errors for operator guidance", async () => {
    requestSpy.mockResolvedValueOnce(
      jsonResponse(
        {
          code: "VALIDATION_FAILED",
          message: "Request validation failed.",
          details: {
            fieldErrors: [
              { field: "reason", message: "Reason must be specific." },
            ],
          },
        },
        400,
      ),
    );

    const error = await customerRetentionService
      .deletePromoCode("promo-id", "short")
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(CustomerRetentionServiceError);
    expect(error).toMatchObject({
      code: "VALIDATION_FAILED",
      message: "Reason must be specific.",
      status: 400,
    });
  });
});
