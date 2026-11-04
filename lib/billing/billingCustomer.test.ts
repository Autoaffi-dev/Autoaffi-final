import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  BillingCustomerNotBoundError,
  BillingCustomerOwnerConflictError,
  BillingCustomerUnauthorizedError,
  findOrCreateBillingCustomer,
  type BillingCustomerBinding,
  type BillingCustomerInsertResult,
  type BillingCustomerStore,
  type StripeCustomerClient,
} from "./billingCustomer.ts";
import { createSupabaseBillingCustomerStore } from "./billingCustomerStore.ts";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

function forgedRequest(): Request {
  const url = new URL("https://autoaffi.com/api/billing/customer");
  url.searchParams.set("user_id", USER_A);
  url.searchParams.set("stripe_customer_id", "cus_A");
  return new Request(url, {
    method: "POST",
    headers: {
      host: "autoaffi.com",
      "x-autoaffi-user-id": USER_A,
      "x-user-id": USER_A,
    },
  });
}

function session(userId: string | null) {
  return async () => {
    if (!userId) throw new Error("UNAUTHORIZED");
    return userId;
  };
}

type CreateCall = {
  metadata: { user_id: string };
  idempotencyKey: string;
};

function stripeClient(create: StripeCustomerClient["customers"]["create"], calls: CreateCall[]) {
  return {
    customers: {
      async create(
        params: { metadata: { user_id: string } },
        options: { idempotencyKey: string }
      ) {
        calls.push({ metadata: params.metadata, idempotencyKey: options.idempotencyKey });
        return create(params, options);
      },
    },
  };
}

function scriptedStripe(ids: string[], calls: CreateCall[]) {
  let index = 0;
  return stripeClient(async () => {
    const id = ids[Math.min(index, ids.length - 1)];
    index += 1;
    return { id };
  }, calls);
}

function memoryStore(seed: BillingCustomerBinding[] = [], holdEmptyReads = 0): BillingCustomerStore & {
  rows: BillingCustomerBinding[];
} {
  const rows = [...seed];
  let emptyReads = 0;
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    rows,
    async findByUserId(userId) {
      const found = rows.find((row) => row.userId === userId) ?? null;
      if (!found && holdEmptyReads > 0) {
        emptyReads += 1;
        if (emptyReads === holdEmptyReads) release();
        await gate;
        return found;
      }
      return rows.find((row) => row.userId === userId) ?? null;
    },
    async findByStripeCustomerId(stripeCustomerId) {
      return rows.find((row) => row.stripeCustomerId === stripeCustomerId) ?? null;
    },
    async insert(binding) {
      const taken = rows.some((row) => row.userId === binding.userId || row.stripeCustomerId === binding.stripeCustomerId);
      if (taken) return { ok: false, reason: "unique_violation" };
      rows.push(binding);
      return { ok: true };
    },
  };
}

function noIds(err: unknown) {
  const text = String(err);
  assert.equal(text.includes("cus_"), false);
  assert.equal(text.includes(USER_A), false);
  assert.equal(text.includes(USER_B), false);
}

