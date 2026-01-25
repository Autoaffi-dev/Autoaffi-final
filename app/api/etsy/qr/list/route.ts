import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !serviceKey) throw new Error("Missing Supabase env vars");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function jsonError(status: number, payload: any) {
  return NextResponse.json(payload, { status });
}

export async function GET(req: Request) {
  try {
    const supabase = getAdminSupabase();

    const userId = req.headers.get("x-autoaffi-user-id")?.trim();
    if (!userId) {
      return jsonError(401, {
        error: "UNAUTHORIZED",
        hint: "Missing header: x-autoaffi-user-id",
      });
    }

    const url = new URL(req.url);

    const offer_key = (url.searchParams.get("offer_key") || "").trim();
    const product_type = (url.searchParams.get("product_type") || "").trim(); // hoodie|sticker|phonecase
    const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);
    const cursor = (url.searchParams.get("cursor") || "").trim(); // optional created_at cursor (ISO string)

    let q = supabase
      .from("user_qr_assets")
      .select(
        "id,user_id,offer_key,product_type,destination_mode,destination_url,token,slug,qr_png_path,storage_path,created_at"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (offer_key) q = q.eq("offer_key", offer_key);
    if (product_type) q = q.eq("product_type", product_type);

    // Cursor pagination (created_at < cursor)
    if (cursor) q = q.lt("created_at", cursor);

    const { data, error } = await q;

    if (error) {
      return jsonError(500, { error: "LIST_FAILED", details: error.message });
    }

    const next_cursor =
      data && data.length === limit ? data[data.length - 1]?.created_at : null;

    return NextResponse.json({
      ok: true,
      count: data?.length || 0,
      next_cursor,
      items: data || [],
    });
  } catch (e: any) {
    return jsonError(500, { error: "SERVER_ERROR", details: e?.message || String(e) });
  }
}