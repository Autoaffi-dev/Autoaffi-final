import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PRODUCT ALL (BEAST)
 * Runs:
 * 1) product-index  (fills product_index)
 * 2) product-winners (applies global winner policy + canonical dedupe)
 * 3) product-maintenance (stale/cooldown/dead-link check)
 *
 * GET/POST /api/cron/product-all?key=CRON_SECRET
 * Optional: caps overrides for winners:
 *  - source_cap, category_cap, merchant_cap, merchant_category_cap, category_band_cap
 *
 * Optional maintenance overrides:
 *  - stale_days, cooldown_days, link_check_limit, head_timeout_ms
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

function clampInt(v: string | null, min: number, max: number, fallback: number) {
  if (v === null || v === undefined || v === "") return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

async function callInternal(req: Request, pathWithQuery: string) {
  const url = new URL(req.url);
  const target = `${url.origin}${pathWithQuery}`;

  // pass secret via header (avoid logging query secrets in some setups)
  const secret = process.env.CRON_SECRET || "";
  const res = await fetch(target, {
    method: "GET",
    headers: {
      "x-autoaffi-cron": secret,
      accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const msg =
      json?.error ||
      json?.message ||
      (typeof text === "string" ? text.slice(0, 300) : "request failed");
    throw new Error(`${pathWithQuery} failed: ${res.status} ${msg}`);
  }

  return json;
}

async function handle(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const startedAt = Date.now();

    // ---------- Winner caps (overrides) ----------
    const sourceCap = clampInt(url.searchParams.get("source_cap"), 50, 5000, 800);
    const categoryCap = clampInt(url.searchParams.get("category_cap"), 50, 5000, 250);
    const merchantCap = clampInt(url.searchParams.get("merchant_cap"), 1, 500, 35);
    const merchantCategoryCap = clampInt(
      url.searchParams.get("merchant_category_cap"),
      1,
      200,
      12
    );
    const categoryBandCap = clampInt(
      url.searchParams.get("category_band_cap"),
      10,
      2000,
      120
    );

    // ---------- Maintenance overrides ----------
    const staleDays = clampInt(url.searchParams.get("stale_days"), 1, 120, 14);
    const cooldownDays = clampInt(url.searchParams.get("cooldown_days"), staleDays + 1, 365, 45);
    const linkCheckLimit = clampInt(url.searchParams.get("link_check_limit"), 0, 500, 25);
    const headTimeoutMs = clampInt(url.searchParams.get("head_timeout_ms"), 1000, 15000, 6000);

    // ---------- Step 1: product-index ----------
    const index = await callInternal(req, "/api/cron/product-index");

    // ---------- Step 2: product-winners ----------
    const winnersQs = new URLSearchParams({
      source_cap: String(sourceCap),
      category_cap: String(categoryCap),
      merchant_cap: String(merchantCap),
      merchant_category_cap: String(merchantCategoryCap),
      category_band_cap: String(categoryBandCap),
    }).toString();

    const winners = await callInternal(req, `/api/cron/product-winners?${winnersQs}`);

    // ---------- Step 3: product-maintenance ----------
    const maintQs = new URLSearchParams({
      stale_days: String(staleDays),
      cooldown_days: String(cooldownDays),
      link_check_limit: String(linkCheckLimit),
      head_timeout_ms: String(headTimeoutMs),
    }).toString();

    const maintenance = await callInternal(req, `/api/cron/product-maintenance?${maintQs}`);

    return jsonNoStore({
      ok: true,
      tookMs: Date.now() - startedAt,
      config: {
        winners: {
          source_cap: sourceCap,
          category_cap: categoryCap,
          merchant_cap: merchantCap,
          merchant_category_cap: merchantCategoryCap,
          category_band_cap: categoryBandCap,
        },
        maintenance: {
          stale_days: staleDays,
          cooldown_days: cooldownDays,
          link_check_limit: linkCheckLimit,
          head_timeout_ms: headTimeoutMs,
        },
      },
      steps: {
        index,
        winners,
        maintenance,
      },
    });
  } catch (err: any) {
    console.error("[cron/product-all] error:", err);
    return jsonNoStore(
      { ok: false, error: err?.message ?? "Cron product-all failed" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
export async function HEAD(req: Request) {
  const res = await handle(req);
  return new Response(null, { status: res.status, headers: res.headers });
}