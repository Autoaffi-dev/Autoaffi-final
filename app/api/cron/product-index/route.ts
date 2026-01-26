import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Beast++: undvik att Vercel/Next försöker cache:a GET-responsen
export const dynamic = "force-dynamic";

/**
 * PRODUCT INDEX (BEAST++)
 * POST /api/cron/product-index?key=CRON_SECRET
 * header: x-autoaffi-cron: CRON_SECRET
 *
 * cron-job.org kan köra GET/HEAD vid test run → vi mappar GET/HEAD till samma logik.
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
    headers: {
      "cache-control": "no-store",
      ...(init?.headers ?? {}),
    },
  });
}

async function loadIndexerModule() {
  // Robust import (tål refactors)
  return (await import("@/lib/engines/product-indexer/indexer")) as any;
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
        {
          error: "Indexer runner not found in indexer module.",
          hint: "Export runProductIndexer() or default from indexer.ts",
          exports: Object.keys(mod ?? {}),
        },
        { status: 500 }
      );
    }

    const startedAt = Date.now();

    const result = await runner({
      limit: 200,
      sources: ["digistore", "mylead", "warriorplus"],
    });

    const ms = Date.now() - startedAt;

    // undvik dubbla keys om runner returnerar ok/tookMs
    const { ok: _ok, tookMs: _tookMs, ...safe } = (result ?? {}) as any;

    return jsonNoStore({
      ok: true,
      tookMs: ms,
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

// cron-job.org “test run” kan köra GET/HEAD → undvik 405
export async function GET(req: Request) {
  return handle(req);
}

export async function HEAD(req: Request) {
  const res = await handle(req);
  return new Response(null, { status: res.status, headers: res.headers });
}