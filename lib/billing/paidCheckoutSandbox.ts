import http from "node:http";
import Stripe from "stripe";
import type { StripeEventStore } from "./stripeEventStore";
import {
  commandFromEvent,
  handleStripeWebhook,
  STRIPE_WEBHOOK_API_VERSION,
  type WebhookCommand,
  type WebhookPrices,
} from "./stripeWebhook";

export const PAID_SANDBOX_WEBHOOK_HOST = "127.0.0.1";
export const PAID_SANDBOX_WEBHOOK_PORT = 8787;
export const PAID_SANDBOX_WEBHOOK_PATH = "/billing-webhook";
export const PAID_SANDBOX_API_VERSION = STRIPE_WEBHOOK_API_VERSION;
export const PAID_SANDBOX_PRECHECK_EVENT = "customer.updated";
export const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300;
export const PAID_SANDBOX_RIG_TIMEOUT_MS = 600_000;
export const PAID_SANDBOX_PROCESS_EXIT_RESERVE_MS = 20_000;
export const PAID_SANDBOX_CLEANUP_RESERVE_MS = 25_000;
export const PAID_SANDBOX_REPLAY_TIMEOUT_MS = 3_000;
export const PAID_SANDBOX_CLOSE_TIMEOUT_MS = 2_000;
export const PAID_SANDBOX_AFTER_PAYMENT_RESERVE_MS = PAID_SANDBOX_REPLAY_TIMEOUT_MS + PAID_SANDBOX_CLOSE_TIMEOUT_MS + 1_000;

// The public listen reference documents --events, --events-from, and --forward-to.
// Its default is a sandbox account and the account's default API version.
// It has no flag that pins 2025-11-17.clover. The Node SDK does not render webhook events.
// Before a manual run, `stripe version` and `stripe listen --help` are required.
// --events-from belongs in the command only when that help text shows it.
export const STRIPE_LISTEN_COMMAND = [
  "stripe",
  "listen",
  "--events",
  "invoice.paid,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,customer.updated",
  "--events-from",
  "@self",
  "--forward-to",
  `http://${PAID_SANDBOX_WEBHOOK_HOST}:${PAID_SANDBOX_WEBHOOK_PORT}${PAID_SANDBOX_WEBHOOK_PATH}`,
] as const;

export function paidSandboxPaymentDeadline(startedAt: number): number {
  return startedAt
    + PAID_SANDBOX_RIG_TIMEOUT_MS
    - PAID_SANDBOX_PROCESS_EXIT_RESERVE_MS
    - PAID_SANDBOX_CLEANUP_RESERVE_MS
    - PAID_SANDBOX_AFTER_PAYMENT_RESERVE_MS;
}

export type ListenerState = {
  ready: boolean;
  apiVersionFault: boolean;
};

export function listenerGate(state: ListenerState): "open" | "STRIPE_SANDBOX_LISTENER_UNCONFIRMED" | "STRIPE_SANDBOX_LISTENER_API_VERSION" {
  if (state.apiVersionFault) return "STRIPE_SANDBOX_LISTENER_API_VERSION";
  if (!state.ready) return "STRIPE_SANDBOX_LISTENER_UNCONFIRMED";
  return "open";
}

export function replayHeaderDecision(header: string, nowMs: number, neededSeconds: number): "reuse" | "STRIPE_SANDBOX_SIGNATURE_STALE" {
  const match = /(?:^|,)t=(\d+)(?:,|$)/.exec(header);
  if (!match || !Number.isInteger(neededSeconds) || neededSeconds < 1) return "STRIPE_SANDBOX_SIGNATURE_STALE";
  const timestamp = Number(match[1]);
  if (!Number.isInteger(timestamp)) return "STRIPE_SANDBOX_SIGNATURE_STALE";
  const age = Math.floor(nowMs / 1000) - timestamp;
  if (age + neededSeconds >= STRIPE_SIGNATURE_TOLERANCE_SECONDS) return "STRIPE_SANDBOX_SIGNATURE_STALE";
  return "reuse";
}

