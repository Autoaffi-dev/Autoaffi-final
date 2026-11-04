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

const result = await runIsolatedPostgres("lib/billing/billingCustomer.stripeSandbox.test.ts", {
  extraEnv: { STRIPE_SANDBOX_SECRET_KEY: key },
});
process.exitCode = result.exitCode;
