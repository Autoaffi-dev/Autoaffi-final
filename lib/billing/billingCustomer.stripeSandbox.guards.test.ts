import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { findOrCreateBillingCustomer } from "./billingCustomer.ts";
import { limitedProcessEnv, PROCESS_ENV_ALLOWLIST } from "./limitedProcessEnv.ts";
import {
  captureCustomerCreate,
  cleanupDecision,
  createCaptureBag,
  findLiveEnvName,
  readTestKey,
  SandboxError,
  toSandboxError,
  withCapturedCustomers,
  withTimeout,
} from "./stripeSandbox.ts";

const FIXTURE_KEY = "sk_test_unitfixture";
const LIVE_BODY = "unitfixturenotsecret";

function asSandboxError(err: unknown): SandboxError {
  assert.ok(err instanceof SandboxError);
  return err;
}

function sandboxError(run: () => unknown): SandboxError {
  let caught: unknown;
  try {
    run();
  } catch (err) {
    caught = err;
  }
  return asSandboxError(caught);
}

describe("stripe sandbox guards without network", () => {
  it("keeps database and Stripe values out of the process allowlist", () => {
    const source = {
      PATH: "/usr/bin",
      HOME: "/home/ubuntu",
      PGHOST: "/var/run/postgresql",
      PGPORT: "5432",
      PGSERVICE: "production",
      PGDATABASE: "postgres",
      DATABASE_URL: "postgres://production.example/db",
      SUPABASE_URL: "https://production.example",
      STRIPE_SANDBOX_SECRET_KEY: FIXTURE_KEY,
      STRIPE_SECRET_KEY: `sk_live_${LIVE_BODY}`,
    };
    const limited = limitedProcessEnv(source);
    assert.equal(limited.PATH, "/usr/bin");
    assert.equal(limited.HOME, "/home/ubuntu");
    assert.equal("PGHOST" in limited, false);
    assert.equal("PGSERVICE" in limited, false);
    assert.equal("PGDATABASE" in limited, false);
    assert.equal("DATABASE_URL" in limited, false);
    assert.equal("SUPABASE_URL" in limited, false);
    assert.equal("STRIPE_SANDBOX_SECRET_KEY" in limited, false);
    assert.equal("STRIPE_SECRET_KEY" in limited, false);
    assert.deepEqual(PROCESS_ENV_ALLOWLIST.includes("PGHOST"), false);
    assert.deepEqual(PROCESS_ENV_ALLOWLIST.includes("PGSERVICE"), false);
  });

  it("rejects a live key file without copying the key into the error", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sandbox-live-key-"));
    const file = path.join(dir, "key");
    const secret = `sk_live_${LIVE_BODY}`;
    try {
      writeFileSync(file, `${secret}\n`, { mode: 0o600 });
      const err = sandboxError(() => readTestKey(file));
      assert.equal(err.code, "STRIPE_SANDBOX_KEY_REJECTED");
      assert.equal(JSON.stringify({ code: err.code, details: err.details, message: err.message }).includes(LIVE_BODY), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("names a live environment variable without copying its value", () => {
    const secret = `sk_live_${LIVE_BODY}`;
    assert.equal(findLiveEnvName({ STRIPE_SECRET_KEY: secret, PATH: "/usr/bin" }), "STRIPE_SECRET_KEY");
    assert.equal(findLiveEnvName({ rk_value: `rk_live_${LIVE_BODY}` }), "rk_value");
    const err = new SandboxError("STRIPE_SANDBOX_LIVE_ENV", { envName: "STRIPE_SECRET_KEY", leaked: secret });
    const printed = `${err.code} ${err.message} ${JSON.stringify(err.details)}`;
    assert.equal(err.details.envName, "STRIPE_SECRET_KEY");
    assert.equal(printed.includes(LIVE_BODY), false);
    assert.equal(printed.includes("sk_live_"), false);
  });

  it("keeps Stripe transport fields out of sandbox errors", () => {
    const secret = `sk_live_${LIVE_BODY}`;
    const err = toSandboxError(
      {
        message: `Invalid API key ${secret}`,
        type: "StripeAuthenticationError",
        code: "api_key_invalid",
        statusCode: 401,
        headers: { Authorization: `Bearer ${secret}` },
        raw: { request: secret },
        requestId: "req_secret",
      },
      "customers.create"
    );
    const printed = `${err.code} ${err.message} ${JSON.stringify(err.details)}`;
    assert.equal(err.code, "STRIPE_SANDBOX_AUTH_FAILED");
    assert.equal(err.details.operation, "customers.create");
    assert.equal(err.details.stripeCode, "api_key_invalid");
    assert.equal(err.details.httpStatus, 401);
    assert.equal(printed.includes(LIVE_BODY), false);
    assert.equal(printed.includes("Authorization"), false);
    assert.equal(printed.includes("Bearer"), false);
    assert.equal(printed.includes("req_secret"), false);
  });

  it("times out a hanging call without waiting for it", async () => {
    const started = Date.now();
    const err = asSandboxError(await withTimeout(new Promise(() => undefined), 30, "customers.create").then(
      () => { throw new Error("should have timed out"); },
      (caught: unknown) => caught
    ));
    assert.equal(err.code, "STRIPE_SANDBOX_TIMEOUT");
    assert.equal(err.details.operation, "customers.create");
    assert.equal(err.details.timeoutMs, 30);
    assert.equal(Date.now() - started < 1000, true);
  });

  it("captures the customer id when database insert fails and preserves that error if cleanup fails", async () => {
    const capture = createCaptureBag();
    const cleaned: string[] = [];
    const stripe = {
      customers: {
        create: captureCustomerCreate(async () => ({ id: "cus_orphan" }), capture),
      },
    };
    const err = asSandboxError(await withCapturedCustomers({
      capture,
      cleanup: async (customerId) => {
        cleaned.push(customerId);
        throw new SandboxError("STRIPE_SANDBOX_CLEANUP_LIVEMODE", { operation: "customers.del" });
      },
      run: () => findOrCreateBillingCustomer({
        request: new Request("https://autoaffi.test/billing-customer-sandbox?user_id=not-the-session"),
        resolveUserId: async () => "33333333-3333-4333-8333-333333333333",
        stripe,
        db: {
          async findByUserId() { return null; },
          async findByStripeCustomerId() { return null; },
          async insert() { throw new Error("write failed after create and mentioned cus_orphan"); },
        },
      }),
    }).then(
      () => { throw new Error("should have failed"); },
      (caught: unknown) => caught
    ));
    assert.deepEqual(capture.ids, ["cus_orphan"]);
    assert.deepEqual(cleaned, ["cus_orphan"]);
    assert.equal(err.code, "BILLING_CUSTOMER_NOT_BOUND");
    assert.equal(err.details.cleanupCode, "STRIPE_SANDBOX_CLEANUP_LIVEMODE");
    assert.equal(`${err.message} ${JSON.stringify(err.details)}`.includes("cus_orphan"), false);
    assert.equal(`${err.message} ${JSON.stringify(err.details)}`.includes("write failed"), false);
  });

  it("cleans a customer id that arrives after the create waiter times out", async () => {
    const started = Date.now();
    const capture = createCaptureBag();
    const cleaned: string[] = [];
    let release: (value: { id: string }) => void = () => undefined;
    const delayed = new Promise<{ id: string }>((resolve) => {
      release = resolve;
    });
    const pending = withCapturedCustomers({
      capture,
      graceMs: 300,
      cleanup: async (id) => {
        cleaned.push(id);
      },
      run: () => findOrCreateBillingCustomer({
        request: new Request("https://autoaffi.test/billing-customer-sandbox"),
        resolveUserId: async () => "33333333-3333-4333-8333-333333333333",
        stripe: { customers: { create: captureCustomerCreate(async () => delayed, capture, 40) } },
        db: {
          async findByUserId() { return null; },
          async findByStripeCustomerId() { return null; },
          async insert() { return { ok: true }; },
        },
      }),
    });
    setTimeout(() => release({ id: "cus_late" }), 80);
    const err = asSandboxError(await pending.then(
      () => { throw new Error("should have timed out"); },
      (caught: unknown) => caught
    ));
    assert.equal(err.code, "STRIPE_SANDBOX_TIMEOUT");
    assert.deepEqual(cleaned, ["cus_late"]);
    assert.deepEqual(capture.ids, ["cus_late"]);
    assert.equal(Date.now() - started < 2_000, true);
  });

  it("reports a late customer id when cleanup cannot delete it", async () => {
    const capture = createCaptureBag();
    const messages: string[] = [];
    const original = console.error;
    console.error = (message?: unknown) => {
      messages.push(String(message));
    };
    let release: (value: { id: string }) => void = () => undefined;
    const delayed = new Promise<{ id: string }>((resolve) => {
      release = resolve;
    });
    setTimeout(() => release({ id: "cus_late" }), 80);
    try {
      const err = asSandboxError(await withCapturedCustomers({
        capture,
        graceMs: 300,
        cleanup: async () => {
          throw new SandboxError("STRIPE_SANDBOX_CLEANUP_LIVEMODE", { operation: "customers.del" });
        },
        run: () => findOrCreateBillingCustomer({
          request: new Request("https://autoaffi.test/billing-customer-sandbox"),
          resolveUserId: async () => "33333333-3333-4333-8333-333333333333",
          stripe: { customers: { create: captureCustomerCreate(async () => delayed, capture, 40) } },
          db: {
            async findByUserId() { return null; },
            async findByStripeCustomerId() { return null; },
            async insert() { return { ok: true }; },
          },
        }),
      }).then(
        () => { throw new Error("should have timed out"); },
        (caught: unknown) => caught
      ));
      assert.equal(err.code, "STRIPE_SANDBOX_TIMEOUT");
      assert.equal(err.details.cleanupCode, "STRIPE_SANDBOX_CLEANUP_LIVEMODE");
      assert.equal(messages.includes("leftover_stripe_customer=cus_late"), true);
    } finally {
      console.error = original;
    }
  });

  it("reports an unseen create when no response arrives", async () => {
    const started = Date.now();
    const capture = createCaptureBag();
    const messages: string[] = [];
    const original = console.error;
    console.error = (message?: unknown) => {
      messages.push(String(message));
    };
    try {
      const err = asSandboxError(await withCapturedCustomers({
        capture,
        graceMs: 50,
        cleanup: async () => undefined,
        run: () => findOrCreateBillingCustomer({
          request: new Request("https://autoaffi.test/billing-customer-sandbox"),
          resolveUserId: async () => "33333333-3333-4333-8333-333333333333",
          stripe: { customers: { create: captureCustomerCreate(async () => new Promise(() => undefined), capture, 30) } },
          db: {
            async findByUserId() { return null; },
            async findByStripeCustomerId() { return null; },
            async insert() { return { ok: true }; },
          },
        }),
      }).then(
        () => { throw new Error("should have timed out"); },
        (caught: unknown) => caught
      ));
      assert.equal(err.code, "STRIPE_SANDBOX_TIMEOUT");
      assert.deepEqual(capture.ids, []);
      assert.equal(messages.includes("STRIPE_SANDBOX_CREATE_UNSEEN"), true);
      assert.equal(Date.now() - started < 2_000, true);
    } finally {
      console.error = original;
    }
  });

  it("deletes only the exact captured test customer", () => {
    assert.equal(cleanupDecision(
      { id: "cus_same", livemode: false, metadata: { user_id: "user-1" } },
      { id: "cus_same", userId: "user-1" }
    ), "delete");
    assert.equal(sandboxError(() => cleanupDecision(
      { id: "cus_same", livemode: true, metadata: { user_id: "user-1" } },
      { id: "cus_same", userId: "user-1" }
    )).code, "STRIPE_SANDBOX_CLEANUP_LIVEMODE");
    assert.equal(sandboxError(() => cleanupDecision(
      { id: "cus_other", livemode: false, metadata: { user_id: "user-1" } },
      { id: "cus_same", userId: "user-1" }
    )).code, "STRIPE_SANDBOX_CLEANUP_ID_MISMATCH");
    assert.equal(sandboxError(() => cleanupDecision(
      { id: "cus_same", livemode: false, metadata: { user_id: "user-2" } },
      { id: "cus_same", userId: "user-1" }
    )).code, "STRIPE_SANDBOX_CLEANUP_USER_MISMATCH");
  });

  it("stops the sandbox command before Postgres when no key file is configured", () => {
    const result = spawnSync(process.execPath, [
      "--experimental-strip-types",
      "--import",
      "./lib/auth/registerRelativeTs.mjs",
      "scripts/test-billing-customer-stripe-sandbox.ts",
    ], {
      encoding: "utf8",
      env: limitedProcessEnv(process.env),
      timeout: 15_000,
    });
    assert.equal(result.status, 1);
    assert.equal(result.stderr.includes("STRIPE_SANDBOX_KEY_FILE_MISSING"), true);
    assert.equal(result.stderr.includes("server started"), false);
    assert.equal(result.stderr.includes("ISOLATED_POSTGRES_INIT_FAILED"), false);
  });

  it("stops the sandbox command before Postgres when the environment holds a live key", () => {
    const env = limitedProcessEnv(process.env);
    env.STRIPE_SECRET_KEY = `sk_live_${LIVE_BODY}`;
    const result = spawnSync(process.execPath, [
      "--experimental-strip-types",
      "--import",
      "./lib/auth/registerRelativeTs.mjs",
      "scripts/test-billing-customer-stripe-sandbox.ts",
    ], { encoding: "utf8", env, timeout: 15_000 });
    const output = `${result.stdout}${result.stderr}`;
    assert.equal(result.status, 1);
    assert.equal(output.includes("STRIPE_SANDBOX_LIVE_ENV envName=STRIPE_SECRET_KEY"), true);
    assert.equal(output.includes(LIVE_BODY), false);
    assert.equal(output.includes("sk_live_"), false);
    assert.equal(output.includes("server started"), false);
  });

  it("keeps the manual command out of test:auth and does not inherit process.env in the runners", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
    const isolated = readFileSync("scripts/isolatedBillingPostgres.ts", "utf8");
    const lifecycle = readFileSync("lib/billing/isolatedPostgres.lifecycle.test.ts", "utf8");
    const subject = readFileSync("scripts/isolated-postgres-signal-subject.ts", "utf8");
    const postgresTest = readFileSync("lib/billing/billingCustomer.postgres.test.ts", "utf8");
    const sandboxTest = readFileSync("lib/billing/billingCustomer.stripeSandbox.test.ts", "utf8");
    assert.equal(pkg.scripts["test:auth"].includes("billingCustomer.stripeSandbox.test.ts"), false);
    assert.equal(pkg.scripts["test:auth"].includes("billingCustomer.stripeSandbox.guards.test.ts"), true);
    assert.equal(
      pkg.scripts["test:billing-customer-stripe-sandbox"],
      "node --experimental-strip-types --import ./lib/auth/registerRelativeTs.mjs scripts/test-billing-customer-stripe-sandbox.ts"
    );
    assert.equal(isolated.includes("...process.env"), false);
    assert.equal(isolated.includes("child.kill"), false);
    assert.equal(isolated.includes("detached: true"), true);
    assert.equal(lifecycle.includes("...process.env"), false);
    assert.equal(subject.includes("...process.env"), false);
    assert.equal(postgresTest.includes("...process.env"), false);
    assert.equal(sandboxTest.includes("...process.env"), false);
    assert.equal(sandboxTest.includes("createSupabaseBillingCustomerStore("), false);
    assert.equal(sandboxTest.includes("billingCustomerStore.ts"), false);
    assert.equal(sandboxTest.includes("requireUserId"), false);
    assert.equal(sandboxTest.includes("This run does not call NextAuth or createSupabaseBillingCustomerStore."), true);
    assert.equal(pkg.scripts["test:auth"].includes("billingCustomer.stripeSandbox.posix.test.ts"), false);
    assert.equal(pkg.scripts["test:auth"].includes("isolatedPostgres.lifecycle.test.ts"), false);
    assert.equal(pkg.scripts["test:auth"].includes("isolatedPostgres.hang.test.ts"), false);
    assert.equal(pkg.scripts["test:auth"].includes("ignoreTermChild"), false);
    assert.equal(
      pkg.scripts["test:billing-customer-linux"],
      "node --experimental-strip-types --import ./lib/auth/registerRelativeTs.mjs --test --test-concurrency=1 lib/billing/billingCustomer.stripeSandbox.posix.test.ts lib/billing/isolatedPostgres.lifecycle.test.ts"
    );
  });
});
