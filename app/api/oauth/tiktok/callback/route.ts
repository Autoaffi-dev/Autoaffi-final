// app/api/oauth/tiktok/callback/route.ts
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

  const res = await fetch("https://open-api.tiktok.com/oauth/access_token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_ID!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: process.env.NEXT_PUBLIC_TIKTOK_REDIRECT!,
    }),
  });

  const json = await res.json();

  // TikTok kan svara på olika format:
  const accessToken =
    json?.access_token ||
    json?.data?.access_token ||
    json?.data?.access_token?.token ||
    null;

  const refreshToken = json?.refresh_token || json?.data?.refresh_token || null;
  const expiresInSec = json?.expires_in || json?.data?.expires_in || null;
  const openId = json?.open_id || json?.data?.open_id || null;
  const scope = json?.scope || json?.data?.scope || null;

  if (!accessToken) {
    return NextResponse.redirect(
      new URL("/dashboard/social-accounts?error=token_failed&platform=tiktok", req.url)
    );
  }

  await upsertSocialAccount({
    userId: decoded.userId,
    platform: "tiktok",
    provider: "tiktok",
    accessToken,
    refreshToken,
    expiresInSec,
    meta: { raw: { open_id: openId, scope, token_raw: json } },
  });

  return NextResponse.redirect(
    new URL("/dashboard/social-accounts?connected=tiktok", req.url)
  );
}