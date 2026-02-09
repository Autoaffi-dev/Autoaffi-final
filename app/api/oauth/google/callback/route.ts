import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { upsertSocialAccount } from "@/lib/socialStore";

export const runtime = "nodejs";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/login?error=missing_code", req.url));
  }

  // 1) Läs state (mest för platform)
  let decoded: { platform?: string; ts?: number; userId?: string };
  try {
    decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
  } catch {
    return NextResponse.redirect(new URL("/login?error=bad_state", req.url));
  }

  const platform = decoded?.platform || "youtube";

  // 2) Hämta userId från SESSION (inte state)
  const session = await getServerSession(authOptions);
  const sessionUserId = session?.user?.id;

  if (!sessionUserId || !isUuid(sessionUserId)) {
    return NextResponse.redirect(
      new URL(`/login/dashboard/social-accounts?error=bad_session_userid&platform=${platform}`, req.url)
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL(`/login/dashboard/social-accounts?error=missing_google_env&platform=${platform}`, req.url)
    );
  }

  const origin = req.nextUrl.origin;
  const redirectUri = new URL("/api/oauth/google/callback", origin).toString();

  // 3) Code -> Token
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
      new URL(`/login/dashboard/social-accounts?error=token_failed&platform=${platform}`, req.url)
    );
  }

  // 4) Spara med korrekt UUID
  await upsertSocialAccount({
    userId: sessionUserId, // ✅ alltid UUID här
    platform: "youtube",
    provider: "google",
    accessToken: token.access_token,
    refreshToken: token.refresh_token || null,
    expiresInSec: token.expires_in || null,
    meta: { raw: { token_raw: token } },
  });

  return NextResponse.redirect(
    new URL(`/login/dashboard/social-accounts?connected=${platform}`, req.url)
  );
}