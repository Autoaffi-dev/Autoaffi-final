export const PAID_SUBSCRIPTION_COLUMNS =
  "user_id,paid_plan,subscription_status,paid_until,cancel_at_period_end,livemode,stripe_account_id";

const KNOWN_PAID_PLANS = new Set(["basic", "pro", "elite"]);
const GRANTING_STATUSES = new Set(["active", "past_due"]);
const ACCOUNT_ID = /^acct_[A-Za-z0-9]+$/;

export type EntitlementPlan = "none" | "basic" | "pro" | "elite";

export type PaidAccessContext = {
  livemode: boolean;
  accountId: string;
};

export type PaidSubscriptionSnapshot = {
  user_id: string;
  paid_plan: string;
  subscription_status: string;
  paid_until: string;
  livemode?: boolean | null;
  stripe_account_id?: string | null;
  cancel_at_period_end?: boolean | null;
  pending_plan?: string | null;
};

/**
 * The account and mode this process may treat as paid.
 * Production, including Vercel production, requires a live row on
 * STRIPE_ACCOUNT_ID. Every other environment requires a test row on
 * STRIPE_ACCOUNT_ID_TEST. A missing value is a config error for the caller,
 * not a plan.
 */
export function readPaidAccess(
  env: { readonly [key: string]: string | undefined },
  nodeEnv: string | undefined
): PaidAccessContext | null {
  const production = nodeEnv === "production" || env.VERCEL_ENV === "production";
  const accountId = production ? env.STRIPE_ACCOUNT_ID ?? "" : env.STRIPE_ACCOUNT_ID_TEST ?? "";
  if (!ACCOUNT_ID.test(accountId)) return null;
  return { livemode: production, accountId };
}

/**
 * Paid access for one user in one environment.
 * pending_plan is ignored.
 * A paid_until value alone does not grant access. The row must belong to the
 * user, use this environment's livemode and Stripe account, have status
 * active or past_due, and have paid_until after now.
 * A null mode, a null account, a test row in production, or another account
 * grants nothing. This function does not invent those values.
 * cancel_at_period_end does not remove access while the checks above hold.
 * canceled still grants nothing, including when paid_until is in the future.
 */
export function getPaidPlan(
  row: PaidSubscriptionSnapshot | null | undefined,
  userId: string,
  now: Date,
  access: PaidAccessContext
): EntitlementPlan {
  if (!access || access.livemode !== true && access.livemode !== false) return "none";
  if (!ACCOUNT_ID.test(access.accountId)) return "none";
  if (!row || !userId || row.user_id !== userId) return "none";
  if (row.livemode !== access.livemode || row.stripe_account_id !== access.accountId) return "none";
  if (!KNOWN_PAID_PLANS.has(row.paid_plan)) return "none";
  if (!GRANTING_STATUSES.has(row.subscription_status)) return "none";

  const paidUntil = Date.parse(row.paid_until);
  if (!Number.isFinite(paidUntil) || paidUntil <= now.getTime()) return "none";

  return row.paid_plan as EntitlementPlan;
}
