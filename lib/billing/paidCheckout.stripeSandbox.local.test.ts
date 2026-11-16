import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, it } from "node:test";
import { limitedProcessEnv } from "./limitedProcessEnv.ts";
import { getPaidPlan, type PaidSubscriptionSnapshot } from "./paidPlan.ts";
import {
  basicInvoiceSnapshot,
  createPaidWebhookServer,
  createServiceRoleEventStore,
  paymentChainAccepted,
  postSignedEvent,
  signSnapshot,
  subscriptionStatusSnapshot,
} from "./paidCheckoutSandbox.ts";

const root = process.env.BILLING_CUSTOMER_PGROOT || "";
const host = process.env.BILLING_CUSTOMER_PGHOST || "";
const port = process.env.BILLING_CUSTOMER_PGPORT || "";
const dbUser = process.env.BILLING_CUSTOMER_PGUSER || "";
const data = process.env.BILLING_CUSTOMER_PGDATA || "";
const database = "billing_paid_sandbox";
const secret = "whsec_localpaidsecret";
const prices = { basic: "price_basiclocal", pro: "price_prolocal", elite: "price_elitelocal" };
const userA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const customerA = "cus_locala";
const subscriptionA = "sub_locala";

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
for (const name of ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "STRIPE_SECRET_KEY", "DATABASE_URL"]) {
  if (name in process.env) refuse("STRIPE_SANDBOX_APP_ENV_PRESENT");
}

function quote(value: string): string {
  return `$$${value}$$`;
}

