import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { registerHooks } from "node:module";
import path from "node:path";
import { before, describe, it } from "node:test";
import { pathToFileURL } from "node:url";
import Stripe from "stripe";
import { createSupabaseBillingCustomerStore } from "./billingCustomerStore.ts";
import type { BillingCustomerQueryClient } from "./billingCustomerStore.ts";
import { handleCheckoutPost } from "./checkoutSession.ts";
import {
  CheckoutAttemptConflict,
  type CheckoutAttempt,
  type CheckoutStore,
} from "./checkoutStore.ts";
import { limitedProcessEnv } from "./limitedProcessEnv.ts";
import { PAID_SUBSCRIPTION_COLUMNS, type PaidSubscriptionSnapshot } from "./paidPlan.ts";
import {
  basicInvoiceSnapshot,
  createServiceRoleEventStore,
  invoicePaymentSnapshot,
  signSnapshot,
} from "./paidCheckoutSandbox.ts";
import type { CheckoutStripe, SessionSnapshot } from "./stripeCheckout.ts";
import { handleStripeWebhook, STRIPE_WEBHOOK_API_VERSION } from "./stripeWebhook.ts";

/**
 * Isolated chain: mocked NextAuth session -> checkout handler -> signed webhook
 * handler -> exported GET /api/billing/entitlement.
 *
 * Test boundaries, not a real login and not a Stripe API call:
 * - getServerSession is mocked. The same session object is what requireUserId reads
 *   for checkout and for the exported GET.
 * - CheckoutStripe is an in-memory double. It never opens a network connection.
 * - Supabase JS is replaced by a service-role psql read. The isolated runner has no
 *   PostgREST. The exported GET, loadPaidSubscription, and getPaidPlan still run,
 *   and the row they read is the row the webhook wrote.
 *
 * The production checkout route is not called. It still forces livemode true.
 * This test injects livemode false into the existing handler, which already allows
 * that outside production. The webhook handler still rejects livemode true.
 *
 * charge.refunded is posted while the subscription is active and paid_until is
 * still far in the future. Basic, status, and paid_until staying put is the
 * current behavior. It is not an accepted customer policy.
 *
 * Immediate cancellation is a deleted subscription with status canceled, posted
 * while that same subscription is still active and paid. Period expiry is a
 * separate past_due subscription. Only that case sleeps, and its clock starts
 * after its own checkout.
 */

const root = process.env.BILLING_CUSTOMER_PGROOT || "";
const host = process.env.BILLING_CUSTOMER_PGHOST || "";
const port = process.env.BILLING_CUSTOMER_PGPORT || "";
const user = process.env.BILLING_CUSTOMER_PGUSER || "";
const data = process.env.BILLING_CUSTOMER_PGDATA || "";
const database = "billing_entitlement_chain";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const USER_C = "33333333-3333-4333-8333-333333333333";
const ORIGIN = "https://app.example";

type Subject = {
  userId: string;
  customerId: string;
  subscriptionId: string;
};

const SUBJECT_A: Subject = {
  userId: USER_A,
  customerId: "cus_chainA",
  subscriptionId: "sub_chainA",
};
const SUBJECT_C: Subject = {
  userId: USER_C,
  customerId: "cus_chainC",
  subscriptionId: "sub_chainC",
};
const PRICE_BASIC = "price_basic";
const PRICE_PRO = "price_pro";
const PRICE_ELITE = "price_elite";
const SECRET = "whsec_localentitlement";
const ACCOUNT = "acct_chain";

function refuse(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!root || !host || !port || !user || !data) {
  refuse("Isolated Postgres is not configured. Run npm run test:billing-paid-entitlement.");
}
if (
  !root.includes(`${path.sep}billing-customer-pg-`) ||
  path.resolve(host) !== path.resolve(root, "sock") ||
  path.resolve(data) !== path.resolve(root, "data") ||
  port === "5432"
) {
  refuse("Refusing to continue: Postgres settings are not the isolated instance created for this command.");
}

type SessionState = { user?: { id?: string } } | null;

