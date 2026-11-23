import assert from "node:assert/strict";
import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { describe, it } from "node:test";
import type { BillingCustomerStore } from "./billingCustomer";
import { createSupabaseBillingCustomerStore, type BillingCustomerQueryClient } from "./billingCustomerStore";
import { handleCheckoutPost } from "./checkoutSession";
import { CheckoutAttemptConflict, type CheckoutAttempt, type CheckoutStore, type FinishExpiringResult } from "./checkoutStore";
import { limitedProcessEnv } from "./limitedProcessEnv";
import type { CheckoutStripe, SessionSnapshot } from "./stripeCheckout";

const root = process.env.BILLING_CUSTOMER_PGROOT || "";
const host = process.env.BILLING_CUSTOMER_PGHOST || "";
const port = process.env.BILLING_CUSTOMER_PGPORT || "";
const user = process.env.BILLING_CUSTOMER_PGUSER || "";
const data = process.env.BILLING_CUSTOMER_PGDATA || "";
const database = "billing_checkout_test";
const FN = "public.billing_checkout_finish_expiring(uuid,uuid,bigint,text,text,text,jsonb)";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const ATTEMPT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const KEY = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const EXPIRE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CHILD_A = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CHILD_B = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const CHILD_KEY_A = "ffffffff-ffff-4fff-8fff-fffffffffff1";
const CHILD_KEY_B = "ffffffff-ffff-4fff-8fff-fffffffffff2";
const OTHER_ATTEMPT = "99999999-9999-4999-8999-999999999999";
const OTHER_KEY = "88888888-8888-4888-8888-888888888888";

function refuse(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!root || !host || !port || !user || !data) {
  refuse("Isolated Postgres is not configured. Run npm run test:billing-checkout-postgres.");
}
if (
  !root.includes(`${path.sep}billing-customer-pg-`) ||
  path.resolve(host) !== path.resolve(root, "sock") ||
  path.resolve(data) !== path.resolve(root, "data") ||
  port === "5432"
) {
  refuse("Refusing to continue: Postgres settings are not the isolated instance created for this command.");
}

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

class PsqlSession {
  private readonly child: ChildProcessWithoutNullStreams;
  private out = "";
  private chain: Promise<unknown> = Promise.resolve();
  private closed = false;

