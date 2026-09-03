import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");

function source(path: string) {
  return readFileSync(resolve(root, path), "utf8");
}

describe("Influencer payouts admin route guardrail", () => {
  it("keeps the Release 2 route, sidebar item and permission wired together", () => {
    expect(source("config/routes.ts")).toContain(
      'influencerPayouts: "/app/release-2/influencer-payouts"',
    );
    expect(source("config/permissions.ts")).toContain(
      'influencerPayouts: "payouts:read"',
    );
    expect(source("config/routePermissions.ts")).toContain(
      'influencerPayouts: "payouts:read"',
    );

    const navigation = source("config/navigation.ts");
    expect(navigation).toContain('label: "Influencer Payouts"');
    expect(navigation).toContain("href: routePaths.influencerPayouts");
    expect(navigation).toContain("permission: permissions.influencerPayouts");
    expect(navigation).toContain('group: "release2"');

    const routes = source("routes/routeConfig.tsx");
    expect(routes).toContain("import { InfluencerPayoutsPage }");
    expect(routes).toContain("permission={routePermissions.influencerPayouts}");
    expect(routes).toContain("path: routePaths.influencerPayouts");
    expect(routes).toContain("element: <InfluencerPayoutsPage />");
  });

  it("keeps the one-page payout workspace aligned to backend-defined queues", () => {
    const page = source(
      "features/influencer-payouts/components/InfluencerPayoutsPage.tsx",
    );

    expect(page).toContain("Bank reviews");
    expect(page).toContain("KYC reviews");
    expect(page).toContain("Payout queue");
    expect(page).toContain("influencerPayoutService.listBankAccounts");
    expect(page).toContain("influencerPayoutService.listKycChecks");
    expect(page).toContain("influencerPayoutService.listPayouts");
    expect(page).toContain("bankQuery.data?.summary");
    expect(page).toContain("kycQuery.data?.summary");
    expect(page).toContain("payoutQuery.data?.summary");
    expect(page).toContain("queueTabs(bankQueues, bankSummary)");
    expect(page).toContain("queueTabs(kycQueues, kycSummary)");
    expect(page).toContain("queueTabs(payoutQueues, payoutSummary)");
    expect(page).toContain("expectedVersion");
    expect(page).toContain("reason: values.reason");
  });
});
