import fs from "node:fs";
import path from "node:path";
import type { StripeCustomerClient } from "./billingCustomer.ts";

const DETAIL_FIELDS = ["operation", "timeoutMs", "cleanupCode", "envName", "httpStatus", "stripeCode"] as const;

export type SandboxDetails = {
  operation?: string;
  timeoutMs?: number;
  cleanupCode?: string;
  envName?: string;
  httpStatus?: number;
  stripeCode?: string;
};

export class SandboxError extends Error {
  readonly code: string;
  readonly details: SandboxDetails;

  constructor(code: string, details: Record<string, unknown> = {}) {
    super(code);
    this.name = "SandboxError";
    this.code = code;
    this.details = {};
    for (const field of DETAIL_FIELDS) {
      const accepted = acceptDetail(field, details[field]);
      if (accepted !== undefined) this.details[field] = accepted as never;
    }
  }
}

function acceptDetail(field: (typeof DETAIL_FIELDS)[number], value: unknown): string | number | undefined {
  if (field === "timeoutMs" || field === "httpStatus") {
    if (typeof value !== "number" || !Number.isInteger(value)) return undefined;
    if (field === "httpStatus" && (value < 100 || value > 599)) return undefined;
    if (field === "timeoutMs" && (value < 1 || value > 60_000)) return undefined;
    return value;
  }
  if (typeof value !== "string") return undefined;
  if (field === "operation" && /^[a-z][a-z.]{0,40}$/.test(value)) return value;
  if (field === "stripeCode" && /^[a-z0-9_]{1,64}$/.test(value)) return value;
  if ((field === "cleanupCode" || field === "envName") && /^[A-Z][A-Z0-9_]{0,64}$/.test(value)) return value;
  return undefined;
}

const STRIPE_TYPE_CODES: Record<string, string> = {
  StripeConnectionError: "STRIPE_SANDBOX_CONNECTION_FAILED",
  StripeConnectionTimeoutError: "STRIPE_SANDBOX_TIMEOUT",
  StripeAuthenticationError: "STRIPE_SANDBOX_AUTH_FAILED",
  StripePermissionError: "STRIPE_SANDBOX_AUTH_FAILED",
  StripeRateLimitError: "STRIPE_SANDBOX_RATE_LIMIT",
  StripeIdempotencyError: "STRIPE_SANDBOX_IDEMPOTENCY",
  StripeInvalidRequestError: "STRIPE_SANDBOX_REQUEST_FAILED",
  StripeAPIError: "STRIPE_SANDBOX_REQUEST_FAILED",
};

export function toSandboxError(err: unknown, operation: string): SandboxError {
  if (err instanceof SandboxError) return err;
  const record = typeof err === "object" && err !== null ? (err as Record<string, unknown>) : {};
  const type = typeof record.type === "string" ? record.type : "";
  return new SandboxError(STRIPE_TYPE_CODES[type] ?? "STRIPE_SANDBOX_REQUEST_FAILED", {
    operation,
    stripeCode: record.code,
    httpStatus: record.statusCode,
  });
}

export function withTimeout<T>(work: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new SandboxError("STRIPE_SANDBOX_TIMEOUT", { operation, timeoutMs }));
    }, timeoutMs);
    work.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(toSandboxError(err, operation));
      }
    );
  });
}

export type CaptureBag = {
  ids: string[];
  inflight: Promise<void>[];
  pending: number;
  onReady?: (id: string) => void;
};

export function createCaptureBag(): CaptureBag {
  return { ids: [], inflight: [], pending: 0 };
}

// The id is recorded on the underlying create promise, before withTimeout can
// discard a late resolution. A customer can still remain when Stripe created it
// and no response ever reaches this process; that case is reported as
// STRIPE_SANDBOX_CREATE_UNSEEN and has no id to delete.
export function captureCustomerCreate(
  create: StripeCustomerClient["customers"]["create"],
  bag: CaptureBag,
  timeoutMs = 15_000
): StripeCustomerClient["customers"]["create"] {
  return async (params, options) => {
    bag.pending += 1;
    let markSettled = () => undefined;
    const settled = new Promise<void>((resolve) => {
      markSettled = () => {
        bag.pending -= 1;
        resolve();
      };
    });
    bag.inflight.push(settled);
    let pending: Promise<{ id: string }>;
    try {
      pending = create(params, options).then(
        (created) => {
          try {
            if (!/^cus_[A-Za-z0-9]+$/.test(created.id)) {
              throw new SandboxError("STRIPE_SANDBOX_CREATE_FAILED", { operation: "customers.create" });
            }
            if (!bag.ids.includes(created.id)) bag.ids.push(created.id);
            bag.onReady?.(created.id);
            return { id: created.id };
          } finally {
            markSettled();
          }
        },
        (err: unknown) => {
          markSettled();
          throw err;
        }
      );
    } catch (err) {
      markSettled();
      throw err;
    }
    return withTimeout(pending, timeoutMs, "customers.create");
  };
}