describe("injected Stripe client, in-memory rows", () => {
  it("makes no Stripe or database call when logged out", async () => {
    const calls: CreateCall[] = [];
    const db = memoryStore();
    await assert.rejects(
      findOrCreateBillingCustomer({
        request: forgedRequest(),
        resolveUserId: session(null),
        stripe: scriptedStripe(["cus_should_not_exist"], calls),
        db,
      }),
      (err: unknown) => err instanceof BillingCustomerUnauthorizedError
    );
    assert.equal(calls.length, 0);
    assert.equal(db.rows.length, 0);
  });

  it("binds B from the session when the request claims A", async () => {
    const calls: CreateCall[] = [];
    const db = memoryStore([{ userId: USER_A, stripeCustomerId: "cus_A" }]);
    const binding = await findOrCreateBillingCustomer({
      request: forgedRequest(),
      resolveUserId: session(USER_B),
      stripe: scriptedStripe(["cus_B"], calls),
      db,
    });
    assert.deepEqual(binding, { userId: USER_B, stripeCustomerId: "cus_B" });
    assert.deepEqual(calls, [
      { metadata: { user_id: USER_B }, idempotencyKey: `billing-customer:${USER_B}` },
    ]);
    assert.equal(db.rows.find((row) => row.userId === USER_A)?.stripeCustomerId, "cus_A");
  });

  it("reuses a stored customer and does not call Stripe", async () => {
    const calls: CreateCall[] = [];
    const db = memoryStore([{ userId: USER_B, stripeCustomerId: "cus_existing" }]);
    const binding = await findOrCreateBillingCustomer({
      request: forgedRequest(),
      resolveUserId: session(USER_B),
      stripe: scriptedStripe(["cus_new"], calls),
      db,
    });
    assert.deepEqual(binding, { userId: USER_B, stripeCustomerId: "cus_existing" });
    assert.equal(calls.length, 0);
  });

  it("returns the stored binding when two creates for the same user get the same customer id", async () => {
    const calls: CreateCall[] = [];
    const db = memoryStore([], 2);
    const stripe = scriptedStripe(["cus_same"], calls);
    const [first, second] = await Promise.all([
      findOrCreateBillingCustomer({ request: forgedRequest(), resolveUserId: session(USER_B), stripe, db }),
      findOrCreateBillingCustomer({ request: forgedRequest(), resolveUserId: session(USER_B), stripe, db }),
    ]);
    assert.deepEqual(first, { userId: USER_B, stripeCustomerId: "cus_same" });
    assert.deepEqual(second, first);
    assert.equal(db.rows.length, 1);
  });

  it("reuses the stored binding when two creates for the same user get different customer ids", async () => {
    const calls: CreateCall[] = [];
    const db = memoryStore([], 2);
    const stripe = scriptedStripe(["cus_first", "cus_second"], calls);
    const [first, second] = await Promise.all([
      findOrCreateBillingCustomer({ request: forgedRequest(), resolveUserId: session(USER_B), stripe, db }),
      findOrCreateBillingCustomer({ request: forgedRequest(), resolveUserId: session(USER_B), stripe, db }),
    ]);
    assert.equal(first.stripeCustomerId, second.stripeCustomerId);
    assert.equal(first.userId, USER_B);
    assert.equal(db.rows.length, 1);
    assert.equal(db.rows[0]?.stripeCustomerId, first.stripeCustomerId);
    const loser = first.stripeCustomerId === "cus_first" ? "cus_second" : "cus_first";
    assert.equal(db.rows.some((row) => row.stripeCustomerId === loser), false);
  });

  it("stops when the created customer id is stored for the other user", async () => {
    const db = memoryStore([{ userId: USER_A, stripeCustomerId: "cus_A" }]);
    await assert.rejects(
      findOrCreateBillingCustomer({
        request: forgedRequest(),
        resolveUserId: session(USER_B),
        stripe: scriptedStripe(["cus_A"], []),
        db,
      }),
      (err: unknown) => {
        assert.ok(err instanceof BillingCustomerOwnerConflictError);
        noIds(err);
        return true;
      }
    );
    assert.equal(db.rows.some((row) => row.userId === USER_B), false);
  });

  it("stops when the created customer id belongs to someone else even if this user has another binding", async () => {
    let reads = 0;
    const db: BillingCustomerStore = {
      async findByUserId() {
        reads += 1;
        return reads === 1 ? null : { userId: USER_B, stripeCustomerId: "cus_stored" };
      },
      async findByStripeCustomerId() {
        return { userId: USER_A, stripeCustomerId: "cus_A" };
      },
      async insert(): Promise<BillingCustomerInsertResult> {
        return { ok: false, reason: "unique_violation" };
      },
    };
    await assert.rejects(
      findOrCreateBillingCustomer({
        request: forgedRequest(),
        resolveUserId: session(USER_B),
        stripe: scriptedStripe(["cus_A"], []),
        db,
      }),
      (err: unknown) => {
        assert.ok(err instanceof BillingCustomerOwnerConflictError);
        noIds(err);
        return true;
      }
    );
  });

  it("does not return an id when a unique violation has no verifiable row", async () => {
    const db: BillingCustomerStore = {
      async findByUserId() {
        return null;
      },
      async findByStripeCustomerId() {
        return null;
      },
      async insert(): Promise<BillingCustomerInsertResult> {
        return { ok: false, reason: "unique_violation" };
      },
    };
    await assert.rejects(
      findOrCreateBillingCustomer({
        request: forgedRequest(),
        resolveUserId: session(USER_B),
        stripe: scriptedStripe(["cus_missing"], []),
        db,
      }),
      (err: unknown) => {
        assert.ok(err instanceof BillingCustomerNotBoundError);
        noIds(err);
        return true;
      }
    );
  });

  it("does not return a customer id when Stripe created one and the database write fails", async () => {
    const db: BillingCustomerStore = {
      async findByUserId() {
        return null;
      },
      async findByStripeCustomerId() {
        return null;
      },
      async insert() {
        throw new Error("connection reset while writing cus_orphan");
      },
    };
    await assert.rejects(
      findOrCreateBillingCustomer({
        request: forgedRequest(),
        resolveUserId: session(USER_B),
        stripe: scriptedStripe(["cus_orphan"], []),
        db,
      }),
      (err: unknown) => {
        assert.ok(err instanceof BillingCustomerNotBoundError);
        noIds(err);
        assert.equal(String(err).includes("connection reset"), false);
        return true;
      }
    );
  });
});

