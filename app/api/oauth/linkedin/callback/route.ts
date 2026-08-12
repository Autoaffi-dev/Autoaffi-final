// app/api/oauth/linkedin/callback/route.ts
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/authOptions";
import { upsertSocialAccount } from "@/lib/socialStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LinkedInOAuthStatePayload = {
  userId: string;
  platform: "linkedin";
  issuedAt: number;
  nonce: string;
};

type LinkedInTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;

  error?: string;
  error_description?: string;
};

type LinkedInUserInfoResponse = {
  sub?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?:
    | string
    | {
        country?: string;
        language?: string;
      };
  email?: string;
  email_verified?: boolean;
};

const STATE_MAX_AGE_MS = 10 * 60 * 1000;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}`
    );
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

function signState(
  encodedPayload: string,
  secret: string
): string {
  return crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
}

function signaturesMatch(
  receivedSignature: string,
  expectedSignature: string
): boolean {
  const receivedBuffer = Buffer.from(
    receivedSignature,
    "utf8"
  );

  const expectedBuffer = Buffer.from(
    expectedSignature,
    "utf8"
  );

  if (
    receivedBuffer.length !== expectedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    receivedBuffer,
    expectedBuffer
  );
}

function verifyAndDecodeState(
  state: string,
  secret: string
): LinkedInOAuthStatePayload {
  const parts = state.split(".");

  if (parts.length !== 2) {
    throw new Error("invalid_state_format");
  }

  const [encodedPayload, receivedSignature] = parts;

  if (!encodedPayload || !receivedSignature) {
    throw new Error("invalid_state_format");
  }

  const expectedSignature = signState(
    encodedPayload,
    secret
  );

  if (
    !signaturesMatch(
      receivedSignature,
      expectedSignature
    )
  ) {
    throw new Error("invalid_state_signature");
  }

  let payload: LinkedInOAuthStatePayload;

  try {
    payload = JSON.parse(
      Buffer.from(
        encodedPayload,
        "base64url"
      ).toString("utf8")
    ) as LinkedInOAuthStatePayload;
  } catch {
    throw new Error("invalid_state_payload");
  }

  if (
    !payload.userId ||
    payload.platform !== "linkedin" ||
    !payload.issuedAt ||
    !payload.nonce
  ) {
    throw new Error("invalid_state_values");
  }

  const stateAge = Date.now() - payload.issuedAt;

  if (
    stateAge < 0 ||
    stateAge > STATE_MAX_AGE_MS
  ) {
    throw new Error("expired_state");
  }

  return payload;
}

function createDashboardRedirect(
  req: NextRequest,
  values: Record<string, string>
): NextResponse {
  const url = new URL(
    "/login/dashboard/social-accounts",
    req.url
  );

  for (const [key, value] of Object.entries(values)) {
    url.searchParams.set(key, value);
  }

  return NextResponse.redirect(url);
}

function parseGrantedScopes(
  scope: string | undefined
): string[] {
  if (!scope) {
    return [];
  }

  return scope
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function exchangeCodeForToken(args: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<LinkedInTokenResponse> {
  const response = await fetch(
    "https://www.linkedin.com/oauth/v2/accessToken",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: args.code,
        redirect_uri: args.redirectUri,
        client_id: args.clientId,
        client_secret: args.clientSecret,
      }),
      cache: "no-store",
    }
  );

  const body = (await response
    .json()
    .catch(() => ({}))) as LinkedInTokenResponse;

  if (
    !response.ok ||
    body.error ||
    !body.access_token
  ) {
    console.error(
      "[linkedin-oauth-callback] Token exchange failed",
      {
        status: response.status,
        error: body.error,
        description: body.error_description,
      }
    );

    throw new Error(
      "linkedin_token_exchange_failed"
    );
  }

  return body;
}

async function fetchLinkedInUserInfo(
  accessToken: string
): Promise<LinkedInUserInfoResponse> {
  const response = await fetch(
    "https://api.linkedin.com/v2/userinfo",
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );

  const body = (await response
    .json()
    .catch(() => ({}))) as LinkedInUserInfoResponse;

  if (!response.ok || !body.sub) {
    console.error(
      "[linkedin-oauth-callback] UserInfo request failed",
      {
        status: response.status,
        hasSubject: Boolean(body.sub),
      }
    );

    throw new Error(
      "linkedin_userinfo_failed"
    );
  }

  return body;
}

function normalizeLocale(
  locale: LinkedInUserInfoResponse["locale"]
): string | null {
  if (!locale) {
    return null;
  }

  if (typeof locale === "string") {
    return locale;
  }

  const language = locale.language?.trim();
  const country = locale.country?.trim();

  if (language && country) {
    return `${language}-${country}`;
  }

  return language || country || null;
}

export async function GET(req: NextRequest) {
  const oauthError =
    req.nextUrl.searchParams.get("error");

  const oauthErrorDescription =
    req.nextUrl.searchParams.get(
      "error_description"
    );

  if (oauthError) {
    console.warn(
      "[linkedin-oauth-callback] LinkedIn OAuth rejected",
      {
        error: oauthError,
        description: oauthErrorDescription,
      }
    );

    return createDashboardRedirect(req, {
      error:
        oauthError === "user_cancelled_login" ||
        oauthError === "user_cancelled_authorize" ||
        oauthError === "access_denied"
          ? "linkedin_access_denied"
          : "linkedin_oauth_failed",
      platform: "linkedin",
    });
  }

  const code =
    req.nextUrl.searchParams.get("code");

  const state =
    req.nextUrl.searchParams.get("state");

  if (!code || !state) {
    return createDashboardRedirect(req, {
      error: "missing_oauth_response",
      platform: "linkedin",
    });
  }

  try {
    const stateSecret = getStateSecret();

    if (!stateSecret) {
      throw new Error(
        "Missing LINKEDIN_OAUTH_STATE_SECRET or NEXTAUTH_SECRET"
      );
    }

    const statePayload = verifyAndDecodeState(
      state,
      stateSecret
    );

    /*
     * Kontrollera att användaren som slutför callbacken är
     * samma användare som startade OAuth-flödet.
     */
    const session = await getServerSession(
      authOptions
    );

    const sessionUserId = session?.user?.id;

    if (!sessionUserId) {
      return createDashboardRedirect(req, {
        error: "session_expired",
        platform: "linkedin",
      });
    }

    if (
      sessionUserId !== statePayload.userId
    ) {
      console.error(
        "[linkedin-oauth-callback] Session user mismatch",
        {
          sessionUserId,
          stateUserId: statePayload.userId,
        }
      );

      return createDashboardRedirect(req, {
        error: "oauth_user_mismatch",
        platform: "linkedin",
      });
    }

    const clientId = requireEnv(
      "LINKEDIN_CLIENT_ID"
    );

    const clientSecret = requireEnv(
      "LINKEDIN_CLIENT_SECRET"
    );

    const redirectUri = requireEnv(
      "NEXT_PUBLIC_LINKEDIN_REDIRECT"
    );

    const token = await exchangeCodeForToken({
      code,
      redirectUri,
      clientId,
      clientSecret,
    });

    const userInfo =
      await fetchLinkedInUserInfo(
        token.access_token!
      );

    const grantedScopes = parseGrantedScopes(
      token.scope
    );

    const refreshTokenExpiresAt =
      typeof token.refresh_token_expires_in ===
        "number" &&
      token.refresh_token_expires_in > 0
        ? new Date(
            Date.now() +
              token.refresh_token_expires_in *
                1000
          ).toISOString()
        : null;

    await upsertSocialAccount({
      userId: statePayload.userId,
      platform: "linkedin",
      provider: "linkedin",

      accessToken: token.access_token!,

      /*
       * LinkedIn skickar inte nödvändigtvis en refresh-token.
       * socialStore bevarar befintlig token om värdet är
       * undefined och lagrar den krypterat när den finns.
       */
      refreshToken:
        token.refresh_token || undefined,

      expiresInSec:
        typeof token.expires_in === "number"
          ? token.expires_in
          : null,

      accountId: userInfo.sub,

      username:
        userInfo.name ||
        userInfo.email ||
        undefined,

      meta: {
        oauth_connected_at:
          new Date().toISOString(),

        linkedin_member_id:
          userInfo.sub ?? null,

        display_name:
          userInfo.name ?? null,

        given_name:
          userInfo.given_name ?? null,

        family_name:
          userInfo.family_name ?? null,

        profile_picture_url:
          userInfo.picture ?? null,

        email:
          userInfo.email ?? null,

        email_verified:
          userInfo.email_verified ?? null,

        locale: normalizeLocale(
          userInfo.locale
        ),

        token_type:
          token.token_type ?? "Bearer",

        granted_scopes:
          grantedScopes,

        refresh_token_available:
          Boolean(token.refresh_token),

        refresh_token_expires_in:
          typeof token.refresh_token_expires_in ===
          "number"
            ? token.refresh_token_expires_in
            : null,

        refresh_token_expires_at:
          refreshTokenExpiresAt,
      },
    });

    return createDashboardRedirect(req, {
      connected: "linkedin",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "unknown_error";

    console.error(
      "[linkedin-oauth-callback] OAuth callback failed",
      {
        error: message,
      }
    );

    const publicError =
      message === "expired_state"
        ? "oauth_state_expired"
        : message.startsWith("invalid_state")
          ? "bad_oauth_state"
          : message ===
              "linkedin_token_exchange_failed"
            ? "token_failed"
            : message ===
                "linkedin_userinfo_failed"
              ? "profile_fetch_failed"
              : "linkedin_callback_failed";

    return createDashboardRedirect(req, {
      error: publicError,
      platform: "linkedin",
    });
  }
}