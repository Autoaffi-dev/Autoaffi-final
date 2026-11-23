import type Stripe from "stripe";
import { CHECKOUT_PLANS, CHECKOUT_PRICE_CENTS, LEGACY_BASIC_PRICE_CENTS, type CheckoutPlan } from "./checkoutConfig";
import type { StripeEventStore } from "./stripeEventStore";

// Test and live ingestion are separate. BILLING_WEBHOOK_ENABLED and
// BILLING_LIVE_WEBHOOK_ENABLED both default off. The test receiver stays
// blocked when VERCEL_ENV or NODE_ENV is production. Only mode "live" can
// accept livemode=true, and only after its own secret verifies the signature.
// The request body cannot choose the secret, the account, or the mode.
// A valid signature proves that the raw body was signed with the webhook
// secret selected by this receiver. It does not prove which Stripe account
// owns that secret. Stripe returns an endpoint secret only when the endpoint
// is created, so retrieving the endpoint cannot re-prove that the configured
// secret belongs to that endpoint. The operator binds the secret to the
// endpoint id. This receiver then checks that the API key's account equals
// the configured account and that the configured endpoint exists on that key,
// is enabled, and has the same livemode. That check does not replace
// invoice.paid and invoice_payment.paid, and it does not fetch either object.
// Ordinary account events omit event.account. Those events stay valid when
// the configured account and endpoint agree. A present event.account that
// differs is still rejected. A configured account id is not treated as proof
// by itself.
// livemode=false does not by itself isolate the database. A verified event is
// written to whichever database this process is configured to use.
// Same-second status conflicts stay conservative until a later Stripe read.
// A second subscription id does not replace the first.
// Discounts, credits, refunds, prorations, and trials do not extend access.
// A granted plan here does not put payment gates on posts or reels.
// paid_until moves only when invoice.paid and invoice_payment.paid both match.
// Neither event alone moves it. getPaidPlan still returns none until the
// subscription status and owner checks pass.
// Payment proof reads ids carried on invoice_payment.paid. It does not retrieve a PaymentIntent
// and it does not choose a customer binding.

export const STRIPE_WEBHOOK_API_VERSION = "2025-11-17.clover";

const EVENT_ID = /^evt_[A-Za-z0-9]+$/;
const CUSTOMER_ID = /^cus_[A-Za-z0-9]+$/;
const SUBSCRIPTION_ID = /^sub_[A-Za-z0-9]+$/;
const INVOICE_ID = /^in_[A-Za-z0-9]+$/;
const INVOICE_PAYMENT_ID = /^inpay_[A-Za-z0-9_]+$/;
const PRICE_ID = /^price_[A-Za-z0-9]+$/;
const PAYMENT_INTENT_ID = /^pi_[A-Za-z0-9_]+$/;
const ACCOUNT_ID = /^acct_[A-Za-z0-9]+$/;
const ENDPOINT_ID = /^we_[A-Za-z0-9]+$/;
const EVENT_TYPE = /^[a-z0-9_.]+$/;
// ECMAScript time values are integer milliseconds in [-8.64e15, 8.64e15].
const MAX_UNIX_SECONDS = 8_640_000_000_000;

const STATUSES = new Set([
  "active",
  "past_due",
  "trialing",
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
]);

const REFUND_EVENTS = new Set(["charge.refunded", "charge.refund.updated", "credit_note.created"]);

export type WebhookPrices = Record<CheckoutPlan, string> & {
  legacyBasic?: string;
};

export type WebhookCommand = {
  eventId: string;
  eventType: string;
  eventCreated: string;
  livemode: boolean;
  apiVersion: string | null;
  action: "invoice" | "payment" | "status" | "reject";
  outcome: string | null;
  customerId: string | null;
  subscriptionId: string | null;
  status: string | null;
  cancelAtPeriodEnd: boolean | null;
  invoiceId: string | null;
  invoicePaymentId: string | null;
  paymentIntentId: string | null;
  priceId: string | null;
  plan: CheckoutPlan | null;
  amount: number | null;
  amountRequested: number | null;
  currency: string | null;
  paymentStatus: string | null;
  isDefault: boolean | null;
  periodStart: string | null;
  periodEnd: string | null;
  metadataUserId: string | null;
  accountId: string;
};

