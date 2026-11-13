import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import { after, describe, it } from "node:test";
import { pathToFileURL } from "node:url";

type WebhookHarness = {
  constructs: number;
  opens: number;
  payload: string;
  throwSignature: boolean;
  outcome: string;
  event: unknown;
};

const harness: WebhookHarness = {
  constructs: 0,
  opens: 0,
  payload: "",
  throwSignature: false,
  outcome: "ignored_type",
  event: null,
};
(globalThis as typeof globalThis & { __autoaffiWebhookRouteTest: WebhookHarness }).__autoaffiWebhookRouteTest = harness;

const root = path.resolve(import.meta.dirname, "../..");

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@supabase/supabase-js") return { url: "teststub:webhook-supabase", shortCircuit: true };
    if (specifier === "stripe") return { url: "teststub:webhook-stripe", shortCircuit: true };
    if (specifier.startsWith("@/")) return { url: pathToFileURL(path.join(root, `${specifier.slice(2)}.ts`)).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === "teststub:webhook-supabase") {
      return {
        format: "module",
        shortCircuit: true,
        source: `
          export function createClient() {
            return {
              rpc() {
                globalThis.__autoaffiWebhookRouteTest.opens += 1;
                return Promise.resolve({ data: { outcome: globalThis.__autoaffiWebhookRouteTest.outcome }, error: null });
              }
            };
          }
        `,
      };
    }
    if (url === "teststub:webhook-stripe") {
      return {
        format: "module",
        shortCircuit: true,
        source: `
          class Stripe {}
          Stripe.webhooks = {
            constructEvent(payload, header) {
              const harness = globalThis.__autoaffiWebhookRouteTest;
              harness.constructs += 1;
              harness.payload = payload;
              if (header === "bad" || harness.throwSignature) throw new Error("signature");
              return harness.event;
            }
          };
          export default Stripe;
        `,
      };
    }
    return nextLoad(url, context);
  },
});

const { POST } = await import("../../app/api/billing/webhook/route.ts");

const previous: Record<string, string | undefined> = {
  BILLING_WEBHOOK_ENABLED: process.env.BILLING_WEBHOOK_ENABLED,
  STRIPE_WEBHOOK_SECRET_TEST: process.env.STRIPE_WEBHOOK_SECRET_TEST,
  STRIPE_PRICE_BASIC_TEST: process.env.STRIPE_PRICE_BASIC_TEST,
  STRIPE_PRICE_PRO_TEST: process.env.STRIPE_PRICE_PRO_TEST,
  STRIPE_PRICE_ELITE_TEST: process.env.STRIPE_PRICE_ELITE_TEST,
  NODE_ENV: process.env.NODE_ENV,
  VERCEL_ENV: process.env.VERCEL_ENV,
};

after(() => {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function assignEnv(name: "NODE_ENV" | "VERCEL_ENV", value: string | undefined) {
  const env = process.env as { [key: string]: string | undefined };
  if (value === undefined) delete env[name];
  else env[name] = value;
}

function enable() {
  process.env.BILLING_WEBHOOK_ENABLED = "true";
  process.env.STRIPE_WEBHOOK_SECRET_TEST = "whsec_testsecret123";
  process.env.STRIPE_PRICE_BASIC_TEST = "price_basic";
  process.env.STRIPE_PRICE_PRO_TEST = "price_pro";
  process.env.STRIPE_PRICE_ELITE_TEST = "price_elite";
  assignEnv("NODE_ENV", "test");
  assignEnv("VERCEL_ENV", undefined);
}

function call(signature?: string) {
  const headers = new Headers();
  if (signature) headers.set("stripe-signature", signature);
  return POST(new Request("https://app.example/api/billing/webhook", {
    method: "POST",
    headers,
    body: "{\"id\":\"evt_route\"}",
  }));
}

describe("POST /api/billing/webhook", () => {
  it("stays disabled and does not verify a signature or open the database", async () => {
    delete process.env.BILLING_WEBHOOK_ENABLED;
    harness.constructs = 0;
    harness.opens = 0;
    const response = await call("signed");
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "WEBHOOK_DISABLED" });
    assert.equal(harness.constructs, 0);
    assert.equal(harness.opens, 0);
  });

  it("rejects an invalid signature before the database", async () => {
    enable();
    harness.constructs = 0;
    harness.opens = 0;
    harness.throwSignature = false;
    const response = await call("bad");
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "WEBHOOK_SIGNATURE_INVALID" });
    assert.equal(harness.constructs, 1);
    assert.equal(harness.payload, "{\"id\":\"evt_route\"}");
    assert.equal(harness.opens, 0);
  });

  it("passes a verified event to the store and retries when the customer binding is missing", async () => {
    enable();
    harness.constructs = 0;
    harness.opens = 0;
    harness.outcome = "ignored_type";
    harness.event = {
      id: "evt_route",
      object: "event",
      api_version: "2025-11-17.clover",
      created: 1763000000,
      livemode: false,
      type: "customer.created",
      data: { object: { object: "customer", id: "cus_B" } },
    };
    const accepted = await call("signed");
    assert.equal(accepted.status, 200);
    assert.deepEqual(await accepted.json(), { outcome: "ignored_type" });
    assert.equal(harness.opens, 1);

    harness.outcome = "binding_missing";
    const retry = await call("signed");
    assert.equal(retry.status, 500);
    assert.deepEqual(await retry.json(), { error: "WEBHOOK_RETRY" });
  });

  it("does not open the store in production even when the webhook flag is true", async () => {
    enable();
    const cases = [
      { NODE_ENV: "production", VERCEL_ENV: undefined },
      { NODE_ENV: "test", VERCEL_ENV: "production" },
    ];
    for (const item of cases) {
      assignEnv("NODE_ENV", item.NODE_ENV);
      assignEnv("VERCEL_ENV", item.VERCEL_ENV);
      harness.constructs = 0;
      harness.opens = 0;
      const response = await call("signed");
      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { error: "WEBHOOK_PRODUCTION_BLOCKED" });
      assert.equal(harness.constructs, 0);
      assert.equal(harness.opens, 0);
    }
  });

  it("rejects a signed live event before the store", async () => {
    enable();
    harness.constructs = 0;
    harness.opens = 0;
    harness.event = {
      id: "evt_live_route",
      object: "event",
      api_version: "2025-11-17.clover",
      created: 1763000000,
      livemode: true,
      type: "invoice.paid",
      data: { object: { object: "invoice", id: "in_live" } },
    };
    const response = await call("signed");
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "WEBHOOK_LIVEMODE_REJECTED" });
    assert.equal(harness.constructs, 1);
    assert.equal(harness.opens, 0);
  });
});
