import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  // Du måste vara inloggad för att koppla ett konto
  if (!userId) {
    return NextResponse.redirect(new URL("/login?error=unauthorized", req.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { success: false, error: "Missing GOOGLE_CLIENT_ID" },
      { status: 500 }
    );
  }

  const origin = req.nextUrl.origin;
  const platform = req.nextUrl.searchParams.get("platform") || "youtube";

  // ✅ Måste matcha Google Console redirect URI EXAKT
  const redirectUri = new URL("/api/oauth/google/callback", origin).toString();

  // ✅ State: skicka INTE userId (vi tar userId från session i callback)
  const stateObj = { platform, ts: Date.now() };
  const state = Buffer.from(JSON.stringify(stateObj), "utf8").toString("base64url");

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
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}