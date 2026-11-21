import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  cardForceLocked,
  entitlementLabel,
  entitlementViewFromResponse,
  paidCardPlan,
} from "./entitlementView.ts";

describe("entitlement view", () => {
  it("keeps loading, errors, and none distinct from Basic", () => {
    assert.equal(entitlementLabel({ status: "loading" }), "Loading");
    assert.equal(entitlementLabel({ status: "error" }), "Unavailable");
    assert.equal(entitlementLabel({ status: "ready", plan: "none" }), "No plan");
    assert.equal(entitlementLabel({ status: "ready", plan: "basic" }), "Basic");
    assert.equal(paidCardPlan({ status: "loading" }), null);
    assert.equal(paidCardPlan({ status: "error" }), null);
    assert.equal(paidCardPlan({ status: "ready", plan: "none" }), null);
    assert.equal(paidCardPlan({ status: "ready", plan: "pro" }), "pro");
    assert.equal(cardForceLocked({ status: "ready", plan: "none" }, false), true);
    assert.equal(cardForceLocked({ status: "error" }, false), true);
    assert.equal(cardForceLocked({ status: "ready", plan: "none" }, true), false);
    assert.equal(cardForceLocked({ status: "ready", plan: "elite" }, false), false);
    assert.deepEqual(entitlementViewFromResponse(500, { error: "ENTITLEMENT_READ_FAILED" }), { status: "error" });
    assert.deepEqual(entitlementViewFromResponse(401, { error: "UNAUTHORIZED" }), { status: "error" });
    assert.deepEqual(entitlementViewFromResponse(200, { plan: "none" }), { status: "ready", plan: "none" });
    assert.deepEqual(entitlementViewFromResponse(200, { plan: "elite" }), { status: "ready", plan: "elite" });
  });

  it("does not let the dashboard query choose Basic", () => {
    const page = readFileSync("app/login/dashboard/page.tsx", "utf8");
    const weekly = readFileSync("app/api/dashboard/weekly-focus/route.ts", "utf8");
    const daily = readFileSync("app/api/dashboard/daily-post-delivery/route.ts", "utf8");
    assert.match(page, /useEntitlementView/);
    assert.doesNotMatch(page, /planFromUrl/);
    assert.doesNotMatch(page, /searchParams\.plan/);
    assert.match(page, /title="Settings"/);
    assert.match(page, /title="Support"/);
    assert.match(page, /title="Payments & Integrations"/);
    assert.match(page, /forceLocked=\{false\}[\s\S]{0,160}title="Social Accounts"/);
    assert.match(weekly, /readDashboardPlan/);
    assert.doesNotMatch(weekly, /searchParams\.get\("plan"\)/);
    assert.match(daily, /readDashboardPlan/);
    assert.doesNotMatch(daily, /searchParams\.get\("plan"\)/);
    assert.doesNotMatch(daily, /body\?\.plan/);
  });
});