type FakeRow = { user_id: string; stripe_customer_id: string } | null;

function fakeStore(input: {
  beforeUser: FakeRow;
  afterUser: FakeRow;
  afterCustomer: FakeRow;
  message: string;
}) {
  let inserted = false;
  return createSupabaseBillingCustomerStore({
    from() {
      return {
        select() {
          return {
            eq(column: "user_id" | "stripe_customer_id") {
              return {
                async maybeSingle() {
                  if (column === "user_id") {
                    return { data: inserted ? input.afterUser : input.beforeUser, error: null };
                  }
                  return { data: inserted ? input.afterCustomer : null, error: null };
                },
              };
            },
          };
        },
        async insert() {
          inserted = true;
          return { error: { code: "23505", message: input.message } };
        },
      };
    },
  });
}

describe("injected Stripe client, fake Supabase responses, no database", () => {
  it("maps every 23505 to a unique violation and ignores the constraint text", async () => {
    for (const message of [
      'duplicate key value violates unique constraint "billing_stripe_customers_customer_id_key"',
      'duplicate key value violates unique constraint "billing_stripe_customers_pkey"',
    ]) {
      const store = createSupabaseBillingCustomerStore({
        from() {
          return {
            select() {
              return { eq: () => ({ async maybeSingle() { return { data: null, error: null }; } }) };
            },
            async insert() {
              return { error: { code: "23505", message } };
            },
          };
        },
      });
      const result = await store.insert({ userId: USER_B, stripeCustomerId: "cus_A" });
      assert.deepEqual(result, { ok: false, reason: "unique_violation" });
    }
  });

  it("returns the same stored customer when the error text names the user key", async () => {
    const db = fakeStore({
      beforeUser: null,
      afterUser: { user_id: USER_B, stripe_customer_id: "cus_same" },
      afterCustomer: { user_id: USER_B, stripe_customer_id: "cus_same" },
      message: 'duplicate key value violates unique constraint "billing_stripe_customers_pkey"',
    });
    const binding = await findOrCreateBillingCustomer({
      request: forgedRequest(),
      resolveUserId: session(USER_B),
      stripe: scriptedStripe(["cus_same"], []),
      db,
    });
    assert.deepEqual(binding, { userId: USER_B, stripeCustomerId: "cus_same" });
  });

  it("reuses the stored customer when the error text names the customer key and the other id is free", async () => {
    const db = fakeStore({
      beforeUser: null,
      afterUser: { user_id: USER_B, stripe_customer_id: "cus_stored" },
      afterCustomer: null,
      message: 'duplicate key value violates unique constraint "billing_stripe_customers_customer_id_key"',
    });
    const binding = await findOrCreateBillingCustomer({
      request: forgedRequest(),
      resolveUserId: session(USER_B),
      stripe: scriptedStripe(["cus_second"], []),
      db,
    });
    assert.deepEqual(binding, { userId: USER_B, stripeCustomerId: "cus_stored" });
  });

  it("stops from the stored customer row when the error text names the user key", async () => {
    const db = fakeStore({
      beforeUser: null,
      afterUser: null,
      afterCustomer: { user_id: USER_A, stripe_customer_id: "cus_A" },
      message: 'duplicate key value violates unique constraint "billing_stripe_customers_pkey"',
    });
    await assert.rejects(
      findOrCreateBillingCustomer({
        request: forgedRequest(),
        resolveUserId: session(USER_B),
        stripe: scriptedStripe(["cus_A"], []),
        db,
      }),
      (err: unknown) => {
        assert.ok(err instanceof BillingCustomerOwnerConflictError);
        noIds(err);
        return true;
      }
    );
  });
});

