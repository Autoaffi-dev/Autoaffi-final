import assert from "node:assert/strict";
import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { describe, it } from "node:test";
import { limitedProcessEnv } from "./limitedProcessEnv.ts";
import { getPaidPlan } from "./paidPlan.ts";

const root = process.env.BILLING_CUSTOMER_PGROOT || "";
const host = process.env.BILLING_CUSTOMER_PGHOST || "";
const port = process.env.BILLING_CUSTOMER_PGPORT || "";
const user = process.env.BILLING_CUSTOMER_PGUSER || "";
const data = process.env.BILLING_CUSTOMER_PGDATA || "";
const database = "billing_webhook_test";
const APPLY = "public.billing_apply_stripe_event(text,text,timestamptz,boolean,text,text,text,text,text,text,boolean,text,text,text,integer,timestamptz,timestamptz,text,text,text,integer,text,text,boolean)";
const APPLY_MODE = `${APPLY.slice(0, -1)},text)`;
let includeAccount = false;

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-06-01T00:00:00.000Z");
const TIE = 1763000000;
const PERIOD_START = 1767225600;
const PERIOD_END = 1798761600;
const DENYING = ["incomplete_expired", "canceled", "unpaid", "paused", "incomplete", "trialing"];

function refuse(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!root || !host || !port || !user || !data) {
  refuse("Isolated Postgres is not configured. Run npm run test:billing-webhook-postgres.");
}
if (
  !root.includes(`${path.sep}billing-customer-pg-`) ||
  path.resolve(host) !== path.resolve(root, "sock") ||
  path.resolve(data) !== path.resolve(root, "data") ||
  port === "5432"
) {
  refuse("Refusing to continue: Postgres settings are not the isolated instance created for this command.");
}

function psqlEnv(applicationName?: string): NodeJS.ProcessEnv {
  const env = limitedProcessEnv(process.env);
  if (applicationName) env.PGAPPNAME = applicationName;
  return env;
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
  return `$${tag}$${value}$${tag}$`;
}

class PsqlSession {
  private readonly child: ChildProcessWithoutNullStreams;
  private out = "";
  private chain: Promise<unknown> = Promise.resolve();
  private closed = false;

  constructor(applicationName: string) {
    this.child = spawn(
      "stdbuf",
      ["-oL", "-eL", "psql", "-h", host, "-p", port, "-U", user, "-d", database, "-X", "-q", "-A", "-t"],
      { stdio: ["pipe", "pipe", "pipe"], env: psqlEnv(applicationName) }
    );
    this.child.stdout.setEncoding("utf8");
    this.child.stderr.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => {
      this.out += chunk;
    });
    this.child.on("exit", () => {
      this.closed = true;
    });
  }

  exec(sql: string): Promise<string> {
    const run = this.chain.then(() => this.execNow(sql));
    this.chain = run.then(() => undefined, () => undefined);
    return run;
  }

  private execNow(sql: string): Promise<string> {
    if (this.closed) return Promise.reject(new Error("isolated psql session closed"));
    const marker = `aa_${randomBytes(8).toString("hex")}`;
    const outStart = this.out.length;
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error("isolated psql timed out"));
      }, 15000);
      const finish = () => {
        if (settled) return;
        const chunk = this.out.slice(outStart);
        const at = chunk.indexOf(marker);
        if (at < 0) return;
        settled = true;
        clearTimeout(timer);
        this.child.stdout.off("data", finish);
        resolve(chunk.slice(0, at).trim());
      };
      this.child.stdout.on("data", finish);
      this.child.stdin.write(`${sql.trim().replace(/;$/, "")};\n\\echo ${marker}\n`);
      finish();
    });
  }

  close(): Promise<void> {
    if (this.closed) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.child.kill();
        resolve();
      }, 2000);
      this.child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
      this.child.stdin.end("\\q\n");
    });
  }
}

type ApplyInput = {
  eventId: string;
  eventType: string;
  created: number;
  action: "invoice" | "payment" | "status" | "reject";
  livemode?: boolean;
  outcome?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
  status?: string | null;
  cancel?: boolean | null;
  invoiceId?: string | null;
  invoicePaymentId?: string | null;
  paymentIntentId?: string | null;
  priceId?: string | null;
  plan?: string | null;
  amount?: number | null;
  amountRequested?: number | null;
  currency?: string | null;
  paymentStatus?: string | null;
  isDefault?: boolean | null;
  periodStart?: number | null;
  periodEnd?: number | null;
  metadataUserId?: string | null;
  accountId?: string | null;
};

function sqlText(value: string | null): string {
  return value === null ? "null::text" : `${quote(value)}::text`;
}

function sqlBool(value: boolean | null): string {
  if (value === null) return "null::boolean";
  return value ? "true" : "false";
}

function sqlInt(value: number | null): string {
  return value === null ? "null::integer" : String(value);
}

function sqlTime(value: number | null): string {
  return value === null ? "null::timestamptz" : `to_timestamp(${value})`;
}

function call(input: ApplyInput): string {
  const currency = input.currency === undefined ? (input.action === "invoice" || input.action === "payment" ? "usd" : null) : input.currency;
  const amountRequested = input.amountRequested === undefined ? (input.action === "payment" ? input.amount ?? null : null) : input.amountRequested;
  const paymentStatus = input.paymentStatus === undefined ? (input.action === "payment" ? "paid" : null) : input.paymentStatus;
  const isDefault = input.isDefault === undefined ? (input.action === "payment" ? true : null) : input.isDefault;
  return `select public.billing_apply_stripe_event(
    ${sqlText(input.eventId)},
    ${sqlText(input.eventType)},
    to_timestamp(${input.created}),
    ${input.livemode ? "true" : "false"},
    ${sqlText("2025-11-17.clover")},
    ${sqlText(input.action)},
    ${sqlText(input.outcome ?? null)},
    ${sqlText(input.customerId ?? null)},
    ${sqlText(input.subscriptionId ?? null)},
    ${sqlText(input.status ?? null)},
    ${sqlBool(input.cancel ?? null)},
    ${sqlText(input.invoiceId ?? null)},
    ${sqlText(input.priceId ?? null)},
    ${sqlText(input.plan ?? null)},
    ${sqlInt(input.amount ?? null)},
    ${sqlTime(input.periodStart ?? null)},
    ${sqlTime(input.periodEnd ?? null)},
    ${sqlText(input.metadataUserId ?? null)},
    ${sqlText(input.invoicePaymentId ?? null)},
    ${sqlText(input.paymentIntentId ?? null)},
    ${sqlInt(amountRequested)},
    ${sqlText(currency)},
    ${sqlText(paymentStatus)},
    ${sqlBool(isDefault)}${includeAccount ? `,\n    ${sqlText(input.accountId === undefined ? "acct_test" : input.accountId)}` : ""}
  )`;
}

function run(input: ApplyInput): string {
  return psql(database, `begin; select set_config('role', 'service_role', true); ${call(input)}; commit;`);
}

function reset() {
  psql(database, "delete from public.billing_stripe_invoice_proofs");
  psql(database, "delete from public.billing_stripe_invoices");
  psql(database, "delete from public.billing_stripe_events");
  psql(database, "delete from public.billing_subscriptions");
}

function payment(eventId: string, invoiceId: string, amount = 1900, extra: Partial<ApplyInput> = {}): string {
  return run({
    eventId,
    eventType: "invoice_payment.paid",
    created: TIE - 1,
    action: "payment",
    invoiceId,
    invoicePaymentId: `inpay_${invoiceId.slice(3)}`,
    paymentIntentId: `pi_${invoiceId.slice(3)}`,
    amount,
    amountRequested: amount,
    ...extra,
  });
}