export type WebhookMode = "test" | "live";

export type WebhookConfig = {
  secret: string;
  prices: WebhookPrices;
  accountId: string;
  endpointId: string;
  livemode: boolean;
};

export type WebhookEndpointProof = {
  id: string;
  livemode: boolean;
  status: string;
  deleted?: boolean;
};

export type WebhookAccountProof = {
  retrieveAccount(): Promise<{ id: string }>;
  retrieveWebhookEndpoint(id: string): Promise<WebhookEndpointProof>;
};

export function webhookAccountProofAccepted(input: {
  accountId: string;
  endpoint: WebhookEndpointProof;
  config: Pick<WebhookConfig, "accountId" | "endpointId" | "livemode">;
}): boolean {
  if (input.endpoint.deleted === true) return false;
  return (
    input.accountId === input.config.accountId &&
    input.endpoint.id === input.config.endpointId &&
    input.endpoint.livemode === input.config.livemode &&
    input.endpoint.status === "enabled"
  );
}

type Envelope = {
  id: string;
  type: string;
  createdIso: string;
  livemode: boolean;
  apiVersion: string | null;
};

function readPriceSet(
  env: { readonly [key: string]: string | undefined },
  names: Record<CheckoutPlan, string>
): WebhookPrices | null {
  const prices = {} as WebhookPrices;
  for (const plan of CHECKOUT_PLANS) {
    const id = env[names[plan]] ?? "";
    if (!PRICE_ID.test(id)) return null;
    prices[plan] = id;
  }
  const currentIds = CHECKOUT_PLANS.map((plan) => prices[plan]);
  if (new Set(currentIds).size !== currentIds.length) return null;
  return prices;
}

export function readWebhookTestConfig(
  env: { readonly [key: string]: string | undefined }
): WebhookConfig | null {
  const secret = env.STRIPE_WEBHOOK_SECRET_TEST ?? "";
  if (!/^whsec_[A-Za-z0-9]+$/.test(secret)) return null;
  if ((env.STRIPE_WEBHOOK_SECRET ?? "") === secret) return null;
  const accountId = env.STRIPE_ACCOUNT_ID_TEST ?? "";
  if (!ACCOUNT_ID.test(accountId)) return null;
  const endpointId = env.STRIPE_WEBHOOK_ENDPOINT_TEST ?? "";
  if (!ENDPOINT_ID.test(endpointId)) return null;
  if ((env.STRIPE_WEBHOOK_ENDPOINT ?? "") === endpointId) return null;
  const prices = readPriceSet(env, {
    basic: "STRIPE_PRICE_BASIC_TEST",
    pro: "STRIPE_PRICE_PRO_TEST",
    elite: "STRIPE_PRICE_ELITE_TEST",
  });
  if (!prices) return null;
  const currentIds = CHECKOUT_PLANS.map((plan) => prices[plan]);
  const legacyRaw = env.STRIPE_PRICE_BASIC_TEST_LEGACY ?? "";
  if (legacyRaw === "") return { secret, prices, accountId, endpointId, livemode: false };
  if (!PRICE_ID.test(legacyRaw) || currentIds.includes(legacyRaw)) return null;
  return { secret, prices: { ...prices, legacyBasic: legacyRaw }, accountId, endpointId, livemode: false };
}

export function readWebhookLiveConfig(
  env: { readonly [key: string]: string | undefined }
): WebhookConfig | null {
  const secret = env.STRIPE_WEBHOOK_SECRET ?? "";
  if (!/^whsec_[A-Za-z0-9]+$/.test(secret)) return null;
  if ((env.STRIPE_WEBHOOK_SECRET_TEST ?? "") === secret) return null;
  const accountId = env.STRIPE_ACCOUNT_ID ?? "";
  if (!ACCOUNT_ID.test(accountId)) return null;
  const endpointId = env.STRIPE_WEBHOOK_ENDPOINT ?? "";
  if (!ENDPOINT_ID.test(endpointId)) return null;
  if ((env.STRIPE_WEBHOOK_ENDPOINT_TEST ?? "") === endpointId) return null;
  const prices = readPriceSet(env, {
    basic: "STRIPE_PRICE_BASIC",
    pro: "STRIPE_PRICE_PRO",
    elite: "STRIPE_PRICE_ELITE",
  });
  if (!prices) return null;
  return { secret, prices, accountId, endpointId, livemode: true };
}

