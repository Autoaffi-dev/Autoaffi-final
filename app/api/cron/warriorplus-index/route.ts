import { NextResponse } from "next/server";
import { isCronRequestAuthorized } from "@/lib/auth/cronAuth";
import { runWarriorPlusIndexCron } from "@/lib/engines/product-indexer/warriorPlusIndexCron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function resolveLimit() {
  return Math.max(
    1,
    Math.min(Number(process.env.PRODUCT_INDEX_CRON_LIMIT || 400), 500)
  );
}

async function handle(req: Request) {
  const authorized = isCronRequestAuthorized(req);
  const outcome = await runWarriorPlusIndexCron({
    authorized,
    limit: resolveLimit(),
    loadRunner: async () => {
      const mod = await import("@/lib/engines/product-indexer/indexer");
      return mod.runProductIndexer;
    },
  });
  return jsonNoStore(outcome.body, outcome.status);
}

export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}
