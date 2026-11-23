import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import { after, describe, it } from "node:test";
import { pathToFileURL } from "node:url";
import { PAID_SUBSCRIPTION_COLUMNS } from "./paidPlan.ts";
import { TEST_ACCESS_COLUMNS } from "./testAccess";

/**
 * Calls the exported GET with the real requireUserId.
 * The session comes from getServerSession and the row comes from createClient.
 * Neither mock is fixed to user B.
 */

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const FUTURE = "2026-12-01T00:00:00.000Z";

type Query = {
  table: string;
  columns: string;
  column: string;
  value: string;
};

type SubscriptionRow = {
  user_id: string;
  paid_plan: string;
  subscription_status: string;
  paid_until: string;
  cancel_at_period_end: boolean;
  livemode: boolean | null;
  stripe_account_id: string | null;
};

type TestRow = {
  user_id: string;
  test_plan: string;
  expires_at: string | null;
  revoked_at: string | null;
};

type EntitlementHarness = {
  session: { user?: { id?: string } } | null;
  queries: Query[];
  rows: Record<string, SubscriptionRow>;
  testRows: Record<string, TestRow>;
};

const harness: EntitlementHarness = {
  session: null,
  queries: [],
  rows: {},
  testRows: {},
};

(globalThis as typeof globalThis & { __autoaffiEntitlementTest: EntitlementHarness }).__autoaffiEntitlementTest =
  harness;

const root = path.resolve(import.meta.dirname, "../..");

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next-auth/next") {
      return { url: "teststub:billing-next-auth-next", shortCircuit: true };
    }
    if (specifier === "next-auth/providers/google") {
      return { url: "teststub:billing-google-provider", shortCircuit: true };
    }
    if (specifier === "@supabase/supabase-js") {
      return { url: "teststub:billing-supabase", shortCircuit: true };
    }
    if (specifier.startsWith("@/")) {
      const abs = path.join(root, `${specifier.slice(2)}.ts`);
      return { url: pathToFileURL(abs).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === "teststub:billing-next-auth-next") {
      return {
        format: "module",
        shortCircuit: true,
        source:
          "export async function getServerSession(){ return globalThis.__autoaffiEntitlementTest.session; }\n",
      };
    }
    if (url === "teststub:billing-google-provider") {
      return {
        format: "module",
        shortCircuit: true,
        source: "export default function GoogleProvider(){ return { id: 'google' }; }\n",
      };
    }
    if (url === "teststub:billing-supabase") {
      return {
        format: "module",
        shortCircuit: true,
        source: `
export function createClient() {
  return {
    from(table) {
      return {
        select(columns) {
          return {
            eq(column, value) {
              const state = globalThis.__autoaffiEntitlementTest;
              state.queries.push({ table, columns, column, value });
              return {
                async maybeSingle() {
                  const state = globalThis.__autoaffiEntitlementTest;
                  if (table === "billing_test_access") {
                    return { data: state.testRows[value] ?? null, error: null };
                  }
                  return { data: state.rows[value] ?? null, error: null };
                },
              };
            },
          };
        },
      };
    },
  };
}
`,
      };
    }
    return nextLoad(url, context);
  },
});

const { GET } = await import("../../app/api/billing/entitlement/route.ts");

function forgedRequest(): Request {
  const url = new URL("https://autoaffi.com/api/billing/entitlement");
  url.searchParams.set("user_id", USER_A);
  url.searchParams.set("plan", "pro");
  return new Request(url, {
    method: "GET",
    headers: {
      host: "autoaffi.com",
      "x-autoaffi-user-id": USER_A,
      "x-user-id": USER_A,
    },
  });
}

const previousNodeEnv = process.env.NODE_ENV;
const previousAccount = process.env.STRIPE_ACCOUNT_ID;
const previousTestAccount = process.env.STRIPE_ACCOUNT_ID_TEST;
const previousVercel = process.env.VERCEL_ENV;