export function commandFromEvent(
  event: Stripe.Event,
  prices: WebhookPrices,
  expectedLivemode = false
): WebhookCommand | null {
  const envelope = readEnvelope(event);
  if (!envelope) return null;
  const base = blank(envelope);
  if (event.livemode !== expectedLivemode) {
    return { ...base, action: "reject", outcome: "livemode_rejected" };
  }
  if (event.api_version !== STRIPE_WEBHOOK_API_VERSION) {
    return { ...base, action: "reject", outcome: "api_version_mismatch" };
  }
  if (REFUND_EVENTS.has(event.type)) {
    return { ...base, action: "reject", outcome: "refund_not_applied" };
  }
  if (event.type === "checkout.session.completed" || event.type === "invoice.payment_succeeded") {
    return { ...base, action: "reject", outcome: "not_payment_proof" };
  }
  if (event.type === "invoice.paid") {
    const object = readDataObject(event);
    if (!object) return null;
    if (object.object !== "invoice") return reject(base, "payload_rejected");
    return readInvoice(base, object as unknown as Stripe.Invoice, prices);
  }
  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const object = readDataObject(event);
    if (!object) return null;
    if (object.object !== "subscription") return reject(base, "payload_rejected");
    return readSubscription(base, event.type, object as unknown as Stripe.Subscription);
  }
  if (event.type === "invoice_payment.paid") {
    const object = readDataObject(event);
    if (!object) return null;
    if (object.object !== "invoice_payment") return reject(base, "payload_rejected");
    return readInvoicePayment(base, object as unknown as Stripe.InvoicePayment);
  }
  return reject(base, "ignored_type");
}

function testReceiverBlocked(env: { readonly [key: string]: string | undefined }): boolean {
  return env.VERCEL_ENV === "production" || env.NODE_ENV === "production";
}

export async function handleStripeWebhook(input: {
  request: Request;
  enabled: boolean;
  mode?: WebhookMode;
  env: { readonly [key: string]: string | undefined };
  constructEvent: (payload: string, header: string, secret: string) => Stripe.Event;
  accountProof?: WebhookAccountProof;
  openStore: () => Promise<StripeEventStore>;
}): Promise<Response> {
  const mode = input.mode ?? "test";
  if (!input.enabled) return json(503, { error: "WEBHOOK_DISABLED" });
  if (mode !== "live" && testReceiverBlocked(input.env)) return json(403, { error: "WEBHOOK_PRODUCTION_BLOCKED" });
  const config = mode === "live" ? readWebhookLiveConfig(input.env) : readWebhookTestConfig(input.env);
  if (!config || config.livemode !== (mode === "live")) return json(500, { error: "WEBHOOK_CONFIG" });

  let payload = "";
  try {
    payload = await input.request.text();
  } catch {
    return json(400, { error: "WEBHOOK_PAYLOAD_INVALID" });
  }
  const header = input.request.headers.get("stripe-signature");
  if (!header) return json(400, { error: "WEBHOOK_SIGNATURE_INVALID" });

  let event: Stripe.Event;
  try {
    event = input.constructEvent(payload, header, config.secret);
  } catch {
    return json(400, { error: "WEBHOOK_SIGNATURE_INVALID" });
  }

  if (event.livemode !== config.livemode) return json(400, { error: "WEBHOOK_LIVEMODE_REJECTED" });
  const eventAccount = (event as { account?: unknown }).account;
  if (typeof eventAccount === "string" && eventAccount !== config.accountId) {
    return json(400, { error: "WEBHOOK_ACCOUNT_REJECTED" });
  }
  if (eventAccount != null && typeof eventAccount !== "string") {
    return json(400, { error: "WEBHOOK_ACCOUNT_REJECTED" });
  }
  if (!input.accountProof) return json(500, { error: "WEBHOOK_CONFIG" });
  try {
    const account = await input.accountProof.retrieveAccount();
    const endpoint = await input.accountProof.retrieveWebhookEndpoint(config.endpointId);
    if (!webhookAccountProofAccepted({ accountId: account.id, endpoint, config })) {
      return json(409, { error: "WEBHOOK_ACCOUNT_UNVERIFIED" });
    }
  } catch {
    return json(500, { error: "WEBHOOK_ACCOUNT_UNVERIFIED" });
  }

  let command: WebhookCommand | null;
  try {
    command = commandFromEvent(event, config.prices, config.livemode);
  } catch {
    return json(400, { error: "WEBHOOK_PAYLOAD_INVALID" });
  }
  if (!command) return json(400, { error: "WEBHOOK_PAYLOAD_INVALID" });
  if (command.livemode !== config.livemode || command.outcome === "livemode_rejected") {
    return json(400, { error: "WEBHOOK_LIVEMODE_REJECTED" });
  }
  command = { ...command, accountId: config.accountId };

  try {
    const store = await input.openStore();
    const result = await store.apply(command);
    if (result.outcome === "binding_missing") return json(500, { error: "WEBHOOK_RETRY" });
    return json(200, { outcome: result.outcome });
  } catch {
    return json(500, { error: "WEBHOOK_RETRY" });
  }
}

