import { NextResponse } from "next/server";

/**
 * V1 SKELETT:
 * - Hard suppression (NEJ/STOP) eller cooldown suppression
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const targetId = body?.targetId;
    const type = body?.type; // "hard" | "cooldown"

    if (!targetId || !type) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields: targetId, type" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      mode: "stub",
      message: "Suppress stub. Next: write to suppressionsRepo + remove claim.",
      targetId,
      type,
      reason: body?.reason ?? null,
      suppressedUntil: body?.suppressedUntil ?? null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body", details: err?.message ?? null },
      { status: 400 }
    );
  }
}