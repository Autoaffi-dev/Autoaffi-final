import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "AFFILIATE_WEBHOOK_DISABLED",
      message: "Affiliate webhook ingestion is not configured. Unsigned money-shaped writes are disabled.",
    },
    { status: 503 }
  );
}
