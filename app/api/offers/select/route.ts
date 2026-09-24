import { NextResponse } from "next/server";

import { requireUserId, UNAUTHORIZED_ERROR } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildAffiliateLink } from "@/lib/affiliate/buildAffiliateLink";
import {
  customerFacingProductCommission,
  isBetaAutomatedSource,
  isBetaManualSource,
  isHttpUrl,
  warriorPlusTrackingMatches,
} from "@/lib/affiliate/productSourceReadiness";
import { buildStableSubId } from "@/lib/affiliate/stableOfferSubId";

export const runtime = "nodejs";

type IncomingItem = {
  id?: string;
  source?: string;
  external_id?: string;

  title?: string;
  description?: string | null;
  category?: string | null;
  niche?: string | null;

  merchant_name?: string | null;
  merchant_id?: string | null;

  image_url?: string | null;

  url?: string | null;
  product_url?: string | null;
  landing_url?: string | null;

  price?: number | null;
  currency?: string | null;
  commission?: number | null;
  epc?: number | null;

  geo_scope?: string | null;
  canonical_url?: string | null;
  canonical_hash?: string | null;
};

type SavedUserOfferRow = {
  id: string | null;
  user_id: string | null;
  source: string | null;
  external_id: string | null;
  title: string | null;
  category: string | null;
  merchant_name: string | null;
  product_url: string | null;
  affiliate_link: string | null;
  subid: string | null;
  is_primary: boolean | null;
  is_pinned: boolean | null;
};

