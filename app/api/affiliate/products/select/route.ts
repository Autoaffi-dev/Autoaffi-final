import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { buildProductSubId } from "@/lib/affiliate/subid";

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

type SelectBody = {
  // product identity (from product_index)
  source: "awin" | "cj" | "warriorplus" | "aliexpress" | "rakuten" | "impact";
  external_id: string;

  // optional context
  placement?: "affiliate_offers" | "reels" | "posts" | "campaigns" | "other";
  offer_key?: string | null;

  // optional product snapshot (nice for UI)
  title?: string | null;
  category?: string | null;
  merchant_name?: string | null;
  product_url?: string | null;
  image_url?: string | null;
  price?: number | null;
  currency?: string | null;
  geo_scope?: string | null;
};

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions as any);
    const userId = (session as any)?.user?.id as string | undefined;

    if (!userId) {
      return jsonNoStore({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as SelectBody | null;
    if (!body?.source || !body?.external_id) {
      return jsonNoStore(
        { ok: false, error: "Missing source/external_id" },
        { status: 400 }
      );
    }

    const placement = (body.placement || "affiliate_offers") as any;

    // ✅ deterministic, unique per user+source+product (+ placement)
    const subid = buildProductSubId({
      userId,
      source: body.source,
      externalId: body.external_id,
      placement,
      offerKey: body.offer_key ?? null,
    });

    const now = new Date().toISOString();

    // We store a compact snapshot so UI doesn't have to re-fetch immediately.
    // (Still source of truth is product_index.)
    const row = {
      user_id: userId,
      source: body.source,
      external_id: body.external_id,

      placement: placement,
      offer_key: body.offer_key ?? null,

      subid,

      title: body.title ?? null,
      category: body.category ?? null,
      merchant_name: body.merchant_name ?? null,

      product_url: body.product_url ?? null,
      image_url: body.image_url ?? null,
      price: body.price ?? null,
      currency: body.currency ?? null,
      geo_scope: body.geo_scope ?? "worldwide",

      is_active: true,
      created_at: now,
      updated_at: now,
      last_selected_at: now,
    };

    const supabase = getSupabaseAdmin();

    // ✅ Upsert: (user_id, source, external_id) unique
    const { error } = await supabase
      .from("user_selected_products")
      .upsert(row as any, { onConflict: "user_id,source,external_id" });

    if (error) {
      return jsonNoStore(
        { ok: false, error: `supabase upsert failed: ${error.message}` },
        { status: 500 }
      );
    }

    return jsonNoStore({
      ok: true,
      selected: {
        user_id: userId,
        source: body.source,
        external_id: body.external_id,
        subid,
        placement,
        offer_key: body.offer_key ?? null,
      },
    });
  } catch (e: any) {
    console.error("[api/affiliate/products/select] error:", e);
    return jsonNoStore(
      { ok: false, error: e?.message ?? "select failed" },
      { status: 500 }
    );
  }
}
