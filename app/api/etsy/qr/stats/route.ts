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

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
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

    // token is best (stats per QR)
    const token = (url.searchParams.get("token") || "").trim();
    const offer_key = (url.searchParams.get("offer_key") || "").trim(); // optional: totals per offer
    const days = Math.min(Number(url.searchParams.get("days") || 30), 90);

    // date range
    const now = new Date();
    const from = new Date(now);
    from.setDate(now.getDate() - (days - 1));
    const fromISO = from.toISOString();

    // --- Totals ---
    // Click totals
    let clickQ = supabase
      .from("qr_click_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("ts", fromISO);

    if (token) clickQ = clickQ.eq("token", token);

    // Lead totals
    // We store leads by user_id, so we can aggregate directly
    let leadQ = supabase
      .from("qr_leads")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("ts", fromISO);

    // If token passed, resolve asset_id first and filter leads by asset_id
    let assetId: string | null = null;
    let destination_mode: string | null = null;
    let destination_url: string | null = null;
    let product_type: string | null = null;

    if (token) {
      const { data: asset, error: assetErr } = await supabase
        .from("user_qr_assets")
        .select("id,offer_key,product_type,destination_mode,destination_url,token")
        .eq("user_id", userId)
        .eq("token", token)
        .maybeSingle();

      if (assetErr) {
        return jsonError(500, { error: "ASSET_LOOKUP_FAILED", details: assetErr.message });
      }
      if (!asset) {
        return jsonError(404, { error: "TOKEN_NOT_FOUND", token });
      }

      assetId = asset.id;
      destination_mode = asset.destination_mode;
      destination_url = asset.destination_url;
      product_type = asset.product_type;

      leadQ = leadQ.eq("asset_id", assetId);
    }

    const [{ count: click_total, error: clickErr }, { count: lead_total, error: leadErr }] =
      await Promise.all([clickQ, leadQ]);

    if (clickErr) return jsonError(500, { error: "CLICK_TOTAL_FAILED", details: clickErr.message });
    if (leadErr) return jsonError(500, { error: "LEAD_TOTAL_FAILED", details: leadErr.message });

    // --- Time series (simple per-day grouping done in Node) ---
    // Pull last N days rows (only ts fields) and group in Node for MVP
    // (Later: do SQL group-by/rpc for heavy traffic.)
    let clickRowsQ = supabase
      .from("qr_click_events")
      .select("ts,token")
      .eq("user_id", userId)
      .gte("ts", fromISO);

    if (token) clickRowsQ = clickRowsQ.eq("token", token);

    let leadRowsQ = supabase
      .from("qr_leads")
      .select("ts,asset_id")
      .eq("user_id", userId)
      .gte("ts", fromISO);

    if (assetId) leadRowsQ = leadRowsQ.eq("asset_id", assetId);

    const [{ data: clickRows, error: clickRowsErr }, { data: leadRows, error: leadRowsErr }] =
      await Promise.all([clickRowsQ, leadRowsQ]);

    if (clickRowsErr) return jsonError(500, { error: "CLICK_SERIES_FAILED", details: clickRowsErr.message });
    if (leadRowsErr) return jsonError(500, { error: "LEAD_SERIES_FAILED", details: leadRowsErr.message });

    // Init buckets for all days (so charts look clean)
    const buckets: Record<string, { clicks: number; leads: number }> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(from);
      d.setDate(from.getDate() + i);
      const k = toISODate(d);
      buckets[k] = { clicks: 0, leads: 0 };
    }

    for (const r of clickRows || []) {
      const k = toISODate(new Date(r.ts));
      if (buckets[k]) buckets[k].clicks += 1;
    }

    for (const r of leadRows || []) {
      const k = toISODate(new Date(r.ts));
      if (buckets[k]) buckets[k].leads += 1;
    }

    const series = Object.entries(buckets).map(([date, v]) => ({
      date,
      clicks: v.clicks,
      leads: v.leads,
    }));

    // Optional: offer_key totals (across all tokens) — MVP helper
    // If offer_key is provided and token is empty, we can still return totals across offer
    // (We won't overcomplicate now — you already have list API.)
    return NextResponse.json({
      ok: true,
      scope: token ? "token" : offer_key ? "offer_key" : "user",
      token: token || null,
      offer_key: offer_key || null,
      days,
      from: fromISO,
      totals: {
        clicks: click_total || 0,
        leads: lead_total || 0,
      },
      asset: token
        ? {
            id: assetId,
            product_type,
            destination_mode,
            destination_url,
          }
        : null,
      series,
    });
  } catch (e: any) {
    return jsonError(500, { error: "SERVER_ERROR", details: e?.message || String(e) });
  }
}