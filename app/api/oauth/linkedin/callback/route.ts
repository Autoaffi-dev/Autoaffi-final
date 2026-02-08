// app/api/oauth/linkedin/callback/route.ts
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

  const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.NEXT_PUBLIC_LINKEDIN_REDIRECT!,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
    }),
  });

  const token = await tokenRes.json();

  if (!token?.access_token) {
    return NextResponse.redirect(
      new URL("/dashboard/social-accounts?error=token_failed&platform=linkedin", req.url)
    );
  }

  await upsertSocialAccount({
    userId: decoded.userId,
    platform: "linkedin",
    provider: "linkedin",
    accessToken: token.access_token,
    refreshToken: token.refresh_token || null,
    expiresInSec: token.expires_in || null,
    meta: { raw: { token_raw: token } },
  });

  return NextResponse.redirect(new URL("/dashboard/social-accounts?connected=linkedin", req.url));
}