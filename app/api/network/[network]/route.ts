import { NextResponse } from "next/server";

function disabled() {
  return NextResponse.json(
    {
      success: false,
      error: "NETWORK_PROXY_DISABLED",
      message:
        "Arbitrary affiliate network proxy calls are disabled. This route is not used by the active dashboard.",
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
