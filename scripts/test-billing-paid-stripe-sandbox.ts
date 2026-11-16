import { spawnSync } from "node:child_process";
import { limitedProcessEnv } from "../lib/billing/limitedProcessEnv";
import { PAID_SANDBOX_RIG_TIMEOUT_MS, STRIPE_LISTEN_COMMAND } from "../lib/billing/paidCheckoutSandbox";
import { assertKeyFileOutsideRepo, findLiveEnvName, readTestKey, readWebhookSecret, SandboxError } from "../lib/billing/stripeSandbox";
import { runIsolatedPostgres } from "./isolatedBillingPostgres";

// Before the manual run, execute `stripe version` and `stripe listen --help` in the same shell.
// Use the command below only when that help text shows every flag it contains.
// stripe listen --events invoice.paid,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,customer.updated --events-from @self --forward-to http://127.0.0.1:8787/billing-webhook
// The public listen reference defaults to a sandbox account. Its live flag switches to live mode and must stay unused.
// Its latest flag selects the CLI's current latest API version, not 2025-11-17.clover.
// The reference does not provide a webhook API version pin.
// Confirm in Workbench that the sandbox account's default API version is already 2025-11-17.clover.
// Do not change the account version from this test. The Node SDK API version does not render webhook events.
// This harness fails unless the received event.api_version is 2025-11-17.clover.
// STRIPE_SANDBOX_KEY_FILE is the existing sandbox key file shared with the checkout and customer scripts.
void STRIPE_LISTEN_COMMAND;

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