export type CleanupCustomer = {
  id?: string;
  livemode?: boolean;
  deleted?: boolean;
  metadata?: { user_id?: string } | null;
};

export function cleanupDecision(customer: CleanupCustomer, expected: { id: string; userId: string }): "delete" {
  if (customer.deleted === true) {
    throw new SandboxError("STRIPE_SANDBOX_CLEANUP_DELETED", { operation: "customers.del" });
  }
  if (customer.id !== expected.id) {
    throw new SandboxError("STRIPE_SANDBOX_CLEANUP_ID_MISMATCH", { operation: "customers.retrieve" });
  }
  if (customer.livemode !== false) {
    throw new SandboxError("STRIPE_SANDBOX_CLEANUP_LIVEMODE", { operation: "customers.del" });
  }
  if (customer.metadata?.user_id !== expected.userId) {
    throw new SandboxError("STRIPE_SANDBOX_CLEANUP_USER_MISMATCH", { operation: "customers.del" });
  }
  return "delete";
}

function safeCode(err: unknown): string | null {
  if (err instanceof SandboxError && /^[A-Z][A-Z0-9_]{0,64}$/.test(err.code)) return err.code;
  if (err instanceof Error && /^[A-Z][A-Z0-9_]{0,64}$/.test(err.message)) return err.message;
  return null;
}

function preserveFailure(original: unknown, cleanup: unknown): SandboxError {
  const code = safeCode(original) ?? "STRIPE_SANDBOX_FAILED";
  const cleanupCode = safeCode(cleanup) ?? "STRIPE_SANDBOX_CLEANUP_FAILED";
  const details = original instanceof SandboxError ? { ...original.details } : {};
  return new SandboxError(code, { ...details, cleanupCode });
}

export async function withCapturedCustomers<T>(input: {
  capture: CaptureBag;
  cleanup: (customerId: string) => Promise<void>;
  graceMs?: number;
  run: () => Promise<T>;
}): Promise<T> {
  let failure: unknown = null;
  let result: T | undefined;
  let closed = false;
  const attempted = new Set<string>();
  const cleanupFailures: unknown[] = [];
  let lateTail: Promise<void> = Promise.resolve();

  const cleanOne = async (id: string) => {
    if (attempted.has(id)) return;
    attempted.add(id);
    try {
      await input.cleanup(id);
    } catch (err) {
      cleanupFailures.push(err);
      console.error(`leftover_stripe_customer=${id}`);
    }
  };

  const drain = async () => {
    for (;;) {
      const next = input.capture.ids.filter((id) => !attempted.has(id));
      if (next.length === 0) return;
      for (const id of next) await cleanOne(id);
    }
  };

  input.capture.onReady = (id: string) => {
    if (!closed) return;
    lateTail = lateTail.then(() => cleanOne(id));
  };

  try {
    result = await input.run();
  } catch (err) {
    failure = err;
  }

  if (input.capture.pending > 0) {
    await withTimeout(Promise.all(input.capture.inflight), input.graceMs ?? 15_000, "customers.create").catch(() => undefined);
  }
  if (input.capture.pending > 0) console.error("STRIPE_SANDBOX_CREATE_UNSEEN");
  await drain();
  closed = true;
  await drain();
  for (;;) {
    const current = lateTail;
    await current;
    if (current === lateTail) break;
  }

  if (failure && cleanupFailures.length > 0) throw preserveFailure(failure, cleanupFailures[0]);
  if (failure) {
    const code = safeCode(failure);
    if (code && !(failure instanceof SandboxError)) throw new SandboxError(code);
    if (failure instanceof SandboxError) throw failure;
    throw new SandboxError("STRIPE_SANDBOX_FAILED", { operation: "sandbox" });
  }
  if (cleanupFailures.length > 0) {
    const code = safeCode(cleanupFailures[0]) ?? "STRIPE_SANDBOX_CLEANUP_FAILED";
    throw new SandboxError(code, { operation: "customers.del" });
  }
  return result as T;
}

export type CleanupSession = {
  id: string;
  customerId: string | null;
  livemode: boolean;
  status: string;
  clientReferenceId: string | null;
  attemptId: string | null;
};

