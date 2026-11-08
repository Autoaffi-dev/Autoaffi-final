import Stripe from "stripe";
import {
  CHECKOUT_ATTEMPT_TIMEOUT_MS,
  type PriceSnapshot,
} from "./checkoutConfig";
import type { CheckoutAttempt } from "./checkoutStore";

export class CheckoutTransportError extends Error {
  constructor() {
    super("CHECKOUT_TRANSPORT");
    this.name = "CheckoutTransportError";
  }
}

export class CheckoutRequestError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number) {
    super("CHECKOUT_HTTP");
    this.name = "CheckoutRequestError";
    this.statusCode = statusCode;
  }
}

export type CustomerSnapshot =
  | { id: string; deleted: true }
  | { id: string; deleted: false; livemode: boolean; userId: string | null };

export type SessionLine = { priceId: string | null; quantity: number | null };

export type SessionSnapshot = {
  id: string;
  url: string | null;
  status: "open" | "complete" | "expired";
  customerId: string | null;
  livemode: boolean;
  mode: string | null;
  clientReferenceId: string | null;
  metadata: Record<string, string>;
  successUrl: string | null;
  cancelUrl: string | null;
  lineItems: SessionLine[] | null;
  lineItemsComplete: boolean;
};

export type SubscriptionScan =
  | { complete: true; blocking: boolean }
  | { complete: false };

export type SessionList =
  | { complete: true; sessions: SessionSnapshot[] }
  | { complete: false };

export type CheckoutStripe = {
  retrieveAccount(): Promise<{ id: string }>;
  retrievePrice(priceId: string): Promise<PriceSnapshot>;
  retrieveCustomer(customerId: string): Promise<CustomerSnapshot>;
  createCustomer(
    params: { metadata: { user_id: string } },
    options: { idempotencyKey: string }
  ): Promise<{ id: string }>;
  listSubscriptions(customerId: string): Promise<SubscriptionScan>;
  createSession(row: CheckoutAttempt, idempotencyKey: string): Promise<SessionSnapshot>;
  retrieveSession(sessionId: string): Promise<SessionSnapshot>;
  listSessions(customerId: string): Promise<SessionList>;
  expireSession(sessionId: string, idempotencyKey: string): Promise<void>;
};

const BLOCKING = new Set(["incomplete", "trialing", "active", "past_due", "unpaid", "paused"]);

function asRecord(err: unknown): { type?: string; statusCode?: number } {
  if (typeof err !== "object" || err === null) return {};
  return err as { type?: string; statusCode?: number };
}

export function wrapStripeError(err: unknown): never {
  if (err instanceof CheckoutTransportError || err instanceof CheckoutRequestError) throw err;
  const record = asRecord(err);
  if (record.type === "StripeConnectionError" || record.type === "StripeConnectionTimeoutError") {
    throw new CheckoutTransportError();
  }
  if (typeof record.statusCode === "number") throw new CheckoutRequestError(record.statusCode);
  throw new CheckoutRequestError(0);
}

function metadataOf(value: Stripe.Metadata | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!value) return out;
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") out[key] = entry;
  }
  return out;
}

function priceIdOf(price: string | Stripe.Price | Stripe.DeletedPrice | null | undefined): string | null {
  if (!price) return null;
  if (typeof price === "string") return price;
  return typeof price.id === "string" ? price.id : null;
}

export function lineItemsOf(
  list: Stripe.ApiList<Stripe.LineItem> | null | undefined
): { items: SessionLine[] | null; complete: boolean } {
  if (!list || !Array.isArray(list.data) || list.has_more === true) {
    return { items: null, complete: false };
  }
  return {
    items: list.data.map((item) => ({
      priceId: priceIdOf(item.price),
      quantity: typeof item.quantity === "number" ? item.quantity : null,
    })),
    complete: true,
  };
}

export function snapshotSession(session: Stripe.Checkout.Session): SessionSnapshot {
  const customer = session.customer;
  const customerId =
    typeof customer === "string" ? customer : customer && "id" in customer ? customer.id : null;
  const status = session.status;
  if (status !== "open" && status !== "complete" && status !== "expired") {
    throw new CheckoutRequestError(0);
  }
  const lines = lineItemsOf(session.line_items ?? undefined);
  return {
    id: session.id,
    url: typeof session.url === "string" ? session.url : null,
    status,
    customerId,
    livemode: session.livemode,
    mode: session.mode,
    clientReferenceId: session.client_reference_id,
    metadata: metadataOf(session.metadata),
    successUrl: session.success_url,
    cancelUrl: session.cancel_url,
    lineItems: lines.items,
    lineItemsComplete: lines.complete,
  };
}

