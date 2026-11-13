import { runIsolatedPostgres } from "./isolatedBillingPostgres";

const result = await runIsolatedPostgres("lib/billing/applyStripeEvent.postgres.test.ts");
process.exitCode = result.exitCode;
