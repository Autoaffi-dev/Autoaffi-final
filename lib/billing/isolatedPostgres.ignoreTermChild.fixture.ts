import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { it } from "node:test";

// Launched only by the Linux lifecycle suite. Not part of test:auth.
assert.equal(process.platform, "linux", "STRIPE_SANDBOX_POSIX_REQUIRED");

const pidFile = process.env.ISOLATED_POSTGRES_PID_FILE || "";
if (!pidFile.startsWith("/")) throw new Error("ISOLATED_POSTGRES_PID_FILE_MISSING");

const childSource = `
const fs = require("fs");
const file = process.env.ISOLATED_POSTGRES_PID_FILE;
if (!file) process.exit(1);
process.on("SIGTERM", () => {
  try { fs.appendFileSync(file, "GOT_SIGTERM\\n"); } catch {}
});
process.on("SIGINT", () => {});
function pgrp(pid) {
  const stat = fs.readFileSync("/proc/" + pid + "/stat", "utf8");
  const end = stat.lastIndexOf(")");
  return Number(stat.slice(end + 2).split(" ")[2]);
}
const payload = {
  parentPid: process.ppid,
  parentPgrp: pgrp(process.ppid),
  childPid: process.pid,
  childPgrp: pgrp(process.pid)
};
fs.writeFileSync(file, JSON.stringify(payload) + "\\n", { mode: 0o600 });
setInterval(() => {}, 500);
`;

it("keeps a child that ignores SIGTERM", () => {
  const child = spawn(process.execPath, ["-e", childSource], { stdio: "ignore" });
  if (!child.pid) throw new Error("ISOLATED_POSTGRES_CHILD_SPAWN_FAILED");
  setInterval(() => undefined, 1_000);
  return new Promise(() => undefined);
});
