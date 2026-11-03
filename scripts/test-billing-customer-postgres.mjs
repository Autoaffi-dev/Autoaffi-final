import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const binDir = "/usr/lib/postgresql/16/bin";
const initdb = path.join(binDir, "initdb");
const pgCtl = path.join(binDir, "pg_ctl");
const port = "54329";

function fail(message) {
  console.error(message);
  process.exitCode = 1;
  throw new Error("isolated-postgres-aborted");
}

function cleanEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  for (const key of ["PGHOST", "PGPORT", "PGUSER", "PGDATABASE", "PGDATA", "PGAPPNAME", "PGPASSWORD", "PGSERVICE"]) {
    if (!(key in extra)) delete env[key];
  }
  return env;
}

if (!fs.existsSync(initdb) || !fs.existsSync(pgCtl) || !fs.existsSync("/usr/bin/psql") || !fs.existsSync("/usr/bin/stdbuf")) {
  fail("Refusing to continue: could not find binaries for an isolated Postgres instance. This command does not connect to the host database.");
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "billing-customer-pg-"));
const data = path.join(root, "data");
const sock = path.join(root, "sock");
let started = false;

try {
  if (!root.includes(`${path.sep}billing-customer-pg-`)) {
    fail("Refusing to continue: temporary directory is not an isolated billing-customer instance.");
  }
  fs.mkdirSync(sock, { mode: 0o700 });
  fs.chmodSync(root, 0o700);
  const initialized = spawnSync(
    initdb,
    ["-D", data, "--username=billing_customer_test", "--auth-local=trust", "--auth-host=reject", "--no-sync", "--encoding=UTF8", "--locale=C"],
    { encoding: "utf8", env: cleanEnv() }
  );
  if (initialized.status !== 0) {
    fail(`Refusing to continue: isolated initdb failed.\n${initialized.stderr || initialized.stdout || ""}`);
  }
  const startedResult = spawnSync(
    pgCtl,
    ["-D", data, "-l", path.join(root, "server.log"), "-o", `-c listen_addresses= -c unix_socket_directories=${sock} -c port=${port}`, "-w", "-t", "30", "start"],
    { encoding: "utf8", env: cleanEnv() }
  );
  if (startedResult.status !== 0) {
    const log = fs.existsSync(path.join(root, "server.log")) ? fs.readFileSync(path.join(root, "server.log"), "utf8") : "";
    fail(`Refusing to continue: isolated Postgres did not start. This command does not connect to the host database.\n${startedResult.stderr || ""}\n${log}`);
  }
  started = true;
  const test = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--import", "./lib/auth/registerRelativeTs.mjs", "--test", "lib/billing/billingCustomer.postgres.test.ts"],
    {
      stdio: "inherit",
      env: cleanEnv({
        BILLING_CUSTOMER_PGROOT: root,
        BILLING_CUSTOMER_PGHOST: sock,
        BILLING_CUSTOMER_PGPORT: port,
        BILLING_CUSTOMER_PGUSER: "billing_customer_test",
        BILLING_CUSTOMER_PGDATA: data,
      }),
    }
  );
  process.exitCode = test.status === 0 ? 0 : test.status || 1;
} catch (err) {
  if (!process.exitCode) process.exitCode = 1;
  if (err instanceof Error && err.message !== "isolated-postgres-aborted") console.error(err.message);
} finally {
  if (started) {
    spawnSync(pgCtl, ["-D", data, "-m", "immediate", "-w", "stop"], { encoding: "utf8", env: cleanEnv() });
  }
  if (root.includes(`${path.sep}billing-customer-pg-`)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  if (fs.existsSync(root)) {
    console.error(`Isolated Postgres directory was not removed: ${root}`);
    process.exitCode = 1;
  }
}
