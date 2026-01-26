import { NextResponse } from "next/server";

/**
 * V1 SKELETT:
 * - Daglig cron: 45-dagarsregeln → cooldown suppression
 * - Stub tills maintenanceService finns
 */
export async function POST() {
  return NextResponse.json({
    ok: true,
    mode: "stub",
    message:
      "Maintenance cron scaffolded. Next: find stale claims (>=45d, no reply, not WIN) and cooldown-suppress.",
  });
}