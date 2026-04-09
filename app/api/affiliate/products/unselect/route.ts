import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonNoStore(body: any, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { "cache-control": "no-store", ...(init?.headers ?? {}) },
  });
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE env vars (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)."
    );
  }

  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

type UnselectBody = {
  source: string;
  external_id: string;
  reason?: string | null; // optional: "not_relevant" | "duplicate" | "low_quality" | "other"
};

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions as any);
    const userId = session?.user?.id;

    if (!userId) {
      return jsonNoStore({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as UnselectBody | null;

    const source = String(body?.source || "").trim();
    const external_id = String(body?.external_id || "").trim();
    const reason = body?.reason ? String(body.reason).slice(0, 120) : null;

    if (!source || !external_id) {
      return jsonNoStore(
        { ok: false, error: "Missing required fields: source, external_id" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    /**
     * IMPORTANT:
     * Assumes table `user_selected_products` has:
     * - is_active boolean
     * - removed_at timestamptz (nullable)
     * - removed_reason text (nullable)
     * - is_default boolean
     *
     * If columns missing, Supabase will error and you add them in Supabase UI.
     */

    // If it was default, remove default state as well
    const { data, error } = await supabase
      .from("user_selected_products")
      .update({
        is_active: false,
        removed_at: now,
        removed_reason: reason,
        is_default: false,
        default_at: null,
        updated_at: now,
      } as any)
      .eq("user_id", userId)
      .eq("source", source)
      .eq("external_id", external_id)
      .eq("is_active", true)
      .select("source,external_id,is_active,removed_at,removed_reason,is_default");

    if (error) {
      return jsonNoStore(
        { ok: false, error: `unselect failed: ${error.message}` },
        { status: 500 }
      );
    }

    const updated = Array.isArray(data) ? data.length : 0;

    return jsonNoStore({
      ok: true,
      updated,
      item: updated ? data?.[0] : null,
    });
  } catch (e: any) {
    console.error("[api/affiliate/products/unselect] error:", e);
    return jsonNoStore(
      { ok: false, error: e?.message ?? "unselect failed" },
      { status: 500 }
    );
  }
}
