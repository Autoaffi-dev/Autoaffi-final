import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { describe, it } from "node:test";
import { limitedProcessEnv } from "./limitedProcessEnv.ts";
import {
  BillingCustomerNotBoundError,
  BillingCustomerOwnerConflictError,
  findOrCreateBillingCustomer,
  type BillingCustomerStore,
  type StripeCustomerClient,
} from "./billingCustomer.ts";

const root = process.env.BILLING_CUSTOMER_PGROOT || "";
const host = process.env.BILLING_CUSTOMER_PGHOST || "";
const port = process.env.BILLING_CUSTOMER_PGPORT || "";
const user = process.env.BILLING_CUSTOMER_PGUSER || "";
const data = process.env.BILLING_CUSTOMER_PGDATA || "";
const database = "billing_customer_test";

function refuse(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!root || !host || !port || !user || !data) {
  refuse("Isolated Postgres is not configured. Run npm run test:billing-customer-postgres. This test does not connect to the host database.");
}
if (
  !root.includes(`${path.sep}billing-customer-pg-`) ||
  path.resolve(host) !== path.resolve(root, "sock") ||
  path.resolve(data) !== path.resolve(root, "data") ||
  port === "5432"
) {
  refuse("Refusing to continue: Postgres settings are not the isolated instance created for this command.");
}

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

function psqlProcessEnv(applicationName?: string): NodeJS.ProcessEnv {
  const env = limitedProcessEnv(process.env);
  if (applicationName) env.PGAPPNAME = applicationName;
  return env;
}

function quoteLiteral(value: string): string {
  if (!/^[0-9a-zA-Z_-]+$/.test(value)) throw new Error("refusing to interpolate an unexpected test literal");
  return `'${value}'`;
}

function psql(dbName: string, sql: string): string {
  return execFileSync(
    "psql",
    ["-h", host, "-p", port, "-U", user, "-d", dbName, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", sql],
    { encoding: "utf8", env: psqlProcessEnv() }
  ).trim();
}

function psqlFile(dbName: string, file: string) {
  execFileSync(
    "psql",
    ["-h", host, "-p", port, "-U", user, "-d", dbName, "-X", "-v", "ON_ERROR_STOP=1", "-f", file],
    { stdio: "pipe", env: psqlProcessEnv() }
  );
}

type QueryResult = { stdout: string; stderr: string };

class PsqlSession {
  private readonly child: ChildProcessWithoutNullStreams;
  private out = "";
  private err = "";
  private chain: Promise<unknown> = Promise.resolve();
  private closed = false;

  constructor(applicationName: string) {
    this.child = spawn(
      "stdbuf",
      ["-oL", "-eL", "psql", "-h", host, "-p", port, "-U", user, "-d", database, "-X", "-q", "-A", "-t", "-v", "VERBOSITY=verbose"],
      {
        stdio: ["pipe", "pipe", "pipe"],
        env: psqlProcessEnv(applicationName),
      }
    );
    this.child.stdout.setEncoding("utf8");
    this.child.stderr.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => {
      this.out += chunk;
    });
    this.child.stderr.on("data", (chunk: string) => {
      this.err += chunk;
    });
    this.child.on("exit", () => {
      this.closed = true;
    });
  }

  exec(sql: string): Promise<QueryResult> {
    const run = this.chain.then(() => this.execNow(sql));
    this.chain = run.then(() => undefined, () => undefined);
    return run;
  }

  private execNow(sql: string): Promise<QueryResult> {
    if (this.closed) return Promise.reject(new Error("isolated psql session closed"));
    const marker = `aa_${randomBytes(8).toString("hex")}`;
    const outStart = this.out.length;
    const errStart = this.err.length;
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error("isolated psql timed out"));
      }, 15000);
      const finish = () => {
        if (settled) return;
        const outChunk = this.out.slice(outStart);
        const at = outChunk.indexOf(marker);
        if (at < 0) return;
        settled = true;
        clearTimeout(timer);
        this.child.stdout.off("data", finish);
        this.child.stderr.off("data", finish);
        resolve({
          stdout: outChunk.slice(0, at).trim(),
          stderr: this.err.slice(errStart).trim(),
        });
      };
      this.child.stdout.on("data", finish);
      this.child.stderr.on("data", finish);
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

