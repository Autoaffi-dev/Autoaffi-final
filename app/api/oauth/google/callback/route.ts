// app/api/oauth/google/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { upsertSocialAccount } from "@/lib/socialStore";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/login?error=missing_code", req.url));
  }

  let decoded: { userId: string; platform: string; ts: number };
  try {
    decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
  } catch {
    return NextResponse.redirect(new URL("/login?error=bad_state", req.url));
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.NEXT_PUBLIC_GOOGLE_REDIRECT!,
      grant_type: "authorization_code",
    }),
  });

  const token = await tokenRes.json();

  if (!token?.access_token) {
    return NextResponse.redirect(
      new URL("/dashboard/social-accounts?error=token_failed&platform=youtube", req.url)
    );
  }

  await upsertSocialAccount({
    userId: decoded.userId,
    platform: "youtube",
    provider: "google",
    accessToken: token.access_token,
    refreshToken: token.refresh_token || null,
    expiresInSec: token.expires_in || null,
    meta: { raw: { token_raw: token } },
  });

  return NextResponse.redirect(new URL("/dashboard/social-accounts?connected=youtube", req.url));
}