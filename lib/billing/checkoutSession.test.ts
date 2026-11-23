import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import type { BillingCustomerStore } from "./billingCustomer";
import { CHECKOUT_PRICE_CENTS, canStartIdempotentPost, latestStart, readCheckoutReconciliationConfig, readLiveCheckoutConfig } from "./checkoutConfig";
import { handleCheckoutPost, sessionIdentityMatches, type CheckoutRuntime } from "./checkoutSession";
import { CheckoutAttemptConflict, type CheckoutAttempt, type CheckoutStore, type FinishExpiringInput, type FinishExpiringResult } from "./checkoutStore";
import { CheckoutRequestError, CheckoutTransportError, createParamsForAttempt, snapshotSession, type CheckoutStripe, type SessionSnapshot } from "./stripeCheckout";

const USER = "22222222-2222-4222-8222-222222222222";
const OTHER = "11111111-1111-4111-8111-111111111111";
const ACCOUNT = "acct_live";
const ORIGIN = "https://app.example";
const NOW = new Date("2026-11-07T00:00:00.000Z");

const calls: string[] = [];

function request(body: unknown, origin = ORIGIN): Request {
  return new Request(`${ORIGIN}/api/billing/checkout`, {
    method: "POST",
    headers: { origin, "sec-fetch-site": "same-origin", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function price(plan: "basic" | "pro" | "elite", id = `price_${plan}`) {
  return {
    id,
    active: true,
    currency: "usd",
    livemode: true,
    type: "recurring",
    billingScheme: "per_unit",
    unitAmount: CHECKOUT_PRICE_CENTS[plan],
    customUnitAmount: false,
    interval: "month",
    intervalCount: 1,
    usageType: "licensed",
    meter: null,
  };
}

function sessionFor(row: CheckoutAttempt, patch: Partial<SessionSnapshot> = {}): SessionSnapshot {
  return {
    id: row.stripe_session_id || "cs_test_session",
    url: "https://checkout.stripe.com/c/pay/cs_test_session",
    status: "open",
    customerId: row.stripe_customer_id,
    livemode: row.livemode,
    mode: "subscription",
    clientReferenceId: row.id,
    metadata: { attempt_id: row.id, user_id: row.user_id, plan: row.plan },
    successUrl: row.success_url,
    cancelUrl: row.cancel_url,
    lineItems: [{ priceId: row.stripe_price_id, quantity: 1 }],
    lineItemsComplete: true,
    ...patch,
  };
}

class MemoryCustomers implements BillingCustomerStore {
  rows = new Map<string, { userId: string; stripeCustomerId: string }>();

  async findByUserId(userId: string) {
    return this.rows.get(userId) ?? null;
  }

  async findByStripeCustomerId(stripeCustomerId: string) {
    for (const row of this.rows.values()) {
      if (row.stripeCustomerId === stripeCustomerId) return row;
    }
    return null;
  }

  async insert(binding: { userId: string; stripeCustomerId: string }) {
    if (this.rows.has(binding.userId)) return { ok: false as const, reason: "unique_violation" as const };
    for (const row of this.rows.values()) {
      if (row.stripeCustomerId === binding.stripeCustomerId) return { ok: false as const, reason: "unique_violation" as const };
    }
    this.rows.set(binding.userId, binding);
    return { ok: true as const };
  }

  async recordVerifiedAccount(input: {
    userId: string;
    stripeCustomerId: string;
    livemode: boolean;
    stripeAccountId: string;
  }) {
    const row = this.rows.get(input.userId);
    if (!row || row.stripeCustomerId !== input.stripeCustomerId) return "missing" as const;
    const livemode = "livemode" in row ? row.livemode ?? null : null;
    const stripeAccountId = "stripeAccountId" in row ? row.stripeAccountId ?? null : null;
    if (livemode === input.livemode && stripeAccountId === input.stripeAccountId) return "already_verified" as const;
    if (livemode !== null || stripeAccountId !== null) return "conflict" as const;
    this.rows.set(input.userId, { ...row, livemode: input.livemode, stripeAccountId: input.stripeAccountId });
    return "recorded" as const;
  }
}

class MemoryCheckout implements CheckoutStore {
  rows: CheckoutAttempt[] = [];
  finishCalls: FinishExpiringInput[] = [];
  localBlock = false;
  failInsert = false;

  async findBlocking(userId: string) {
    const row = this.rows.find(
      (item) => item.user_id === userId && ["pending", "open", "unknown", "expiring", "complete"].includes(item.status)
    );
    return row ? structuredClone(row) : null;
  }

  async findById(userId: string, attemptId: string) {
    const row = this.rows.find((item) => item.user_id === userId && item.id === attemptId);
    return row ? structuredClone(row) : null;
  }

  async insertPending(row: CheckoutAttempt) {
    if (this.failInsert) throw new Error("insert failed");
    if (this.rows.some((item) => item.user_id === row.user_id && item.status !== "expired")) {
      const { CheckoutAttemptConflict } = await import("./checkoutStore");
      throw new CheckoutAttemptConflict();
    }
    this.rows.push(structuredClone(row));
  }

  async compareAndSet(row: CheckoutAttempt, patch: Partial<CheckoutAttempt>, expectedExpireKey?: string | null) {
    const current = this.rows.find((item) => item.id === row.id && item.user_id === row.user_id);
    if (!current || current.row_version !== row.row_version || current.status !== row.status) return null;
    if (expectedExpireKey !== undefined && current.expire_idempotency_key !== expectedExpireKey) return null;
    Object.assign(current, patch, { row_version: current.row_version + 1 });
    return structuredClone(current);
  }

  async finishExpiring(input: FinishExpiringInput): Promise<FinishExpiringResult> {
    this.finishCalls.push(structuredClone(input));
    const current = this.rows.find((item) => item.id === input.attemptId && item.user_id === input.userId);
    if (
      !current ||
      current.row_version !== input.rowVersion ||
      current.status !== "expiring" ||
      current.stripe_account_id !== input.stripeAccountId
    ) {
      return { outcome: "conflict" };
    }
    if (input.action === "close_without_successor") {
      current.status = input.closeStatus || "expired";
      current.row_version += 1;
      return { outcome: "closed_without_successor", status: current.status === "complete" ? "complete" : "expired" };
    }
    if (this.localBlock) {
      current.status = "expired";
      current.row_version += 1;
      return { outcome: "closed_without_successor", status: "expired", reason: "local_subscription" };
    }
    const snapshot = structuredClone(current);
    current.status = "expired";
    current.row_version += 1;
    try {
      if (this.failInsert) throw new Error("successor insert failed");
      const successor = input.successor;
      if (!successor) throw new Error("missing successor");
      const child: CheckoutAttempt = {
        ...snapshot,
        id: String(successor.id),
        row_version: 1,
        status: "pending",
        idempotency_key: String(successor.idempotency_key),
        plan: successor.plan as CheckoutAttempt["plan"],
        stripe_price_id: String(successor.stripe_price_id),
        unit_amount: Number(successor.unit_amount),
        success_url: String(successor.success_url),
        cancel_url: String(successor.cancel_url),
        supersede_plan: null,
        expire_idempotency_key: null,
        expire_anchor_at: null,
        stripe_session_id: null,
        stripe_session_url: null,
        successor_attempt_id: null,
        create_anchor_at: NOW.toISOString(),
      };
      this.rows.push(child);
      current.successor_attempt_id = child.id;
      return { outcome: "reserved_successor", successor_id: child.id };
    } catch (err) {
      Object.assign(current, snapshot);
      throw err;
    }
  }
}

function runtime(store: MemoryCheckout, customers: MemoryCustomers, stripe: CheckoutStripe): CheckoutRuntime {
  return {
    origin: ORIGIN,
    prices: { basic: "price_basic", pro: "price_pro", elite: "price_elite" },
    livemode: true,
    loadSubscription: async () => null,
    customerStore: customers,
    checkoutStore: store,
    stripe,
  };
}

function stripeFake(partial: Partial<CheckoutStripe> = {}): CheckoutStripe {
  return {
    async retrieveAccount() {
      calls.push("account");
      return { id: ACCOUNT };
    },
    async retrievePrice(id) {
      calls.push(`price:${id}`);
      const plan = id.includes("elite") ? "elite" : id.includes("pro") ? "pro" : "basic";
      return price(plan, id);
    },
    async retrieveCustomer(id) {
      calls.push(`customer:${id}`);
      return { id, deleted: false, livemode: true, userId: USER };
    },
    async createCustomer() {
      calls.push("customer.create");
      return { id: "cus_new" };
    },
    async listSubscriptions() {
      calls.push("subscriptions");
      return { complete: true, blocking: false };
    },
    async createSession(row) {
      calls.push(`session.create:${row.stripe_price_id}:${row.idempotency_key}`);
      return sessionFor({ ...row, stripe_session_id: "cs_created" });
    },
    async retrieveSession(id) {
      calls.push(`session.retrieve:${id}`);
      throw new CheckoutTransportError();
    },
    async listSessions() {
      calls.push("session.list");
      return { complete: true, sessions: [] };
    },
    async expireSession(id, key) {
      calls.push(`session.expire:${id}:${key}`);
    },
    ...partial,
  };
}

async function post(
  body: unknown,
  bundle: { store: MemoryCheckout; customers: MemoryCustomers; stripe: CheckoutStripe },
  enabled = true,
  options: { now?: () => Date; prices?: CheckoutRuntime["prices"] } = {}
) {
  return handleCheckoutPost({
    request: request(body),
    resolveUserId: async () => USER,
    enabled,
    now: options.now ?? (() => NOW),
    env: { NEXT_PUBLIC_APP_URL: ORIGIN },
    nodeEnv: "test",
    openRuntime: async () => {
      calls.push("runtime");
      const opened = runtime(bundle.store, bundle.customers, bundle.stripe);
      if (options.prices) opened.prices = options.prices;
      return opened;
    },
  });
}

describe("checkout session handler", () => {
  it("keeps retry math inside the 24 hour window", () => {
    const anchor = new Date("2026-11-07T00:00:00.000Z");
    const limit = latestStart(anchor);
    assert.equal(canStartIdempotentPost(anchor, new Date(limit.getTime() - 1)), true);
    assert.equal(canStartIdempotentPost(anchor, limit), false);
    assert.ok(limit.getTime() < anchor.getTime() + 24 * 60 * 60 * 1000);
  });

  it("rejects a logged-out caller before Stripe or the database", async () => {
    calls.length = 0;
    const response = await handleCheckoutPost({
      request: request({ plan: "basic" }),
      resolveUserId: async () => {
        throw new Error("UNAUTHORIZED");
      },
      enabled: true,
      env: { NEXT_PUBLIC_APP_URL: ORIGIN },
      nodeEnv: "test",
      openRuntime: async () => {
        throw new Error("runtime opened");
      },
    });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "UNAUTHORIZED" });
    assert.deepEqual(calls, []);
  });

  it("rejects a cross-site origin and stays disabled by default", async () => {
    calls.length = 0;
    const origin = await handleCheckoutPost({
      request: request({ plan: "basic" }, "https://evil.example"),
      resolveUserId: async () => USER,
      enabled: true,
      env: { NEXT_PUBLIC_APP_URL: ORIGIN },
      nodeEnv: "production",
      openRuntime: async () => {
        throw new Error("runtime opened");
      },
    });
    assert.equal(origin.status, 403);
    assert.deepEqual(await origin.json(), { error: "CHECKOUT_ORIGIN_REJECTED" });

    const disabled = await post({ plan: "basic" }, { store: new MemoryCheckout(), customers: new MemoryCustomers(), stripe: stripeFake() }, false);
    assert.equal(disabled.status, 403);
    assert.deepEqual(await disabled.json(), { error: "CHECKOUT_DISABLED" });
    assert.equal(calls.includes("runtime"), false);
    assert.equal(calls.includes("account"), false);
  });

  it("rejects unexpected body fields and a bad price before customer creation", async () => {
    calls.length = 0;
    const extra = await post(
      { plan: "basic", price: "price_other" },
      { store: new MemoryCheckout(), customers: new MemoryCustomers(), stripe: stripeFake() }
    );
    assert.equal(extra.status, 400);
    assert.equal(calls.includes("runtime"), false);

    calls.length = 0;
    const store = new MemoryCheckout();
    const customers = new MemoryCustomers();
    const stripe = stripeFake({
      async retrievePrice() {
        calls.push("price:bad");
        return { ...price("basic"), unitAmount: 700 };
      },
    });
    const response = await post({ plan: "basic" }, { store, customers, stripe });
    assert.equal(response.status, 422);
    assert.equal(store.rows.length, 0);
    assert.equal(calls.includes("customer.create"), false);
    assert.equal(calls.some((call) => call.startsWith("session.create")), false);
  });

  it("does not create checkout when the bound customer is deleted, owned by someone else, or in the wrong mode", async () => {
    for (const customer of [
      { id: "cus_bound", deleted: true as const },
      { id: "cus_bound", deleted: false as const, livemode: true, userId: OTHER },
      { id: "cus_bound", deleted: false as const, livemode: false, userId: USER },
    ]) {
      calls.length = 0;
      const store = new MemoryCheckout();
      const customers = new MemoryCustomers();
      customers.rows.set(USER, { userId: USER, stripeCustomerId: "cus_bound" });
      const stripe = stripeFake({
        async retrieveCustomer() {
          calls.push("customer:cus_bound");
          return customer;
        },
        async createCustomer() {
          calls.push("customer.create");
          return { id: "cus_replacement" };
        },
      });
      const response = await post({ plan: "basic" }, { store, customers, stripe });
      assert.equal(response.status, 409);
      assert.equal("url" in (await response.json()), false);
      assert.equal(calls.includes("customer.create"), false);
      assert.equal(calls.some((call) => call.startsWith("session.create")), false);
      assert.equal(customers.rows.get(USER)?.stripeCustomerId, "cus_bound");
      assert.equal(store.rows.length, 0);
    }
  });

  it("withholds the URL when metadata matches but the line item does not", async () => {
    calls.length = 0;
    const store = new MemoryCheckout();
    const stripe = stripeFake({
      async createSession(row) {
        calls.push("session.create");
        return sessionFor(row, { lineItems: [{ priceId: "price_other", quantity: 1 }] });
      },
    });
    const response = await post({ plan: "basic" }, { store, customers: new MemoryCustomers(), stripe });
    const body = await response.json();
    assert.equal("url" in body, false);
    assert.equal(body.error, "CHECKOUT_SESSION_UNVERIFIED");
    assert.equal(store.rows[0]?.status, "unknown");
  });

  it("retries a network failure with the stored key and stops at the cutoff", async () => {
    const store = new MemoryCheckout();
    const customers = new MemoryCustomers();
    let creates = 0;
    const stripe = stripeFake({
      async createSession(row) {
        creates += 1;
        calls.push(row.idempotency_key);
        calls.push(row.stripe_price_id);
        if (creates === 1) throw new CheckoutTransportError();
        return sessionFor({ ...row, stripe_session_id: "cs_created" });
      },
    });
    const first = await post({ plan: "basic" }, { store, customers, stripe });
    assert.equal(first.status, 503);
    assert.equal(store.rows[0]?.status, "pending");
    const key = store.rows[0]?.idempotency_key;
    const second = await post({ plan: "basic" }, { store, customers, stripe });
    assert.equal(second.status, 200);
    assert.equal((await second.json()).url.startsWith("https://checkout.stripe.com/"), true);
    assert.equal(creates, 2);
    assert.equal(calls.filter((call) => call === key).length, 2);
    assert.equal(calls.includes("price_basic"), true);

    store.rows[0].status = "pending";
    store.rows[0].stripe_session_id = null;
    store.rows[0].stripe_session_url = null;
    store.rows[0].create_anchor_at = new Date(NOW.getTime() - 24 * 60 * 60 * 1000).toISOString();
    store.rows[0].stripe_price_id = "price_stored";
    const before = creates;
    const late = await post({ plan: "basic" }, { store, customers, stripe });
    assert.equal(late.status, 409);
    assert.equal("url" in (await late.json()), false);
    assert.equal(creates, before);
    assert.equal(store.rows.find((row) => row.id === store.rows[0].id)?.status, "unknown");
  });

  it("does not resend an attempt through a different Stripe account", async () => {
    calls.length = 0;
    const store = new MemoryCheckout();
    const row = seeded(store, { status: "pending", stripe_account_id: "acct_other" });
    const stripe = stripeFake();
    const response = await post({ plan: "basic" }, { store, customers: new MemoryCustomers(), stripe });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error, "CHECKOUT_ACCOUNT_MISMATCH");
    assert.equal(calls.some((call) => call.startsWith("session.")), false);
    assert.equal(store.rows.find((item) => item.id === row.id)?.stripe_price_id, row.stripe_price_id);
  });

  it("blocks a new successor when Stripe has a subscription and the local row is absent", async () => {
    calls.length = 0;
    const store = new MemoryCheckout();
    const row = seeded(store, { status: "open", plan: "basic", stripe_session_id: "cs_open", stripe_session_url: "https://checkout.stripe.com/c/pay/cs_open" });
    store.rows[0].status = "expiring";
    store.rows[0].supersede_plan = "pro";
    store.rows[0].expire_idempotency_key = "99999999-9999-4999-8999-999999999999";
    store.rows[0].expire_anchor_at = NOW.toISOString();
    const stripe = stripeFake({
      async retrieveSession() {
        return sessionFor(store.rows[0], { status: "expired", url: null });
      },
      async listSubscriptions() {
        calls.push("subscriptions");
        return { complete: true, blocking: true };
      },
    });
    const response = await post({ plan: "pro" }, { store, customers: new MemoryCustomers(), stripe });
    assert.equal(response.status, 409);
    assert.equal("url" in (await response.json()), false);
    assert.equal(store.finishCalls[0]?.action, "close_without_successor");
    assert.equal(store.rows.some((item) => item.status === "pending"), false);
    assert.equal(calls.some((call) => call.startsWith("session.create")), false);
  });

  it("does not let a stale open observation overwrite a later status or return its URL", async () => {
    const store = new MemoryCheckout();
    seeded(store, {
      status: "open",
      stripe_session_id: "cs_open",
      stripe_session_url: "https://checkout.stripe.com/c/pay/cs_open",
    });
    const stripe = stripeFake({
      async retrieveSession() {
        store.rows[0].status = "complete";
        store.rows[0].row_version += 1;
        return sessionFor(store.rows[0], {
          id: "cs_open",
          status: "open",
          url: "https://checkout.stripe.com/c/pay/cs_stale",
          lineItems: [{ priceId: "price_basic", quantity: 1 }],
        });
      },
    });
    const response = await post({ plan: "basic" }, { store, customers: new MemoryCustomers(), stripe });
    const body = await response.json();
    assert.equal(response.status, 409);
    assert.equal("url" in body, false);
    assert.equal(store.rows[0].status, "complete");
  });

  it("lets one plan change win and gives the loser no URL", async () => {
    const store = new MemoryCheckout();
    seeded(store, {
      status: "open",
      plan: "basic",
      stripe_session_id: "cs_open",
      stripe_session_url: "https://checkout.stripe.com/c/pay/cs_open",
    });
    let expires = 0;
    const stripe = stripeFake({
      async retrieveSession() {
        const current = store.rows[0];
        if (expires === 0) return sessionFor(current, { id: "cs_open", url: "https://checkout.stripe.com/c/pay/cs_open" });
        return sessionFor(current, { id: "cs_open", status: "expired", url: null });
      },
      async expireSession() {
        expires += 1;
      },
      async createSession(row) {
        calls.push(`created:${row.plan}`);
        return sessionFor(
          { ...row, stripe_session_id: "cs_next" },
          { id: "cs_next", url: "https://checkout.stripe.com/c/pay/cs_next" }
        );
      },
    });
    const customers = new MemoryCustomers();
    const [pro, elite] = await Promise.all([
      post({ plan: "pro" }, { store, customers, stripe }),
      post({ plan: "elite" }, { store, customers, stripe }),
    ]);
    const bodies = [await pro.json(), await elite.json()];
    const urls = bodies.filter((body) => "url" in body);
    const losers = bodies.filter((body) => body.error === "CHECKOUT_PLAN_IN_PROGRESS");
    assert.equal(expires, 1);
    assert.equal(losers.length, 1);
    assert.equal("url" in losers[0], false);
    assert.equal(urls.length, 1);
    assert.equal(urls[0].url, "https://checkout.stripe.com/c/pay/cs_next");
  });

  it("requires the hosted line item even when metadata is present", () => {
    const row = blank();
    const session = sessionFor(row, { lineItems: [{ priceId: "price_other", quantity: 1 }] });
    assert.equal(session.metadata.plan, row.plan);
    assert.equal(sessionIdentityMatches(row, session), false);
  });

  it("does not post the old key after the limit passes during a customer or session read", async () => {
    const limit = latestStart(NOW);
    let clock = new Date(limit.getTime() - 50);
    const pending = new MemoryCheckout();
    const pendingRow = seeded(pending, { status: "pending", create_anchor_at: NOW.toISOString() });
    const oldKey = pendingRow.idempotency_key;
    let creates = 0;
    const customerStripe = stripeFake({
      async retrieveCustomer(id) {
        clock = new Date(limit.getTime());
        return { id, deleted: false, livemode: true, userId: USER };
      },
      async createSession(_row, key) {
        creates += 1;
        calls.push(key);
        return sessionFor(pending.rows[0]);
      },
    });
    const lateCreate = await post({ plan: "basic" }, { store: pending, customers: new MemoryCustomers(), stripe: customerStripe }, true, {
      now: () => clock,
    });
    assert.equal(lateCreate.status, 409);
    assert.equal("url" in (await lateCreate.json()), false);
    assert.equal(creates, 0);
    assert.equal(pending.rows[0]?.status, "unknown");
    assert.equal(calls.includes(oldKey), false);

    calls.length = 0;
    clock = new Date(limit.getTime() - 50);
    const expiring = new MemoryCheckout();
    const expireKey = "99999999-9999-4999-8999-999999999999";
    seeded(expiring, {
      status: "expiring",
      supersede_plan: "pro",
      stripe_session_id: "cs_open",
      expire_idempotency_key: expireKey,
      expire_anchor_at: NOW.toISOString(),
    });
    const expireCalls: string[] = [];
    const sessionStripe = stripeFake({
      async retrieveSession() {
        clock = new Date(limit.getTime());
        return sessionFor(expiring.rows[0], { id: "cs_open", status: "open", url: "https://checkout.stripe.com/c/pay/cs_open" });
      },
      async expireSession(_id, key) {
        expireCalls.push(key);
      },
    });
    await post({ plan: "pro" }, { store: expiring, customers: new MemoryCustomers(), stripe: sessionStripe }, true, {
      now: () => clock,
    });
    assert.equal(expireCalls.includes(expireKey), false);
    assert.equal(expireCalls.length, 1);
  });

  it("withholds the URL when the row changes during the reread retrieve", async () => {
    for (const next of ["expiring", "complete"] as const) {
      const store = new MemoryCheckout();
      seeded(store, { status: "pending" });
      const stripe = stripeFake({
        async createSession() {
          store.rows[0].status = "open";
          store.rows[0].row_version += 1;
          store.rows[0].stripe_session_id = "cs_open";
          store.rows[0].stripe_session_url = "https://checkout.stripe.com/c/pay/cs_open";
          return sessionFor(store.rows[0], { id: "cs_open", url: "https://checkout.stripe.com/c/pay/cs_open" });
        },
        async retrieveSession() {
          store.rows[0].status = next;
          store.rows[0].row_version += 1;
          return sessionFor(store.rows[0], {
            id: "cs_open",
            status: "open",
            url: "https://checkout.stripe.com/c/pay/cs_open",
          });
        },
      });
      const response = await post({ plan: "basic" }, { store, customers: new MemoryCustomers(), stripe });
      const body = await response.json();
      assert.equal(response.status, 409);
      assert.equal("url" in body, false);
      assert.equal(store.rows[0]?.status, next);
    }
  });

  it("does not return a URL for a late create after the row is already complete", async () => {
    const store = new MemoryCheckout();
    seeded(store, { status: "pending" });
    const stripe = stripeFake({
      async createSession() {
        store.rows[0].status = "complete";
        store.rows[0].row_version += 1;
        store.rows[0].stripe_session_id = "cs_done";
        return sessionFor(store.rows[0], { id: "cs_done", status: "open", url: "https://checkout.stripe.com/c/pay/cs_done" });
      },
    });
    const response = await post({ plan: "basic" }, { store, customers: new MemoryCustomers(), stripe });
    assert.equal(response.status, 409);
    assert.equal("url" in (await response.json()), false);
    assert.equal(store.rows[0]?.status, "complete");
  });

  it("does not resume an insert winner from another plan, account, or mode", async () => {
    for (const planted of [
      { plan: "elite" as const },
      { stripe_account_id: "acct_other" },
      { livemode: false },
    ]) {
      calls.length = 0;
      const store = new MemoryCheckout();
      store.insertPending = async (row) => {
        store.rows.push({ ...row, ...planted });
        throw new CheckoutAttemptConflict();
      };
      const stripe = stripeFake();
      const response = await post({ plan: "basic" }, { store, customers: new MemoryCustomers(), stripe });
      const body = await response.json();
      assert.equal(response.status, 409);
      assert.equal("url" in body, false);
      assert.equal(calls.some((call) => call.startsWith("session.")), false);
    }
  });

  it("resumes one reserved attempt with the stored key and the full create body", async () => {
    const store = new MemoryCheckout();
    const seen: Array<{ key: string; params: ReturnType<typeof createParamsForAttempt> }> = [];
    const stripe = stripeFake({
      async retrievePrice() {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return price("basic");
      },
      async createSession(row, key) {
        seen.push({ key, params: createParamsForAttempt(row) });
        return sessionFor({ ...row, stripe_session_id: "cs_created" });
      },
    });
    const customers = new MemoryCustomers();
    const [first, second] = await Promise.all([
      post({ plan: "basic" }, { store, customers, stripe }),
      post({ plan: "basic" }, { store, customers, stripe }),
    ]);
    assert.equal(store.rows.length, 1);
    assert.ok(seen.length >= 1);
    assert.equal(new Set(seen.map((item) => item.key)).size, 1);
    assert.equal(seen[0].key, store.rows[0]?.idempotency_key);
    for (const item of seen) assert.deepEqual(item.params, seen[0].params);
    assert.deepEqual(seen[0].params, {
      mode: "subscription",
      customer: store.rows[0].stripe_customer_id,
      line_items: [{ price: store.rows[0].stripe_price_id, quantity: 1 }],
      success_url: store.rows[0].success_url,
      cancel_url: store.rows[0].cancel_url,
      client_reference_id: store.rows[0].id,
      metadata: { user_id: USER, plan: "basic", attempt_id: store.rows[0].id },
      adaptive_pricing: { enabled: false },
      automatic_tax: { enabled: false },
      expand: ["line_items"],
    });
    const statuses = [first.status, second.status].sort();
    assert.ok(statuses.includes(200));
    assert.equal(store.rows[0]?.unit_amount, CHECKOUT_PRICE_CENTS.basic);
    assert.equal(store.rows[0]?.stripe_price_id, "price_basic");
  });

  it("keeps a stored 700 basic attempt on its original price and idempotency key", async () => {
    const key = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    for (const status of ["pending", "unknown"] as const) {
      calls.length = 0;
      const store = new MemoryCheckout();
      const row = seeded(store, {
        status,
        stripe_price_id: "price_basic700",
        unit_amount: 700,
        idempotency_key: key,
        stripe_session_id: null,
        stripe_session_url: null,
      });
      const created: Array<{ key: string; params: ReturnType<typeof createParamsForAttempt> }> = [];
      const stripe = stripeFake({
        async retrievePrice() {
          calls.push("price");
          return price("basic");
        },
        async createSession(attempt, idempotencyKey) {
          created.push({ key: idempotencyKey, params: createParamsForAttempt(attempt) });
          return sessionFor({ ...attempt, stripe_session_id: "cs_created" });
        },
        async listSessions() {
          calls.push("session.list");
          if (status !== "unknown") return { complete: true, sessions: [] };
          return {
            complete: true,
            sessions: [sessionFor(row, { id: "cs_listed700", url: "https://checkout.stripe.com/c/pay/cs_listed700" })],
          };
        },
      });
      const response = await post({ plan: "basic" }, { store, customers: new MemoryCustomers(), stripe });
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal("url" in body, true);
      assert.equal(calls.includes("price"), false);
      assert.equal(store.rows.length, 1);
      assert.equal(store.rows[0]?.unit_amount, 700);
      assert.equal(store.rows[0]?.stripe_price_id, "price_basic700");
      assert.equal(store.rows[0]?.idempotency_key, key);
      if (status === "pending") {
        assert.equal(created.length, 1);
        assert.equal(created[0].key, key);
        assert.deepEqual(created[0].params, {
          mode: "subscription",
          customer: row.stripe_customer_id,
          line_items: [{ price: "price_basic700", quantity: 1 }],
          success_url: row.success_url,
          cancel_url: row.cancel_url,
          client_reference_id: row.id,
          metadata: { user_id: USER, plan: "basic", attempt_id: row.id },
          adaptive_pricing: { enabled: false },
          automatic_tax: { enabled: false },
          expand: ["line_items"],
        });
      } else {
        assert.equal(created.length, 0);
        assert.equal(calls.includes("session.list"), true);
      }
    }

    calls.length = 0;
    const openStore = new MemoryCheckout();
    const open = seeded(openStore, {
      status: "open",
      stripe_price_id: "price_basic700",
      unit_amount: 700,
      idempotency_key: key,
      stripe_session_id: "cs_open700",
      stripe_session_url: "https://checkout.stripe.com/c/pay/cs_open700",
    });
    const openStripe = stripeFake({
      async retrievePrice() {
        calls.push("price");
        return price("basic");
      },
      async createSession() {
        calls.push("session.create");
        throw new Error("stored open attempt must not create");
      },
      async retrieveSession() {
        return sessionFor(open, { id: "cs_open700", url: "https://checkout.stripe.com/c/pay/cs_open700" });
      },
    });
    const openResponse = await post({ plan: "basic" }, { store: openStore, customers: new MemoryCustomers(), stripe: openStripe });
    assert.equal(openResponse.status, 200);
    assert.deepEqual(await openResponse.json(), { url: "https://checkout.stripe.com/c/pay/cs_open700" });
    assert.equal(calls.includes("price"), false);
    assert.equal(calls.includes("session.create"), false);
    assert.equal(openStore.rows.length, 1);
    assert.equal(openStore.rows[0]?.unit_amount, 700);
    assert.equal(openStore.rows[0]?.idempotency_key, key);
  });

  it("prices the basic successor at 900 after the stored 700 session is confirmed expired", async () => {
    calls.length = 0;
    const store = new MemoryCheckout();
    const parent = seeded(store, {
      status: "expiring",
      plan: "basic",
      stripe_price_id: "price_basic700",
      unit_amount: 700,
      supersede_plan: "basic",
      stripe_session_id: "cs_old700",
      stripe_session_url: "https://checkout.stripe.com/c/pay/cs_old700",
      expire_idempotency_key: "99999999-9999-4999-8999-999999999999",
      expire_anchor_at: NOW.toISOString(),
    });
    const created: string[] = [];
    const stripe = stripeFake({
      async retrieveSession() {
        return sessionFor(parent, { id: "cs_old700", status: "expired", url: null });
      },
      async createSession(row) {
        created.push(`${row.stripe_price_id}:${row.unit_amount}:${row.idempotency_key}`);
        return sessionFor(
          { ...row, stripe_session_id: "cs_next900" },
          { id: "cs_next900", url: "https://checkout.stripe.com/c/pay/cs_next900" }
        );
      },
    });
    const response = await post({ plan: "basic" }, { store, customers: new MemoryCustomers(), stripe });
    assert.equal(response.status, 200);
    const storedParent = store.rows.find((row) => row.id === parent.id);
    const successor = store.rows.find((row) => row.id !== parent.id);
    assert.equal(storedParent?.status, "expired");
    assert.equal(storedParent?.plan, "basic");
    assert.equal(storedParent?.unit_amount, 700);
    assert.equal(storedParent?.stripe_price_id, "price_basic700");
    assert.equal(storedParent?.idempotency_key, parent.idempotency_key);
    assert.equal(storedParent?.successor_attempt_id, successor?.id);
    assert.equal(successor?.status, "open");
    assert.equal(successor?.plan, "basic");
    assert.equal(successor?.unit_amount, 900);
    assert.equal(successor?.stripe_price_id, "price_basic");
    assert.notEqual(successor?.idempotency_key, parent.idempotency_key);
    assert.deepEqual(created, [`price_basic:900:${successor?.idempotency_key}`]);
    const blocking = store.rows.filter((row) => ["pending", "open", "unknown", "expiring", "complete"].includes(row.status));
    assert.deepEqual(blocking.map((row) => row.id), [successor?.id]);
  });

  it("keeps an HTTP failure blocking and does not create again", async () => {
    let creates = 0;
    const store = new MemoryCheckout();
    const stripe = stripeFake({
      async createSession() {
        creates += 1;
        throw new CheckoutRequestError(500);
      },
    });
    const bundle = { store, customers: new MemoryCustomers(), stripe };
    const first = await post({ plan: "basic" }, bundle);
    assert.equal(first.status, 409);
    assert.equal(store.rows[0]?.status, "unknown");
    const second = await post({ plan: "basic" }, bundle);
    assert.equal(second.status, 409);
    assert.equal("url" in (await second.json()), false);
    assert.equal(creates, 1);
    assert.equal(store.rows[0]?.status, "unknown");
  });

  it("does not reserve a successor when the subscription list is incomplete or throws", async () => {
    for (const listSubscriptions of [
      async () => ({ complete: false as const }),
      async () => {
        throw new CheckoutRequestError(500);
      },
    ]) {
      const store = new MemoryCheckout();
      seeded(store, {
        status: "expiring",
        supersede_plan: "pro",
        stripe_session_id: "cs_open",
        expire_idempotency_key: "99999999-9999-4999-8999-999999999999",
        expire_anchor_at: NOW.toISOString(),
      });
      const stripe = stripeFake({
        async retrieveSession() {
          return sessionFor(store.rows[0], { id: "cs_open", status: "expired", url: null });
        },
        listSubscriptions,
      });
      const response = await post({ plan: "pro" }, { store, customers: new MemoryCustomers(), stripe });
      assert.equal(response.status, 503);
      assert.equal(store.finishCalls.length, 0);
      assert.equal(store.rows.some((row) => row.status === "pending"), false);
      assert.equal(store.rows[0]?.status, "expiring");
    }
  });

  it("resumes a crashed plan change by retrieving before expire", async () => {
    const store = new MemoryCheckout();
    seeded(store, {
      status: "expiring",
      supersede_plan: "pro",
      stripe_session_id: "cs_open",
      stripe_session_url: "https://checkout.stripe.com/c/pay/cs_open",
      expire_idempotency_key: "99999999-9999-4999-8999-999999999999",
      expire_anchor_at: NOW.toISOString(),
    });
    const order: string[] = [];
    const stripe = stripeFake({
      async retrieveSession() {
        order.push("retrieve");
        return sessionFor(store.rows[0], { id: "cs_open", status: "open", url: "https://checkout.stripe.com/c/pay/cs_open" });
      },
      async expireSession() {
        order.push("expire");
      },
    });
    await post({ plan: "pro" }, { store, customers: new MemoryCustomers(), stripe });
    assert.deepEqual(order.slice(0, 2), ["retrieve", "expire"]);
  });

  it("reconciles a stored attempt when current prices are missing and rejects a new purchase", async () => {
    const missing = { basic: "", pro: "", elite: "" };
    const store = new MemoryCheckout();
    seeded(store, {
      status: "open",
      stripe_session_id: "cs_open",
      stripe_session_url: "https://checkout.stripe.com/c/pay/cs_open",
    });
    let priceReads = 0;
    const stripe = stripeFake({
      async retrievePrice() {
        priceReads += 1;
        return price("basic");
      },
      async retrieveSession() {
        return sessionFor(store.rows[0], { id: "cs_open", url: "https://checkout.stripe.com/c/pay/cs_open" });
      },
    });
    const resumed = await post({ plan: "basic" }, { store, customers: new MemoryCustomers(), stripe }, true, { prices: missing });
    assert.equal(resumed.status, 200);
    assert.equal((await resumed.json()).url, "https://checkout.stripe.com/c/pay/cs_open");
    assert.equal(priceReads, 0);

    const fresh = new MemoryCheckout();
    const created = await post({ plan: "basic" }, { store: fresh, customers: new MemoryCustomers(), stripe }, true, { prices: missing });
    assert.equal(created.status, 422);
    assert.equal(fresh.rows.length, 0);
    assert.equal(priceReads, 0);

    const changing = new MemoryCheckout();
    seeded(changing, {
      status: "open",
      stripe_session_id: "cs_open",
      stripe_session_url: "https://checkout.stripe.com/c/pay/cs_open",
    });
    let expires = 0;
    const changeStripe = stripeFake({
      async retrievePrice() {
        priceReads += 1;
        return price("pro");
      },
      async expireSession() {
        expires += 1;
      },
    });
    const changed = await post({ plan: "pro" }, { store: changing, customers: new MemoryCustomers(), stripe: changeStripe }, true, {
      prices: missing,
    });
    assert.equal(changed.status, 422);
    assert.equal(changing.rows[0]?.status, "open");
    assert.equal(expires, 0);
    assert.equal(priceReads, 0);
    assert.throws(() => readLiveCheckoutConfig({ STRIPE_SECRET_KEY: "sk_live_placeholder", NEXT_PUBLIC_APP_URL: ORIGIN, STRIPE_PRICE_BASIC: "price_basic" }, "test"));
    const reconciled = readCheckoutReconciliationConfig(
      { STRIPE_SECRET_KEY: "sk_live_placeholder", NEXT_PUBLIC_APP_URL: ORIGIN },
      "test"
    );
    assert.equal(reconciled.origin, ORIGIN);
    assert.equal(reconciled.prices.basic, null);
  });

  it("rejects an incomplete embedded line item list on create, retrieve, and list", async () => {
    const createdStore = new MemoryCheckout();
    const created = await post(
      { plan: "basic" },
      {
        store: createdStore,
        customers: new MemoryCustomers(),
        stripe: stripeFake({
          async createSession(row) {
            return sessionFor(row, { id: "cs_created", lineItemsComplete: false });
          },
        }),
      }
    );
    assert.equal(created.status, 409);
    assert.equal("url" in (await created.json()), false);
    assert.equal(createdStore.rows[0]?.status, "unknown");

    const openStore = new MemoryCheckout();
    seeded(openStore, {
      status: "open",
      stripe_session_id: "cs_open",
      stripe_session_url: "https://checkout.stripe.com/c/pay/cs_open",
    });
    const retrieved = await post(
      { plan: "basic" },
      {
        store: openStore,
        customers: new MemoryCustomers(),
        stripe: stripeFake({
          async retrieveSession() {
            return sessionFor(openStore.rows[0], {
              id: "cs_open",
              url: "https://checkout.stripe.com/c/pay/cs_open",
              lineItemsComplete: false,
            });
          },
        }),
      }
    );
    assert.equal(retrieved.status, 409);
    assert.equal("url" in (await retrieved.json()), false);

    const listedStore = new MemoryCheckout();
    seeded(listedStore, { status: "unknown" });
    const listed = await post(
      { plan: "basic" },
      {
        store: listedStore,
        customers: new MemoryCustomers(),
        stripe: stripeFake({
          async listSessions() {
            return {
              complete: true,
              sessions: [sessionFor(listedStore.rows[0], { id: "cs_listed", lineItemsComplete: false })],
            };
          },
        }),
      }
    );
    assert.equal(listed.status, 409);
    assert.equal("url" in (await listed.json()), false);

    const row = blank();
    const partial = snapshotSession({
      id: row.id,
      object: "checkout.session",
      status: "open",
      url: "https://checkout.stripe.com/c/pay/cs_partial",
      customer: row.stripe_customer_id,
      livemode: true,
      mode: "subscription",
      client_reference_id: row.id,
      metadata: { attempt_id: row.id, user_id: row.user_id, plan: row.plan },
      success_url: row.success_url,
      cancel_url: row.cancel_url,
      line_items: {
        object: "list",
        data: [{ id: "li_1", object: "item", price: { id: row.stripe_price_id }, quantity: 1 }],
        has_more: true,
        url: "/v1/checkout/sessions/cs/line_items",
      },
    } as never);
    assert.equal(partial.lineItemsComplete, false);
    assert.equal(partial.lineItems, null);
    assert.equal(sessionIdentityMatches(row, partial), false);
  });
});

function blank(): CheckoutAttempt {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    user_id: USER,
    row_version: 1,
    status: "pending",
    idempotency_key: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    create_anchor_at: NOW.toISOString(),
    stripe_customer_id: "cus_bound",
    stripe_account_id: ACCOUNT,
    plan: "basic",
    stripe_price_id: "price_basic",
    unit_amount: 700,
    currency: "usd",
    quantity: 1,
    livemode: true,
    success_url: `${ORIGIN}/billing/checkout/return?attempt=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa&result=success`,
    cancel_url: `${ORIGIN}/billing/checkout/return?attempt=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa&result=cancel`,
    mode: "subscription",
    adaptive_pricing_enabled: false,
    automatic_tax_enabled: false,
    stripe_session_id: null,
    stripe_session_url: null,
    observed_late_session_id: null,
    supersede_plan: null,
    expire_idempotency_key: null,
    expire_anchor_at: null,
    successor_attempt_id: null,
  };
}

