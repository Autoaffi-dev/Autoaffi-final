import { spawnSync } from "node:child_process";
import { limitedProcessEnv } from "../lib/billing/limitedProcessEnv";
import { assertKeyFileOutsideRepo, findLiveEnvName, readTestKey, SandboxError } from "../lib/billing/stripeSandbox";
import { runIsolatedPostgres } from "./isolatedBillingPostgres";

function report(err: unknown): never {
  if (err instanceof SandboxError) {
    const envName = err.details.envName;
    console.error(envName ? `${err.code} envName=${envName}` : err.code);
  } else {
    console.error("STRIPE_SANDBOX_FAILED");
  }
  process.exit(1);
}

const liveName = findLiveEnvName(process.env);
if (liveName) report(new SandboxError("STRIPE_SANDBOX_LIVE_ENV", { envName: liveName }));

const filePath = process.env.STRIPE_SANDBOX_KEY_FILE;
if (!filePath) report(new SandboxError("STRIPE_SANDBOX_KEY_FILE_MISSING"));

// STRIPE_SANDBOX_PRICE_BASIC is only the manual sandbox harness price.
// A later sandbox run should set it to the new 900-cent Basic price id.
// The ordinary test webhook reads STRIPE_PRICE_BASIC_TEST and is not configured here.
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
try {
  key = readTestKey(assertKeyFileOutsideRepo(filePath, git.stdout.trim()));
} catch (err) {
  report(err);
}

const result = await runIsolatedPostgres("lib/billing/checkoutSession.stripeSandbox.test.ts", {
  extraEnv: { STRIPE_SANDBOX_SECRET_KEY: key, ...prices },
});
process.exitCode = result.exitCode;
