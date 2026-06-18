import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/supabase/server";
import { getLeadDetails } from "@/lib/business/services/leadDetailsService";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const userId = await requireUserId(req);

    const body = await req.json();
    const source = body?.source as "places" | "registry" | undefined;
    const sourceId =
      typeof body?.sourceId === "string" ? body.sourceId.trim() : "";

    if (!source || !sourceId) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields: source, sourceId" },
        { status: 400 }
      );
    }

    if (source !== "places" && source !== "registry") {
      return NextResponse.json(
        { ok: false, error: "Invalid source" },
        { status: 400 }
      );
    }

    const data = await getLeadDetails({
      userId,
      source,
      sourceId,
    });

    if (!data.found) {
      return NextResponse.json(
        { ok: false, error: "Lead not found", source, sourceId },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      mode: "live",
      ...data,
    });
  } catch (err: any) {
    const msg = err?.message ?? "Unknown error";
    const status = msg === "UNAUTHORIZED" ? 401 : 400;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}