import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import type { BillingCustomerStore } from "./billingCustomer";
import { handleCheckoutPost } from "./checkoutSession";
import type { CheckoutAttempt, CheckoutStore, FinishExpiringInput, FinishExpiringResult } from "./checkoutStore";
import { limitedProcessEnv } from "./limitedProcessEnv";
import {
  captureCustomerCreate,
  cleanupDecision,
  createCaptureBag,
  cleanupSessionsThenCustomer,
  SandboxError,
  sessionCleanupDecision,
  withCapturedCustomers,
  withTimeout,
  type CaptureBag,
  type CleanupCustomer,
} from "./stripeSandbox";
import { createStripeCheckoutClient, type CheckoutStripe } from "./stripeCheckout";

const root = process.env.BILLING_CUSTOMER_PGROOT || "";
const host = process.env.BILLING_CUSTOMER_PGHOST || "";
const port = process.env.BILLING_CUSTOMER_PGPORT || "";
const dbUser = process.env.BILLING_CUSTOMER_PGUSER || "";
const data = process.env.BILLING_CUSTOMER_PGDATA || "";
const database = "billing_checkout_sandbox";
const key = process.env.STRIPE_SANDBOX_SECRET_KEY || "";
const prices = {
  basic: process.env.STRIPE_SANDBOX_PRICE_BASIC || "",
  pro: process.env.STRIPE_SANDBOX_PRICE_PRO || "",
  elite: process.env.STRIPE_SANDBOX_PRICE_ELITE || "",
};
const ORIGIN = "https://sandbox.autoaffi.test";

function refuse(code: string): never {
  console.error(code);
  process.exit(1);
}

if (!root || !host || !port || !dbUser || !data) refuse("STRIPE_SANDBOX_ISOLATION_REQUIRED");
if (
  !root.includes(`${path.sep}billing-customer-pg-`) ||
  path.resolve(host) !== path.resolve(root, "sock") ||
  path.resolve(data) !== path.resolve(root, "data") ||
  port === "5432"
) {
  refuse("STRIPE_SANDBOX_ISOLATION_REJECTED");
}
if (!/^sk_test_[A-Za-z0-9]+$/.test(key)) refuse("STRIPE_SANDBOX_KEY_REJECTED");
if (Object.values(prices).some((value) => !/^price_[A-Za-z0-9]+$/.test(value))) refuse("STRIPE_SANDBOX_PRICE_REJECTED");
for (const name of ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "STRIPE_SECRET_KEY", "DATABASE_URL"]) {
  if (name in process.env) refuse("STRIPE_SANDBOX_APP_ENV_PRESENT");
}

function quote(value: string): string {
  return `$$${value}$$`;
}

