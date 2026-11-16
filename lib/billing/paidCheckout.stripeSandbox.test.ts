import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmodSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import type { BillingCustomerStore } from "./billingCustomer";
import { handleCheckoutPost } from "./checkoutSession";
import type { CheckoutAttempt, CheckoutStore, FinishExpiringInput, FinishExpiringResult } from "./checkoutStore";
import { limitedProcessEnv } from "./limitedProcessEnv";
import { getPaidPlan, type PaidSubscriptionSnapshot } from "./paidPlan";
import {
  PAID_SANDBOX_API_VERSION,
  PAID_SANDBOX_CLEANUP_RESERVE_MS,
  PAID_SANDBOX_CLOSE_TIMEOUT_MS,
  PAID_SANDBOX_PROCESS_EXIT_RESERVE_MS,
  PAID_SANDBOX_REPLAY_TIMEOUT_MS,
  PAID_SANDBOX_RIG_TIMEOUT_MS,
  PAID_SANDBOX_WEBHOOK_PORT,
  createPaidWebhookServer,
  createServiceRoleEventStore,
  listenerGate,
  paidSandboxPaymentDeadline,
  paymentChainAccepted,
  postSignedEvent,
  replayHeaderDecision,
  type PaidWebhookServer,
} from "./paidCheckoutSandbox";
import { createStripeCheckoutClient, type CheckoutStripe } from "./stripeCheckout";
import {
  assertKeyFileOutsideRepo,
  captureCustomerCreate,
  cleanupPaidCheckout,
  createCaptureBag,
  safeStripeId,
  SandboxError,
  withCapturedCustomers,
  withTimeout,
  type CaptureBag,
  type PaidCheckoutSessionView,
  type PaidSubscriptionView,
} from "./stripeSandbox";

const root = process.env.BILLING_CUSTOMER_PGROOT || "";
const host = process.env.BILLING_CUSTOMER_PGHOST || "";
const pgPort = process.env.BILLING_CUSTOMER_PGPORT || "";
const dbUser = process.env.BILLING_CUSTOMER_PGUSER || "";
const data = process.env.BILLING_CUSTOMER_PGDATA || "";
const database = "billing_paid_sandbox";
const key = process.env.STRIPE_SANDBOX_SECRET_KEY || "";
const webhookSecret = process.env.STRIPE_SANDBOX_WEBHOOK_SECRET || "";
const prices = {
  basic: process.env.STRIPE_SANDBOX_PRICE_BASIC || "",
  pro: process.env.STRIPE_SANDBOX_PRICE_PRO || "",
  elite: process.env.STRIPE_SANDBOX_PRICE_ELITE || "",
};
const ORIGIN = "https://sandbox.autoaffi.test";
const processStartedAt = Date.now();
const paymentDeadline = paidSandboxPaymentDeadline(processStartedAt);
const cleanupDeadline = processStartedAt + PAID_SANDBOX_RIG_TIMEOUT_MS - PAID_SANDBOX_PROCESS_EXIT_RESERVE_MS;

function refuse(code: string): never {
  console.error(code);
  process.exit(1);
}

if (!root || !host || !pgPort || !dbUser || !data) refuse("STRIPE_SANDBOX_ISOLATION_REQUIRED");
if (
  !root.includes(`${path.sep}billing-customer-pg-`) ||
  path.resolve(host) !== path.resolve(root, "sock") ||
  path.resolve(data) !== path.resolve(root, "data") ||
  pgPort === "5432"
) {
  refuse("STRIPE_SANDBOX_ISOLATION_REJECTED");
}
if (!/^sk_test_[A-Za-z0-9]+$/.test(key)) refuse("STRIPE_SANDBOX_KEY_REJECTED");
if (!/^whsec_[A-Za-z0-9]+$/.test(webhookSecret)) refuse("STRIPE_SANDBOX_WEBHOOK_SECRET_REJECTED");
if (Object.values(prices).some((value) => !/^price_[A-Za-z0-9]+$/.test(value)) || new Set(Object.values(prices)).size !== 3) {
  refuse("STRIPE_SANDBOX_PRICE_REJECTED");
}
for (const name of ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "STRIPE_SECRET_KEY", "DATABASE_URL", "STRIPE_WEBHOOK_SECRET", "STRIPE_WEBHOOK_SECRET_TEST"]) {
  if (name in process.env) refuse("STRIPE_SANDBOX_APP_ENV_PRESENT");
}

