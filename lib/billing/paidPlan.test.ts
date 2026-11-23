import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { handleEntitlementGet } from "./entitlementGet.ts";
import {
  EntitlementReadError,
  loadPaidSubscription,
  type SubscriptionReadClient,
} from "./loadPaidSubscription.ts";
import {
  PAID_SUBSCRIPTION_COLUMNS,
  getPaidPlan,
  type PaidSubscriptionSnapshot,
} from "./paidPlan.ts";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-11-01T00:00:00.000Z");
const FUTURE = "2026-12-01T00:00:00.000Z";
const EXACT = "2026-11-01T00:00:00.000Z";
const loadNoTestAccess = async () => null;

const ACCESS = { livemode: true as const, accountId: "acct_live" };

function row(
  overrides: Partial<PaidSubscriptionSnapshot> & Pick<PaidSubscriptionSnapshot, "user_id">
): PaidSubscriptionSnapshot {
  return {
    paid_plan: "pro",
    subscription_status: "active",
    paid_until: FUTURE,
    cancel_at_period_end: false,
    pending_plan: null,
    livemode: true,
    stripe_account_id: "acct_live",
    ...overrides,
  };
}

function requestForBAskingAsA(): Request {
  const url = new URL("http://localhost/api/billing/entitlement");
  url.searchParams.set("user_id", USER_A);
  url.searchParams.set("plan", "pro");
  return new Request(url, {
    method: "GET",
    headers: {
      "x-autoaffi-user-id": USER_A,
      "x-user-id": USER_A,
    },
  });
}

async function readPlan(response: Response) {
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const text = await response.text();
  const body = JSON.parse(text) as {
    paidPlan?: string;
    testPlan?: string;
    effectivePlan?: string;
    testExpiresAt?: string | null;
    plan?: string;
  };
  assert.equal(body.plan, undefined);
  assert.deepEqual(Object.keys(body), ["paidPlan", "testPlan", "effectivePlan", "testExpiresAt"]);
  assert.equal(body.testPlan, "none");
  assert.equal(body.effectivePlan, body.paidPlan);
  assert.equal(body.testExpiresAt, null);
  return { status: response.status, plan: body.paidPlan, text };
}

describe("getPaidPlan", () => {
  it("returns none when the user has no row", () => {
    assert.equal(getPaidPlan(null, USER_A, NOW, ACCESS), "none");
    assert.equal(getPaidPlan(undefined, USER_A, NOW, ACCESS), "none");
  });

  it("returns Pro only for the user who owns a valid Pro row", () => {
    const pro = row({ user_id: USER_A, paid_plan: "pro" });
    assert.equal(getPaidPlan(pro, USER_A, NOW, ACCESS), "pro");
    assert.equal(getPaidPlan(pro, USER_B, NOW, ACCESS), "none");
  });

  it("keeps Basic when an unpaid upgrade asks for Pro", () => {
    const basic = row({
      user_id: USER_B,
      paid_plan: "basic",
      pending_plan: "pro",
    });
    assert.equal(getPaidPlan(basic, USER_B, NOW, ACCESS), "basic");
  });

  it("grants past_due access and keeps a period-end cancellation inside paid time", () => {
    assert.equal(
      getPaidPlan(row({ user_id: USER_A, subscription_status: "past_due" }), USER_A, NOW, ACCESS),
      "pro"
    );
    assert.equal(
      getPaidPlan(
        row({ user_id: USER_A, cancel_at_period_end: true, paid_plan: "elite" }),
        USER_A,
        NOW,
        ACCESS
      ),
      "elite"
    );
  });

  it("denies access at the exact expiry instant", () => {
    assert.equal(
      getPaidPlan(row({ user_id: USER_A, paid_until: EXACT, cancel_at_period_end: true }), USER_A, NOW, ACCESS),
      "none"
    );
  });

  it("denies incomplete, paused, trialing, canceled, and unpaid even with future paid time", () => {
    for (const subscription_status of [
      "incomplete",
      "incomplete_expired",
      "paused",
      "trialing",
      "canceled",
      "unpaid",
    ]) {
      assert.equal(
        getPaidPlan(row({ user_id: USER_A, subscription_status }), USER_A, NOW, ACCESS),
        "none",
        subscription_status
      );
    }
  });

  it("denies an unknown plan name", () => {
    assert.equal(getPaidPlan(row({ user_id: USER_A, paid_plan: "vip" }), USER_A, NOW, ACCESS), "none");
  });

  it("denies unknown mode, the wrong account, and test data for a live reader", () => {
    assert.equal(getPaidPlan(row({ user_id: USER_A, livemode: null, stripe_account_id: null }), USER_A, NOW, ACCESS), "none");
    assert.equal(getPaidPlan(row({ user_id: USER_A, livemode: false }), USER_A, NOW, ACCESS), "none");
    assert.equal(getPaidPlan(row({ user_id: USER_A, stripe_account_id: "acct_other" }), USER_A, NOW, ACCESS), "none");
    assert.equal(
      getPaidPlan(row({ user_id: USER_A }), USER_A, NOW, { livemode: false, accountId: "acct_live" }),
      "none"
    );
  });
});

