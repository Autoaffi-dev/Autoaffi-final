import { runIsolatedPostgres } from "./isolatedBillingPostgres";

const result = await runIsolatedPostgres("lib/billing/paidEntitlement.integration.test.ts", {
  timeoutMs: 90_000,
});
process.exitCode = result.exitCode;
