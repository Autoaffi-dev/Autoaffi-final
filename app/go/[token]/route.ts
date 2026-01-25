import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

function detectDevice(userAgent: string | null) {
  const ua = (userAgent || "").toLowerCase();
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("android")) return "mobile";
  if (ua.includes("windows") || ua.includes("macintosh") || ua.includes("linux")) return "desktop";
  return "unknown";
}

async function readTokenFromContext(context: any): Promise<string | null> {
  const p = context?.params;
  if (!p) return null;
  if (typeof (p as any)?.then === "function") {
    const resolved = await p;
    return (resolved?.token || null) as string | null;
  }
  return (p?.token || null) as string | null;
}

export async function GET(req: Request, context: any) {
  const token = await readTokenFromContext(context);
  if (!token) return NextResponse.json({ error: "MISSING_TOKEN" }, { status: 400 });

  const supabase = getAdminSupabase();

  const urlObj = new URL(req.url);
  const skipLog = urlObj.searchParams.get("skip_log") === "1";

  const { data: asset, error: assetErr } = await supabase
    .from("user_qr_assets")
    .select("id,user_id,offer_key,product_type,destination_mode,destination_url,token,slug")
    .eq("token", token)
    .maybeSingle();

  if (assetErr) {
    return NextResponse.json({ error: "ASSET_FETCH_FAILED", details: assetErr.message }, { status: 500 });
  }
  if (!asset) {
    return NextResponse.json({ error: "TOKEN_NOT_FOUND" }, { status: 404 });
  }

  let destinationUrl = (asset.destination_url || "").trim();
  if (!destinationUrl) {
    const { data: destRow } = await supabase
      .from("user_offer_destinations")
      .select("destination_url")
      .eq("user_id", asset.user_id)
      .eq("offer_key", asset.offer_key)
      .maybeSingle();

    destinationUrl = (destRow?.destination_url || "").trim();
  }

  if (!skipLog) {
    try {
      const ua = req.headers.get("user-agent");
      const ref = req.headers.get("referer");

      const clickPayload = {
        ts: new Date().toISOString(),
        token: asset.token,
        user_id: asset.user_id,
        product_type: asset.product_type,
        device: detectDevice(ua),
        referrer: ref || null,
        country: null,
      };

      const { error: clickErr } = await supabase.from("qr_click_events").insert(clickPayload);
      if (clickErr) console.log("qr_click_events insert failed:", clickErr.message);
    } catch (e: any) {
      console.log("qr_click_events insert exception:", e?.message || String(e));
    }
  }

  // ✅ ALWAYS sales page first
  const mode = (asset.destination_mode || "affiliate") as "affiliate" | "lead" | "both";

  const baseUrl = new URL(req.url);
  const landingUrl = new URL(`/l/${encodeURIComponent(token)}`, baseUrl.origin);

  landingUrl.searchParams.set("mode", mode);
  if (destinationUrl) landingUrl.searchParams.set("next", destinationUrl);
  else landingUrl.searchParams.set("missingDestination", "1");

  if (skipLog) landingUrl.searchParams.set("skip_log", "1");

  return NextResponse.redirect(landingUrl, 302);
}