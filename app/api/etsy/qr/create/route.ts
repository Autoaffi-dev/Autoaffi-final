import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProductType = "hoodie" | "sticker" | "phonecase";
type DestinationMode = "affiliate" | "lead" | "both";

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

function sanitizeHeaderId(raw: string) {
  return String(raw || "").trim().replace(/^"+|"+$/g, "");
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function getEffectiveUserId(req: Request) {
  const hdr = sanitizeHeaderId(req.headers.get("x-autoaffi-user-id") || "");
  const devUuid = (process.env.NEXT_PUBLIC_DEV_USER_ID || "").trim();
  const userId = isUuid(hdr) ? hdr : isUuid(devUuid) ? devUuid : "";
  return userId || null;
}

function randToken(len = 16) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function POST(req: Request) {
  try {
    const supabase = getAdminSupabase();

    const userId = getEffectiveUserId(req);
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED", hint: "Missing/invalid UUID header (x-autoaffi-user-id) or NEXT_PUBLIC_DEV_USER_ID." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const offer_key = String(body?.offer_key || "").trim();
    const product_type = String(body?.product_type || "").trim() as ProductType;
    const destination_mode = String(body?.destination_mode || "").trim() as DestinationMode;
    const destination_url = String(body?.destination_url || "").trim();

    if (!offer_key || !product_type || !destination_mode || !destination_url) {
      return NextResponse.json(
        { ok: false, error: "BAD_REQUEST", hint: "Missing offer_key/product_type/destination_mode/destination_url" },
        { status: 400 }
      );
    }

    const token = randToken(18);
    const slug = token;

    const base =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.QR_PUBLIC_BASE_URL ||
      "http://localhost:3000";

    const goUrl = `${base.replace(/\/$/, "")}/go/${token}`;

    const pngBuffer = await QRCode.toBuffer(goUrl, {
      type: "png",
      width: 1024,
      margin: 1,
      errorCorrectionLevel: "M",
    });

    const bucket = process.env.QR_ASSETS_BUCKET || "qr-assets";
    const storage_path = `${userId}/${token}.png`;

    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(storage_path, pngBuffer, { contentType: "image/png", upsert: true });

    if (upErr) {
      return NextResponse.json(
        { ok: false, error: "UPLOAD_FAILED", details: upErr.message },
        { status: 500 }
      );
    }

    const { data: asset, error: insErr } = await supabase
      .from("user_qr_assets")
      .insert({
        user_id: userId,
        offer_key,
        product_type,
        destination_mode,
        destination_url,
        token,
        slug,
        storage_path,
        qr_png_path: storage_path,
      })
      .select("id,user_id,offer_key,product_type,destination_mode,destination_url,token,slug,storage_path,qr_png_path,created_at")
      .single();

    if (insErr) {
      return NextResponse.json(
        { ok: false, error: "DB_INSERT_FAILED", details: insErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, asset }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}