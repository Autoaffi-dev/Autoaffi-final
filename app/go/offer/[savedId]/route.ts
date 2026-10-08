import { NextRequest, NextResponse } from "next/server";
import type { CjProgramReviewSnapshot } from "@/lib/affiliate/cj/eligibility";
import { resolveCjGoClick } from "@/lib/affiliate/cj/goClick";
import type { CjPropertyMappingRow } from "@/lib/affiliate/cj/propertyMapping";
import type { CjSocialAccountSnapshot } from "@/lib/affiliate/cj/socialAccountProperty";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OfferRow = {
  id: string;
  user_id: string | null;
  affiliate_link: string | null;
  product_url: string | null;
  source: string | null;
  external_id: string | null;
  merchant_id: string | null;
  title: string | null;
  subid: string | null;
  saved_from_context: string | null;
  last_used_at: string | null;
};

async function resolveGoDestination(data: OfferRow) {
  if (String(data.source || "").trim().toLowerCase() === "cj") {
    try {
      const userId = String(data.user_id || "").trim();
      const advertiserId = String(data.merchant_id || "").trim();
      const [accountRes, propertyRes, reviewRes] = await Promise.all([
        supabaseAdmin
          .from("user_social_accounts")
          .select("id,user_id,platform,status,username,meta")
          .eq("user_id", userId)
          .eq("platform", "instagram")
          .maybeSingle(),
        supabaseAdmin
          .from("cj_promotional_properties")
          .select(
            "id,user_id,platform,social_account_id,social_account_identifier,social_media_handle,property_type,cj_social_platform,cj_pid,status"
          )
          .eq("user_id", userId),
        advertiserId
          ? supabaseAdmin
              .from("cj_program_reviews")
              .select("advertiser_id,status,permitted_methods,reviewed_by")
              .eq("advertiser_id", advertiserId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (accountRes.error || propertyRes.error || reviewRes.error) return null;
      return resolveCjGoClick({
        userId,
        merchantId: advertiserId,
        affiliateLink: data.affiliate_link,
        subid: data.subid,
        account: (accountRes.data as CjSocialAccountSnapshot | null) ?? null,
        properties: (propertyRes.data as CjPropertyMappingRow[] | null) ?? [],
        review: (reviewRes.data as CjProgramReviewSnapshot | null) ?? null,
      });
    } catch {
      return null;
    }
  }

  return normalizeUrl(data.affiliate_link) || normalizeUrl(data.product_url);
}

function normalizeUrl(input?: string | null) {
  const value = String(input || "").trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ savedId: string }> | { savedId: string } }
) {
  try {
    const resolvedParams =
      typeof (context.params as any)?.then === "function"
        ? await (context.params as Promise<{ savedId: string }>)
        : (context.params as { savedId: string });

    const savedId = String(resolvedParams?.savedId || "").trim();

    if (!savedId) {
      return NextResponse.redirect(
        new URL("/login/dashboard/affiliate", req.url)
      );
    }

    const lookup = await supabaseAdmin
      .from("user_offers")
      .select(
        [
          "id",
          "user_id",
          "affiliate_link",
          "product_url",
          "source",
          "external_id",
          "merchant_id",
          "title",
          "subid",
          "saved_from_context",
          "last_used_at",
        ].join(",")
      )
      .eq("id", savedId)
      .maybeSingle();

    if (lookup.error || !lookup.data) {
      console.error(
        "[go/offer] lookup error:",
        lookup.error?.message || "offer not found"
      );
      return NextResponse.redirect(
        new URL("/login/dashboard/affiliate", req.url)
      );
    }

    const data = lookup.data as unknown as OfferRow;

    const destination = await resolveGoDestination(data);

    if (!destination) {
      console.error("[go/offer] missing valid destination for offer:", savedId);
      return NextResponse.redirect(
        new URL("/login/dashboard/affiliate", req.url)
      );
    }

    const now = new Date().toISOString();
    const referer = req.headers.get("referer");
    const userAgent = req.headers.get("user-agent");
    const forwardedFor =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      null;

    await supabaseAdmin
      .from("user_offers")
      .update({ last_used_at: now, updated_at: now })
      .eq("id", savedId);

    const clickInsert = await supabaseAdmin.from("offer_click_events").insert({
      user_id: data.user_id,
      offer_id: data.id,
      source: data.source,
      external_id: data.external_id,
      title: data.title,
      subid: data.subid,
      affiliate_link: destination,
      context: data.saved_from_context || "affiliate_offers",
      referer,
      user_agent: userAgent,
      ip_address: forwardedFor,
      clicked_at: now,
      created_at: now,
    } as any);

    if (clickInsert.error) {
      console.error("[go/offer] click log insert failed:", clickInsert.error.message);
    }

    return NextResponse.redirect(destination, { status: 302 });
  } catch (err: any) {
    console.error("[go/offer] crash:", err);
    return NextResponse.redirect(
      new URL("/login/dashboard/affiliate", req.url)
    );
  }
}