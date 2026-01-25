import { NextResponse } from "next/server";

/**
 * V1 SKELETT:
 * - Returnerar stats till Growth Engine Card
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    mode: "stub",
    stats: {
      newLeadsToday: 0,
      hot: 0,
      warm: 0,
      cold: 0,
      wins: 0,
      suppressedHard: 0,
      suppressedCooldown: 0,
    },
  });
}