describe("customer binding stays out of the ordinary test command", () => {
  it("does not add a route, write billing_subscriptions, or point test:auth at Postgres", () => {
    const source = readFileSync("lib/billing/billingCustomer.ts", "utf8");
    const store = readFileSync("lib/billing/billingCustomerStore.ts", "utf8");
    const sql = readFileSync("supabase/migrations/20261102_billing_stripe_customers.sql", "utf8");
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
    const ordinary = readFileSync("lib/billing/billingCustomer.test.ts", "utf8");
    const runner = readFileSync("scripts/isolatedBillingPostgres.ts", "utf8");
    const postgresRunner = readFileSync("scripts/test-billing-customer-postgres.ts", "utf8");
    assert.equal(source.includes("billing_subscriptions"), false);
    assert.equal(store.includes("billing_subscriptions"), false);
    assert.equal(store.includes("customer_id_key"), false);
    assert.equal(store.includes("customer_taken"), false);
    assert.match(sql, /grant select, insert on table public\.billing_stripe_customers to service_role/);
    assert.doesNotMatch(sql, /grant update|grant delete|create policy/i);
    assert.equal(readFileSync("app/api/billing/entitlement/route.ts", "utf8").includes("billing_stripe_customers"), false);
    assert.equal(pkg.scripts["test:auth"].includes("lib/billing/billingCustomer.test.ts"), true);
    assert.equal(pkg.scripts["test:auth"].includes("billingCustomer.postgres.test.ts"), false);
    assert.equal(pkg.scripts["test:billing-customer-postgres"], "node --experimental-strip-types --import ./lib/auth/registerRelativeTs.mjs scripts/test-billing-customer-postgres.ts");
    assert.equal(pkg.scripts["test:auth"].includes("billingCustomer.stripeSandbox.test.ts"), false);
    assert.equal(pkg.scripts["test:auth"].includes("billingCustomer.stripeSandbox.guards.test.ts"), true);
    assert.equal(pkg.scripts["test:auth"].includes("billingCustomer.stripeSandbox.posix.test.ts"), false);
    assert.equal(pkg.scripts["test:auth"].includes("isolatedPostgres.lifecycle.test.ts"), false);
    assert.equal(pkg.scripts["test:auth"].includes("isolatedPostgres.hang.test.ts"), false);
    assert.equal(pkg.scripts["test:billing-customer-linux"], "node --experimental-strip-types --import ./lib/auth/registerRelativeTs.mjs --test --test-concurrency=1 lib/billing/billingCustomer.stripeSandbox.posix.test.ts lib/billing/isolatedPostgres.lifecycle.test.ts");
    for (const word of ["su" + "do", "ps" + "ql", "drop " + "database", "drop " + "role", "pg_" + "ctl", "init" + "db"]) {
      assert.equal(ordinary.includes(word), false, word);
    }
    assert.equal(runner.includes("su" + "do"), false);
    assert.equal(runner.includes("...process.env"), false);
    assert.equal(runner.includes("billing-customer-pg-"), true);
    assert.equal(postgresRunner.includes("su" + "do"), false);
  });
});
