import { runIsolatedPostgres } from "./isolatedBillingPostgres";

const result = await runIsolatedPostgres("lib/billing/billingCustomer.postgres.test.ts");
process.exitCode = result.exitCode;
