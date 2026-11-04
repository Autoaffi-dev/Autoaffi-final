import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { limitedProcessEnv } from "../lib/billing/limitedProcessEnv";

const binDir = "/usr/lib/postgresql/16/bin";
const initdb = path.join(binDir, "initdb");
const pgCtl = path.join(binDir, "pg_ctl");
const port = "54329";
const groupTermGraceMsDefault = 2_000;
const groupKillGraceMsDefault = 2_000;
const groupPollMs = 20;

// SIGINT and SIGTERM are caught so this parent can stop its own test group and server.
// SIGKILL and a power loss skip the process; nothing here runs after those.

export type IsolatedPostgresOptions = {
  extraEnv?: { STRIPE_SANDBOX_SECRET_KEY?: string };
  timeoutMs?: number;
  stopCommand?: string;
  stopArgs?: string[];
  startCommand?: string;
  startArgsPrefix?: string[];
  pidFile?: string;
  groupTermGraceMs?: number;
  groupKillGraceMs?: number;
  signalGroup?: (pgid: number, signal: NodeJS.Signals) => void;
};

export type IsolatedPostgresResult = {
  root: string;
  data: string;
  exitCode: number;
  removed: boolean;
  stopConfirmed: boolean;
  sawRunning: boolean;
  testGroupStopped: boolean;
};

export type LeaderTracker = {
  sawSpawn: boolean;
  spawnFailed: boolean;
  exited: boolean;
  exitCode: number;
  done: Promise<void>;
};

export function pgrpFromStat(stat: string): number | null {
  const end = stat.lastIndexOf(")");
  if (end < 0) return null;
  const field = stat.slice(end + 2).split(" ")[2];
  if (!field || !/^\d+$/.test(field)) return null;
  const value = Number(field);
  return value > 1 ? value : null;
}

export function readPgrp(pid: number): number | null {
  if (!Number.isInteger(pid) || pid <= 1) return null;
  try {
    return pgrpFromStat(fs.readFileSync(`/proc/${pid}/stat`, "utf8"));
  } catch {
    return null;
  }
}

export function readPostmasterPid(data: string): number | null {
  try {
    const line = fs.readFileSync(path.join(data, "postmaster.pid"), "utf8").split("\n")[0] || "";
    if (!/^\d+$/.test(line)) return null;
    const pid = Number(line);
    return pid > 1 ? pid : null;
  } catch {
    return null;
  }
}

// null means /proc could not be listed, which is not an empty group.
export function processGroupMembers(pgid: number): number[] | null {
  if (!Number.isInteger(pgid) || pgid <= 1) return null;
  let entries: string[];
  try {
    entries = fs.readdirSync("/proc");
  } catch {
    return null;
  }
  const members: number[] = [];
  for (const entry of entries) {
    if (!/^\d+$/.test(entry)) continue;
    const pid = Number(entry);
    if (pid <= 1) continue;
    if (readPgrp(pid) === pgid) members.push(pid);
  }
  return members;
}

export function signalProcessGroup(pgid: number, signal: NodeJS.Signals): "signaled" | "missing" | "rejected" {
  if (!Number.isInteger(pgid) || pgid <= 1) return "rejected";
  try {
    process.kill(-pgid, signal);
    return "signaled";
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String((error as { code?: string }).code) : "UNKNOWN";
    if (code === "ESRCH") return "missing";
    console.error(`ISOLATED_POSTGRES_GROUP_SIGNAL_FAILED signal=${signal} code=${code}`);
    return "rejected";
  }
}

export function trackLeader(child: ChildProcess): LeaderTracker {
  const tracker: LeaderTracker = {
    sawSpawn: false,
    spawnFailed: false,
    exited: false,
    exitCode: 1,
    done: Promise.resolve(),
  };
  tracker.done = new Promise((resolve) => {
    child.once("spawn", () => {
      tracker.sawSpawn = true;
    });
    child.once("error", () => {
      if (!tracker.sawSpawn) {
        tracker.spawnFailed = true;
        resolve();
      }
    });
    child.once("exit", (code) => {
      tracker.exited = true;
      tracker.exitCode = code ?? 1;
      resolve();
    });
  });
  return tracker;
}

