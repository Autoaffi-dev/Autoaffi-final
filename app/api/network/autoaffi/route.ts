import { NextResponse } from "next/server";

function disabled() {
  return NextResponse.json(
    {
      success: false,
      error: "AUTOAFFI_NETWORK_INGEST_DISABLED",
      message: "Mock Autoaffi revenue ingest/read is disabled.",
    },
    { status: 503 }
  );
}

export async function POST() {
  return disabled();
}

export async function GET() {
  return disabled();
}