export function sessionCleanupDecision(
  session: CleanupSession,
  expected: { id: string; customerId: string; attemptId: string }
): "expire" | "already_expired" {
  if (session.id !== expected.id) {
    throw new SandboxError("STRIPE_SANDBOX_CLEANUP_ID_MISMATCH", { operation: "checkout.sessions.retrieve" });
  }
  if (session.livemode !== false) {
    throw new SandboxError("STRIPE_SANDBOX_CLEANUP_LIVEMODE", { operation: "checkout.sessions.expire" });
  }
  if (session.customerId !== expected.customerId) {
    throw new SandboxError("STRIPE_SANDBOX_CLEANUP_CUSTOMER_MISMATCH", { operation: "checkout.sessions.expire" });
  }
  if (session.clientReferenceId && session.clientReferenceId !== expected.attemptId) {
    throw new SandboxError("STRIPE_SANDBOX_CLEANUP_ATTEMPT_MISMATCH", { operation: "checkout.sessions.expire" });
  }
  if (session.attemptId && session.attemptId !== expected.attemptId) {
    throw new SandboxError("STRIPE_SANDBOX_CLEANUP_ATTEMPT_MISMATCH", { operation: "checkout.sessions.expire" });
  }
  if (session.clientReferenceId !== expected.attemptId && session.attemptId !== expected.attemptId) {
    throw new SandboxError("STRIPE_SANDBOX_CLEANUP_ATTEMPT_MISMATCH", { operation: "checkout.sessions.expire" });
  }
  if (session.status === "complete") {
    throw new SandboxError("STRIPE_SANDBOX_CLEANUP_FAILED", { operation: "checkout.sessions.expire" });
  }
  if (session.status === "expired") return "already_expired";
  if (session.status !== "open") {
    throw new SandboxError("STRIPE_SANDBOX_CLEANUP_FAILED", { operation: "checkout.sessions.expire" });
  }
  return "expire";
}

// Create waits and session cleanup share one deadline: graceMs after entry.
// The remaining budget is checked before every cleanup, and that cleanup is
// only awaited for the time still left. When the budget is gone, no further
// cleanup starts.
// A timeout ends the wait. It does not abort a network call that has already
// started. This function does not continue cleanup after it returns, and
// nothing here continues cleanup after the process exits.
export async function finishCapturedSessions(input: {
  capture: CaptureBag;
  graceMs?: number;
  cleanup: (sessionId: string) => Promise<void>;
}): Promise<void> {
  const graceMs = input.graceMs ?? 15_000;
  const deadline = Date.now() + graceMs;
  const remaining = () => deadline - Date.now();
  const attempted = new Set<string>();
  const failures: unknown[] = [];
  let closed = false;
  let timedOut = false;
  let lateTail: Promise<void> = Promise.resolve();
  const previousReady = input.capture.onReady;

  const boundedWait = (timeoutMs: number) => Math.min(60_000, Math.max(1, Math.ceil(timeoutMs)));

  // The timer ends the wait only. The original promise stays attached so a
  // late resolution or rejection cannot surface as an unhandled rejection,
  // and it is not used to start more work.
  const waitForCleanup = (work: Promise<void>, timeoutMs: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new SandboxError("STRIPE_SANDBOX_TIMEOUT", { operation: "checkout.sessions.expire", timeoutMs }));
      }, timeoutMs);
      work.then(
        () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve();
        },
        (err: unknown) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(err);
        }
      );
    });
  };

  const cleanOne = async (id: string) => {
    if (attempted.has(id) || timedOut) return;
    const left = remaining();
    if (left <= 0) {
      timedOut = true;
      return;
    }
    attempted.add(id);
    try {
      await waitForCleanup(Promise.resolve(input.cleanup(id)), boundedWait(left));
    } catch (err) {
      failures.push(err);
      if (err instanceof SandboxError && err.code === "STRIPE_SANDBOX_TIMEOUT") timedOut = true;
    }
  };

  const drain = async () => {
    for (;;) {
      if (timedOut) return;
      const next = input.capture.ids.filter((id) => !attempted.has(id));
      if (next.length === 0) return;
      if (remaining() <= 0) {
        timedOut = true;
        return;
      }
      await cleanOne(next[0]);
    }
  };

  const throwFailure = (err: unknown): never => {
    if (err instanceof SandboxError) throw err;
    throw new SandboxError("STRIPE_SANDBOX_CLEANUP_FAILED", { operation: "checkout.sessions.expire" });
  };

  input.capture.onReady = (id: string) => {
    previousReady?.(id);
    if (!closed || timedOut) return;
    lateTail = lateTail.then(() => cleanOne(id));
  };

  try {
    if (input.capture.pending > 0) {
      const left = remaining();
      if (left > 0) {
        await withTimeout(Promise.all(input.capture.inflight), boundedWait(left), "checkout.sessions.create").catch(() => undefined);
      }
    }
    if (input.capture.pending > 0) {
      throw new SandboxError("STRIPE_SANDBOX_SESSION_UNSEEN", { operation: "checkout.sessions.create" });
    }
    await drain();
    closed = true;
    if (!timedOut) await drain();
    if (!timedOut && remaining() > 0) {
      for (;;) {
        const current = lateTail;
        await current;
        if (current === lateTail && !timedOut && remaining() > 0) break;
        if (timedOut || remaining() <= 0) {
          if (current !== lateTail || input.capture.ids.some((id) => !attempted.has(id))) timedOut = true;
          break;
        }
      }
    } else if (!timedOut && input.capture.ids.some((id) => !attempted.has(id))) {
      timedOut = true;
    }
    // Same turn as the stability decision. Later onReady calls must not queue a
    // cleanup, so the drain below cannot leave an observed cleanup running or
    // queued on the success path. A call that has already started is not aborted.
    closed = false;
    if (!timedOut) await drain();
    if (timedOut) {
      if (failures.length > 0) throwFailure(failures[0]);
      throw new SandboxError("STRIPE_SANDBOX_TIMEOUT", { operation: "checkout.sessions.expire", timeoutMs: boundedWait(graceMs) });
    }
    if (input.capture.pending > 0 || input.capture.ids.some((id) => !attempted.has(id))) {
      throw new SandboxError("STRIPE_SANDBOX_SESSION_UNSEEN", { operation: "checkout.sessions.create" });
    }
    if (failures.length > 0) throwFailure(failures[0]);
  } finally {
    input.capture.onReady = previousReady;
    void lateTail.then(() => undefined, () => undefined);
  }
}

