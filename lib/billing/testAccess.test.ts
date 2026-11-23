import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { handleEntitlementGet } from "./entitlementGet";
import { loadTestAccess } from "./loadTestAccess";
import type { SubscriptionReadClient } from "./loadPaidSubscription";
import {
  cardForceLocked,
  effectiveCardPlan,
  entitlementLabel,
  entitlementViewFromResponse,
  paidStatusLabel,
  testStatusLabel,
} from "./entitlementView";
import { accessAllows, effectivePlan, readActiveTest, type TestAccessSnapshot } from "./testAccess";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-11-22T22:00:00.000Z");
const EXACT = NOW.toISOString();
const PLUS_ONE = new Date(NOW.getTime() + 1).toISOString();
const FUTURE = "2026-12-01T00:00:00.000Z";

function grant(overrides: Partial<TestAccessSnapshot> = {}): TestAccessSnapshot {
  return {
    user_id: USER_A,
    test_plan: "elite",
    expires_at: null,
    revoked_at: null,
    ...overrides,
  };
}

function ready(paid: "none" | "basic" | "pro" | "elite", test: "none" | "basic" | "pro" | "elite", expires: string | null = null) {
  const effective = accessAllows(test, "basic") || test !== "none"
    ? (["none", "basic", "pro", "elite"] as const)[
        Math.max(["none", "basic", "pro", "elite"].indexOf(paid), ["none", "basic", "pro", "elite"].indexOf(test))
      ]
    : paid;
  return { status: "ready" as const, paidPlan: paid, testPlan: test, effectivePlan: effective, testExpiresAt: expires };
}

describe("test access time limits", () => {
  it("treats expires_at equal to now as expired", () => {
    assert.deepEqual(readActiveTest(grant({ expires_at: EXACT }), USER_A, NOW), { plan: "none", expiresAt: null });
  });

  it("keeps expires_at one millisecond after now active", () => {
    assert.deepEqual(readActiveTest(grant({ test_plan: "basic", expires_at: PLUS_ONE }), USER_A, NOW), {
      plan: "basic",
      expiresAt: PLUS_ONE,
    });
  });

  it("treats a later now as expired", () => {
    const after = new Date(NOW.getTime() + 1);
    assert.equal(readActiveTest(grant({ expires_at: EXACT }), USER_A, after).plan, "none");
  });

  it("revokes a grant even when the end is still in the future", () => {
    assert.equal(
      readActiveTest(grant({ expires_at: FUTURE, revoked_at: EXACT }), USER_A, NOW).plan,
      "none"
    );
  });

  it("keeps an open-ended grant active and ignores another user's row", () => {
    assert.equal(readActiveTest(grant(), USER_A, NOW).plan, "elite");
    assert.equal(readActiveTest(grant(), USER_B, NOW).plan, "none");
  });
});

describe("Basic, Pro, and Elite boundaries", () => {
  it("opens only the features at or below the effective level", () => {
    for (const minimum of ["basic", "pro", "elite"] as const) {
      assert.equal(accessAllows("none", minimum), false);
    }
    assert.equal(accessAllows("basic", "basic"), true);
    assert.equal(accessAllows("basic", "pro"), false);
    assert.equal(accessAllows("basic", "elite"), false);
    assert.equal(accessAllows("pro", "basic"), true);
    assert.equal(accessAllows("pro", "pro"), true);
    assert.equal(accessAllows("pro", "elite"), false);
    assert.equal(accessAllows("elite", "basic"), true);
    assert.equal(accessAllows("elite", "pro"), true);
    assert.equal(accessAllows("elite", "elite"), true);
    assert.equal(effectivePlan("pro", "basic"), "pro");
    assert.equal(effectivePlan("basic", "elite"), "elite");
    assert.equal(effectivePlan("none", "elite"), "elite");
    assert.deepEqual(
      entitlementViewFromResponse(200, { paidPlan: "pro", testPlan: "basic", effectivePlan: "none", testExpiresAt: null }),
      { status: "error" }
    );
  });
});

describe("entitlement response consumers", () => {
  it("rejects the old plan field and labels test access separately from a paid plan", () => {
    assert.deepEqual(entitlementViewFromResponse(200, { plan: "elite" }), { status: "error" });
    const view = entitlementViewFromResponse(200, {
      paidPlan: "none",
      testPlan: "elite",
      effectivePlan: "elite",
      testExpiresAt: null,
    });
    assert.equal(view.status, "ready");
    if (view.status !== "ready") return;
    assert.equal(view.paidPlan, "none");
    assert.equal(effectiveCardPlan(view), "elite");
    assert.equal(paidStatusLabel(view.paidPlan), "No paid plan");
    assert.equal(testStatusLabel(view.testPlan), "Elite test");
    assert.equal(entitlementLabel(view), "No paid plan · Elite test");
    assert.equal(entitlementLabel(ready("basic", "none")), "Basic");
    assert.equal(entitlementLabel(ready("basic", "elite")), "Paid Basic · Elite test");
    assert.equal(cardForceLocked(ready("none", "none"), false), true);
    assert.equal(cardForceLocked(ready("none", "basic"), false), false);
  });

  it("points each consumer at paidPlan or effectivePlan", () => {
    const pricing = readFileSync("app/login/dashboard/pricing/page.tsx", "utf8");
    const email = readFileSync("app/login/dashboard/settings/email/page.tsx", "utf8");
    const contact = readFileSync("app/login/dashboard/_components/ContactManager.tsx", "utf8");
    const social = readFileSync("app/login/dashboard/social-accounts/SocialAccountsClient.tsx", "utf8");
    const page = readFileSync("app/login/dashboard/page.tsx", "utf8");
    const weekly = readFileSync("app/api/dashboard/weekly-focus/route.ts", "utf8");
    const daily = readFileSync("app/api/dashboard/daily-post-delivery/route.ts", "utf8");
    assert.match(pricing, /isCurrentPaidPlan\(entitlement, plan\.name\)/);
    assert.match(pricing, /This is not a paid subscription/);
    assert.doesNotMatch(email, /Active Plan:/);
    assert.match(email, /entitlementLabel/);
    assert.match(contact, /entitlement\.effectivePlan/);
    assert.match(contact, /entitlementLabel/);
    assert.match(social, /effectivePlan/);
    assert.match(social, /accessAllows/);
    assert.match(page, /effectiveCardPlan/);
    assert.match(weekly, /effectivePlan/);
    assert.match(weekly, /private, no-store/);
    assert.match(daily, /effectivePlan/);
    assert.match(daily, /private, no-store/);
  });
});

