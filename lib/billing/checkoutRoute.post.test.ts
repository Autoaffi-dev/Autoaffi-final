import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import { after, describe, it } from "node:test";
import { pathToFileURL } from "node:url";

const USER_B = "22222222-2222-4222-8222-222222222222";

type CheckoutHarness = {
  session: { user?: { id?: string } } | null;
  opens: number;
};

const harness: CheckoutHarness = { session: null, opens: 0 };
(globalThis as typeof globalThis & { __autoaffiCheckoutRouteTest: CheckoutHarness }).__autoaffiCheckoutRouteTest =
  harness;

const root = path.resolve(import.meta.dirname, "../..");

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next-auth/next") return { url: "teststub:checkout-next-auth", shortCircuit: true };
    if (specifier === "next-auth/providers/google") return { url: "teststub:checkout-google", shortCircuit: true };
    if (specifier === "@supabase/supabase-js") return { url: "teststub:checkout-supabase", shortCircuit: true };
    if (specifier === "stripe") return { url: "teststub:checkout-stripe", shortCircuit: true };
    if (specifier.startsWith("@/")) return { url: pathToFileURL(path.join(root, `${specifier.slice(2)}.ts`)).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === "teststub:checkout-next-auth") {
      return {
        format: "module",
        shortCircuit: true,
        source: "export async function getServerSession(){ return globalThis.__autoaffiCheckoutRouteTest.session; }\n",
      };
    }
    if (url === "teststub:checkout-google") {
      return { format: "module", shortCircuit: true, source: "export default function Google(){ return { id: 'google' }; }\n" };
    }
    if (url === "teststub:checkout-supabase") {
      return {
        format: "module",
        shortCircuit: true,
        source: "export function createClient(){ globalThis.__autoaffiCheckoutRouteTest.opens += 1; return {}; }\n",
      };
    }
    if (url === "teststub:checkout-stripe") {
      return {
        format: "module",
        shortCircuit: true,
        source: "export default class Stripe { constructor(){ globalThis.__autoaffiCheckoutRouteTest.opens += 1; } }\n",
      };
    }
    return nextLoad(url, context);
  },
});

const { POST } = await import("../../app/api/billing/checkout/route.ts");

const previous: Record<string, string | undefined> = {
  NODE_ENV: process.env.NODE_ENV,
  BILLING_CHECKOUT_ENABLED: process.env.BILLING_CHECKOUT_ENABLED,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
};

after(() => {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function call(body: unknown, origin?: string) {
  return POST(new Request("https://app.example/api/billing/checkout", {
    method: "POST",
    headers: {
      origin: origin ?? "https://app.example",
      "sec-fetch-site": "same-origin",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  }));
}

describe("POST /api/billing/checkout", () => {
  it("returns 401 and does not open Stripe or the database when logged out", async () => {
    process.env.NODE_ENV = "production";
    process.env.BILLING_CHECKOUT_ENABLED = "true";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example";
    harness.session = null;
    harness.opens = 0;
    const response = await call({ plan: "basic" });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "UNAUTHORIZED" });
    assert.equal(harness.opens, 0);
  });

  it("rejects a foreign origin before opening Stripe", async () => {
    process.env.NODE_ENV = "production";
    process.env.BILLING_CHECKOUT_ENABLED = "true";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example";
    harness.session = { user: { id: USER_B } };
    harness.opens = 0;
    const response = await call({ plan: "basic" }, "https://evil.example");
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "CHECKOUT_ORIGIN_REJECTED" });
    assert.equal(harness.opens, 0);
  });

  it("stays disabled unless BILLING_CHECKOUT_ENABLED is exactly true", async () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example";
    harness.session = { user: { id: USER_B } };
    const values: Array<string | undefined> = [undefined, "false", "TRUE", "1"];
    for (const value of values) {
      if (value === undefined) delete process.env.BILLING_CHECKOUT_ENABLED;
      else process.env.BILLING_CHECKOUT_ENABLED = value;
      harness.opens = 0;
      const response = await call({ plan: "basic" });
      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { error: "CHECKOUT_DISABLED" });
      assert.equal(harness.opens, 0);
    }
  });
});
