import {
  PAID_SUBSCRIPTION_COLUMNS,
  type PaidSubscriptionSnapshot,
} from "./paidPlan";

export class EntitlementReadError extends Error {
  constructor() {
    super("ENTITLEMENT_READ_FAILED");
    this.name = "EntitlementReadError";
  }
}

export type SubscriptionReadClient = {
  from(table: string): {
    select(columns: string): {
      eq(
        column: string,
        value: string
      ): {
        maybeSingle(): Promise<{
          data: PaidSubscriptionSnapshot | null;
          error: { message?: string } | null;
        }>;
      };
    };
  };
};

export async function loadPaidSubscription(
  userId: string,
  db?: SubscriptionReadClient
): Promise<PaidSubscriptionSnapshot | null> {
  const client = db ?? (await defaultAdmin());
  const result = await client
    .from("billing_subscriptions")
    .select(PAID_SUBSCRIPTION_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();

  if (result.error) throw new EntitlementReadError();
  return result.data ?? null;
}

async function defaultAdmin(): Promise<SubscriptionReadClient> {
  const mod = await import("../supabaseAdmin");
  return mod.supabaseAdmin as SubscriptionReadClient;
}
