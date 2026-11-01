import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import { after, describe, it } from "node:test";
import { pathToFileURL } from "node:url";
import { PAID_SUBSCRIPTION_COLUMNS } from "./paidPlan.ts";

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
};

type EntitlementHarness = {
  session: { user?: { id?: string } } | null;
  queries: Query[];
  rows: Record<string, SubscriptionRow>;
};

const harness: EntitlementHarness = {
  session: null,
  queries: [],
  rows: {},
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

after(() => {
  process.env.NODE_ENV = previousNodeEnv;
});

describe("exported GET with real requireUserId", () => {
  it("returns B's Basic when the signed-in session is B and the request claims A and Pro", async () => {
    process.env.NODE_ENV = "production";
    harness.session = { user: { id: USER_B } };
    harness.queries = [];
    harness.rows = {
      [USER_A]: {
        user_id: USER_A,
        paid_plan: "pro",
        subscription_status: "active",
        paid_until: FUTURE,
        cancel_at_period_end: false,
      },
      [USER_B]: {
        user_id: USER_B,
        paid_plan: "basic",
        subscription_status: "active",
        paid_until: FUTURE,
        cancel_at_period_end: false,
      },
    };

    const response = await GET(forgedRequest());
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, { plan: "basic" });
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(harness.queries, [
      {
        table: "billing_subscriptions",
        columns: PAID_SUBSCRIPTION_COLUMNS,
        column: "user_id",
        value: USER_B,
      },
    ]);
  });

  it("returns 401 and does not read the database when there is no session", async () => {
    process.env.NODE_ENV = "production";
    harness.session = null;
    harness.queries = [];
    harness.rows = {
      [USER_A]: {
        user_id: USER_A,
        paid_plan: "pro",
        subscription_status: "active",
        paid_until: FUTURE,
        cancel_at_period_end: false,
      },
    };

    const response = await GET(forgedRequest());
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.deepEqual(body, { plan: "none" });
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(harness.queries, []);
  });
});