describe("GET entitlement behavior", () => {
  it("does not give B user A's Pro from the query, header, or a mismatched row", async () => {
    const lookedUp: string[] = [];
    const response = await handleEntitlementGet({ env: { STRIPE_ACCOUNT_ID: "acct_live" }, nodeEnv: "production",
      request: requestForBAskingAsA(),
      now: NOW,
      resolveUserId: async () => USER_B,
      loadTestAccess: loadNoTestAccess,
      loadSubscription: async (userId) => {
        lookedUp.push(userId);
        return row({ user_id: USER_A, paid_plan: "pro", pending_plan: "elite" });
      },
    });

    const body = await readPlan(response);
    assert.equal(body.status, 200);
    assert.equal(body.plan, "none");
    assert.deepEqual(lookedUp, [USER_B]);
  });

  it("returns B's own Basic when B asks the request to be treated as Pro", async () => {
    const response = await handleEntitlementGet({ env: { STRIPE_ACCOUNT_ID: "acct_live" }, nodeEnv: "production",
      request: requestForBAskingAsA(),
      now: NOW,
      resolveUserId: async () => USER_B,
      loadTestAccess: loadNoTestAccess,
      loadSubscription: async (userId) => {
        assert.equal(userId, USER_B);
        return row({ user_id: USER_B, paid_plan: "basic", pending_plan: "pro" });
      },
    });

    const body = await readPlan(response);
    assert.equal(body.status, 200);
    assert.equal(body.plan, "basic");
  });

  it("returns none with 200 when the signed-in user has no row", async () => {
    const response = await handleEntitlementGet({ env: { STRIPE_ACCOUNT_ID: "acct_live" }, nodeEnv: "production",
      request: requestForBAskingAsA(),
      now: NOW,
      resolveUserId: async () => USER_A,
      loadTestAccess: loadNoTestAccess,
      loadSubscription: async () => null,
    });
    const body = await readPlan(response);
    assert.equal(body.status, 200);
    assert.equal(body.plan, "none");
  });

  it("returns 401 and does not read the database when logged out", async () => {
    let reads = 0;
    const response = await handleEntitlementGet({ env: { STRIPE_ACCOUNT_ID: "acct_live" }, nodeEnv: "production",
      request: requestForBAskingAsA(),
      resolveUserId: async () => {
        throw new Error("UNAUTHORIZED");
      },
      loadTestAccess: loadNoTestAccess,
      loadSubscription: async () => {
        reads += 1;
        return row({ user_id: USER_A });
      },
    });
    const text = await response.text();
    const body = JSON.parse(text) as { plan?: string; error?: string };
    assert.equal(response.status, 401);
    assert.equal(body.error, "UNAUTHORIZED");
    assert.equal(body.plan, undefined);
    assert.equal(reads, 0);
  });

  it("returns 500 without database details or paid access when the read fails", async () => {
    const secret = "sk_live_should_not_leak relation billing_subscriptions";
    const response = await handleEntitlementGet({ env: { STRIPE_ACCOUNT_ID: "acct_live" }, nodeEnv: "production",
      request: requestForBAskingAsA(),
      resolveUserId: async () => USER_A,
      loadTestAccess: loadNoTestAccess,
      loadSubscription: async () => {
        throw new Error(secret);
      },
    });
    const text = await response.text();
    const body = JSON.parse(text) as { plan?: string; error?: string };
    assert.equal(response.status, 500);
    assert.equal(body.error, "ENTITLEMENT_READ_FAILED");
    assert.equal(body.plan, undefined);
    assert.equal(text.includes(secret), false);
    assert.equal(text.includes("billing_subscriptions"), false);
  });

  it("returns a config error before reading when the environment account is missing", async () => {
    let reads = 0;
    const response = await handleEntitlementGet({
      env: {},
      nodeEnv: "production",
      request: requestForBAskingAsA(),
      resolveUserId: async () => USER_A,
      loadSubscription: async () => {
        reads += 1;
        return row({ user_id: USER_A });
      },
      loadTestAccess: async () => {
        reads += 1;
        return null;
      },
    });
    const body = await response.json();
    assert.equal(response.status, 500);
    assert.deepEqual(body, { error: "ENTITLEMENT_CONFIG" });
    assert.equal(reads, 0);
  });

  it("returns none for an active row whose mode is unknown", async () => {
    const response = await handleEntitlementGet({
      env: { STRIPE_ACCOUNT_ID: "acct_live" },
      nodeEnv: "production",
      request: new Request("http://localhost/api/billing/entitlement"),
      now: NOW,
      resolveUserId: async () => USER_A,
      loadTestAccess: loadNoTestAccess,
      loadSubscription: async () => row({ user_id: USER_A, livemode: null, stripe_account_id: null }),
    });
    assert.equal((await readPlan(response)).plan, "none");
  });

  it("keeps access for cancellation at period end and denies the exact end instant", async () => {
    const active = await handleEntitlementGet({ env: { STRIPE_ACCOUNT_ID: "acct_live" }, nodeEnv: "production",
      request: new Request("http://localhost/api/billing/entitlement"),
      now: NOW,
      resolveUserId: async () => USER_A,
      loadTestAccess: loadNoTestAccess,
      loadSubscription: async () =>
        row({ user_id: USER_A, cancel_at_period_end: true, paid_plan: "pro" }),
    });
    assert.equal((await readPlan(active)).plan, "pro");

    const expired = await handleEntitlementGet({ env: { STRIPE_ACCOUNT_ID: "acct_live" }, nodeEnv: "production",
      request: new Request("http://localhost/api/billing/entitlement?plan=pro"),
      now: NOW,
      resolveUserId: async () => USER_A,
      loadTestAccess: loadNoTestAccess,
      loadSubscription: async () =>
        row({ user_id: USER_A, cancel_at_period_end: true, paid_until: EXACT }),
    });
    const body = await readPlan(expired);
    assert.equal(body.status, 200);
    assert.equal(body.plan, "none");
  });

  it("denies incomplete and paused rows for the signed-in user", async () => {
    for (const subscription_status of ["incomplete", "paused"]) {
      const response = await handleEntitlementGet({ env: { STRIPE_ACCOUNT_ID: "acct_live" }, nodeEnv: "production",
        request: new Request("http://localhost/api/billing/entitlement?plan=elite"),
        now: NOW,
        resolveUserId: async () => USER_A,
        loadTestAccess: loadNoTestAccess,
        loadSubscription: async () => row({ user_id: USER_A, subscription_status }),
      });
      const body = await readPlan(response);
      assert.equal(body.status, 200);
      assert.equal(body.plan, "none");
    }
  });
});

