// app/api/oauth/linkedin/route.ts
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/authOptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LinkedInOAuthStatePayload = {
  userId: string;
  platform: "linkedin";
  issuedAt: number;
  nonce: string;
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
    process.env.LINKEDIN_OAUTH_STATE_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    ""
  );
}

function signState(encodedPayload: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
}

function createSignedState(
  payload: LinkedInOAuthStatePayload,
  secret: string
): string {
  const encodedPayload = Buffer.from(
    JSON.stringify(payload),
    "utf8"
  ).toString("base64url");

  const signature = signState(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

function parseScopes(): string {
  const configuredScopes =
    process.env.LINKEDIN_OAUTH_SCOPES?.trim();

  const rawScopes =
    configuredScopes || "openid profile email w_member_social";

  const scopes = rawScopes
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);

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

    const clientId = requireEnv("LINKEDIN_CLIENT_ID");
    const redirectUri = requireEnv(
      "NEXT_PUBLIC_LINKEDIN_REDIRECT"
    );

    const stateSecret = getStateSecret();

    if (!stateSecret) {
      throw new Error(
        "Missing LINKEDIN_OAUTH_STATE_SECRET or NEXTAUTH_SECRET"
      );
    }

    const state = createSignedState(
      {
        userId,
        platform: "linkedin",
        issuedAt: Date.now(),
        nonce: crypto.randomBytes(24).toString("base64url"),
      },
      stateSecret
    );

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: parseScopes(),
      state,
    });

    return NextResponse.redirect(
      `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`
    );
  } catch (error) {
    console.error("[linkedin-oauth] Failed to start OAuth", {
      error:
        error instanceof Error ? error.message : "unknown_error",
    });

    return redirectToSocialAccounts(req, {
      error: "linkedin_oauth_start_failed",
      platform: "linkedin",
    });
  }
}