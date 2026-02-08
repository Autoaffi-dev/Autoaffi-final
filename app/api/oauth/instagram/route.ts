// app/api/oauth/instagram/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // Håll Instagram i Meta-flödet (stabilt och matchar din sync/meta logik)
  return NextResponse.redirect(new URL("/api/oauth/facebook?platform=instagram", req.url));
}