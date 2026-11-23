import { randomUUID } from "node:crypto";
import { findOrCreateBillingCustomer } from "./billingCustomer";
import type { BillingCustomerStore } from "./billingCustomer";
import {
  canStartIdempotentPost,
  checkoutEnabled,
  priceMatchesPlan,
  purchasePriceId,
  readCheckoutOrigin,
  requestOriginAllowed,
  returnUrls,
  type CheckoutPlan,
  type PriceSnapshot,
} from "./checkoutConfig";
import type { PaidSubscriptionSnapshot } from "./paidPlan";
import {
  CheckoutAttemptConflict,
  type CheckoutAttempt,
  type CheckoutStore,
  type FinishExpiringResult,
} from "./checkoutStore";
import {
  CheckoutRequestError,
  CheckoutTransportError,
  type CheckoutStripe,
  type CustomerSnapshot,
  type SessionSnapshot,
  type SubscriptionScan,
} from "./stripeCheckout";

const PLANS = new Set(["basic", "pro", "elite"]);

export type CheckoutRuntime = {
  origin: string;
  prices: Record<CheckoutPlan, string>;
  livemode: boolean;
  loadSubscription: (userId: string) => Promise<PaidSubscriptionSnapshot | null>;
  customerStore: BillingCustomerStore;
  checkoutStore: CheckoutStore;
  stripe: CheckoutStripe;
};

export type HandleCheckoutInput = {
  request: Request;
  resolveUserId: (request: Request) => Promise<string>;
  enabled: boolean;
  openRuntime: () => Promise<CheckoutRuntime>;
  now?: () => Date;
  env?: { readonly [key: string]: string | undefined };
  nodeEnv?: string;
};

function json(status: number, body: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });
}

function unavailable(): Response {
  return json(503, { error: "CHECKOUT_UNAVAILABLE" });
}

function blocked(error = "CHECKOUT_ATTEMPT_BLOCKED"): Response {
  return json(409, { error });
}

