import { NextResponse } from "next/server";

/**
 * V1 SKELETT:
 * - Claimar target (exklusivitet) + lägger i pipeline
 * - Stub tills DB/repos finns
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const target = body?.target; // normalized target payload
    if (!target) {
      return NextResponse.json(
        { ok: false, error: "Missing required field: target" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      mode: "stub",
      message: "Claim stub. Next: atomic claim + pipeline insert.",
      target,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body", details: err?.message ?? null },
      { status: 400 }
    );
  }
}