function readInvoice(base: WebhookCommand, invoice: Stripe.Invoice, prices: WebhookPrices): WebhookCommand | null {
  if (!INVOICE_ID.test(invoice.id)) return reject(base, "payload_rejected");
  const customerId = customerIdOf(invoice.customer);
  const parentSubscription = subscriptionRef(invoice.parent);
  const next = {
    ...base,
    customerId,
    subscriptionId: parentSubscription,
    invoiceId: invoice.id,
  };
  if (!customerId) return reject(next, "customer_rejected");
  if (!parentSubscription) return reject(next, "payload_rejected");
  if (invoice.billing_reason === "subscription_update" || invoice.billing_reason === "subscription_threshold") {
    return reject(next, "proration_not_in_scope");
  }
  if (invoice.billing_reason !== "subscription_create" && invoice.billing_reason !== "subscription_cycle") {
    return reject(next, "not_payment_proof");
  }

  const line = oneLine(invoice.lines);
  if (!line) return reject(next, "payload_rejected");
  const lineSubscription = subscriptionIdOf(line.parent, line.subscription);
  if (!lineSubscription || lineSubscription !== parentSubscription) return reject(next, "payload_rejected");
  if (line.parent?.type !== "subscription_item_details" || line.parent.invoice_item_details !== null) {
    return reject(next, "payload_rejected");
  }
  const details = line.parent.subscription_item_details;
  if (!details || details.subscription !== lineSubscription) return reject(next, "payload_rejected");
  if (prorationOutOfScope(details)) return reject(next, "proration_not_in_scope");
  if (!Array.isArray(invoice.discounts) || !Array.isArray(line.discounts)) return reject(next, "payload_rejected");
  if (
    invoice.discounts.length > 0 ||
    line.discounts.length > 0 ||
    listHasEntries(invoice.total_discount_amounts) ||
    listHasEntries(line.discount_amounts)
  ) {
    return reject(next, "discount_not_in_scope");
  }
  if (listMissing(invoice.total_discount_amounts) || listMissing(line.discount_amounts)) {
    return reject(next, "payload_rejected");
  }
  if (
    invoice.starting_balance !== 0 ||
    invoice.ending_balance !== 0 ||
    invoice.pre_payment_credit_notes_amount !== 0 ||
    invoice.post_payment_credit_notes_amount !== 0 ||
    listHasEntries(invoice.total_pretax_credit_amounts) ||
    listHasEntries(line.pretax_credit_amounts)
  ) {
    return reject(next, "credit_not_in_scope");
  }
  if (listMissing(invoice.total_pretax_credit_amounts) || listMissing(line.pretax_credit_amounts)) {
    return reject(next, "payload_rejected");
  }
  if (!invoice.automatic_tax || invoice.automatic_tax.enabled !== false || listHasEntries(invoice.total_taxes) || listHasEntries(line.taxes)) {
    return reject(next, "tax_not_in_scope");
  }
  if (listMissing(invoice.total_taxes) || listMissing(line.taxes)) return reject(next, "payload_rejected");

  const priceId = line.pricing?.type === "price_details" ? line.pricing.price_details?.price ?? null : null;
  const bound = priceId && PRICE_ID.test(priceId) ? amountForKnownPrice(prices, priceId) : null;
  if (!priceId || !PRICE_ID.test(priceId) || !bound) return reject(next, "amount_mismatch");
  const { plan, amount } = bound;
  const periodStartSeconds = line.period?.start;
  const periodEndSeconds = line.period?.end;
  const periodStart = unixSecondsToIso(periodStartSeconds);
  const periodEnd = unixSecondsToIso(periodEndSeconds);
  if ((whole(periodStartSeconds) && !periodStart) || (whole(periodEndSeconds) && !periodEnd)) return null;
  const periodOk =
    periodStart !== null &&
    periodEnd !== null &&
    whole(periodStartSeconds) &&
    whole(periodEndSeconds) &&
    periodEndSeconds > periodStartSeconds;
  const amountsOk =
    invoice.currency === "usd" &&
    line.currency === "usd" &&
    invoice.status === "paid" &&
    line.quantity === 1 &&
    line.amount === amount &&
    invoice.subtotal === amount &&
    invoice.total === amount &&
    invoice.amount_due === amount &&
    invoice.amount_paid === amount &&
    invoice.amount_remaining === 0 &&
    invoice.amount_overpaid === 0 &&
    invoice.amount_shipping === 0 &&
    (invoice.subtotal_excluding_tax === null || invoice.subtotal_excluding_tax === amount) &&
    (invoice.total_excluding_tax === null || invoice.total_excluding_tax === amount) &&
    decimalCents(line.pricing?.unit_amount_decimal ?? null, amount) &&
    periodOk;
  if (!amountsOk) return reject(next, "amount_mismatch");

  return {
    ...next,
    subscriptionId: lineSubscription,
    action: "invoice",
    outcome: null,
    priceId,
    plan,
    amount,
    currency: "usd",
    periodStart,
    periodEnd,
    metadataUserId: metadataUser(invoice.metadata),
  };
}

