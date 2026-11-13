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
const APPLY = "public.billing_apply_stripe_event(text,text,timestamptz,boolean,text,text,text,text,text,text,boolean,text,text,text,integer,timestamptz,timestamptz,text)";

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
  action: "invoice" | "status" | "reject";
  livemode?: boolean;
  outcome?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
  status?: string | null;
  cancel?: boolean | null;
  invoiceId?: string | null;
  priceId?: string | null;
  plan?: string | null;
  amount?: number | null;
  periodStart?: number | null;
  periodEnd?: number | null;
  metadataUserId?: string | null;
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
    ${sqlText(input.metadataUserId ?? null)}
  )`;
}

function run(input: ApplyInput): string {
  return psql(database, `begin; select set_config('role', 'service_role', true); ${call(input)}; commit;`);
}

function reset() {
  psql(database, "delete from public.billing_stripe_invoices");
  psql(database, "delete from public.billing_stripe_events");
  psql(database, "delete from public.billing_subscriptions");
}

function invoice(eventId: string, invoiceId: string, subscriptionId = "sub_B"): string {
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
    `select coalesce(user_id::text, '') || '|' || coalesce(paid_plan, '') || '|' || coalesce(subscription_status, '') || '|' || coalesce(cancel_at_period_end::text, '') || '|' || coalesce(to_char(paid_until at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), '') from public.billing_subscriptions where user_id = ${quote(userId)}::uuid`
  );
  if (!line) return null;
  const [user_id, paid_plan, subscription_status, cancel, paid_until] = line.split("|");
  return {
    user_id,
    paid_plan,
    subscription_status,
    cancel_at_period_end: cancel === "t" || cancel === "true",
    paid_until,
  };
}

function entitlement(userId: string): string {
  return getPaidPlan(snapshot(userId), userId, NOW);
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
    psql(database, `insert into public.billing_stripe_customers (user_id, stripe_customer_id) values (${quote(USER_A)}::uuid, 'cus_A'), (${quote(USER_B)}::uuid, 'cus_B')`);
    assert.equal(psql(database, "select has_table_privilege('service_role', 'public.billing_stripe_events', 'select')"), "t");
    assert.equal(psql(database, "select has_table_privilege('service_role', 'public.billing_stripe_events', 'insert')"), "t");
    assert.equal(psql(database, "select has_table_privilege('service_role', 'public.billing_stripe_events', 'update')"), "f");
    assert.equal(psql(database, "select has_table_privilege('service_role', 'public.billing_stripe_events', 'delete')"), "f");
    assert.equal(psql(database, "select has_table_privilege('service_role', 'public.billing_stripe_invoices', 'delete')"), "f");
    assert.equal(psql(database, "select has_table_privilege('anon', 'public.billing_stripe_events', 'select')"), "f");
    assert.equal(psql(database, "select has_table_privilege('service_role', 'public.billing_stripe_customers', 'update')"), "f");
    assert.equal(psql(database, `select has_function_privilege('service_role', '${APPLY}', 'execute')`), "t");
    assert.equal(psql(database, `select has_function_privilege('anon', '${APPLY}', 'execute')`), "f");
    assert.equal(psql(database, "select has_function_privilege('anon', 'public.billing_lock_stripe_customer(text)', 'execute')"), "f");
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
          assert.equal(psql(database, "select count(*) from public.billing_stripe_events"), "3");
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

  it("rejects a live invoice inside the database even if the action says invoice", () => {
    reset();
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
    });
    assert.match(live, /livemode_rejected/);
    assert.equal(snapshot(USER_B), null);
    assert.equal(psql(database, "select livemode::text || ':' || outcome from public.billing_stripe_events where event_id = 'evt_live'"), "true:livemode_rejected");
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

  it("serializes two concurrent first events through the customer binding lock", async () => {
    reset();
    const invoiceSession = new PsqlSession("webhook_invoice");
    const statusSession = new PsqlSession("webhook_status");
    try {
      await invoiceSession.exec(`begin; select set_config('role', 'service_role', true); ${call({
        eventId: "evt_concurrent_invoice",
        eventType: "invoice.paid",
        created: TIE,
        action: "invoice",
        customerId: "cus_B",
        subscriptionId: "sub_B",
        invoiceId: "in_concurrent",
        priceId: "price_pro",
        plan: "pro",
        amount: 1900,
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
      })};`);
      let finished = false;
      const statusResult = statusSession.exec(`begin; select set_config('role', 'service_role', true); ${call({
        eventId: "evt_concurrent_status",
        eventType: "customer.subscription.updated",
        created: TIE,
        action: "status",
        customerId: "cus_B",
        subscriptionId: "sub_B",
        status: "active",
        cancel: false,
      })}; commit;`).then((value) => {
        finished = true;
        return value;
      });
      const deadline = Date.now() + 5000;
      let waiting = "";
      while (Date.now() < deadline && !finished) {
        waiting = psql(database, "select coalesce(wait_event_type, '') from pg_stat_activity where application_name = 'webhook_status'");
        if (waiting === "Lock") break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      assert.equal(finished, false);
      assert.equal(waiting, "Lock");
      await invoiceSession.exec("commit");
      assert.match(await statusResult, /status_applied/);
      assert.equal(psql(database, "select count(*) from public.billing_subscriptions where user_id = " + `${quote(USER_B)}::uuid`), "1");
      assert.equal(snapshot(USER_B)?.subscription_status, "active");
      assert.equal(entitlement(USER_B), "pro");
      assert.equal(psql(database, "select count(*) from public.billing_stripe_events"), "2");
    } finally {
      await invoiceSession.close();
      await statusSession.close();
    }
  });
});