const GAP_CODES = new Set([
  "payments_not_one",
  "proration_details_present",
  "line_subscription_absent",
  "payload_invalid",
  "payload_rejected",
  "api_version_mismatch",
  "payment_not_in_stripe",
  "paid_out_of_band",
  "amount_mismatch",
  "tax_not_in_scope",
  "discount_not_in_scope",
  "credit_not_in_scope",
  "proration_not_in_scope",
  "not_payment_proof",
  "customer_rejected",
  "invoice_rejected",
]);

const CUSTOMER_ID = /^cus_[A-Za-z0-9]+$/;
const EVENT_ID = /^evt_[A-Za-z0-9]+$/;
const EVENT_TYPE = /^[a-z0-9_.]+$/;
const PLAN = /^(basic|pro|elite)$/;
const OUTCOME = /^[a-z0-9_]{1,64}$/;
const API_VERSION = /^[0-9]{4}-[0-9]{2}-[0-9]{2}(?:\.[A-Za-z0-9_]+)?$/;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ERROR_CODE = /^[A-Z0-9_]+$/;

export function customerIdFromStripeEvent(event: Stripe.Event): string | null {
  const object = event.data?.object as { object?: unknown; id?: unknown; customer?: unknown } | undefined;
  if (object?.object === "customer" && typeof object.id === "string" && CUSTOMER_ID.test(object.id)) return object.id;
  const customer = object?.customer;
  if (typeof customer === "string") return CUSTOMER_ID.test(customer) ? customer : null;
  if (!customer || typeof customer !== "object") return null;
  const id = (customer as { id?: unknown }).id;
  return typeof id === "string" && CUSTOMER_ID.test(id) ? id : null;
}

export function eventReachesStore(event: Stripe.Event, capturedCustomerId: string | null): "apply" | "ignore" {
  const customerId = customerIdFromStripeEvent(event);
  if (!capturedCustomerId || !customerId || customerId !== capturedCustomerId) return "ignore";
  return "apply";
}

function invoiceOf(event: Stripe.Event): Stripe.Invoice | null {
  const object = event.data?.object;
  if (!object || object.object !== "invoice") return null;
  return object;
}

export function invoicePaidGapCode(event: Stripe.Event, command: WebhookCommand | null): string | null {
  if (event.type !== "invoice.paid") return null;
  if (command?.action === "invoice" && command.outcome === null && command.apiVersion === PAID_SANDBOX_API_VERSION) return null;
  if (command?.outcome === "api_version_mismatch" || event.api_version !== PAID_SANDBOX_API_VERSION) return "api_version_mismatch";
  const invoice = invoiceOf(event);
  if (!invoice || !command) return "payload_invalid";
  const payments = invoice.payments;
  if (!payments || payments.has_more !== false || payments.data.length !== 1) return "payments_not_one";
  const line = invoice.lines?.data?.[0];
  const details = line?.parent?.subscription_item_details;
  if (details && details.proration_details != null) return "proration_details_present";
  if (line && line.subscription == null) return "line_subscription_absent";
  if (command.outcome && GAP_CODES.has(command.outcome)) return command.outcome;
  return "invoice_rejected";
}

export function paymentChainAccepted(input: { gaps: readonly string[]; entitlement: string }): boolean {
  return input.gaps.length === 0 && input.entitlement === "basic";
}

export function sanitizedApiVersion(value: string | null | undefined): string {
  return typeof value === "string" && API_VERSION.test(value) ? value : "unrecognized";
}

type InvoiceIds = {
  eventId: string;
  invoiceId: string;
  customerId: string;
  subscriptionId: string;
  priceId: string;
  paymentIntentId: string;
  periodStart: number;
  periodEnd: number;
  created: number;
};

