import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PRODUCT WINNERS (BEAST)
 * GET/POST/HEAD /api/cron/product-winners?key=CRON_SECRET
 * header (optional): x-autoaffi-cron: CRON_SECRET
 *
 * Runs SQL winner policy:
 * - dedupe by canonical_hash
 * - caps per source/category/merchant
 * - writes is_active + dead_reason + winner_tier
 */

function isAuthorized(req: Request) {
  const headerSecret = req.headers.get("x-autoaffi-cron");
  const url = new URL(req.url);
  const querySecret = url.searchParams.get("key");
  const secret = process.env.CRON_SECRET;

  if (!secret) return false;
  return headerSecret === secret || querySecret === secret;
}

function jsonNoStore(body: any, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { "cache-control": "no-store", ...(init?.headers ?? {}) },
  });
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE env vars (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)."
    );
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

function toInt(v: string | null, fallback: number, min = 1, max = 5000) {
  const n = v ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

async function handle(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);

    // Optional override via query params (safe defaults)
    const p_source_cap = toInt(url.searchParams.get("source_cap"), 800, 1, 5000);
    const p_category_cap = toInt(url.searchParams.get("category_cap"), 250, 1, 2000);
    const p_merchant_cap = toInt(url.searchParams.get("merchant_cap"), 35, 1, 500);
    const p_merchant_category_cap = toInt(
      url.searchParams.get("merchant_category_cap"),
      12,
      1,
      200
    );
    const p_category_band_cap = toInt(
      url.searchParams.get("category_band_cap"),
      120,
      1,
      2000
    );

    const supabase = getSupabaseAdmin();
    const startedAt = Date.now();

    const { data, error } = await supabase.rpc("product_index_apply_winner_policy", {
      p_source_cap,
      p_category_cap,
      p_merchant_cap,
      p_merchant_category_cap,
      p_category_band_cap,
    });

    if (error) {
      return jsonNoStore(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return jsonNoStore({
      ok: true,
      tookMs: Date.now() - startedAt,
      result: data ?? null,
      policy: {
        p_source_cap,
        p_category_cap,
        p_merchant_cap,
        p_merchant_category_cap,
        p_category_band_cap,
      },
    });
  } catch (err: any) {
    console.error("[cron/product-winners] error:", err);
    return jsonNoStore(
      { ok: false, error: err?.message ?? "Cron product-winners failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  return handle(req);
}
export async function GET(req: Request) {
  return handle(req);
}
export async function HEAD(req: Request) {
  const res = await handle(req);
  return new Response(null, { status: res.status, headers: res.headers });
}