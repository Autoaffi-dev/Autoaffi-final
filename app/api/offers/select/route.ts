import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import crypto from "crypto";

import { authOptions } from "@/lib/authOptions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildAffiliateLink } from "@/lib/affiliate/buildAffiliateLink";

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

function buildStableSubId(userId: string, source: string, sourceOfferId: string) {
  const shortUser = crypto
    .createHash("sha1")
    .update(userId)
    .digest("hex")
    .slice(0, 6);

  const shortOffer = crypto
    .createHash("sha1")
    .update(`${source}:${sourceOfferId}`)
    .digest("hex")
    .slice(0, 6);

  return `aa_u_${shortUser}__src_${source}__of_${shortOffer}`;
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
    const session = await getServerSession(authOptions as any);
    const userId = (session as any)?.user?.id as string | undefined;

    if (!userId) {
      return jsonNoStore({ ok: false, error: "UNAUTHORIZED" }, 401);
    }

    const body = await req.json().catch(() => null);
    const payload: IncomingItem | null = body?.item || body || null;

    if (!payload) {
      return jsonNoStore({ ok: false, error: "Missing item" }, 400);
    }

    const source = safeString(payload.source).toLowerCase();
    const externalId = resolveExternalId(payload);
    const title = safeString(payload.title);

    if (!source || !externalId || !title) {
      return jsonNoStore(
        {
          ok: false,
          error: "Invalid item: source/external_id/title required",
        },
        400
      );
    }

    const productUrl =
      safeNullableString(payload.product_url) ||
      safeNullableString(payload.landing_url) ||
      safeNullableString(payload.url);

    if (!productUrl) {
      return jsonNoStore(
        { ok: false, error: "Invalid item: product URL required" },
        400
      );
    }

    const context = safeNullableString(body?.from) || "affiliate_offers";
    const campaign = safeNullableString(body?.campaign);
    const subid = buildStableSubId(userId, source, externalId);

    const built = await buildAffiliateLink({
      source,
      productUrl,
      externalId,
      userId,
      subid,
      title,
      merchantName: safeNullableString(payload.merchant_name),
      campaign,
      context,
    });

    const finalAffiliateLink = safeString(built?.affiliateLink) || productUrl;
    const finalProductUrl = safeString(built?.productUrl) || productUrl;
    const finalSubId = safeString(built?.subid) || subid;

    const upsertRow = {
      user_id: userId,

      source,
      external_id: externalId,

      title,
      description: safeNullableString(payload.description),
      category: safeNullableString(payload.category),
      niche: safeNullableString(payload.niche),

      merchant_name: safeNullableString(payload.merchant_name),
      merchant_id: safeNullableString(payload.merchant_id),

      product_url: finalProductUrl,
      image_url: safeNullableString(payload.image_url),

      price: safeNumber(payload.price),
      currency: safeNullableString(payload.currency),
      commission: safeNumber(payload.commission),
      epc: safeNumber(payload.epc),

      geo_scope: safeNullableString(payload.geo_scope) || "worldwide",
      canonical_url: safeNullableString(payload.canonical_url),
      canonical_hash: safeNullableString(payload.canonical_hash),

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