function psql(dbName: string, sql: string): string {
  return execFileSync(
    "psql",
    ["-h", host, "-p", port, "-U", dbUser, "-d", dbName, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", sql],
    { encoding: "utf8", env: limitedProcessEnv(process.env), timeout: 15_000 }
  ).trim();
}

function psqlFile(dbName: string, file: string) {
  execFileSync(
    "psql",
    ["-h", host, "-p", port, "-U", dbUser, "-d", dbName, "-X", "-v", "ON_ERROR_STOP=1", "-f", file],
    { stdio: "pipe", env: limitedProcessEnv(process.env), timeout: 15_000 }
  );
}

function snapshot(userId: string): PaidSubscriptionSnapshot | null {
  const line = psql(
    database,
    `select coalesce(user_id::text, '') || '|' || coalesce(paid_plan, '') || '|' || coalesce(subscription_status, '') || '|' || coalesce(trunc(extract(epoch from paid_until))::text, '') from public.billing_subscriptions where user_id = ${quote(userId)}::uuid`
  );
  if (!line) return null;
  const [user_id, paid_plan, subscription_status, paidUntilEpoch] = line.split("|");
  return {
    user_id,
    paid_plan,
    subscription_status,
    paid_until: new Date(Number(paidUntilEpoch) * 1000).toISOString(),
  };
}

describe("paid checkout local receiver", { concurrency: 1 }, () => {
  it("proves the signed chain on the temporary database and leaves B without access", async () => {
    assert.equal(psql("postgres", "select current_setting('data_directory')"), data);
    assert.equal(psql("postgres", "select inet_server_addr() is null"), "t");
    psql("postgres", `create database ${database}`);
    psql(database, `
      create schema if not exists auth;
      create table auth.users (id uuid primary key);
      create role anon nologin nobypassrls;
      create role authenticated nologin nobypassrls;
      create role service_role nologin bypassrls;
    `);
    psql(database, `insert into auth.users (id) values (${quote(userA)}::uuid), (${quote(userB)}::uuid)`);
    psqlFile(database, "supabase/migrations/20261101_billing_paid_plan.sql");
    psqlFile(database, "supabase/migrations/20261102_billing_stripe_customers.sql");
    psqlFile(database, "supabase/migrations/20261106_billing_checkout_sessions.sql");
    psqlFile(database, "supabase/migrations/20261112_billing_stripe_events.sql");
    psql(database, `insert into public.billing_stripe_customers (user_id, stripe_customer_id) values (${quote(userA)}::uuid, ${quote(customerA)})`);

    const now = Math.floor(Date.now() / 1000);
    const periodStart = now - 3600;
    const periodEnd = now + 40 * 24 * 3600;
    const base = {
      invoiceId: "in_locala",
      customerId: customerA,
      subscriptionId: subscriptionA,
      priceId: prices.basic,
      paymentIntentId: "pi_locala",
      periodStart,
      periodEnd,
      created: now,
    };
    const server = await createPaidWebhookServer({
      port: 0,
      secret,
      prices,
      capturedCustomerId: () => customerA,
      openStore: async () => createServiceRoleEventStore((sql) => psql(database, sql)),
    });
    try {
      const bad = await postSignedEvent(server.port, { raw: "{}", header: "t=1,v1=bad" });
      assert.equal(bad.status, 400);
      assert.equal(server.storeOpens(), 0);
      assert.equal(psql(database, "select count(*) from public.billing_stripe_events"), "0");

      const unrelated = signSnapshot(secret, basicInvoiceSnapshot({ ...base, eventId: "evt_unrelated", invoiceId: "in_unrelated", customerId: "cus_unrelated" }));
      assert.equal((await postSignedEvent(server.port, unrelated)).body.outcome, "ignored_unrelated");
      assert.equal(server.storeOpens(), 0);
      assert.equal(psql(database, "select count(*) from public.billing_stripe_events"), "0");

      const gap = signSnapshot(secret, basicInvoiceSnapshot({ ...base, eventId: "evt_gap", invoiceId: "in_gap" }, (invoice) => {
        delete invoice.payments;
      }));
      const gapResponse = await postSignedEvent(server.port, gap);
      assert.equal(gapResponse.body.outcome, "payment_not_in_stripe");
      assert.deepEqual(server.gaps(), ["payments_not_one"]);
      assert.equal(getPaidPlan(snapshot(userA), userA, new Date()), "none");
      assert.equal(paymentChainAccepted({ gaps: server.gaps(), entitlement: "basic" }), false);

      const invoice = signSnapshot(secret, basicInvoiceSnapshot({ ...base, eventId: "evt_locala" }));
      assert.equal((await postSignedEvent(server.port, invoice)).body.outcome, "invoice_applied");
      assert.equal(getPaidPlan(snapshot(userA), userA, new Date()), "none");
      assert.equal(snapshot(userA)?.paid_plan, "basic");
      assert.equal(snapshot(userA)?.subscription_status, "incomplete");

      const status = signSnapshot(secret, subscriptionStatusSnapshot({
        eventId: "evt_localstatus",
        customerId: customerA,
        subscriptionId: subscriptionA,
        status: "active",
        created: now + 1,
      }));
      assert.equal((await postSignedEvent(server.port, status)).body.outcome, "status_applied");
      const paidUntil = snapshot(userA)?.paid_until;
      assert.equal(getPaidPlan(snapshot(userA), userA, new Date()), "basic");
      assert.equal(paidUntil, new Date(periodEnd * 1000).toISOString());
      assert.equal(psql(database, "select trunc(extract(epoch from period_end))::text from public.billing_stripe_invoices"), String(periodEnd));
      assert.equal(getPaidPlan(snapshot(userB), userB, new Date()), "none");
      assert.equal(snapshot(userB), null);

      const replay = await postSignedEvent(server.port, invoice);
      assert.equal(replay.status, 200);
      assert.equal(replay.body.outcome, "duplicate");
      assert.equal(snapshot(userA)?.paid_until, paidUntil);
      assert.equal(psql(database, "select count(*) from public.billing_stripe_invoices"), "1");
      assert.equal(paymentChainAccepted({ gaps: [], entitlement: getPaidPlan(snapshot(userA), userA, new Date()) }), true);
      assert.equal(paymentChainAccepted({ gaps: server.gaps(), entitlement: "basic" }), false);
      assert.equal(server.apiVersions().every((version) => version === "2025-11-17.clover"), true);
    } finally {
      await server.close();
    }
  });
});
