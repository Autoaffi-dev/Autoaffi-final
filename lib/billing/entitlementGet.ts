import { getPaidPlan, readPaidAccess, type EntitlementPlan, type PaidSubscriptionSnapshot } from "./paidPlan";

const UNAUTHORIZED = "UNAUTHORIZED";

export type EntitlementGetDeps = {
  request: Request;
  resolveUserId: (request: Request) => Promise<string>;
  loadSubscription: (userId: string) => Promise<PaidSubscriptionSnapshot | null>;
  env: { readonly [key: string]: string | undefined };
  nodeEnv: string | undefined;
  now?: Date;
};

const ENTITLEMENT_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "private, no-store",
};

function entitlementResponse(plan: EntitlementPlan, status: number): Response {
  return new Response(JSON.stringify({ plan }), {
    status,
    headers: ENTITLEMENT_HEADERS,
  });
}

function entitlementError(
  error: "UNAUTHORIZED" | "ENTITLEMENT_READ_FAILED" | "ENTITLEMENT_CONFIG",
  status: number
): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: ENTITLEMENT_HEADERS,
  });
}

export async function handleEntitlementGet(deps: EntitlementGetDeps): Promise<Response> {
  const now = deps.now ?? new Date();
  const access = readPaidAccess(deps.env, deps.nodeEnv);
  if (!access) return entitlementError("ENTITLEMENT_CONFIG", 500);
  let userId = "";

  try {
    userId = String((await deps.resolveUserId(deps.request)) || "");
  } catch (err) {
    const unauthorized = err instanceof Error && err.message === UNAUTHORIZED;
    return entitlementError(unauthorized ? "UNAUTHORIZED" : "ENTITLEMENT_READ_FAILED", unauthorized ? 401 : 500);
  }

  if (!userId) return entitlementError("UNAUTHORIZED", 401);

  try {
    const row = await deps.loadSubscription(userId);
    return entitlementResponse(getPaidPlan(row, userId, now, access), 200);
  } catch {
    return entitlementError("ENTITLEMENT_READ_FAILED", 500);
  }
}
