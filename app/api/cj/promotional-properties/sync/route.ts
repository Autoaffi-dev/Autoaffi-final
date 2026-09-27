import { NextResponse } from "next/server";
import { requireUserId, UNAUTHORIZED_ERROR } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CjConfigError } from "@/lib/affiliate/cj/config";
import { CjGraphqlError } from "@/lib/affiliate/cj/graphql";
import { CjPropertyMappingError } from "@/lib/affiliate/cj/propertyMapping";
import { createSupabaseCjPropertyStore } from "@/lib/affiliate/cj/propertyStore";
import { syncCjPromotionalProperty } from "@/lib/affiliate/cj/syncPromotionalProperty";
import type { CjSocialAccountSnapshot } from "@/lib/affiliate/cj/socialAccountProperty";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sync the logged-in user's own connected Instagram account to a CJ PID.
 * This does not enable CJ product search, save, or click building.
 */

function jsonNoStore(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "";
    if (message === UNAUTHORIZED_ERROR || message === "UNAUTHORIZED") {
      return jsonNoStore({ ok: false, error: "UNAUTHORIZED" }, 401);
    }
    throw err;
  }

  const body = await req.json().catch(() => null);
  void body?.userId;
  void body?.pid;
  void body?.cjPid;
  void body?.cj_pid;
  void body?.handle;
  void body?.username;
  void body?.socialMediaHandle;
  void body?.social_account_id;

  const platform = String(body?.platform || "instagram").trim().toLowerCase();

  const accountRes = await supabaseAdmin
    .from("user_social_accounts")
    .select("id,user_id,platform,status,username,meta")
    .eq("user_id", userId)
    .eq("platform", platform)
    .maybeSingle();

  if (accountRes.error) {
    return jsonNoStore({ ok: false, error: "CJ_SOCIAL_ACCOUNT_LOOKUP_FAILED" }, 500);
  }

  const account = (accountRes.data as CjSocialAccountSnapshot | null) ?? null;

  try {
    const result = await syncCjPromotionalProperty({
      canonicalUserId: userId,
      account,
      store: createSupabaseCjPropertyStore(),
      requestedPid: body?.pid ?? body?.cjPid ?? body?.cj_pid,
      requestedUserId: body?.userId,
      requestedHandle: body?.handle ?? body?.username ?? body?.socialMediaHandle,
    });

    return jsonNoStore({
      ok: true,
      idempotent: result.idempotent,
      platform: result.mapping.platform,
      cj_pid: result.mapping.cj_pid,
      property_type: result.mapping.property_type,
      status: result.mapping.status,
    });
  } catch (err: unknown) {
    const code =
      err instanceof CjPropertyMappingError ||
      err instanceof CjConfigError ||
      err instanceof CjGraphqlError
        ? err.code
        : "CJ_PROPERTY_SYNC_FAILED";

    const status = code === "CJ_PAT_MISSING" || code === "CJ_PUBLISHER_ID_MISSING" || code === "CJ_PROPERTY_STORE_FAILED" || code === "CJ_UPSTREAM_FAILED" || code === "CJ_UPSTREAM_UNAUTHORIZED" || code === "CJ_GRAPHQL_ERROR" || code === "CJ_RESPONSE_MALFORMED"
      ? 502
      : 400;

    return jsonNoStore({ ok: false, error: code }, status);
  }
}
