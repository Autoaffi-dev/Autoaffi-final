import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import { findOrCreateBillingCustomer, type BillingCustomerStore } from "./billingCustomer.ts";
import { limitedProcessEnv } from "./limitedProcessEnv.ts";
import {
  captureCustomerCreate,
  cleanupDecision,
  createCaptureBag,
  SandboxError,
  withCapturedCustomers,
  withTimeout,
  type CleanupCustomer,
} from "./stripeSandbox.ts";

const root = process.env.BILLING_CUSTOMER_PGROOT || "";
const host = process.env.BILLING_CUSTOMER_PGHOST || "";
const port = process.env.BILLING_CUSTOMER_PGPORT || "";
const dbUser = process.env.BILLING_CUSTOMER_PGUSER || "";
const data = process.env.BILLING_CUSTOMER_PGDATA || "";
const database = "billing_customer_test";
const key = process.env.STRIPE_SANDBOX_SECRET_KEY || "";

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

function quoteLiteral(value: string): string {
  if (!/^[0-9a-zA-Z_-]+$/.test(value)) throw new SandboxError("STRIPE_SANDBOX_DB_FAILED", { operation: "psql" });
  return `'${value}'`;
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

function limitedCustomer(customer: Stripe.Customer | Stripe.DeletedCustomer): CleanupCustomer {
  if ("deleted" in customer && customer.deleted) return { id: customer.id, deleted: true };
  const userId = typeof customer.metadata?.user_id === "string" ? customer.metadata.user_id : undefined;
  return {
    id: customer.id,
    livemode: customer.livemode,
    metadata: userId ? { user_id: userId } : null,
  };
}

function createStore(): BillingCustomerStore {
  return {
    async findByUserId(userId) {
      const stripeCustomerId = psql(
        database,
        serviceSql(`select stripe_customer_id from public.billing_stripe_customers where user_id = ${quoteLiteral(userId)}`)
      );
      return stripeCustomerId ? { userId, stripeCustomerId } : null;
    },
    async findByStripeCustomerId(stripeCustomerId) {
      const userId = psql(
        database,
        serviceSql(`select user_id from public.billing_stripe_customers where stripe_customer_id = ${quoteLiteral(stripeCustomerId)}`)
      );
      return userId ? { userId, stripeCustomerId } : null;
    },
    async insert(binding) {
      psql(
        database,
        serviceSql(
          `insert into public.billing_stripe_customers (user_id, stripe_customer_id) values (${quoteLiteral(binding.userId)}, ${quoteLiteral(binding.stripeCustomerId)})`
        )
      );
      return { ok: true };
    },
  };
}

describe("Stripe sandbox customer binding", () => {
  it("creates one test customer and reuses the saved binding", async () => {
    console.log("Synthetic user resolver only. This run does not call NextAuth or createSupabaseBillingCustomerStore.");
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
    psqlFile(database, "supabase/migrations/20261102_billing_stripe_customers.sql");

    const userId = randomUUID();
    console.log(`synthetic_user=${userId}`);
    psql(database, `insert into auth.users (id) values (${quoteLiteral(userId)})`);
    const request = new Request("https://autoaffi.test/billing-customer-sandbox?user_id=00000000-0000-4000-8000-000000000000");
    const client = new Stripe(key, {
      apiVersion: "2025-11-17.clover",
      telemetry: false,
      maxNetworkRetries: 0,
      timeout: 10_000,
    });
    const capture = createCaptureBag();
    let idempotencyKey = "";
    const stripe = {
      customers: {
        create: captureCustomerCreate(async (params, options) => {
          idempotencyKey = options.idempotencyKey;
          const created = await client.customers.create(
            { metadata: { user_id: params.metadata.user_id } },
            { idempotencyKey: options.idempotencyKey, timeout: 10_000 }
          );
          return { id: created.id };
        }, capture),
      },
    };

    await withCapturedCustomers({
      capture,
      cleanup: async (customerId) => {
        const retrieved = await withTimeout(
          client.customers.retrieve(customerId, { timeout: 10_000 }),
          15_000,
          "customers.retrieve"
        );
        cleanupDecision(limitedCustomer(retrieved), { id: customerId, userId });
        await withTimeout(client.customers.del(customerId, { timeout: 10_000 }), 15_000, "customers.del");
        console.log(`deleted_stripe_customer=${customerId}`);
      },
      run: async () => {
        const db = createStore();
        const first = await findOrCreateBillingCustomer({
          request,
          resolveUserId: async () => userId,
          stripe,
          db,
        });
        const second = await findOrCreateBillingCustomer({
          request,
          resolveUserId: async () => userId,
          stripe,
          db,
        });
        assert.equal(capture.ids.length, 1);
        assert.equal(first.stripeCustomerId, capture.ids[0]);
        assert.deepEqual(second, first);
        assert.equal(first.userId, userId);
        assert.equal(idempotencyKey, `billing-customer:${userId}`);
        assert.equal(
          psql(database, serviceSql(`select stripe_customer_id from public.billing_stripe_customers where user_id = ${quoteLiteral(userId)}`)),
          first.stripeCustomerId
        );
        const retrieved = await withTimeout(
          client.customers.retrieve(first.stripeCustomerId, { timeout: 10_000 }),
          15_000,
          "customers.retrieve"
        );
        assert.equal(cleanupDecision(limitedCustomer(retrieved), { id: first.stripeCustomerId, userId }), "delete");
        console.log(`stripe_customer=${first.stripeCustomerId}`);
        console.log("second_create_count=0");
      },
    });
  });
});
