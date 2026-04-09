import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PRODUCT MAINTENANCE (SAFE VERSION)
 * GET/POST /api/cron/product-maintenance?key=CRON_SECRET
 * header (optional): x-autoaffi-cron: CRON_SECRET
 *
 * FIX:
 * - DO NOT deactivate products just because they were not seen recently
 * - DO NOT apply cooldown_45d to product_index
 * - ONLY do light dead-link checks (404/410)
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
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE__SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE env vars (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL) + (SUPABASE_SERVICE_ROLE_KEY or SUPABASE__SERVICE_ROLE_KEY)."
    );
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

function isoNow() {
  return new Date().toISOString();
}

function clampInt(v: any, def: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.floor(n)));
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
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = [];
  let i = 0;

  async function runner() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await worker(items[idx]);
    }
  }

  const runners = Array.from({ length: Math.max(1, concurrency) }, () => runner());
  await Promise.all(runners);
  return out;
}

async function runProductMaintenance(
  req: Request,
  opts?: {
    headTimeoutMs?: number;
    linkCheckLimit?: number;
    headConcurrency?: number;
    timeBudgetMs?: number;
  }
) {
  const supabase = getSupabaseAdmin();
  const url = new URL(req.url);

  const timeBudgetMs = clampInt(
    url.searchParams.get("budgetMs") ?? process.env.PRODUCT_MAINTENANCE_BUDGET_MS ?? opts?.timeBudgetMs,
    6500,
    1500,
    20000
  );

  const linkCheckLimit = clampInt(
    url.searchParams.get("linkCheckLimit") ?? process.env.PRODUCT_MAINTENANCE_LINKCHECK_LIMIT ?? opts?.linkCheckLimit,
    12,
    0,
    200
  );

  const headTimeoutMs = clampInt(
    url.searchParams.get("headTimeoutMs") ?? process.env.PRODUCT_MAINTENANCE_HEAD_TIMEOUT_MS ?? opts?.headTimeoutMs,
    3500,
    1000,
    15000
  );

  const headConcurrency = clampInt(
    url.searchParams.get("headConcurrency") ?? process.env.PRODUCT_MAINTENANCE_HEAD_CONCURRENCY ?? opts?.headConcurrency,
    2,
    1,
    5
  );

  const ranAt = isoNow();
  const startedAt = Date.now();
  const errors: string[] = [];

  let checkedLinks = 0;
  let markedDeadByHttp = 0;

  const timeLeft = () => timeBudgetMs - (Date.now() - startedAt);
  const shouldStop = () => timeLeft() <= 300;

  /**
   * IMPORTANT:
   * stale_not_seen + cooldown_45d are intentionally disabled.
   * Product index sources do not all refresh at the same frequency,
   * and temporary cron/fetch failures should NOT deactivate entire sources.
   */
  const staleCleanupDisabled = true;
  const cooldownDisabled = true;

  if (linkCheckLimit > 0) {
    try {
      if (!shouldStop()) {
        const { data, error } = await supabase
          .from("product_index")
          .select("id, product_url, landing_url")
          .eq("is_active", true)
          .order("updated_at", { ascending: false })
          .limit(linkCheckLimit);

        if (error) throw error;

        const rows = (data ?? []).filter(Boolean);
        const safeRows = shouldStop() ? [] : rows;

        const results = await runWithConcurrency(
          safeRows,
          headConcurrency,
          async (row: any) => {
            if (shouldStop()) return { id: row.id, status: null as number | null };

            const u = String(row.product_url || row.landing_url || "").trim();
            if (!u) return { id: row.id, status: null as number | null };

            checkedLinks++;
            const status = await headWithTimeout(u, headTimeoutMs);
            return { id: row.id, status };
          }
        );

        const deadIds = results
          .filter((r) => r.status === 404 || r.status === 410)
          .map((r) => r.id)
          .filter(Boolean);

        if (deadIds.length > 0 && !shouldStop()) {
          markedDeadByHttp = deadIds.length;

          const { error: updErr } = await supabase
            .from("product_index")
            .update({
              is_active: false,
              dead_reason: "http_dead",
            })
            .in("id", deadIds);

          if (updErr) throw updErr;
        }
      }
    } catch (e: any) {
      errors.push(`dead_link_check: ${e?.message ?? String(e)}`);
    }
  }

  return {
    ok: errors.length === 0,
    ranAt,
    timeBudgetMs,
    config: {
      staleCleanupDisabled,
      cooldownDisabled,
      linkCheckLimit,
      headTimeoutMs,
      headConcurrency,
    },
    summary: {
      checkedLinks,
      markedDeadByHttp,
      errors,
      stoppedEarly: shouldStop(),
      tookMs: Date.now() - startedAt,
    },
  };
}

async function handle(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await runProductMaintenance(req, {
      linkCheckLimit: 12,
      headTimeoutMs: 3500,
      headConcurrency: 2,
      timeBudgetMs: 6500,
    });

    return jsonNoStore(result);
  } catch (err: any) {
    console.error("[cron/product-maintenance] error:", err);
    return jsonNoStore(
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