type ChainBridge = {
  session: SessionState;
  readSubscription: (userId: string, columns: string) => PaidSubscriptionSnapshot | null;
};

const bridge: ChainBridge = {
  session: null,
  readSubscription: () => {
    throw new Error("subscription read is not ready");
  },
};

(globalThis as typeof globalThis & { __autoaffiPaidChain: ChainBridge }).__autoaffiPaidChain = bridge;

const repoRoot = path.resolve(import.meta.dirname, "../..");

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next-auth/next") {
      return { url: "teststub:paid-chain-next-auth", shortCircuit: true };
    }
    if (specifier === "next-auth/providers/google") {
      return { url: "teststub:paid-chain-google", shortCircuit: true };
    }
    if (specifier === "@supabase/supabase-js") {
      return { url: "teststub:paid-chain-supabase", shortCircuit: true };
    }
    if (specifier.startsWith("@/")) {
      const abs = path.join(repoRoot, `${specifier.slice(2)}.ts`);
      return { url: pathToFileURL(abs).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === "teststub:paid-chain-next-auth") {
      return {
        format: "module",
        shortCircuit: true,
        source: "export async function getServerSession(){ return globalThis.__autoaffiPaidChain.session; }\n",
      };
    }
    if (url === "teststub:paid-chain-google") {
      return {
        format: "module",
        shortCircuit: true,
        source: "export default function GoogleProvider(){ return { id: 'google' }; }\n",
      };
    }
    if (url === "teststub:paid-chain-supabase") {
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
              return {
                async maybeSingle() {
                  const state = globalThis.__autoaffiPaidChain;
                  if (table !== "billing_subscriptions" || column !== "user_id") {
                    return { data: null, error: { message: "unexpected entitlement query" } };
                  }
                  try {
                    return { data: state.readSubscription(String(value), String(columns)), error: null };
                  } catch (err) {
                    return { data: null, error: { message: err instanceof Error ? err.message : "read failed" } };
                  }
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
const { requireUserId } = await import("../auth/server.ts");

function psqlEnv(): NodeJS.ProcessEnv {
  return limitedProcessEnv(process.env);
}

function psql(dbName: string, sql: string): string {
  return execFileSync(
    "psql",
    ["-h", host, "-p", port, "-U", user, "-d", dbName, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", sql],
    { encoding: "utf8", env: psqlEnv() }
  ).trim();
}

function psqlFile(dbName: string, file: string) {
  execFileSync(
    "psql",
    ["-h", host, "-p", port, "-U", user, "-d", dbName, "-X", "-v", "ON_ERROR_STOP=1", "-f", file],
    { stdio: "pipe", env: psqlEnv() }
  );
}

function psqlTry(sql: string): { ok: boolean; stdout: string; stderr: string } {
  try {
    return { ok: true, stdout: psql(database, sql), stderr: "" };
  } catch (err) {
    const error = err as { stdout?: string; stderr?: string };
    return { ok: false, stdout: String(error.stdout || ""), stderr: String(error.stderr || "") };
  }
}

function quote(value: string): string {
  const tag = `q${randomBytes(4).toString("hex")}`;
  if (value.includes(`$${tag}$`)) throw new Error("refusing to quote");
  return `$${tag}$${value}$${tag}$`;
}

function serviceText(sql: string): string {
  const text = psql(
    database,
    `begin; select set_config('role', 'service_role', true); ${sql}; commit;`
  );
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && line !== "service_role")
    .join("\n");
}

bridge.readSubscription = (userId, columns) => {
  if (columns !== PAID_SUBSCRIPTION_COLUMNS) throw new Error("unexpected entitlement columns");
  if (userId !== USER_A && userId !== USER_B && userId !== USER_C) throw new Error("unexpected entitlement user");
  const line = serviceText(
    `select row_to_json(t) from (select ${PAID_SUBSCRIPTION_COLUMNS} from public.billing_subscriptions where user_id = ${quote(userId)}::uuid) t`
  );
  return line ? (JSON.parse(line) as PaidSubscriptionSnapshot) : null;
};

function paidUntilEpoch(userId: string): string {
  return serviceText(
    `select coalesce(trunc(extract(epoch from paid_until))::text, '') from public.billing_subscriptions where user_id = ${quote(userId)}::uuid`
  );
}

function subscriptionFacts(userId: string): string {
  return serviceText(
    `select coalesce(subscription_status, '') || '|' || case when cancel_at_period_end then 'yes' else 'no' end || '|' || coalesce(trunc(extract(epoch from paid_until))::text, '') from public.billing_subscriptions where user_id = ${quote(userId)}::uuid`
  );
}

const webhookEnv = {
  NODE_ENV: "test",
  VERCEL_ENV: "preview",
  STRIPE_WEBHOOK_SECRET_TEST: SECRET,
  STRIPE_PRICE_BASIC_TEST: PRICE_BASIC,
  STRIPE_PRICE_PRO_TEST: PRICE_PRO,
  STRIPE_PRICE_ELITE_TEST: PRICE_ELITE,
};

async function postSigned(signed: { raw: string; header: string }): Promise<string> {
  const response = await handleStripeWebhook({
    request: new Request(`${ORIGIN}/api/billing/webhook`, {
      method: "POST",
      headers: { "stripe-signature": signed.header },
      body: signed.raw,
    }),
    enabled: true,
    env: webhookEnv,
    constructEvent: (payload, header, secret) => Stripe.webhooks.constructEvent(payload, header, secret),
    openStore: async () => createServiceRoleEventStore((sql) => psql(database, sql)),
  });
  const body = (await response.json()) as { outcome?: string; error?: string };
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(typeof body.outcome, "string");
  return String(body.outcome);
}

function entitlementRequest(sessionUser: string): Request {
  const claimed = sessionUser === USER_A ? USER_B : USER_A;
  const url = new URL(`${ORIGIN}/api/billing/entitlement`);
  url.searchParams.set("user_id", claimed);
  url.searchParams.set("plan", "elite");
  return new Request(url, {
    method: "GET",
    headers: {
      host: "app.example",
      "x-autoaffi-user-id": claimed,
      "x-user-id": claimed,
    },
  });
}

async function planFor(userId: string): Promise<string> {
  bridge.session = { user: { id: userId } };
  const response = await GET(entitlementRequest(userId));
  const body = (await response.json()) as { plan?: string };
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  return String(body.plan);
}

function customerClient(): BillingCustomerQueryClient {
  return {
    from() {
      return {
        select() {
          return {
            eq(column, value) {
              return {
                async maybeSingle() {
                  if (column !== "user_id" && column !== "stripe_customer_id") {
                    return { data: null, error: { message: "unexpected customer column" } };
                  }
                  const cast = column === "user_id" ? "::uuid" : "";
                  const line = serviceText(
                    `select user_id::text || '|' || stripe_customer_id from public.billing_stripe_customers where ${column} = ${quote(value)}${cast}`
                  );
                  if (!line) return { data: null, error: null };
                  const [user_id, stripe_customer_id] = line.split("|");
                  return { data: { user_id, stripe_customer_id }, error: null };
                },
              };
            },
          };
        },
        async insert(row) {
          const result = psqlTry(
            `begin; select set_config('role', 'service_role', true); insert into public.billing_stripe_customers (user_id, stripe_customer_id) values (${quote(row.user_id)}::uuid, ${quote(row.stripe_customer_id)}); commit;`
          );
          if (result.ok) return { error: null };
          if (/23505/.test(result.stderr)) return { error: { code: "23505", message: result.stderr } };
          return { error: { message: result.stderr || "insert failed" } };
        },
      };
    },
  };
}

function checkoutStore(): CheckoutStore {
  const columns =
    "id,user_id,row_version,status,idempotency_key,create_anchor_at,stripe_customer_id,stripe_account_id,plan,stripe_price_id,unit_amount,currency,quantity,livemode,success_url,cancel_url,mode,adaptive_pricing_enabled,automatic_tax_enabled,stripe_session_id,stripe_session_url,observed_late_session_id,supersede_plan,expire_idempotency_key,expire_anchor_at,successor_attempt_id";
  function read(where: string): CheckoutAttempt | null {
    const line = psql(
      database,
      `select row_to_json(t) from (select ${columns} from public.billing_checkout_sessions where ${where} limit 1) t`
    );
    return line ? (JSON.parse(line) as CheckoutAttempt) : null;
  }
  return {
    async findBlocking(userId) {
      return read(`user_id = ${quote(userId)}::uuid and status in ('pending','open','unknown','expiring','complete')`);
    },
    async findById(userId, attemptId) {
      return read(`user_id = ${quote(userId)}::uuid and id = ${quote(attemptId)}::uuid`);
    },
    async insertPending(row) {
      try {
        psql(
          database,
          `insert into public.billing_checkout_sessions (${columns}) values (
            ${quote(row.id)}::uuid, ${quote(row.user_id)}::uuid, ${row.row_version}, ${quote(row.status)}, ${quote(row.idempotency_key)}::uuid,
            ${quote(row.create_anchor_at)}::timestamptz, ${quote(row.stripe_customer_id)}, ${quote(row.stripe_account_id)}, ${quote(row.plan)},
            ${quote(row.stripe_price_id)}, ${row.unit_amount}, 'usd', 1, ${row.livemode}, ${quote(row.success_url)}, ${quote(row.cancel_url)},
            'subscription', false, false, null, null, null, null, null, null, null
          )`
        );
      } catch (err) {
        const error = err as { stderr?: string; message?: string };
        const text = `${error.stderr || ""}\n${error.message || ""}`;
        if (/23505|duplicate key|unique/i.test(text)) throw new CheckoutAttemptConflict();
        throw err;
      }
    },
    async compareAndSet(row, patch, expectedExpireKey) {
      const sets = Object.entries(patch).map(([column, value]) => {
        if (value === null) return `${column} = null`;
        if (typeof value === "number" || typeof value === "boolean") return `${column} = ${value}`;
        return `${column} = ${quote(String(value))}`;
      });
      sets.push("row_version = row_version + 1", "updated_at = clock_timestamp()");
      const expire =
        expectedExpireKey === undefined ? "" : ` and expire_idempotency_key = ${quote(expectedExpireKey)}::uuid`;
      psql(
        database,
        `update public.billing_checkout_sessions set ${sets.join(", ")} where id = ${quote(row.id)}::uuid and user_id = ${quote(row.user_id)}::uuid and status = ${quote(row.status)} and row_version = ${row.row_version}${expire}`
      );
      const next = await this.findById(row.user_id, row.id);
      if (!next || next.row_version !== row.row_version + 1) return null;
      return next;
    },
    async finishExpiring() {
      return { outcome: "conflict" };
    },
  };
}

function hostedSession(row: CheckoutAttempt): SessionSnapshot {
  const id = `cs_${row.stripe_customer_id.replace(/^cus_/, "")}`;
  return {
    id,
    url: `https://checkout.stripe.com/c/pay/${id}`,
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
  };
}

function priceSnapshot() {
  return {
    id: PRICE_BASIC,
    active: true,
    currency: "usd",
    livemode: false,
    type: "recurring",
    billingScheme: "per_unit" as const,
    unitAmount: 700,
    customUnitAmount: false,
    interval: "month",
    intervalCount: 1,
    usageType: "licensed",
    meter: null,
  };
}

type CreatedCustomer = {
  metadata: { user_id: string };
  idempotencyKey: string;
};

function stripeDouble(subject: Subject): CheckoutStripe & { created: CreatedCustomer[] } {
  const created: CreatedCustomer[] = [];
  return {
    created,
    async retrieveAccount() {
      return { id: ACCOUNT };
    },
    async retrievePrice(priceId) {
      if (priceId !== PRICE_BASIC) throw new Error("unexpected price");
      return priceSnapshot();
    },
    async retrieveCustomer(id) {
      if (id !== subject.customerId) throw new Error("unexpected customer");
      return { id, deleted: false, livemode: false, userId: subject.userId };
    },
    async createCustomer(params, options) {
      created.push({ metadata: params.metadata, idempotencyKey: options.idempotencyKey });
      return { id: subject.customerId };
    },
    async listSubscriptions() {
      return { complete: true, blocking: false };
    },
    async createSession(row) {
      return hostedSession(row);
    },
    async retrieveSession() {
      throw new Error("retrieveSession was not part of this chain");
    },
    async listSessions() {
      return { complete: true, sessions: [] };
    },
    async expireSession() {
      throw new Error("expireSession was not part of this chain");
    },
  };
}

function invoiceIds(subject: Subject, input: {
  eventId: string;
  invoiceId: string;
  paymentIntentId: string;
  invoicePaymentId: string;
  periodStart: number;
  periodEnd: number;
  created: number;
}) {
  return {
    ...input,
    customerId: subject.customerId,
    subscriptionId: subject.subscriptionId,
    priceId: PRICE_BASIC,
  };
}

function statusEvent(subject: Subject, input: {
  eventId: string;
  status: string;
  created: number;
  cancel: boolean;
  deleted?: boolean;
}): Record<string, unknown> {
  return {
    id: input.eventId,
    object: "event",
    api_version: STRIPE_WEBHOOK_API_VERSION,
    created: input.created,
    livemode: false,
    type: input.deleted ? "customer.subscription.deleted" : "customer.subscription.updated",
    data: {
      object: {
        id: subject.subscriptionId,
        object: "subscription",
        customer: subject.customerId,
        status: input.status,
        cancel_at_period_end: input.cancel,
        metadata: { user_id: subject.userId },
      },
    },
  };
}

function refundEvent(created: number): Record<string, unknown> {
  return {
    id: "evt_refund1",
    object: "event",
    api_version: STRIPE_WEBHOOK_API_VERSION,
    created,
    livemode: false,
    type: "charge.refunded",
    data: { object: { id: "ch_chain1", object: "charge", amount_refunded: 700 } },
  };
}

const DAY_SECONDS = 24 * 60 * 60;
const CLEAR_FUTURE_MS = 20 * DAY_SECONDS * 1000;
const EXPIRY_PERIOD_SECONDS = 30;
const EXPIRY_MARGIN_MS = 15_000;
const AFTER_EXPIRY_MS = 1_500;
const MAX_EXPIRY_WAIT_MS = 45_000;

function remainingMs(unixSeconds: number): number {
  return unixSeconds * 1000 - Date.now();
}

function assertClearlyFuture(unixSeconds: number, label: string) {
  const remaining = remainingMs(unixSeconds);
  assert.ok(remaining > CLEAR_FUTURE_MS, `${label} has ${remaining}ms left, which is not a long future period`);
}

function assertMargin(unixSeconds: number, minimumMs: number, label: string) {
  const remaining = remainingMs(unixSeconds);
  assert.ok(remaining >= minimumMs, `${label} has ${remaining}ms left, below the ${minimumMs}ms margin`);
}

async function waitUntilAfter(unixSeconds: number) {
  const delay = remainingMs(unixSeconds) + AFTER_EXPIRY_MS;
  assert.ok(delay <= MAX_EXPIRY_WAIT_MS, `expiry wait would be ${delay}ms`);
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  assert.ok(Date.now() > unixSeconds * 1000, "the clock has not passed paid_until");
}

async function startCheckout(subject: Subject): Promise<void> {
  bridge.session = { user: { id: subject.userId } };
  assert.equal(
    psql(database, `select count(*) from public.billing_stripe_customers where user_id = ${quote(subject.userId)}::uuid`),
    "0"
  );
  const stripe = stripeDouble(subject);
  const checkout = await handleCheckoutPost({
    request: new Request(`${ORIGIN}/api/billing/checkout`, {
      method: "POST",
      headers: {
        origin: ORIGIN,
        host: "app.example",
        "sec-fetch-site": "same-origin",
        "content-type": "application/json",
        "x-autoaffi-user-id": USER_B,
        "x-user-id": USER_B,
      },
      body: JSON.stringify({ plan: "basic" }),
    }),
    resolveUserId: requireUserId,
    enabled: true,
    env: { NEXT_PUBLIC_APP_URL: ORIGIN },
    nodeEnv: "test",
    openRuntime: async () => ({
      origin: ORIGIN,
      prices: { basic: PRICE_BASIC, pro: PRICE_PRO, elite: PRICE_ELITE },
      livemode: false,
      loadSubscription: async () => null,
      customerStore: createSupabaseBillingCustomerStore(customerClient()),
      checkoutStore: checkoutStore(),
      stripe,
    }),
  });
  const checkoutBody = (await checkout.json()) as { url?: string; error?: string };
  assert.equal(checkout.status, 200, JSON.stringify(checkoutBody));
  assert.equal(checkoutBody.url, `https://checkout.stripe.com/c/pay/cs_${subject.customerId.replace(/^cus_/, "")}`);
  assert.equal(stripe.created.length, 1);
  assert.deepEqual(stripe.created[0].metadata, { user_id: subject.userId });
  assert.equal(stripe.created[0].idempotencyKey, `billing-customer:${subject.userId}`);
  assert.equal(
    psql(
      database,
      `select user_id::text || '|' || stripe_customer_id from public.billing_stripe_customers where user_id = ${quote(subject.userId)}::uuid`
    ),
    `${subject.userId}|${subject.customerId}`
  );
}

function rememberFlags(): { webhook: string | undefined; checkout: string | undefined } {
  return {
    webhook: process.env.BILLING_WEBHOOK_ENABLED,
    checkout: process.env.BILLING_CHECKOUT_ENABLED,
  };
}

function assertFlagsUnchanged(flags: { webhook: string | undefined; checkout: string | undefined }) {
  assert.equal(process.env.BILLING_WEBHOOK_ENABLED, flags.webhook);
  assert.equal(process.env.BILLING_CHECKOUT_ENABLED, flags.checkout);
}

describe("paid entitlement chain", { concurrency: 1 }, () => {
  before(() => {
    assert.equal(psql("postgres", "select current_setting('data_directory')"), data);
    assert.equal(psql("postgres", "select inet_server_addr() is null"), "t");
    psql("postgres", `create database ${database}`);
    psql(
      database,
      `
        create schema if not exists auth;
        create table auth.users (id uuid primary key);
        create role anon nologin nobypassrls;
        create role authenticated nologin nobypassrls;
        create role service_role nologin bypassrls;
      `
    );
    psql(
      database,
      `insert into auth.users (id) values (${quote(USER_A)}::uuid), (${quote(USER_B)}::uuid), (${quote(USER_C)}::uuid)`
    );
    psqlFile(database, "supabase/migrations/20261101_billing_paid_plan.sql");
    psqlFile(database, "supabase/migrations/20261102_billing_stripe_customers.sql");
    psqlFile(database, "supabase/migrations/20261106_billing_checkout_sessions.sql");
    psqlFile(database, "supabase/migrations/20261112_billing_stripe_events.sql");
    psqlFile(database, "supabase/migrations/20261117_billing_invoice_payment_proof.sql");
  });

  it("keeps access through refund and renewal, then removes it when an active subscription is deleted", { timeout: 30_000 }, async () => {
    const flags = rememberFlags();
    await startCheckout(SUBJECT_A);

    const started = Math.floor(Date.now() / 1000);
    const period1Start = started - DAY_SECONDS;
    const period1End = started + 30 * DAY_SECONDS;
    const period2Start = period1End;
    const period2End = started + 60 * DAY_SECONDS;
    const firstInvoice = signSnapshot(
      SECRET,
      basicInvoiceSnapshot(
        invoiceIds(SUBJECT_A, {
          eventId: "evt_firstinvoice",
          invoiceId: "in_chain1",
          paymentIntentId: "pi_chain1",
          invoicePaymentId: "inpay_chain1",
          periodStart: period1Start,
          periodEnd: period1End,
          created: started + 1,
        })
      )
    );
    assert.equal(await postSigned(firstInvoice), "invoice_awaiting_payment");
    assert.equal(paidUntilEpoch(USER_A), "");
    assert.equal(await planFor(USER_A), "none");
    assert.equal(await planFor(USER_B), "none");

    const firstPayment = signSnapshot(
      SECRET,
      invoicePaymentSnapshot(
        invoiceIds(SUBJECT_A, {
          eventId: "evt_firstpayment",
          invoiceId: "in_chain1",
          paymentIntentId: "pi_chain1",
          invoicePaymentId: "inpay_chain1",
          periodStart: period1Start,
          periodEnd: period1End,
          created: started + 2,
        })
      )
    );
    assert.equal(await postSigned(firstPayment), "invoice_applied");
    assert.equal(subscriptionFacts(USER_A), `incomplete|no|${period1End}`);
    assert.equal(await planFor(USER_A), "none");

    assert.equal(
      await postSigned(
        signSnapshot(
          SECRET,
          statusEvent(SUBJECT_A, { eventId: "evt_firststatus", status: "active", created: started + 3, cancel: false })
        )
      ),
      "status_applied"
    );
    assertClearlyFuture(period1End, "first grant");
    assert.equal(subscriptionFacts(USER_A), `active|no|${period1End}`);
    assert.equal(await planFor(USER_A), "basic");
    assert.equal(await planFor(USER_B), "none");

    assertClearlyFuture(period1End, "refund while active");
    assert.equal(await postSigned(signSnapshot(SECRET, refundEvent(started + 4))), "refund_not_applied");
    assert.equal(subscriptionFacts(USER_A), `active|no|${period1End}`);
    assert.equal(paidUntilEpoch(USER_A), String(period1End));
    assert.equal(await planFor(USER_A), "basic");
    assert.equal(await planFor(USER_B), "none");

    const renewalInvoice = signSnapshot(
      SECRET,
      basicInvoiceSnapshot(
        invoiceIds(SUBJECT_A, {
          eventId: "evt_renewinvoice",
          invoiceId: "in_chain2",
          paymentIntentId: "pi_chain2",
          invoicePaymentId: "inpay_chain2",
          periodStart: period2Start,
          periodEnd: period2End,
          created: started + 5,
        }),
        (invoice) => {
          invoice.billing_reason = "subscription_cycle";
        }
      )
    );
    assert.equal(await postSigned(renewalInvoice), "invoice_awaiting_payment");
    assert.equal(paidUntilEpoch(USER_A), String(period1End));
    const renewalPayment = signSnapshot(
      SECRET,
      invoicePaymentSnapshot(
        invoiceIds(SUBJECT_A, {
          eventId: "evt_renewpayment",
          invoiceId: "in_chain2",
          paymentIntentId: "pi_chain2",
          invoicePaymentId: "inpay_chain2",
          periodStart: period2Start,
          periodEnd: period2End,
          created: started + 6,
        })
      )
    );
    assert.equal(await postSigned(renewalPayment), "invoice_applied");
    assert.equal(paidUntilEpoch(USER_A), String(period2End));
    assert.ok(period2End > period1End);
    assertClearlyFuture(period2End, "renewed period");
    assert.equal(await planFor(USER_A), "basic");
    assert.equal(await planFor(USER_B), "none");

    assert.equal(await postSigned(renewalInvoice), "duplicate");
    assert.equal(await postSigned(renewalPayment), "duplicate");
    assert.equal(paidUntilEpoch(USER_A), String(period2End));
    assert.equal(
      serviceText(`select count(*) from public.billing_stripe_invoices where user_id = ${quote(USER_A)}::uuid`),
      "2"
    );
    assert.equal(await planFor(USER_A), "basic");

    assert.equal(
      await postSigned(
        signSnapshot(
          SECRET,
          statusEvent(SUBJECT_A, { eventId: "evt_cancelend", status: "active", created: started + 7, cancel: true })
        )
      ),
      "status_applied"
    );
    assert.equal(subscriptionFacts(USER_A), `active|yes|${period2End}`);
    assertClearlyFuture(period2End, "period-end cancellation");
    assert.equal(await planFor(USER_A), "basic");
    assert.equal(await planFor(USER_B), "none");

    assert.equal(subscriptionFacts(USER_A), `active|yes|${period2End}`);
    assert.equal(await planFor(USER_A), "basic");
    assert.equal(
      await postSigned(
        signSnapshot(
          SECRET,
          statusEvent(SUBJECT_A, {
            eventId: "evt_canceled",
            status: "canceled",
            created: started + 8,
            cancel: false,
            deleted: true,
          })
        )
      ),
      "status_applied"
    );
    assert.equal(subscriptionFacts(USER_A), `canceled|no|${period2End}`);
    assert.equal(paidUntilEpoch(USER_A), String(period2End));
    assertClearlyFuture(period2End, "paid time after immediate cancellation");
    assert.equal(await planFor(USER_A), "none");
    assert.equal(await planFor(USER_B), "none");
    assertFlagsUnchanged(flags);
  });

  it("drops past_due access only after that subscription's own paid period ends", { timeout: 60_000 }, async () => {
    const flags = rememberFlags();
    await startCheckout(SUBJECT_C);

    const started = Math.floor(Date.now() / 1000);
    const periodStart = started - DAY_SECONDS;
    const periodEnd = started + EXPIRY_PERIOD_SECONDS;
    const invoice = signSnapshot(
      SECRET,
      basicInvoiceSnapshot(
        invoiceIds(SUBJECT_C, {
          eventId: "evt_expiryinvoice",
          invoiceId: "in_expiry1",
          paymentIntentId: "pi_expiry1",
          invoicePaymentId: "inpay_expiry1",
          periodStart,
          periodEnd,
          created: started + 1,
        })
      )
    );
    const payment = signSnapshot(
      SECRET,
      invoicePaymentSnapshot(
        invoiceIds(SUBJECT_C, {
          eventId: "evt_expirypayment",
          invoiceId: "in_expiry1",
          paymentIntentId: "pi_expiry1",
          invoicePaymentId: "inpay_expiry1",
          periodStart,
          periodEnd,
          created: started + 2,
        })
      )
    );
    assert.equal(await postSigned(invoice), "invoice_awaiting_payment");
    assert.equal(paidUntilEpoch(USER_C), "");
    assert.equal(await postSigned(payment), "invoice_applied");
    assert.equal(
      await postSigned(
        signSnapshot(
          SECRET,
          statusEvent(SUBJECT_C, { eventId: "evt_expirystatus", status: "active", created: started + 3, cancel: false })
        )
      ),
      "status_applied"
    );
    assertMargin(periodEnd, EXPIRY_MARGIN_MS, "expiry subscription before past_due");
    assert.equal(await planFor(USER_C), "basic");

    assert.equal(
      await postSigned(
        signSnapshot(
          SECRET,
          statusEvent(SUBJECT_C, { eventId: "evt_expirypastdue", status: "past_due", created: started + 4, cancel: false })
        )
      ),
      "status_applied"
    );
    assertMargin(periodEnd, EXPIRY_MARGIN_MS, "past_due before its own period ends");
    assert.equal(subscriptionFacts(USER_C), `past_due|no|${periodEnd}`);
    assert.equal(await planFor(USER_C), "basic");
    assert.equal(await planFor(USER_A), "none");
    assert.equal(await planFor(USER_B), "none");

    await waitUntilAfter(periodEnd);
    assert.equal(subscriptionFacts(USER_C), `past_due|no|${periodEnd}`);
    assert.equal(paidUntilEpoch(USER_C), String(periodEnd));
    assert.equal(await planFor(USER_C), "none");
    assert.equal(await planFor(USER_A), "none");
    assert.equal(await planFor(USER_B), "none");
    assert.match(subscriptionFacts(USER_A), /^canceled\|no\|/);
    assertClearlyFuture(Number(paidUntilEpoch(USER_A)), "user A after the separate expiry case");
    assertFlagsUnchanged(flags);
  });
});
