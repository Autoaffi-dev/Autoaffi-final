// app/api/oauth/tiktok/route.ts
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/authOptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TikTokOAuthStatePayload = {
  userId: string;
  platform: "tiktok";
  issuedAt: number;
  nonce: string;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getStateSecret(): string {
  return (
    process.env.TIKTOK_OAUTH_STATE_SECRET?.trim() ||
    process.env.META_OAUTH_STATE_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    ""
  );
}

function getTikTokScopes(): string {
  const configured =
    process.env.TIKTOK_OAUTH_SCOPES?.trim() ||
    "user.info.basic,user.info.profile,user.info.stats,video.list";

  return configured
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean)
    .join(",");
}

function signState(encodedPayload: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
}

function createSignedState(
  payload: TikTokOAuthStatePayload,
  secret: string
): string {
  const encodedPayload = Buffer.from(
    JSON.stringify(payload),
    "utf8"
  ).toString("base64url");

  const signature = signState(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

function createErrorRedirect(
  req: NextRequest,
  error: string
): NextResponse {
  const url = new URL("/dashboard/social-accounts", req.url);
  url.searchParams.set("error", error);
  url.searchParams.set("platform", "tiktok");

  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.redirect(
        new URL("/login?error=unauthorized", req.url)
      );
    }

    const clientKey = getRequiredEnv("TIKTOK_CLIENT_ID");
    const redirectUri = getRequiredEnv(
      "NEXT_PUBLIC_TIKTOK_REDIRECT"
    );

    const stateSecret = getStateSecret();

    if (!stateSecret) {
      throw new Error(
        "Missing TIKTOK_OAUTH_STATE_SECRET or NEXTAUTH_SECRET"
      );
    }

    const state = createSignedState(
      {
        userId,
        platform: "tiktok",
        issuedAt: Date.now(),
        nonce: crypto.randomBytes(24).toString("base64url"),
      },
      stateSecret
    );

    const params = new URLSearchParams({
      client_key: clientKey,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: getTikTokScopes(),
      state,
    });

    return NextResponse.redirect(
      `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`
    );
  } catch (error) {
    console.error("[tiktok-oauth] Failed to start OAuth", {
      error:
        error instanceof Error
          ? error.message
          : "unknown_error",
    });

    return createErrorRedirect(
      req,
      "tiktok_oauth_start_failed"
    );
  }
}