import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, it } from "node:test";
import { limitedProcessEnv } from "./limitedProcessEnv.ts";
import { getPaidPlan, type PaidSubscriptionSnapshot } from "./paidPlan.ts";
import {
  PAID_SANDBOX_API_VERSION,
  PAID_SANDBOX_REPLAY_TIMEOUT_MS,
  basicInvoiceSnapshot,
  createPaidWebhookServer,
  invoicePaymentSnapshot,
  createServiceRoleEventStore,
  paidProofChecks,
  paymentChainAccepted,
  postSignedEvent,
  replayHeaderDecision,
  signSnapshot,
  subscriptionStatusSnapshot,
  type StoredPaidProof,
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

function readProof(invoiceId: string): StoredPaidProof {
  const line = psql(
    database,
    `select coalesce(invoice_event_id, '') || '|' || coalesce(payment_event_id, '') || '|' || stripe_invoice_id || '|' || coalesce(invoice_payment_id, '') || '|' || coalesce(payment_intent_id, '') || '|' || coalesce(amount_paid::text, '') || '|' || coalesce(currency, '') || '|' || coalesce(stripe_subscription_id, '') || '|' || coalesce(stripe_customer_id, '') || '|' || coalesce(user_id::text, '') from public.billing_stripe_invoice_proofs where stripe_invoice_id = ${quote(invoiceId)}`
  );
  const parts = line.split("|");
  assert.equal(parts.length, 10);
  return {
    invoiceEventId: parts[0],
    paymentEventId: parts[1],
    invoiceId: parts[2],
    invoicePaymentId: parts[3],
    paymentIntentId: parts[4],
    amount: Number(parts[5]),
    currency: parts[6],
    subscriptionId: parts[7],
    customerId: parts[8],
    userId: parts[9],
  };
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
    psqlFile(database, "supabase/migrations/20261117_billing_invoice_payment_proof.sql");
    psqlFile(database, "supabase/migrations/20261120_billing_basic_amount_900.sql");
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
      invoicePaymentId: "inpay_locala",
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

      const foreignPay = signSnapshot(secret, invoicePaymentSnapshot({
        ...base,
        eventId: "evt_foreignpay",
        invoiceId: "in_foreign",
        customerId: "cus_foreign",
        paymentIntentId: "pi_foreign",
        invoicePaymentId: "inpay_foreign",
      }));
      assert.equal((await postSignedEvent(server.port, foreignPay)).body.outcome, "payment_awaiting_invoice");
      assert.equal(psql(database, "select coalesce(user_id::text, '') from public.billing_stripe_invoice_proofs where stripe_invoice_id = 'in_foreign'"), "");
      assert.equal(snapshot(userA), null);

      const gap = signSnapshot(secret, invoicePaymentSnapshot({
        ...base,
        eventId: "evt_gap",
        invoiceId: "in_gap",
        paymentIntentId: "pi_gap",
        invoicePaymentId: "inpay_gap",
      }, (payment) => {
        payment.payment = { type: "payment_record", payment_record: "pyr_gap" };
      }));
      const gapResponse = await postSignedEvent(server.port, gap);
      assert.equal(gapResponse.body.outcome, "paid_out_of_band");
      assert.deepEqual(server.gaps(), ["paid_out_of_band"]);
      assert.equal(getPaidPlan(snapshot(userA), userA, new Date()), "none");
      assert.equal(paymentChainAccepted({ gaps: server.gaps(), entitlement: "basic" }), false);

      const invoice = signSnapshot(secret, basicInvoiceSnapshot({ ...base, eventId: "evt_locala" }));
      assert.equal((await postSignedEvent(server.port, invoice)).body.outcome, "invoice_awaiting_payment");
      assert.equal(snapshot(userA), null);
      assert.equal(getPaidPlan(snapshot(userA), userA, new Date()), "none");

      const payment = signSnapshot(secret, invoicePaymentSnapshot({ ...base, eventId: "evt_localpay" }));
      assert.equal((await postSignedEvent(server.port, payment)).body.outcome, "invoice_applied");
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
      const proof = readProof("in_locala");
      const events = server.verifiedPaidEvents();
      const invoiceEvent = events.find((event) => event.eventId === proof.invoiceEventId);
      const paymentEvent = events.find((event) => event.eventId === proof.paymentEventId);
      assert.ok(invoiceEvent);
      assert.ok(paymentEvent);
      assert.equal(invoiceEvent.apiVersion, PAID_SANDBOX_API_VERSION);
      assert.equal(paymentEvent.apiVersion, PAID_SANDBOX_API_VERSION);
      assert.deepEqual(paidProofChecks(proof, invoiceEvent, paymentEvent, {
        userId: userA,
        customerId: customerA,
        subscriptionId: subscriptionA,
      }), {
        invoice: true,
        payment: true,
        invoiceId: true,
        invoicePaymentId: true,
        paymentIntent: true,
        amount: true,
        currency: true,
        subscription: true,
        customer: true,
      });
      const proofBefore = psql(database, "select invoice_event_id || '|' || payment_event_id || '|' || invoice_payment_id || '|' || payment_intent_id || '|' || amount_paid::text || '|' || currency || '|' || stripe_subscription_id from public.billing_stripe_invoice_proofs where stripe_invoice_id = 'in_locala'");
      const needed = Math.ceil(PAID_SANDBOX_REPLAY_TIMEOUT_MS / 1000) + 1;
      for (const eventId of [proof.invoiceEventId, proof.paymentEventId]) {
        const signed = server.originalSigned(eventId);
        assert.ok(signed);
        assert.equal(replayHeaderDecision(signed.header, Date.now(), needed), "reuse");
        const replay = await postSignedEvent(server.port, signed);
        assert.equal(replay.status, 200);
        assert.equal(replay.body.outcome, "duplicate");
      }
      assert.equal(snapshot(userA)?.paid_until, paidUntil);
      assert.equal(psql(database, "select count(*) from public.billing_stripe_invoices"), "1");
      assert.equal(psql(database, "select invoice_event_id || '|' || payment_event_id || '|' || invoice_payment_id || '|' || payment_intent_id || '|' || amount_paid::text || '|' || currency || '|' || stripe_subscription_id from public.billing_stripe_invoice_proofs where stripe_invoice_id = 'in_locala'"), proofBefore);
      assert.equal(paymentChainAccepted({ gaps: [], entitlement: getPaidPlan(snapshot(userA), userA, new Date()) }), true);
      assert.equal(paymentChainAccepted({ gaps: server.gaps(), entitlement: "basic" }), false);
      assert.equal(server.apiVersions().every((version) => version === "2025-11-17.clover"), true);
    } finally {
      await server.close();
    }
  });
});
