import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { observeGroupStopped, killRecordedGroup } from "./isolatedPostgres.groupCheck.ts";
import { limitedProcessEnv } from "./limitedProcessEnv.ts";
import {
  ownServerState,
  processGroupMembers,
  readPgrp,
  runIsolatedPostgres,
  signalProcessGroup,
  stopOwnInstance,
  trackLeader,
} from "../../scripts/isolatedBillingPostgres.ts";

// WSL/Linux suite. Not part of test:auth. Exercises the isolated Postgres lifecycle.
assert.equal(process.platform, "linux", "STRIPE_SANDBOX_POSIX_REQUIRED");

const env = limitedProcessEnv(process.env);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function anyProcessIn(data: string): boolean {
  const target = path.resolve(data);
  for (const pid of fs.readdirSync("/proc")) {
    if (!/^\d+$/.test(pid)) continue;
    try {
      const cwd = fs.readlinkSync(`/proc/${pid}/cwd`);
      if (cwd === target || cwd.startsWith(`${target} (deleted)`)) return true;
    } catch {
      // The process can exit between readdir and readlink.
    }
  }
  return false;
}

function cleanupLeak(root: string) {
  if (!root || !fs.existsSync(root)) return;
  const data = path.join(root, "data");
  stopOwnInstance({ data, env });
  if (ownServerState(data, env) === "stopped") fs.rmSync(root, { recursive: true, force: true });
  if (fs.existsSync(root) || anyProcessIn(data)) {
    throw new Error(`ISOLATED_POSTGRES_TEST_LEAK path=${root}`);
  }
}

function subjectEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
  return { ...limitedProcessEnv(process.env), ...extra };
}

function makePidFile(): { dir: string; file: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "billing-customer-pids-"));
  return { dir, file: path.join(dir, "pids") };
}

async function waitForArmedPidFile(file: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (fs.existsSync(file) && fs.readFileSync(file, "utf8").includes("\"childPid\"")) return;
    await delay(20);
  }
  throw new Error("ISOLATED_POSTGRES_PID_FILE_TIMEOUT");
}

