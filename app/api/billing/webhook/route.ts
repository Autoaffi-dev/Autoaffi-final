import Stripe from "stripe";
import { createSupabaseStripeEventStore } from "@/lib/billing/stripeEventStore";
import { handleStripeWebhook } from "@/lib/billing/stripeWebhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleStripeWebhook({
    request,
    enabled: process.env.BILLING_WEBHOOK_ENABLED === "true",
    env: process.env,
    constructEvent: (payload, header, secret) => Stripe.webhooks.constructEvent(payload, header, secret),
    openStore: async () => {
      const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
      return createSupabaseStripeEventStore(supabaseAdmin);
    },
  });
}
