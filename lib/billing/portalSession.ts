import { requestOriginAllowed, readCheckoutOrigin } from "./checkoutConfig";
import type { BillingCustomerStore } from "./billingCustomer";

const ACCOUNT_ID = /^acct_[A-Za-z0-9]+$/;
const CONFIGURATION_ID = /^bpc_[A-Za-z0-9]+$/;

export type PortalMode = "test" | "live";

export type PortalConfig = {
  secret: string;
  origin: string;
  accountId: string;
  configurationId: string;
  livemode: boolean;
};

export type PortalCustomer = {
  id: string;
  deleted: false;
  livemode: boolean;
  userId: string | null;
} | {
  id: string;
  deleted: true;
};

export type PortalStripe = {
  retrieveAccount(): Promise<{ id: string }>;
  retrieveCustomer(customerId: string): Promise<PortalCustomer>;
  createPortalSession(input: {
    customerId: string;
    returnUrl: string;
    configurationId: string;
  }): Promise<{ url: string }>;
};

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "private, no-store",
};

function json(status: number, body: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export function portalReturnUrl(origin: string): string {
  return `${origin}/login/dashboard`;
}

export function readPortalConfig(
  env: { readonly [key: string]: string | undefined },
  nodeEnv: string | undefined
): PortalConfig | null {
  const secret = String(env.STRIPE_SECRET_KEY || "");
  const live = secret.startsWith("sk_live_");
  const test = secret.startsWith("sk_test_");
  if (live === test || secret.includes("rk_")) return null;
  const origin = readCheckoutOrigin(env, nodeEnv);
  if (!origin) return null;
  const accountId = live ? String(env.STRIPE_ACCOUNT_ID || "") : String(env.STRIPE_ACCOUNT_ID_TEST || "");
  const configurationId = live
    ? String(env.STRIPE_PORTAL_CONFIGURATION || "")
    : String(env.STRIPE_PORTAL_CONFIGURATION_TEST || "");
  if (!ACCOUNT_ID.test(accountId) || !CONFIGURATION_ID.test(configurationId)) return null;
  const otherConfiguration = live
    ? String(env.STRIPE_PORTAL_CONFIGURATION_TEST || "")
    : String(env.STRIPE_PORTAL_CONFIGURATION || "");
  if (otherConfiguration !== "" && otherConfiguration === configurationId) return null;
  return { secret, origin, accountId, configurationId, livemode: live };
}

export async function handlePortalPost(input: {
  request: Request;
  enabled: boolean;
  env: { readonly [key: string]: string | undefined };
  nodeEnv: string | undefined;
  resolveUserId: (request: Request) => Promise<string>;
  open: () => Promise<{ customers: BillingCustomerStore; stripe: PortalStripe; config: PortalConfig }>;
}): Promise<Response> {
  if (!input.enabled) return json(503, { error: "PORTAL_DISABLED" });
  const config = readPortalConfig(input.env, input.nodeEnv);
  if (!config || !requestOriginAllowed(input.request, config.origin)) {
    if (!config) return json(500, { error: "PORTAL_CONFIG" });
    return json(403, { error: "PORTAL_ORIGIN_REJECTED" });
  }

  let userId = "";
  try {
    userId = String((await input.resolveUserId(input.request)) || "");
  } catch (err) {
    const unauthorized = err instanceof Error && err.message === "UNAUTHORIZED";
    return json(unauthorized ? 401 : 500, { error: unauthorized ? "UNAUTHORIZED" : "PORTAL_READ_FAILED" });
  }
  if (!userId) return json(401, { error: "UNAUTHORIZED" });

  let runtime: { customers: BillingCustomerStore; stripe: PortalStripe; config: PortalConfig };
  try {
    runtime = await input.open();
  } catch {
    return json(500, { error: "PORTAL_CONFIG" });
  }
  if (
    runtime.config.livemode !== config.livemode ||
    runtime.config.accountId !== config.accountId ||
    runtime.config.configurationId !== config.configurationId ||
    runtime.config.origin !== config.origin
  ) {
    return json(500, { error: "PORTAL_CONFIG" });
  }

  let binding;
  try {
    binding = await runtime.customers.findByUserId(userId);
  } catch {
    return json(500, { error: "PORTAL_READ_FAILED" });
  }
  if (!binding || binding.userId !== userId) return json(409, { error: "PORTAL_CUSTOMER_MISSING" });

  let account: { id: string };
  let customer: PortalCustomer;
  try {
    account = await runtime.stripe.retrieveAccount();
    customer = await runtime.stripe.retrieveCustomer(binding.stripeCustomerId);
  } catch {
    return json(500, { error: "PORTAL_READ_FAILED" });
  }
  if (account.id !== config.accountId) return json(409, { error: "PORTAL_ACCOUNT_REJECTED" });
  if (customer.deleted || customer.livemode !== config.livemode || customer.userId !== userId || customer.id !== binding.stripeCustomerId) {
    return json(409, { error: "PORTAL_CUSTOMER_REJECTED" });
  }

  try {
    const session = await runtime.stripe.createPortalSession({
      customerId: binding.stripeCustomerId,
      returnUrl: portalReturnUrl(config.origin),
      configurationId: config.configurationId,
    });
    if (!session.url.startsWith("https://")) return json(502, { error: "PORTAL_LINK_REJECTED" });
    return json(200, { url: session.url });
  } catch {
    return json(502, { error: "PORTAL_LINK_REJECTED" });
  }
}
