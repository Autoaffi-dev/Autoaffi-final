import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

function sanitizeHeaderId(raw: string) {
  return String(raw || "")
    .trim()
    .replace(/^"+|"+$/g, ""); // removes leading/trailing quotes
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function randCode(len = 10) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function GET(req: Request) {
  try {
    const supabase = getAdminSupabase();

    const hdr = sanitizeHeaderId(req.headers.get("x-autoaffi-user-id") || "");
    const devUuid = (process.env.NEXT_PUBLIC_DEV_USER_ID || "").trim();
    const userId = isUuid(hdr) ? hdr : isUuid(devUuid) ? devUuid : "";

    if (!userId) {
      return NextResponse.json(
        {
          ok: false,
          error: "UNAUTHORIZED",
          hint: "Missing/invalid UUID. Send x-autoaffi-user-id as Supabase UUID or set NEXT_PUBLIC_DEV_USER_ID.",
        },
        { status: 401 }
      );
    }

    // platform key for Autoaffi recurring
    const platform = "autoaffi";

    // 1) Try load existing
    const { data: existing, error: selErr } = await supabase
      .from("user_recurring_platforms")
      .select("user_id,platform,autoaffi_user_code")
      .eq("user_id", userId)
      .eq("platform", platform)
      .maybeSingle();

    if (selErr) {
      return NextResponse.json(
        { ok: false, error: "DB_SELECT_FAILED", details: selErr.message },
        { status: 500 }
      );
    }

    let code = existing?.autoaffi_user_code as string | undefined;

    // 2) Create if missing
    if (!code) {
      code = randCode(12);

      const { error: insErr } = await supabase.from("user_recurring_platforms").insert({
        user_id: userId,
        platform,
        autoaffi_user_code: code,
      });

      if (insErr) {
        return NextResponse.json(
          { ok: false, error: "DB_INSERT_FAILED", details: insErr.message },
          { status: 500 }
        );
      }
    }

    const base =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.QR_PUBLIC_BASE_URL ||
      "http://localhost:3000";

    const affiliate_link = `${base.replace(/\/$/, "")}/?ref=${encodeURIComponent(code)}`;

    return NextResponse.json({ ok: true, userId, code, affiliate_link }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}