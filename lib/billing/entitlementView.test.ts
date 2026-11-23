import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  cardForceLocked,
  effectiveCardPlan,
  entitlementLabel,
  entitlementViewFromResponse,
  isCurrentPaidPlan,
  paidStatusLabel,
  testStatusLabel,
} from "./entitlementView.ts";

function ready(
  paidPlan: "none" | "basic" | "pro" | "elite",
  testPlan: "none" | "basic" | "pro" | "elite" = "none",
  effectivePlan: "none" | "basic" | "pro" | "elite" = paidPlan
) {
  return { status: "ready" as const, paidPlan, testPlan, effectivePlan, testExpiresAt: null };
}

describe("entitlement view", () => {
  it("keeps loading, errors, and unpaid access distinct from a paid Basic plan", () => {
    assert.equal(entitlementLabel({ status: "loading" }), "Loading");
    assert.equal(entitlementLabel({ status: "error" }), "Unavailable");
    assert.equal(entitlementLabel(ready("none")), "No plan");
    assert.equal(entitlementLabel(ready("basic")), "Basic");
    assert.equal(entitlementLabel(ready("none", "elite", "elite")), "No paid plan · Elite test");
    assert.equal(paidStatusLabel("none"), "No paid plan");
    assert.equal(testStatusLabel("elite"), "Elite test");
    assert.equal(effectiveCardPlan({ status: "loading" }), null);
    assert.equal(effectiveCardPlan({ status: "error" }), null);
    assert.equal(effectiveCardPlan(ready("none")), null);
    assert.equal(effectiveCardPlan(ready("none", "pro", "pro")), "pro");
    assert.equal(cardForceLocked(ready("none"), false), true);
    assert.equal(cardForceLocked({ status: "error" }, false), true);
    assert.equal(cardForceLocked(ready("none"), true), false);
    assert.equal(cardForceLocked(ready("none", "elite", "elite"), false), false);
    assert.deepEqual(entitlementViewFromResponse(500, { error: "ENTITLEMENT_READ_FAILED" }), { status: "error" });
    assert.deepEqual(entitlementViewFromResponse(401, { error: "UNAUTHORIZED" }), { status: "error" });
    assert.deepEqual(entitlementViewFromResponse(200, { plan: "none" }), { status: "error" });
    assert.deepEqual(entitlementViewFromResponse(200, ready("none")), ready("none"));
    assert.deepEqual(
      entitlementViewFromResponse(200, { paidPlan: "none", testPlan: "elite", effectivePlan: "elite", testExpiresAt: null }),
      { status: "ready", paidPlan: "none", testPlan: "elite", effectivePlan: "elite", testExpiresAt: null }
    );
  });

  it("does not let the dashboard query choose Basic", () => {
    const page = readFileSync("app/login/dashboard/page.tsx", "utf8");
    const weekly = readFileSync("app/api/dashboard/weekly-focus/route.ts", "utf8");
    const daily = readFileSync("app/api/dashboard/daily-post-delivery/route.ts", "utf8");
    const pricing = readFileSync("app/login/dashboard/pricing/page.tsx", "utf8");
    const email = readFileSync("app/login/dashboard/settings/email/page.tsx", "utf8");
    assert.match(page, /useEntitlementView/);
    assert.match(page, /effectiveCardPlan/);
    assert.doesNotMatch(page, /planFromUrl/);
    assert.doesNotMatch(page, /searchParams\.plan/);
    assert.match(page, /title="Settings"/);
    assert.match(page, /title="Support"/);
    assert.match(page, /title="Payments & Integrations"/);
    assert.match(page, /forceLocked=\{false\}[\s\S]{0,160}title="Social Accounts"/);
    assert.match(weekly, /effectivePlan/);
    assert.match(weekly, /private, no-store/);
    assert.doesNotMatch(weekly, /searchParams\.get\("plan"\)/);
    assert.match(daily, /effectivePlan/);
    assert.match(daily, /private, no-store/);
    assert.doesNotMatch(daily, /body\?\.plan/);
    assert.match(pricing, /isCurrentPaidPlan\(entitlement, plan\.name\)/);
    assert.match(pricing, /This is not a paid subscription/);
    assert.doesNotMatch(email, /Active Plan:/);
  });

  it("marks Current plan only for the verified paid plan", () => {
    const plans = ["Basic", "Pro", "Elite"];
    const eliteTest = {
      status: "ready" as const,
      paidPlan: "none" as const,
      testPlan: "elite" as const,
      effectivePlan: "elite" as const,
      testExpiresAt: null,
    };
    assert.deepEqual(
      plans.filter((name) => isCurrentPaidPlan(eliteTest, name)),
      []
    );
    const paidBasic = { ...eliteTest, paidPlan: "basic" as const };
    assert.deepEqual(
      plans.filter((name) => isCurrentPaidPlan(paidBasic, name)),
      ["Basic"]
    );
    const page = readFileSync("app/login/dashboard/pricing/page.tsx", "utf8");
    assert.match(page, /isCurrentPaidPlan\(entitlement, plan\.name\)/);
  });
});