function seeded(store: MemoryCheckout, patch: Partial<CheckoutAttempt>): CheckoutAttempt {
  const row = { ...blank(), ...patch };
  store.rows.push(row);
  return row;
}

describe("checkout files stay inside the approved boundary", () => {
  it("uses one RPC for the expiring transition and does not grant access from checkout", () => {
    const store = fs.readFileSync(new URL("./checkoutStore.ts", import.meta.url), "utf8");
    const session = fs.readFileSync(new URL("./checkoutSession.ts", import.meta.url), "utf8");
    const route = fs.readFileSync(new URL("../../app/api/billing/checkout/route.ts", import.meta.url), "utf8");
    const page = fs.readFileSync(new URL("../../app/billing/checkout/return/page.tsx", import.meta.url), "utf8");
    const stripe = fs.readFileSync(new URL("./stripeCheckout.ts", import.meta.url), "utf8");
    assert.match(store, /rpc\("billing_checkout_finish_expiring"/);
    assert.match(session, /findOrCreateBillingCustomer/);
    assert.doesNotMatch(session, /from\("billing_subscriptions"\)/);
    assert.match(route, /BILLING_CHECKOUT_ENABLED === "true"/);
    assert.match(route, /readCheckoutReconciliationConfig/);
    assert.match(stripe, /apiVersion: "2025-11-17.clover"/);
    assert.match(stripe, /has_more === true/);
    assert.doesNotMatch(page, /stripe|getPaidPlan|billing_subscriptions|supabaseAdmin/);
  });
});
