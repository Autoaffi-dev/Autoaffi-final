import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

async function loadIndexerModule() {
  return (await import("@/lib/engines/product-indexer/indexer")) as any;
}

async function handle(req: Request) {
  try {
    if (!isAuthorized(req)) return jsonNoStore({ error: "Unauthorized" }, { status: 401 });

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

    const result = await runner({
      limit: 250, // BEAST: högre så vi snabbare når 200–400+ i DB
      sources: ["digistore", "mylead", "warriorplus"],
    });

    const { ok: _ok, tookMs: _tookMs, ...safe } = (result ?? {}) as any;

    return jsonNoStore({
      ok: true,
      tookMs: Date.now() - startedAt,
      ...safe,
    });
  } catch (err: any) {
    console.error("[cron/product-index] error:", err);
    return jsonNoStore({ ok: false, error: err?.message ?? "Cron product-index failed" }, { status: 500 });
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