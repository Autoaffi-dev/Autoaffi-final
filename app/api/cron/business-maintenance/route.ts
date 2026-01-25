import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * POST /api/cron/business-maintenance?key=CRON_SECRET
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

export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Robust import (använd din faktiska maintenance-funktion om den finns)
    // Om du redan har en service/runner i lib, byt till rätt import/namn här.
    const mod = (await import("@/lib/business/services/route")) as any;

    const runner =
      mod.runBusinessMaintenance ||
      mod.businessMaintenance ||
      mod.maintenance ||
      mod.default;

    if (!runner) {
      return NextResponse.json(
        {
          error: "Business maintenance runner not found.",
          hint: "Export runBusinessMaintenance() or default from lib/business/services/route.ts",
          exports: Object.keys(mod ?? {}),
        },
        { status: 500 }
      );
    }

    const startedAt = Date.now();

    // Kör maintenance – du kan lägga in options om din runner stödjer det
    const result = await runner({});

    const ms = Date.now() - startedAt;

    const { ok: _ok, tookMs: _tookMs, ...safe } = (result ?? {}) as any;

    return NextResponse.json({
      ok: true,
      tookMs: ms,
      ...safe,
    });
  } catch (err: any) {
    console.error("[cron/business-maintenance] error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Cron business-maintenance failed" },
      { status: 500 }
    );
  }
}

// ✅ cron-job.org kör ofta GET/HEAD → undvik 405
export async function GET(req: Request) {
  return POST(req);
}

export async function HEAD(req: Request) {
  const res = await POST(req);
  return new Response(null, { status: res.status, headers: res.headers });
}