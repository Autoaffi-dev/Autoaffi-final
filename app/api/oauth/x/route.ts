// app/api/oauth/x/route.ts
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/authOptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const X_PKCE_COOKIE_NAME = "autoaffi_x_oauth_pkce";
const OAUTH_MAX_AGE_SECONDS = 10 * 60;

type XOAuthStatePayload = {
  userId: string;
  platform: "x";
  issuedAt: number;
  nonce: string;
};

type XOAuthCookiePayload = {
  userId: string;
  platform: "x";
  issuedAt: number;
  nonce: string;
  codeVerifier: string;
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getStateSecret(): string {
  return (
    process.env.X_OAUTH_STATE_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    ""
  );
}

function signValue(value: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(value)
    .digest("base64url");
}

function encodeSignedPayload(
  payload: Record<string, unknown>,
  secret: string
): string {
  const encodedPayload = Buffer.from(
    JSON.stringify(payload),
    "utf8"
  ).toString("base64url");

  const signature = signValue(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

function createCodeVerifier(): string {
  /*
   * 64 slumpmässiga byte ger en verifier som ligger inom
   * PKCE-kravet på 43–128 tecken efter base64url-kodning.
   */
  return crypto.randomBytes(64).toString("base64url");
}

function createCodeChallenge(codeVerifier: string): string {
  return crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
}

function parseScopes(): string {
  const configuredScopes =
    process.env.X_OAUTH_SCOPES?.trim();

  const defaultScopes = [
    "tweet.read",
    "users.read",
    "offline.access",
    "tweet.write",
  ];

  const scopes = configuredScopes
    ? configuredScopes
        .split(/[\s,]+/)
        .map((scope) => scope.trim())
        .filter(Boolean)
    : defaultScopes;

  return [...new Set(scopes)].join(" ");
}

function redirectToSocialAccounts(
  req: NextRequest,
  values: Record<string, string>
): NextResponse {
  const url = new URL("/dashboard/social-accounts", req.url);

  for (const [key, value] of Object.entries(values)) {
    url.searchParams.set(key, value);
  }

  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      const loginUrl = new URL("/login", req.url);

      loginUrl.searchParams.set("error", "unauthorized");
      loginUrl.searchParams.set(
        "callbackUrl",
        "/dashboard/social-accounts"
      );

      return NextResponse.redirect(loginUrl);
    }

    const clientId = requireEnv("X_CLIENT_ID");
    const redirectUri = requireEnv("NEXT_PUBLIC_X_REDIRECT");
    const stateSecret = getStateSecret();

    if (!stateSecret) {
      throw new Error(
        "Missing X_OAUTH_STATE_SECRET or NEXTAUTH_SECRET"
      );
    }

    const issuedAt = Date.now();
    const nonce = crypto.randomBytes(24).toString("base64url");
    const codeVerifier = createCodeVerifier();
    const codeChallenge = createCodeChallenge(codeVerifier);

    const statePayload: XOAuthStatePayload = {
      userId,
      platform: "x",
      issuedAt,
      nonce,
    };

    const cookiePayload: XOAuthCookiePayload = {
      userId,
      platform: "x",
      issuedAt,
      nonce,
      codeVerifier,
    };

    const state = encodeSignedPayload(
      statePayload,
      stateSecret
    );

    const signedPkceCookie = encodeSignedPayload(
      cookiePayload,
      stateSecret
    );

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: parseScopes(),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    const response = NextResponse.redirect(
      `https://x.com/i/oauth2/authorize?${params.toString()}`
    );

    response.cookies.set({
      name: X_PKCE_COOKIE_NAME,
      value: signedPkceCookie,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/oauth/x",
      maxAge: OAUTH_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error) {
    console.error("[x-oauth] Failed to start OAuth", {
      error:
        error instanceof Error
          ? error.message
          : "unknown_error",
    });

    return redirectToSocialAccounts(req, {
      error: "x_oauth_start_failed",
      platform: "x",
    });
  }
}