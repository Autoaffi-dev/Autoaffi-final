import { requireUserId } from "@/lib/auth/server";
import { handleEntitlementGet } from "@/lib/billing/entitlementGet";
import { loadPaidSubscription } from "@/lib/billing/loadPaidSubscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleEntitlementGet({
    request,
    resolveUserId: requireUserId,
    loadSubscription: loadPaidSubscription,
  });
}