function isUniqueViolation(stderr: string): boolean {
  return /(?:^|\n)ERROR:\s+23505:/.test(stderr);
}

function isError(stderr: string): boolean {
  return /(?:^|\n)ERROR:/.test(stderr);
}

function createServiceStore(session: PsqlSession, overlap?: { wait(): Promise<void> }): BillingCustomerStore {
  let opened = false;
  let failed = false;

  async function begin() {
    await session.exec("begin");
    const role = await session.exec("select set_config('role', 'service_role', true)");
    if (role.stdout !== "service_role") throw new Error("BILLING_CUSTOMER_STORE_FAILED");
    opened = true;
    failed = false;
  }

  async function recover() {
    if (failed) {
      await session.exec("rollback");
      opened = false;
      failed = false;
    }
    if (!opened) await begin();
  }

  return {
    async findByUserId(userId) {
      await recover();
      const result = await session.exec(
        `select stripe_customer_id from public.billing_stripe_customers where user_id = ${quoteLiteral(userId)}`
      );
      if (isError(result.stderr)) throw new Error("BILLING_CUSTOMER_STORE_FAILED");
      if (result.stdout) {
        const stripeCustomerId = result.stdout;
        await session.exec("commit");
        opened = false;
        return { userId, stripeCustomerId };
      }
      if (overlap) await overlap.wait();
      return null;
    },

    async findByStripeCustomerId(stripeCustomerId) {
      await recover();
      const result = await session.exec(
        `select user_id from public.billing_stripe_customers where stripe_customer_id = ${quoteLiteral(stripeCustomerId)}`
      );
      if (isError(result.stderr)) throw new Error("BILLING_CUSTOMER_STORE_FAILED");
      await session.exec("commit");
      opened = false;
      if (!result.stdout) return null;
      return { userId: result.stdout, stripeCustomerId };
    },

    async insert(binding) {
      await recover();
      const result = await session.exec(
        `select public.billing_customer_test_insert(${quoteLiteral(binding.userId)}::uuid, ${quoteLiteral(binding.stripeCustomerId)})`
      );
      if (result.stdout === "23505" || isUniqueViolation(result.stderr)) {
        failed = true;
        return { ok: false, reason: "unique_violation" };
      }
      if (result.stdout !== "ok" || isError(result.stderr)) {
        failed = true;
        throw new Error("BILLING_CUSTOMER_STORE_FAILED");
      }
      await session.exec("commit");
      opened = false;
      return { ok: true };
    },
  };
}

type CreateCall = { metadata: { user_id: string }; idempotencyKey: string };

function stripeClient(create: StripeCustomerClient["customers"]["create"], calls: CreateCall[]) {
  return {
    customers: {
      async create(params: { metadata: { user_id: string } }, options: { idempotencyKey: string }) {
        calls.push({ metadata: params.metadata, idempotencyKey: options.idempotencyKey });
        return create(params, options);
      },
    },
  };
}

function forgedRequest(): Request {
  const url = new URL("https://autoaffi.com/api/billing/customer");
  url.searchParams.set("user_id", USER_A);
  url.searchParams.set("stripe_customer_id", "cus_A");
  return new Request(url, {
    method: "POST",
    headers: { host: "autoaffi.com", "x-autoaffi-user-id": USER_A, "x-user-id": USER_A },
  });
}

const sessionUser = (userId: string) => async () => userId;

function overlapGate() {
  let arrived = 0;
  let release: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  const gate = {
    observed: 0,
    async wait() {
      arrived += 1;
      if (arrived === 2) {
        gate.observed = Number(psql(
          database,
          "select count(*) from pg_stat_activity where datname = 'billing_customer_test' and state = 'idle in transaction' and application_name like 'billing-customer-overlap-%'"
        ));
        release();
        if (gate.observed !== 2) {
          throw new Error(`expected 2 overlapping transactions, saw ${gate.observed}`);
        }
      }
      await ready;
    },
  };
  return gate;
}

function noIds(err: unknown) {
  const text = String(err);
  assert.equal(text.includes("cus_"), false);
  assert.equal(text.includes(USER_A), false);
  assert.equal(text.includes(USER_B), false);
}

