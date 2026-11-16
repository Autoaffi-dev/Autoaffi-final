import { runIsolatedPostgres } from "./isolatedBillingPostgres";

const result = await runIsolatedPostgres("lib/billing/paidCheckout.stripeSandbox.local.test.ts", { timeoutMs: 60_000 });
process.exitCode = result.exitCode;