export function basicInvoiceSnapshot(ids: InvoiceIds, mutate?: (invoice: Record<string, unknown>, line: Record<string, unknown>) => void): Record<string, unknown> {
  const amount = 700;
  const line: Record<string, unknown> = {
    id: "il_basic",
    object: "line_item",
    amount,
    currency: "usd",
    quantity: 1,
    discount_amounts: [],
    discounts: [],
    pretax_credit_amounts: [],
    taxes: [],
    subscription: ids.subscriptionId,
    period: { start: ids.periodStart, end: ids.periodEnd },
    pricing: {
      type: "price_details",
      unit_amount_decimal: String(amount),
      price_details: { price: ids.priceId, product: "prod_basic" },
    },
    parent: {
      type: "subscription_item_details",
      invoice_item_details: null,
      subscription_item_details: {
        invoice_item: null,
        proration: false,
        proration_details: null,
        subscription: ids.subscriptionId,
        subscription_item: "si_basic",
      },
    },
  };
  const invoice: Record<string, unknown> = {
    id: ids.invoiceId,
    object: "invoice",
    status: "paid",
    currency: "usd",
    billing_reason: "subscription_create",
    customer: ids.customerId,
    livemode: false,
    parent: {
      type: "subscription_details",
      quote_details: null,
      subscription_details: { metadata: null, subscription: ids.subscriptionId },
    },
    amount_due: amount,
    amount_paid: amount,
    amount_remaining: 0,
    amount_overpaid: 0,
    amount_shipping: 0,
    subtotal: amount,
    total: amount,
    subtotal_excluding_tax: amount,
    total_excluding_tax: amount,
    starting_balance: 0,
    ending_balance: 0,
    pre_payment_credit_notes_amount: 0,
    post_payment_credit_notes_amount: 0,
    total_discount_amounts: [],
    total_pretax_credit_amounts: [],
    total_taxes: [],
    discounts: [],
    automatic_tax: { enabled: false, disabled_reason: null, liability: null, provider: null, status: null },
    metadata: {},
    lines: { object: "list", has_more: false, url: "/v1/invoices/in_basic/lines", data: [line] },
    payments: {
      object: "list",
      has_more: false,
      url: "/v1/invoices/in_basic/payments",
      data: [
        {
          id: "inpay_basic",
          object: "invoice_payment",
          amount_paid: amount,
          amount_requested: amount,
          currency: "usd",
          status: "paid",
          is_default: true,
          invoice: ids.invoiceId,
          payment: { type: "payment_intent", payment_intent: ids.paymentIntentId },
        },
      ],
    },
  };
  mutate?.(invoice, line);
  return {
    id: ids.eventId,
    object: "event",
    api_version: PAID_SANDBOX_API_VERSION,
    created: ids.created,
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: "invoice.paid",
    data: { object: invoice },
  };
}

export function subscriptionStatusSnapshot(input: {
  eventId: string;
  customerId: string;
  subscriptionId: string;
  status: string;
  created: number;
}): Record<string, unknown> {
  return {
    id: input.eventId,
    object: "event",
    api_version: PAID_SANDBOX_API_VERSION,
    created: input.created,
    livemode: false,
    type: "customer.subscription.updated",
    data: {
      object: {
        id: input.subscriptionId,
        object: "subscription",
        customer: input.customerId,
        status: input.status,
        cancel_at_period_end: false,
        metadata: {},
      },
    },
  };
}

export function customerUpdatedSnapshot(input: {
  eventId: string;
  customerId: string;
  created: number;
  apiVersion?: string;
}): Record<string, unknown> {
  return {
    id: input.eventId,
    object: "event",
    api_version: input.apiVersion ?? PAID_SANDBOX_API_VERSION,
    created: input.created,
    livemode: false,
    type: PAID_SANDBOX_PRECHECK_EVENT,
    data: { object: { id: input.customerId, object: "customer", metadata: {} } },
  };
}

export function signSnapshot(secret: string, event: Record<string, unknown>): { raw: string; header: string } {
  const raw = JSON.stringify(event);
  const header = Stripe.webhooks.generateTestHeaderString({ payload: raw, secret });
  return { raw, header };
}

function sqlText(value: string | null, pattern: RegExp | null): string {
  if (value === null) return "null::text";
  if (!pattern || !pattern.test(value)) throw new Error("WEBHOOK_STORE_INPUT_REJECTED");
  return `$$${value}$$::text`;
}

function sqlTime(value: string | null): string {
  if (value === null) return "null::timestamptz";
  if (!ISO_TIME.test(value)) throw new Error("WEBHOOK_STORE_INPUT_REJECTED");
  return `$$${value}$$::timestamptz`;
}

