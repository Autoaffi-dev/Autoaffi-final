import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/supabase/server";
import { getOutreachGuidance } from "@/lib/business/services/outreachGuidanceService";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await requireUserId(req);

    const body = await req.json();

    const source = body?.source;
    const sourceId =
      typeof body?.sourceId === "string" ? body.sourceId.trim() : "";

    if (source !== "places" && source !== "registry") {
      return NextResponse.json(
        { ok: false, error: "Invalid or missing field: source" },
        { status: 400 }
      );
    }

    if (!sourceId) {
      return NextResponse.json(
        { ok: false, error: "Missing required field: sourceId" },
        { status: 400 }
      );
    }

    const result = await getOutreachGuidance({
      source,
      sourceId,
    });

    if (!result.found) {
      return NextResponse.json(
        {
          ok: false,
          error: "Business not found",
          source,
          sourceId,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      mode: "live",
      guidance: result,
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