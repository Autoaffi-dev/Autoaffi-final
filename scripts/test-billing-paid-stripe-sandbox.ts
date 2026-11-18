import { spawnSync } from "node:child_process";
import { limitedProcessEnv } from "../lib/billing/limitedProcessEnv";
import { PAID_SANDBOX_CLOVER_ENDPOINT, PAID_SANDBOX_RIG_TIMEOUT_MS } from "../lib/billing/paidCheckoutSandbox";
import { assertKeyFileOutsideRepo, findLiveEnvName, readTestKey, readWebhookSecret, SandboxError } from "../lib/billing/stripeSandbox";
import { runIsolatedPostgres } from "./isolatedBillingPostgres";

// The CLI listener cannot select webhook API version 2025-11-17.clover.
// The manual run receives events from a separate sandbox webhook endpoint.
// That endpoint is created outside this harness and is not created here.
// Its API version is exactly 2025-11-17.clover.
// Its signing secret is its own and is read only from STRIPE_SANDBOX_WEBHOOK_SECRET_FILE.
// Destination: http://127.0.0.1:8787/billing-webhook
// Events: invoice.paid, invoice_payment.paid, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted, customer.updated
// This file does not create the endpoint. A manual run requires that endpoint and its own secret to already exist.
// The receiver fails unless every received event.api_version is 2025-11-17.clover.
// STRIPE_SANDBOX_KEY_FILE is the existing sandbox key file shared with the checkout and customer scripts.
const cloverEndpoint = PAID_SANDBOX_CLOVER_ENDPOINT;
if (
  cloverEndpoint.apiVersion !== "2025-11-17.clover"
  || cloverEndpoint.secretFile !== "STRIPE_SANDBOX_WEBHOOK_SECRET_FILE"
  || cloverEndpoint.url !== "http://127.0.0.1:8787/billing-webhook"
  || cloverEndpoint.events.join(",") !== "invoice.paid,invoice_payment.paid,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,customer.updated"
) {
  throw new Error("STRIPE_SANDBOX_CLOVER_ENDPOINT_MISMATCH");
}

function report(err: unknown): never {
  if (err instanceof SandboxError) {
    const envName = err.details.envName;
    console.error(envName ? `${err.code} envName=${envName}` : err.code);
  } else {
    console.error("STRIPE_SANDBOX_FAILED");
  }
  process.exit(1);
}

if (process.env.BILLING_WEBHOOK_ENABLED === "true" || process.env.BILLING_CHECKOUT_ENABLED === "true") {
  report(new SandboxError("STRIPE_SANDBOX_BILLING_FLAG"));
}

const liveName = findLiveEnvName(process.env);
if (liveName) report(new SandboxError("STRIPE_SANDBOX_LIVE_ENV", { envName: liveName }));

const filePath = process.env.STRIPE_SANDBOX_KEY_FILE;
if (!filePath) report(new SandboxError("STRIPE_SANDBOX_KEY_FILE_MISSING"));
const secretPath = process.env.STRIPE_SANDBOX_WEBHOOK_SECRET_FILE;
if (!secretPath) report(new SandboxError("STRIPE_SANDBOX_WEBHOOK_SECRET_FILE_MISSING"));

const prices = {
  STRIPE_SANDBOX_PRICE_BASIC: process.env.STRIPE_SANDBOX_PRICE_BASIC || "",
  STRIPE_SANDBOX_PRICE_PRO: process.env.STRIPE_SANDBOX_PRICE_PRO || "",
  STRIPE_SANDBOX_PRICE_ELITE: process.env.STRIPE_SANDBOX_PRICE_ELITE || "",
};
if (Object.values(prices).some((value) => !/^price_[A-Za-z0-9]+$/.test(value))) {
  report(new SandboxError("STRIPE_SANDBOX_PRICE_REJECTED"));
}

const git = spawnSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
  env: limitedProcessEnv(process.env),
});
if (git.status !== 0 || !git.stdout.trim()) report(new SandboxError("STRIPE_SANDBOX_REPO_UNVERIFIED"));

let key = "";
let webhookSecret = "";
try {
  const repo = git.stdout.trim();
  key = readTestKey(assertKeyFileOutsideRepo(filePath, repo));
  webhookSecret = readWebhookSecret(assertKeyFileOutsideRepo(secretPath, repo));
} catch (err) {
  report(err);
}

const result = await runIsolatedPostgres("lib/billing/paidCheckout.stripeSandbox.test.ts", {
  timeoutMs: PAID_SANDBOX_RIG_TIMEOUT_MS,
  extraEnv: { STRIPE_SANDBOX_SECRET_KEY: key, STRIPE_SANDBOX_WEBHOOK_SECRET: webhookSecret, ...prices },
});
process.exitCode = result.exitCode;
