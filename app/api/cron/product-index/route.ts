import { NextResponse } from "next/server";
import { isCronRequestAuthorized } from "@/lib/auth/cronAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: Request) {
  return isCronRequestAuthorized(req);
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

function getSources(): Array<"warriorplus" | "awin" | "cj" | "aliexpress"> {
  const raw = (process.env.PRODUCT_INDEX_CRON_SOURCES || "").trim();

  if (!raw) return ["warriorplus", "awin", "aliexpress"];

  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as any[];

  const allowed = new Set(["warriorplus", "awin", "cj", "aliexpress"]);
  const safe = parts.filter((s) => allowed.has(String(s)));

  return (safe.length ? safe : ["warriorplus", "awin", "aliexpress"]) as Array<
    "warriorplus" | "awin" | "cj" | "aliexpress"
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