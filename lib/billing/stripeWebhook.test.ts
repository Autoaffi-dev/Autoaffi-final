import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import Stripe from "stripe";
import { CHECKOUT_PRICE_CENTS } from "./checkoutConfig.ts";
import {
  STRIPE_WEBHOOK_API_VERSION,
  commandFromEvent,
  handleStripeWebhook,
  readWebhookLiveConfig,
  readWebhookTestConfig,
  type WebhookCommand,
  type WebhookPrices,
} from "./stripeWebhook.ts";

const PRICES: WebhookPrices = {
  basic: "price_basic",
  pro: "price_pro",
  elite: "price_elite",
};
const SECRET = "whsec_testsecret123";
const ACCOUNT = "acct_test";
const ENDPOINT = "we_test";
const ENV = {
  STRIPE_WEBHOOK_SECRET_TEST: SECRET,
  STRIPE_PRICE_BASIC_TEST: PRICES.basic,
  STRIPE_PRICE_PRO_TEST: PRICES.pro,
  STRIPE_PRICE_ELITE_TEST: PRICES.elite,
  STRIPE_ACCOUNT_ID_TEST: ACCOUNT,
  STRIPE_WEBHOOK_ENDPOINT_TEST: ENDPOINT,
  STRIPE_SECRET_KEY: "sk_live_should_not_be_read",
  STRIPE_WEBHOOK_SECRET: "whsec_live_should_not_be_read",
  STRIPE_WEBHOOK_ENDPOINT: "we_liveunused",
};

function accountProof(accountId = ACCOUNT, livemode = false) {
  return {
    async retrieveAccount() {
      return { id: accountId };
    },
    async retrieveWebhookEndpoint(id: string) {
      return { id, livemode, status: "enabled" };
    },
  };
}

type PaidLineFixture = Pick<
  Stripe.InvoiceLineItem,
  | "id"
  | "object"
  | "amount"
  | "currency"
  | "quantity"
  | "discount_amounts"
  | "discounts"
  | "pretax_credit_amounts"
  | "taxes"
  | "subscription"
  | "period"
  | "pricing"
  | "parent"
>;

type PaidPaymentFixture = Pick<
  Stripe.InvoicePayment,
  | "id"
  | "object"
  | "amount_paid"
  | "amount_requested"
  | "currency"
  | "status"
  | "is_default"
  | "invoice"
  | "payment"
>;

type PaidListFixture<T> = Pick<Stripe.ApiList<T>, "object" | "data" | "has_more" | "url">;

type PaidInvoiceFixture = Pick<
  Stripe.Invoice,
  | "id"
  | "object"
  | "status"
  | "currency"
  | "billing_reason"
  | "customer"
  | "livemode"
  | "parent"
  | "amount_due"
  | "amount_paid"
  | "amount_remaining"
  | "amount_overpaid"
  | "amount_shipping"
  | "subtotal"
  | "total"
  | "subtotal_excluding_tax"
  | "total_excluding_tax"
  | "starting_balance"
  | "ending_balance"
  | "pre_payment_credit_notes_amount"
  | "post_payment_credit_notes_amount"
  | "total_discount_amounts"
  | "total_pretax_credit_amounts"
  | "total_taxes"
  | "discounts"
  | "automatic_tax"
  | "metadata"
> & {
  lines: PaidListFixture<PaidLineFixture>;
  payments?: PaidListFixture<PaidPaymentFixture>;
};

type LineDistortion = {
  [K in keyof PaidLineFixture]?: PaidLineFixture[K];
} & {
  price?: { id: string };
};

type PaymentDistortion = Omit<
  { [K in keyof PaidPaymentFixture]?: PaidPaymentFixture[K] },
  "invoice" | "payment"
> & {
  invoice?: unknown;
  payment?: {
    type?: string;
    payment_intent?: unknown;
  };
};

type InvoiceDistortion = Omit<
  { [K in keyof PaidInvoiceFixture]?: PaidInvoiceFixture[K] },
  "lines" | "payments" | "total_taxes"
> & {
  lines?: PaidListFixture<LineDistortion>;
  payments?: PaidListFixture<PaymentDistortion>;
  total_taxes?: Array<{ amount: number }> | null;
  subscription?: string;
};

