export const CHECKOUT_PLANS = ["basic", "pro", "elite"] as const;

export type CheckoutPlan = (typeof CHECKOUT_PLANS)[number];

export const CHECKOUT_PRICE_CENTS: Record<CheckoutPlan, number> = {
  basic: 900,
  pro: 1900,
  elite: 3900,
};

// Historical Basic amount. New checkout accepts only CHECKOUT_PRICE_CENTS.basic.
// The test webhook binds this amount to STRIPE_PRICE_BASIC_TEST_LEGACY, not to
// the current Basic price id.
export const LEGACY_BASIC_PRICE_CENTS = 700;

export const BLOCKING_SUBSCRIPTION_STATUSES = [
  "incomplete",
  "trialing",
  "active",
  "past_due",
  "unpaid",
  "paused",
] as const;

export const CHECKOUT_ATTEMPT_TIMEOUT_MS = 20_000;
export const CHECKOUT_RETRY_MARGIN_MS = 5 * 60 * 1000;
export const CHECKOUT_IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

const BLOCKING = new Set<string>(BLOCKING_SUBSCRIPTION_STATUSES);

export function isBlockingSubscriptionStatus(status: string): boolean {
  return BLOCKING.has(status);
}

export function latestStart(anchor: Date): Date {
  return new Date(
    anchor.getTime() + CHECKOUT_IDEMPOTENCY_WINDOW_MS - CHECKOUT_RETRY_MARGIN_MS - CHECKOUT_ATTEMPT_TIMEOUT_MS
  );
}

export function canStartIdempotentPost(anchor: Date, now: Date): boolean {
  return now.getTime() < latestStart(anchor).getTime();
}

export function readCheckoutOrigin(
  env: { readonly [key: string]: string | undefined },
  nodeEnv: string | undefined
): string | null {
  const raw = String(env.NEXT_PUBLIC_APP_URL || "").trim();
  if (!raw) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (nodeEnv === "production") {
    if (parsed.protocol !== "https:") return null;
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") return null;
  }
  return parsed.origin;
}

export function requestOriginAllowed(request: Request, origin: string): boolean {
  const header = request.headers.get("origin");
  if (!header || header !== origin) return false;
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  return true;
}

export function returnUrls(origin: string, attemptId: string): { success: string; cancel: string } {
  const base = `${origin}/billing/checkout/return?attempt=${attemptId}`;
  return {
    success: `${base}&result=success`,
    cancel: `${base}&result=cancel`,
  };
}

export type PriceSnapshot = {
  id: string;
  active: boolean;
  currency: string;
  livemode: boolean;
  type: string;
  billingScheme: string;
  unitAmount: number | null;
  customUnitAmount: boolean;
  interval: string | null;
  intervalCount: number | null;
  usageType: string | null;
  meter: string | null;
};

export function priceMatchesPlan(plan: CheckoutPlan, price: PriceSnapshot, livemode: boolean): boolean {
  return (
    price.id.startsWith("price_") &&
    price.active === true &&
    price.currency === "usd" &&
    price.livemode === livemode &&
    price.type === "recurring" &&
    price.billingScheme === "per_unit" &&
    price.customUnitAmount === false &&
    price.interval === "month" &&
    price.intervalCount === 1 &&
    price.usageType === "licensed" &&
    price.meter === null &&
    price.unitAmount === CHECKOUT_PRICE_CENTS[plan]
  );
}

export type LiveCheckoutConfig = {
  secret: string;
  origin: string;
  prices: Record<CheckoutPlan, string>;
};

export type ReconciliationConfig = {
  secret: string;
  origin: string;
  prices: Record<CheckoutPlan, string | null>;
};

export class CheckoutConfigError extends Error {
  constructor() {
    super("CHECKOUT_CONFIG_REJECTED");
    this.name = "CheckoutConfigError";
  }
}

export function checkoutEnabled(env: { readonly [key: string]: string | undefined }): boolean {
  return env.BILLING_CHECKOUT_ENABLED === "true";
}

function readCheckoutSecret(env: { readonly [key: string]: string | undefined }): string {
  const secret = String(env.STRIPE_SECRET_KEY || "");
  if (!secret.startsWith("sk_live_") || secret.startsWith("sk_test_") || secret.includes("rk_")) {
    throw new CheckoutConfigError();
  }
  return secret;
}

function optionalPriceId(value: string | undefined): string | null {
  const id = String(value || "");
  return /^price_[A-Za-z0-9]+$/.test(id) ? id : null;
}

export function readCheckoutReconciliationConfig(
  env: { readonly [key: string]: string | undefined },
  nodeEnv: string | undefined
): ReconciliationConfig {
  const secret = readCheckoutSecret(env);
  const origin = readCheckoutOrigin(env, nodeEnv);
  if (!origin || (nodeEnv === "production" && !origin.startsWith("https://"))) throw new CheckoutConfigError();
  return {
    secret,
    origin,
    prices: {
      basic: optionalPriceId(env.STRIPE_PRICE_BASIC),
      pro: optionalPriceId(env.STRIPE_PRICE_PRO),
      elite: optionalPriceId(env.STRIPE_PRICE_ELITE),
    },
  };
}

export function purchasePriceId(prices: Record<CheckoutPlan, string>, plan: CheckoutPlan): string | null {
  const ids = CHECKOUT_PLANS.map((name) => prices[name]);
  if (ids.some((id) => !/^price_[A-Za-z0-9]+$/.test(id))) return null;
  if (new Set(ids).size !== ids.length) return null;
  return prices[plan];
}

export function readLiveCheckoutConfig(
  env: { readonly [key: string]: string | undefined },
  nodeEnv: string | undefined
): LiveCheckoutConfig {
  const config = readCheckoutReconciliationConfig(env, nodeEnv);
  const prices = {
    basic: config.prices.basic || "",
    pro: config.prices.pro || "",
    elite: config.prices.elite || "",
  };
  if (!purchasePriceId(prices, "basic") || !purchasePriceId(prices, "pro") || !purchasePriceId(prices, "elite")) {
    throw new CheckoutConfigError();
  }
  return { secret: config.secret, origin: config.origin, prices };
}