  constructor() {
    this.child = spawn(
      "stdbuf",
      ["-oL", "-eL", "psql", "-h", host, "-p", port, "-U", user, "-d", database, "-X", "-q", "-A", "-t"],
      { stdio: ["pipe", "pipe", "pipe"], env: psqlEnv() }
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

function urls(id: string): { success: string; cancel: string } {
  return {
    success: `https://app.example/billing/checkout/return?attempt=${id}&result=success`,
    cancel: `https://app.example/billing/checkout/return?attempt=${id}&result=cancel`,
  };
}

function seedExpiring() {
  psql(database, "delete from public.billing_checkout_sessions");
  psql(database, "delete from public.billing_subscriptions");
  psql(database, "delete from public.billing_stripe_customers");
  psql(
    database,
    `insert into public.billing_stripe_customers (user_id, stripe_customer_id) values (${quote(USER_B)}::uuid, 'cus_B'), (${quote(USER_A)}::uuid, 'cus_A')`
  );
  const link = urls(ATTEMPT);
  psql(
    database,
    `insert into public.billing_checkout_sessions (
      id, user_id, row_version, status, idempotency_key, create_anchor_at, stripe_customer_id, stripe_account_id,
      plan, stripe_price_id, unit_amount, currency, quantity, livemode, success_url, cancel_url, mode,
      adaptive_pricing_enabled, automatic_tax_enabled, stripe_session_id, supersede_plan, expire_idempotency_key, expire_anchor_at
    ) values (
      ${quote(ATTEMPT)}::uuid, ${quote(USER_B)}::uuid, 4, 'expiring', ${quote(KEY)}::uuid, now(), 'cus_B', 'acct_live',
      'basic', 'price_basic', 700, 'usd', 1, true, ${quote(link.success)}, ${quote(link.cancel)}, 'subscription',
      false, false, 'cs_parent', 'pro', ${quote(EXPIRE)}::uuid, now()
    )`
  );
}

function successor(id: string, key: string) {
  const link = urls(id);
  return {
    id,
    idempotency_key: key,
    plan: "pro",
    stripe_price_id: "price_pro",
    unit_amount: 1900,
    success_url: link.success,
    cancel_url: link.cancel,
  };
}

function call(action: string, closeStatus: string | null, payload: unknown, version = 4, attempt = ATTEMPT) {
  const close = closeStatus === null ? "null" : quote(closeStatus);
  const body = payload === null ? "null" : `${quote(JSON.stringify(payload))}::jsonb`;
  return `select public.billing_checkout_finish_expiring(${quote(USER_B)}::uuid, ${quote(attempt)}::uuid, ${version}, 'acct_live', ${quote(action)}, ${close}, ${body})`;
}

describe("checkout postgres transition", { concurrency: 1 }, () => {
  it("applies the checkout migration only inside the isolated instance", () => {
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
    psqlFile(database, "supabase/migrations/20261120_billing_basic_amount_900.sql");
    psqlFile(database, "supabase/migrations/20261121_billing_livemode_account.sql");
    psqlFile(database, "supabase/migrations/20261122_billing_verified_binding.sql");
    assert.equal(psql(database, "select has_column_privilege('service_role', 'public.billing_stripe_customers', 'livemode', 'UPDATE')"), "t");
    assert.equal(psql(database, "select has_column_privilege('service_role', 'public.billing_stripe_customers', 'stripe_account_id', 'UPDATE')"), "t");
    assert.equal(psql(database, "select has_column_privilege('service_role', 'public.billing_stripe_customers', 'user_id', 'UPDATE')"), "f");
    assert.equal(psql(database, "select has_table_privilege('service_role', 'public.billing_stripe_customers', 'delete')"), "f");
    assert.equal(psql(database, "select has_table_privilege('service_role', 'public.billing_checkout_sessions', 'select')"), "t");
    assert.equal(psql(database, "select has_table_privilege('service_role', 'public.billing_checkout_sessions', 'insert')"), "t");
    assert.equal(psql(database, "select has_table_privilege('service_role', 'public.billing_checkout_sessions', 'update')"), "t");
    assert.equal(psql(database, "select has_table_privilege('service_role', 'public.billing_checkout_sessions', 'delete')"), "f");
    assert.equal(psql(database, "select has_table_privilege('anon', 'public.billing_checkout_sessions', 'select')"), "f");
    assert.equal(psql(database, `select has_function_privilege('anon', '${FN}', 'execute')`), "f");
    assert.equal(psql(database, `select has_function_privilege('authenticated', '${FN}', 'execute')`), "f");
    assert.equal(psql(database, `select has_function_privilege('service_role', '${FN}', 'execute')`), "t");
  });

  it("closes an expiring parent without a successor", () => {
    seedExpiring();
    const result = psql(database, `begin; select set_config('role', 'service_role', true); ${call("close_without_successor", "expired", null)}; commit;`);
    assert.match(result, /closed_without_successor/);
    assert.equal(psql(database, `select status from public.billing_checkout_sessions where id = ${quote(ATTEMPT)}::uuid`), "expired");
    assert.equal(psql(database, "select count(*) from public.billing_checkout_sessions where status = 'pending'"), "0");
  });

  it("rolls the parent back when the successor insert fails", () => {
    seedExpiring();
    const other = urls(OTHER_ATTEMPT);
    psql(
      database,
      `insert into public.billing_checkout_sessions (
        id, user_id, row_version, status, idempotency_key, create_anchor_at, stripe_customer_id, stripe_account_id,
        plan, stripe_price_id, unit_amount, currency, quantity, livemode, success_url, cancel_url, mode,
        adaptive_pricing_enabled, automatic_tax_enabled
      ) values (
        ${quote(OTHER_ATTEMPT)}::uuid, ${quote(USER_A)}::uuid, 1, 'expired', ${quote(OTHER_KEY)}::uuid, now(), 'cus_A', 'acct_live',
        'basic', 'price_basic', 700, 'usd', 1, true, ${quote(other.success)}, ${quote(other.cancel)}, 'subscription',
        false, false
      )`
    );
    const failed = psqlTry(`begin; select set_config('role', 'service_role', true); ${call("reserve_successor", null, successor(CHILD_A, OTHER_KEY))}; commit;`);
    assert.equal(failed.ok, false);
    assert.match(failed.stderr, /duplicate key|23505|unique/i);
    assert.equal(psql(database, `select status || ':' || row_version::text from public.billing_checkout_sessions where id = ${quote(ATTEMPT)}::uuid`), "expiring:4");
    assert.equal(psql(database, `select count(*) from public.billing_checkout_sessions where successor_attempt_id is not null`), "0");
    assert.equal(psql(database, `select count(*) from public.billing_checkout_sessions where id = ${quote(CHILD_A)}::uuid`), "0");
  });

  it("reserves at most one successor from two concurrent calls", async () => {
    seedExpiring();
    const first = new PsqlSession();
    const second = new PsqlSession();
    try {
      const [left, right] = await Promise.all([
        first.exec(`begin; select set_config('role', 'service_role', true); ${call("reserve_successor", null, successor(CHILD_A, CHILD_KEY_A))}; commit;`),
        second.exec(`begin; select set_config('role', 'service_role', true); ${call("reserve_successor", null, successor(CHILD_B, CHILD_KEY_B))}; commit;`),
      ]);
      const text = `${left}\n${right}`;
      assert.match(text, /reserved_successor/);
      assert.match(text, /conflict/);
      assert.equal(psql(database, `select status from public.billing_checkout_sessions where id = ${quote(ATTEMPT)}::uuid`), "expired");
      assert.equal(psql(database, `select count(*) from public.billing_checkout_sessions where user_id = ${quote(USER_B)}::uuid and status = 'pending'`), "1");
    } finally {
      await first.close();
      await second.close();
    }
  });

  it("turns a local blocking subscription into a close without a successor", () => {
    seedExpiring();
    psql(
      database,
      `insert into public.billing_subscriptions (
        user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, paid_plan, paid_until, subscription_status
      ) values (${quote(USER_B)}::uuid, 'cus_B', 'sub_B', 'price_basic', 'basic', now() + interval '1 day', 'active')`
    );
    const result = psql(database, `begin; select set_config('role', 'service_role', true); ${call("reserve_successor", null, successor(CHILD_A, CHILD_KEY_A))}; commit;`);
    assert.match(result, /closed_without_successor/);
    assert.equal(psql(database, `select count(*) from public.billing_checkout_sessions where status = 'pending'`), "0");
    assert.equal(psql(database, `select status from public.billing_checkout_sessions where id = ${quote(ATTEMPT)}::uuid`), "expired");
  });

  it("copies the parent customer, account, and livemode onto the successor", () => {
    seedExpiring();
    const reserved = psql(database, `begin; select set_config('role', 'service_role', true); ${call("reserve_successor", null, successor(CHILD_A, CHILD_KEY_A))}; commit;`);
    assert.match(reserved, /reserved_successor/);
    const child = psql(database, `select successor_attempt_id::text from public.billing_checkout_sessions where id = ${quote(ATTEMPT)}::uuid`);
    const parentIdentity = psql(database, `select stripe_customer_id || '|' || stripe_account_id || '|' || livemode::text from public.billing_checkout_sessions where id = ${quote(ATTEMPT)}::uuid`);
    const childIdentity = psql(database, `select stripe_customer_id || '|' || stripe_account_id || '|' || livemode::text from public.billing_checkout_sessions where id = ${quote(child)}::uuid`);
    assert.equal(childIdentity, parentIdentity);
    assert.equal(childIdentity, "cus_B|acct_live|true");
    assert.equal(psql(database, `select status from public.billing_checkout_sessions where id = ${quote(child)}::uuid`), "pending");
  });

  it("reserves one first attempt for two concurrent handler calls", async () => {
    psql(database, "delete from public.billing_checkout_sessions");
    psql(database, "delete from public.billing_subscriptions");
    psql(database, "delete from public.billing_stripe_customers");
    psql(database, `insert into public.billing_stripe_customers (user_id, stripe_customer_id) values (${quote(USER_B)}::uuid, 'cus_B')`);
    const seen: Array<{ key: string; params: ReturnType<typeof import("./stripeCheckout").createParamsForAttempt> }> = [];
    const { createParamsForAttempt } = await import("./stripeCheckout");
    const stripe: CheckoutStripe = {
      async retrieveAccount() {
        return { id: "acct_live" };
      },
      async retrievePrice() {
        await new Promise((resolve) => setTimeout(resolve, 40));
        return {
          id: "price_basic",
          active: true,
          currency: "usd",
          livemode: true,
          type: "recurring",
          billingScheme: "per_unit",
          unitAmount: 900,
          customUnitAmount: false,
          interval: "month",
          intervalCount: 1,
          usageType: "licensed",
          meter: null,
        };
      },
      async retrieveCustomer(id) {
        return { id, deleted: false, livemode: true, userId: USER_B };
      },
      async createCustomer() {
        throw new Error("customer create");
      },
      async listSubscriptions() {
        return { complete: true, blocking: false };
      },
      async createSession(row, key) {
        seen.push({ key, params: createParamsForAttempt(row) });
        return hostedSession(row);
      },
      async retrieveSession() {
        throw new Error("retrieve");
      },
      async listSessions() {
        return { complete: true, sessions: [] };
      },
      async expireSession() {
        throw new Error("expire");
      },
    };
    const input = {
      resolveUserId: async () => USER_B,
      enabled: true,
      env: { NEXT_PUBLIC_APP_URL: "https://app.example" },
      nodeEnv: "test",
      openRuntime: async () => ({
        origin: "https://app.example",
        prices: { basic: "price_basic", pro: "price_pro", elite: "price_elite" },
        livemode: true,
        loadSubscription: async () => null,
        customerStore: pgCustomers(),
        checkoutStore: pgCheckout(),
        stripe,
      }),
    };
    await Promise.all([
      handleCheckoutPost({ ...input, request: pgRequest() }),
      handleCheckoutPost({ ...input, request: pgRequest() }),
    ]);
    const count = psql(database, `select count(*) from public.billing_checkout_sessions where user_id = ${quote(USER_B)}::uuid and status in ('pending','open','unknown','expiring','complete')`);
    assert.equal(count, "1");
    const stored = JSON.parse(psql(database, `select row_to_json(t) from (select id, idempotency_key, stripe_customer_id, stripe_account_id, livemode, stripe_price_id, success_url, cancel_url, plan, user_id from public.billing_checkout_sessions where user_id = ${quote(USER_B)}::uuid) t`));
    assert.equal(stored.stripe_customer_id, "cus_B");
    assert.equal(stored.stripe_account_id, "acct_live");
    assert.equal(stored.livemode, true);
    assert.equal(
      psql(database, `select livemode::text || '|' || stripe_account_id from public.billing_stripe_customers where user_id = ${quote(USER_B)}::uuid`),
      "true|acct_live"
    );
    assert.ok(seen.length >= 1);
    assert.equal(new Set(seen.map((item) => item.key)).size, 1);
    assert.equal(seen[0].key, stored.idempotency_key);
    for (const item of seen) {
      assert.deepEqual(item.params, seen[0].params);
      assert.equal(item.params.customer, stored.stripe_customer_id);
      assert.deepEqual(item.params.line_items, [{ price: stored.stripe_price_id, quantity: 1 }]);
      assert.equal(item.params.client_reference_id, stored.id);
      assert.equal(item.params.success_url, stored.success_url);
      assert.equal(item.params.cancel_url, stored.cancel_url);
      assert.deepEqual(item.params.metadata, { user_id: stored.user_id, plan: stored.plan, attempt_id: stored.id });
      assert.deepEqual(item.params.adaptive_pricing, { enabled: false });
      assert.deepEqual(item.params.automatic_tax, { enabled: false });
      assert.deepEqual(item.params.expand, ["line_items"]);
      assert.equal(item.params.mode, "subscription");
    }
  });

  it("fills a null customer binding from the verified checkout account and refuses to relabel it", async () => {
    psql(database, "delete from public.billing_checkout_sessions");
    psql(database, "delete from public.billing_subscriptions");
    psql(database, "delete from public.billing_stripe_customers");
    const store = createSupabaseBillingCustomerStore(serviceCustomerClient());
    assert.deepEqual(await store.insert({ userId: USER_B, stripeCustomerId: "cus_B" }), { ok: true });
    assert.equal(
      await store.recordVerifiedAccount({
        userId: USER_B,
        stripeCustomerId: "cus_B",
        livemode: true,
        stripeAccountId: "acct_live",
      }),
      "recorded"
    );
    assert.equal(
      await store.recordVerifiedAccount({
        userId: USER_B,
        stripeCustomerId: "cus_B",
        livemode: true,
        stripeAccountId: "acct_live",
      }),
      "already_verified"
    );
    assert.equal(
      await store.recordVerifiedAccount({
        userId: USER_B,
        stripeCustomerId: "cus_B",
        livemode: false,
        stripeAccountId: "acct_other",
      }),
      "conflict"
    );
    assert.equal(
      psql(database, `select livemode::text || '|' || stripe_account_id from public.billing_stripe_customers where stripe_customer_id = 'cus_B'`),
      "true|acct_live"
    );

    const response = await handleCheckoutPost({
      resolveUserId: async () => USER_B,
      enabled: true,
      env: { NEXT_PUBLIC_APP_URL: "https://app.example" },
      nodeEnv: "test",
      openRuntime: async () => ({
        origin: "https://app.example",
        prices: { basic: "price_basic", pro: "price_pro", elite: "price_elite" },
        livemode: true,
        loadSubscription: async () => null,
        customerStore: pgCustomers(),
        checkoutStore: pgCheckout(),
        stripe: {
          async retrieveAccount() {
            return { id: "acct_other" };
          },
          async retrievePrice() {
            return {
              id: "price_basic",
              active: true,
              currency: "usd",
              livemode: true,
              type: "recurring",
              billingScheme: "per_unit",
              unitAmount: 900,
              customUnitAmount: false,
              interval: "month",
              intervalCount: 1,
              usageType: "licensed",
              meter: null,
            };
          },
          async retrieveCustomer(id) {
            return { id, deleted: false, livemode: true, userId: USER_B };
          },
          async createCustomer() {
            throw new Error("customer create");
          },
          async listSubscriptions() {
            return { complete: true, blocking: false };
          },
          async createSession() {
            throw new Error("session create");
          },
          async retrieveSession() {
            throw new Error("retrieve");
          },
          async listSessions() {
            return { complete: true, sessions: [] };
          },
          async expireSession() {
            throw new Error("expire");
          },
        },
      }),
      request: pgRequest(),
    });
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: "CHECKOUT_ACCOUNT_MISMATCH" });
    assert.equal(
      psql(database, `select livemode::text || '|' || stripe_account_id from public.billing_stripe_customers where stripe_customer_id = 'cus_B'`),
      "true|acct_live"
    );
    assert.equal(psql(database, "select count(*) from public.billing_checkout_sessions"), "0");
  });

  it("removes the parent and successor when that user is deleted", () => {
    seedExpiring();
    const reserved = psql(database, `begin; select set_config('role', 'service_role', true); ${call("reserve_successor", null, successor(CHILD_A, CHILD_KEY_A))}; commit;`);
    assert.match(reserved, /reserved_successor/);
    const removed = psqlTry(`delete from auth.users where id = ${quote(USER_B)}::uuid`);
    assert.equal(removed.ok, true, removed.stderr);
    assert.equal(
      psql(database, `select count(*) from public.billing_checkout_sessions where user_id = ${quote(USER_B)}::uuid or id in (${quote(ATTEMPT)}::uuid, ${quote(CHILD_A)}::uuid)`),
      "0"
    );
  });
});

function hostedSession(row: CheckoutAttempt): SessionSnapshot {
  return {
    id: "cs_pg",
    url: "https://checkout.stripe.com/c/pay/cs_pg",
    status: "open",
    customerId: row.stripe_customer_id,
    livemode: true,
    mode: "subscription",
    clientReferenceId: row.id,
    metadata: { attempt_id: row.id, user_id: row.user_id, plan: row.plan },
    successUrl: row.success_url,
    cancelUrl: row.cancel_url,
    lineItems: [{ priceId: row.stripe_price_id, quantity: 1 }],
    lineItemsComplete: true,
  };
}

function pgRequest(): Request {
  return new Request("https://app.example/api/billing/checkout", {
    method: "POST",
    headers: { origin: "https://app.example", "sec-fetch-site": "same-origin", "content-type": "application/json" },
    body: JSON.stringify({ plan: "basic" }),
  });
}

function pgCustomers(): BillingCustomerStore {
  return {
    async findByUserId(userId) {
      const stripeCustomerId = psql(database, `select stripe_customer_id from public.billing_stripe_customers where user_id = ${quote(userId)}::uuid`);
      return stripeCustomerId ? { userId, stripeCustomerId } : null;
    },
    async findByStripeCustomerId(stripeCustomerId) {
      const userId = psql(database, `select user_id from public.billing_stripe_customers where stripe_customer_id = ${quote(stripeCustomerId)}`);
      return userId ? { userId, stripeCustomerId } : null;
    },
    async insert() {
      return { ok: false as const, reason: "store_failed" as const };
    },
    async recordVerifiedAccount(input) {
      return recordCustomerAccount(input);
    },
  };
}

function serviceCustomerClient(): BillingCustomerQueryClient {
  return {
    from() {
      return {
        select(columns) {
          return {
            eq(column, value) {
              return {
                async maybeSingle() {
                  const verified = columns.includes("livemode");
                  const projection = verified
                    ? "user_id::text || '|' || stripe_customer_id || '|' || coalesce(livemode::text, '') || '|' || coalesce(stripe_account_id, '')"
                    : "user_id::text || '|' || stripe_customer_id";
                  const cast = column === "user_id" ? "::uuid" : "";
                  const line = serviceRole(
                    `select ${projection} from public.billing_stripe_customers where ${column} = ${quote(value)}${cast}`
                  );
                  if (!line) return { data: null, error: null };
                  const parts = line.split("|");
                  if (!verified) return { data: { user_id: parts[0], stripe_customer_id: parts[1] }, error: null };
                  return {
                    data: {
                      user_id: parts[0],
                      stripe_customer_id: parts[1],
                      livemode: parts[2] === "true" ? true : parts[2] === "false" ? false : null,
                      stripe_account_id: parts[3] || null,
                    },
                    error: null,
                  };
                },
              };
            },
          };
        },
        async insert(row) {
          const result = serviceRoleTry(
            `insert into public.billing_stripe_customers (user_id, stripe_customer_id) values (${quote(row.user_id)}::uuid, ${quote(row.stripe_customer_id)})`
          );
          if (result.ok) return { error: null };
          if (/23505/.test(result.stderr)) return { error: { code: "23505", message: result.stderr } };
          return { error: { message: result.stderr || "insert failed" } };
        },
        update(row) {
          return {
            eq(userColumn, userId) {
              return {
                eq(customerColumn, customerId) {
                  return {
                    is() {
                      return {
                        async is() {
                          const result = serviceRoleTry(
                            `update public.billing_stripe_customers set livemode = ${row.livemode ? "true" : "false"}, stripe_account_id = ${quote(row.stripe_account_id)} where ${userColumn} = ${quote(userId)}::uuid and ${customerColumn} = ${quote(customerId)} and livemode is null and stripe_account_id is null`
                          );
                          return result.ok ? { error: null } : { error: { message: result.stderr || "update failed" } };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

function serviceRole(sql: string): string {
  const text = psql(database, `begin; select set_config('role', 'service_role', true); ${sql}; commit;`);
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && line !== "service_role")
    .join("\n");
}

function serviceRoleTry(sql: string): { ok: boolean; stderr: string } {
  try {
    serviceRole(sql);
    return { ok: true, stderr: "" };
  } catch (err) {
    const error = err as { stderr?: string };
    return { ok: false, stderr: String(error.stderr || "") };
  }
}

function recordCustomerAccount(input: {
  userId: string;
  stripeCustomerId: string;
  livemode: boolean;
  stripeAccountId: string;
}): "recorded" | "already_verified" | "conflict" | "missing" {
  const line = psql(
    database,
    `select coalesce(livemode::text, '') || '|' || coalesce(stripe_account_id, '') from public.billing_stripe_customers where user_id = ${quote(input.userId)}::uuid and stripe_customer_id = ${quote(input.stripeCustomerId)}`
  );
  if (!line) return "missing";
  const [mode, account] = line.split("|");
  const livemode = mode === "true" ? true : mode === "false" ? false : null;
  const stripeAccountId = account || null;
  if (livemode === input.livemode && stripeAccountId === input.stripeAccountId) return "already_verified";
  if (livemode !== null || stripeAccountId !== null) return "conflict";
  const updated = psql(
    database,
    `update public.billing_stripe_customers set livemode = ${input.livemode ? "true" : "false"}, stripe_account_id = ${quote(input.stripeAccountId)} where user_id = ${quote(input.userId)}::uuid and stripe_customer_id = ${quote(input.stripeCustomerId)} and livemode is null and stripe_account_id is null returning stripe_customer_id`
  );
  return updated === input.stripeCustomerId ? "recorded" : "conflict";
}

function pgCheckout(): CheckoutStore {
  const columns = "id,user_id,row_version,status,idempotency_key,create_anchor_at,stripe_customer_id,stripe_account_id,plan,stripe_price_id,unit_amount,currency,quantity,livemode,success_url,cancel_url,mode,adaptive_pricing_enabled,automatic_tax_enabled,stripe_session_id,stripe_session_url,observed_late_session_id,supersede_plan,expire_idempotency_key,expire_anchor_at,successor_attempt_id";
  function read(where: string): CheckoutAttempt | null {
    const line = psql(database, `select row_to_json(t) from (select ${columns} from public.billing_checkout_sessions where ${where} limit 1) t`);
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
      try {
        psql(database, `insert into public.billing_checkout_sessions (${columns}) values (
          ${quote(row.id)}::uuid, ${quote(row.user_id)}::uuid, ${row.row_version}, ${quote(row.status)}, ${quote(row.idempotency_key)}::uuid,
          ${quote(row.create_anchor_at)}::timestamptz, ${quote(row.stripe_customer_id)}, ${quote(row.stripe_account_id)}, ${quote(row.plan)},
          ${quote(row.stripe_price_id)}, ${row.unit_amount}, 'usd', 1, ${row.livemode}, ${quote(row.success_url)}, ${quote(row.cancel_url)},
          'subscription', false, false, null, null, null, null, null, null, null
        )`);
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
      const expire = expectedExpireKey === undefined ? "" : ` and expire_idempotency_key = ${quote(expectedExpireKey)}::uuid`;
      psql(database, `update public.billing_checkout_sessions set ${sets.join(", ")} where id = ${quote(row.id)}::uuid and user_id = ${quote(row.user_id)}::uuid and status = ${quote(row.status)} and row_version = ${row.row_version}${expire}`);
      const next = await this.findById(row.user_id, row.id);
      if (!next || next.row_version !== row.row_version + 1) return null;
      return next;
    },
    async finishExpiring(): Promise<FinishExpiringResult> {
      return { outcome: "conflict" };
    },
  };
}