function psql(dbName: string, sql: string): string {
  try {
    return execFileSync(
      "psql",
      ["-h", host, "-p", port, "-U", dbUser, "-d", dbName, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", sql],
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
      ["-h", host, "-p", port, "-U", dbUser, "-d", dbName, "-X", "-v", "ON_ERROR_STOP=1", "-f", file],
      { stdio: "pipe", env: limitedProcessEnv(process.env), timeout: 15_000 }
    );
  } catch {
    throw new SandboxError("STRIPE_SANDBOX_DB_FAILED", { operation: "psql" });
  }
}

function serviceSql(statement: string): string {
  return `begin; set local role service_role; ${statement}; commit;`;
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
      sets.push(`row_version = row_version + 1`, `updated_at = clock_timestamp()`);
      const expire = expectedExpireKey === undefined ? "" : ` and expire_idempotency_key = ${quote(expectedExpireKey)}::uuid`;
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

function captureCreate(inner: CheckoutStripe, bag: CaptureBag, creates: { count: number }): CheckoutStripe {
  return {
    ...inner,
    async createSession(row, idempotencyKey) {
      creates.count += 1;
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

function stripeCustomerId(customer: { id?: string } | string | null): string | null {
  if (typeof customer === "string") return customer;
  return customer && typeof customer.id === "string" ? customer.id : null;
}

describe("Stripe sandbox checkout session", () => {
  it("creates, reuses, and expires one unpaid test session", async () => {
    console.log("Manual sandbox only. This file is not part of test:auth and does not confirm a payment.");
    assert.equal(psql("postgres", "select current_setting('data_directory')"), data);
    assert.equal(psql("postgres", "select current_setting('listen_addresses')"), "");
    assert.equal(psql("postgres", "select inet_server_addr() is null"), "t");
    psql("postgres", `create database ${database}`);
    psql(database, `
      create schema if not exists auth;
      create table auth.users (id uuid primary key);
      create role anon nologin nobypassrls;
      create role authenticated nologin nobypassrls;
      create role service_role nologin bypassrls;
    `);
    const userId = randomUUID();
    psql(database, `insert into auth.users (id) values (${quote(userId)}::uuid)`);
    psqlFile(database, "supabase/migrations/20261101_billing_paid_plan.sql");
    psqlFile(database, "supabase/migrations/20261102_billing_stripe_customers.sql");
    psqlFile(database, "supabase/migrations/20261106_billing_checkout_sessions.sql");
    const client = new Stripe(key, {
      apiVersion: "2025-11-17.clover",
      maxNetworkRetries: 0,
      timeout: 20_000,
      telemetry: false,
    });
    const sessions = createCaptureBag();
    const customers = createCaptureBag();
    const creates = { count: 0 };
    const stripe = captureCreate(createStripeCheckoutClient(client), sessions, creates);
    stripe.createCustomer = captureCustomerCreate(async (params, options) => {
      const created = await client.customers.create(
        { metadata: { user_id: params.metadata.user_id } },
        { idempotencyKey: options.idempotencyKey, timeout: 20_000 }
      );
      return { id: created.id };
    }, customers);

    await withCapturedCustomers({
      capture: customers,
      cleanup: async (customerId) => {
        const attemptId = psql(
          database,
          serviceSql(`select id from public.billing_checkout_sessions where stripe_customer_id = ${quote(customerId)} order by created_at desc limit 1`)
        );
        await cleanupSessionsThenCustomer({
          customerId,
          sessions,
          graceMs: 15_000,
          cleanupSession: async (sessionId) => {
            const session = await withTimeout(client.checkout.sessions.retrieve(sessionId), 15_000, "checkout.sessions.retrieve");
            const decision = sessionCleanupDecision(
              {
                id: session.id,
                customerId: stripeCustomerId(session.customer),
                livemode: session.livemode,
                status: session.status || "",
                clientReferenceId: session.client_reference_id,
                attemptId: session.metadata?.attempt_id ?? null,
              },
              { id: sessionId, customerId, attemptId }
            );
            if (decision !== "expire") return;
            await withTimeout(client.checkout.sessions.expire(sessionId), 15_000, "checkout.sessions.expire");
            const again = await withTimeout(client.checkout.sessions.retrieve(sessionId), 15_000, "checkout.sessions.retrieve");
            if (again.status !== "expired") {
              throw new SandboxError("STRIPE_SANDBOX_CLEANUP_FAILED", { operation: "checkout.sessions.expire" });
            }
            console.log(`expired_checkout_session=${sessionId}`);
          },
          deleteCustomer: async (id) => {
            const retrieved = await withTimeout(client.customers.retrieve(id), 15_000, "customers.retrieve");
            const user = "deleted" in retrieved && retrieved.deleted ? undefined : retrieved.metadata?.user_id;
            const decision: CleanupCustomer = "deleted" in retrieved && retrieved.deleted
              ? { id: retrieved.id, deleted: true }
              : { id: retrieved.id, livemode: retrieved.livemode, metadata: user ? { user_id: user } : null };
            cleanupDecision(decision, { id, userId });
            await withTimeout(client.customers.del(id), 15_000, "customers.del");
            console.log(`deleted_stripe_customer=${id}`);
          },
        });
      },
      run: async () => {
        const input = {
          resolveUserId: async () => userId,
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
        };
        const first = await handleCheckoutPost({ ...input, request: new Request(`${ORIGIN}/api/billing/checkout`, { method: "POST", headers: { origin: ORIGIN }, body: JSON.stringify({ plan: "basic" }) }) });
        const firstBody = await first.json() as { url?: string; error?: string };
        assert.equal(first.status, 200);
        assert.equal(typeof firstBody.url, "string");
        assert.equal(creates.count, 1);
        assert.equal(sessions.ids.length, 1);
        const createsBeforeReuse = creates.count;
        const second = await handleCheckoutPost({ ...input, request: new Request(`${ORIGIN}/api/billing/checkout`, { method: "POST", headers: { origin: ORIGIN }, body: JSON.stringify({ plan: "basic" }) }) });
        const secondBody = await second.json() as { url?: string };
        const secondCreateCount = creates.count - createsBeforeReuse;
        assert.equal(second.status, 200);
        assert.equal(secondBody.url, firstBody.url);
        assert.equal(creates.count, 1);
        assert.equal(secondCreateCount, 0);
        assert.equal(sessions.ids.length, 1);
        console.log(`checkout_session=${sessions.ids[0]}`);
        console.log(`second_create_count=${secondCreateCount}`);
      },
    });
  });
});
