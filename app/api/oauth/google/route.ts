// app/api/oauth/google/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.redirect(new URL("/login?error=unauthorized", req.url));
  }

  const origin = req.nextUrl.origin;
  const platform = req.nextUrl.searchParams.get("platform") || "youtube";

  // ✅ alltid korrekt domän i alla miljöer
  const redirectUri = new URL("/api/oauth/google/callback", origin).toString();

  const stateObj = { userId, platform, ts: Date.now() };
  const state = Buffer.from(JSON.stringify(stateObj), "utf8").toString("base64url");

  // ✅ YouTube kräver extra scope om du ska hämta analytics/data
  const scope =
    platform === "youtube"
      ? [
          "openid",
          "profile",
          "email",
          "https://www.googleapis.com/auth/youtube.readonly",
        ].join(" ")
      : ["openid", "profile", "email"].join(" ");

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  if (!process.env.GOOGLE_CLIENT_ID) {
    return NextResponse.json({ success: false, error: "Missing GOOGLE_CLIENT_ID" }, { status: 500 });
  }

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}