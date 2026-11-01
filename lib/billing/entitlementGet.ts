import { getPaidPlan, type EntitlementPlan, type PaidSubscriptionSnapshot } from "./paidPlan";

const UNAUTHORIZED = "UNAUTHORIZED";

export type EntitlementGetDeps = {
  request: Request;
  resolveUserId: (request: Request) => Promise<string>;
  loadSubscription: (userId: string) => Promise<PaidSubscriptionSnapshot | null>;
  now?: Date;
};

function entitlementResponse(plan: EntitlementPlan, status: number): Response {
  return new Response(JSON.stringify({ plan }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });
}

export async function handleEntitlementGet(deps: EntitlementGetDeps): Promise<Response> {
  const now = deps.now ?? new Date();
  let userId = "";

  try {
    userId = String((await deps.resolveUserId(deps.request)) || "");
  } catch (err) {
    const unauthorized = err instanceof Error && err.message === UNAUTHORIZED;
    return entitlementResponse("none", unauthorized ? 401 : 500);
  }

  if (!userId) return entitlementResponse("none", 401);

  try {
    const row = await deps.loadSubscription(userId);
    return entitlementResponse(getPaidPlan(row, userId, now), 200);
  } catch {
    return entitlementResponse("none", 500);
  }
}
