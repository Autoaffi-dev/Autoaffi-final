import Stripe from "stripe";
import { createSupabaseStripeEventStore } from "@/lib/billing/stripeEventStore";
import { handleStripeWebhook, type WebhookAccountProof, type WebhookMode } from "@/lib/billing/stripeWebhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const testEnabled = process.env.BILLING_WEBHOOK_ENABLED === "true";
  const liveEnabled = process.env.BILLING_LIVE_WEBHOOK_ENABLED === "true";
  if (testEnabled && liveEnabled) {
    return new Response(JSON.stringify({ error: "WEBHOOK_MODE_AMBIGUOUS" }), {
      status: 409,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" },
    });
  }
  const mode: WebhookMode = liveEnabled ? "live" : "test";
  return handleStripeWebhook({
    request,
    enabled: testEnabled || liveEnabled,
    mode,
    env: process.env,
    constructEvent: (payload, header, secret) => Stripe.webhooks.constructEvent(payload, header, secret),
    accountProof: accountProof(mode),
    openStore: async () => {
      const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
      return createSupabaseStripeEventStore(supabaseAdmin);
    },
  });
}

function accountProof(mode: WebhookMode): WebhookAccountProof {
  let stripe: Stripe | null = null;
  function client(): Stripe {
    if (stripe) return stripe;
    const secret = mode === "live" ? process.env.STRIPE_SECRET_KEY ?? "" : process.env.STRIPE_SECRET_KEY_TEST ?? "";
    const live = secret.startsWith("sk_live_");
    const test = secret.startsWith("sk_test_");
    if (live === test || secret.includes("rk_") || (mode === "live") !== live) {
      throw new Error("WEBHOOK_CONFIG");
    }
    stripe = new Stripe(secret, {
      apiVersion: "2025-11-17.clover",
      maxNetworkRetries: 0,
      timeout: 10_000,
      telemetry: false,
    });
    return stripe;
  }
  return {
    async retrieveAccount() {
      const account = await client().accounts.retrieve();
      return { id: account.id };
    },
    async retrieveWebhookEndpoint(id) {
      const endpoint = await client().webhookEndpoints.retrieve(id);
      if ("deleted" in endpoint && endpoint.deleted) {
        return { id: endpoint.id, livemode: false, status: "disabled", deleted: true };
      }
      return { id: endpoint.id, livemode: endpoint.livemode, status: endpoint.status };
    },
  };
}