describe("injected Stripe client, isolated Postgres", { concurrency: 1 }, () => {
  it("applies the migration only inside the isolated instance", () => {
    assert.equal(psql("postgres", "select current_setting('data_directory')"), data);
    assert.equal(psql("postgres", "select current_setting('listen_addresses')"), "");
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
    psql(database, `insert into auth.users (id) values (${quoteLiteral(USER_A)}), (${quoteLiteral(USER_B)})`);
    psqlFile(database, "supabase/migrations/20261102_billing_stripe_customers.sql");
    assert.equal(psql(database, "select relrowsecurity from pg_class where relname = 'billing_stripe_customers'"), "t");
    assert.equal(psql(database, "select has_table_privilege('public', 'public.billing_stripe_customers', 'select')"), "f");
    assert.equal(psql(database, "select has_table_privilege('anon', 'public.billing_stripe_customers', 'insert')"), "f");
    assert.equal(psql(database, "select has_table_privilege('authenticated', 'public.billing_stripe_customers', 'select')"), "f");
    assert.equal(psql(database, "select has_table_privilege('service_role', 'public.billing_stripe_customers', 'select')"), "t");
    assert.equal(psql(database, "select has_table_privilege('service_role', 'public.billing_stripe_customers', 'insert')"), "t");
    assert.equal(psql(database, "select has_table_privilege('service_role', 'public.billing_stripe_customers', 'update')"), "f");
    assert.equal(psql(database, "select has_table_privilege('service_role', 'public.billing_stripe_customers', 'delete')"), "f");
    assert.equal(psql(database, "select rolbypassrls from pg_roles where rolname = 'service_role'"), "t");
    assert.equal(psql(database, "select rolbypassrls from pg_roles where rolname = 'anon'"), "f");
    psql(
      database,
      `
        create function public.billing_customer_test_insert(uid uuid, cid text)
        returns text language plpgsql as $$
        begin
          insert into public.billing_stripe_customers (user_id, stripe_customer_id)
          values (uid, cid);
          return 'ok';
        exception
          when unique_violation then
            return '23505';
          when others then
            return sqlstate;
        end
        $$;
      `
    );
  });

  it("reuses the stored customer without calling Stripe", async () => {
    psql(database, "delete from public.billing_stripe_customers");
    psql(database, `insert into public.billing_stripe_customers (user_id, stripe_customer_id) values (${quoteLiteral(USER_B)}, 'cus_existing')`);
    const dbSession = new PsqlSession("billing-customer-read");
    try {
      const calls: CreateCall[] = [];
      const binding = await findOrCreateBillingCustomer({
        request: forgedRequest(),
        resolveUserId: sessionUser(USER_B),
        stripe: stripeClient(async () => { throw new Error("stripe should not be called"); }, calls),
        db: createServiceStore(dbSession),
      });
      assert.deepEqual(binding, { userId: USER_B, stripeCustomerId: "cus_existing" });
      assert.equal(calls.length, 0);
    } finally {
      await dbSession.close();
    }
  });

  it("returns one stored binding from two overlapping connections inserting the same customer", async () => {
    psql(database, "delete from public.billing_stripe_customers");
    const gate = overlapGate();
    const firstSession = new PsqlSession("billing-customer-overlap-1");
    const secondSession = new PsqlSession("billing-customer-overlap-2");
    try {
      const calls: CreateCall[] = [];
      const stripe = stripeClient(async () => ({ id: "cus_same" }), calls);
      const [first, second] = await Promise.all([
        findOrCreateBillingCustomer({
          request: forgedRequest(),
          resolveUserId: sessionUser(USER_B),
          stripe,
          db: createServiceStore(firstSession, gate),
        }),
        findOrCreateBillingCustomer({
          request: forgedRequest(),
          resolveUserId: sessionUser(USER_B),
          stripe,
          db: createServiceStore(secondSession, gate),
        }),
      ]);
      assert.equal(gate.observed, 2);
      assert.deepEqual(first, { userId: USER_B, stripeCustomerId: "cus_same" });
      assert.deepEqual(second, first);
      assert.equal(psql(database, `select count(*) from public.billing_stripe_customers where user_id = ${quoteLiteral(USER_B)}`), "1");
    } finally {
      await firstSession.close();
      await secondSession.close();
    }
  });

  it("reuses one stored binding from two overlapping connections inserting different customer ids", async () => {
    psql(database, "delete from public.billing_stripe_customers");
    const gate = overlapGate();
    const firstSession = new PsqlSession("billing-customer-overlap-1");
    const secondSession = new PsqlSession("billing-customer-overlap-2");
    try {
      const calls: CreateCall[] = [];
      let created = 0;
      const stripe = stripeClient(async () => {
        created += 1;
        return { id: created === 1 ? "cus_first" : "cus_second" };
      }, calls);
      const [first, second] = await Promise.all([
        findOrCreateBillingCustomer({
          request: forgedRequest(),
          resolveUserId: sessionUser(USER_B),
          stripe,
          db: createServiceStore(firstSession, gate),
        }),
        findOrCreateBillingCustomer({
          request: forgedRequest(),
          resolveUserId: sessionUser(USER_B),
          stripe,
          db: createServiceStore(secondSession, gate),
        }),
      ]);
      assert.equal(gate.observed, 2);
      assert.equal(first.userId, USER_B);
      assert.deepEqual(second, first);
      assert.equal(["cus_first", "cus_second"].includes(first.stripeCustomerId), true);
      const loser = first.stripeCustomerId === "cus_first" ? "cus_second" : "cus_first";
      assert.equal(psql(database, `select count(*) from public.billing_stripe_customers where user_id = ${quoteLiteral(USER_B)}`), "1");
      assert.equal(psql(database, `select count(*) from public.billing_stripe_customers where stripe_customer_id = ${quoteLiteral(loser)}`), "0");
    } finally {
      await firstSession.close();
      await secondSession.close();
    }
  });

  it("stops when the stored customer row belongs to the other user", async () => {
    psql(database, "delete from public.billing_stripe_customers");
    psql(database, `insert into public.billing_stripe_customers (user_id, stripe_customer_id) values (${quoteLiteral(USER_A)}, 'cus_A')`);
    const dbSession = new PsqlSession("billing-customer-conflict");
    try {
      await assert.rejects(
        findOrCreateBillingCustomer({
          request: forgedRequest(),
          resolveUserId: sessionUser(USER_B),
          stripe: stripeClient(async () => ({ id: "cus_A" }), []),
          db: createServiceStore(dbSession),
        }),
        (err: unknown) => {
          assert.ok(err instanceof BillingCustomerOwnerConflictError);
          noIds(err);
          return true;
        }
      );
      assert.equal(psql(database, `select user_id from public.billing_stripe_customers where stripe_customer_id = 'cus_A'`), USER_A);
      assert.equal(psql(database, `select count(*) from public.billing_stripe_customers where user_id = ${quoteLiteral(USER_B)}`), "0");
    } finally {
      await dbSession.close();
    }
  });

  it("does not return the Stripe customer when the isolated insert fails", async () => {
    psql(database, "delete from public.billing_stripe_customers");
    psql(
      database,
      `
        create or replace function public.billing_customer_test_fail()
        returns trigger language plpgsql as $$
        begin
          raise exception 'forced write failure';
        end $$;
        drop trigger if exists billing_customer_test_fail on public.billing_stripe_customers;
        create trigger billing_customer_test_fail
        before insert on public.billing_stripe_customers
        for each row execute function public.billing_customer_test_fail();
      `
    );
    const dbSession = new PsqlSession("billing-customer-fail");
    try {
      await assert.rejects(
        findOrCreateBillingCustomer({
          request: forgedRequest(),
          resolveUserId: sessionUser(USER_B),
          stripe: stripeClient(async () => ({ id: "cus_orphan" }), []),
          db: createServiceStore(dbSession),
        }),
        (err: unknown) => {
          assert.ok(err instanceof BillingCustomerNotBoundError);
          noIds(err);
          return true;
        }
      );
      assert.equal(psql(database, "select count(*) from public.billing_stripe_customers where stripe_customer_id = 'cus_orphan'"), "0");
    } finally {
      await dbSession.close();
    }
  });
});
