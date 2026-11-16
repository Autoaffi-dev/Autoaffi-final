import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import Stripe from "stripe";
import { commandFromEvent } from "./stripeWebhook.ts";
import {
  PAID_SANDBOX_AFTER_PAYMENT_RESERVE_MS,
  PAID_SANDBOX_API_VERSION,
  PAID_SANDBOX_CLEANUP_RESERVE_MS,
  PAID_SANDBOX_PROCESS_EXIT_RESERVE_MS,
  PAID_SANDBOX_REPLAY_TIMEOUT_MS,
  PAID_SANDBOX_RIG_TIMEOUT_MS,
  PAID_SANDBOX_WEBHOOK_HOST,
  STRIPE_LISTEN_COMMAND,
  STRIPE_SIGNATURE_TOLERANCE_SECONDS,
  basicInvoiceSnapshot,
  createPaidWebhookServer,
  customerUpdatedSnapshot,
  invoicePaidGapCode,
  listenerGate,
  paidSandboxPaymentDeadline,
  paymentChainAccepted,
  postSignedEvent,
  replayHeaderDecision,
  signSnapshot,
  subscriptionStatusSnapshot,
} from "./paidCheckoutSandbox.ts";
import {
  SandboxError,
  assertSandboxWebhookSecret,
  cleanupPaidCheckout,
  createCaptureBag,
  paidSessionCleanupPlan,
  paidSubscriptionCleanupPlan,
  readWebhookSecret,
  safeStripeId,
  sessionCleanupDecision,
  withCapturedCustomers,
  type CleanupCustomer,
  type PaidCheckoutSessionView,
} from "./stripeSandbox.ts";

const secret = "whsec_localtestsecret";
const prices = { basic: "price_basic", pro: "price_pro", elite: "price_elite" };
const expected = { sessionId: "cs_testsession", customerId: "cus_testcustomer", attemptId: "attempt-1", userId: "11111111-1111-4111-8111-111111111111" };

function codeOf(run: () => unknown): string {
  try {
    run();
  } catch (err) {
    assert.ok(err instanceof SandboxError);
    return err.code;
  }
  assert.fail("expected sandbox cleanup to throw");
}

function storedCustomer(): CleanupCustomer {
  return { id: expected.customerId, livemode: false, metadata: { user_id: expected.userId } };
}

function session(patch: Partial<PaidCheckoutSessionView> = {}): PaidCheckoutSessionView {
  return {
    id: expected.sessionId,
    customerId: expected.customerId,
    livemode: false,
    status: "complete",
    clientReferenceId: expected.attemptId,
    attemptId: expected.attemptId,
    subscriptionId: "sub_testsubscription",
    ...patch,
  };
}

function ids(suffix: string) {
  const now = Math.floor(Date.now() / 1000);
  return {
    eventId: `evt_${suffix}`,
    invoiceId: `in_${suffix}`,
    customerId: "cus_testcustomer",
    subscriptionId: "sub_testsubscription",
    priceId: prices.basic,
    paymentIntentId: "pi_testintent",
    periodStart: now - 3600,
    periodEnd: now + 40 * 24 * 3600,
    created: now,
  };
}

