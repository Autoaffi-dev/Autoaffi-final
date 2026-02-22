import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ✅ Universal Cron Auth (Autoaffi)
 * Supports:
 * - Header: x-autoaffi-cron
 * - Header: x-cron-secret
 * - Header: Authorization: Bearer <secret>
 * - Query: ?secret=<secret>
 * - Query: ?key=<secret> (back-compat)
 */
function isAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const url = new URL(req.url);

  const headerSecret =
    req.headers.get("x-autoaffi-cron") ||
    req.headers.get("x-cron-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    null;

  const querySecret =
    url.searchParams.get("secret") ||
    url.searchParams.get("key") ||
    null;

  return headerSecret === secret || querySecret === secret;
}

function jsonNoStore(body: any, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { "cache-control": "no-store", ...(init?.headers ?? {}) },
  });
}

async function loadIndexerModule() {
  return (await import("@/lib/engines/product-indexer/indexer")) as any;
}

// Default: ALWAYS WP + AWIN (per your request)
function getSources(): Array<"warriorplus" | "awin"> {
  const raw = (process.env.PRODUCT_INDEX_CRON_SOURCES || "").trim();
  if (!raw) return ["warriorplus", "awin"];

  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as any[];

  // hard-safety: only allow these in this cron
  const allowed = new Set(["warriorplus", "awin"]);
  const safe = parts.filter((s) => allowed.has(String(s)));

  return (safe.length ? safe : ["warriorplus", "awin"]) as Array<
    "warriorplus" | "awin"
  >;
}

async function handle(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
    }

    const mod = await loadIndexerModule();
    const runner =
      mod.runProductIndexer ||
      mod.refreshProductIndex ||
      mod.rebuildProductIndex ||
      mod.buildProductIndex ||
      mod.indexProducts ||
      mod.default;

    if (!runner) {
      return jsonNoStore(
        { error: "Indexer runner not found.", exports: Object.keys(mod ?? {}) },
        { status: 500 }
      );
    }

    const startedAt = Date.now();

    const sources = getSources();
    const limit = Math.max(
      1,
      Math.min(Number(process.env.PRODUCT_INDEX_CRON_LIMIT || 400), 500)
    );

    const result = await runner({
      limit,
      sources,
    });

    const { ok: _ok, tookMs: _tookMs, ...safe } = (result ?? {}) as any;

    return jsonNoStore({
      ok: true,
      tookMs: Date.now() - startedAt,
      sources,
      limit,
      ...safe,
    });
  } catch (err: any) {
    console.error("[cron/product-index] error:", err);
    return jsonNoStore(
      { ok: false, error: err?.message ?? "Cron product-index failed" },
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
  const res: any = await handle(req);
  return new Response(null, { status: res.status, headers: res.headers });
}