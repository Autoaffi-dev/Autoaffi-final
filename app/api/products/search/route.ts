import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * GET /api/products/search?q=keyword&sources=warriorplus&limit=20
 * Optional: &geo=worldwide
 * Optional: &approved=false  (default true)
 */

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE env vars (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).");
  }

  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const q = (searchParams.get("q") ?? "").trim();
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "20"), 1), 50);

    const sourcesParam = (searchParams.get("sources") ?? "").trim();
    const geoParam = (searchParams.get("geo") ?? "").trim();

    // default true: endast approved offers
    const approvedParam = (searchParams.get("approved") ?? "").trim().toLowerCase();
    const approvedOnly = approvedParam === "false" ? false : true;

    const sources = sourcesParam
      ? sourcesParam.split(",").map((s) => s.trim()).filter(Boolean)
      : null;

    const geos = geoParam
      ? geoParam.split(",").map((s) => s.trim()).filter(Boolean)
      : null;

    const supabase = getSupabaseAdmin();

    let qb = supabase
      .from("product_index")
      .select(
        "id,source,external_id,title,description,category,product_url,landing_url,image_url,epc,commission,currency,price,score,quality_score,geo_scope,winner_tier,is_active,last_seen_at,is_approved"
      )
      .eq("is_active", true);

    if (approvedOnly) qb = qb.eq("is_approved", true);
    if (sources && sources.length > 0) qb = qb.in("source", sources);
    if (geos && geos.length > 0) qb = qb.in("geo_scope", geos);

    if (q) qb = qb.or(`title.ilike.%${q}%,description.ilike.%${q}%,category.ilike.%${q}%`);

    const { data, error } = await qb
      .order("score", { ascending: false, nullsFirst: false })
      .order("last_seen_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      query: q,
      approvedOnly,
      count: data?.length ?? 0,
      results: data ?? [],
    });
  } catch (err: any) {
    console.error("[products/search] error:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? "Product search failed" },
      { status: 500 }
    );
  }
}