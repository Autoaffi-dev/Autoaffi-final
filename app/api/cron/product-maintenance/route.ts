import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PRODUCT MAINTENANCE (BEAST + TIMEOUT SAFE)
 * GET/POST /api/cron/product-maintenance?key=CRON_SECRET
 * header (optional): x-autoaffi-cron: CRON_SECRET
 *
 * ✅ Timeout-safe for cron-job.org:
 * - time budget (stop early)
 * - batch processing
 * - limited HEAD checks with concurrency + abort
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
  // ✅ support both naming styles you’ve used
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE__SERVICE_ROLE_KEY || // <-- double underscore variant
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

function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function clampInt(v: any, def: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
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
    // network error/timeout => do NOT mark dead aggressively
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

async function runProductMaintenance(req: Request, opts?: {
  staleDays?: number;        // default 14
  cooldownDays?: number;     // default 45
  headTimeoutMs?: number;    // default 3500
  linkCheckLimit?: number;   // default 12
  headConcurrency?: number;  // default 2
  // Timeout-safe knobs:
  timeBudgetMs?: number;     // default 6500
  staleBatch?: number;       // default 400
  cooldownBatch?: number;    // default 400
}) {
  const supabase = getSupabaseAdmin();

  const url = new URL(req.url);

  // ---- Defaults + override via env/query (safe) ----
  const staleDays = Math.max(1, Math.min(opts?.staleDays ?? 14, 90));
  const cooldownDays = Math.max(staleDays + 1, Math.min(opts?.cooldownDays ?? 45, 365));

  const timeBudgetMs = clampInt(
    url.searchParams.get("budgetMs") ?? process.env.PRODUCT_MAINTENANCE_BUDGET_MS ?? opts?.timeBudgetMs,
    6500,
    1500,
    20000
  );

  const staleBatch = clampInt(
    url.searchParams.get("staleBatch") ?? process.env.PRODUCT_MAINTENANCE_STALE_BATCH ?? opts?.staleBatch,
    400,
    50,
    5000
  );

  const cooldownBatch = clampInt(
    url.searchParams.get("cooldownBatch") ?? process.env.PRODUCT_MAINTENANCE_COOLDOWN_BATCH ?? opts?.cooldownBatch,
    400,
    50,
    5000
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

  let markedStaleInactive = 0;
  let cooledDown = 0;
  let checkedLinks = 0;
  let markedDeadByHttp = 0;

  const timeLeft = () => timeBudgetMs - (Date.now() - startedAt);
  const shouldStop = () => timeLeft() <= 300; // leave some buffer

  // 1) Stale cleanup (TIME SAFE) => inactivate if not seen in X days
  // We do this in a "select ids" + "update ids" pattern to avoid huge update timeouts.
  try {
    if (!shouldStop()) {
      const staleBefore = daysAgoIso(staleDays);

      const { data: staleRows, error: selErr } = await supabase
        .from("product_index")
        .select("id")
        .lt("last_seen_at", staleBefore)
        .eq("is_active", true)
        .limit(staleBatch);

      if (selErr) throw selErr;

      const ids = (staleRows ?? []).map((r: any) => r.id).filter(Boolean);

      if (ids.length > 0 && !shouldStop()) {
        const { data: upd, error: updErr } = await supabase
          .from("product_index")
          .update({
            is_active: false,
            dead_reason: "stale_not_seen",
          })
          .in("id", ids)
          .select("id");

        if (updErr) throw updErr;
        markedStaleInactive = upd?.length ?? 0;
      }
    }
  } catch (e: any) {
    errors.push(`stale_cleanup: ${e?.message ?? String(e)}`);
  }

  // 2) Cooldown (TIME SAFE) => harder cleanup after cooldownDays
  try {
    if (!shouldStop()) {
      const cooldownBefore = daysAgoIso(cooldownDays);

      const { data: cdRows, error: selErr } = await supabase
        .from("product_index")
        .select("id")
        .lt("last_seen_at", cooldownBefore)
        .eq("is_active", true)
        .limit(cooldownBatch);

      if (selErr) throw selErr;

      const ids = (cdRows ?? []).map((r: any) => r.id).filter(Boolean);

      if (ids.length > 0 && !shouldStop()) {
        const { data: upd, error: updErr } = await supabase
          .from("product_index")
          .update({
            is_active: false,
            dead_reason: "cooldown_45d",
            winner_tier: null,
          })
          .in("id", ids)
          .select("id");

        if (updErr) throw updErr;
        cooledDown = upd?.length ?? 0;
      }
    }
  } catch (e: any) {
    errors.push(`cooldown: ${e?.message ?? String(e)}`);
  }

  // 3) Light dead-link check (only 404/410) - TIME SAFE + concurrency + abort
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

        // Stop early if low time left
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

        // Apply updates for 404/410 only
        const deadIds = results
          .filter((r) => r.status === 404 || r.status === 410)
          .map((r) => r.id)
          .filter(Boolean);

        if (deadIds.length > 0 && !shouldStop()) {
          markedDeadByHttp = deadIds.length;

          // Update in one query (fast)
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
      staleDays,
      cooldownDays,
      staleBatch,
      cooldownBatch,
      linkCheckLimit,
      headTimeoutMs,
      headConcurrency,
    },
    summary: {
      markedStaleInactive,
      cooledDown,
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
      staleDays: 14,
      cooldownDays: 45,
      linkCheckLimit: 12,     // ✅ lower default to avoid cron-job.org timeout
      headTimeoutMs: 3500,    // ✅ lower default
      headConcurrency: 2,     // ✅ gentle
      timeBudgetMs: 6500,     // ✅ safe default for cron-job.org
      staleBatch: 400,
      cooldownBatch: 400,
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