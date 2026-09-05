import { NextResponse } from "next/server";
import { isCronRequestAuthorized } from "@/lib/auth/cronAuth";

/**
 * V1 SKELETT:
 * - Daglig cron: 45-dagarsregeln → cooldown suppression
 * - Stub tills maintenanceService finns
 */
export async function POST(req: Request) {
  if (!isCronRequestAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    mode: "stub",
    message:
      "Maintenance cron scaffolded. Next: find stale claims (>=45d, no reply, not WIN) and cooldown-suppress.",
  });
}
