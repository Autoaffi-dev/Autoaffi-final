import { limitedProcessEnv } from "../lib/billing/limitedProcessEnv";
import { observeGroupStopped } from "../lib/billing/isolatedPostgres.groupCheck";
import { runIsolatedPostgres } from "./isolatedBillingPostgres";

const allowedFiles = new Set([
  "lib/billing/isolatedPostgres.hang.test.ts",
  "lib/billing/isolatedPostgres.ignoreTermChild.fixture.ts",
]);
const timeoutMs = Number(process.env.ISOLATED_POSTGRES_TEST_TIMEOUT_MS || "20000");
const testFile = process.env.ISOLATED_POSTGRES_TEST_FILE || "lib/billing/isolatedPostgres.hang.test.ts";
const pidFile = process.env.ISOLATED_POSTGRES_PID_FILE || "";
const observeEnv = limitedProcessEnv(process.env);

if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) {
  console.error("ISOLATED_POSTGRES_SUBJECT_TIMEOUT_REJECTED");
  process.exitCode = 1;
} else if (!allowedFiles.has(testFile)) {
  console.error("ISOLATED_POSTGRES_SUBJECT_FILE_REJECTED");
  process.exitCode = 1;
} else if (pidFile && !pidFile.startsWith("/")) {
  console.error("ISOLATED_POSTGRES_PID_FILE_REJECTED");
  process.exitCode = 1;
} else {
  if (pidFile) {
    const original = console.error;
    console.error = ((message?: unknown, ...rest: unknown[]) => {
      const text = typeof message === "string" ? message : "";
      if (text.startsWith("ISOLATED_POSTGRES_TEST_GROUP_STOPPED ")) {
        try {
          observeGroupStopped(text, pidFile, observeEnv);
          original("ISOLATED_POSTGRES_GROUP_OBSERVED ok");
        } catch (error) {
          const reason = error instanceof Error ? error.message.split("\n")[0] : "OBSERVE_FAILED";
          original(`ISOLATED_POSTGRES_GROUP_OBSERVED failed ${reason}`);
        }
      }
      original(message, ...rest);
    }) as typeof console.error;
  }
  const result = await runIsolatedPostgres(testFile, {
    timeoutMs,
    ...(pidFile ? { pidFile } : {}),
  });
  process.exitCode = result.exitCode;
}
