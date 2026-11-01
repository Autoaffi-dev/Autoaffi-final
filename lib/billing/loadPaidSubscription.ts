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
        maybeSingle(): PromiseLike<{
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
  if (db) {
    const result = await db
      .from("billing_subscriptions")
      .select(PAID_SUBSCRIPTION_COLUMNS)
      .eq("user_id", userId)
      .maybeSingle();
    return paidPlanFromResult(result.data, result.error);
  }

  const { supabaseAdmin } = await import("../supabaseAdmin");
  const result = await supabaseAdmin
    .from("billing_subscriptions")
    .select(PAID_SUBSCRIPTION_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  return paidPlanFromResult(result.data, result.error);
}

function paidPlanFromResult(
  data: PaidSubscriptionSnapshot | null,
  error: { message?: string } | null
): PaidSubscriptionSnapshot | null {
  if (error) throw new EntitlementReadError();
  return data ?? null;
}
