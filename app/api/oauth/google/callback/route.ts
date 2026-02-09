import { NextRequest, NextResponse } from "next/server";
import { upsertSocialAccount } from "@/lib/socialStore";

export const runtime = "nodejs";

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

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL("/login/dashboard/social-accounts?error=missing_google_env&platform=youtube", req.url)
    );
  }

  const origin = req.nextUrl.origin;
  const redirectUri = new URL("/api/oauth/google/callback", origin).toString();

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const token = await tokenRes.json();

  if (!tokenRes.ok || !token?.access_token) {
    return NextResponse.redirect(
      new URL("/login/dashboard/social-accounts?error=token_failed&platform=youtube", req.url)
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

  return NextResponse.redirect(
    new URL("/login/dashboard/social-accounts?connected=youtube", req.url)
  );
}