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

type SetDefaultBody = {
  source: string;
  external_id: string;
};

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions as any);
    const userId = session?.user?.id;

    if (!userId) {
      return jsonNoStore({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as SetDefaultBody | null;

    const source = String(body?.source || "").trim();
    const external_id = String(body?.external_id || "").trim();

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
     * This endpoint assumes your table `user_selected_products` has:
     * - is_default boolean
     * - default_at timestamptz (nullable)
     *
     * If not, Supabase will return a clear error and you’ll add columns in Supabase UI.
     */

    // 1) Clear any existing default for this user
    const clearRes = await supabase
      .from("user_selected_products")
      .update({
        is_default: false,
        default_at: null,
        updated_at: now,
      } as any)
      .eq("user_id", userId)
      .eq("is_active", true)
      .eq("is_default", true);

    if (clearRes.error) {
      return jsonNoStore(
        { ok: false, error: `clear default failed: ${clearRes.error.message}` },
        { status: 500 }
      );
    }

    // 2) Set selected product as default (must exist + be active)
    const { data, error } = await supabase
      .from("user_selected_products")
      .update({
        is_default: true,
        default_at: now,
        updated_at: now,
      } as any)
      .eq("user_id", userId)
      .eq("source", source)
      .eq("external_id", external_id)
      .eq("is_active", true)
      .select("source,external_id,is_default,default_at");

    if (error) {
      return jsonNoStore(
        { ok: false, error: `set default failed: ${error.message}` },
        { status: 500 }
      );
    }

    const updated = Array.isArray(data) ? data.length : 0;

    return jsonNoStore({
      ok: true,
      clearedDefaults: (clearRes as any)?.count ?? null,
      updated,
      item: updated ? data?.[0] : null,
    });
  } catch (e: any) {
    console.error("[api/affiliate/products/set-default] error:", e);
    return jsonNoStore(
      { ok: false, error: e?.message ?? "set-default failed" },
      { status: 500 }
    );
  }
}