function invoice(eventId: string, invoiceId: string, subscriptionId = "sub_B"): string {
  assert.match(payment(`evt_p${eventId.slice(3)}`, invoiceId), /payment_awaiting_invoice/);
  return run({
    eventId,
    eventType: "invoice.paid",
    created: TIE,
    action: "invoice",
    customerId: "cus_B",
    subscriptionId,
    invoiceId,
    priceId: "price_pro",
    plan: "pro",
    amount: 1900,
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
  });
}

function status(eventId: string, subscriptionStatus: string, created = TIE, cancel = false, subscriptionId = "sub_B"): string {
  return run({
    eventId,
    eventType: subscriptionStatus === "canceled" ? "customer.subscription.deleted" : "customer.subscription.updated",
    created,
    action: "status",
    customerId: "cus_B",
    subscriptionId,
    status: subscriptionStatus,
    cancel,
  });
}

function snapshot(userId: string) {
  const line = psql(
    database,
    `select coalesce(user_id::text, '') || '|' || coalesce(paid_plan, '') || '|' || coalesce(subscription_status, '') || '|' || coalesce(cancel_at_period_end::text, '') || '|' || coalesce(to_char(paid_until at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), '') || '|' || coalesce(livemode::text, '') || '|' || coalesce(stripe_account_id, '') from public.billing_subscriptions where user_id = ${quote(userId)}::uuid`
  );
  if (!line) return null;
  const [user_id, paid_plan, subscription_status, cancel, paid_until, mode, stripe_account_id] = line.split("|");
  return {
    user_id,
    paid_plan,
    subscription_status,
    cancel_at_period_end: cancel === "t" || cancel === "true",
    paid_until,
    livemode: mode === "true" ? true : mode === "false" ? false : null,
    stripe_account_id: stripe_account_id || null,
  };
}

const TEST_ACCESS = { livemode: false as const, accountId: "acct_test" };

function entitlement(userId: string): string {
  return getPaidPlan(snapshot(userId), userId, NOW, TEST_ACCESS);
}

