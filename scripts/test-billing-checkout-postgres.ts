import { runIsolatedPostgres } from "./isolatedBillingPostgres";

const result = await runIsolatedPostgres("lib/billing/checkoutSession.postgres.test.ts");
process.exitCode = result.exitCode;
