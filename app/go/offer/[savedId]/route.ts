import { NextRequest, NextResponse } from "next/server";
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
  title: string | null;
  subid: string | null;
  saved_from_context: string | null;
  last_used_at: string | null;
};

function normalizeUrl(input?: string | null) {
  const value = String(input || "").trim();
  if (!value) return null;

  try {
    return new URL(value).toString();
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

    const destination =
      normalizeUrl(data.affiliate_link) || normalizeUrl(data.product_url);

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