after(() => {
  process.env.NODE_ENV = previousNodeEnv;
  if (previousAccount === undefined) delete process.env.STRIPE_ACCOUNT_ID;
  else process.env.STRIPE_ACCOUNT_ID = previousAccount;
  if (previousTestAccount === undefined) delete process.env.STRIPE_ACCOUNT_ID_TEST;
  else process.env.STRIPE_ACCOUNT_ID_TEST = previousTestAccount;
  if (previousVercel === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = previousVercel;
});

function liveRow(userId: string, plan: string): SubscriptionRow {
  return {
    user_id: userId,
    paid_plan: plan,
    subscription_status: "active",
    paid_until: FUTURE,
    cancel_at_period_end: false,
    livemode: true,
    stripe_account_id: "acct_live",
  };
}

describe("exported GET with real requireUserId", () => {
  it("returns B's Basic when the signed-in session is B and the request claims A and Pro", async () => {
    process.env.NODE_ENV = "production";
    process.env.STRIPE_ACCOUNT_ID = "acct_live";
    delete process.env.VERCEL_ENV;
    harness.session = { user: { id: USER_B } };
    harness.queries = [];
    harness.rows = {
      [USER_A]: liveRow(USER_A, "pro"),
      [USER_B]: liveRow(USER_B, "basic"),
    };

    const response = await GET(forgedRequest());
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      paidPlan: "basic",
      testPlan: "none",
      effectivePlan: "basic",
      testExpiresAt: null,
    });
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(harness.queries, [
      {
        table: "billing_subscriptions",
        columns: PAID_SUBSCRIPTION_COLUMNS,
        column: "user_id",
        value: USER_B,
      },
      {
        table: "billing_test_access",
        columns: TEST_ACCESS_COLUMNS,
        column: "user_id",
        value: USER_B,
      },
    ]);
  });

  it("returns 401 and does not read the database when there is no session", async () => {
    process.env.NODE_ENV = "production";
    process.env.STRIPE_ACCOUNT_ID = "acct_live";
    delete process.env.VERCEL_ENV;
    harness.session = null;
    harness.queries = [];
    harness.rows = {
      [USER_A]: liveRow(USER_A, "pro"),
    };

    const response = await GET(forgedRequest());
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.deepEqual(body, { error: "UNAUTHORIZED" });
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(harness.queries, []);
  });

  it("returns a config error and does not read when production has no account", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.STRIPE_ACCOUNT_ID;
    delete process.env.VERCEL_ENV;
    harness.session = { user: { id: USER_B } };
    harness.queries = [];
    harness.rows = { [USER_B]: liveRow(USER_B, "basic") };
    const response = await GET(forgedRequest());
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: "ENTITLEMENT_CONFIG" });
    assert.deepEqual(harness.queries, []);
  });

  it("does not grant an active Pro row whose mode is unknown", async () => {
    process.env.NODE_ENV = "production";
    process.env.STRIPE_ACCOUNT_ID = "acct_live";
    delete process.env.VERCEL_ENV;
    harness.session = { user: { id: USER_B } };
    harness.queries = [];
    harness.rows = {
      [USER_B]: { ...liveRow(USER_B, "pro"), livemode: null, stripe_account_id: null },
    };
    const response = await GET(forgedRequest());
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      paidPlan: "none",
      testPlan: "none",
      effectivePlan: "none",
      testExpiresAt: null,
    });
  });

  it("drops an Elite test grant on the next request after revoked_at is set", async () => {
    Reflect.set(process.env, "NODE_ENV", "production");
    process.env.STRIPE_ACCOUNT_ID = "acct_live";
    delete process.env.VERCEL_ENV;
    harness.session = { user: { id: USER_B } };
    harness.queries = [];
    harness.rows = {};
    harness.testRows = {
      [USER_B]: {
        user_id: USER_B,
        test_plan: "elite",
        expires_at: FUTURE,
        revoked_at: null,
      },
    };
    const first = await GET(forgedRequest());
    assert.deepEqual(await first.json(), {
      paidPlan: "none",
      testPlan: "elite",
      effectivePlan: "elite",
      testExpiresAt: FUTURE,
    });
    harness.testRows[USER_B] = {
      user_id: USER_B,
      test_plan: "elite",
      expires_at: FUTURE,
      revoked_at: "2026-11-22T00:00:00.000Z",
    };
    const second = await GET(forgedRequest());
    assert.deepEqual(await second.json(), {
      paidPlan: "none",
      testPlan: "none",
      effectivePlan: "none",
      testExpiresAt: null,
    });
  });
});