async function parsePlan(request: Request): Promise<{ ok: true; plan: CheckoutPlan } | { ok: false }> {
  let text = "";
  try {
    text = await request.text();
  } catch {
    return { ok: false };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return { ok: false };
  const keys = Object.keys(parsed);
  if (keys.length !== 1 || keys[0] !== "plan") return { ok: false };
  const plan = (parsed as { plan?: unknown }).plan;
  if (typeof plan !== "string" || !PLANS.has(plan)) return { ok: false };
  return { ok: true, plan: plan as CheckoutPlan };
}

export function sessionIdentityMatches(row: CheckoutAttempt, session: SessionSnapshot): boolean {
  if (!session.id || session.customerId !== row.stripe_customer_id) return false;
  if (session.livemode !== row.livemode) return false;
  if (session.mode !== "subscription") return false;
  if (session.clientReferenceId !== row.id) return false;
  if (session.metadata.attempt_id !== row.id) return false;
  if (session.metadata.user_id !== row.user_id) return false;
  if (session.metadata.plan !== row.plan) return false;
  if (session.successUrl !== row.success_url || session.cancelUrl !== row.cancel_url) return false;
  if (session.lineItemsComplete !== true || !session.lineItems || session.lineItems.length !== 1) return false;
  const line = session.lineItems[0];
  return line.priceId === row.stripe_price_id && line.quantity === 1;
}

export function hostedCheckoutUrl(session: SessionSnapshot): string | null {
  if (session.status !== "open" || !session.url) return null;
  if (!session.url.startsWith("https://checkout.stripe.com/")) return null;
  return session.url;
}

function customerMatches(customer: CustomerSnapshot, customerId: string, userId: string, livemode: boolean): boolean {
  if (customer.deleted) return false;
  return customer.id === customerId && customer.livemode === livemode && customer.userId === userId;
}

function localSubscriptionBlocks(
  row: PaidSubscriptionSnapshot | null,
  userId: string,
  access: { livemode: boolean; accountId: string }
): boolean {
  if (!row || row.user_id !== userId) return false;
  if (row.livemode !== access.livemode || row.stripe_account_id !== access.accountId) return false;
  return (
    row.subscription_status === "incomplete" ||
    row.subscription_status === "trialing" ||
    row.subscription_status === "active" ||
    row.subscription_status === "past_due" ||
    row.subscription_status === "unpaid" ||
    row.subscription_status === "paused"
  );
}

async function verifiedPrice(runtime: CheckoutRuntime, plan: CheckoutPlan): Promise<PriceSnapshot | null> {
  const priceId = purchasePriceId(runtime.prices, plan);
  if (!priceId) return null;
  const price = await runtime.stripe.retrievePrice(priceId);
  if (price.id !== priceId || !priceMatchesPlan(plan, price, runtime.livemode)) return null;
  return price;
}

function newAttempt(input: {
  userId: string;
  customerId: string;
  accountId: string;
  plan: CheckoutPlan;
  priceId: string;
  unitAmount: number;
  livemode: boolean;
  origin: string;
  now: Date;
}): CheckoutAttempt {
  const id = randomUUID();
  const urls = returnUrls(input.origin, id);
  return {
    id,
    user_id: input.userId,
    row_version: 1,
    status: "pending",
    idempotency_key: randomUUID(),
    create_anchor_at: input.now.toISOString(),
    stripe_customer_id: input.customerId,
    stripe_account_id: input.accountId,
    plan: input.plan,
    stripe_price_id: input.priceId,
    unit_amount: input.unitAmount,
    currency: "usd",
    quantity: 1,
    livemode: input.livemode,
    success_url: urls.success,
    cancel_url: urls.cancel,
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

type Ctx = {
  request: Request;
  userId: string;
  plan: CheckoutPlan;
  now: () => Date;
  runtime: CheckoutRuntime;
};

function accountMatches(row: CheckoutAttempt, accountId: string, livemode: boolean): boolean {
  return row.stripe_account_id === accountId && row.livemode === livemode;
}

async function mark(
  store: CheckoutStore,
  row: CheckoutAttempt,
  patch: Partial<CheckoutAttempt>
): Promise<CheckoutAttempt | null> {
  return store.compareAndSet(row, patch);
}

async function rememberUnverified(
  ctx: Ctx,
  row: CheckoutAttempt,
  session: SessionSnapshot | null
): Promise<Response> {
  const patch: Partial<CheckoutAttempt> = { status: "unknown" };
  if (session?.id && session.customerId === row.stripe_customer_id && !row.stripe_session_id) {
    patch.stripe_session_id = session.id;
  } else if (session?.id && session.id !== row.stripe_session_id && !row.observed_late_session_id) {
    patch.observed_late_session_id = session.id;
  }
  await mark(ctx.runtime.checkoutStore, row, patch);
  return blocked("CHECKOUT_SESSION_UNVERIFIED");
}

async function acceptVerified(
  ctx: Ctx,
  row: CheckoutAttempt,
  session: SessionSnapshot
): Promise<Response> {
  if (!sessionIdentityMatches(row, session)) return rememberUnverified(ctx, row, session);
  if (session.status === "complete") {
    const updated = await mark(ctx.runtime.checkoutStore, row, {
      status: "complete",
      stripe_session_id: session.id,
    });
    if (!updated) return reread(ctx, row, session);
    return blocked();
  }
  if (session.status === "expired") {
    const updated = await mark(ctx.runtime.checkoutStore, row, {
      status: "expired",
      stripe_session_id: session.id,
    });
    if (!updated) return reread(ctx, row, session);
    return blocked("CHECKOUT_REQUIRES_RETRY");
  }
  const url = hostedCheckoutUrl(session);
  if (!url) return rememberUnverified(ctx, row, session);
  const updated = await mark(ctx.runtime.checkoutStore, row, {
    status: "open",
    stripe_session_id: session.id,
    stripe_session_url: url,
  });
  if (!updated) return reread(ctx, row, session);
  if (updated.status !== "open" || updated.stripe_session_url !== url) return blocked();
  return json(200, { url: updated.stripe_session_url });
}

async function reread(ctx: Ctx, row: CheckoutAttempt, stale: SessionSnapshot): Promise<Response> {
  const current = await ctx.runtime.checkoutStore.findById(ctx.userId, row.id);
  if (!current || current.status !== "open" || !current.stripe_session_id) return blocked();
  let fresh: SessionSnapshot;
  try {
    fresh = await ctx.runtime.stripe.retrieveSession(current.stripe_session_id);
  } catch {
    return unavailable();
  }
  const url = hostedCheckoutUrl(fresh);
  if (!url || !sessionIdentityMatches(current, fresh) || current.stripe_session_url !== url) return blocked();
  if (fresh.id === stale.id && fresh.url === stale.url && current.row_version === row.row_version) return blocked();
  const after = await ctx.runtime.checkoutStore.findById(ctx.userId, row.id);
  if (!after || after.status !== "open" || after.row_version !== current.row_version) return blocked();
  if (after.stripe_session_id !== current.stripe_session_id || after.stripe_session_url !== url) return blocked();
  return json(200, { url: after.stripe_session_url });
}

async function reconcileList(ctx: Ctx, row: CheckoutAttempt): Promise<Response> {
  let listed: Awaited<ReturnType<CheckoutStripe["listSessions"]>>;
  try {
    listed = await ctx.runtime.stripe.listSessions(row.stripe_customer_id);
  } catch {
    return unavailable();
  }
  if (!listed.complete) return blocked("CHECKOUT_SESSION_UNVERIFIED");
  const matches = listed.sessions.filter(
    (session) => session.clientReferenceId === row.id || session.metadata.attempt_id === row.id
  );
  if (matches.length !== 1) return blocked("CHECKOUT_SESSION_UNVERIFIED");
  return acceptVerified(ctx, row, matches[0]);
}

async function sendCreate(ctx: Ctx, row: CheckoutAttempt): Promise<Response> {
  const anchor = new Date(row.create_anchor_at);
  let customer: CustomerSnapshot;
  try {
    customer = await ctx.runtime.stripe.retrieveCustomer(row.stripe_customer_id);
  } catch (err) {
    if (err instanceof CheckoutRequestError) return blocked("CHECKOUT_CUSTOMER_BLOCKED");
    return unavailable();
  }
  if (!customerMatches(customer, row.stripe_customer_id, ctx.userId, ctx.runtime.livemode)) {
    return blocked("CHECKOUT_CUSTOMER_BLOCKED");
  }
  if (!canStartIdempotentPost(anchor, ctx.now())) {
    const unknown = await mark(ctx.runtime.checkoutStore, row, { status: "unknown" });
    if (!unknown) return reread(ctx, row, emptySession());
    return reconcileList(ctx, unknown);
  }
  try {
    const created = await ctx.runtime.stripe.createSession(row, row.idempotency_key);
    return acceptVerified(ctx, row, created);
  } catch (err) {
    if (err instanceof CheckoutTransportError) return unavailable();
    const unknown = await mark(ctx.runtime.checkoutStore, row, { status: "unknown" });
    if (!unknown) return blocked("CHECKOUT_SESSION_UNVERIFIED");
    return reconcileList(ctx, unknown);
  }
}

function emptySession(): SessionSnapshot {
  return {
    id: "",
    url: null,
    status: "expired",
    customerId: null,
    livemode: false,
    mode: null,
    clientReferenceId: null,
    metadata: {},
    successUrl: null,
    cancelUrl: null,
    lineItems: null,
    lineItemsComplete: false,
  };
}

async function subscriptionScan(runtime: CheckoutRuntime, customerId: string): Promise<SubscriptionScan | "error"> {
  try {
    return await runtime.stripe.listSubscriptions(customerId);
  } catch {
    return "error";
  }
}

async function finishParent(ctx: Ctx, row: CheckoutAttempt, result: FinishExpiringResult): Promise<Response> {
  if (result.outcome === "reserved_successor") {
    const child = await ctx.runtime.checkoutStore.findById(ctx.userId, result.successor_id);
    if (!child || child.status !== "pending" || child.idempotency_key === row.idempotency_key) return unavailable();
    return sendCreate(ctx, child);
  }
  if (result.outcome === "closed_without_successor") return blocked("CHECKOUT_SUBSCRIPTION_BLOCKED");
  return blocked();
}

async function afterConfirmedExpired(ctx: Ctx, row: CheckoutAttempt, plan: CheckoutPlan): Promise<Response> {
  const price = await verifiedPrice(ctx.runtime, plan).catch(() => null);
  if (!price) return json(422, { error: "CHECKOUT_PRICE_REJECTED" });
  const scan = await subscriptionScan(ctx.runtime, row.stripe_customer_id);
  if (scan === "error" || !scan.complete) return unavailable();
  if (scan.blocking) {
    const closed = await ctx.runtime.checkoutStore.finishExpiring({
      userId: ctx.userId,
      attemptId: row.id,
      rowVersion: row.row_version,
      stripeAccountId: row.stripe_account_id,
      action: "close_without_successor",
      closeStatus: "expired",
      successor: null,
    });
    return finishParent(ctx, row, closed);
  }
  const successorId = randomUUID();
  const urls = returnUrls(ctx.runtime.origin, successorId);
  const reserved = await ctx.runtime.checkoutStore.finishExpiring({
    userId: ctx.userId,
    attemptId: row.id,
    rowVersion: row.row_version,
    stripeAccountId: row.stripe_account_id,
    action: "reserve_successor",
    closeStatus: null,
    successor: {
      id: successorId,
      idempotency_key: randomUUID(),
      plan,
      stripe_price_id: price.id,
      unit_amount: price.unitAmount ?? 0,
      success_url: urls.success,
      cancel_url: urls.cancel,
    },
  });
  return finishParent(ctx, row, reserved);
}

async function resumeExpiring(ctx: Ctx, row: CheckoutAttempt): Promise<Response> {
  if (!row.stripe_session_id || !row.expire_idempotency_key || row.supersede_plan !== ctx.plan) return blocked();
  let session: SessionSnapshot;
  try {
    session = await ctx.runtime.stripe.retrieveSession(row.stripe_session_id);
  } catch {
    return unavailable();
  }
  if (!sessionIdentityMatches(row, session)) return blocked("CHECKOUT_SESSION_UNVERIFIED");
  if (session.status === "complete") {
    const closed = await ctx.runtime.checkoutStore.finishExpiring({
      userId: ctx.userId,
      attemptId: row.id,
      rowVersion: row.row_version,
      stripeAccountId: row.stripe_account_id,
      action: "close_without_successor",
      closeStatus: "complete",
      successor: null,
    });
    if (closed.outcome !== "closed_without_successor") return blocked();
    return blocked();
  }
  if (session.status === "expired") return afterConfirmedExpired(ctx, row, row.supersede_plan);
  const anchor = new Date(row.expire_anchor_at || row.create_anchor_at);
  let expireKey = row.expire_idempotency_key;
  let current = row;
  if (!canStartIdempotentPost(anchor, ctx.now())) {
    const rotated = await ctx.runtime.checkoutStore.compareAndSet(
      row,
      {
        expire_idempotency_key: randomUUID(),
        expire_anchor_at: ctx.now().toISOString(),
      },
      row.expire_idempotency_key
    );
    if (!rotated || !rotated.expire_idempotency_key || !rotated.expire_anchor_at) return blocked();
    if (rotated.expire_idempotency_key === row.expire_idempotency_key) return blocked();
    if (!canStartIdempotentPost(new Date(rotated.expire_anchor_at), ctx.now())) return blocked("CHECKOUT_SESSION_UNVERIFIED");
    current = rotated;
    expireKey = rotated.expire_idempotency_key;
  }
  try {
    await ctx.runtime.stripe.expireSession(current.stripe_session_id || row.stripe_session_id, expireKey);
  } catch (err) {
    if (err instanceof CheckoutTransportError) return unavailable();
    return blocked("CHECKOUT_SESSION_UNVERIFIED");
  }
  let again: SessionSnapshot;
  try {
    again = await ctx.runtime.stripe.retrieveSession(row.stripe_session_id);
  } catch {
    return unavailable();
  }
  if (!sessionIdentityMatches(row, again)) return blocked("CHECKOUT_SESSION_UNVERIFIED");
  if (again.status === "complete") {
    const closed = await ctx.runtime.checkoutStore.finishExpiring({
      userId: ctx.userId,
      attemptId: current.id,
      rowVersion: current.row_version,
      stripeAccountId: current.stripe_account_id,
      action: "close_without_successor",
      closeStatus: "complete",
      successor: null,
    });
    if (closed.outcome !== "closed_without_successor") return blocked();
    return blocked();
  }
  if (again.status === "expired") return afterConfirmedExpired(ctx, current, current.supersede_plan || ctx.plan);
  return blocked("CHECKOUT_SESSION_UNVERIFIED");
}

async function resumeOpen(ctx: Ctx, row: CheckoutAttempt): Promise<Response> {
  if (row.plan !== ctx.plan) {
    const price = await verifiedPrice(ctx.runtime, ctx.plan).catch((err) => {
      if (err instanceof CheckoutTransportError) throw err;
      return null;
    });
    if (!price) return json(422, { error: "CHECKOUT_PRICE_REJECTED" });
    const reserved = await mark(ctx.runtime.checkoutStore, row, {
      status: "expiring",
      supersede_plan: ctx.plan,
      expire_idempotency_key: randomUUID(),
      expire_anchor_at: ctx.now().toISOString(),
    });
    if (!reserved) return blocked("CHECKOUT_PLAN_IN_PROGRESS");
    return resumeExpiring(ctx, reserved);
  }
  if (!row.stripe_session_id) return blocked("CHECKOUT_SESSION_UNVERIFIED");
  let session: SessionSnapshot;
  try {
    session = await ctx.runtime.stripe.retrieveSession(row.stripe_session_id);
  } catch {
    return unavailable();
  }
  if (!sessionIdentityMatches(row, session)) return blocked("CHECKOUT_SESSION_UNVERIFIED");
  if (session.status === "open") {
    const url = hostedCheckoutUrl(session);
    const current = await ctx.runtime.checkoutStore.findById(ctx.userId, row.id);
    if (!url || !current || current.status !== "open" || current.row_version !== row.row_version) return blocked();
    if (current.stripe_session_id !== session.id || current.stripe_session_url !== url) return blocked("CHECKOUT_SESSION_UNVERIFIED");
    return json(200, { url: current.stripe_session_url });
  }
  return acceptVerified(ctx, row, session);
}

async function resume(ctx: Ctx, row: CheckoutAttempt): Promise<Response> {
  if (row.plan !== ctx.plan && row.status !== "open" && row.status !== "expiring") return blocked("CHECKOUT_PLAN_IN_PROGRESS");
  if (row.status === "complete") return blocked();
  if (row.status === "expiring") return resumeExpiring(ctx, row);
  if (row.status === "open") return resumeOpen(ctx, row);
  if (row.status === "unknown") {
    if (row.plan !== ctx.plan) return blocked("CHECKOUT_PLAN_IN_PROGRESS");
    if (row.stripe_session_id) {
      try {
        const session = await ctx.runtime.stripe.retrieveSession(row.stripe_session_id);
        return acceptVerified(ctx, row, session);
      } catch {
        return unavailable();
      }
    }
    return reconcileList(ctx, row);
  }
  if (row.stripe_session_id) {
    try {
      const session = await ctx.runtime.stripe.retrieveSession(row.stripe_session_id);
      return acceptVerified(ctx, row, session);
    } catch {
      return unavailable();
    }
  }
  return sendCreate(ctx, row);
}

async function startNew(ctx: Ctx, accountId: string): Promise<Response> {
  let price: PriceSnapshot | null;
  try {
    price = await verifiedPrice(ctx.runtime, ctx.plan);
  } catch (err) {
    if (err instanceof CheckoutTransportError) return unavailable();
    return json(422, { error: "CHECKOUT_PRICE_REJECTED" });
  }
  if (!price || price.unitAmount === null) return json(422, { error: "CHECKOUT_PRICE_REJECTED" });
  let local: PaidSubscriptionSnapshot | null;
  try {
    local = await ctx.runtime.loadSubscription(ctx.userId);
  } catch {
    return unavailable();
  }
  if (localSubscriptionBlocks(local, ctx.userId, { livemode: ctx.runtime.livemode, accountId })) {
    return blocked("CHECKOUT_SUBSCRIPTION_BLOCKED");
  }
  let binding: { userId: string; stripeCustomerId: string };
  try {
    binding = await findOrCreateBillingCustomer({
      request: ctx.request,
      resolveUserId: async () => ctx.userId,
      stripe: {
        customers: {
          create: (params, options) => ctx.runtime.stripe.createCustomer(params, options),
        },
      },
      db: ctx.runtime.customerStore,
    });
  } catch {
    return unavailable();
  }
  if (binding.userId !== ctx.userId) return blocked("CHECKOUT_CUSTOMER_BLOCKED");
  let customer: CustomerSnapshot;
  try {
    customer = await ctx.runtime.stripe.retrieveCustomer(binding.stripeCustomerId);
  } catch (err) {
    if (err instanceof CheckoutRequestError) return blocked("CHECKOUT_CUSTOMER_BLOCKED");
    return unavailable();
  }
  if (!customerMatches(customer, binding.stripeCustomerId, ctx.userId, ctx.runtime.livemode)) {
    return blocked("CHECKOUT_CUSTOMER_BLOCKED");
  }
  let recorded: Awaited<ReturnType<CheckoutRuntime["customerStore"]["recordVerifiedAccount"]>>;
  try {
    recorded = await ctx.runtime.customerStore.recordVerifiedAccount({
      userId: ctx.userId,
      stripeCustomerId: binding.stripeCustomerId,
      livemode: ctx.runtime.livemode,
      stripeAccountId: accountId,
    });
  } catch (err) {
    if (err instanceof CheckoutTransportError) return unavailable();
    return unavailable();
  }
  if (recorded === "conflict") return blocked("CHECKOUT_ACCOUNT_MISMATCH");
  if (recorded !== "recorded" && recorded !== "already_verified") return blocked("CHECKOUT_CUSTOMER_BLOCKED");
  const scan = await subscriptionScan(ctx.runtime, binding.stripeCustomerId);
  if (scan === "error" || !scan.complete) return unavailable();
  if (scan.blocking) return blocked("CHECKOUT_SUBSCRIPTION_BLOCKED");
  const row = newAttempt({
    userId: ctx.userId,
    customerId: binding.stripeCustomerId,
    accountId,
    plan: ctx.plan,
    priceId: price.id,
    unitAmount: price.unitAmount,
    livemode: ctx.runtime.livemode,
    origin: ctx.runtime.origin,
    now: ctx.now(),
  });
  try {
    await ctx.runtime.checkoutStore.insertPending(row);
  } catch (err) {
    if (err instanceof CheckoutAttemptConflict) {
      const winner = await ctx.runtime.checkoutStore.findBlocking(ctx.userId);
      if (!winner || winner.user_id !== ctx.userId) return blocked("CHECKOUT_PLAN_IN_PROGRESS");
      if (winner.stripe_account_id !== accountId || winner.livemode !== ctx.runtime.livemode) {
        return blocked("CHECKOUT_ACCOUNT_MISMATCH");
      }
      if (winner.plan !== ctx.plan) return blocked("CHECKOUT_PLAN_IN_PROGRESS");
      return resume(ctx, winner);
    }
    return unavailable();
  }
  return sendCreate(ctx, row);
}

export async function handleCheckoutPost(input: HandleCheckoutInput): Promise<Response> {
  const env = input.env ?? process.env;
  const nodeEnv = input.nodeEnv ?? process.env.NODE_ENV;
  let userId = "";
  try {
    userId = String((await input.resolveUserId(input.request)) || "");
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") return json(401, { error: "UNAUTHORIZED" });
    return unavailable();
  }
  if (!userId) return json(401, { error: "UNAUTHORIZED" });
  if (input.request.method !== "POST") return json(405, { error: "CHECKOUT_METHOD_REJECTED" });

  const origin = readCheckoutOrigin(env, nodeEnv);
  if (!origin || !requestOriginAllowed(input.request, origin)) return json(403, { error: "CHECKOUT_ORIGIN_REJECTED" });
  const body = await parsePlan(input.request);
  if (!body.ok) return json(400, { error: "CHECKOUT_BODY_REJECTED" });
  if (!input.enabled || !checkoutEnabled({ BILLING_CHECKOUT_ENABLED: input.enabled ? "true" : "" })) {
    return json(403, { error: "CHECKOUT_DISABLED" });
  }

  let runtime: CheckoutRuntime;
  try {
    runtime = await input.openRuntime();
  } catch {
    return unavailable();
  }
  if (runtime.origin !== origin || runtime.livemode !== true && nodeEnv === "production") return unavailable();

  let account: { id: string };
  try {
    account = await runtime.stripe.retrieveAccount();
  } catch {
    return unavailable();
  }
  if (!/^acct_[A-Za-z0-9]+$/.test(account.id)) return unavailable();

  const now = input.now ?? (() => new Date());
  const ctx: Ctx = { request: input.request, userId, plan: body.plan, now, runtime };
  try {
    const existing = await runtime.checkoutStore.findBlocking(userId);
    if (existing) {
      if (!accountMatches(existing, account.id, runtime.livemode)) return blocked("CHECKOUT_ACCOUNT_MISMATCH");
      return await resume(ctx, existing);
    }
    return await startNew(ctx, account.id);
  } catch (err) {
    if (err instanceof CheckoutTransportError || err instanceof CheckoutRequestError) return unavailable();
    return unavailable();
  }
}

export function enabledFromEnv(env: { readonly [key: string]: string | undefined }): boolean {
  return checkoutEnabled(env);
}
