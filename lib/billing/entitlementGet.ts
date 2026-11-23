import { getPaidPlan, readPaidAccess, type PaidSubscriptionSnapshot } from "./paidPlan";
import { effectivePlan, readActiveTest, type TestAccessSnapshot } from "./testAccess";

const UNAUTHORIZED = "UNAUTHORIZED";

export type EntitlementGetDeps = {
  request: Request;
  resolveUserId: (request: Request) => Promise<string>;
  loadSubscription: (userId: string) => Promise<PaidSubscriptionSnapshot | null>;
  loadTestAccess: (userId: string) => Promise<TestAccessSnapshot | null>;
  env: { readonly [key: string]: string | undefined };
  nodeEnv: string | undefined;
  now?: Date;
};

const ENTITLEMENT_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "private, no-store",
};

function entitlementResponse(
  paidPlan: ReturnType<typeof getPaidPlan>,
  testPlan: ReturnType<typeof getPaidPlan>,
  testExpiresAt: string | null
): Response {
  return new Response(
    JSON.stringify({
      paidPlan,
      testPlan,
      effectivePlan: effectivePlan(paidPlan, testPlan),
      testExpiresAt: testPlan === "none" ? null : testExpiresAt,
    }),
    {
      status: 200,
      headers: ENTITLEMENT_HEADERS,
    }
  );
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
    const [row, testRow] = await Promise.all([
      deps.loadSubscription(userId),
      deps.loadTestAccess(userId),
    ]);
    const paidPlan = getPaidPlan(row, userId, now, access);
    const test = readActiveTest(testRow, userId, now);
    return entitlementResponse(paidPlan, test.plan, test.expiresAt);
  } catch {
    return entitlementError("ENTITLEMENT_READ_FAILED", 500);
  }
}
