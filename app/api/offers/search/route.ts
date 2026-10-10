import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { applyCjSearchGate } from "@/lib/affiliate/cj/applyCjSearchGate";
import { prepareCjCustomerSearchItems } from "@/lib/affiliate/cj/searchGate";
import {
  controlledCjExternalIds,
  customerAutomatedSources,
  customerFacingProductCommission,
  getBetaAutomatedSources,
  retainCustomerSearchItem,
} from "@/lib/affiliate/productSourceReadiness";

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

    const contextParam = url.searchParams.get("context");
    const contextRaw = String(contextParam || "affiliate_offers").trim();

    const context =
      contextRaw === "reels" ||
      contextRaw === "posts" ||
      contextRaw === "affiliate_offers"
        ? contextRaw
        : "affiliate_offers";

    const geo_scope = normalizeOptional(url.searchParams.get("geo_scope"));
    const requestedSource = normalizeOptional(
      url.searchParams.get("source") || url.searchParams.get("sources")
    );
    const betaSources = getBetaAutomatedSources();
    const sessionSources = customerAutomatedSources(userId, betaSources);
    const source =
      requestedSource && sessionSources.includes(requestedSource.toLowerCase())
        ? requestedSource.toLowerCase()
        : null;

    if (sessionSources.length === 0) {
      return jsonNoStore({
        ok: true,
        items: [],
        meta: {
          q,
          limit,
          context,
          reason: "no_beta_automated_sources",
        },
      });
    }

    if (requestedSource && !source) {
      return jsonNoStore({
        ok: true,
        items: [],
        meta: {
          q,
          limit,
          context,
          reason: "source_not_beta_enabled",
          source: requestedSource,
        },
      });
    }
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
      .eq("is_active", true)
      .eq("is_approved", true)
      .in("source", source ? [source] : sessionSources)
      .limit(limit);

    const queriedSources = source ? [source] : sessionSources;
    const pinnedExternalIds = controlledCjExternalIds(userId);
    if (queriedSources.includes("cj")) {
      if (pinnedExternalIds.length === 0) {
        return jsonNoStore({
          ok: true,
          items: [],
          meta: { q, limit, context, reason: "source_not_beta_enabled" },
        });
      }
      if (queriedSources.length === 1) {
        qb = qb.in("external_id", pinnedExternalIds);
      } else {
        qb = qb.or(
          `source.neq.cj,external_id.in.(${pinnedExternalIds.join(",")})`
        );
      }
    }

    if (geo_scope) qb = qb.eq("geo_scope", geo_scope);
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
        commission: customerFacingProductCommission(),
        epc: String(r.source || "").toLowerCase() === "cj" ? null : r.epc ?? null,
        geo_scope: r.geo_scope ?? "worldwide",
        score: r.score ?? null,
        quality_score: r.quality_score ?? 0,
        winner_tier: r.winner_tier ?? null,
        canonical_url: r.canonical_url ?? null,
        canonical_hash: r.canonical_hash ?? null,
        price_band: r.price_band ?? null,
        language: r.language ?? null,
      };
    }).filter((item: { source?: string | null; external_id?: string | null }) =>
      retainCustomerSearchItem(userId, item.source, item.external_id)
    );

    const preparedCjSearch = prepareCjCustomerSearchItems(items, contextParam);
    const visibleItems = preparedCjSearch.applyReviewGate
      ? await applyCjSearchGate(userId, preparedCjSearch.items)
      : preparedCjSearch.items;

    await supabaseAdmin.from("user_search_events").insert({
      user_id: userId,
      context,
      query: q,
      filters: { geo_scope, source, category, niche, limit },
    } as any);

    return jsonNoStore({
      ok: true,
      items: visibleItems,
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