function jsonNoStore(data: any, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

function safeString(v: any) {
  const s =
    typeof v === "string"
      ? v
      : v === null || v === undefined
      ? ""
      : String(v);
  return s.trim();
}

function safeNullableString(v: any) {
  const s = safeString(v);
  return s ? s : null;
}

function safeNumber(v: any) {
  const n =
    typeof v === "number"
      ? v
      : Number(String(v || "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function resolveExternalId(item: IncomingItem) {
  const explicit = safeString(item.external_id);
  if (explicit) return explicit;

  const rawId = safeString(item.id);
  if (!rawId) return "";

  if (rawId.includes(":")) {
    return rawId.split(":").slice(1).join(":").trim();
  }

  return rawId;
}

function buildDisplayLink(savedOfferId: string | null | undefined) {
  const id = safeString(savedOfferId);
  if (!id) return "";
  return `/go/offer/${id}`;
}

export async function POST(req: Request) {
  try {
    let userId: string;
    try {
      userId = await requireUserId(req);
    } catch (err: any) {
      if (err?.message === UNAUTHORIZED_ERROR || err?.message === "UNAUTHORIZED") {
        return jsonNoStore({ ok: false, error: "UNAUTHORIZED" }, 401);
      }
      throw err;
    }

    const body = await req.json().catch(() => null);
    void body?.userId;
    const payload: IncomingItem | null = body?.item || body || null;

    if (!payload) {
      return jsonNoStore({ ok: false, error: "Missing item" }, 400);
    }

    const source = safeString(payload.source).toLowerCase();
    const context = safeNullableString(body?.from) || "affiliate_offers";
    const campaign = safeNullableString(body?.campaign);
    const manual = isBetaManualSource(source);

    let externalId = "";
    let title = "";
    let productUrl = "";
    let description: string | null = null;
    let category: string | null = null;
    let merchantName: string | null = null;
    let merchantId: string | null = null;
    let imageUrl: string | null = null;
    let price: number | null = null;
    let currency: string | null = null;
    let geoScope = "worldwide";
    let canonicalUrl: string | null = null;
    let canonicalHash: string | null = null;

    if (manual) {
      productUrl =
        safeNullableString(payload.product_url) ||
        safeNullableString(payload.landing_url) ||
        safeNullableString(payload.url) ||
        "";

      if (!isHttpUrl(productUrl)) {
        return jsonNoStore(
          { ok: false, error: "BYO_URL_MUST_BE_HTTP" },
          400
        );
      }

      externalId = productUrl;
      title = safeString(payload.title) || "Your affiliate link";
    } else if (!isBetaAutomatedSource(source)) {
      return jsonNoStore(
        { ok: false, error: "SOURCE_NOT_BETA_ENABLED" },
        400
      );
    } else {
      externalId = resolveExternalId(payload);
      if (!externalId) {
        return jsonNoStore(
          { ok: false, error: "Invalid item: external_id required" },
          400
        );
      }

      const indexRes = await supabaseAdmin
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
            "geo_scope",
            "canonical_url",
            "canonical_hash",
            "is_active",
            "is_approved",
          ].join(",")
        )
        .eq("source", source)
        .eq("external_id", externalId)
        .maybeSingle();

      if (indexRes.error) {
        return jsonNoStore(
          { ok: false, error: "product_index lookup failed", details: indexRes.error.message },
          500
        );
      }

      const indexRow = indexRes.data as Record<string, any> | null;
      if (!indexRow) {
        return jsonNoStore({ ok: false, error: "PRODUCT_NOT_IN_INDEX" }, 404);
      }

      if (indexRow.is_active !== true) {
        return jsonNoStore({ ok: false, error: "PRODUCT_INACTIVE" }, 400);
      }

      if (indexRow.is_approved !== true) {
        return jsonNoStore({ ok: false, error: "PRODUCT_NOT_APPROVED_FOR_INDEX" }, 400);
      }

      productUrl = safeString(indexRow.product_url || indexRow.landing_url);
      title = safeString(indexRow.title);

      if (!title || !isHttpUrl(productUrl)) {
        return jsonNoStore(
          { ok: false, error: "CANONICAL_PRODUCT_UNAVAILABLE" },
          400
        );
      }

      description = safeNullableString(indexRow.description);
      category = safeNullableString(indexRow.category);
      merchantName = safeNullableString(indexRow.merchant_name);
      merchantId = safeNullableString(indexRow.merchant_id);
      imageUrl = safeNullableString(indexRow.image_url);
      price = safeNumber(indexRow.price);
      currency = safeNullableString(indexRow.currency);
      geoScope = safeNullableString(indexRow.geo_scope) || "worldwide";
      canonicalUrl = safeNullableString(indexRow.canonical_url);
      canonicalHash = safeNullableString(indexRow.canonical_hash);
    }

    const subid = buildStableSubId(userId, source, externalId);

    const built = await buildAffiliateLink({
      source,
      productUrl,
      externalId,
      userId,
      subid,
      title,
      merchantName,
      campaign,
      context,
    });

    const finalAffiliateLink = safeString(built?.affiliateLink);
    const finalProductUrl = manual ? productUrl : safeString(built?.productUrl) || productUrl;
    const finalSubId = safeString(built?.subid) || subid;

    if (manual && finalAffiliateLink !== productUrl) {
      return jsonNoStore({ ok: false, error: "BYO_URL_REWRITTEN" }, 400);
    }

    if (
      source === "warriorplus" &&
      !warriorPlusTrackingMatches(finalAffiliateLink, finalSubId)
    ) {
      return jsonNoStore(
        { ok: false, error: "WARRIORPLUS_TRACKING_UNAVAILABLE" },
        400
      );
    }

    if (!isHttpUrl(finalAffiliateLink)) {
      return jsonNoStore({ ok: false, error: "DESTINATION_NOT_HTTP" }, 400);
    }

    const upsertRow = {
      user_id: userId,

      source,
      external_id: externalId,

      title,
      description: manual ? safeNullableString(payload.description) : description,
      category: manual ? safeNullableString(payload.category) : category,
      niche: manual ? safeNullableString(payload.niche) : null,

      merchant_name: manual ? null : merchantName,
      merchant_id: manual ? null : merchantId,

      product_url: finalProductUrl,
      image_url: manual ? null : imageUrl,

      price: manual ? null : price,
      currency: manual ? null : currency,
      commission: customerFacingProductCommission(),
      epc: null,

      geo_scope: geoScope,
      canonical_url: manual ? null : canonicalUrl,
      canonical_hash: manual ? null : canonicalHash,

      affiliate_link: finalAffiliateLink,
      subid: finalSubId,

      saved_from_context: context,
      saved_query: safeNullableString(body?.query),

      updated_at: new Date().toISOString(),
    };

    const upsertRes = await supabaseAdmin
      .from("user_offers")
      .upsert(upsertRow as any, { onConflict: "user_id,source,external_id" })
      .select(
        [
          "id",
          "user_id",
          "source",
          "external_id",
          "title",
          "category",
          "merchant_name",
          "product_url",
          "affiliate_link",
          "subid",
          "is_primary",
          "is_pinned",
        ].join(",")
      )
      .maybeSingle();

    if (upsertRes.error) {
      return jsonNoStore(
        {
          ok: false,
          error: "user_offers upsert failed",
          details: upsertRes.error.message,
        },
        500
      );
    }

    const saved = (upsertRes.data as SavedUserOfferRow | null) ?? null;
    const displayLink = buildDisplayLink(saved?.id);

    return jsonNoStore({
      ok: true,
      saved,
      affiliate_link: displayLink || null,
      display_link: displayLink || null,
      subid: saved?.subid || finalSubId,
      builder_meta: {
        ...(built?.meta || {}),
        source,
        externalId,
        context,
        campaign,
        network_affiliate_link: finalAffiliateLink,
        autoaffi_display_link: displayLink || null,
        subid: saved?.subid || finalSubId,
      },
    });
  } catch (e: any) {
    return jsonNoStore(
      { ok: false, error: e?.message || "Unknown error in /api/offers/select" },
      500
    );
  }
}