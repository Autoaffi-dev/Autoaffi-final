import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/supabase/server";
import { recordBusinessEvent } from "@/lib/business/services/eventsService";

export async function POST(req: Request) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();

    const targetId = body?.targetId as string | undefined;
    const eventType = body?.eventType as
      | "sent"
      | "reply"
      | "no"
      | "stop"
      | "bounce"
      | undefined;

    if (!targetId || !eventType) {
      return NextResponse.json(
        { ok: false, error: "Missing targetId/eventType" },
        { status: 400 }
      );
    }

    await recordBusinessEvent({
      userId,
      targetId,
      eventType,
      channel: body?.channel ?? "email",
      meta: body?.meta ?? null,
    });

    return NextResponse.json({ ok: true, targetId, eventType });
  } catch (err: any) {
    const msg = err?.message ?? "Unknown error";
    const status = msg === "UNAUTHORIZED" ? 401 : 400;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}