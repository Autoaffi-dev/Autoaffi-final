import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cleanupSessionsThenCustomer,
  createCaptureBag,
  finishCapturedSessions,
  SandboxError,
  sessionCleanupDecision,
  type CaptureBag,
} from "./stripeSandbox";

const expected = { id: "cs_test", customerId: "cus_test", attemptId: "attempt-1" };

function session(patch: Record<string, unknown> = {}) {
  return {
    id: "cs_test",
    customerId: "cus_test",
    livemode: false,
    status: "open",
    clientReferenceId: "attempt-1",
    attemptId: "attempt-1",
    ...patch,
  };
}

function codeOf(error: unknown): string {
  assert.ok(error instanceof SandboxError);
  return error.code;
}

function rejectCode(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return codeOf(error);
  }
  assert.fail("expected sandbox cleanup to throw");
}

describe("checkout sandbox cleanup without Stripe", () => {
  it("expires only a test session owned by the attempt", () => {
    assert.equal(sessionCleanupDecision(session(), expected), "expire");
    assert.equal(sessionCleanupDecision(session({ status: "expired" }), expected), "already_expired");
    assert.equal(rejectCode(() => sessionCleanupDecision(session({ livemode: true }), expected)), "STRIPE_SANDBOX_CLEANUP_LIVEMODE");
    assert.equal(
      rejectCode(() => sessionCleanupDecision(session({ customerId: "cus_other" }), expected)),
      "STRIPE_SANDBOX_CLEANUP_CUSTOMER_MISMATCH"
    );
    assert.equal(
      rejectCode(() => sessionCleanupDecision(session({ clientReferenceId: "other", attemptId: "other" }), expected)),
      "STRIPE_SANDBOX_CLEANUP_ATTEMPT_MISMATCH"
    );
    assert.equal(rejectCode(() => sessionCleanupDecision(session({ status: "complete" }), expected)), "STRIPE_SANDBOX_CLEANUP_FAILED");
  });

  it("cleans an id recorded on a delayed underlying promise and then stops", async () => {
    const bag = createCaptureBag();
    const cleaned: string[] = [];
    let resolveId: (id: string) => void = () => undefined;
    const underlying = new Promise<string>((resolve) => {
      resolveId = resolve;
    });
    bag.pending += 1;
    const recorded = underlying.then((id) => {
      try {
        if (!bag.ids.includes(id)) bag.ids.push(id);
        bag.onReady?.(id);
      } finally {
        bag.pending -= 1;
      }
    });
    bag.inflight.push(recorded.then(() => undefined, () => undefined));
    const done = finishCapturedSessions({
      capture: bag,
      graceMs: 500,
      cleanup: async (id) => {
        cleaned.push(id);
      },
    });
    setTimeout(() => resolveId("cs_delayed"), 20);
    await done;
    assert.deepEqual(cleaned, ["cs_delayed"]);
    bag.ids.push("cs_after_return");
    bag.onReady?.("cs_after_return");
    assert.deepEqual(cleaned, ["cs_delayed"]);
  });

  it("fails when a create is still unseen or cleanup fails", async () => {
    const hanging = createCaptureBag();
    hanging.pending = 1;
    hanging.inflight.push(new Promise(() => undefined));
    const unseen = await finishCapturedSessions({
      capture: hanging,
      graceMs: 20,
      cleanup: async () => undefined,
    }).then(
      () => null,
      (error: unknown) => error
    );
    assert.equal(codeOf(unseen), "STRIPE_SANDBOX_SESSION_UNSEEN");

    const failing = createCaptureBag();
    failing.ids.push("cs_bad");
    const failed = await finishCapturedSessions({
      capture: failing,
      graceMs: 200,
      cleanup: async () => {
        throw new SandboxError("STRIPE_SANDBOX_CLEANUP_FAILED", { operation: "checkout.sessions.expire" });
      },
    }).then(
      () => null,
      (error: unknown) => error
    );
    assert.equal(codeOf(failed), "STRIPE_SANDBOX_CLEANUP_FAILED");
  });

  it("waits for a session id that arrives while cleanup is still running", async () => {
    const bag: CaptureBag = createCaptureBag();
    bag.ids.push("cs_first");
    const cleaned: string[] = [];
    await finishCapturedSessions({
      capture: bag,
      graceMs: 500,
      cleanup: async (id) => {
        cleaned.push(id);
        if (id === "cs_first") {
          await new Promise((resolve) => setTimeout(resolve, 20));
          if (!bag.ids.includes("cs_second")) bag.ids.push("cs_second");
          bag.onReady?.("cs_second");
        }
      },
    });
    assert.deepEqual(cleaned, ["cs_first", "cs_second"]);
  });

  it("reports leftover session and customer ids when session cleanup fails before customer deletion", async () => {
    const bag = createCaptureBag();
    bag.ids.push("cs_left", "cs_done");
    const lines: string[] = [];
    let deleted = false;
    const error = await cleanupSessionsThenCustomer({
      customerId: "cus_left",
      sessions: bag,
      cleanupSession: async (id) => {
        if (id === "cs_left") {
          throw new SandboxError("STRIPE_SANDBOX_CLEANUP_FAILED", { operation: "checkout.sessions.expire" });
        }
      },
      deleteCustomer: async () => {
        deleted = true;
      },
      report: (line) => {
        lines.push(line);
      },
    }).then(
      () => null,
      (err: unknown) => err
    );
    assert.equal(codeOf(error), "STRIPE_SANDBOX_CLEANUP_FAILED");
    assert.equal(deleted, false);
    assert.deepEqual(lines, ["leftover_checkout_session=cs_left", "leftover_stripe_customer=cus_left"]);
  });

  it("rejects a cleanup that never settles within the shared budget", async () => {
    const bag = createCaptureBag();
    bag.ids.push("cs_hang");
    let ready = 0;
    bag.onReady = () => {
      ready += 1;
    };
    const started = Date.now();
    const error = await finishCapturedSessions({
      capture: bag,
      graceMs: 40,
      cleanup: () => new Promise(() => undefined),
    }).then(
      () => null,
      (err: unknown) => err
    );
    const elapsed = Date.now() - started;
    assert.equal(codeOf(error), "STRIPE_SANDBOX_TIMEOUT");
    assert.ok(elapsed < 500, `elapsed ${elapsed}`);
    bag.onReady?.("cs_after");
    assert.equal(ready, 1);
  });

  it("does not start the next cleanup after the budget ends during the first", async () => {
    const bag = createCaptureBag();
    bag.ids.push("cs_first", "cs_second");
    const started: string[] = [];
    const startedAt = Date.now();
    const error = await finishCapturedSessions({
      capture: bag,
      graceMs: 40,
      cleanup: (id) => {
        started.push(id);
        return new Promise(() => undefined);
      },
    }).then(
      () => null,
      (err: unknown) => err
    );
    assert.equal(codeOf(error), "STRIPE_SANDBOX_TIMEOUT");
    assert.deepEqual(started, ["cs_first"]);
    assert.ok(Date.now() - startedAt < 500);
  });

  it("skips customer deletion and reports every unconfirmed session when the budget ends", async () => {
    const bag = createCaptureBag();
    bag.ids.push("cs_slow", "cs_next");
    const started: string[] = [];
    const lines: string[] = [];
    let deleted = false;
    const error = await cleanupSessionsThenCustomer({
      customerId: "cus_budget",
      sessions: bag,
      graceMs: 40,
      cleanupSession: (id) => {
        started.push(id);
        return new Promise(() => undefined);
      },
      deleteCustomer: async () => {
        deleted = true;
      },
      report: (line) => {
        lines.push(line);
      },
    }).then(
      () => null,
      (err: unknown) => err
    );
    assert.equal(codeOf(error), "STRIPE_SANDBOX_TIMEOUT");
    assert.deepEqual(started, ["cs_slow"]);
    assert.equal(deleted, false);
    assert.deepEqual(lines, [
      "leftover_checkout_session=cs_slow",
      "leftover_checkout_session=cs_next",
      "leftover_stripe_customer=cus_budget",
    ]);
  });

  it("ignores a late cleanup result after timeout and does not delete the customer", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (error: unknown) => {
      unhandled.push(error);
    };
    process.on("unhandledRejection", onUnhandled);
    try {
      for (const late of ["reject", "resolve"] as const) {
        const bag = createCaptureBag();
        bag.ids.push("cs_late");
        let finishLate: () => void = () => undefined;
        let failLate: (error: unknown) => void = () => undefined;
        const hung = new Promise<void>((resolve, reject) => {
          finishLate = resolve;
          failLate = reject;
        });
        const lines: string[] = [];
        let deleted = false;
        const error = await cleanupSessionsThenCustomer({
          customerId: "cus_late",
          sessions: bag,
          graceMs: 30,
          cleanupSession: () => hung,
          deleteCustomer: async () => {
            deleted = true;
          },
          report: (line) => {
            lines.push(line);
          },
        }).then(
          () => null,
          (err: unknown) => err
        );
        assert.equal(codeOf(error), "STRIPE_SANDBOX_TIMEOUT");
        if (late === "reject") failLate(new Error("late cleanup failure"));
        else finishLate();
        await new Promise((resolve) => setTimeout(resolve, 30));
        assert.equal(deleted, false);
        assert.deepEqual(lines, ["leftover_checkout_session=cs_late", "leftover_stripe_customer=cus_late"]);
      }
      assert.deepEqual(unhandled, []);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  it("gives a late visible session only the budget left after the create wait", async () => {
    const graceMs = 350;
    const createDelayMs = 200;
    const bag = createCaptureBag();
    bag.pending = 1;
    let releaseCreate: (id: string) => void = () => undefined;
    const created = new Promise<string>((resolve) => {
      releaseCreate = resolve;
    });
    const recorded = created.then((id) => {
      try {
        if (!bag.ids.includes(id)) bag.ids.push(id);
        bag.ids.push("cs_after");
        bag.onReady?.(id);
      } finally {
        bag.pending -= 1;
      }
    });
    bag.inflight.push(recorded.then(() => undefined, () => undefined));
    setTimeout(() => releaseCreate("cs_visible"), createDelayMs);
    const started: string[] = [];
    let cleanupStartedAt = 0;
    const lines: string[] = [];
    let deleted = false;
    const startedAt = Date.now();
    const error = await cleanupSessionsThenCustomer({
      customerId: "cus_deadline",
      sessions: bag,
      graceMs,
      cleanupSession: (id) => {
        started.push(id);
        cleanupStartedAt = Date.now();
        return new Promise(() => undefined);
      },
      deleteCustomer: async () => {
        deleted = true;
      },
      report: (line) => {
        lines.push(line);
      },
    }).then(
      () => null,
      (err: unknown) => err
    );
    const finishedAt = Date.now();
    const elapsed = finishedAt - startedAt;
    const cleanupWait = finishedAt - cleanupStartedAt;
    assert.equal(codeOf(error), "STRIPE_SANDBOX_TIMEOUT");
    assert.deepEqual(started, ["cs_visible"]);
    assert.equal(deleted, false);
    assert.ok(cleanupStartedAt - startedAt >= createDelayMs - 20);
    assert.ok(cleanupWait < graceMs - 100, `cleanup waited ${cleanupWait}`);
    assert.ok(elapsed < graceMs + createDelayMs, `elapsed ${elapsed}`);
    assert.deepEqual(lines, [
      "leftover_checkout_session=cs_visible",
      "leftover_checkout_session=cs_after",
      "leftover_stripe_customer=cus_deadline",
    ]);
  });
});