function validPaidInvoice(): PaidInvoiceFixture {
  const amount = CHECKOUT_PRICE_CENTS.pro;
  const line = {
    id: "il_pro",
    object: "line_item",
    amount,
    currency: "usd",
    quantity: 1,
    discount_amounts: [],
    discounts: [],
    pretax_credit_amounts: [],
    taxes: [],
    subscription: null,
    period: { start: 1767225600, end: 1798761600 },
    pricing: {
      type: "price_details",
      unit_amount_decimal: String(amount),
      price_details: { price: PRICES.pro, product: "prod_pro" },
    },
    parent: {
      type: "subscription_item_details",
      invoice_item_details: null,
      subscription_item_details: {
        invoice_item: null,
        proration: false,
        proration_details: { credited_items: null },
        subscription: "sub_B",
        subscription_item: "si_B",
      },
    },
  } satisfies PaidLineFixture;
  return {
    id: "in_pro",
    object: "invoice",
    status: "paid",
    currency: "usd",
    billing_reason: "subscription_cycle",
    customer: "cus_B",
    livemode: false,
    parent: {
      type: "subscription_details",
      quote_details: null,
      subscription_details: { metadata: null, subscription: "sub_B" },
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
    metadata: { user_id: "22222222-2222-4222-8222-222222222222" },
    lines: {
      object: "list",
      has_more: false,
      url: "/v1/invoices/in_pro/lines",
      data: [line],
    },
  } satisfies PaidInvoiceFixture;
}

// The fixture picks the invoice and line fields this receiver reads, including
// their nested parent, pricing, and payment objects. It is not a complete
// Stripe.Invoice. The assertion only lets commandFromEvent accept that partial
// value; it does not validate a complete Stripe.Event.
function invoicePaidEvent(invoice: PaidInvoiceFixture | InvoiceDistortion): Stripe.Event {
  return {
    id: "evt_invoice",
    object: "event",
    api_version: STRIPE_WEBHOOK_API_VERSION,
    created: 1763000000,
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: "invoice.paid",
    data: { object: invoice },
  } as Stripe.Event;
}

function paidInvoice(): Stripe.Event {
  return invoicePaidEvent(validPaidInvoice());
}

function basicInvoice(priceId: string, amount: number): Stripe.Event {
  return distortedPaidInvoice((invoice, line) => {
    invoice.id = "in_basic";
    invoice.amount_due = amount;
    invoice.amount_paid = amount;
    invoice.subtotal = amount;
    invoice.total = amount;
    invoice.subtotal_excluding_tax = amount;
    invoice.total_excluding_tax = amount;
    line.amount = amount;
    if (line.pricing?.type === "price_details" && line.pricing.price_details) {
      line.pricing.unit_amount_decimal = String(amount);
      line.pricing.price_details.price = priceId;
    }
  });
}

function paymentEvent(mutate?: (payment: {
  invoice?: unknown;
  amount_paid?: number;
  amount_requested?: number;
  payment?: { type?: string; payment_intent?: unknown; payment_record?: string };
  is_default?: boolean;
  status?: string;
  currency?: string;
}) => void): Stripe.Event {
  const payment = {
    id: "inpay_pro",
    object: "invoice_payment",
    amount_paid: 1900,
    amount_requested: 1900,
    created: 1763000000,
    currency: "usd",
    invoice: "in_pro",
    is_default: true,
    livemode: false,
    payment: { type: "payment_intent", payment_intent: "pi_pro" },
    status: "paid",
    status_transitions: { canceled_at: null, paid_at: 1763000000 },
  };
  mutate?.(payment);
  return {
    id: "evt_payment",
    object: "event",
    api_version: STRIPE_WEBHOOK_API_VERSION,
    created: 1763000000,
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: "invoice_payment.paid",
    data: { object: payment },
  } as Stripe.Event;
}

function distortedPaidInvoice(
  mutate: (invoice: InvoiceDistortion, line: LineDistortion) => void,
): Stripe.Event {
  const invoice: InvoiceDistortion = structuredClone(validPaidInvoice());
  const line = invoice.lines?.data[0];
  if (!line) throw new Error("PAID_INVOICE_FIXTURE");
  mutate(invoice, line);
  return invoicePaidEvent(invoice);
}

function statusEvent(status: string, cancel = false): Stripe.Event {
  return {
    id: "evt_status",
    object: "event",
    api_version: STRIPE_WEBHOOK_API_VERSION,
    created: 1763000000,
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: "customer.subscription.updated",
    data: {
      object: {
        id: "sub_B",
        object: "subscription",
        customer: "cus_B",
        status,
        cancel_at_period_end: cancel,
        metadata: {},
        items: {
          object: "list",
          has_more: false,
          data: [
            {
              id: "si_B",
              object: "subscription_item",
              current_period_start: 1767225600,
              current_period_end: 1900000000,
            },
          ],
        },
      },
    },
  } as Stripe.Event;
}

async function posted(payload: string, header: string | null, enabled = true) {
  const applied: WebhookCommand[] = [];
  const headers = new Headers();
  if (header) headers.set("stripe-signature", header);
  const response = await handleStripeWebhook({
    request: new Request("https://app.example/api/billing/webhook", { method: "POST", headers, body: payload }),
    enabled,
    env: ENV,
    constructEvent: (body, signature, secret) => Stripe.webhooks.constructEvent(body, signature, secret),
    accountProof: accountProof(),
    openStore: async () => ({
      async apply(command) {
        applied.push(command);
        return { outcome: command.outcome ?? "invoice_applied" };
      },
    }),
  });
  return { response, applied, body: await response.json() };
}

describe("stripe webhook parser", () => {
  it("reads only the test webhook secret and the test price ids", () => {
    assert.deepEqual(readWebhookTestConfig(ENV), { secret: SECRET, prices: PRICES, accountId: ACCOUNT, endpointId: ENDPOINT, livemode: false });
    assert.equal(readWebhookTestConfig({ ...ENV, STRIPE_WEBHOOK_SECRET_TEST: "sk_test_secret" }), null);
    assert.equal(readWebhookTestConfig({ ...ENV, STRIPE_PRICE_PRO_TEST: PRICES.basic }), null);
    assert.equal(readWebhookTestConfig({ STRIPE_SECRET_KEY: "sk_live_secret" }), null);
  });

  it("binds the current basic price to 900 and an explicit legacy id to 700", () => {
    const legacy = "price_basic700";
    assert.deepEqual(readWebhookTestConfig({ ...ENV, STRIPE_PRICE_BASIC_TEST_LEGACY: legacy }), {
      secret: SECRET,
      accountId: ACCOUNT,
      endpointId: ENDPOINT,
      livemode: false,
      prices: { ...PRICES, legacyBasic: legacy },
    });
    assert.deepEqual(readWebhookTestConfig({ ...ENV, STRIPE_PRICE_BASIC_TEST_LEGACY: "" }), {
      secret: SECRET,
      endpointId: ENDPOINT,
      accountId: ACCOUNT,
      livemode: false,
      prices: PRICES,
    });
    assert.equal(readWebhookTestConfig({ ...ENV, STRIPE_PRICE_BASIC_TEST_LEGACY: PRICES.basic }), null);
    assert.equal(readWebhookTestConfig({ ...ENV, STRIPE_PRICE_BASIC_TEST_LEGACY: PRICES.pro }), null);
    assert.equal(readWebhookTestConfig({ ...ENV, STRIPE_PRICE_BASIC_TEST_LEGACY: PRICES.elite }), null);
    assert.equal(readWebhookTestConfig({ ...ENV, STRIPE_PRICE_BASIC_TEST_LEGACY: "price_basic 700" }), null);
    assert.equal(readWebhookTestConfig({ ...ENV, STRIPE_PRICE_BASIC_TEST: PRICES.pro }), null);
    assert.equal(readWebhookTestConfig({ ...ENV, STRIPE_PRICE_ELITE_TEST: PRICES.basic }), null);
    assert.equal(readWebhookTestConfig({ ...ENV, STRIPE_PRICE_ELITE_TEST: PRICES.pro }), null);

    const prices = { ...PRICES, legacyBasic: legacy };
    const current = commandFromEvent(basicInvoice(PRICES.basic, CHECKOUT_PRICE_CENTS.basic), prices);
    assert.equal(current?.action, "invoice");
    assert.equal(current?.plan, "basic");
    assert.equal(current?.amount, 900);
    assert.equal(current?.priceId, PRICES.basic);
    assert.equal(commandFromEvent(basicInvoice(PRICES.basic, 700), prices)?.outcome, "amount_mismatch");
    assert.equal(commandFromEvent(basicInvoice(PRICES.basic, 700), PRICES)?.outcome, "amount_mismatch");

    const historical = commandFromEvent(basicInvoice(legacy, 700), prices);
    assert.equal(historical?.action, "invoice");
    assert.equal(historical?.plan, "basic");
    assert.equal(historical?.amount, 700);
    assert.equal(historical?.priceId, legacy);
    assert.equal(commandFromEvent(basicInvoice(legacy, 900), prices)?.outcome, "amount_mismatch");
    assert.equal(commandFromEvent(basicInvoice("price_unknown", 900), prices)?.outcome, "amount_mismatch");
    assert.equal(commandFromEvent(basicInvoice("price_unknown", 900), prices)?.plan, null);

    for (const amount of [700, 900]) {
      const payment = commandFromEvent(paymentEvent((row) => {
        row.amount_paid = amount;
        row.amount_requested = amount;
      }), prices);
      assert.equal(payment?.action, "payment");
      assert.equal(payment?.plan, null);
      assert.equal(payment?.priceId, null);
      assert.equal(payment?.amount, amount);
    }
    const rejected = commandFromEvent(paymentEvent((row) => {
      row.amount_paid = 701;
      row.amount_requested = 701;
    }), prices);
    assert.equal(rejected?.outcome, "amount_mismatch");
    assert.equal(rejected?.plan, null);
    assert.equal(rejected?.priceId, null);
  });

  it("accepts a signed raw clover invoice and keeps the exact body", async () => {
    const event = paidInvoice();
    const payload = ` ${JSON.stringify(event)} `;
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
    const { response, applied, body } = await posted(payload, header);
    assert.equal(response.status, 200);
    assert.equal(body.outcome, "invoice_applied");
    assert.equal(applied.length, 1);
    assert.equal(applied[0].action, "invoice");
    assert.equal(applied[0].plan, "pro");
    assert.equal(applied[0].amount, 1900);
    assert.equal(applied[0].priceId, PRICES.pro);
    assert.equal(applied[0].subscriptionId, "sub_B");
    assert.equal(applied[0].periodEnd, new Date(1798761600 * 1000).toISOString());
    assert.equal(applied[0].invoicePaymentId, null);
    assert.equal(applied[0].currency, "usd");
    assert.equal(applied[0].livemode, false);
  });

  it("rejects a bad signature without opening the store", async () => {
    const payload = JSON.stringify(paidInvoice());
    const { response, applied, body } = await posted(payload, "t=1,v1=bad");
    assert.equal(response.status, 400);
    assert.equal(body.error, "WEBHOOK_SIGNATURE_INVALID");
    assert.equal(applied.length, 0);
  });

  it("stays closed unless the webhook flag is exactly true", async () => {
    const payload = JSON.stringify(paidInvoice());
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
    const { response, applied, body } = await posted(payload, header, false);
    assert.equal(response.status, 503);
    assert.equal(body.error, "WEBHOOK_DISABLED");
    assert.equal(applied.length, 0);
  });

  it("does not treat a positive amount_paid as the full monthly price", () => {
    const command = commandFromEvent(
      distortedPaidInvoice((invoice) => {
        invoice.amount_paid = 100;
      }),
      PRICES
    );
    assert.equal(command?.action, "reject");
    assert.equal(command?.outcome, "amount_mismatch");
  });

  it("rejects discounts, credits, taxes, prorations, and out-of-band payments", () => {
    const cases: Array<[string, (invoice: InvoiceDistortion, line: LineDistortion) => void]> = [
      ["discount_not_in_scope", (invoice) => { invoice.total_discount_amounts = [{ amount: 100, discount: "di_1" }]; }],
      ["credit_not_in_scope", (invoice) => { invoice.starting_balance = -500; }],
      ["credit_not_in_scope", (invoice) => { invoice.pre_payment_credit_notes_amount = 100; }],
      ["tax_not_in_scope", (invoice) => { invoice.total_taxes = [{ amount: 20 }]; }],
      ["proration_not_in_scope", (_invoice, line) => {
        const details = line.parent?.subscription_item_details;
        if (!details) throw new Error("PAID_INVOICE_FIXTURE");
        details.proration = true;
      }],
      ["proration_not_in_scope", (_invoice, line) => {
        const details = line.parent?.subscription_item_details;
        if (!details) throw new Error("PAID_INVOICE_FIXTURE");
        details.proration_details = { credited_items: { invoice: "in_credit", invoice_line_items: ["il_old"] } };
      }],
    ];
    for (const [outcome, mutate] of cases) {
      const command = commandFromEvent(distortedPaidInvoice(mutate), PRICES);
      assert.equal(command?.action, "reject", outcome);
      assert.equal(command?.outcome, outcome);
    }
  });

  it("rejects a legacy invoice shape that is not the locked API version", () => {
    const legacy = distortedPaidInvoice((invoice, line) => {
      delete invoice.parent;
      invoice.subscription = "sub_B";
      delete line.parent;
      delete line.pricing;
      line.price = { id: PRICES.pro };
    });
    const command = commandFromEvent(legacy, PRICES);
    assert.equal(command?.action, "reject");
    assert.notEqual(command?.outcome, null);
    assert.notEqual(command?.action, "invoice");
  });

  it("reads an unexpanded invoice_payment.paid without choosing a customer", () => {
    const command = commandFromEvent(paymentEvent(), PRICES);
    assert.equal(command?.action, "payment");
    assert.equal(command?.outcome, null);
    assert.equal(command?.customerId, null);
    assert.equal(command?.subscriptionId, null);
    assert.equal(command?.plan, null);
    assert.equal(command?.invoiceId, "in_pro");
    assert.equal(command?.invoicePaymentId, "inpay_pro");
    assert.equal(command?.paymentIntentId, "pi_pro");
    assert.equal(command?.amount, 1900);
    assert.equal(command?.amountRequested, 1900);
    assert.equal(command?.currency, "usd");
    assert.equal(command?.isDefault, true);
  });

  it("rejects a payment linked to another invoice or missing a PaymentIntent id", () => {
    const malformedInvoice = commandFromEvent(paymentEvent((payment) => {
      payment.invoice = "not-an-invoice";
    }), PRICES);
    assert.equal(malformedInvoice?.action, "reject");
    assert.equal(malformedInvoice?.outcome, "payload_rejected");
    assert.equal(malformedInvoice?.customerId, null);

    const expandedMissing = commandFromEvent(paymentEvent((payment) => {
      payment.invoice = { object: "invoice" };
    }), PRICES);
    assert.equal(expandedMissing?.outcome, "payload_rejected");

    const missingIntent = commandFromEvent(paymentEvent((payment) => {
      payment.payment = { type: "payment_intent" };
    }), PRICES);
    assert.equal(missingIntent?.outcome, "payment_not_in_stripe");

    const invalidIntent = commandFromEvent(paymentEvent((payment) => {
      payment.payment = { type: "payment_intent", payment_intent: "ch_not_a_payment_intent" };
    }), PRICES);
    assert.equal(invalidIntent?.outcome, "payment_not_in_stripe");

    const expandedInvalid = commandFromEvent(paymentEvent((payment) => {
      payment.payment = { type: "payment_intent", payment_intent: { id: "py_bad", object: "payment_intent" } };
    }), PRICES);
    assert.equal(expandedInvalid?.outcome, "payment_not_in_stripe");

    const outOfBand = commandFromEvent(paymentEvent((payment) => {
      payment.payment = { type: "payment_record", payment_record: "pyr_out" };
    }), PRICES);
    assert.equal(outOfBand?.outcome, "paid_out_of_band");

    const partial = commandFromEvent(paymentEvent((payment) => {
      payment.amount_paid = 100;
      payment.amount_requested = 100;
    }), PRICES);
    assert.equal(partial?.outcome, "amount_mismatch");
  });

  it("accepts an expanded invoice and PaymentIntent id without calling Stripe", () => {
    const command = commandFromEvent(paymentEvent((payment) => {
      payment.invoice = { id: "in_pro", object: "invoice" };
      payment.payment = { type: "payment_intent", payment_intent: { id: "pi_pro", object: "payment_intent" } };
    }), PRICES);
    assert.equal(command?.action, "payment");
    assert.equal(command?.invoiceId, "in_pro");
    assert.equal(command?.paymentIntentId, "pi_pro");
    assert.equal(command?.amount, 1900);
    assert.equal(command?.customerId, null);
  });

  it("classifies live mode, the wrong API version, checkout, and refunds without payment proof", () => {
    const live = paidInvoice();
    live.livemode = true;
    assert.equal(commandFromEvent(live, PRICES)?.outcome, "livemode_rejected");

    const oldApi = paidInvoice();
    oldApi.api_version = "2024-06-20";
    assert.equal(commandFromEvent(oldApi, PRICES)?.outcome, "api_version_mismatch");

    const checkout = {
      id: "evt_checkout",
      object: "event",
      api_version: STRIPE_WEBHOOK_API_VERSION,
      created: 1763000000,
      livemode: false,
      type: "checkout.session.completed",
      data: { object: { object: "checkout.session", payment_status: "paid", id: "cs_123" } },
    } as Stripe.Event;
    assert.equal(commandFromEvent(checkout, PRICES)?.outcome, "not_payment_proof");

    const refund = { ...checkout, id: "evt_refund", type: "charge.refunded" } as Stripe.Event;
    assert.equal(commandFromEvent(refund, PRICES)?.outcome, "refund_not_applied");
  });

  it("reads subscription status without using the item period as paid time", () => {
    const command = commandFromEvent(statusEvent("trialing", true), PRICES);
    assert.equal(command?.action, "status");
    assert.equal(command?.status, "trialing");
    assert.equal(command?.cancelAtPeriodEnd, true);
    assert.equal(command?.periodEnd, null);
    assert.equal(command?.amount, null);
  });

  it("rejects a missing data object and timestamps outside the date range before the store", async () => {
    const missing = paidInvoice();
    delete (missing as { data?: unknown }).data;
    assert.equal(commandFromEvent(missing, PRICES), null);
    const missingPayload = JSON.stringify(missing);
    const missingHeader = Stripe.webhooks.generateTestHeaderString({ payload: missingPayload, secret: SECRET });
    const missingPosted = await posted(missingPayload, missingHeader);
    assert.equal(missingPosted.response.status, 400);
    assert.equal(missingPosted.body.error, "WEBHOOK_PAYLOAD_INVALID");
    assert.equal(missingPosted.applied.length, 0);

    const bareObject = paidInvoice();
    bareObject.data = {} as Stripe.Event["data"];
    assert.equal(commandFromEvent(bareObject, PRICES), null);

    const status = statusEvent("active");
    delete (status as { data?: unknown }).data;
    assert.equal(commandFromEvent(status, PRICES), null);

    const created = paidInvoice();
    created.created = 8_640_000_000_001;
    assert.equal(commandFromEvent(created, PRICES), null);
    const createdPayload = JSON.stringify(created);
    const createdHeader = Stripe.webhooks.generateTestHeaderString({ payload: createdPayload, secret: SECRET });
    const createdPosted = await posted(createdPayload, createdHeader);
    assert.equal(createdPosted.response.status, 400);
    assert.equal(createdPosted.body.error, "WEBHOOK_PAYLOAD_INVALID");
    assert.equal(createdPosted.applied.length, 0);

    const period = distortedPaidInvoice((_invoice, line) => {
      line.period = { start: 1767225600, end: 8_640_000_000_001 };
    });
    assert.equal(commandFromEvent(period, PRICES), null);
    const periodPayload = JSON.stringify(period);
    const periodHeader = Stripe.webhooks.generateTestHeaderString({ payload: periodPayload, secret: SECRET });
    const periodPosted = await posted(periodPayload, periodHeader);
    assert.equal(periodPosted.response.status, 400);
    assert.equal(periodPosted.body.error, "WEBHOOK_PAYLOAD_INVALID");
    assert.equal(periodPosted.applied.length, 0);
  });

  it("turns a parser exception into 400 and keeps a database failure at 500", async () => {
    const event = paidInvoice();
    const explosive = new Proxy(event, {
      get(target, prop, receiver) {
        if (prop === "data") throw new TypeError("data");
        return Reflect.get(target, prop, receiver);
      },
    });
    let opened = false;
    const parsed = await handleStripeWebhook({
      request: new Request("https://app.example/api/billing/webhook", {
        method: "POST",
        headers: { "stripe-signature": "signed" },
        body: "{}",
      }),
      enabled: true,
      env: ENV,
      constructEvent: () => explosive,
      accountProof: accountProof(),
      openStore: async () => {
        opened = true;
        return { async apply() { return { outcome: "invoice_applied" }; } };
      },
    });
    assert.equal(parsed.status, 400);
    assert.deepEqual(await parsed.json(), { error: "WEBHOOK_PAYLOAD_INVALID" });
    assert.equal(opened, false);

    const payload = JSON.stringify(paidInvoice());
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
    const failed = await handleStripeWebhook({
      request: new Request("https://app.example/api/billing/webhook", {
        method: "POST",
        headers: { "stripe-signature": header },
        body: payload,
      }),
      enabled: true,
      env: ENV,
      constructEvent: (body, signature, secret) => Stripe.webhooks.constructEvent(body, signature, secret),
      accountProof: accountProof(),
      openStore: async () => {
        throw new Error("database");
      },
    });
    assert.equal(failed.status, 500);
    assert.deepEqual(await failed.json(), { error: "WEBHOOK_RETRY" });
  });

  it("blocks this test receiver in production and does not store a signed live event", async () => {
    const payload = JSON.stringify(paidInvoice());
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
    for (const extra of [
      { NODE_ENV: "production", VERCEL_ENV: "preview" },
      { NODE_ENV: "development", VERCEL_ENV: "production" },
    ]) {
      let opened = false;
      const response = await handleStripeWebhook({
        request: new Request("https://app.example/api/billing/webhook", {
          method: "POST",
          headers: { "stripe-signature": header },
          body: payload,
        }),
        enabled: true,
        env: { ...ENV, ...extra },
        constructEvent: () => {
          throw new Error("signature should not run");
        },
        openStore: async () => {
          opened = true;
          return { async apply() { return { outcome: "invoice_applied" }; } };
        },
      });
      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { error: "WEBHOOK_PRODUCTION_BLOCKED" });
      assert.equal(opened, false);
    }

    const live = paidInvoice();
    live.livemode = true;
    const livePayload = JSON.stringify(live);
    const liveHeader = Stripe.webhooks.generateTestHeaderString({ payload: livePayload, secret: SECRET });
    let liveOpened = false;
    const liveResponse = await handleStripeWebhook({
      request: new Request("https://app.example/api/billing/webhook", {
        method: "POST",
        headers: { "stripe-signature": liveHeader },
        body: livePayload,
      }),
      enabled: true,
      env: ENV,
      constructEvent: (body, signature, secret) => Stripe.webhooks.constructEvent(body, signature, secret),
      openStore: async () => {
        liveOpened = true;
        return { async apply() { return { outcome: "invoice_applied" }; } };
      },
    });
    assert.equal(liveResponse.status, 400);
    assert.deepEqual(await liveResponse.json(), { error: "WEBHOOK_LIVEMODE_REJECTED" });
    assert.equal(liveOpened, false);

    const liveEnv = {
      STRIPE_WEBHOOK_SECRET: "whsec_livesecret123",
      STRIPE_ACCOUNT_ID: "acct_live",
      STRIPE_WEBHOOK_ENDPOINT: "we_live",
      STRIPE_PRICE_BASIC: PRICES.basic,
      STRIPE_PRICE_PRO: PRICES.pro,
      STRIPE_PRICE_ELITE: PRICES.elite,
      STRIPE_PRICE_BASIC_TEST_LEGACY: "price_basic700",
      STRIPE_WEBHOOK_SECRET_TEST: SECRET,
    };
    assert.deepEqual(readWebhookLiveConfig(liveEnv), {
      secret: "whsec_livesecret123",
      accountId: "acct_live",
      endpointId: "we_live",
      livemode: true,
      prices: PRICES,
    });
    assert.equal(readWebhookLiveConfig({ ...liveEnv, STRIPE_WEBHOOK_SECRET: SECRET }), null);
    const liveHeaderOk = Stripe.webhooks.generateTestHeaderString({ payload: livePayload, secret: "whsec_livesecret123" });
    let liveCommand: WebhookCommand | null = null;
    const accepted = await handleStripeWebhook({
      request: new Request("https://app.example/api/billing/webhook", {
        method: "POST",
        headers: { "stripe-signature": liveHeaderOk },
        body: livePayload,
      }),
      enabled: true,
      mode: "live",
      env: { ...liveEnv, VERCEL_ENV: "production", NODE_ENV: "production" },
      constructEvent: (body, signature, secret) => Stripe.webhooks.constructEvent(body, signature, secret),
      accountProof: accountProof("acct_live", true),
      openStore: async () => ({
        async apply(command) {
          liveCommand = command;
          return { outcome: "invoice_applied" };
        },
      }),
    });
    assert.equal(accepted.status, 200);
    assert.equal(liveCommand?.livemode, true);
    assert.equal(liveCommand?.accountId, "acct_live");
    let unverifiedOpened = false;
    const unverified = await handleStripeWebhook({
      request: new Request("https://app.example/api/billing/webhook", {
        method: "POST",
        headers: { "stripe-signature": liveHeaderOk },
        body: livePayload,
      }),
      enabled: true,
      mode: "live",
      env: liveEnv,
      constructEvent: (body, signature, secret) => Stripe.webhooks.constructEvent(body, signature, secret),
      accountProof: {
        async retrieveAccount() {
          return { id: "acct_live" };
        },
        async retrieveWebhookEndpoint(id) {
          return { id, livemode: true, status: "disabled" };
        },
      },
      openStore: async () => {
        unverifiedOpened = true;
        return { async apply() { return { outcome: "invoice_applied" }; } };
      },
    });
    assert.equal(unverified.status, 409);
    assert.deepEqual(await unverified.json(), { error: "WEBHOOK_ACCOUNT_UNVERIFIED" });
    assert.equal(unverifiedOpened, false);
    const wrongAccount = { ...live, account: "acct_other" };
    const wrongPayload = JSON.stringify(wrongAccount);
    const wrongHeader = Stripe.webhooks.generateTestHeaderString({ payload: wrongPayload, secret: "whsec_livesecret123" });
    let wrongOpened = false;
    const wrong = await handleStripeWebhook({
      request: new Request("https://app.example/api/billing/webhook", {
        method: "POST",
        headers: { "stripe-signature": wrongHeader },
        body: wrongPayload,
      }),
      enabled: true,
      mode: "live",
      env: liveEnv,
      constructEvent: (body, signature, secret) => Stripe.webhooks.constructEvent(body, signature, secret),
      openStore: async () => {
        wrongOpened = true;
        return { async apply() { return { outcome: "invoice_applied" }; } };
      },
    });
    assert.equal(wrong.status, 400);
    assert.deepEqual(await wrong.json(), { error: "WEBHOOK_ACCOUNT_REJECTED" });
    assert.equal(wrongOpened, false);
  });

  it("does not accept a deleted subscription whose status is still active", () => {
    const event = statusEvent("active");
    event.type = "customer.subscription.deleted";
    assert.equal(commandFromEvent(event, PRICES)?.outcome, "deleted_status_unexpected");
  });

  it("keeps the handler and migration on the documented boundaries", () => {
    const source = readFileSync("lib/billing/stripeWebhook.ts", "utf8");
    const route = readFileSync("app/api/billing/webhook/route.ts", "utf8");
    const sql = readFileSync("supabase/migrations/20261112_billing_stripe_events.sql", "utf8");
    const proof = readFileSync("supabase/migrations/20261117_billing_invoice_payment_proof.sql", "utf8");
    assert.match(source, /request\.text\(\)/);
    assert.doesNotMatch(source, /request\.json\(|api\.stripe\.com|customers\.create|\.paid_out_of_band/);
    assert.match(route, /process\.env\.BILLING_WEBHOOK_ENABLED === "true"/);
    assert.match(route, /process\.env\.BILLING_LIVE_WEBHOOK_ENABLED === "true"/);
    assert.match(route, /WEBHOOK_MODE_AMBIGUOUS/);
    assert.match(route, /constructEvent/);
    assert.doesNotMatch(route, /process\.env\.BILLING_WEBHOOK_ENABLED\s*=\s*"true"/);
    assert.match(source, /VERCEL_ENV === "production"/);
    assert.match(source, /NODE_ENV === "production"/);
    assert.match(source, /livemode=false does not by itself isolate the database/);
    assert.match(source, /does not retrieve a PaymentIntent/);
    assert.doesNotMatch(source, /paymentIntents/);
    assert.match(sql, /when 'trialing' then 30/);
    assert.match(sql, /when 'past_due' then 20/);
    assert.match(sql, /when 'active' then 10/);
    assert.match(sql, /for update/);
    assert.match(sql, /grant select, insert on table public\.billing_stripe_events to service_role/);
    assert.match(sql, /grant select, insert on table public\.billing_stripe_invoices to service_role/);
    assert.doesNotMatch(sql, /grant (update|delete) on table public\.billing_stripe_events/i);
    assert.doesNotMatch(sql, /grant update on table public\.billing_stripe_customers/i);
    assert.doesNotMatch(sql, /grant delete/i);
    assert.match(proof, /drop function public\.billing_apply_stripe_event/);
    assert.match(proof, /grant select, insert, update on table public\.billing_stripe_invoice_proofs to service_role/);
    assert.match(proof, /Unique here by product rule/);
    assert.doesNotMatch(proof, /grant delete/i);
    assert.doesNotMatch(proof, /grant update on table public\.billing_stripe_events/i);
    assert.match(proof, /p_amount <> 700/);
    const widened = readFileSync("supabase/migrations/20261120_billing_basic_amount_900.sql", "utf8");
    assert.match(widened, /create or replace function public\.billing_apply_stripe_event/);
    assert.match(widened, /p_amount not in \(700, 900, 1900, 3900\)/);
    assert.match(widened, /p_plan = 'basic' and p_amount not in \(700, 900\)/);
    assert.match(widened, /grant execute on function public\.billing_apply_stripe_event\(/);
    assert.match(widened, /to service_role;/);
    assert.doesNotMatch(widened, /grant delete/i);
    assert.doesNotMatch(widened, /p_amount <> 700/);
    assert.doesNotMatch(widened, /p_amount not in \(700, 1900, 3900\)/);
    const modeSql = readFileSync("supabase/migrations/20261121_billing_livemode_account.sql", "utf8");
    assert.match(modeSql, /drop function public\.billing_apply_stripe_event/);
    assert.match(modeSql, /p_account_id text/);
    assert.match(modeSql, /mode_mismatch/);
    assert.match(modeSql, /mode_unknown/);
    assert.match(modeSql, /account_mismatch/);
    assert.match(modeSql, /account_unknown/);
    assert.match(modeSql, /p_amount not in \(700, 900, 1900, 3900\)/);
    assert.doesNotMatch(modeSql, /grant delete/i);
    assert.doesNotMatch(modeSql, /grant update on table public\.billing_stripe_customers/i);
    const bindingSql = readFileSync("supabase/migrations/20261122_billing_verified_binding.sql", "utf8");
    assert.match(bindingSql, /create or replace function public\.billing_apply_stripe_event/);
    assert.match(bindingSql, /binding_unverified/);
    assert.match(bindingSql, /grant update \(livemode, stripe_account_id\) on table public\.billing_stripe_customers to service_role/);
    assert.doesNotMatch(bindingSql, /grant delete/i);
    assert.doesNotMatch(bindingSql, /drop function public\.billing_apply_stripe_event/);
    assert.match(source, /does not prove which Stripe account/);
    assert.match(source, /Ordinary account events omit event.account/);
    const liveReader = source.slice(
      source.indexOf("export function readWebhookLiveConfig"),
      source.indexOf("export function commandFromEvent"),
    );
    assert.doesNotMatch(liveReader, /STRIPE_PRICE_BASIC_TEST_LEGACY/);
    assert.doesNotMatch(liveReader, /legacyBasic/);
  });
});
