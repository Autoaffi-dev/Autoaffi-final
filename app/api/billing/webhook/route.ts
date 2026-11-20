import Stripe from "stripe";
import { createSupabaseStripeEventStore } from "@/lib/billing/stripeEventStore";
import { handleStripeWebhook } from "@/lib/billing/stripeWebhook";

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
  return handleStripeWebhook({
    request,
    enabled: testEnabled || liveEnabled,
    mode: liveEnabled ? "live" : "test",
    env: process.env,
    constructEvent: (payload, header, secret) => Stripe.webhooks.constructEvent(payload, header, secret),
    openStore: async () => {
      const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
      return createSupabaseStripeEventStore(supabaseAdmin);
    },
  });
}
