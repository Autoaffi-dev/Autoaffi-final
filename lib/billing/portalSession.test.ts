import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BillingCustomerStore } from "./billingCustomer.ts";
import { handlePortalPost, portalReturnUrl, readPortalConfig, type PortalConfig, type PortalStripe } from "./portalSession.ts";

const USER = "11111111-1111-4111-8111-111111111111";
const ORIGIN = "https://app.example";

const ENV = {
  STRIPE_SECRET_KEY: "sk_test_portal",
  STRIPE_ACCOUNT_ID_TEST: "acct_test",
  STRIPE_PORTAL_CONFIGURATION_TEST: "bpc_test",
  STRIPE_ACCOUNT_ID: "acct_live",
  STRIPE_PORTAL_CONFIGURATION: "bpc_live",
  NEXT_PUBLIC_APP_URL: ORIGIN,
};

function request(origin = ORIGIN): Request {
  return new Request(`${ORIGIN}/api/billing/portal`, {
    method: "POST",
    headers: { origin, "sec-fetch-site": "same-origin", "content-type": "application/json" },
    body: JSON.stringify({ customer: "cus_forged", return_url: "https://evil.example/phish" }),
  });
}

function customers(binding: { userId: string; stripeCustomerId: string } | null, fail = false): BillingCustomerStore {
  return {
    async findByUserId(userId) {
      if (fail) throw new Error("db");
      if (!binding || binding.userId !== userId) return null;
      return binding;
    },
    async findByStripeCustomerId() {
      throw new Error("portal must not look up a body customer");
    },
    async insert() {
      throw new Error("portal must not create a customer");
    },
  };
}

function stripe(overrides: Partial<PortalStripe> = {}): PortalStripe & { created: Array<unknown> } {
  const created: Array<unknown> = [];
  return {
    created,
    async retrieveAccount() {
      return { id: "acct_test" };
    },
    async retrieveCustomer() {
      return { id: "cus_bound", deleted: false, livemode: false, userId: USER };
    },
    async createPortalSession(input) {
      created.push(input);
      return { url: "https://billing.stripe.com/p/session/test" };
    },
    ...overrides,
  };
}

function config(livemode = false): PortalConfig {
  return {
    secret: livemode ? "sk_live_portal" : "sk_test_portal",
    origin: ORIGIN,
    accountId: livemode ? "acct_live" : "acct_test",
    configurationId: livemode ? "bpc_live" : "bpc_test",
    livemode,
  };
}

async function post(options: {
  enabled?: boolean;
  env?: Record<string, string>;
  user?: string | Error;
  binding?: { userId: string; stripeCustomerId: string } | null;
  failRead?: boolean;
  stripe?: PortalStripe;
  openConfig?: PortalConfig;
} = {}) {
  const portalStripe = options.stripe ?? stripe();
  const response = await handlePortalPost({
    request: request(),
    enabled: options.enabled ?? true,
    env: options.env ?? ENV,
    nodeEnv: "test",
    resolveUserId: async () => {
      if (options.user instanceof Error) throw options.user;
      return options.user ?? USER;
    },
    open: async () => ({
      customers: customers(options.binding === undefined ? { userId: USER, stripeCustomerId: "cus_bound" } : options.binding, options.failRead),
      stripe: portalStripe,
      config: options.openConfig ?? config(),
    }),
  });
  return { response, body: await response.json(), stripe: portalStripe as PortalStripe & { created?: Array<unknown> } };
}

describe("billing portal session", () => {
  it("keeps test and live configuration ids apart", () => {
    assert.equal(readPortalConfig(ENV, "test")?.livemode, false);
    assert.equal(readPortalConfig(ENV, "test")?.configurationId, "bpc_test");
    assert.equal(readPortalConfig({ ...ENV, STRIPE_SECRET_KEY: "sk_live_portal" }, "production")?.configurationId, "bpc_live");
    assert.equal(readPortalConfig({ ...ENV, STRIPE_PORTAL_CONFIGURATION_TEST: "" }, "test"), null);
    assert.equal(readPortalConfig({ ...ENV, STRIPE_PORTAL_CONFIGURATION: "bpc_test", STRIPE_SECRET_KEY: "sk_live_portal" }, "production"), null);
    assert.equal(portalReturnUrl(ORIGIN), `${ORIGIN}/login/dashboard`);
  });

  it("opens only the bound customer with the server return url", async () => {
    const opened = await post();
    assert.equal(opened.response.status, 200);
    assert.equal(opened.body.url, "https://billing.stripe.com/p/session/test");
    assert.deepEqual(opened.stripe.created, [{
      customerId: "cus_bound",
      returnUrl: `${ORIGIN}/login/dashboard`,
      configurationId: "bpc_test",
    }]);
  });

  it("reports logged out, missing binding, read failure, origin, mode, and account failures", async () => {
    assert.equal((await post({ enabled: false })).response.status, 503);
    assert.equal((await post({ user: "" })).response.status, 401);
    assert.equal((await post({ user: new Error("UNAUTHORIZED") })).body.error, "UNAUTHORIZED");
    assert.equal((await post({ binding: null })).body.error, "PORTAL_CUSTOMER_MISSING");
    assert.equal((await post({ failRead: true })).response.status, 500);
    assert.equal((await post({ env: { ...ENV, NEXT_PUBLIC_APP_URL: "" } })).body.error, "PORTAL_CONFIG");
    const foreign = await handlePortalPost({
      request: request("https://evil.example"),
      enabled: true,
      env: ENV,
      nodeEnv: "test",
      resolveUserId: async () => USER,
      open: async () => {
        throw new Error("must not open");
      },
    });
    assert.equal((await foreign.json()).error, "PORTAL_ORIGIN_REJECTED");
    assert.equal((await post({
      stripe: stripe({
        async retrieveCustomer() {
          return { id: "cus_bound", deleted: false, livemode: true, userId: USER };
        },
      }),
    })).body.error, "PORTAL_CUSTOMER_REJECTED");
    assert.equal((await post({
      stripe: stripe({
        async retrieveAccount() {
          return { id: "acct_other" };
        },
      }),
    })).body.error, "PORTAL_ACCOUNT_REJECTED");
    assert.equal((await post({
      stripe: stripe({
        async retrieveCustomer() {
          return { id: "cus_bound", deleted: true };
        },
      }),
    })).body.error, "PORTAL_CUSTOMER_REJECTED");
  });
});
