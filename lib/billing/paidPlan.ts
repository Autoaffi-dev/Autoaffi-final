export const PAID_SUBSCRIPTION_COLUMNS =
  "user_id,paid_plan,subscription_status,paid_until,cancel_at_period_end";

const KNOWN_PAID_PLANS = new Set(["basic", "pro", "elite"]);
const GRANTING_STATUSES = new Set(["active", "past_due"]);

export type EntitlementPlan = "none" | "basic" | "pro" | "elite";

export type PaidSubscriptionSnapshot = {
  user_id: string;
  paid_plan: string;
  subscription_status: string;
  paid_until: string;
  cancel_at_period_end?: boolean | null;
  pending_plan?: string | null;
};

/**
 * Paid access for one user.
 * pending_plan is ignored.
 * cancel_at_period_end does not remove access while status is active or
 * past_due and paid_until is strictly after now.
 */
export function getPaidPlan(
  row: PaidSubscriptionSnapshot | null | undefined,
  userId: string,
  now: Date
): EntitlementPlan {
  if (!row || !userId || row.user_id !== userId) return "none";
  if (!KNOWN_PAID_PLANS.has(row.paid_plan)) return "none";
  if (!GRANTING_STATUSES.has(row.subscription_status)) return "none";

  const paidUntil = Date.parse(row.paid_until);
  if (!Number.isFinite(paidUntil) || paidUntil <= now.getTime()) return "none";

  return row.paid_plan as EntitlementPlan;
}