function readInvoicePayment(base: WebhookCommand, payment: Stripe.InvoicePayment): WebhookCommand {
  const invoicePaymentId = INVOICE_PAYMENT_ID.test(payment.id) ? payment.id : null;
  const invoiceId = linkedInvoiceId(payment.invoice);
  const next = { ...base, invoiceId, invoicePaymentId };
  if (!invoicePaymentId || !invoiceId) return reject(next, "payload_rejected");
  if (payment.payment?.type === "payment_record") return reject(next, "paid_out_of_band");
  if (payment.status !== "paid") return reject(next, "not_payment_proof");
  if (payment.is_default !== true || payment.payment?.type !== "payment_intent") return reject(next, "payment_not_in_stripe");
  const intentId = paymentIntentId(payment.payment);
  if (!intentId) return reject(next, "payment_not_in_stripe");
  const paid = allowedAmount(payment.amount_paid);
  const requested = allowedAmount(payment.amount_requested);
  if (payment.currency !== "usd" || paid === null || requested === null || paid !== requested) {
    return reject(next, "amount_mismatch");
  }
  return {
    ...next,
    action: "payment",
    outcome: null,
    customerId: null,
    subscriptionId: null,
    priceId: null,
    plan: null,
    paymentIntentId: intentId,
    amount: paid,
    amountRequested: requested,
    currency: "usd",
    paymentStatus: "paid",
    isDefault: true,
  };
}

