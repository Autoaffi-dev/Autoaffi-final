import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUserId } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mustGetEnv(key: string) {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
}

function getAdminSupabase() {
  return createClient(
    mustGetEnv("NEXT_PUBLIC_SUPABASE_URL"),
    mustGetEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  );
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

    const userId = await requireUserId(req);

    const url = new URL(req.url);
    const offer_key = (url.searchParams.get("offer_key") || "").trim();
    const product_type = (url.searchParams.get("product_type") || "").trim();
    const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);
    const cursor = (url.searchParams.get("cursor") || "").trim();
    const days = Math.min(Number(url.searchParams.get("days") || 30), 90);

    const now = new Date();
    const from = new Date(now);
    from.setDate(now.getDate() - (days - 1));
    const fromISO = from.toISOString();

    let assetsQ = supabase
      .from("user_qr_assets")
      .select("id,user_id,offer_key,product_type,destination_mode,destination_url,token,slug,qr_png_path,storage_path,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (offer_key) assetsQ = assetsQ.eq("offer_key", offer_key);
    if (product_type) assetsQ = assetsQ.eq("product_type", product_type);
    if (cursor) assetsQ = assetsQ.lt("created_at", cursor);

    const { data: assets, error: assetsErr } = await assetsQ;
    if (assetsErr) return jsonError(500, { ok: false, error: "ASSET_LIST_FAILED", details: assetsErr.message });

    const items = assets || [];
    const next_cursor = items.length === limit ? (items[items.length - 1] as any)?.created_at : null;

    const latest = items[0] || null;
    const history = items.length > 1 ? items.slice(1) : [];

    if (!items.length) {
      return NextResponse.json({
        ok: true,
        days,
        from: fromISO,
        next_cursor,
        latest: null,
        history: [],
        items: [],
      });
    }

    // clicks (last N days)
    const { data: clickRows, error: clickErr } = await supabase
      .from("qr_click_events")
      .select("token,ts")
      .eq("user_id", userId)
      .gte("ts", fromISO)
      .limit(10000);

    if (clickErr) return jsonError(500, { ok: false, error: "CLICK_ROWS_FAILED", details: clickErr.message });

    // leads (last N days)
    const { data: leadRows, error: leadErr } = await supabase
      .from("qr_leads")
      .select("asset_id,ts")
      .eq("user_id", userId)
      .gte("ts", fromISO)
      .limit(10000);

    if (leadErr) return jsonError(500, { ok: false, error: "LEAD_ROWS_FAILED", details: leadErr.message });

    const clicksByToken: Record<string, number> = {};
    for (const r of clickRows || []) {
      const t = String((r as any).token || "");
      if (!t) continue;
      clicksByToken[t] = (clicksByToken[t] || 0) + 1;
    }

    const leadsByAssetId: Record<string, number> = {};
    for (const r of leadRows || []) {
      const a = String((r as any).asset_id || "");
      if (!a) continue;
      leadsByAssetId[a] = (leadsByAssetId[a] || 0) + 1;
    }

    const dayKeys: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(from);
      d.setDate(from.getDate() + i);
      dayKeys.push(toISODate(d));
    }

    const seriesByToken: Record<string, Record<string, { clicks: number; leads: number }>> = {};

    for (const r of clickRows || []) {
      const t = String((r as any).token || "");
      if (!t) continue;
      const k = toISODate(new Date((r as any).ts));
      seriesByToken[t] ||= {};
      seriesByToken[t][k] ||= { clicks: 0, leads: 0 };
      seriesByToken[t][k].clicks += 1;
    }

    const tokenByAssetId: Record<string, string> = {};
    for (const a of items as any[]) tokenByAssetId[String(a.id)] = String(a.token);

    for (const r of leadRows || []) {
      const assetId = String((r as any).asset_id || "");
      const t = tokenByAssetId[assetId];
      if (!t) continue;
      const k = toISODate(new Date((r as any).ts));
      seriesByToken[t] ||= {};
      seriesByToken[t][k] ||= { clicks: 0, leads: 0 };
      seriesByToken[t][k].leads += 1;
    }

    const enriched = items.map((a: any) => {
      const c = clicksByToken[a.token] || 0;
      const l = leadsByAssetId[a.id] || 0;
      const conv = c > 0 ? Number((l / c).toFixed(4)) : 0;

      const perDay = dayKeys.map((date) => ({
        date,
        clicks: seriesByToken[a.token]?.[date]?.clicks || 0,
        leads: seriesByToken[a.token]?.[date]?.leads || 0,
      }));

      return {
        ...a,
        clicks_30d: c,
        leads_30d: l,
        conv_30d: conv,
        series_30d: perDay,
      };
    });

    return NextResponse.json({
      ok: true,
      days,
      from: fromISO,
      next_cursor,
      latest,
      history,
      items: enriched,
    });
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (msg === "UNAUTHORIZED") {
      return jsonError(401, { ok: false, error: "UNAUTHORIZED" });
    }
    return jsonError(500, { ok: false, error: "SERVER_ERROR", details: msg });
  }
}