describe("isolated Postgres lifecycle", { concurrency: 1 }, () => {
  it("does not treat a failed spawn or a later error event as process exit", async () => {
    const missing = spawn("/nonexistent/isolated-postgres-test-bin", [], { detached: true, stdio: "ignore" });
    const missingLeader = trackLeader(missing);
    const missingDone = await Promise.race([
      missingLeader.done.then(() => "done" as const),
      delay(2_000).then(() => "timeout" as const),
    ]);
    assert.equal(missingDone, "done");
    assert.equal(missingLeader.spawnFailed, true);
    assert.equal(missingLeader.exited, false);

    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { detached: true, stdio: "ignore" });
    try {
      const tracker = trackLeader(child);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("SPAWN_TIMEOUT")), 2_000);
        child.once("spawn", () => {
          clearTimeout(timer);
          resolve();
        });
      });
      child.emit("error", Object.assign(new Error("later"), { code: "TEST_LATER" }));
      await delay(50);
      assert.equal(tracker.spawnFailed, false);
      assert.equal(tracker.exited, false);
      assert.equal(child.exitCode, null);
      const pgid = child.pid ?? 0;
      assert.equal(signalProcessGroup(pgid, "SIGKILL"), "signaled");
      await tracker.done;
      assert.equal(tracker.exited, true);
      assert.equal(tracker.spawnFailed, false);
      const members = processGroupMembers(pgid);
      assert.ok(members && members.length === 0);
    } finally {
      if (child.pid && child.exitCode === null) signalProcessGroup(child.pid, "SIGKILL");
    }
  });

  it("kills a SIGTERM-ignoring child after its group leader has exited", async () => {
    const leader = spawn(process.execPath, ["-e", `
      const { spawn } = require("child_process");
      const child = spawn(process.execPath, ["-e", "process.on('SIGTERM',()=>{}); process.on('SIGINT',()=>{}); setInterval(()=>{},500);"], { stdio: "ignore" });
      process.on("SIGTERM", () => process.exit(0));
      setTimeout(() => console.log("IDS " + process.pid + " " + child.pid), 50);
      setInterval(() => {}, 1000);
    `], { detached: true, stdio: ["ignore", "pipe", "ignore"] });
    try {
      const line = await new Promise<string>((resolve, reject) => {
        let buf = "";
        const timer = setTimeout(() => reject(new Error(`LEADER_READY_TIMEOUT ${buf}`)), 3_000);
        leader.stdout?.on("data", (chunk: Buffer) => {
          buf += chunk.toString("utf8");
          const found = buf.split("\n").find((entry) => entry.startsWith("IDS "));
          if (!found) return;
          clearTimeout(timer);
          resolve(found.trim());
        });
      });
      const [, leaderPid, childPid] = line.split(" ").map(Number);
      assert.equal(signalProcessGroup(leaderPid, "SIGTERM"), "signaled");
      const deadline = Date.now() + 2_000;
      while (Date.now() < deadline && (fs.existsSync(`/proc/${leaderPid}`) || !fs.existsSync(`/proc/${childPid}`))) {
        await delay(20);
      }
      assert.equal(fs.existsSync(`/proc/${leaderPid}`), false);
      assert.equal(fs.existsSync(`/proc/${childPid}`), true);
      const members = processGroupMembers(leaderPid);
      assert.ok(members && members.includes(childPid));
      assert.equal(signalProcessGroup(leaderPid, "SIGKILL"), "signaled");
      const gone = Date.now() + 2_000;
      while (Date.now() < gone && fs.existsSync(`/proc/${childPid}`)) await delay(20);
      assert.equal(fs.existsSync(`/proc/${childPid}`), false);
      const after = processGroupMembers(leaderPid);
      assert.ok(after && after.length === 0);
    } finally {
      if (leader.pid) signalProcessGroup(leader.pid, "SIGKILL");
    }
  });

  it("stops its own server and removes the directory when the test reaches the timeout", async () => {
    const messages: string[] = [];
    const original = console.error;
    console.error = (message?: unknown) => {
      messages.push(String(message));
      original(message);
    };
    let root = "";
    try {
      const result = await runIsolatedPostgres("lib/billing/isolatedPostgres.hang.test.ts", { timeoutMs: 800 });
      root = result.root;
      assert.equal(result.sawRunning, true);
      assert.equal(result.exitCode, 1);
      assert.equal(result.stopConfirmed, true);
      assert.equal(result.removed, true);
      assert.equal(result.testGroupStopped, true);
      assert.equal(fs.existsSync(result.root), false);
      assert.equal(anyProcessIn(result.data), false);
      assert.equal(messages.includes("ISOLATED_POSTGRES_TIMEOUT"), true);
    } finally {
      console.error = original;
      cleanupLeak(root);
    }
  });

  it("stops its own server and removes the directory when the parent receives SIGINT", async () => {
    const child: ChildProcess = spawn(process.execPath, [
      "--experimental-strip-types",
      "--import",
      "./lib/auth/registerRelativeTs.mjs",
      "scripts/isolated-postgres-signal-subject.ts",
    ], {
      env: subjectEnv({ ISOLATED_POSTGRES_TEST_TIMEOUT_MS: "20000" }),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let text = "";
    let root = "";
    const ready = new Promise<string>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill("SIGKILL");
        reject(new Error(`ISOLATED_POSTGRES_READY_TIMEOUT\n${text}`));
      }, 20_000);
      const take = (chunk: Buffer) => {
        text += chunk.toString("utf8");
        const match = text.match(/ISOLATED_POSTGRES_READY path=(\S+)/);
        if (!match || settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(match[1]);
      };
      child.stdout?.on("data", take);
      child.stderr?.on("data", take);
      child.once("exit", () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error(`ISOLATED_POSTGRES_EXIT_BEFORE_READY\n${text}`));
      });
    });
    try {
      root = await ready;
      const exitCode = await new Promise<number>((resolve, reject) => {
        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          reject(new Error(`ISOLATED_POSTGRES_INTERRUPT_TIMEOUT\n${text}`));
        }, 15_000);
        const finish = (code: number | null) => {
          clearTimeout(timer);
          setImmediate(() => resolve(code ?? 1));
        };
        if (child.exitCode !== null) {
          finish(child.exitCode);
          return;
        }
        child.once("exit", finish);
        child.kill("SIGINT");
      });
      assert.equal(exitCode, 1);
      assert.equal(text.includes("ISOLATED_POSTGRES_INTERRUPTED signal=SIGINT"), true);
      assert.equal(fs.existsSync(root), false);
      assert.equal(anyProcessIn(path.join(root, "data")), false);
    } finally {
      if (child.exitCode === null) child.kill("SIGKILL");
      cleanupLeak(root);
    }
  });

  it("stops the test process and its SIGTERM-ignoring child on timeout before removing Postgres", async () => {
    const pid = makePidFile();
    const messages: string[] = [];
    let observationError = "";
    let sawObservation = false;
    const original = console.error;
    console.error = (message?: unknown) => {
      const text = String(message ?? "");
      messages.push(text);
      if (text.startsWith("ISOLATED_POSTGRES_TEST_GROUP_STOPPED ")) {
        try {
          observeGroupStopped(text, pid.file, env);
          sawObservation = true;
        } catch (error) {
          observationError = error instanceof Error ? error.message : "OBSERVE_FAILED";
        }
      }
      original(message);
    };
    let root = "";
    try {
      const result = await runIsolatedPostgres("lib/billing/isolatedPostgres.ignoreTermChild.fixture.ts", {
        timeoutMs: 2_500,
        pidFile: pid.file,
      });
      root = result.root;
      assert.equal(observationError, "");
      assert.equal(sawObservation, true);
      assert.equal(result.sawRunning, true);
      assert.equal(result.testGroupStopped, true);
      assert.equal(result.exitCode, 1);
      assert.equal(result.stopConfirmed, true);
      assert.equal(result.removed, true);
      assert.equal(fs.existsSync(result.root), false);
      assert.equal(messages.includes("ISOLATED_POSTGRES_TIMEOUT"), true);
      const stoppedAt = messages.findIndex((message) => message.startsWith("ISOLATED_POSTGRES_TEST_GROUP_STOPPED "));
      const timeoutAt = messages.indexOf("ISOLATED_POSTGRES_TIMEOUT");
      assert.equal(stoppedAt >= 0 && timeoutAt > stoppedAt, true);
    } finally {
      console.error = original;
      killRecordedGroup(pid.file);
      cleanupLeak(root);
      fs.rmSync(pid.dir, { recursive: true, force: true });
    }
  });

  it("stops the test process and its SIGTERM-ignoring child on SIGINT before removing Postgres", async () => {
    const pid = makePidFile();
    const child: ChildProcess = spawn(process.execPath, [
      "--experimental-strip-types",
      "--import",
      "./lib/auth/registerRelativeTs.mjs",
      "scripts/isolated-postgres-signal-subject.ts",
    ], {
      env: subjectEnv({
        ISOLATED_POSTGRES_TEST_TIMEOUT_MS: "20000",
        ISOLATED_POSTGRES_TEST_FILE: "lib/billing/isolatedPostgres.ignoreTermChild.fixture.ts",
        ISOLATED_POSTGRES_PID_FILE: pid.file,
      }),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let text = "";
    let root = "";
    const ready = new Promise<string>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill("SIGKILL");
        reject(new Error(`ISOLATED_POSTGRES_READY_TIMEOUT\n${text}`));
      }, 20_000);
      const take = (chunk: Buffer) => {
        text += chunk.toString("utf8");
        const match = text.match(/ISOLATED_POSTGRES_READY path=(\S+)/);
        if (!match || settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(match[1]);
      };
      child.stdout?.on("data", take);
      child.stderr?.on("data", take);
      child.once("exit", () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error(`ISOLATED_POSTGRES_EXIT_BEFORE_READY\n${text}`));
      });
    });
    try {
      root = await ready;
      await waitForArmedPidFile(pid.file);
      const exitCode = await new Promise<number>((resolve, reject) => {
        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          reject(new Error(`ISOLATED_POSTGRES_INTERRUPT_TIMEOUT\n${text}`));
        }, 15_000);
        const finish = (code: number | null) => {
          clearTimeout(timer);
          setImmediate(() => resolve(code ?? 1));
        };
        if (child.exitCode !== null) {
          finish(child.exitCode);
          return;
        }
        child.once("exit", finish);
        child.kill("SIGINT");
      });
      assert.equal(exitCode, 1);
      assert.equal(text.includes("ISOLATED_POSTGRES_GROUP_OBSERVED ok"), true);
      assert.equal(text.includes("ISOLATED_POSTGRES_GROUP_OBSERVED failed"), false);
      assert.equal(text.includes("ISOLATED_POSTGRES_INTERRUPTED signal=SIGINT"), true);
      assert.equal(fs.existsSync(root), false);
      const recorded = JSON.parse(fs.readFileSync(pid.file, "utf8").split("\n")[0] || "") as { parentPid: number; childPid: number };
      assert.equal(fs.existsSync(`/proc/${recorded.parentPid}`), false);
      assert.equal(fs.existsSync(`/proc/${recorded.childPid}`), false);
      assert.equal(fs.readFileSync(pid.file, "utf8").includes("GOT_SIGTERM"), true);
    } finally {
      if (child.exitCode === null) child.kill("SIGKILL");
      killRecordedGroup(pid.file);
      cleanupLeak(root);
      fs.rmSync(pid.dir, { recursive: true, force: true });
    }
  });

  it("keeps the directory when its own server cannot be confirmed stopped", async () => {
    const messages: string[] = [];
    const original = console.error;
    console.error = (message?: unknown) => {
      messages.push(String(message));
      original(message);
    };
    let root = "";
    try {
      const result = await runIsolatedPostgres("lib/billing/isolatedPostgres.hang.test.ts", {
        timeoutMs: 500,
        stopCommand: process.execPath,
        stopArgs: ["-e", "process.exit(1)"],
      });
      root = result.root;
      assert.equal(result.sawRunning, true);
      assert.equal(result.stopConfirmed, false);
      assert.equal(result.removed, false);
      assert.equal(result.exitCode, 1);
      assert.equal(fs.existsSync(result.root), true);
      assert.equal(ownServerState(result.data, env), "running");
      assert.equal(anyProcessIn(result.data), true);
      assert.equal(messages.some((message) => message.includes(`ISOLATED_POSTGRES_STOP_UNCONFIRMED path=${result.root}`)), true);
    } finally {
      console.error = original;
      cleanupLeak(root);
    }
  });

  it("keeps the directory when the test process group cannot be confirmed stopped", async () => {
    const pid = makePidFile();
    const messages: string[] = [];
    const original = console.error;
    console.error = (message?: unknown) => {
      messages.push(String(message));
      original(message);
    };
    let root = "";
    try {
      const result = await runIsolatedPostgres("lib/billing/isolatedPostgres.ignoreTermChild.fixture.ts", {
        timeoutMs: 1_500,
        pidFile: pid.file,
        groupTermGraceMs: 100,
        groupKillGraceMs: 100,
        signalGroup: () => undefined,
      });
      root = result.root;
      await waitForArmedPidFile(pid.file);
      const recorded = JSON.parse(fs.readFileSync(pid.file, "utf8").split("\n")[0] || "") as { childPid: number };
      assert.equal(result.exitCode, 2);
      assert.equal(result.testGroupStopped, false);
      assert.equal(result.stopConfirmed, false);
      assert.equal(result.removed, false);
      assert.equal(fs.existsSync(result.root), true);
      assert.equal(ownServerState(result.data, env), "running");
      assert.equal(fs.existsSync(`/proc/${recorded.childPid}`), true);
      assert.equal(messages.some((message) => message.includes(`ISOLATED_POSTGRES_TEST_GROUP_UNCONFIRMED path=${result.root}`)), true);
    } finally {
      console.error = original;
      const match = messages.join("\n").match(/ISOLATED_POSTGRES_TEST_GROUP_UNCONFIRMED path=\S+ pgid=(\d+)/);
      const logged = match ? Number(match[1]) : 0;
      const own = readPgrp(process.pid);
      if (logged > 1 && logged !== own) signalProcessGroup(logged, "SIGKILL");
      killRecordedGroup(pid.file);
      cleanupLeak(root);
      fs.rmSync(pid.dir, { recursive: true, force: true });
    }
  });

  it("stops a server that remains up after pg_ctl start reports failure", async () => {
    let root = "";
    try {
      const result = await runIsolatedPostgres("lib/billing/isolatedPostgres.hang.test.ts", {
        startCommand: process.execPath,
        startArgsPrefix: ["scripts/pgCtlStartFailAfterUp.mjs"],
      });
      root = result.root;
      assert.equal(result.sawRunning, true);
      assert.equal(result.exitCode, 1);
      assert.equal(result.stopConfirmed, true);
      assert.equal(result.removed, true);
      assert.equal(fs.existsSync(result.root), false);
      assert.equal(anyProcessIn(result.data), false);
    } finally {
      cleanupLeak(root);
    }
  });
});