export function applyStripeEventSql(command: WebhookCommand): string {
  const amount = command.amount === null ? "null::integer" : String(command.amount);
  if (command.amount !== null && (!Number.isInteger(command.amount) || command.amount < 0 || command.amount > 100_000)) {
    throw new Error("WEBHOOK_STORE_INPUT_REJECTED");
  }
  const cancel = command.cancelAtPeriodEnd === null ? "null::boolean" : command.cancelAtPeriodEnd ? "true" : "false";
  return `select public.billing_apply_stripe_event(
    ${sqlText(command.eventId, EVENT_ID)},
    ${sqlText(command.eventType, EVENT_TYPE)},
    ${sqlTime(command.eventCreated)},
    ${command.livemode ? "true" : "false"},
    ${sqlText(command.apiVersion, API_VERSION)},
    ${sqlText(command.action, /^(invoice|status|reject)$/)},
    ${sqlText(command.outcome, command.outcome === null ? null : OUTCOME)},
    ${sqlText(command.customerId, command.customerId === null ? null : CUSTOMER_ID)},
    ${sqlText(command.subscriptionId, command.subscriptionId === null ? null : /^sub_[A-Za-z0-9]+$/)},
    ${sqlText(command.status, command.status === null ? null : /^[a-z_]+$/)},
    ${cancel},
    ${sqlText(command.invoiceId, command.invoiceId === null ? null : /^in_[A-Za-z0-9]+$/)},
    ${sqlText(command.priceId, command.priceId === null ? null : /^price_[A-Za-z0-9]+$/)},
    ${sqlText(command.plan, command.plan === null ? null : PLAN)},
    ${amount},
    ${sqlTime(command.periodStart)},
    ${sqlTime(command.periodEnd)},
    ${sqlText(command.metadataUserId, command.metadataUserId === null ? null : USER_ID)}
  )`;
}

export function createServiceRoleEventStore(psql: (sql: string) => string): StripeEventStore {
  return {
    async apply(command) {
      if (command.livemode !== false) throw new Error("WEBHOOK_STORE_INPUT_REJECTED");
      const text = psql(`begin; select set_config('role', 'service_role', true); ${applyStripeEventSql(command)}; commit;`);
      const line = text.split("\n").map((part) => part.trim()).find((part) => part.startsWith("{"));
      if (!line) throw new Error("WEBHOOK_STORE_FAILED");
      const parsed: unknown = JSON.parse(line);
      const outcome = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as { outcome?: unknown }).outcome : null;
      if (typeof outcome !== "string" || !OUTCOME.test(outcome)) throw new Error("WEBHOOK_STORE_FAILED");
      return { outcome };
    },
  };
}

export type PaidWebhookServer = {
  port: number;
  gaps: () => readonly string[];
  storeOpens: () => number;
  apiVersions: () => readonly string[];
  listener: () => ListenerState;
  acceptedInvoice: () => { raw: string; header: string } | null;
  close: () => Promise<void>;
};

