import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/supabase/server";
import { listPipeline } from "@/lib/business/services/pipelineListService";

export const runtime = "nodejs";

function parseLimit(req: Request): number {
  const url = new URL(req.url);
  const raw = url.searchParams.get("limit");

  if (!raw) return 50;

  const n = Number(raw);
  if (!Number.isFinite(n)) return 50;

  return Math.min(200, Math.max(10, Math.round(n)));
}

export async function GET(req: Request) {
  try {
    const userId = await requireUserId(req);
    const limit = parseLimit(req);

    const items = await listPipeline(userId, limit);

    return NextResponse.json({
      ok: true,
      mode: "live",
      count: items.length,
      items,
    });
  } catch (err: any) {
    const msg = err?.message ?? "Unknown error";
    const status = msg === "UNAUTHORIZED" ? 401 : 400;

    return NextResponse.json(
      {
        ok: false,
        error: msg,
      },
      { status }
    );
  }
}