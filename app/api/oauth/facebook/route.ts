// app/api/oauth/facebook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.redirect(new URL("/login?error=unauthorized", req.url));
  }

  const platformParam = (req.nextUrl.searchParams.get("platform") || "facebook").toLowerCase();
  const platform = platformParam === "instagram" ? "instagram" : "facebook";

  const stateObj = { userId, platform, ts: Date.now() };
  const state = Buffer.from(JSON.stringify(stateObj), "utf8").toString("base64url");

  // Scopes: håll minimal för review-safe (utökar du senare när du går live med insights)
  // För riktig IG insights krävs ofta pages/ig scopes + app review.
  const scope = "public_profile,email";

  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_CLIENT_ID!,
    redirect_uri: process.env.NEXT_PUBLIC_FACEBOOK_REDIRECT!,
    response_type: "code",
    scope,
    state,
  });

  return NextResponse.redirect(`https://www.facebook.com/v20.0/dialog/oauth?${params.toString()}`);
}