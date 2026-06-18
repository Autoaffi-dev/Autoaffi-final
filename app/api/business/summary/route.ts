import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/supabase/server";
import { getBusinessSummary } from "@/lib/business/services/summaryService";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const userId = await requireUserId(req);
    const summary = await getBusinessSummary(userId);

    return NextResponse.json({
      ok: true,
      mode: "live",
      summary,
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