describe("paid checkout sandbox guards", () => {
  it("keeps a complete session out of the unpaid expire path", () => {
    const complete = session();
    assert.equal(paidSessionCleanupPlan(complete, expected).kind, "cancel_subscription");
    assert.equal(codeOf(() => sessionCleanupDecision({
      id: complete.id,
      customerId: complete.customerId,
      livemode: false,
      status: "complete",
      clientReferenceId: complete.clientReferenceId,
      attemptId: complete.attemptId,
    }, { id: expected.sessionId, customerId: expected.customerId, attemptId: expected.attemptId })), "STRIPE_SANDBOX_CLEANUP_FAILED");
    assert.equal(paidSessionCleanupPlan(session({ status: "open", subscriptionId: null }), expected).kind, "expire_open");
    assert.equal(codeOf(() => paidSessionCleanupPlan(session({ status: "open" }), expected)), "STRIPE_SANDBOX_CLEANUP_UNCONFIRMED");
    assert.equal(codeOf(() => paidSessionCleanupPlan(session({ livemode: true }), expected)), "STRIPE_SANDBOX_CLEANUP_LIVEMODE");
    assert.equal(codeOf(() => paidSessionCleanupPlan(session({ customerId: "cus_other" }), expected)), "STRIPE_SANDBOX_CLEANUP_CUSTOMER_MISMATCH");
    assert.equal(codeOf(() => paidSessionCleanupPlan(session({ subscriptionId: null }), expected)), "STRIPE_SANDBOX_CLEANUP_UNCONFIRMED");
    const realSessionId = "cs_test_a1b2c3d4e5";
    assert.equal(safeStripeId("cs", realSessionId), realSessionId);
    assert.equal(paidSessionCleanupPlan(session({ id: realSessionId }), { ...expected, sessionId: realSessionId }).kind, "cancel_subscription");
    assert.equal(codeOf(() => paidSessionCleanupPlan(session({ id: realSessionId, livemode: true }), { ...expected, sessionId: realSessionId })), "STRIPE_SANDBOX_CLEANUP_LIVEMODE");
    assert.equal(codeOf(() => paidSessionCleanupPlan(session({ id: "cs_test_other" }), expected)), "STRIPE_SANDBOX_CLEANUP_ID_MISMATCH");
    assert.equal(codeOf(() => paidSessionCleanupPlan(session({ clientReferenceId: "attempt-2" }), expected)), "STRIPE_SANDBOX_CLEANUP_ATTEMPT_MISMATCH");
    assert.equal(codeOf(() => paidSessionCleanupPlan(session({ attemptId: "attempt-2" }), expected)), "STRIPE_SANDBOX_CLEANUP_ATTEMPT_MISMATCH");
  });

  it("cancels only the subscription id carried by that session", () => {
    const plan = paidSessionCleanupPlan(session(), expected);
    assert.deepEqual(plan, { kind: "cancel_subscription", subscriptionId: "sub_testsubscription" });
    assert.equal(paidSubscriptionCleanupPlan(
      { id: "sub_testsubscription", customerId: expected.customerId, livemode: false, status: "active" },
      { subscriptionId: "sub_testsubscription", customerId: expected.customerId }
    ), "cancel");
    assert.equal(codeOf(() => paidSubscriptionCleanupPlan(
      { id: "sub_other", customerId: expected.customerId, livemode: false, status: "active" },
      { subscriptionId: "sub_testsubscription", customerId: expected.customerId }
    )), "STRIPE_SANDBOX_CLEANUP_SUBSCRIPTION_MISMATCH");
    assert.equal(codeOf(() => paidSubscriptionCleanupPlan(
      { id: "sub_testsubscription", customerId: expected.customerId, livemode: true, status: "active" },
      { subscriptionId: "sub_testsubscription", customerId: expected.customerId }
    )), "STRIPE_SANDBOX_CLEANUP_LIVEMODE");
  });

  it("does not delete the customer until cancellation is confirmed", async () => {
    const calls: string[] = [];
    const reports: string[] = [];
    await cleanupPaidCheckout({
      expected,
      graceMs: 2_000,
      report: (line) => reports.push(line),
      retrieveSession: async () => session(),
      retrieveSubscription: async (subscriptionId) => {
        calls.push(`retrieve:${subscriptionId}`);
        return {
          id: subscriptionId,
          customerId: expected.customerId,
          livemode: false,
          status: calls.includes("cancel") ? "canceled" : "active",
        };
      },
      expireSession: async () => {
        calls.push("expire");
      },
      confirmSessionExpired: async () => false,
      cancelSubscription: async (subscriptionId) => {
        calls.push("cancel");
        assert.equal(subscriptionId, "sub_testsubscription");
      },
      retrieveCustomer: async () => {
        calls.push("retrieve-customer");
        return storedCustomer();
      },
      deleteCustomer: async () => {
        calls.push("delete");
      },
    });
    assert.deepEqual(calls, ["retrieve:sub_testsubscription", "cancel", "retrieve:sub_testsubscription", "retrieve-customer", "delete"]);
    assert.equal(reports.length, 0);
    assert.equal(calls.includes("expire"), false);
  });

  it("stops after a cancel timeout and ignores the late response", async () => {
    const calls: string[] = [];
    const reports: string[] = [];
    let release: (value?: void) => void = () => undefined;
    const hung = new Promise<void>((resolve) => {
      release = resolve;
    });
    await assert.rejects(
      () => cleanupPaidCheckout({
        expected,
        graceMs: 80,
        report: (line) => reports.push(line),
        retrieveSession: async () => session(),
        retrieveSubscription: async () => ({ id: "sub_testsubscription", customerId: expected.customerId, livemode: false, status: "active" }),
        expireSession: async () => {
          calls.push("expire");
        },
        confirmSessionExpired: async () => false,
        cancelSubscription: () => {
          calls.push("cancel");
          return hung;
        },
        retrieveCustomer: async () => {
          calls.push("retrieve-customer");
          return storedCustomer();
        },
        deleteCustomer: async () => {
          calls.push("delete");
        },
      }),
      (err: unknown) => err instanceof SandboxError && err.code === "STRIPE_SANDBOX_TIMEOUT"
    );
    release();
    await hung;
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.deepEqual(calls, ["cancel"]);
    assert.equal(reports.includes(`leftover_checkout_session=${expected.sessionId}`), true);
    assert.equal(reports.includes("leftover_stripe_subscription=sub_testsubscription"), true);
    assert.equal(reports.includes(`leftover_stripe_customer=${expected.customerId}`), true);
  });

  it("does not start cleanup mutations after an abort", async () => {
    const calls: string[] = [];
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      () => cleanupPaidCheckout({
        expected,
        signal: controller.signal,
        report: () => undefined,
        retrieveSession: async () => {
          calls.push("retrieve");
          return session();
        },
        retrieveSubscription: async () => ({ id: "sub_testsubscription", customerId: expected.customerId, livemode: false, status: "active" }),
        expireSession: async () => undefined,
        confirmSessionExpired: async () => false,
        cancelSubscription: async () => undefined,
        retrieveCustomer: async () => storedCustomer(),
        deleteCustomer: async () => {
          calls.push("delete");
        },
      }),
      (err: unknown) => err instanceof SandboxError && err.code === "STRIPE_SANDBOX_INTERRUPTED"
    );
    assert.deepEqual(calls, []);
  });

  it("does not delete the customer when retrieve answers after timeout", async () => {
    const calls: string[] = [];
    let release: (value?: void) => void = () => undefined;
    const hung = new Promise<void>((resolve) => {
      release = resolve;
    });
    await assert.rejects(
      () => cleanupPaidCheckout({
        expected,
        graceMs: 80,
        report: () => undefined,
        retrieveSession: async () => session(),
        retrieveSubscription: async () => ({ id: "sub_testsubscription", customerId: expected.customerId, livemode: false, status: "canceled" }),
        expireSession: async () => undefined,
        confirmSessionExpired: async () => false,
        cancelSubscription: async () => undefined,
        retrieveCustomer: () => {
          calls.push("retrieve-customer");
          return hung.then(() => storedCustomer());
        },
        deleteCustomer: async () => {
          calls.push("delete");
        },
      }),
      (err: unknown) => err instanceof SandboxError && err.code === "STRIPE_SANDBOX_TIMEOUT"
    );
    release();
    await hung;
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.deepEqual(calls, ["retrieve-customer"]);
  });

  it("does not delete the customer when aborted during retrieve", async () => {
    const calls: string[] = [];
    const controller = new AbortController();
    let release: (value?: void) => void = () => undefined;
    let started: () => void = () => undefined;
    const hung = new Promise<void>((resolve) => {
      release = resolve;
    });
    const startedPromise = new Promise<void>((resolve) => {
      started = resolve;
    });
    const pending = cleanupPaidCheckout({
      expected,
      graceMs: 5_000,
      signal: controller.signal,
      report: () => undefined,
      retrieveSession: async () => session(),
      retrieveSubscription: async () => ({ id: "sub_testsubscription", customerId: expected.customerId, livemode: false, status: "canceled" }),
      expireSession: async () => undefined,
      confirmSessionExpired: async () => false,
      cancelSubscription: async () => undefined,
      retrieveCustomer: () => {
        calls.push("retrieve-customer");
        started();
        return hung.then(() => storedCustomer());
      },
      deleteCustomer: async () => {
        calls.push("delete");
      },
    });
    await startedPromise;
    controller.abort();
    release();
    await assert.rejects(pending, (err: unknown) => err instanceof SandboxError && err.code === "STRIPE_SANDBOX_INTERRUPTED");
    await hung;
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.deepEqual(calls, ["retrieve-customer"]);
  });

  it("does not delete when cancellation stays unconfirmed", async () => {
    const calls: string[] = [];
    await assert.rejects(
      () => cleanupPaidCheckout({
        expected,
        graceMs: 2_000,
        report: () => undefined,
        retrieveSession: async () => session(),
        retrieveSubscription: async () => ({ id: "sub_testsubscription", customerId: expected.customerId, livemode: false, status: "active" }),
        expireSession: async () => undefined,
        confirmSessionExpired: async () => false,
        cancelSubscription: async () => {
          calls.push("cancel");
        },
        retrieveCustomer: async () => {
          calls.push("retrieve-customer");
          return storedCustomer();
        },
        deleteCustomer: async () => {
          calls.push("delete");
        },
      }),
      (err: unknown) => err instanceof SandboxError && err.code === "STRIPE_SANDBOX_CLEANUP_UNCONFIRMED"
    );
    assert.deepEqual(calls, ["cancel"]);
  });

  it("does not delete when expire confirmation is uncertain", async () => {
    const calls: string[] = [];
    await assert.rejects(
      () => cleanupPaidCheckout({
        expected,
        graceMs: 2_000,
        report: () => undefined,
        retrieveSession: async () => session({ status: "open", subscriptionId: null }),
        retrieveSubscription: async () => ({ id: "sub_testsubscription", customerId: expected.customerId, livemode: false, status: "active" }),
        expireSession: async () => {
          calls.push("expire");
        },
        confirmSessionExpired: async () => {
          calls.push("confirm");
          return false;
        },
        cancelSubscription: async () => {
          calls.push("cancel");
        },
        retrieveCustomer: async () => {
          calls.push("retrieve-customer");
          return storedCustomer();
        },
        deleteCustomer: async () => {
          calls.push("delete");
        },
      }),
      (err: unknown) => err instanceof SandboxError && err.code === "STRIPE_SANDBOX_CLEANUP_UNCONFIRMED"
    );
    assert.deepEqual(calls, ["expire", "confirm"]);
  });

  it("preserves an invoice gap after cleanup runs", async () => {
    const bag = createCaptureBag();
    bag.ids.push(expected.customerId);
    let cleaned = false;
    await assert.rejects(
      () => withCapturedCustomers({
        capture: bag,
        cleanup: async () => {
          cleaned = true;
        },
        run: async () => {
          throw new SandboxError("STRIPE_SANDBOX_INVOICE_GAP", { operation: "invoice.paid" });
        },
      }),
      (err: unknown) => err instanceof SandboxError && err.code === "STRIPE_SANDBOX_INVOICE_GAP" && err.details.cleanupCode === undefined
    );
    assert.equal(cleaned, true);
  });

  it("rejects webhook secrets that are not a single whsec line", () => {
    assert.equal(assertSandboxWebhookSecret("whsec_localtestsecret"), "whsec_localtestsecret");
    assert.equal(codeOf(() => assertSandboxWebhookSecret("whsec_bad+secret")), "STRIPE_SANDBOX_WEBHOOK_SECRET_REJECTED");
    const dir = mkdtempSync(path.join(tmpdir(), "paid-webhook-secret-"));
    try {
      const file = path.join(dir, "secret");
      writeFileSync(file, "whsec_localtestsecret\n", { mode: 0o600 });
      chmodSync(file, 0o600);
      assert.equal(readWebhookSecret(file), "whsec_localtestsecret");
      writeFileSync(file, "sk_test_notAwebhook\n", { mode: 0o600 });
      assert.equal(codeOf(() => readWebhookSecret(file)), "STRIPE_SANDBOX_WEBHOOK_SECRET_REJECTED");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("names a missing payment list without treating the invoice as paid", () => {
    const signed = signSnapshot(secret, basicInvoiceSnapshot(ids("gap"), (invoice) => {
      delete invoice.payments;
    }));
    const event = Stripe.webhooks.constructEvent(signed.raw, signed.header, secret);
    const command = commandFromEvent(event, prices);
    assert.equal(command?.action, "reject");
    assert.equal(invoicePaidGapCode(event, command), "payments_not_one");
    assert.equal(paymentChainAccepted({ gaps: ["payments_not_one"], entitlement: "basic" }), false);
    assert.equal(paymentChainAccepted({ gaps: [], entitlement: "none" }), false);
    assert.equal(paymentChainAccepted({ gaps: [], entitlement: "basic" }), true);
  });

  it("accepts the basic fixture and ignores another customer before the store", async () => {
    const captured = { id: "cus_testcustomer" as string | null };
    const opens = { count: 0 };
    const applied: string[] = [];
    const server = await createPaidWebhookServer({
      port: 0,
      secret,
      prices,
      capturedCustomerId: () => captured.id,
      openStore: async () => ({
        async apply(command) {
          opens.count += 1;
          applied.push(command.eventId);
          if (applied.filter((id) => id === command.eventId).length > 1) return { outcome: "duplicate" };
          if (command.action === "invoice") return { outcome: "invoice_applied" };
          return { outcome: "status_applied" };
        },
      }),
    });
    try {
      assert.equal(server.port > 0, true);
      assert.equal(PAID_SANDBOX_WEBHOOK_HOST, "127.0.0.1");
      const bad = await postSignedEvent(server.port, { raw: "{}", header: "t=1,v1=bad" });
      assert.equal(bad.status, 400);
      assert.equal(bad.body.error, "WEBHOOK_SIGNATURE_INVALID");
      assert.equal(opens.count, 0);
      const other = signSnapshot(secret, basicInvoiceSnapshot({ ...ids("other"), customerId: "cus_someoneelse", eventId: "evt_other", invoiceId: "in_other" }));
      const ignored = await postSignedEvent(server.port, other);
      assert.equal(ignored.body.outcome, "ignored_unrelated");
      assert.equal(opens.count, 0);
      const invoice = signSnapshot(secret, basicInvoiceSnapshot(ids("basic")));
      const first = await postSignedEvent(server.port, invoice);
      assert.equal(first.body.outcome, "invoice_applied");
      const replay = await postSignedEvent(server.port, invoice);
      assert.equal(replay.body.outcome, "duplicate");
      assert.equal(server.gaps().length, 0);
      assert.equal(server.apiVersions().every((version) => version === PAID_SANDBOX_API_VERSION), true);
      const status = signSnapshot(secret, subscriptionStatusSnapshot({
        eventId: "evt_status",
        customerId: "cus_testcustomer",
        subscriptionId: "sub_testsubscription",
        status: "active",
        created: Math.floor(Date.now() / 1000),
      }));
      assert.equal((await postSignedEvent(server.port, status)).body.outcome, "status_applied");
      assert.equal(server.storeOpens(), 3);
    } finally {
      await server.close();
    }
  });

  it("reserves cleanup and process exit beyond the payment wait", () => {
    const started = 1_000_000;
    const deadline = paidSandboxPaymentDeadline(started);
    const reserved = PAID_SANDBOX_PROCESS_EXIT_RESERVE_MS + PAID_SANDBOX_CLEANUP_RESERVE_MS + PAID_SANDBOX_AFTER_PAYMENT_RESERVE_MS;
    assert.equal(deadline, started + PAID_SANDBOX_RIG_TIMEOUT_MS - reserved);
    const elapsed = 40_000;
    const remaining = deadline - (started + elapsed);
    assert.equal(remaining + reserved, PAID_SANDBOX_RIG_TIMEOUT_MS - elapsed);
    assert.equal(remaining < 540_000, true);
  });

  it("requires signature room before the same header is reused", () => {
    const now = 1_700_000_000_000;
    const needed = Math.ceil(PAID_SANDBOX_REPLAY_TIMEOUT_MS / 1000) + 1;
    const fresh = `t=${Math.floor(now / 1000) - 10},v1=abc`;
    assert.equal(replayHeaderDecision(fresh, now, needed), "reuse");
    const expired = `t=${Math.floor(now / 1000) - STRIPE_SIGNATURE_TOLERANCE_SECONDS},v1=abc`;
    assert.equal(replayHeaderDecision(expired, now, needed), "STRIPE_SANDBOX_SIGNATURE_STALE");
    const tight = `t=${Math.floor(now / 1000) - (STRIPE_SIGNATURE_TOLERANCE_SECONDS - needed)},v1=abc`;
    assert.equal(replayHeaderDecision(tight, now, needed), "STRIPE_SANDBOX_SIGNATURE_STALE");
  });

  it("accepts only the captured customer's signed update as listener proof", async () => {
    const opens = { count: 0 };
    const server = await createPaidWebhookServer({
      port: 0,
      secret,
      prices,
      capturedCustomerId: () => "cus_testcustomer",
      openStore: async () => {
        opens.count += 1;
        return { async apply() { return { outcome: "status_applied" }; } };
      },
    });
    try {
      assert.equal(listenerGate(server.listener()), "STRIPE_SANDBOX_LISTENER_UNCONFIRMED");
      const created = Math.floor(Date.now() / 1000);
      const other = signSnapshot(secret, customerUpdatedSnapshot({ eventId: "evt_othercustomer", customerId: "cus_someoneelse", created }));
      assert.equal((await postSignedEvent(server.port, other)).body.outcome, "ignored_unrelated");
      assert.equal(listenerGate(server.listener()), "STRIPE_SANDBOX_LISTENER_UNCONFIRMED");
      const proof = signSnapshot(secret, customerUpdatedSnapshot({ eventId: "evt_proof", customerId: "cus_testcustomer", created }));
      assert.equal((await postSignedEvent(server.port, proof)).body.outcome, "precheck_observed");
      assert.equal(listenerGate(server.listener()), "open");
      assert.equal(opens.count, 0);
      assert.equal(server.gaps().length, 0);
    } finally {
      await server.close();
    }
  });

  it("rejects a listener event whose API version differs and does not open the store", async () => {
    const opens = { count: 0 };
    const server = await createPaidWebhookServer({
      port: 0,
      secret,
      prices,
      capturedCustomerId: () => "cus_testcustomer",
      openStore: async () => {
        opens.count += 1;
        return { async apply() { return { outcome: "status_applied" }; } };
      },
    });
    try {
      const created = Math.floor(Date.now() / 1000);
      const wrong = signSnapshot(secret, customerUpdatedSnapshot({
        eventId: "evt_badversion",
        customerId: "cus_testcustomer",
        created,
        apiVersion: "2024-01-01",
      }));
      assert.equal((await postSignedEvent(server.port, wrong)).body.outcome, "precheck_rejected");
      assert.equal(listenerGate(server.listener()), "STRIPE_SANDBOX_LISTENER_API_VERSION");
      assert.equal(opens.count, 0);
      assert.equal(server.gaps().length, 0);
    } finally {
      await server.close();
    }
  });

  it("keeps the production block and does not retrieve an invoice to fill payment proof", () => {
    const webhook = readFileSync("lib/billing/stripeWebhook.ts", "utf8");
    const route = readFileSync("app/api/billing/webhook/route.ts", "utf8");
    const harness = readFileSync("lib/billing/paidCheckoutSandbox.ts", "utf8");
    const paidTest = readFileSync("lib/billing/paidCheckout.stripeSandbox.test.ts", "utf8");
    assert.match(webhook, /WEBHOOK_PRODUCTION_BLOCKED/);
    assert.match(route, /supabaseAdmin/);
    assert.equal(harness.includes("supabaseAdmin"), false);
    assert.equal(harness.includes("invoices.retrieve"), false);
    assert.equal(harness.includes("paymentIntents.retrieve"), false);
    assert.equal(paidTest.includes("supabaseAdmin"), false);
    assert.equal(paidTest.includes("invoices.retrieve"), false);
    assert.equal(paidTest.includes("paymentIntents.retrieve"), false);
    const script = readFileSync("scripts/test-billing-paid-stripe-sandbox.ts", "utf8");
    for (const part of STRIPE_LISTEN_COMMAND) assert.match(script, new RegExp(part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal(script.includes("--latest"), false);
    assert.equal(script.includes("--live"), false);
    assert.equal(script.includes("--api-version"), false);
  });
});