function readSubscription(base: WebhookCommand, type: string, subscription: Stripe.Subscription): WebhookCommand {
  const customerId = customerIdOf(subscription.customer);
  const subscriptionId = SUBSCRIPTION_ID.test(subscription.id) ? subscription.id : null;
  const next = { ...base, customerId, subscriptionId };
  if (!customerId) return reject(next, "customer_rejected");
  if (!subscriptionId || typeof subscription.cancel_at_period_end !== "boolean") return reject(next, "payload_rejected");
  if (type === "customer.subscription.deleted" && subscription.status !== "canceled") {
    return reject(next, "deleted_status_unexpected");
  }
  if (!STATUSES.has(subscription.status)) return reject(next, "status_rejected");
  return {
    ...next,
    action: "status",
    outcome: null,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    metadataUserId: metadataUser(subscription.metadata),
  };
}

function readEnvelope(event: Stripe.Event): Envelope | null {
  if (!event || event.object !== "event") return null;
  if (typeof event.id !== "string" || !EVENT_ID.test(event.id)) return null;
  if (typeof event.type !== "string" || !EVENT_TYPE.test(event.type)) return null;
  const createdIso = unixSecondsToIso(event.created);
  if (!createdIso) return null;
  if (typeof event.livemode !== "boolean") return null;
  if (event.api_version !== null && typeof event.api_version !== "string") return null;
  return {
    id: event.id,
    type: event.type,
    createdIso,
    livemode: event.livemode,
    apiVersion: event.api_version,
  };
}

function readDataObject(event: Stripe.Event): { object?: unknown } | null {
  const data = (event as { data?: unknown }).data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  if (!Object.prototype.hasOwnProperty.call(data, "object")) return null;
  const object = (data as { object?: unknown }).object;
  if (!object || typeof object !== "object" || Array.isArray(object)) return null;
  return object as { object?: unknown };
}

function blank(event: Envelope): WebhookCommand {
  return {
    eventId: event.id,
    eventType: event.type,
    eventCreated: event.createdIso,
    livemode: event.livemode,
    apiVersion: event.apiVersion,
    action: "reject",
    outcome: null,
    customerId: null,
    subscriptionId: null,
    status: null,
    cancelAtPeriodEnd: null,
    invoiceId: null,
    invoicePaymentId: null,
    paymentIntentId: null,
    priceId: null,
    plan: null,
    amount: null,
    amountRequested: null,
    currency: null,
    paymentStatus: null,
    isDefault: null,
    periodStart: null,
    periodEnd: null,
    metadataUserId: null,
    accountId: "",
  };
}

function reject(base: WebhookCommand, outcome: string): WebhookCommand {
  return { ...base, action: "reject", outcome };
}

function customerIdOf(
  customer: Stripe.Invoice["customer"] | Stripe.Subscription["customer"]
): string | null {
  if (typeof customer === "string") return CUSTOMER_ID.test(customer) ? customer : null;
  if (!customer || typeof customer !== "object") return null;
  if ("deleted" in customer && customer.deleted === true) return null;
  return typeof customer.id === "string" && CUSTOMER_ID.test(customer.id) ? customer.id : null;
}

function subscriptionRef(parent: Stripe.Invoice["parent"]): string | null {
  if (!parent || parent.type !== "subscription_details" || !parent.subscription_details) return null;
  const subscription = parent.subscription_details.subscription;
  if (typeof subscription === "string") return SUBSCRIPTION_ID.test(subscription) ? subscription : null;
  return typeof subscription?.id === "string" && SUBSCRIPTION_ID.test(subscription.id) ? subscription.id : null;
}

function oneLine(lines: Stripe.Invoice["lines"] | null | undefined): Stripe.InvoiceLineItem | null {
  if (!lines || lines.has_more !== false || !Array.isArray(lines.data) || lines.data.length !== 1) return null;
  const line = lines.data[0];
  if (!line || line.object !== "line_item") return null;
  return line;
}

