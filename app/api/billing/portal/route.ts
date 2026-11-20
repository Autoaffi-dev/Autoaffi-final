import { requireUserId } from "@/lib/auth/server";
import { createSupabaseBillingCustomerStore } from "@/lib/billing/billingCustomerStore";
import type { BillingCustomerQueryClient } from "@/lib/billing/billingCustomerStore";
import { handlePortalPost, readPortalConfig, type PortalCustomer } from "@/lib/billing/portalSession";
import { stripeClientForSecret } from "@/lib/billing/stripeCheckout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handlePortalPost({
    request,
    enabled: process.env.BILLING_PORTAL_ENABLED === "true",
    env: process.env,
    nodeEnv: process.env.NODE_ENV,
    resolveUserId: requireUserId,
    open: async () => {
      const config = readPortalConfig(process.env, process.env.NODE_ENV);
      if (!config) throw new Error("PORTAL_CONFIG");
      const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
      const stripe = stripeClientForSecret(config.secret);
      return {
        config,
        customers: createSupabaseBillingCustomerStore(supabaseAdmin as unknown as BillingCustomerQueryClient),
        stripe: {
          async retrieveAccount() {
            const account = await stripe.accounts.retrieve();
            return { id: account.id };
          },
          async retrieveCustomer(customerId: string): Promise<PortalCustomer> {
            const customer = await stripe.customers.retrieve(customerId);
            if ("deleted" in customer && customer.deleted) return { id: customer.id, deleted: true };
            const userId = typeof customer.metadata?.user_id === "string" ? customer.metadata.user_id : null;
            return { id: customer.id, deleted: false, livemode: customer.livemode, userId };
          },
          async createPortalSession(input) {
            const session = await stripe.billingPortal.sessions.create({
              customer: input.customerId,
              return_url: input.returnUrl,
              configuration: input.configurationId,
            });
            return { url: session.url };
          },
        },
      };
    },
  });
}