export function ownServerState(data: string, env: NodeJS.ProcessEnv): "running" | "stopped" | "unknown" {
  if (!data || !fs.existsSync(data)) return "stopped";
  const pidFile = path.join(data, "postmaster.pid");
  if (fs.existsSync(pidFile)) {
    let recorded = "";
    try {
      recorded = fs.readFileSync(pidFile, "utf8").split("\n")[1] || "";
    } catch {
      return "unknown";
    }
    if (path.resolve(recorded) !== path.resolve(data)) return "unknown";
  }
  const status = spawnSync(pgCtl, ["-D", data, "status"], { encoding: "utf8", env, timeout: 5_000 });
  if (status.error || status.status === null) return "unknown";
  if (status.status === 0) return "running";
  if (status.status === 3) return "stopped";
  return "unknown";
}

export function stopOwnInstance(input: {
  data: string;
  env: NodeJS.ProcessEnv;
  stopCommand?: string;
  stopArgs?: string[];
}): boolean {
  const before = ownServerState(input.data, input.env);
  if (before === "stopped") return true;
  if (before === "unknown") return false;
  const stop = input.stopCommand
    ? spawnSync(input.stopCommand, input.stopArgs ?? [], { encoding: "utf8", env: input.env, timeout: 5_000 })
    : spawnSync(pgCtl, ["-D", input.data, "-m", "immediate", "-w", "-t", "10", "stop"], {
        encoding: "utf8",
        env: input.env,
        timeout: 15_000,
      });
  if (stop.error) return ownServerState(input.data, input.env) === "stopped";
  return ownServerState(input.data, input.env) === "stopped";
}

function removeOwnRoot(root: string): boolean {
  if (!root.includes(`${path.sep}billing-customer-pg-`)) return false;
  fs.rmSync(root, { recursive: true, force: true });
  return !fs.existsSync(root);
}

function boundedGrace(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 50 || value > 5_000) return fallback;
  return value;
}

function acceptedPidFile(pidFile: string, root: string): string {
  if (!path.isAbsolute(pidFile) || /[\0\r\n]/.test(pidFile)) return "";
  const resolved = path.resolve(pidFile);
  const resolvedRoot = path.resolve(root);
  if (resolved === resolvedRoot || resolved.startsWith(`${resolvedRoot}${path.sep}`)) return "";
  return resolved;
}