async function readRaw(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_000_000) throw new Error("TOO_LARGE");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function createPaidWebhookServer(input: {
  port: number;
  secret: string;
  prices: WebhookPrices;
  capturedCustomerId: () => string | null;
  openStore: () => Promise<StripeEventStore>;
}): Promise<PaidWebhookServer> {
  const gaps: string[] = [];
  const apiVersions: string[] = [];
  const listener: ListenerState = { ready: false, apiVersionFault: false };
  let storeOpens = 0;
  let accepted: { raw: string; header: string } | null = null;
  const server = http.createServer(async (req, res) => {
    const send = (status: number, body: Record<string, string>) => {
      const payload = JSON.stringify(body);
      res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store", "content-length": Buffer.byteLength(payload) });
      res.end(payload);
    };
    try {
      if (req.method !== "POST" || req.url?.split("?")[0] !== PAID_SANDBOX_WEBHOOK_PATH) {
        send(404, { error: "NOT_FOUND" });
        return;
      }
      const raw = await readRaw(req);
      const header = req.headers["stripe-signature"];
      const signature = Array.isArray(header) ? header[0] : header;
      if (!signature) {
        send(400, { error: "WEBHOOK_SIGNATURE_INVALID" });
        return;
      }
      let event: Stripe.Event;
      try {
        event = Stripe.webhooks.constructEvent(raw, signature, input.secret);
      } catch {
        send(400, { error: "WEBHOOK_SIGNATURE_INVALID" });
        return;
      }
      if (eventReachesStore(event, input.capturedCustomerId()) === "ignore") {
        send(200, { outcome: "ignored_unrelated" });
        return;
      }
      if (event.type === PAID_SANDBOX_PRECHECK_EVENT) {
        apiVersions.push(sanitizedApiVersion(event.api_version));
        if (event.api_version !== PAID_SANDBOX_API_VERSION) {
          listener.apiVersionFault = true;
          send(200, { outcome: "precheck_rejected" });
          return;
        }
        listener.ready = true;
        send(200, { outcome: "precheck_observed" });
        return;
      }
      apiVersions.push(sanitizedApiVersion(event.api_version));
      let command: WebhookCommand | null = null;
      try {
        command = commandFromEvent(event, input.prices);
      } catch {
        command = null;
      }
      const gap = invoicePaidGapCode(event, command);
      if (gap) gaps.push(gap);
      const response = await handleStripeWebhook({
        request: new Request(`http://${PAID_SANDBOX_WEBHOOK_HOST}${PAID_SANDBOX_WEBHOOK_PATH}`, {
          method: "POST",
          headers: { "stripe-signature": signature },
          body: raw,
        }),
        enabled: true,
        env: {
          NODE_ENV: "test",
          STRIPE_WEBHOOK_SECRET_TEST: input.secret,
          STRIPE_PRICE_BASIC_TEST: input.prices.basic,
          STRIPE_PRICE_PRO_TEST: input.prices.pro,
          STRIPE_PRICE_ELITE_TEST: input.prices.elite,
        },
        constructEvent: (payload, stripeSignature, secret) => Stripe.webhooks.constructEvent(payload, stripeSignature, secret),
        openStore: async () => {
          storeOpens += 1;
          return input.openStore();
        },
      });
      const text = await response.text();
      let forwarded: Record<string, string> = { error: "WEBHOOK_RESPONSE" };
      try {
        const parsed = JSON.parse(text) as { outcome?: unknown; error?: unknown };
        if (typeof parsed.outcome === "string" && OUTCOME.test(parsed.outcome)) {
          forwarded = { outcome: parsed.outcome };
          if (parsed.outcome === "invoice_applied") accepted = { raw, header: signature };
        } else if (typeof parsed.error === "string" && ERROR_CODE.test(parsed.error)) {
          forwarded = { error: parsed.error };
        }
      } catch {
        forwarded = { error: "WEBHOOK_RESPONSE" };
      }
      send(response.status, forwarded);
    } catch {
      send(400, { error: "WEBHOOK_PAYLOAD_INVALID" });
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(input.port, PAID_SANDBOX_WEBHOOK_HOST, () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string" || address.address !== PAID_SANDBOX_WEBHOOK_HOST) {
    server.close();
    throw new Error("WEBHOOK_BIND_REJECTED");
  }
  return {
    port: address.port,
    gaps: () => gaps,
    storeOpens: () => storeOpens,
    apiVersions: () => apiVersions,
    listener: () => ({ ready: listener.ready, apiVersionFault: listener.apiVersionFault }),
    acceptedInvoice: () => accepted,
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

export function postSignedEvent(port: number, signed: { raw: string; header: string }, timeoutMs = PAID_SANDBOX_REPLAY_TIMEOUT_MS): Promise<{ status: number; body: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (run: () => void) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      run();
    };
    const req = http.request(
      {
        hostname: PAID_SANDBOX_WEBHOOK_HOST,
        port,
        path: PAID_SANDBOX_WEBHOOK_PATH,
        method: "POST",
        headers: { "content-type": "application/json", "stripe-signature": signed.header, "content-length": Buffer.byteLength(signed.raw) },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let body: Record<string, string> = {};
          try {
            const parsed = JSON.parse(text) as Record<string, unknown>;
            const outcome = parsed.outcome;
            const error = parsed.error;
            if (typeof outcome === "string" && OUTCOME.test(outcome)) body = { outcome };
            else if (typeof error === "string" && ERROR_CODE.test(error)) body = { error };
          } catch {
            body = {};
          }
          finish(() => resolve({ status: res.statusCode ?? 0, body }));
        });
      }
    );
    timer = setTimeout(() => {
      req.destroy();
      finish(() => reject(new Error("WEBHOOK_REPLAY_TIMEOUT")));
    }, timeoutMs);
    req.on("error", (err) => finish(() => reject(err)));
    req.end(signed.raw);
  });
}
