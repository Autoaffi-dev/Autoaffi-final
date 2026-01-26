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

function collectErrorsFromReport(report: any): string[] {
  const out: string[] = [];
  const sources = report?.sources ?? {};
  for (const key of Object.keys(sources)) {
    const errs = sources?.[key]?.errors;
    if (Array.isArray(errs) && errs.length) {
      out.push(...errs.map((e: any) => `${key}: ${String(e)}`));
    }
  }
  return out;
}

async function handle(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return jsonNoStore({ ok: false, error: "Unauthorized" }, { status: 401 });
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
          ok: false,
          error: "Indexer runner not found in indexer module.",
          hint: "Export runProductIndexer() or default from indexer.ts",
          exports: Object.keys(mod ?? {}),
        },
        { status: 500 }
      );
    }

    const startedAt = Date.now();

    const report = await runner({
      limit: 200,
      sources: ["digistore", "mylead", "warriorplus"],
    });

    const tookMs = Date.now() - startedAt;

    // BEAST: om indexern rapporterar fel -> gör HTTP 500 så cron blir röd
    const errors = collectErrorsFromReport(report);
    const okFromRunner = typeof report?.ok === "boolean" ? report.ok : errors.length === 0;

    // undvik dubbla keys om runner returnerar ok/tookMs
    const { ok: _ok, tookMs: _tookMs, ...safe } = (report ?? {}) as any;

    return jsonNoStore(
      {
        ok: okFromRunner,
        tookMs,
        ...safe,
        errors, // alltid synligt om något strular
      },
      { status: okFromRunner ? 200 : 500 }
    );
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