import { requireUserId } from "@/lib/auth/server";
import { createSupabaseBillingCustomerStore } from "@/lib/billing/billingCustomerStore";
import type { BillingCustomerQueryClient } from "@/lib/billing/billingCustomerStore";
import { readCheckoutReconciliationConfig } from "@/lib/billing/checkoutConfig";
import { handleCheckoutPost } from "@/lib/billing/checkoutSession";
import { createSupabaseCheckoutStore } from "@/lib/billing/checkoutStore";
import type { CheckoutQueryClient } from "@/lib/billing/checkoutStore";
import { loadPaidSubscription } from "@/lib/billing/loadPaidSubscription";
import { createStripeCheckoutClient, stripeClientForSecret } from "@/lib/billing/stripeCheckout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleCheckoutPost({
    request,
    resolveUserId: requireUserId,
    enabled: process.env.BILLING_CHECKOUT_ENABLED === "true",
    openRuntime: async () => {
      const config = readCheckoutReconciliationConfig(process.env, process.env.NODE_ENV);
      const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
      const db = supabaseAdmin as unknown as BillingCustomerQueryClient & CheckoutQueryClient;
      return {
        origin: config.origin,
        prices: {
          basic: config.prices.basic ?? "",
          pro: config.prices.pro ?? "",
          elite: config.prices.elite ?? "",
        },
        livemode: true,
        loadSubscription: loadPaidSubscription,
        customerStore: createSupabaseBillingCustomerStore(db),
        checkoutStore: createSupabaseCheckoutStore(db),
        stripe: createStripeCheckoutClient(stripeClientForSecret(config.secret)),
      };
    },
  });
}
