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

type Body = {
  source: string;
  external_id: string;
};

function cleanStr(v: any) {
  return String(v ?? "").trim();
}

/**
 * Sets ONE default selected product for this user.
 *
 * Requires table: user_selected_products
 * recommended cols:
 * - user_id uuid
 * - source text
 * - external_id text
 * - is_default boolean
 * - default_at timestamptz
 * - is_active boolean
 * - updated_at timestamptz
 *
 * The endpoint:
 * 1) Validates the selection exists for user (and active)
 * 2) Clears previous defaults for user
 * 3) Sets the chosen one as default
 */

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions as any);
    const userId = session?.user?.id;

    if (!userId) {
      return jsonNoStore({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const raw = (await req.json().catch(() => null)) as Partial<Body> | null;

    const source = cleanStr(raw?.source);
    const external_id = cleanStr(raw?.external_id);

    if (!source || !external_id) {
      return jsonNoStore(
        { ok: false, error: "Missing source or external_id" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 1) Ensure the selection exists (and active) for this user
    const { data: exists, error: exErr } = await supabase
      .from("user_selected_products")
      .select("user_id,source,external_id,is_active")
      .eq("user_id", userId)
      .eq("source", source)
      .eq("external_id", external_id)
      .maybeSingle();

    if (exErr) {
      return jsonNoStore(
        { ok: false, error: `lookup failed: ${exErr.message}` },
        { status: 500 }
      );
    }

    if (!exists) {
      return jsonNoStore(
        { ok: false, error: "Selection not found for user" },
        { status: 404 }
      );
    }

    if (exists?.is_active === false) {
      return jsonNoStore(
        { ok: false, error: "Selection is inactive/removed" },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();

    // 2) Clear previous defaults for this user
    const { error: clearErr } = await supabase
      .from("user_selected_products")
      .update({ is_default: false, updated_at: now })
      .eq("user_id", userId)
      .eq("is_default", true);

    if (clearErr) {
      return jsonNoStore(
        { ok: false, error: `clear default failed: ${clearErr.message}` },
        { status: 500 }
      );
    }

    // 3) Set chosen row as default
    const { error: setErr } = await supabase
      .from("user_selected_products")
      .update({ is_default: true, default_at: now, updated_at: now })
      .eq("user_id", userId)
      .eq("source", source)
      .eq("external_id", external_id);

    if (setErr) {
      return jsonNoStore(
        { ok: false, error: `set default failed: ${setErr.message}` },
        { status: 500 }
      );
    }

    return jsonNoStore({
      ok: true,
      user_id: userId,
      default: { source, external_id },
      updated_at: now,
    });
  } catch (e: any) {
    console.error("[api/affiliate/products/default] error:", e);
    return jsonNoStore(
      { ok: false, error: e?.message ?? "default failed" },
      { status: 500 }
    );
  }
}
