import fs from "node:fs";
import path from "node:path";
import { ownServerState, processGroupMembers, readPgrp, readPostmasterPid } from "../../scripts/isolatedBillingPostgres";

type RecordedGroup = {
  parentPid: number;
  parentPgrp: number;
  childPid: number;
  childPgrp: number;
};

function recordedGroup(pidFile: string): RecordedGroup {
  const text = fs.readFileSync(pidFile, "utf8");
  if (!text.includes("GOT_SIGTERM")) throw new Error("ISOLATED_POSTGRES_GROUP_OBSERVE_SIGNAL");
  const parsed: unknown = JSON.parse(text.split("\n")[0] || "");
  if (!parsed || typeof parsed !== "object") throw new Error("ISOLATED_POSTGRES_GROUP_OBSERVE_FILE");
  const record = parsed as Partial<RecordedGroup>;
  for (const key of ["parentPid", "parentPgrp", "childPid", "childPgrp"] as const) {
    const value = record[key];
    if (typeof value !== "number" || !Number.isInteger(value) || value <= 1) {
      throw new Error("ISOLATED_POSTGRES_GROUP_OBSERVE_FILE");
    }
  }
  return record as RecordedGroup;
}

export function observeGroupStopped(message: string, pidFile: string, env: NodeJS.ProcessEnv): void {
  const match = /^ISOLATED_POSTGRES_TEST_GROUP_STOPPED path=(\S+) pgid=(\d+)$/.exec(message);
  if (!match) throw new Error("ISOLATED_POSTGRES_GROUP_OBSERVE_MARKER");
  const root = match[1];
  const pgid = Number(match[2]);
  const recorded = recordedGroup(pidFile);
  const observerPgrp = readPgrp(process.pid);
  if (
    recorded.parentPgrp !== pgid ||
    recorded.childPgrp !== pgid ||
    recorded.parentPid === recorded.childPid ||
    observerPgrp === null ||
    observerPgrp === pgid
  ) {
    throw new Error("ISOLATED_POSTGRES_GROUP_OBSERVE_PGRP");
  }
  if (fs.existsSync(`/proc/${recorded.parentPid}`) || fs.existsSync(`/proc/${recorded.childPid}`)) {
    throw new Error("ISOLATED_POSTGRES_GROUP_OBSERVE_PID");
  }
  const members = processGroupMembers(pgid);
  if (!members || members.length !== 0) throw new Error("ISOLATED_POSTGRES_GROUP_OBSERVE_MEMBER");
  const data = path.join(root, "data");
  if (!fs.existsSync(data) || ownServerState(data, env) !== "running") {
    throw new Error("ISOLATED_POSTGRES_GROUP_OBSERVE_SERVER");
  }
  const serverPid = readPostmasterPid(data);
  if (serverPid === null || readPgrp(serverPid) === pgid) {
    throw new Error("ISOLATED_POSTGRES_GROUP_OBSERVE_POSTMASTER");
  }
}

export function killRecordedGroup(pidFile: string): void {
  if (!pidFile || !fs.existsSync(pidFile)) return;
  let pgid = 0;
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(pidFile, "utf8").split("\n")[0] || "");
    const value = parsed && typeof parsed === "object" ? (parsed as { parentPgrp?: unknown }).parentPgrp : 0;
    pgid = typeof value === "number" ? value : 0;
  } catch {
    return;
  }
  const own = readPgrp(process.pid);
  if (!Number.isInteger(pgid) || pgid <= 1 || own === null || own === pgid) return;
  try {
    process.kill(-pgid, "SIGKILL");
  } catch {
    // The group is already gone.
  }
}
