import type { EntitlementPlan } from "./paidPlan";

export const TEST_ACCESS_COLUMNS = "user_id,test_plan,expires_at,revoked_at";

const RANK: Record<EntitlementPlan, number> = {
  none: 0,
  basic: 1,
  pro: 2,
  elite: 3,
};

export type TestAccessSnapshot = {
  user_id: string;
  test_plan: string;
  expires_at: string | null;
  revoked_at: string | null;
};

export type ActiveTestAccess = {
  plan: EntitlementPlan;
  expiresAt: string | null;
};

/**
 * A grant is active only for its own user, with a known plan, no revoked_at,
 * and an end that is still strictly after now. expires_at equal to now is over.
 * A null end means the period has not been chosen. revoked_at ends the grant
 * even when the end is still in the future.
 */
export function readActiveTest(
  row: TestAccessSnapshot | null | undefined,
  userId: string,
  now: Date
): ActiveTestAccess {
  if (!row || !userId || row.user_id !== userId) return { plan: "none", expiresAt: null };
  if (row.revoked_at != null) return { plan: "none", expiresAt: null };
  if (row.test_plan !== "basic" && row.test_plan !== "pro" && row.test_plan !== "elite") {
    return { plan: "none", expiresAt: null };
  }
  if (row.expires_at != null) {
    const expiresAt = Date.parse(row.expires_at);
    if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
      return { plan: "none", expiresAt: null };
    }
    return { plan: row.test_plan, expiresAt: row.expires_at };
  }
  return { plan: row.test_plan, expiresAt: null };
}

export function effectivePlan(paidPlan: EntitlementPlan, testPlan: EntitlementPlan): EntitlementPlan {
  return RANK[paidPlan] >= RANK[testPlan] ? paidPlan : testPlan;
}

export function accessAllows(effective: EntitlementPlan, minimum: "basic" | "pro" | "elite"): boolean {
  return RANK[effective] >= RANK[minimum];
}