function groupIsEmpty(pgid: number): boolean {
  const members = processGroupMembers(pgid);
  return !!members && members.length === 0;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runIsolatedPostgres(
  testRelativePath: string,
  options: IsolatedPostgresOptions = {}
): Promise<IsolatedPostgresResult> {
  const baseEnv = limitedProcessEnv(process.env);
  const empty = (): IsolatedPostgresResult => ({
    root: "",
    data: "",
    exitCode: 1,
    removed: false,
    stopConfirmed: false,
    sawRunning: false,
    testGroupStopped: false,
  });
  if (!fs.existsSync(initdb) || !fs.existsSync(pgCtl) || !fs.existsSync("/usr/bin/psql") || !fs.existsSync("/usr/bin/stdbuf")) {
    console.error("ISOLATED_POSTGRES_BINARIES_MISSING");
    return empty();
  }

  let stripeKey = "";
  if (options.extraEnv?.STRIPE_SANDBOX_SECRET_KEY !== undefined) {
    if (!/^sk_test_[A-Za-z0-9]+$/.test(options.extraEnv.STRIPE_SANDBOX_SECRET_KEY)) {
      console.error("STRIPE_SANDBOX_KEY_REJECTED");
      return empty();
    }
    stripeKey = options.extraEnv.STRIPE_SANDBOX_SECRET_KEY;
  }

  const timeoutMs = options.timeoutMs ?? (stripeKey ? 120_000 : undefined);
  const termGrace = boundedGrace(options.groupTermGraceMs, groupTermGraceMsDefault);
  const killGrace = boundedGrace(options.groupKillGraceMs, groupKillGraceMsDefault);
  let root = "";
  let data = "";
  let exitCode = 0;
  let sawRunning = false;
  let startAttempted = false;
  let testSpawned = false;
  let testGroupStopped = false;
  let groupUnconfirmed = false;
  let reportedUnconfirmed = false;
  let groupClosed = false;
  let groupStopStarted = false;
  let groupStopStartedAt = 0;
  let pgid = 0;
  let interrupted: NodeJS.Signals | null = null;
  let timedOut = false;
  let escalationTimer: NodeJS.Timeout | undefined;
  let timeoutTimer: NodeJS.Timeout | undefined;

  const safeToSignal = (target: number): boolean => {
    if (!Number.isInteger(target) || target <= 1) return false;
    const own = readPgrp(process.pid);
    if (own === null || own === target) return false;
    const members = processGroupMembers(target);
    if (!members || members.includes(process.pid)) return false;
    const serverPid = readPostmasterPid(data);
    if (serverPid !== null && (members.includes(serverPid) || readPgrp(serverPid) === target)) return false;
    return true;
  };
  const deliverGroupSignal = (target: number, signal: NodeJS.Signals): void => {
    if (!safeToSignal(target)) {
      console.error(`ISOLATED_POSTGRES_GROUP_SIGNAL_REJECTED signal=${signal}`);
      return;
    }
    if (options.signalGroup) {
      try {
        options.signalGroup(target, signal);
      } catch {
        console.error(`ISOLATED_POSTGRES_GROUP_SIGNAL_FAILED signal=${signal} code=HOOK`);
      }
      return;
    }
    signalProcessGroup(target, signal);
  };
  const beginGroupStop = () => {
    if (groupClosed || groupStopStarted || !pgid) return;
    groupStopStarted = true;
    groupStopStartedAt = Date.now();
    deliverGroupSignal(pgid, "SIGTERM");
    escalationTimer = setTimeout(() => {
      if (groupClosed) return;
      deliverGroupSignal(pgid, "SIGKILL");
    }, termGrace);
  };
  const markGroupUnconfirmed = () => {
    groupUnconfirmed = true;
    testGroupStopped = false;
    exitCode = 2;
    if (reportedUnconfirmed || !root) return;
    reportedUnconfirmed = true;
    console.error(`ISOLATED_POSTGRES_TEST_GROUP_UNCONFIRMED path=${root} pgid=${pgid}`);
  };
  const ensureGroupStopped = async (): Promise<boolean> => {
    if (!pgid) return false;
    if (groupIsEmpty(pgid)) {
      groupClosed = true;
      if (escalationTimer) clearTimeout(escalationTimer);
      return true;
    }
    beginGroupStop();
    const termDeadline = Date.now() + termGrace;
    while (Date.now() < termDeadline) {
      if (groupIsEmpty(pgid)) {
        groupClosed = true;
        if (escalationTimer) clearTimeout(escalationTimer);
        return true;
      }
      await delay(groupPollMs);
    }
    if (!groupClosed) deliverGroupSignal(pgid, "SIGKILL");
    const killDeadline = Date.now() + killGrace;
    while (Date.now() < killDeadline) {
      if (groupIsEmpty(pgid)) {
        groupClosed = true;
        if (escalationTimer) clearTimeout(escalationTimer);
        return true;
      }
      await delay(groupPollMs);
    }
    if (!groupIsEmpty(pgid)) return false;
    groupClosed = true;
    if (escalationTimer) clearTimeout(escalationTimer);
    return true;
  };
  const onSigint = () => {
    interrupted = interrupted ?? "SIGINT";
    beginGroupStop();
  };
  const onSigterm = () => {
    interrupted = interrupted ?? "SIGTERM";
    beginGroupStop();
  };
  process.on("SIGINT", onSigint);
  process.on("SIGTERM", onSigterm);

  try {
    try {
      root = fs.mkdtempSync(path.join(os.tmpdir(), "billing-customer-pg-"));
      data = path.join(root, "data");
      const sock = path.join(root, "sock");
      if (!root.includes(`${path.sep}billing-customer-pg-`)) {
        console.error("ISOLATED_POSTGRES_PATH_REJECTED");
        exitCode = 1;
      } else {
        fs.mkdirSync(sock, { mode: 0o700 });
        fs.chmodSync(root, 0o700);
        const initialized = spawnSync(
          initdb,
          ["-D", data, "--username=billing_customer_test", "--auth-local=trust", "--auth-host=reject", "--no-sync", "--encoding=UTF8", "--locale=C"],
          { encoding: "utf8", env: baseEnv, timeout: 30_000 }
        );
        await Promise.resolve();
        if (initialized.status !== 0) {
          console.error(`ISOLATED_POSTGRES_INIT_FAILED\n${initialized.stderr || initialized.stdout || ""}`);
          exitCode = 1;
        } else if (interrupted) {
          exitCode = 1;
        } else {
          startAttempted = true;
          const startArgs = ["-D", data, "-l", path.join(root, "server.log"), "-o", `-c listen_addresses= -c unix_socket_directories=${sock} -c port=${port}`, "-w", "-t", "30", "start"];
          const startEnv = options.startCommand ? { ...baseEnv, ISOLATED_POSTGRES_PG_CTL: pgCtl } : baseEnv;
          const startedResult = spawnSync(
            options.startCommand ?? pgCtl,
            options.startArgsPrefix ? [...options.startArgsPrefix, ...startArgs] : startArgs,
            { encoding: "utf8", env: startEnv, timeout: 40_000 }
          );
          await Promise.resolve();
          const state = ownServerState(data, baseEnv);
          if (state === "running") sawRunning = true;
          if (interrupted) {
            exitCode = 1;
          } else if (startedResult.status !== 0 || state !== "running") {
            console.error("ISOLATED_POSTGRES_START_FAILED");
            exitCode = 1;
          } else {
            let pidFile = "";
            if (options.pidFile !== undefined) {
              pidFile = acceptedPidFile(options.pidFile, root);
              if (!pidFile) {
                console.error("ISOLATED_POSTGRES_PID_FILE_REJECTED");
                exitCode = 1;
              }
            }
            if (options.pidFile !== undefined && !pidFile) {
              exitCode = 1;
            } else {
              const childEnv: NodeJS.ProcessEnv = {
                ...baseEnv,
                BILLING_CUSTOMER_PGROOT: root,
                BILLING_CUSTOMER_PGHOST: sock,
                BILLING_CUSTOMER_PGPORT: port,
                BILLING_CUSTOMER_PGUSER: "billing_customer_test",
                BILLING_CUSTOMER_PGDATA: data,
              };
              if (stripeKey) childEnv.STRIPE_SANDBOX_SECRET_KEY = stripeKey;
              if (pidFile) childEnv.ISOLATED_POSTGRES_PID_FILE = pidFile;
              const child = spawn(
                process.execPath,
                ["--experimental-strip-types", "--import", "./lib/auth/registerRelativeTs.mjs", "--test", testRelativePath],
                { detached: true, stdio: "inherit", env: childEnv }
              );
              const leader = trackLeader(child);
              pgid = child.pid ?? 0;
              if (!pgid) {
                await leader.done;
                console.error("ISOLATED_POSTGRES_TEST_SPAWN_FAILED");
                exitCode = 1;
              } else {
                testSpawned = true;
                if (!readPgrp(pgid)) {
                  await Promise.race([
                    new Promise<void>((resolve) => child.once("spawn", () => resolve())),
                    leader.done,
                  ]);
                }
                const leaderPgrp = readPgrp(pgid);
                const ownPgrp = readPgrp(process.pid);
                const serverPid = readPostmasterPid(data);
                const serverPgrp = serverPid === null ? null : readPgrp(serverPid);
                const separateGroup = leaderPgrp === pgid && ownPgrp !== null && ownPgrp !== pgid && serverPgrp !== pgid;
                if (leader.spawnFailed || !separateGroup) {
                  if (!separateGroup && !leader.spawnFailed) {
                    console.error("ISOLATED_POSTGRES_TEST_GROUP_REJECTED");
                    markGroupUnconfirmed();
                  } else {
                    console.error("ISOLATED_POSTGRES_TEST_SPAWN_FAILED");
                    exitCode = 1;
                    testSpawned = false;
                  }
                } else {
                  if (timeoutMs !== undefined) {
                    timeoutTimer = setTimeout(() => {
                      timedOut = true;
                      beginGroupStop();
                    }, timeoutMs);
                  }
                  console.error(`ISOLATED_POSTGRES_READY path=${root}`);
                  while (!leader.exited && !leader.spawnFailed) {
                    const stopDeadline = groupStopStarted ? groupStopStartedAt + termGrace + killGrace : Number.POSITIVE_INFINITY;
                    if (Date.now() >= stopDeadline) break;
                    await delay(groupPollMs);
                  }
                  if (timeoutTimer) clearTimeout(timeoutTimer);
                  if (leader.spawnFailed) {
                    console.error("ISOLATED_POSTGRES_TEST_SPAWN_FAILED");
                    exitCode = 1;
                    testSpawned = false;
                  } else if (!(await ensureGroupStopped())) {
                    markGroupUnconfirmed();
                  } else {
                    testGroupStopped = true;
                    console.error(`ISOLATED_POSTGRES_TEST_GROUP_STOPPED path=${root} pgid=${pgid}`);
                    if (timedOut) {
                      console.error(stripeKey ? "STRIPE_SANDBOX_TIMEOUT" : "ISOLATED_POSTGRES_TIMEOUT");
                      exitCode = 1;
                    } else if (interrupted) {
                      exitCode = 1;
                    } else {
                      exitCode = leader.exitCode === 0 ? 0 : leader.exitCode || 1;
                    }
                  }
                }
              }
            }
          }
        }
      }
    } catch {
      exitCode = 1;
      console.error("ISOLATED_POSTGRES_FAILED");
      if (testSpawned && !testGroupStopped) markGroupUnconfirmed();
    }

    if (interrupted) console.error(`ISOLATED_POSTGRES_INTERRUPTED signal=${interrupted}`);

    let removed = false;
    let stopConfirmed = false;
    if (!root) return { root, data, exitCode: 1, removed, stopConfirmed, sawRunning, testGroupStopped: false };
    if (groupUnconfirmed) {
      return { root, data, exitCode: 2, removed: false, stopConfirmed: false, sawRunning, testGroupStopped: false };
    }

    if (!startAttempted) {
      removed = removeOwnRoot(root);
      stopConfirmed = removed;
      if (!removed) {
        console.error(`ISOLATED_POSTGRES_STOP_UNCONFIRMED path=${root}`);
        exitCode = 1;
      }
      return { root, data, exitCode, removed, stopConfirmed, sawRunning, testGroupStopped };
    }

    const state = ownServerState(data, baseEnv);
    if (state === "running") sawRunning = true;
    if (state === "running" || state === "unknown") {
      const stopped = state === "running" && stopOwnInstance({
        data,
        env: baseEnv,
        stopCommand: options.stopCommand,
        stopArgs: options.stopArgs,
      });
      if (stopped && ownServerState(data, baseEnv) === "stopped") {
        stopConfirmed = true;
        removed = removeOwnRoot(root);
        if (!removed) exitCode = 1;
      } else {
        stopConfirmed = false;
        removed = false;
        exitCode = 1;
        console.error(`ISOLATED_POSTGRES_STOP_UNCONFIRMED path=${root}`);
      }
      return { root, data, exitCode, removed, stopConfirmed, sawRunning, testGroupStopped };
    }

    stopConfirmed = true;
    removed = removeOwnRoot(root);
    if (!removed) {
      exitCode = 1;
      console.error(`ISOLATED_POSTGRES_STOP_UNCONFIRMED path=${root}`);
    }
    return { root, data, exitCode, removed, stopConfirmed, sawRunning, testGroupStopped };
  } finally {
    if (timeoutTimer) clearTimeout(timeoutTimer);
    if (escalationTimer) clearTimeout(escalationTimer);
    process.off("SIGINT", onSigint);
    process.off("SIGTERM", onSigterm);
  }
}
