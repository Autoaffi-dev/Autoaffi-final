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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(n, max));
}

function normalizeOptional(value: string | null) {
  const v = String(value || "").trim();
  if (!v) return null;

  const lower = v.toLowerCase();
  if (
    lower === "all" ||
    lower === "all sources" ||
    lower === "all categories"
  ) {
    return null;
  }

  return v;
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions as any);
    const userId = (session as any)?.user?.id as string | undefined;

    if (!userId) {
      return jsonNoStore({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);

    const q = String(
      url.searchParams.get("q") ||
      url.searchParams.get("keyword") ||
      ""
    ).trim();

    const limit = clamp(Number(url.searchParams.get("limit") || 30), 1, 120);

    const contextRaw = String(
      url.searchParams.get("context") || "affiliate_offers"
    ).trim();

    const context =
      contextRaw === "reels" ||
      contextRaw === "posts" ||
      contextRaw === "affiliate_offers"
        ? contextRaw
        : "affiliate_offers";

    const geo_scope = normalizeOptional(url.searchParams.get("geo_scope"));
    const source = normalizeOptional(
      url.searchParams.get("source") || url.searchParams.get("sources")
    );
    const category = normalizeOptional(url.searchParams.get("category"));
    const niche = normalizeOptional(url.searchParams.get("niche"));

    if (!q || q.length < 2) {
      await supabaseAdmin.from("user_search_events").insert({
        user_id: userId,
        context,
        query: q || "",
        filters: { geo_scope, source, category, niche, limit },
      } as any);

      return jsonNoStore({
        ok: true,
        items: [],
        meta: { q, limit, context, reason: "missing_query" },
      });
    }

    let qb = supabaseAdmin
      .from("product_index")
      .select(
        [
          "source",
          "external_id",
          "title",
          "description",
          "category",
          "merchant_name",
          "merchant_id",
          "product_url",
          "landing_url",
          "image_url",
          "price",
          "currency",
          "commission",
          "epc",
          "geo_scope",
          "score",
          "quality_score",
          "winner_tier",
          "is_active",
          "is_approved",
          "canonical_url",
          "canonical_hash",
          "price_band",
          "language",
        ].join(",")
      )
      .limit(limit);

    if (geo_scope) qb = qb.eq("geo_scope", geo_scope);
    if (source) qb = qb.eq("source", source);
    if (category) qb = qb.ilike("category", `%${category}%`);

    const like = `%${q}%`;

    qb = qb.or(
      [
        `title.ilike.${like}`,
        `description.ilike.${like}`,
        `category.ilike.${like}`,
        `merchant_name.ilike.${like}`,
        `product_url.ilike.${like}`,
      ].join(",")
    );

    qb = qb.order("score", { ascending: false, nullsFirst: false });

    const { data, error } = await qb;
    if (error) throw new Error(error.message);

    const items = (data || []).map((r: any) => {
      const resolvedUrl = String(r.product_url || r.landing_url || "").trim();

      return {
        id: `${r.source}:${r.external_id}`,
        source: r.source,
        external_id: r.external_id,
        title: r.title ?? "",
        description: r.description ?? null,
        category: r.category ?? null,
        merchant_name: r.merchant_name ?? null,
        merchant_id: r.merchant_id ?? null,
        url: resolvedUrl,
        product_url: r.product_url ?? null,
        landing_url: r.landing_url ?? null,
        image_url: r.image_url ?? null,
        price: r.price ?? null,
        currency: r.currency ?? null,
        commission: r.commission ?? null,
        epc: r.epc ?? null,
        geo_scope: r.geo_scope ?? "worldwide",
        score: r.score ?? null,
        quality_score: r.quality_score ?? 0,
        winner_tier: r.winner_tier ?? null,
        canonical_url: r.canonical_url ?? null,
        canonical_hash: r.canonical_hash ?? null,
        price_band: r.price_band ?? null,
        language: r.language ?? null,
      };
    });

    await supabaseAdmin.from("user_search_events").insert({
      user_id: userId,
      context,
      query: q,
      filters: { geo_scope, source, category, niche, limit },
    } as any);

    return jsonNoStore({
      ok: true,
      items,
      meta: { q, limit, context, geo_scope, source, category, niche },
    });
  } catch (err: any) {
    console.error("[api/offers/search] error:", err);
    return jsonNoStore(
      { ok: false, error: err?.message ?? "Search failed" },
      { status: 500 }
    );
  }
}
