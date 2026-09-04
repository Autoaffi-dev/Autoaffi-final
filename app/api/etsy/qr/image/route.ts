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

export async function GET(req: Request) {
  try {
    const supabase = getAdminSupabase();
    const url = new URL(req.url);

    const userId = await requireUserId(req);

    const path = (url.searchParams.get("path") || "").trim();
    if (!path) {
      return jsonError(400, { ok: false, error: "BAD_REQUEST", hint: "Missing query param: path" });
    }

    // ✅ verify ownership (so people can't fetch other users' images)
    const { data: asset, error: assetErr } = await supabase
      .from("user_qr_assets")
      .select("id,user_id,storage_path,qr_png_path")
      .or(`storage_path.eq.${path},qr_png_path.eq.${path}`)
      .maybeSingle();

    if (assetErr) {
      return jsonError(500, { ok: false, error: "ASSET_LOOKUP_FAILED", details: assetErr.message });
    }
    if (!asset) {
      return jsonError(404, { ok: false, error: "NOT_FOUND" });
    }
    if (String(asset.user_id) !== String(userId)) {
      return jsonError(403, { ok: false, error: "FORBIDDEN" });
    }

    const bucket = process.env.QR_ASSETS_BUCKET || "qr-assets";

    const { data: file, error: dlErr } = await supabase.storage.from(bucket).download(path);
    if (dlErr || !file) {
      return jsonError(500, { ok: false, error: "DOWNLOAD_FAILED", details: dlErr?.message || "no_file" });
    }

    const buf = await file.arrayBuffer();

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (msg === "UNAUTHORIZED") {
      return jsonError(401, { ok: false, error: "UNAUTHORIZED" });
    }
    return jsonError(500, { ok: false, error: "SERVER_ERROR", details: msg });
  }
}