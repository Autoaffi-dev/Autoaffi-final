import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/supabase/server";
import { getBusinessDetails } from "@/lib/business/services/detailsService";

export async function POST(req: Request) {
  try {
    await requireUserId(req); // vi behöver inte userId här än, men auth-skydd är bra

    const body = await req.json();
    const source = body?.source as "places" | "registry" | undefined;
    const sourceId = body?.sourceId as string | undefined;

    if (!source || !sourceId) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields: source, sourceId" },
        { status: 400 }
      );
    }

    if (source !== "places" && source !== "registry") {
      return NextResponse.json({ ok: false, error: "Invalid source" }, { status: 400 });
    }

    const data = await getBusinessDetails({ source, sourceId });
    return NextResponse.json({ ok: true, ...data });
  } catch (err: any) {
    const msg = err?.message ?? "Unknown error";
    const status = msg === "UNAUTHORIZED" ? 401 : 400;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}