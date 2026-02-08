// app/api/oauth/facebook/callback/route.ts
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

  const platform = decoded.platform === "instagram" ? "instagram" : "facebook";

  const tokenRes = await fetch(
    "https://graph.facebook.com/v20.0/oauth/access_token?" +
      new URLSearchParams({
        client_id: process.env.FACEBOOK_CLIENT_ID!,
        client_secret: process.env.FACEBOOK_CLIENT_SECRET!,
        redirect_uri: process.env.NEXT_PUBLIC_FACEBOOK_REDIRECT!,
        code,
      })
  );

  const token = await tokenRes.json();

  if (!token?.access_token) {
    return NextResponse.redirect(
      new URL(`/dashboard/social-accounts?error=token_failed&platform=${platform}`, req.url)
    );
  }

  await upsertSocialAccount({
    userId: decoded.userId,
    platform,              // instagram eller facebook (UX korrekt)
    provider: "meta",       // du använder meta i sync
    accessToken: token.access_token,
    refreshToken: null,
    expiresInSec: token.expires_in || null,
    meta: { raw: { token_raw: token } },
  });

  return NextResponse.redirect(
    new URL(`/dashboard/social-accounts?connected=${platform}`, req.url)
  );
}