describe("stripe webhook postgres", { concurrency: 1 }, () => {
  it("applies the webhook migration only inside the isolated instance", () => {
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
    psql(database, `insert into auth.users (id) values (${quote(USER_A)}::uuid), (${quote(USER_B)}::uuid)`);
    psqlFile(database, "supabase/migrations/20261101_billing_paid_plan.sql");
    psqlFile(database, "supabase/migrations/20261102_billing_stripe_customers.sql");
    psqlFile(database, "supabase/migrations/20261106_billing_checkout_sessions.sql");
    psqlFile(database, "supabase/migrations/20261112_billing_stripe_events.sql");
    psqlFile(database, "supabase/migrations/20261117_billing_invoice_payment_proof.sql");
    psql(database, `insert into public.billing_stripe_customers (user_id, stripe_customer_id) values (${quote(USER_A)}::uuid, 'cus_A'), (${quote(USER_B)}::uuid, 'cus_B')`);
    const signatureBefore = psql(
      database,
      "select pg_get_function_identity_arguments(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'billing_apply_stripe_event'"
    );
    psql(
      database,
      `insert into public.billing_checkout_sessions (
        id, user_id, row_version, status, idempotency_key, create_anchor_at, stripe_customer_id, stripe_account_id,
        plan, stripe_price_id, unit_amount, currency, quantity, livemode, success_url, cancel_url, mode,
        adaptive_pricing_enabled, automatic_tax_enabled, stripe_session_id, stripe_session_url
      ) values (
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, ${quote(USER_B)}::uuid, 1, 'open',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, now(), 'cus_B', 'acct_live',
        'basic', 'price_basic700', 700, 'usd', 1, false,
        'https://app.example/billing/checkout/return?attempt=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa&result=success',
        'https://app.example/billing/checkout/return?attempt=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa&result=cancel',
        'subscription', false, false, 'cs_hist700', 'https://checkout.stripe.com/c/pay/cs_hist700'
      )`
    );
    assert.match(payment("evt_hist_pay", "in_hist700", 700, {
      invoicePaymentId: "inpay_hist700",
      paymentIntentId: "pi_hist700",
    }), /payment_awaiting_invoice/);
    assert.match(run({
      eventId: "evt_hist_invoice",
      eventType: "invoice.paid",
      created: TIE,
      action: "invoice",
      customerId: "cus_A",
      subscriptionId: "sub_stored",
      invoiceId: "in_stored700",
      priceId: "price_basic700",
      plan: "basic",
      amount: 700,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    }), /invoice_awaiting_payment/);
    assert.match(payment("evt_stored_pay", "in_stored700", 700, {
      invoicePaymentId: "inpay_stored700",
      paymentIntentId: "pi_stored700",
    }), /invoice_applied/);
    const pendingBefore = psql(
      database,
      "select coalesce(paid_plan, '') || '|' || amount_paid::text || '|' || coalesce(invoice_event_id, '') from public.billing_stripe_invoice_proofs where stripe_invoice_id = 'in_hist700'"
    );
    const storedBefore = psql(
      database,
      "select paid_plan || '|' || amount_paid::text from public.billing_stripe_invoices where stripe_invoice_id = 'in_stored700'"
    );
    const sessionBefore = psql(
      database,
      "select plan || '|' || stripe_price_id || '|' || unit_amount::text || '|' || status from public.billing_checkout_sessions where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'"
    );
    psqlFile(database, "supabase/migrations/20261120_billing_basic_amount_900.sql");
    assert.equal(pendingBefore, "|700|");
    assert.equal(psql(database, "select coalesce(paid_plan, '') || '|' || amount_paid::text || '|' || coalesce(invoice_event_id, '') from public.billing_stripe_invoice_proofs where stripe_invoice_id = 'in_hist700'"), pendingBefore);
    assert.equal(storedBefore, "basic|700");
    assert.equal(psql(database, "select paid_plan || '|' || amount_paid::text from public.billing_stripe_invoices where stripe_invoice_id = 'in_stored700'"), storedBefore);
    assert.equal(sessionBefore, "basic|price_basic700|700|open");
    assert.equal(psql(database, "select plan || '|' || stripe_price_id || '|' || unit_amount::text || '|' || status from public.billing_checkout_sessions where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'"), sessionBefore);
    assert.equal(psql(database, "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'billing_apply_stripe_event'"), "1");
    assert.equal(
      psql(database, "select pg_get_function_identity_arguments(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'billing_apply_stripe_event'"),
      signatureBefore
    );
    assert.equal(psql(database, `select has_function_privilege('service_role', '${APPLY}', 'execute')`), "t");
    assert.equal(psql(database, `select has_function_privilege('anon', '${APPLY}', 'execute')`), "f");
    assert.equal(psql(database, `select has_function_privilege('authenticated', '${APPLY}', 'execute')`), "f");
    assert.equal(psql(database, `select has_function_privilege('public', '${APPLY}', 'execute')`), "f");
    assert.equal(psql(database, "select has_table_privilege('service_role', 'public.billing_stripe_events', 'update')"), "f");
    assert.equal(psql(database, "select has_table_privilege('service_role', 'public.billing_stripe_events', 'delete')"), "f");
    assert.equal(psql(database, "select has_table_privilege('service_role', 'public.billing_stripe_invoice_proofs', 'update')"), "t");
    assert.equal(psql(database, "select has_table_privilege('service_role', 'public.billing_stripe_invoice_proofs', 'delete')"), "f");
    assert.equal(psql(database, "select has_table_privilege('service_role', 'public.billing_checkout_sessions', 'delete')"), "f");
    psql(database, "delete from public.billing_subscriptions");
    const conflict = psqlTry(`begin; select set_config('role', 'service_role', true); ${call({
      eventId: "evt_hist_wrong",
      eventType: "invoice.paid",
      created: TIE + 1,
      action: "invoice",
      customerId: "cus_B",
      subscriptionId: "sub_hist",
      invoiceId: "in_hist700",
      priceId: "price_basic900",
      plan: "basic",
      amount: 900,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    })}; commit;`);
    assert.equal(conflict.ok, true);
    assert.match(conflict.stdout, /invoice_conflict/);
    assert.equal(psql(database, "select coalesce(paid_plan, '') || '|' || amount_paid::text from public.billing_stripe_invoice_proofs where stripe_invoice_id = 'in_hist700'"), "|700");
    assert.match(run({
      eventId: "evt_hist_complete",
      eventType: "invoice.paid",
      created: TIE + 2,
      action: "invoice",
      customerId: "cus_B",
      subscriptionId: "sub_hist",
      invoiceId: "in_hist700",
      priceId: "price_basic700",
      plan: "basic",
      amount: 700,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    }), /invoice_applied/);
    assert.match(payment("evt_new900_pay", "in_new900", 900, {
      invoicePaymentId: "inpay_new900",
      paymentIntentId: "pi_new900",
    }), /payment_awaiting_invoice/);
    assert.equal(psql(database, "select coalesce(paid_plan, '') from public.billing_stripe_invoice_proofs where stripe_invoice_id = 'in_new900'"), "");
    assert.match(run({
      eventId: "evt_new900_invoice",
      eventType: "invoice.paid",
      created: TIE + 3,
      action: "invoice",
      customerId: "cus_A",
      subscriptionId: "sub_stored",
      invoiceId: "in_new900",
      priceId: "price_basic900",
      plan: "basic",
      amount: 900,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    }), /invoice_applied/);
    assert.equal(psql(database, "select paid_plan || '|' || amount_paid::text from public.billing_stripe_invoices where stripe_invoice_id = 'in_stored700'"), "basic|700");
    const rejected = psqlTry(`begin; select set_config('role', 'service_role', true); ${call({
      eventId: "evt_bad701",
      eventType: "invoice.paid",
      created: TIE + 4,
      action: "invoice",
      customerId: "cus_B",
      subscriptionId: "sub_hist",
      invoiceId: "in_bad701",
      priceId: "price_basic900",
      plan: "basic",
      amount: 701,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    })}; commit;`);
    assert.equal(rejected.ok, false);
    assert.match(rejected.stderr, /BILLING_EVENT_REJECTED/);
    reset();
    psql(database, "delete from public.billing_checkout_sessions");
    assert.equal(psql(database, "select has_table_privilege('service_role', 'public.billing_stripe_events', 'select')"), "t");
    assert.equal(psql(database, "select has_table_privilege('service_role', 'public.billing_stripe_events', 'insert')"), "t");
    assert.equal(psql(database, "select has_table_privilege('service_role', 'public.billing_stripe_events', 'update')"), "f");
    assert.equal(psql(database, "select has_table_privilege('service_role', 'public.billing_stripe_events', 'delete')"), "f");
    assert.equal(psql(database, "select has_table_privilege('service_role', 'public.billing_stripe_invoices', 'select')"), "t");
    assert.equal(psql(database, "select has_table_privilege('service_role', 'public.billing_stripe_invoices', 'insert')"), "t");
    assert.equal(psql(database, "select has_table_privilege('service_role', 'public.billing_stripe_invoices', 'update')"), "f");
    assert.equal(psql(database, "select has_table_privilege('service_role', 'public.billing_stripe_invoices', 'delete')"), "f");
    assert.equal(psql(database, "select has_table_privilege('anon', 'public.billing_stripe_events', 'select')"), "f");
    assert.equal(psql(database, "select has_table_privilege('service_role', 'public.billing_stripe_customers', 'update')"), "f");
    assert.equal(psql(database, `select has_function_privilege('service_role', '${APPLY}', 'execute')`), "t");
    assert.equal(psql(database, `select has_function_privilege('anon', '${APPLY}', 'execute')`), "f");
    assert.equal(psql(database, `select has_function_privilege('authenticated', '${APPLY}', 'execute')`), "f");
    assert.equal(psql(database, `select has_function_privilege('public', '${APPLY}', 'execute')`), "f");
    assert.equal(psql(database, "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'billing_apply_stripe_event'"), "1");
    assert.equal(psql(database, "select has_function_privilege('anon', 'public.billing_lock_stripe_customer(text)', 'execute')"), "f");
    assert.equal(psql(database, "select has_table_privilege('service_role', 'public.billing_stripe_invoice_proofs', 'select')"), "t");
    assert.equal(psql(database, "select has_table_privilege('service_role', 'public.billing_stripe_invoice_proofs', 'insert')"), "t");
    assert.equal(psql(database, "select has_table_privilege('service_role', 'public.billing_stripe_invoice_proofs', 'update')"), "t");
    assert.equal(psql(database, "select has_table_privilege('service_role', 'public.billing_stripe_invoice_proofs', 'delete')"), "f");
    assert.equal(psql(database, "select has_table_privilege('anon', 'public.billing_stripe_invoice_proofs', 'select')"), "f");
    assert.equal(psql(database, "select has_table_privilege('authenticated', 'public.billing_stripe_invoice_proofs', 'select')"), "f");
    const anonRead = psqlTry("begin; set local role anon; select count(*) from public.billing_stripe_invoice_proofs; commit;");
    assert.equal(anonRead.ok, false);
    assert.match(anonRead.stderr, /permission denied/);
    psqlFile(database, "supabase/migrations/20261121_billing_livemode_account.sql");
    includeAccount = true;
    assert.equal(psql(database, "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'billing_apply_stripe_event'"), "1");
    assert.equal(
      psql(database, "select pg_get_function_identity_arguments(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'billing_apply_stripe_event'"),
      `${signatureBefore}, p_account_id text`
    );
    assert.equal(psql(database, `select has_function_privilege('service_role', '${APPLY_MODE}', 'execute')`), "t");
    assert.equal(psql(database, `select has_function_privilege('anon', '${APPLY_MODE}', 'execute')`), "f");
    assert.equal(psql(database, `select has_function_privilege('authenticated', '${APPLY_MODE}', 'execute')`), "f");
    assert.equal(psql(database, `select has_function_privilege('public', '${APPLY_MODE}', 'execute')`), "f");
    assert.equal(psql(database, "select relrowsecurity from pg_class where oid = 'public.billing_subscriptions'::regclass"), "t");
    assert.equal(psql(database, "select count(*) from pg_policy where polrelid = 'public.billing_subscriptions'::regclass"), "0");
    assert.equal(psql(database, "select livemode is null and stripe_account_id is null from public.billing_stripe_customers where stripe_customer_id = 'cus_A'"), "t");
    psqlFile(database, "supabase/migrations/20261122_billing_verified_binding.sql");
    assert.equal(psql(database, "select has_column_privilege('service_role', 'public.billing_stripe_customers', 'livemode', 'UPDATE')"), "t");
    assert.equal(psql(database, "select has_column_privilege('service_role', 'public.billing_stripe_customers', 'stripe_account_id', 'UPDATE')"), "t");
    assert.equal(psql(database, "select has_column_privilege('service_role', 'public.billing_stripe_customers', 'user_id', 'UPDATE')"), "f");
    assert.equal(psql(database, "select has_table_privilege('service_role', 'public.billing_stripe_customers', 'DELETE')"), "f");
    assert.equal(psql(database, "select pg_get_function_identity_arguments(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'billing_apply_stripe_event'"), `${signatureBefore}, p_account_id text`);
    psql(database, "update public.billing_stripe_customers set livemode = false, stripe_account_id = 'acct_test' where stripe_customer_id in ('cus_A', 'cus_B')");
  });

  it("keeps an invoice from granting access until a status event arrives", () => {
    reset();
    assert.match(invoice("evt_invoice_only", "in_only"), /invoice_applied/);
    const row = snapshot(USER_B);
    assert.equal(row?.subscription_status, "incomplete");
    assert.equal(row?.paid_plan, "pro");
    assert.equal(entitlement(USER_B), "none");
    assert.equal(entitlement(USER_A), "none");
    assert.equal(psql(database, "select count(*) from public.billing_stripe_invoices"), "1");
  });

  it("lets every denying status beat active and past_due in both orders", () => {
    for (const denied of DENYING) {
      for (const granted of ["active", "past_due"]) {
        for (const deniedFirst of [true, false]) {
          reset();
          invoice(`evt_inv_${denied}_${granted}_${deniedFirst}`, `in_${denied}_${granted}_${deniedFirst}`);
          const first = deniedFirst
            ? status(`evt_first_${denied}_${granted}_d`, denied)
            : status(`evt_first_${denied}_${granted}_g`, granted);
          const second = deniedFirst
            ? status(`evt_second_${denied}_${granted}_g`, granted)
            : status(`evt_second_${denied}_${granted}_d`, denied);
          assert.match(first, deniedFirst ? /status_applied/ : /status_applied/);
          assert.match(second, deniedFirst ? /tie_rejected_less_restrictive/ : /tie_applied_stricter/);
          assert.equal(snapshot(USER_B)?.subscription_status, denied);
          assert.equal(entitlement(USER_B), "none");
          assert.equal(psql(database, "select count(*) from public.billing_stripe_events"), "4");
        }
      }
    }
  });

  it("keeps past_due over active and still grants the paid plan", () => {
    for (const pastDueFirst of [true, false]) {
      reset();
      invoice(`evt_inv_due_${pastDueFirst}`, `in_due_${pastDueFirst}`);
      if (pastDueFirst) {
        status("evt_due_first", "past_due");
        assert.match(status("evt_active_second", "active"), /tie_rejected_less_restrictive/);
      } else {
        status("evt_active_first", "active");
        assert.match(status("evt_due_second", "past_due"), /tie_applied_stricter/);
      }
      assert.equal(snapshot(USER_B)?.subscription_status, "past_due");
      assert.equal(entitlement(USER_B), "pro");
      assert.equal(entitlement(USER_A), "none");
    }
  });

  it("keeps cancel_at_period_end true for the same status and timestamp in both orders", () => {
    for (const cancelFirst of [true, false]) {
      reset();
      invoice(`evt_inv_cancel_${cancelFirst}`, `in_cancel_${cancelFirst}`);
      status(`evt_cancel_a_${cancelFirst}`, "active", TIE, cancelFirst);
      status(`evt_cancel_b_${cancelFirst}`, "active", TIE, !cancelFirst);
      const row = snapshot(USER_B);
      assert.equal(row?.subscription_status, "active");
      assert.equal(row?.cancel_at_period_end, true);
      assert.equal(entitlement(USER_B), "pro");
    }
  });

  it("does not let a status event move paid_until", () => {
    reset();
    invoice("evt_paid_until", "in_paid_until");
    const before = snapshot(USER_B)?.paid_until;
    status("evt_paid_until_status", "active", TIE + 10);
    assert.equal(snapshot(USER_B)?.paid_until, before);
    assert.equal(entitlement(USER_B), "pro");
  });

  it("folds a status that arrived before the first invoice", () => {
    reset();
    assert.match(status("evt_before_invoice", "active"), /status_pending/);
    assert.equal(snapshot(USER_B), null);
    assert.match(invoice("evt_after_status", "in_after_status"), /invoice_applied/);
    assert.equal(snapshot(USER_B)?.subscription_status, "active");
    assert.equal(entitlement(USER_B), "pro");
  });

  it("records the other subscription and does not replace the bound one", () => {
    reset();
    invoice("evt_identity", "in_identity", "sub_B");
    status("evt_identity_status", "active");
    const before = snapshot(USER_B);
    const mismatched = status("evt_old_sub", "canceled", TIE + 5, false, "sub_old");
    assert.match(mismatched, /subscription_mismatch/);
    assert.deepEqual(snapshot(USER_B), before);
    assert.equal(entitlement(USER_B), "pro");
    const otherInvoice = run({
      eventId: "evt_old_invoice",
      eventType: "invoice.paid",
      created: TIE + 6,
      action: "invoice",
      customerId: "cus_B",
      subscriptionId: "sub_old",
      invoiceId: "in_old",
      priceId: "price_elite",
      plan: "elite",
      amount: 3900,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END + 86400,
    });
    assert.match(otherInvoice, /subscription_mismatch/);
    assert.equal(snapshot(USER_B)?.paid_plan, "pro");
    assert.equal(snapshot(USER_B)?.paid_until, before?.paid_until);
  });

  it("retries a missing binding without storing the event", () => {
    reset();
    psql(database, "delete from public.billing_stripe_customers where stripe_customer_id = 'cus_missing'");
    const missing = run({
      eventId: "evt_missing",
      eventType: "invoice.paid",
      created: TIE,
      action: "invoice",
      customerId: "cus_missing",
      subscriptionId: "sub_missing",
      invoiceId: "in_missing",
      priceId: "price_pro",
      plan: "pro",
      amount: 1900,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });
    assert.match(missing, /binding_missing/);
    assert.equal(psql(database, "select count(*) from public.billing_stripe_events where event_id = 'evt_missing'"), "0");
    assert.equal(snapshot(USER_B), null);
  });

  it("stores a live invoice half without granting access before its payment", () => {
    reset();
    psql(database, "update public.billing_stripe_customers set livemode = true, stripe_account_id = 'acct_live' where stripe_customer_id = 'cus_B'");
    try {
    const live = run({
      eventId: "evt_live",
      eventType: "invoice.paid",
      created: TIE,
      livemode: true,
      action: "invoice",
      customerId: "cus_B",
      subscriptionId: "sub_B",
      invoiceId: "in_live",
      priceId: "price_pro",
      plan: "pro",
      amount: 1900,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      accountId: "acct_live",
    });
    assert.match(live, /invoice_awaiting_payment/);
    assert.equal(snapshot(USER_B), null);
    assert.equal(psql(database, "select livemode::text || ':' || outcome || ':' || stripe_account_id from public.billing_stripe_events where event_id = 'evt_live'"), "true:invoice_awaiting_payment:acct_live");
    assert.equal(entitlement(USER_B), "none");
    } finally {
      psql(database, "update public.billing_stripe_customers set livemode = false, stripe_account_id = 'acct_test' where stripe_customer_id = 'cus_B'");
    }
  });

  it("rejects a partial amount before it can extend paid time", () => {
    reset();
    const failed = psqlTry(`begin; select set_config('role', 'service_role', true); ${call({
      eventId: "evt_partial",
      eventType: "invoice.paid",
      created: TIE,
      action: "invoice",
      customerId: "cus_B",
      subscriptionId: "sub_B",
      invoiceId: "in_partial",
      priceId: "price_pro",
      plan: "pro",
      amount: 100,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    })}; commit;`);
    assert.equal(failed.ok, false);
    assert.match(failed.stderr, /BILLING_EVENT_REJECTED/);
    assert.equal(psql(database, "select count(*) from public.billing_stripe_events"), "0");
    assert.equal(snapshot(USER_B), null);
  });

  it("does not move paid_until for a lone invoice or a lone payment", () => {
    reset();
    assert.match(run({
      eventId: "evt_lone_invoice",
      eventType: "invoice.paid",
      created: TIE,
      action: "invoice",
      customerId: "cus_B",
      subscriptionId: "sub_B",
      invoiceId: "in_lone",
      priceId: "price_pro",
      plan: "pro",
      amount: 1900,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    }), /invoice_awaiting_payment/);
    assert.equal(snapshot(USER_B), null);
    assert.equal(entitlement(USER_B), "none");
    assert.match(payment("evt_lone_payment", "in_lonepay"), /payment_awaiting_invoice/);
    assert.equal(snapshot(USER_B), null);
    assert.equal(psql(database, "select count(*) from public.billing_stripe_customers"), "2");
    assert.equal(psql(database, "select coalesce(user_id::text, '') from public.billing_stripe_invoice_proofs where stripe_invoice_id = 'in_lonepay'"), "");
  });

  it("sets paid_until from either arrival order and still grants none before status", () => {
    reset();
    assert.match(run({
      eventId: "evt_order_invoice",
      eventType: "invoice.paid",
      created: TIE,
      action: "invoice",
      customerId: "cus_B",
      subscriptionId: "sub_B",
      invoiceId: "in_order",
      priceId: "price_pro",
      plan: "pro",
      amount: 1900,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    }), /invoice_awaiting_payment/);
    assert.equal(snapshot(USER_B), null);
    assert.match(payment("evt_order_payment", "in_order"), /invoice_applied/);
    assert.equal(snapshot(USER_B)?.subscription_status, "incomplete");
    assert.equal(entitlement(USER_B), "none");
    assert.equal(psql(database, "select trunc(extract(epoch from paid_until))::text from public.billing_subscriptions"), String(PERIOD_END));
    assert.match(status("evt_order_status", "active", TIE + 5), /status_applied/);
    assert.equal(psql(database, "select trunc(extract(epoch from paid_until))::text from public.billing_subscriptions"), String(PERIOD_END));
    assert.equal(entitlement(USER_B), "pro");
  });

  it("treats the same payment object as one proof and a changed object as a conflict", () => {
    reset();
    assert.match(payment("evt_pay_same", "in_same"), /payment_awaiting_invoice/);
    assert.match(payment("evt_pay_same_again", "in_same", 1900, {
      invoicePaymentId: "inpay_same",
      paymentIntentId: "pi_same",
    }), /payment_already_recorded/);
    assert.match(payment("evt_pay_same_amount", "in_same", 700, {
      invoicePaymentId: "inpay_same",
      paymentIntentId: "pi_same",
    }), /payment_conflict/);
    assert.match(payment("evt_pay_same_currency", "in_same", 1900, {
      invoicePaymentId: "inpay_same",
      paymentIntentId: "pi_same",
      currency: "eur",
    }), /payment_conflict/);
    assert.equal(psql(database, "select amount_paid::text || ':' || currency from public.billing_stripe_invoice_proofs where stripe_invoice_id = 'in_same'"), "1900:usd");
    assert.equal(snapshot(USER_B), null);
    assert.match(payment("evt_pay_other_object", "in_same", 1900, {
      invoicePaymentId: "inpay_otherobject",
      paymentIntentId: "pi_otherobject",
    }), /payment_conflict/);
    assert.equal(psql(database, "select invoice_payment_id from public.billing_stripe_invoice_proofs where stripe_invoice_id = 'in_same'"), "inpay_same");
  });

  it("does not hide a changed invoice as a duplicate", () => {
    reset();
    assert.match(run({
      eventId: "evt_inv_half",
      eventType: "invoice.paid",
      created: TIE,
      action: "invoice",
      customerId: "cus_B",
      subscriptionId: "sub_B",
      invoiceId: "in_half",
      priceId: "price_pro",
      plan: "pro",
      amount: 1900,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    }), /invoice_awaiting_payment/);
    assert.match(run({
      eventId: "evt_inv_half_again",
      eventType: "invoice.paid",
      created: TIE + 1,
      action: "invoice",
      customerId: "cus_B",
      subscriptionId: "sub_B",
      invoiceId: "in_half",
      priceId: "price_pro",
      plan: "pro",
      amount: 1900,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    }), /invoice_already_recorded/);
    assert.match(run({
      eventId: "evt_inv_half_changed",
      eventType: "invoice.paid",
      created: TIE + 2,
      action: "invoice",
      customerId: "cus_B",
      subscriptionId: "sub_B",
      invoiceId: "in_half",
      priceId: "price_pro",
      plan: "pro",
      amount: 1900,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END + 86400,
    }), /invoice_conflict/);
    assert.equal(psql(database, "select trunc(extract(epoch from period_end))::text from public.billing_stripe_invoice_proofs where stripe_invoice_id = 'in_half'"), String(PERIOD_END));
    assert.equal(snapshot(USER_B), null);
  });

  it("applies the same invoice once after the binding arrives", () => {
    reset();
    const user = "33333333-3333-4333-8333-333333333333";
    psql(database, `insert into auth.users (id) values (${quote(user)}::uuid)`);
    assert.match(payment("evt_bind_payment", "in_bindlate"), /payment_awaiting_invoice/);
    const invoiceInput = {
      eventId: "evt_bind_invoice",
      eventType: "invoice.paid",
      created: TIE,
      action: "invoice" as const,
      customerId: "cus_bindlate",
      subscriptionId: "sub_bindlate",
      invoiceId: "in_bindlate",
      priceId: "price_pro",
      plan: "pro",
      amount: 1900,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    };
    assert.match(run(invoiceInput), /binding_missing/);
    assert.equal(psql(database, "select count(*) from public.billing_stripe_events where event_id = 'evt_bind_invoice'"), "0");
    assert.equal(psql(database, "select count(*) from public.billing_stripe_customers where stripe_customer_id = 'cus_bindlate'"), "0");
    assert.equal(snapshot(user), null);
    psql(database, `insert into public.billing_stripe_customers (user_id, stripe_customer_id, livemode, stripe_account_id) values (${quote(user)}::uuid, 'cus_bindlate', false, 'acct_test')`);
    assert.match(run(invoiceInput), /invoice_applied/);
    assert.equal(psql(database, "select count(*) from public.billing_stripe_invoices"), "1");
    assert.equal(psql(database, "select count(*) from public.billing_stripe_events where event_id = 'evt_bind_invoice'"), "1");
    assert.equal(psql(database, "select invoice_event_id || '|' || payment_event_id || '|' || invoice_payment_id from public.billing_stripe_invoice_proofs where stripe_invoice_id = 'in_bindlate'"), "evt_bind_invoice|evt_bind_payment|inpay_bindlate");
    assert.equal(snapshot(user)?.subscription_status, "incomplete");
    assert.equal(psql(database, `select trunc(extract(epoch from paid_until))::text from public.billing_subscriptions where user_id = ${quote(user)}::uuid`), String(PERIOD_END));
    assert.equal(entitlement(user), "none");
    assert.match(run(invoiceInput), /duplicate/);
    assert.equal(psql(database, "select count(*) from public.billing_stripe_invoices"), "1");
    assert.equal(psql(database, `select trunc(extract(epoch from paid_until))::text from public.billing_subscriptions where user_id = ${quote(user)}::uuid`), String(PERIOD_END));
  });

  it("keeps the applied proof when later payment and invoice content conflict", () => {
    reset();
    assert.match(payment("evt_after_payment", "in_after"), /payment_awaiting_invoice/);
    assert.match(run({
      eventId: "evt_after_invoice",
      eventType: "invoice.paid",
      created: TIE,
      action: "invoice",
      customerId: "cus_B",
      subscriptionId: "sub_B",
      invoiceId: "in_after",
      priceId: "price_pro",
      plan: "pro",
      amount: 1900,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    }), /invoice_applied/);
    const proof = psql(database, "select invoice_event_id || '|' || payment_event_id || '|' || invoice_payment_id || '|' || payment_intent_id || '|' || amount_paid::text || '|' || currency || '|' || trunc(extract(epoch from period_end))::text from public.billing_stripe_invoice_proofs where stripe_invoice_id = 'in_after'");
    const invoiceRow = psql(database, "select event_id || '|' || amount_paid::text || '|' || currency || '|' || trunc(extract(epoch from period_end))::text from public.billing_stripe_invoices where stripe_invoice_id = 'in_after'");
    const paidUntil = psql(database, "select trunc(extract(epoch from paid_until))::text from public.billing_subscriptions where user_id = '22222222-2222-4222-8222-222222222222'");
    assert.match(payment("evt_after_other", "in_after", 1900, {
      invoicePaymentId: "inpay_afterother",
      paymentIntentId: "pi_afterother",
    }), /payment_conflict/);
    assert.match(payment("evt_after_changed", "in_after", 700, {
      invoicePaymentId: "inpay_after",
      paymentIntentId: "pi_after",
    }), /payment_conflict/);
    assert.match(run({
      eventId: "evt_after_invoice_changed",
      eventType: "invoice.paid",
      created: TIE + 2,
      action: "invoice",
      customerId: "cus_B",
      subscriptionId: "sub_B",
      invoiceId: "in_after",
      priceId: "price_pro",
      plan: "pro",
      amount: 1900,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END + 86400,
    }), /invoice_conflict/);
    assert.equal(psql(database, "select invoice_event_id || '|' || payment_event_id || '|' || invoice_payment_id || '|' || payment_intent_id || '|' || amount_paid::text || '|' || currency || '|' || trunc(extract(epoch from period_end))::text from public.billing_stripe_invoice_proofs where stripe_invoice_id = 'in_after'"), proof);
    assert.equal(psql(database, "select event_id || '|' || amount_paid::text || '|' || currency || '|' || trunc(extract(epoch from period_end))::text from public.billing_stripe_invoices where stripe_invoice_id = 'in_after'"), invoiceRow);
    assert.equal(psql(database, "select trunc(extract(epoch from paid_until))::text from public.billing_subscriptions where user_id = '22222222-2222-4222-8222-222222222222'"), paidUntil);
    assert.equal(psql(database, "select count(*) from public.billing_stripe_invoices"), "1");
  });

  it("lets the later invoice finish a repeated payment exactly once", () => {
    reset();
    assert.match(payment("evt_repeat_payment", "in_repeat"), /payment_awaiting_invoice/);
    assert.match(payment("evt_repeat_payment_again", "in_repeat", 1900, {
      invoicePaymentId: "inpay_repeat",
      paymentIntentId: "pi_repeat",
    }), /payment_already_recorded/);
    assert.equal(snapshot(USER_B), null);
    const invoiceInput = {
      eventId: "evt_repeat_invoice",
      eventType: "invoice.paid",
      created: TIE,
      action: "invoice" as const,
      customerId: "cus_B",
      subscriptionId: "sub_B",
      invoiceId: "in_repeat",
      priceId: "price_pro",
      plan: "pro",
      amount: 1900,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    };
    assert.match(run(invoiceInput), /invoice_applied/);
    assert.equal(psql(database, "select count(*) from public.billing_stripe_invoices"), "1");
    assert.equal(psql(database, "select trunc(extract(epoch from paid_until))::text from public.billing_subscriptions"), String(PERIOD_END));
    assert.equal(entitlement(USER_B), "none");
    assert.match(run({ ...invoiceInput, eventId: "evt_repeat_invoice_again", created: TIE + 1 }), /invoice_already_recorded/);
    assert.equal(psql(database, "select count(*) from public.billing_stripe_invoices"), "1");
    assert.equal(psql(database, "select trunc(extract(epoch from paid_until))::text from public.billing_subscriptions"), String(PERIOD_END));
    assert.equal(psql(database, "select invoice_payment_id || '|' || payment_event_id from public.billing_stripe_invoice_proofs where stripe_invoice_id = 'in_repeat'"), "inpay_repeat|evt_repeat_payment");
  });

  it("does not apply an invoice that carries payment fields without a payment proof", () => {
    reset();
    assert.match(run({
      eventId: "evt_smuggle",
      eventType: "invoice.paid",
      created: TIE,
      action: "invoice",
      customerId: "cus_B",
      subscriptionId: "sub_B",
      invoiceId: "in_smuggle",
      priceId: "price_pro",
      plan: "pro",
      amount: 1900,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      invoicePaymentId: "inpay_smuggle",
      paymentIntentId: "pi_smuggle",
      amountRequested: 1900,
      paymentStatus: "paid",
      isDefault: true,
    }), /invoice_awaiting_payment/);
    assert.equal(snapshot(USER_B), null);
    assert.equal(entitlement(USER_B), "none");
    assert.equal(psql(database, "select count(*) from public.billing_stripe_invoices"), "0");
    assert.equal(psql(database, "select coalesce(invoice_payment_id, '') || '|' || coalesce(payment_intent_id, '') || '|' || coalesce(payment_event_id, '') from public.billing_stripe_invoice_proofs where stripe_invoice_id = 'in_smuggle'"), "||");
    assert.equal(psql(database, "select count(*) from public.billing_stripe_invoice_proofs where invoice_payment_id = 'inpay_smuggle' or payment_intent_id = 'pi_smuggle'"), "0");
  });

  it("refuses to use one PaymentIntent as proof for two invoices", () => {
    reset();
    assert.match(payment("evt_pi_a", "in_pia"), /payment_awaiting_invoice/);
    assert.match(payment("evt_pi_b", "in_pib", 1900, {
      invoicePaymentId: "inpay_pib",
      paymentIntentId: "pi_pia",
    }), /payment_reused/);
    assert.equal(psql(database, "select count(*) from public.billing_stripe_invoice_proofs where stripe_invoice_id = 'in_pib'"), "0");
    assert.match(run({
      eventId: "evt_pi_invoice",
      eventType: "invoice.paid",
      created: TIE,
      action: "invoice",
      customerId: "cus_B",
      subscriptionId: "sub_B",
      invoiceId: "in_pia",
      priceId: "price_pro",
      plan: "pro",
      amount: 1900,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    }), /invoice_applied/);
    assert.equal(psql(database, "select count(*) from public.billing_stripe_invoices"), "1");
    assert.equal(entitlement(USER_B), "none");
  });

  it("retries after rollback and after a failure once the event insert has happened", () => {
    reset();
    psql(database, `begin; select set_config('role', 'service_role', true); ${call({
      eventId: "evt_rollback",
      eventType: "invoice_payment.paid",
      created: TIE,
      action: "payment",
      invoiceId: "in_rollback",
      invoicePaymentId: "inpay_rollback",
      paymentIntentId: "pi_rollback",
      amount: 1900,
    })}; rollback;`);
    assert.equal(psql(database, "select count(*) from public.billing_stripe_events where event_id = 'evt_rollback'"), "0");
    assert.match(payment("evt_rollback", "in_rollback"), /payment_awaiting_invoice/);

    assert.match(run({
      eventId: "evt_fail_invoice",
      eventType: "invoice.paid",
      created: TIE,
      action: "invoice",
      customerId: "cus_B",
      subscriptionId: "sub_B",
      invoiceId: "in_failwrite",
      priceId: "price_pro",
      plan: "pro",
      amount: 1900,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    }), /invoice_awaiting_payment/);
    psql(database, `
      create function public.billing_test_fail_event_write()
      returns trigger language plpgsql as $fn$
      begin
        if new.event_id = 'evt_failwrite' then
          raise exception 'BILLING_TEST_WRITE_FAILED';
        end if;
        return null;
      end;
      $fn$;
      create constraint trigger billing_test_fail_event_write
      after insert on public.billing_stripe_events
      deferrable initially deferred
      for each row
      when (new.event_id = 'evt_failwrite')
      execute function public.billing_test_fail_event_write();
    `);
    try {
      const failed = psqlTry(`begin; select set_config('role', 'service_role', true); ${call({
        eventId: "evt_failwrite",
        eventType: "invoice_payment.paid",
        created: TIE + 1,
        action: "payment",
        invoiceId: "in_failwrite",
        invoicePaymentId: "inpay_failwrite",
        paymentIntentId: "pi_failwrite",
        amount: 1900,
      })}; commit;`);
      assert.equal(failed.ok, false);
      assert.match(failed.stderr, /BILLING_TEST_WRITE_FAILED/);
      assert.equal(psql(database, "select count(*) from public.billing_stripe_events where event_id = 'evt_failwrite'"), "0");
      assert.equal(psql(database, "select payment_event_id is null from public.billing_stripe_invoice_proofs where stripe_invoice_id = 'in_failwrite'"), "t");
      assert.equal(snapshot(USER_B), null);
    } finally {
      psql(database, "drop trigger if exists billing_test_fail_event_write on public.billing_stripe_events; drop function if exists public.billing_test_fail_event_write();");
    }
    assert.match(payment("evt_failwrite", "in_failwrite"), /invoice_applied/);
    assert.equal(snapshot(USER_B)?.subscription_status, "incomplete");
    assert.equal(entitlement(USER_B), "none");
    assert.equal(psql(database, "select trunc(extract(epoch from paid_until))::text from public.billing_subscriptions"), String(PERIOD_END));
  });

  it("locks the invoice before the customer so status can proceed while the invoice waits", async () => {
    reset();
    const probe = new PsqlSession("webhook_probe");
    const invoiceSession = new PsqlSession("webhook_invoice");
    const statusSession = new PsqlSession("webhook_status");
    try {
      await probe.exec("begin");
      await probe.exec("select pg_advisory_xact_lock(hashtextextended('stripe-invoice:in_lockorder', 0))");
      let invoiceFinished = false;
      const invoiceResult = invoiceSession.exec(`begin; select set_config('role', 'service_role', true); ${call({
        eventId: "evt_lockorder",
        eventType: "invoice.paid",
        created: TIE,
        action: "invoice",
        customerId: "cus_B",
        subscriptionId: "sub_B",
        invoiceId: "in_lockorder",
        priceId: "price_pro",
        plan: "pro",
        amount: 1900,
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
      })};`).then((value) => {
        invoiceFinished = true;
        return value;
      });
      const deadline = Date.now() + 5000;
      let waiting = "";
      while (Date.now() < deadline && !invoiceFinished) {
        waiting = psql(database, "select coalesce(wait_event, '') from pg_stat_activity where application_name = 'webhook_invoice'");
        if (waiting === "advisory") break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      assert.equal(invoiceFinished, false);
      assert.equal(waiting, "advisory");
      assert.equal(psql(database, "select count(*) from pg_locks l join pg_stat_activity a on a.pid = l.pid where a.application_name = 'webhook_invoice' and l.locktype = 'tuple'"), "0");
      const statusResult = await statusSession.exec(`begin; select set_config('role', 'service_role', true); ${call({
        eventId: "evt_lockstatus",
        eventType: "customer.subscription.updated",
        created: TIE,
        action: "status",
        customerId: "cus_B",
        subscriptionId: "sub_B",
        status: "active",
        cancel: false,
      })}; commit;`);
      assert.match(statusResult, /status_pending/);
      assert.equal(invoiceFinished, false);
      await probe.exec("commit");
      assert.match(await invoiceResult, /invoice_awaiting_payment/);
      await invoiceSession.exec("commit");
      assert.equal(snapshot(USER_B), null);
    } finally {
      await probe.close();
      await invoiceSession.close();
      await statusSession.close();
    }
  });

  it("serializes a concurrent invoice, payment, and status update", async () => {
    reset();
    const invoiceSession = new PsqlSession("webhook_invoice");
    const paymentSession = new PsqlSession("webhook_payment");
    const statusSession = new PsqlSession("webhook_status");
    try {
      await invoiceSession.exec(`begin; select set_config('role', 'service_role', true); ${call({
        eventId: "evt_three_invoice",
        eventType: "invoice.paid",
        created: TIE,
        action: "invoice",
        customerId: "cus_B",
        subscriptionId: "sub_B",
        invoiceId: "in_three",
        priceId: "price_pro",
        plan: "pro",
        amount: 1900,
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
      })};`);
      let paymentFinished = false;
      let statusFinished = false;
      const paymentResult = paymentSession.exec(`begin; select set_config('role', 'service_role', true); ${call({
        eventId: "evt_three_payment",
        eventType: "invoice_payment.paid",
        created: TIE,
        action: "payment",
        invoiceId: "in_three",
        invoicePaymentId: "inpay_three",
        paymentIntentId: "pi_three",
        amount: 1900,
      })}; commit;`).then((value) => {
        paymentFinished = true;
        return value;
      });
      const statusResult = statusSession.exec(`begin; select set_config('role', 'service_role', true); ${call({
        eventId: "evt_three_status",
        eventType: "customer.subscription.updated",
        created: TIE,
        action: "status",
        customerId: "cus_B",
        subscriptionId: "sub_B",
        status: "active",
        cancel: false,
      })}; commit;`).then((value) => {
        statusFinished = true;
        return value;
      });
      const deadline = Date.now() + 5000;
      let paymentWait = "";
      let statusWait = "";
      const statusBlocked = () => statusWait === "tuple" || statusWait === "transactionid";
      while (Date.now() < deadline && !(paymentWait === "advisory" && statusBlocked())) {
        paymentWait = psql(database, "select coalesce(wait_event, '') from pg_stat_activity where application_name = 'webhook_payment' and state = 'active'");
        statusWait = psql(database, "select coalesce(wait_event, '') from pg_stat_activity where application_name = 'webhook_status' and state = 'active'");
        if (paymentFinished || statusFinished) break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      assert.equal(paymentFinished, false);
      assert.equal(statusFinished, false);
      assert.equal(paymentWait, "advisory");
      assert.equal(statusBlocked(), true);
      await invoiceSession.exec("commit");
      assert.match(await paymentResult, /invoice_applied/);
      assert.match(await statusResult, /status_applied|status_pending/);
      assert.equal(psql(database, "select count(*) from public.billing_subscriptions"), "1");
      assert.equal(psql(database, "select count(*) from public.billing_stripe_invoices"), "1");
      assert.equal(snapshot(USER_B)?.subscription_status, "active");
      assert.equal(psql(database, "select trunc(extract(epoch from paid_until))::text from public.billing_subscriptions"), String(PERIOD_END));
      assert.equal(entitlement(USER_B), "pro");
      assert.equal(psql(database, "select count(*) from public.billing_stripe_events"), "3");
    } finally {
      await invoiceSession.close();
      await paymentSession.close();
      await statusSession.close();
    }
  });

  it("creates the first subscription from either payment order and isolates mode and account", () => {
    reset();
    assert.match(invoice("evt_first_invoice", "in_first", "sub_first"), /invoice_applied/);
    assert.equal(psql(database, "select livemode::text || ':' || stripe_account_id from public.billing_subscriptions where stripe_subscription_id = 'sub_first'"), "false:acct_test");
    assert.equal(entitlement(USER_B), "none");
    assert.match(status("evt_first_status", "active", TIE + 1, false, "sub_first"), /status_applied/);
    assert.equal(entitlement(USER_B), "pro");

    reset();
    assert.match(run({
      eventId: "evt_order_invoice",
      eventType: "invoice.paid",
      created: TIE,
      action: "invoice",
      customerId: "cus_A",
      subscriptionId: "sub_order",
      invoiceId: "in_order",
      priceId: "price_basic900",
      plan: "basic",
      amount: 900,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    }), /invoice_awaiting_payment/);
    assert.equal(snapshot(USER_A), null);
    assert.match(payment("evt_order_pay", "in_order", 900, {
      invoicePaymentId: "inpay_order",
      paymentIntentId: "pi_order",
    }), /invoice_applied/);
    assert.equal(psql(database, "select paid_plan || ':' || livemode::text || ':' || stripe_account_id from public.billing_subscriptions where user_id = " + quote(USER_A) + "::uuid"), "basic:false:acct_test");

    reset();
    assert.match(payment("evt_mix_pay", "in_mix", 1900, { livemode: false, accountId: "acct_test" }), /payment_awaiting_invoice/);
    assert.match(run({
      eventId: "evt_mix_invoice",
      eventType: "invoice.paid",
      created: TIE,
      livemode: true,
      action: "invoice",
      customerId: "cus_B",
      subscriptionId: "sub_mix",
      invoiceId: "in_mix",
      priceId: "price_pro",
      plan: "pro",
      amount: 1900,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      accountId: "acct_live",
    }), /mode_mismatch/);
    assert.equal(psql(database, "select count(*) from public.billing_subscriptions"), "0");
    assert.equal(psql(database, "select applied_at is null from public.billing_stripe_invoice_proofs where stripe_invoice_id = 'in_mix'"), "t");

    reset();
    assert.match(payment("evt_acct_pay", "in_acct"), /payment_awaiting_invoice/);
    assert.match(run({
      eventId: "evt_acct_invoice",
      eventType: "invoice.paid",
      created: TIE,
      action: "invoice",
      customerId: "cus_B",
      subscriptionId: "sub_acct",
      invoiceId: "in_acct",
      priceId: "price_pro",
      plan: "pro",
      amount: 1900,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      accountId: "acct_other",
    }), /account_mismatch/);
    assert.equal(snapshot(USER_B), null);
  });

  it("does not guess a mode for an existing subscription or an old payment half", () => {
    reset();
    psql(database, `insert into public.billing_subscriptions (
      user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, paid_plan, paid_until, subscription_status
    ) values (
      ${quote(USER_B)}::uuid, 'cus_B', 'sub_B', 'price_pro', 'pro', to_timestamp(${PERIOD_END}), 'active'
    )`);
    const before = psql(database, "select paid_until::text || ':' || coalesce(livemode::text, 'unknown') from public.billing_subscriptions where user_id = " + quote(USER_B) + "::uuid");
    assert.match(invoice("evt_unknown_mode", "in_unknown"), /mode_unknown/);
    assert.equal(psql(database, "select paid_until::text || ':' || coalesce(livemode::text, 'unknown') from public.billing_subscriptions where user_id = " + quote(USER_B) + "::uuid"), before);
    assert.equal(entitlement(USER_B), "none");

    reset();
    psql(database, `insert into public.billing_stripe_events (
      event_id, event_type, event_created, livemode, outcome
    ) values ('evt_oldhalf', 'invoice_payment.paid', now(), false, 'payment_awaiting_invoice')`);
    psql(database, `insert into public.billing_stripe_invoice_proofs (
      stripe_invoice_id, payment_event_id, invoice_payment_id, payment_intent_id, amount_paid, amount_requested, currency, payment_status, is_default, livemode
    ) values (
      'in_oldhalf', 'evt_oldhalf', 'inpay_oldhalf', 'pi_oldhalf', 1900, 1900, 'usd', 'paid', true, false
    )`);
    assert.match(run({
      eventId: "evt_old_invoice",
      eventType: "invoice.paid",
      created: TIE,
      action: "invoice",
      customerId: "cus_B",
      subscriptionId: "sub_old",
      invoiceId: "in_oldhalf",
      priceId: "price_pro",
      plan: "pro",
      amount: 1900,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    }), /account_unknown/);
    assert.equal(snapshot(USER_B), null);
    assert.equal(psql(database, "select stripe_account_id is null and applied_at is null from public.billing_stripe_invoice_proofs where stripe_invoice_id = 'in_oldhalf'"), "t");
  });

  it("stores a payment half when the customer is unverified and refuses an invoice that would grant access", () => {
    reset();
    psql(database, "update public.billing_stripe_customers set livemode = null, stripe_account_id = null where stripe_customer_id = 'cus_B'");
    try {
      assert.match(payment("evt_unverified_pay", "in_unverified"), /payment_awaiting_invoice/);
      assert.equal(snapshot(USER_B), null);
      assert.match(run({
        eventId: "evt_unverified_invoice",
        eventType: "invoice.paid",
        created: TIE,
        action: "invoice",
        customerId: "cus_B",
        subscriptionId: "sub_unverified",
        invoiceId: "in_unverified_only",
        priceId: "price_pro",
        plan: "pro",
        amount: 1900,
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
        metadataUserId: USER_A,
      }), /binding_unverified/);
      assert.equal(snapshot(USER_B), null);
      assert.equal(psql(database, "select outcome from public.billing_stripe_events where event_id = 'evt_unverified_invoice'"), "binding_unverified");
      assert.equal(entitlement(USER_B), "none");
    } finally {
      psql(database, "update public.billing_stripe_customers set livemode = false, stripe_account_id = 'acct_test' where stripe_customer_id = 'cus_B'");
    }
  });

  it("rejects a stored customer mode that does not match the event", () => {
    reset();
    psql(database, "update public.billing_stripe_customers set livemode = true, stripe_account_id = 'acct_live' where stripe_customer_id = 'cus_B'");
    try {
      assert.match(invoice("evt_customer_mode", "in_customer_mode"), /mode_mismatch/);
      assert.equal(snapshot(USER_B), null);
    } finally {
      psql(database, "update public.billing_stripe_customers set livemode = false, stripe_account_id = 'acct_test' where stripe_customer_id = 'cus_B'");
    }
  });
});
