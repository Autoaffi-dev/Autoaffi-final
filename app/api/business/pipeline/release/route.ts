import { NextResponse } from "next/server";

/**
 * V1 SKELETT:
 * - Släpper claim (om vi tillåter manuell release)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const targetId = body?.targetId;

    if (!targetId) {
      return NextResponse.json(
        { ok: false, error: "Missing required field: targetId" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      mode: "stub",
      message: "Release stub. Next: delete from claimsRepo.",
      targetId,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body", details: err?.message ?? null },
      { status: 400 }
    );
  }
}