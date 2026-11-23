import { requireUserId } from "@/lib/auth/server";
import { handleEntitlementGet } from "@/lib/billing/entitlementGet";
import { loadTestAccess } from "@/lib/billing/loadTestAccess";
import { loadPaidSubscription } from "@/lib/billing/loadPaidSubscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleEntitlementGet({
    request,
    resolveUserId: requireUserId,
    loadSubscription: loadPaidSubscription,
    loadTestAccess,
    env: process.env,
    nodeEnv: process.env.NODE_ENV,
  });
}
