import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const contentType = req.headers.get("content-type");

  // Block malicious RSC payloads (DoS protection)
  if (contentType && contentType.includes("application/octet-stream")) {
    return NextResponse.json(
      { error: "Invalid request payload" },
      { status: 400 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};