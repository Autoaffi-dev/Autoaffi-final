import { NextResponse } from "next/server";
import { runCooldownMaintenance } from "@/lib/business/services/cooldownService";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const result = await runCooldownMaintenance({
      inactiveDays: Number(body?.inactiveDays ?? 45),
      cooldownDays: Number(body?.cooldownDays ?? 90),
      limit: Number(body?.limit ?? 100),
    });

    return NextResponse.json({
      ok: true,
      mode: "live",
      maintenance: "cooldown",
      result,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "Cooldown maintenance failed",
        details: err?.message ?? null,
      },
      { status: 500 }
    );
  }
}