import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * PRODUCT MAINTENANCE (BEAST)
 * GET/POST /api/cron/product-maintenance?key=CRON_SECRET
 * header (optional): x-autoaffi-cron: CRON_SECRET
 */

function isAuthorized(req: Request) {
  const headerSecret = req.headers.get("x-autoaffi-cron");
  const url = new URL(req.url);
  const querySecret = url.searchParams.get("key");
  const secret = process.env.CRON_SECRET;

  if (!secret) return false;
  return headerSecret === secret || querySecret === secret;
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

function isoNow() {
  return new Date().toISOString();
}

function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

async function headWithTimeout(url: string, timeoutMs: number): Promise<number | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
    });
    return res.status;
  } catch {
    // nätfel/timeouts => markera inte dead (för aggressivt annars)
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function runProductMaintenance(opts?: {
  staleDays?: number;      // default 14
  cooldownDays?: number;   // default 45
  linkCheckLimit?: number; // default 25
  headTimeoutMs?: number;  // default 6000
}) {
  const supabase = getSupabaseAdmin();

  const staleDays = Math.max(1, Math.min(opts?.staleDays ?? 14, 90));
  const cooldownDays = Math.max(staleDays + 1, Math.min(opts?.cooldownDays ?? 45, 365));
  const linkCheckLimit = Math.max(0, Math.min(opts?.linkCheckLimit ?? 25, 200));
  const headTimeoutMs = Math.max(1000, Math.min(opts?.headTimeoutMs ?? 6000, 15000));

  const ranAt = isoNow();
  const errors: string[] = [];

  let markedStaleInactive = 0;
  let cooledDown = 0;
  let checkedLinks = 0;
  let markedDeadByHttp = 0;

  // 1) Stale cleanup => inaktivera om inte setts på X dagar (endast aktiva)
  try {
    const staleBefore = daysAgoIso(staleDays);

    const { data, error } = await supabase
      .from("product_index")
      .update({
        is_active: false,
        dead_reason: "stale_not_seen",
      })
      .lt("last_seen_at", staleBefore)
      .eq("is_active", true)
      .select("id");

    if (error) throw error;
    markedStaleInactive = data?.length ?? 0;
  } catch (e: any) {
    errors.push(`stale_cleanup: ${e?.message ?? String(e)}`);
  }

  // 2) Cooldown => extra hård cleanup efter cooldownDays (endast aktiva)
  try {
    const cooldownBefore = daysAgoIso(cooldownDays);

    const { data, error } = await supabase
      .from("product_index")
      .update({
        is_active: false,
        dead_reason: "cooldown_45d",
        winner_tier: null,
      })
      .lt("last_seen_at", cooldownBefore)
      .eq("is_active", true)
      .select("id");

    if (error) throw error;
    cooledDown = data?.length ?? 0;
  } catch (e: any) {
    errors.push(`cooldown: ${e?.message ?? String(e)}`);
  }

  // 3) Light dead-link check (bara 404/410)
  if (linkCheckLimit > 0) {
    try {
      const { data, error } = await supabase
        .from("product_index")
        .select("id, product_url, landing_url")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(linkCheckLimit);

      if (error) throw error;

      for (const row of data ?? []) {
        const url = (row.product_url || row.landing_url || "").trim();
        if (!url) continue;

        checkedLinks++;
        const status = await headWithTimeout(url, headTimeoutMs);

        if (status === 404 || status === 410) {
          markedDeadByHttp++;
          await supabase
            .from("product_index")
            .update({
              is_active: false,
              dead_reason: `http_${status}`,
            })
            .eq("id", row.id);
        }
      }
    } catch (e: any) {
      errors.push(`dead_link_check: ${e?.message ?? String(e)}`);
    }
  }

  return {
    ok: errors.length === 0,
    ranAt,
    config: { staleDays, cooldownDays, linkCheckLimit, headTimeoutMs },
    summary: { markedStaleInactive, cooledDown, checkedLinks, markedDeadByHttp, errors },
  };
}

async function handle(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = Date.now();

    const result = await runProductMaintenance({
      staleDays: 14,
      cooldownDays: 45,
      linkCheckLimit: 25,
      headTimeoutMs: 6000,
    });

    // undvik dubbla keys
    const { ok: _ok, tookMs: _tookMs, ...safe } = (result ?? {}) as any;

    return NextResponse.json({
      ok: true,
      tookMs: Date.now() - startedAt,
      ...safe,
    });
  } catch (err: any) {
    console.error("[cron/product-maintenance] error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Cron product-maintenance failed" },
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