describe("server reads the current grant on every call", () => {
  it("returns none on the next call after revoked_at is set", async () => {
    let current = grant({ test_plan: "pro", expires_at: FUTURE });
    const deps = {
      env: { STRIPE_ACCOUNT_ID: "acct_live" },
      nodeEnv: "production",
      request: new Request("http://localhost/api/billing/entitlement"),
      now: NOW,
      resolveUserId: async () => USER_A,
      loadSubscription: async () => null,
      loadTestAccess: async () => current,
    };
    const first = await handleEntitlementGet(deps);
    assert.deepEqual(await first.json(), {
      paidPlan: "none",
      testPlan: "pro",
      effectivePlan: "pro",
      testExpiresAt: FUTURE,
    });
    current = grant({ test_plan: "pro", expires_at: FUTURE, revoked_at: EXACT });
    const second = await handleEntitlementGet(deps);
    assert.deepEqual(await second.json(), {
      paidPlan: "none",
      testPlan: "none",
      effectivePlan: "none",
      testExpiresAt: null,
    });
  });

  it("does not read test access when the production account is missing", async () => {
    let reads = 0;
    const response = await handleEntitlementGet({
      env: {},
      nodeEnv: "production",
      request: new Request("http://localhost/api/billing/entitlement"),
      resolveUserId: async () => USER_A,
      loadSubscription: async () => {
        reads += 1;
        return null;
      },
      loadTestAccess: async () => {
        reads += 1;
        return grant();
      },
    });
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: "ENTITLEMENT_CONFIG" });
    assert.equal(reads, 0);
  });

  it("keeps the paid plan none while a higher test level is effective, and the reverse", async () => {
    const sql = readFileSync("supabase/migrations/20261123_billing_test_access.sql", "utf8");
    assert.match(sql, /enable row level security/);
    assert.match(sql, /grant select on table public\.billing_test_access to service_role/);
    assert.doesNotMatch(sql, /grant insert|grant update|grant delete|values \(/i);
    const eliteTest = await handleEntitlementGet({
      env: { STRIPE_ACCOUNT_ID: "acct_live" },
      nodeEnv: "production",
      request: new Request("http://localhost/api/billing/entitlement"),
      now: NOW,
      resolveUserId: async () => USER_A,
      loadSubscription: async () => null,
      loadTestAccess: async () => grant({ test_plan: "elite" }),
    });
    const eliteBody = await eliteTest.json();
    assert.equal(eliteBody.paidPlan, "none");
    assert.equal(eliteBody.effectivePlan, "elite");
    const paidBasic = await handleEntitlementGet({
      env: { STRIPE_ACCOUNT_ID: "acct_live" },
      nodeEnv: "production",
      request: new Request("http://localhost/api/billing/entitlement"),
      now: NOW,
      resolveUserId: async () => USER_A,
      loadSubscription: async () => ({
        user_id: USER_A,
        paid_plan: "basic",
        subscription_status: "active",
        paid_until: FUTURE,
        livemode: true,
        stripe_account_id: "acct_live",
      }),
      loadTestAccess: async () => grant({ test_plan: "elite" }),
    });
    const overlap = await paidBasic.json();
    assert.equal(overlap.paidPlan, "basic");
    assert.equal(overlap.testPlan, "elite");
    assert.equal(overlap.effectivePlan, "elite");
  });

  it("returns testPlan none for an empty read and ENTITLEMENT_READ_FAILED when that read fails", async () => {
    const base = {
      env: { STRIPE_ACCOUNT_ID: "acct_live" },
      nodeEnv: "production",
      request: new Request("http://localhost/api/billing/entitlement"),
      now: NOW,
      resolveUserId: async () => USER_A,
      loadSubscription: async () => null,
    };
    const empty = await handleEntitlementGet({ ...base, loadTestAccess: async () => null });
    assert.deepEqual(await empty.json(), {
      paidPlan: "none",
      testPlan: "none",
      effectivePlan: "none",
      testExpiresAt: null,
    });

    const db: SubscriptionReadClient = {
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return { data: null, error: { message: "password=secret" } };
                  },
                };
              },
            };
          },
        };
      },
    };
    const failed = await handleEntitlementGet({
      ...base,
      loadTestAccess: (userId) => loadTestAccess(userId, db),
    });
    const text = await failed.text();
    assert.equal(failed.status, 500);
    assert.deepEqual(JSON.parse(text), { error: "ENTITLEMENT_READ_FAILED" });
    assert.equal(text.includes("password"), false);
    assert.equal(text.includes("billing_test_access"), false);
  });
});
