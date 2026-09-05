import { NextResponse } from "next/server";

function disabled() {
  return NextResponse.json(
    {
      error: "PAYOUTS_DISABLED",
      message: "Payouts are not available. The production finance layer does not exist yet.",
    },
    { status: 503 }
  );
}

export async function GET() {
  return disabled();
}

export async function POST() {
  return disabled();
}
