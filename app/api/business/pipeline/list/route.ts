import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/supabase/server";
import { listPipeline } from "@/lib/business/services/pipelineListService";

export async function GET(req: Request) {
  try {
    const userId = await requireUserId(req);

    const url = new URL(req.url);
    const limit = Math.min(200, Math.max(10, Number(url.searchParams.get("limit") ?? 50)));

    const items = await listPipeline(userId, limit);
    return NextResponse.json({ ok: true, count: items.length, items });
  } catch (err: any) {
    const msg = err?.message ?? "Unknown error";
    const status = msg === "UNAUTHORIZED" ? 401 : 400;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}