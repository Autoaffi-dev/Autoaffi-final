import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * POST /api/cron/product-index?key=CRON_SECRET
 * header: x-autoaffi-cron: CRON_SECRET
 */

function isAuthorized(req: Request) {
  const headerSecret = req.headers.get("x-autoaffi-cron");
  const url = new URL(req.url);
  const querySecret = url.searchParams.get("key");
  const secret = process.env.CRON_SECRET;

  if (!secret) return false;
  return headerSecret === secret || querySecret === secret;
}

async function loadIndexerModule() {
  // Keep robust import (same path, but ready if you refactor later)
  return (await import("@/lib/engines/product-indexer/indexer")) as any;
}

export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      return NextResponse.json(
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

    // Avoid duplicate keys if runner returns ok/tookMs
    const { ok: _ok, tookMs: _tookMs, ...safe } = (result ?? {}) as any;

    return NextResponse.json({
      ok: true,
      tookMs: ms,
      ...safe,
    });
  } catch (err: any) {
    console.error("[cron/product-index] error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Cron product-index failed" },
      { status: 500 }
    );
  }
}