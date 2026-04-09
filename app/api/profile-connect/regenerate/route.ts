import { NextResponse } from "next/server";

/**
 * Dedicated helper route.
 * Frontend can call this, but the real regeneration is handled by:
 * POST /api/profile-connect/step/generate
 * with force_new=true
 *
 * We keep this route so your frontend has a clean semantic endpoint.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    return NextResponse.json({
      ok: true,
      hint: "Call /api/profile-connect/step/generate with force_new=true to regenerate a new variant.",
      received: {
        platform: body?.platform ?? null,
        step: body?.step ?? null,
        rotation_mode: body?.rotation_mode ?? "session",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || "Failed to process regenerate request",
      },
      { status: 400 }
    );
  }
}