export function createParamsForAttempt(row: CheckoutAttempt): Stripe.Checkout.SessionCreateParams {
  return {
    mode: "subscription",
    customer: row.stripe_customer_id,
    line_items: [{ price: row.stripe_price_id, quantity: 1 }],
    success_url: row.success_url,
    cancel_url: row.cancel_url,
    client_reference_id: row.id,
    metadata: {
      user_id: row.user_id,
      plan: row.plan,
      attempt_id: row.id,
    },
    adaptive_pricing: { enabled: false },
    automatic_tax: { enabled: false },
    expand: ["line_items"],
  };
}

function snapshotPrice(price: Stripe.Price): PriceSnapshot {
  return {
    id: price.id,
    active: price.active,
    currency: price.currency,
    livemode: price.livemode,
    type: price.type,
    billingScheme: price.billing_scheme,
    unitAmount: price.unit_amount,
    customUnitAmount: price.custom_unit_amount !== null,
    interval: price.recurring?.interval ?? null,
    intervalCount: price.recurring?.interval_count ?? null,
    usageType: price.recurring?.usage_type ?? null,
    meter: price.recurring?.meter ?? null,
  };
}

export function createStripeCheckoutClient(stripe: Stripe): CheckoutStripe {
  return {
    async retrieveAccount() {
      try {
        const account = await stripe.accounts.retrieve();
        return { id: account.id };
      } catch (err) {
        wrapStripeError(err);
      }
    },
    async retrievePrice(priceId) {
      try {
        return snapshotPrice(await stripe.prices.retrieve(priceId));
      } catch (err) {
        wrapStripeError(err);
      }
    },
    async retrieveCustomer(customerId) {
      try {
        const customer = await stripe.customers.retrieve(customerId);
        if ("deleted" in customer && customer.deleted) return { id: customer.id, deleted: true };
        const userId = typeof customer.metadata?.user_id === "string" ? customer.metadata.user_id : null;
        return { id: customer.id, deleted: false, livemode: customer.livemode, userId };
      } catch (err) {
        wrapStripeError(err);
      }
    },
    async createCustomer(params, options) {
      try {
        const created = await stripe.customers.create(
          { metadata: { user_id: params.metadata.user_id } },
          { idempotencyKey: options.idempotencyKey }
        );
        return { id: created.id };
      } catch (err) {
        wrapStripeError(err);
      }
    },
    async listSubscriptions(customerId) {
      try {
        const blocking = new Set<string>();
        let startingAfter: string | undefined;
        for (let page = 0; page < 20; page += 1) {
          const listed = await stripe.subscriptions.list({
            customer: customerId,
            status: "all",
            limit: 100,
            starting_after: startingAfter,
          });
          for (const subscription of listed.data) {
            if (BLOCKING.has(subscription.status)) blocking.add(subscription.id);
          }
          if (!listed.has_more) return { complete: true, blocking: blocking.size > 0 };
          const last = listed.data[listed.data.length - 1];
          if (!last) return { complete: false };
          startingAfter = last.id;
        }
        return { complete: false };
      } catch (err) {
        wrapStripeError(err);
      }
    },
    async createSession(row, idempotencyKey) {
      try {
        const created = await stripe.checkout.sessions.create(createParamsForAttempt(row), { idempotencyKey });
        return snapshotSession(created);
      } catch (err) {
        wrapStripeError(err);
      }
    },
    async retrieveSession(sessionId) {
      try {
        return snapshotSession(await stripe.checkout.sessions.retrieve(sessionId, { expand: ["line_items"] }));
      } catch (err) {
        wrapStripeError(err);
      }
    },
    async listSessions(customerId) {
      try {
        const sessions: SessionSnapshot[] = [];
        let startingAfter: string | undefined;
        for (let page = 0; page < 20; page += 1) {
          const listed = await stripe.checkout.sessions.list({
            customer: customerId,
            limit: 100,
            starting_after: startingAfter,
            expand: ["data.line_items"],
          });
          for (const session of listed.data) sessions.push(snapshotSession(session));
          if (!listed.has_more) return { complete: true, sessions };
          const last = listed.data[listed.data.length - 1];
          if (!last) return { complete: false };
          startingAfter = last.id;
        }
        return { complete: false };
      } catch (err) {
        wrapStripeError(err);
      }
    },
    async expireSession(sessionId, idempotencyKey) {
      try {
        await stripe.checkout.sessions.expire(sessionId, {}, { idempotencyKey });
      } catch (err) {
        wrapStripeError(err);
      }
    },
  };
}

export function stripeClientForSecret(secret: string): Stripe {
  return new Stripe(secret, {
    apiVersion: "2025-11-17.clover",
    maxNetworkRetries: 0,
    timeout: CHECKOUT_ATTEMPT_TIMEOUT_MS,
    telemetry: false,
  });
}