function quote(value: string): string {
  return `$$${value}$$`;
}

function psql(dbName: string, sql: string): string {
  try {
    return execFileSync(
      "psql",
      ["-h", host, "-p", pgPort, "-U", dbUser, "-d", dbName, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", sql],
      { encoding: "utf8", env: limitedProcessEnv(process.env), timeout: 15_000 }
    ).trim();
  } catch {
    throw new SandboxError("STRIPE_SANDBOX_DB_FAILED", { operation: "psql" });
  }
}

function psqlFile(dbName: string, file: string) {
  try {
    execFileSync(
      "psql",
      ["-h", host, "-p", pgPort, "-U", dbUser, "-d", dbName, "-X", "-v", "ON_ERROR_STOP=1", "-f", file],
      { stdio: "pipe", env: limitedProcessEnv(process.env), timeout: 15_000 }
    );
  } catch {
    throw new SandboxError("STRIPE_SANDBOX_DB_FAILED", { operation: "psql" });
  }
}

function serviceSql(statement: string): string {
  return `begin; set local role service_role; ${statement}; commit;`;
}

function snapshot(userId: string): PaidSubscriptionSnapshot | null {
  const line = psql(
    database,
    serviceSql(`select coalesce(user_id::text, '') || '|' || coalesce(paid_plan, '') || '|' || coalesce(subscription_status, '') || '|' || coalesce(trunc(extract(epoch from paid_until))::text, '') from public.billing_subscriptions where user_id = ${quote(userId)}::uuid`)
  );
  if (!line) return null;
  const [user_id, paid_plan, subscription_status, paidUntilEpoch] = line.split("|");
  const epoch = Number(paidUntilEpoch);
  return {
    user_id,
    paid_plan,
    subscription_status,
    paid_until: paidUntilEpoch && Number.isFinite(epoch) ? new Date(epoch * 1000).toISOString() : "",
  };
}

function idOf(value: string | { id?: string | null } | null | undefined): string | null {
  if (typeof value === "string") return value;
  return value && typeof value.id === "string" ? value.id : null;
}

function viewSession(session: Stripe.Checkout.Session): PaidCheckoutSessionView {
  return {
    id: session.id,
    customerId: idOf(session.customer),
    livemode: session.livemode,
    status: session.status || "",
    clientReferenceId: session.client_reference_id,
    attemptId: session.metadata?.attempt_id ?? null,
    subscriptionId: idOf(session.subscription),
  };
}

function viewSubscription(subscription: Stripe.Subscription): PaidSubscriptionView {
  return {
    id: subscription.id,
    customerId: idOf(subscription.customer),
    livemode: subscription.livemode,
    status: subscription.status,
  };
}

function customerStore(): BillingCustomerStore {
  return {
    async findByUserId(userId) {
      const stripeCustomerId = psql(database, serviceSql(`select stripe_customer_id from public.billing_stripe_customers where user_id = ${quote(userId)}::uuid`));
      return stripeCustomerId ? { userId, stripeCustomerId } : null;
    },
    async findByStripeCustomerId(stripeCustomerId) {
      const userId = psql(database, serviceSql(`select user_id from public.billing_stripe_customers where stripe_customer_id = ${quote(stripeCustomerId)}`));
      return userId ? { userId, stripeCustomerId } : null;
    },
    async insert(binding) {
      psql(database, serviceSql(`insert into public.billing_stripe_customers (user_id, stripe_customer_id) values (${quote(binding.userId)}::uuid, ${quote(binding.stripeCustomerId)})`));
      return { ok: true };
    },
  };
}

function checkoutStore(): CheckoutStore {
  const columns = "id,user_id,row_version,status,idempotency_key,create_anchor_at,stripe_customer_id,stripe_account_id,plan,stripe_price_id,unit_amount,currency,quantity,livemode,success_url,cancel_url,mode,adaptive_pricing_enabled,automatic_tax_enabled,stripe_session_id,stripe_session_url,observed_late_session_id,supersede_plan,expire_idempotency_key,expire_anchor_at,successor_attempt_id";
  function read(where: string): CheckoutAttempt | null {
    const line = psql(database, serviceSql(`select row_to_json(t) from (select ${columns} from public.billing_checkout_sessions where ${where} limit 1) t`));
    return line ? JSON.parse(line) as CheckoutAttempt : null;
  }
  return {
    async findBlocking(userId) {
      return read(`user_id = ${quote(userId)}::uuid and status in ('pending','open','unknown','expiring','complete')`);
    },
    async findById(userId, attemptId) {
      return read(`user_id = ${quote(userId)}::uuid and id = ${quote(attemptId)}::uuid`);
    },
    async insertPending(row) {
      psql(database, serviceSql(`insert into public.billing_checkout_sessions (${columns}) values (
        ${quote(row.id)}::uuid, ${quote(row.user_id)}::uuid, ${row.row_version}, ${quote(row.status)}, ${quote(row.idempotency_key)}::uuid,
        ${quote(row.create_anchor_at)}::timestamptz, ${quote(row.stripe_customer_id)}, ${quote(row.stripe_account_id)}, ${quote(row.plan)},
        ${quote(row.stripe_price_id)}, ${row.unit_amount}, 'usd', 1, ${row.livemode}, ${quote(row.success_url)}, ${quote(row.cancel_url)},
        'subscription', false, false, null, null, null, null, null, null, null
      )`));
    },
    async compareAndSet(row, patch, expectedExpireKey) {
      const sets = Object.entries(patch).map(([column, value]) => {
        if (value === null) return `${column} = null`;
        if (typeof value === "number" || typeof value === "boolean") return `${column} = ${value}`;
        return `${column} = ${quote(String(value))}`;
      });
      sets.push("row_version = row_version + 1", "updated_at = clock_timestamp()");
      const expire = typeof expectedExpireKey === "string" ? ` and expire_idempotency_key = ${quote(expectedExpireKey)}::uuid` : "";
      const updated = psql(database, serviceSql(`update public.billing_checkout_sessions as sessions set ${sets.join(", ")} where sessions.id = ${quote(row.id)}::uuid and sessions.user_id = ${quote(row.user_id)}::uuid and sessions.status = ${quote(row.status)} and sessions.row_version = ${row.row_version}${expire} returning row_to_json(sessions)`));
      if (!updated) return null;
      return JSON.parse(updated) as CheckoutAttempt;
    },
    async finishExpiring(input: FinishExpiringInput): Promise<FinishExpiringResult> {
      const close = input.closeStatus === null ? "null" : quote(input.closeStatus);
      const successor = input.successor === null ? "null" : `${quote(JSON.stringify(input.successor))}::jsonb`;
      const line = psql(database, serviceSql(`select public.billing_checkout_finish_expiring(${quote(input.userId)}::uuid, ${quote(input.attemptId)}::uuid, ${input.rowVersion}, ${quote(input.stripeAccountId)}, ${quote(input.action)}, ${close}, ${successor})`));
      return JSON.parse(line) as FinishExpiringResult;
    },
  };
}

function captureCreate(inner: CheckoutStripe, bag: CaptureBag): CheckoutStripe {
  return {
    ...inner,
    async createSession(row, idempotencyKey) {
      bag.pending += 1;
      let markSettled = () => undefined;
      const settled = new Promise<void>((resolve) => {
        markSettled = () => {
          bag.pending -= 1;
          resolve();
        };
      });
      bag.inflight.push(settled);
      const underlying = inner.createSession(row, idempotencyKey).then(
        (created) => {
          try {
            if (created.id && !bag.ids.includes(created.id)) bag.ids.push(created.id);
            bag.onReady?.(created.id);
            return created;
          } finally {
            markSettled();
          }
        },
        (err: unknown) => {
          markSettled();
          throw err;
        }
      );
      return withTimeout(underlying, 20_000, "checkout.sessions.create");
    },
  };
}

describe("Stripe sandbox paid checkout", () => {
  it("binds A, accepts one signed basic payment, and leaves B without access", async () => {
    console.log("Manual sandbox only. This file is not part of test:auth. Entitlement is getPaidPlan on the isolated row, not NextAuth or the entitlement route.");
    assert.equal(psql("postgres", "select current_setting('data_directory')"), data);
    assert.equal(psql("postgres", "select inet_server_addr() is null"), "t");
    const capturedCustomer = { id: null as string | null };
    let server: PaidWebhookServer | null = null;
    try {
      server = await createPaidWebhookServer({
        port: PAID_SANDBOX_WEBHOOK_PORT,
        secret: webhookSecret,
        prices,
        capturedCustomerId: () => capturedCustomer.id,
        openStore: async () => createServiceRoleEventStore((sql) => psql(database, sql)),
      });
    } catch (err) {
      const busy = typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "EADDRINUSE";
      refuse(busy ? "STRIPE_SANDBOX_PORT_BUSY" : "WEBHOOK_BIND_REJECTED");
    }
    const receiver = server;
    if (!receiver) refuse("WEBHOOK_BIND_REJECTED");
    const abort = new AbortController();
    const onStop = () => abort.abort();
    process.on("SIGINT", onStop);
    process.on("SIGTERM", onStop);
    let urlDir = "";
    try {
      psql("postgres", `create database ${database}`);
      psql(database, `
        create schema if not exists auth;
        create table auth.users (id uuid primary key);
        create role anon nologin nobypassrls;
        create role authenticated nologin nobypassrls;
        create role service_role nologin bypassrls;
      `);
      const userA = randomUUID();
      const userB = randomUUID();
      console.log(`synthetic_user_a=${userA}`);
      console.log(`synthetic_user_b=${userB}`);
      psql(database, `insert into auth.users (id) values (${quote(userA)}::uuid), (${quote(userB)}::uuid)`);
      psqlFile(database, "supabase/migrations/20261101_billing_paid_plan.sql");
      psqlFile(database, "supabase/migrations/20261102_billing_stripe_customers.sql");
      psqlFile(database, "supabase/migrations/20261106_billing_checkout_sessions.sql");
      psqlFile(database, "supabase/migrations/20261112_billing_stripe_events.sql");
      const client = new Stripe(key, { apiVersion: PAID_SANDBOX_API_VERSION, maxNetworkRetries: 0, timeout: 20_000, telemetry: false });
      const sessions = createCaptureBag();
      const customers = createCaptureBag();
      const stripe = captureCreate(createStripeCheckoutClient(client), sessions);
      stripe.createCustomer = captureCustomerCreate(async (params, options) => {
        const created = await client.customers.create(
          { metadata: { user_id: params.metadata.user_id } },
          { idempotencyKey: options.idempotencyKey, timeout: 20_000 }
        );
        capturedCustomer.id = created.id;
        return { id: created.id };
      }, customers);

      await withCapturedCustomers({
        capture: customers,
        cleanup: async (customerId) => {
          await withTimeout(receiver.close(), PAID_SANDBOX_CLOSE_TIMEOUT_MS, "webhook.close").catch(() => undefined);
          if (sessions.ids.length !== 1) {
            console.error(`leftover_stripe_customer=${safeStripeId("cus", customerId) ?? "unrecognized"}`);
            for (const sessionId of sessions.ids) console.error(`leftover_checkout_session=${safeStripeId("cs", sessionId) ?? "unrecognized"}`);
            throw new SandboxError("STRIPE_SANDBOX_CLEANUP_UNCONFIRMED", { operation: "checkout.sessions.retrieve" });
          }
          const sessionId = sessions.ids[0];
          const attemptId = psql(database, serviceSql(`select id from public.billing_checkout_sessions where stripe_session_id = ${quote(sessionId)} and stripe_customer_id = ${quote(customerId)} limit 1`));
          if (!attemptId) {
            console.error(`leftover_checkout_session=${safeStripeId("cs", sessionId) ?? "unrecognized"}`);
            console.error(`leftover_stripe_customer=${safeStripeId("cus", customerId) ?? "unrecognized"}`);
            throw new SandboxError("STRIPE_SANDBOX_CLEANUP_ATTEMPT_MISMATCH", { operation: "checkout.sessions.retrieve" });
          }
          await cleanupPaidCheckout({
            expected: { sessionId, customerId, attemptId, userId: userA },
            graceMs: Math.min(PAID_SANDBOX_CLEANUP_RESERVE_MS, Math.max(1, cleanupDeadline - Date.now())),
            signal: abort.signal,
            retrieveSession: async () => viewSession(await client.checkout.sessions.retrieve(sessionId)),
            retrieveSubscription: async (subscriptionId) => viewSubscription(await client.subscriptions.retrieve(subscriptionId)),
            expireSession: async (id) => {
              await client.checkout.sessions.expire(id);
            },
            confirmSessionExpired: async () => (await client.checkout.sessions.retrieve(sessionId)).status === "expired",
            cancelSubscription: async (subscriptionId) => {
              await client.subscriptions.cancel(subscriptionId);
            },
            retrieveCustomer: async () => {
              const retrieved = await client.customers.retrieve(customerId);
              if ("deleted" in retrieved && retrieved.deleted) return { id: retrieved.id, deleted: true };
              const user = retrieved.metadata?.user_id;
              return { id: retrieved.id, livemode: retrieved.livemode, metadata: user ? { user_id: user } : null };
            },
            deleteCustomer: async () => {
              await client.customers.del(customerId);
            },
          });
        },
        run: async () => {
          const response = await handleCheckoutPost({
            resolveUserId: async () => userA,
            enabled: true,
            now: () => new Date(),
            env: { NEXT_PUBLIC_APP_URL: ORIGIN },
            nodeEnv: "test",
            openRuntime: async () => ({
              origin: ORIGIN,
              prices,
              livemode: false,
              loadSubscription: async () => null,
              customerStore: customerStore(),
              checkoutStore: checkoutStore(),
              stripe,
            }),
            request: new Request(`${ORIGIN}/api/billing/checkout`, { method: "POST", headers: { origin: ORIGIN }, body: JSON.stringify({ plan: "basic" }) }),
          });
          const body = await response.json() as { url?: string; error?: string };
          assert.equal(response.status, 200);
          if (!body.url || !body.url.startsWith("https://")) throw new SandboxError("STRIPE_SANDBOX_REQUEST_FAILED", { operation: "checkout.sessions.create" });
          if (!capturedCustomer.id) throw new SandboxError("STRIPE_SANDBOX_LISTENER_UNCONFIRMED", { operation: "customer.updated" });
          if (listenerGate(receiver.listener()) !== "open" && paymentDeadline - Date.now() > 0) {
            const updateBudget = Math.min(20_000, paymentDeadline - Date.now());
            await withTimeout(
              client.customers.update(capturedCustomer.id, { metadata: { user_id: userA, sandbox_precheck: "1" } }),
              updateBudget,
              "customer.updated"
            );
            while (Date.now() < paymentDeadline && listenerGate(receiver.listener()) === "STRIPE_SANDBOX_LISTENER_UNCONFIRMED") {
              if (abort.signal.aborted) throw new SandboxError("STRIPE_SANDBOX_INTERRUPTED", { operation: "customer.updated" });
              await new Promise((resolve) => setTimeout(resolve, 250));
            }
          }
          const gate = listenerGate(receiver.listener());
          if (gate !== "open") throw new SandboxError(gate, { operation: "customer.updated" });
          if (Date.now() >= paymentDeadline) throw new SandboxError("STRIPE_SANDBOX_TIMEOUT", { operation: "invoice.paid" });
          urlDir = mkdtempSync(path.join(tmpdir(), "billing-paid-checkout-url-"));
          const urlFile = path.join(urlDir, "url");
          writeFileSync(urlFile, `${body.url}\n`, { mode: 0o600 });
          chmodSync(urlFile, 0o600);
          assertKeyFileOutsideRepo(urlFile, realpathSync(process.cwd()));
          console.log(`checkout_session=${safeStripeId("cs", sessions.ids[0]) ?? "unrecognized"}`);
          console.log(`checkout_url_file=${urlFile}`);
          console.log("entitlement_layer=getPaidPlan");
          while (Date.now() < paymentDeadline && receiver.gaps().length === 0 && getPaidPlan(snapshot(userA), userA, new Date()) !== "basic") {
            if (abort.signal.aborted) throw new SandboxError("STRIPE_SANDBOX_INTERRUPTED", { operation: "sandbox" });
            await new Promise((resolve) => setTimeout(resolve, 1_000));
          }
          if (receiver.gaps().length > 0) {
            for (const gap of receiver.gaps()) console.error(`invoice_paid_gap=${gap}`);
            throw new SandboxError("STRIPE_SANDBOX_INVOICE_GAP", { operation: "invoice.paid" });
          }
          const row = snapshot(userA);
          const entitlement = getPaidPlan(row, userA, new Date());
          if (!paymentChainAccepted({ gaps: receiver.gaps(), entitlement })) {
            throw new SandboxError("STRIPE_SANDBOX_TIMEOUT", { operation: "invoice.paid" });
          }
          const periodEnd = psql(database, serviceSql("select trunc(extract(epoch from period_end))::text from public.billing_stripe_invoices"));
          assert.equal(row?.paid_until, new Date(Number(periodEnd) * 1000).toISOString());
          assert.equal(getPaidPlan(snapshot(userB), userB, new Date()), "none");
          assert.equal(snapshot(userB), null);
          const accepted = receiver.acceptedInvoice();
          if (!accepted) throw new SandboxError("STRIPE_SANDBOX_INVOICE_GAP", { operation: "invoice.paid" });
          const paidUntil = row?.paid_until;
          const replayRoom = replayHeaderDecision(accepted.header, Date.now(), Math.ceil(PAID_SANDBOX_REPLAY_TIMEOUT_MS / 1000) + 1);
          if (replayRoom !== "reuse") throw new SandboxError(replayRoom, { operation: "webhook.replay" });
          const replay = await postSignedEvent(receiver.port, accepted, PAID_SANDBOX_REPLAY_TIMEOUT_MS).catch(() => {
            throw new SandboxError("STRIPE_SANDBOX_TIMEOUT", { operation: "webhook.replay", timeoutMs: PAID_SANDBOX_REPLAY_TIMEOUT_MS });
          });
          if (replay.status === 400 && replay.body.error === "WEBHOOK_SIGNATURE_INVALID") {
            throw new SandboxError("STRIPE_SANDBOX_SIGNATURE_STALE", { operation: "webhook.replay" });
          }
          assert.equal(replay.status, 200);
          assert.equal(replay.body.outcome, "duplicate");
          assert.equal(snapshot(userA)?.paid_until, paidUntil);
          assert.equal(psql(database, serviceSql("select count(*) from public.billing_stripe_invoices")), "1");
          assert.equal(receiver.apiVersions().every((version) => version === PAID_SANDBOX_API_VERSION), true);
          console.log(`event_api_version=${PAID_SANDBOX_API_VERSION}`);
          console.log("paid_chain=basic");
        },
      });
    } finally {
      process.off("SIGINT", onStop);
      process.off("SIGTERM", onStop);
      await withTimeout(receiver.close(), PAID_SANDBOX_CLOSE_TIMEOUT_MS, "webhook.close").catch(() => undefined);
      if (urlDir) rmSync(urlDir, { recursive: true, force: true });
    }
  });
});