describe("paid subscription read", () => {
  it("selects only entitlement columns for the signed-in user", async () => {
    const calls: Array<{ table: string; columns: string; column: string; value: string }> = [];
    const db: SubscriptionReadClient = {
      from(table) {
        return {
          select(columns) {
            return {
              eq(column, value) {
                calls.push({ table, columns, column, value });
                return {
                  async maybeSingle() {
                    return {
                      data: row({ user_id: value, paid_plan: "basic" }),
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      },
    };

    const loaded = await loadPaidSubscription(USER_B, db);
    assert.equal(loaded?.paid_plan, "basic");
    assert.deepEqual(calls, [
      {
        table: "billing_subscriptions",
        columns: PAID_SUBSCRIPTION_COLUMNS,
        column: "user_id",
        value: USER_B,
      },
    ]);
    assert.equal(PAID_SUBSCRIPTION_COLUMNS.includes("pending_plan"), false);
    assert.equal(PAID_SUBSCRIPTION_COLUMNS.includes("livemode"), true);
    assert.equal(PAID_SUBSCRIPTION_COLUMNS.includes("stripe_account_id"), true);
    assert.equal(PAID_SUBSCRIPTION_COLUMNS.includes("stripe_customer"), false);
    assert.equal(PAID_SUBSCRIPTION_COLUMNS.includes("stripe_subscription"), false);
    assert.equal(PAID_SUBSCRIPTION_COLUMNS.includes("stripe_price"), false);
    assert.equal(PAID_SUBSCRIPTION_COLUMNS.includes("invoice"), false);
    assert.equal(PAID_SUBSCRIPTION_COLUMNS.includes("last_applied"), false);
  });

  it("hides database error text behind EntitlementReadError", async () => {
    const db: SubscriptionReadClient = {
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return { data: row({ user_id: USER_A }), error: { message: "password=secret" } };
                  },
                };
              },
            };
          },
        };
      },
    };

    await assert.rejects(loadPaidSubscription(USER_A, db), (err: unknown) => {
      assert.ok(err instanceof EntitlementReadError);
      assert.equal(String(err).includes("password"), false);
      return true;
    });
  });
});

describe("B1.1 wiring stays out of the existing product flow", () => {
  it("the GET route takes the user only from requireUserId", () => {
    const route = readFileSync("app/api/billing/entitlement/route.ts", "utf8");
    assert.match(route, /resolveUserId: requireUserId/);
    assert.match(route, /loadSubscription: loadPaidSubscription/);
    assert.match(route, /loadTestAccess/);
    assert.match(route, /handleEntitlementGet/);
    assert.doesNotMatch(route, /searchParams|pending_plan|stripe|last_applied|x-autoaffi-user-id/);
  });

  it("the migration is least privilege and has no webhook-order or invoice ledger columns", () => {
    const sql = readFileSync("supabase/migrations/20261101_billing_paid_plan.sql", "utf8");
    assert.match(sql, /enable row level security/);
    assert.match(sql, /revoke all on table public\.billing_subscriptions from public/);
    assert.match(sql, /revoke all on table public\.billing_subscriptions from anon/);
    assert.match(sql, /revoke all on table public\.billing_subscriptions from authenticated/);
    assert.match(sql, /revoke all on table public\.billing_subscriptions from service_role/);
    assert.match(sql, /grant select, insert, update on table public\.billing_subscriptions to service_role/);
    assert.doesNotMatch(sql, /create policy|grant delete|last_applied_event|invoice_id|references public\.profiles/i);
  });
});