// Session cleanup runs to completion before the customer delete. A session
// failure, including a cleanup wait that reached the shared deadline, reports
// every session id whose cleanup was not confirmed and the customer id, then
// throws without calling deleteCustomer. The timeout does not cancel a request
// that has already been sent, and nothing continues cleanup after this process exits.
export async function cleanupSessionsThenCustomer(input: {
  customerId: string;
  sessions: CaptureBag;
  graceMs?: number;
  cleanupSession: (sessionId: string) => Promise<void>;
  deleteCustomer: (customerId: string) => Promise<void>;
  report?: (line: string) => void;
}): Promise<void> {
  const report = input.report ?? ((line: string) => {
    console.error(line);
  });
  const cleaned = new Set<string>();
  try {
    await finishCapturedSessions({
      capture: input.sessions,
      graceMs: input.graceMs,
      cleanup: async (sessionId) => {
        await input.cleanupSession(sessionId);
        cleaned.add(sessionId);
      },
    });
  } catch (err) {
    for (const sessionId of input.sessions.ids) {
      if (!cleaned.has(sessionId)) report(`leftover_checkout_session=${sessionId}`);
    }
    report(`leftover_stripe_customer=${input.customerId}`);
    throw err;
  }
  await input.deleteCustomer(input.customerId);
}

function isInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

export function assertKeyFileOutsideRepo(filePath: string, repoRoot: string): string {
  let resolvedFile = "";
  let resolvedRepo = "";
  try {
    resolvedFile = fs.realpathSync(filePath);
    resolvedRepo = fs.realpathSync(repoRoot);
  } catch {
    throw new SandboxError("STRIPE_SANDBOX_KEY_FILE_MISSING");
  }
  if (isInside(resolvedRepo, resolvedFile)) throw new SandboxError("STRIPE_SANDBOX_KEY_FILE_INSIDE_REPO");
  let stat: fs.Stats;
  try {
    stat = fs.statSync(resolvedFile);
  } catch {
    throw new SandboxError("STRIPE_SANDBOX_KEY_FILE_MISSING");
  }
  if (!stat.isFile()) throw new SandboxError("STRIPE_SANDBOX_KEY_FILE_TYPE");
  if ((stat.mode & 0o777) !== 0o600) throw new SandboxError("STRIPE_SANDBOX_KEY_FILE_MODE");
  return resolvedFile;
}

export function readTestKey(resolvedPath: string): string {
  let text = "";
  try {
    text = fs.readFileSync(resolvedPath, "utf8");
  } catch {
    throw new SandboxError("STRIPE_SANDBOX_KEY_FILE_MISSING");
  }
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length !== 1 || !/^sk_test_[A-Za-z0-9]+$/.test(lines[0])) {
    throw new SandboxError("STRIPE_SANDBOX_KEY_REJECTED");
  }
  return lines[0];
}

export function findLiveEnvName(env: { readonly [key: string]: string | undefined }): string | null {
  for (const [name, value] of Object.entries(env)) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed.startsWith("sk_live_") || trimmed.startsWith("rk_live_")) {
      return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : "UNSAFE_ENV_NAME";
    }
  }
  return null;
}
