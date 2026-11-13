import type { WebhookCommand } from "./stripeWebhook";

export class StripeEventStoreError extends Error {
  constructor() {
    super("WEBHOOK_STORE_FAILED");
    this.name = "StripeEventStoreError";
  }
}

export type StripeEventQueryClient = {
  rpc(
    fn: "billing_apply_stripe_event",
    args: Record<string, string | number | boolean | null>
  ): PromiseLike<{
    data: { outcome?: unknown } | string | null;
    error: { message?: string } | null;
  }>;
};

export type StripeEventStore = {
  apply(command: WebhookCommand): Promise<{ outcome: string }>;
};

export function createSupabaseStripeEventStore(client: StripeEventQueryClient): StripeEventStore {
  return {
    async apply(command) {
      const result = await client.rpc("billing_apply_stripe_event", {
        p_event_id: command.eventId,
        p_event_type: command.eventType,
        p_event_created: command.eventCreated,
        p_livemode: command.livemode,
        p_api_version: command.apiVersion,
        p_action: command.action,
        p_outcome: command.outcome,
        p_customer_id: command.customerId,
        p_subscription_id: command.subscriptionId,
        p_status: command.status,
        p_cancel_at_period_end: command.cancelAtPeriodEnd,
        p_invoice_id: command.invoiceId,
        p_price_id: command.priceId,
        p_plan: command.plan,
        p_amount: command.amount,
        p_period_start: command.periodStart,
        p_period_end: command.periodEnd,
        p_metadata_user_id: command.metadataUserId,
      });
      if (result.error || result.data == null) throw new StripeEventStoreError();
      const data = typeof result.data === "string" ? parseOutcome(result.data) : result.data;
      if (!data || typeof data.outcome !== "string" || !data.outcome) throw new StripeEventStoreError();
      return { outcome: data.outcome };
    },
  };
}

function parseOutcome(value: string): { outcome?: unknown } | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as { outcome?: unknown };
  } catch {
    return null;
  }
}