function subscriptionIdOf(
  parent: Stripe.InvoiceLineItem["parent"],
  subscription: Stripe.InvoiceLineItem["subscription"]
): string | null {
  const fromParent = parent?.subscription_item_details?.subscription ?? null;
  const parentId = typeof fromParent === "string" && SUBSCRIPTION_ID.test(fromParent) ? fromParent : null;
  if (!parentId) return null;
  if (subscription == null) return parentId;
  const lineId =
    typeof subscription === "string"
      ? SUBSCRIPTION_ID.test(subscription)
        ? subscription
        : null
      : typeof subscription.id === "string" && SUBSCRIPTION_ID.test(subscription.id)
        ? subscription.id
        : null;
  if (!lineId || parentId !== lineId) return null;
  return parentId;
}

function prorationOutOfScope(details: { proration: boolean; proration_details: { credited_items: unknown } | null }): boolean {
  if (details.proration !== false) return true;
  const extra = details.proration_details;
  if (extra == null) return false;
  return extra.credited_items != null;
}

function allowedAmount(value: unknown): number | null {
  if (!whole(value)) return null;
  if (value === LEGACY_BASIC_PRICE_CENTS) return value;
  for (const plan of CHECKOUT_PLANS) {
    if (CHECKOUT_PRICE_CENTS[plan] === value) return value;
  }
  return null;
}

function linkedInvoiceId(invoice: Stripe.InvoicePayment["invoice"] | null | undefined): string | null {
  if (typeof invoice === "string") return INVOICE_ID.test(invoice) ? invoice : null;
  if (!invoice || typeof invoice !== "object") return null;
  const id = (invoice as { id?: unknown }).id;
  return typeof id === "string" && INVOICE_ID.test(id) ? id : null;
}

function paymentIntentId(payment: Stripe.InvoicePayment.Payment | null | undefined): string | null {
  const value = payment?.payment_intent;
  if (typeof value === "string") return PAYMENT_INTENT_ID.test(value) ? value : null;
  if (!value || typeof value !== "object") return null;
  const id = (value as { id?: unknown }).id;
  return typeof id === "string" && PAYMENT_INTENT_ID.test(id) ? id : null;
}

function listHasEntries(list: ReadonlyArray<unknown> | null | undefined): boolean {
  return Array.isArray(list) && list.length > 0;
}

function listMissing(list: ReadonlyArray<unknown> | null | undefined): boolean {
  return list !== null && !Array.isArray(list);
}

function planForPrice(prices: WebhookPrices, priceId: string): CheckoutPlan | null {
  const matches = CHECKOUT_PLANS.filter((plan) => prices[plan] === priceId);
  return matches.length === 1 ? matches[0] : null;
}

function amountForKnownPrice(
  prices: WebhookPrices,
  priceId: string
): { plan: CheckoutPlan; amount: number } | null {
  const current = planForPrice(prices, priceId);
  const legacy = prices.legacyBasic === priceId;
  if (legacy && current) return null;
  if (legacy) return { plan: "basic", amount: LEGACY_BASIC_PRICE_CENTS };
  if (!current) return null;
  return { plan: current, amount: CHECKOUT_PRICE_CENTS[current] };
}

function decimalCents(value: string | null, cents: number): boolean {
  if (value === null || !/^\d+(\.\d+)?$/.test(value)) return false;
  const [wholePart, fraction = ""] = value.split(".");
  if (wholePart.length > 1 && wholePart.startsWith("0")) return false;
  if (fraction.length > 0 && !/^0+$/.test(fraction)) return false;
  return Number(wholePart) === cents;
}

function unixSecondsToIso(value: unknown): string | null {
  if (!whole(value) || value > MAX_UNIX_SECONDS) return null;
  const millis = value * 1000;
  if (!Number.isSafeInteger(millis)) return null;
  const date = new Date(millis);
  if (date.getTime() !== millis) return null;
  return date.toISOString();
}

function whole(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function metadataUser(metadata: Stripe.Metadata | null | undefined): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = metadata.user_id;
  if (typeof value !== "string" || value.length === 0) return null;
  return value;
}

function json(status: number, body: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });
}
