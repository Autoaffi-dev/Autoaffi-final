import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonNoStore(body: any, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { "cache-control": "no-store", ...(init?.headers ?? {}) },
  });
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions as any);
    const userId = (session as any)?.user?.id as string | undefined;

    if (!userId) {
      return jsonNoStore({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);

    const limit = Math.max(
      1,
      Math.min(Number(url.searchParams.get("limit") || 200), 500)
    );

    const source = (url.searchParams.get("source") || "").trim() || null;
    const q = (url.searchParams.get("q") || "").trim() || null;

    let qb = supabaseAdmin
      .from("user_offers")
      .select(
        [
          "id",
          "user_id",
          "source",
          "external_id",
          "title",
          "description",
          "category",
          "niche",
          "merchant_name",
          "merchant_id",
          "product_url",
          "image_url",
          "price",
          "currency",
          "commission",
          "epc",
          "geo_scope",
          "quality_score",
          "winner_tier",
          "is_active",
          "is_approved",
          "canonical_url",
          "canonical_hash",
          "saved_from_context",
          "saved_query",
          "subid",
          "affiliate_link",
          "is_primary",
          "is_pinned",
          "pin_rank",
          "created_at",
          "updated_at",
          "last_used_at",
        ].join(",")
      )
      .eq("user_id", userId)
      .order("is_pinned", { ascending: false })
      .order("pin_rank", { ascending: true, nullsFirst: false })
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (source) qb = qb.eq("source", source);

    if (q) {
      const like = `%${q}%`;
      qb = qb.or(
        [
          `title.ilike.${like}`,
          `description.ilike.${like}`,
          `category.ilike.${like}`,
          `niche.ilike.${like}`,
          `merchant_name.ilike.${like}`,
          `source.ilike.${like}`,
        ].join(",")
      );
    }

    const { data, error } = await qb;
    if (error) throw new Error(error.message);

    return jsonNoStore({
      ok: true,
      count: Array.isArray(data) ? data.length : 0,
      items: data || [],
    });
  } catch (err: any) {
    console.error("[offers/list] error:", err);
    return jsonNoStore(
      { ok: false, error: err?.message ?? "Failed to list offers" },
      { status: 500 }
    );
  }
}