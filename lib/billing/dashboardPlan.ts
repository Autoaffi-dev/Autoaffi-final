import { requireUserId } from "@/lib/auth/server";
import { loadTestAccess } from "./loadTestAccess";
import { loadPaidSubscription } from "./loadPaidSubscription";
import { getPaidPlan, readPaidAccess, type EntitlementPlan } from "./paidPlan";
import { effectivePlan, readActiveTest } from "./testAccess";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "private, no-store",
};

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export async function readDashboardPlan(
  request: Request,
  now = new Date()
): Promise<
  | { ok: true; userId: string; paidPlan: EntitlementPlan; testPlan: EntitlementPlan; effectivePlan: EntitlementPlan }
  | { ok: false; response: Response }
> {
  let userId = "";
  try {
    userId = String((await requireUserId(request)) || "");
  } catch (err) {
    const unauthorized = err instanceof Error && err.message === "UNAUTHORIZED";
    return { ok: false, response: json({ error: unauthorized ? "UNAUTHORIZED" : "ENTITLEMENT_READ_FAILED" }, unauthorized ? 401 : 500) };
  }
  if (!userId) return { ok: false, response: json({ error: "UNAUTHORIZED" }, 401) };
  const access = readPaidAccess(process.env, process.env.NODE_ENV);
  if (!access) return { ok: false, response: json({ error: "ENTITLEMENT_CONFIG" }, 500) };

  try {
    const [row, testRow] = await Promise.all([loadPaidSubscription(userId), loadTestAccess(userId)]);
    const paidPlan = getPaidPlan(row, userId, now, access);
    const testPlan = readActiveTest(testRow, userId, now).plan;
    return { ok: true, userId, paidPlan, testPlan, effectivePlan: effectivePlan(paidPlan, testPlan) };
  } catch {
    return { ok: false, response: json({ error: "ENTITLEMENT_READ_FAILED" }, 500) };
  }
}
