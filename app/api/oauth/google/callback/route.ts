// app/api/oauth/google/callback/route.ts

import crypto from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/authOptions";
import { upsertSocialAccount } from "@/lib/socialStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GoogleOAuthStatePayload = {
  userId: string;
  platform: "youtube";
  issuedAt: number;
  nonce: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;

  error?: string;
  error_description?: string;
};

const STATE_MAX_AGE_MS =
  10 * 60 * 1000;

const YOUTUBE_READONLY_SCOPE =
  "https://www.googleapis.com/auth/youtube.readonly";

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

function isUuid(
  value: string
): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function getStateSecret(): string {
  return (
    process.env
      .GOOGLE_OAUTH_STATE_SECRET
      ?.trim() ||
    process.env
      .NEXTAUTH_SECRET
      ?.trim() ||
    ""
  );
}

function signState(
  encodedPayload: string,
  secret: string
): string {
  return crypto
    .createHmac(
      "sha256",
      secret
    )
    .update(
      encodedPayload,
      "utf8"
    )
    .digest(
      "base64url"
    );
}

function safeSignatureMatch(
  received: string,
  expected: string
): boolean {
  const receivedBuffer =
    Buffer.from(
      received,
      "utf8"
    );

  const expectedBuffer =
    Buffer.from(
      expected,
      "utf8"
    );

  if (
    receivedBuffer.length !==
    expectedBuffer.length
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
): GoogleOAuthStatePayload {
  const parts =
    state.split(
      "."
    );

  if (
    parts.length !==
    2
  ) {
    throw new Error(
      "invalid_google_state_format"
    );
  }

  const [
    encodedPayload,
    receivedSignature,
  ] = parts;

  if (
    !encodedPayload ||
    !receivedSignature
  ) {
    throw new Error(
      "invalid_google_state_format"
    );
  }

  const expectedSignature =
    signState(
      encodedPayload,
      secret
    );

  if (
    !safeSignatureMatch(
      receivedSignature,
      expectedSignature
    )
  ) {
    throw new Error(
      "invalid_google_state_signature"
    );
  }

  let payload:
    GoogleOAuthStatePayload;

  try {
    payload =
      JSON.parse(
        Buffer.from(
          encodedPayload,
          "base64url"
        ).toString(
          "utf8"
        )
      ) as GoogleOAuthStatePayload;
  } catch {
    throw new Error(
      "invalid_google_state_payload"
    );
  }

  if (
    !payload?.userId ||
    !isUuid(
      payload.userId
    ) ||
    payload.platform !==
      "youtube" ||
    !payload.issuedAt ||
    !payload.nonce
  ) {
    throw new Error(
      "invalid_google_state_values"
    );
  }

  const age =
    Date.now() -
    payload.issuedAt;

  if (
    age < 0 ||
    age >
      STATE_MAX_AGE_MS
  ) {
    throw new Error(
      "expired_google_state"
    );
  }

  return payload;
}

function createDashboardRedirect(
  req: NextRequest,
  values: Record<
    string,
    string
  >
): NextResponse {
  const url =
    new URL(
      "/login/dashboard/social-accounts",
      req.url
    );

  for (
    const [
      key,
      value,
    ] of Object.entries(
      values
    )
  ) {
    url.searchParams.set(
      key,
      value
    );
  }

  return NextResponse.redirect(
    url
  );
}

function parseGrantedScopes(
  scope: string | undefined
): string[] {
  if (!scope) {
    return [];
  }

  return Array.from(
    new Set(
      scope
        .split(
          /\s+/
        )
        .map(
          (item) =>
            item.trim()
        )
        .filter(Boolean)
    )
  );
}

/*
 * If Google returns a token but the required YouTube
 * permission was not granted, revoke the token instead
 * of leaving an unused authorization behind.
 */
async function revokeGoogleTokenBestEffort(
  token: string
): Promise<void> {
  try {
    await fetch(
      "https://oauth2.googleapis.com/revoke",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          new URLSearchParams({
            token,
          }),

        cache:
          "no-store",
      }
    );
  } catch (
    error
  ) {
    console.warn(
      "[google-oauth-callback] Best-effort token revoke failed",
      {
        error:
          error instanceof
          Error
            ? error.message
            : "unknown_error",
      }
    );
  }
}

// -------------------------------------------------------
// GET CALLBACK
// -------------------------------------------------------

export async function GET(
  req: NextRequest
): Promise<NextResponse> {
  /*
   * Google can redirect here with an OAuth error instead
   * of an authorization code.
   */

  const googleError =
    req.nextUrl.searchParams.get(
      "error"
    );

  const googleErrorDescription =
    req.nextUrl.searchParams.get(
      "error_description"
    );

  if (googleError) {
    console.warn(
      "[google-oauth-callback] Google OAuth rejected",
      {
        error:
          googleError,

        description:
          googleErrorDescription,
      }
    );

    return createDashboardRedirect(
      req,
      {
        error:
          googleError ===
          "access_denied"
            ? "google_access_denied"
            : "google_oauth_failed",

        platform:
          "youtube",
      }
    );
  }

  const code =
    req.nextUrl.searchParams.get(
      "code"
    );

  const state =
    req.nextUrl.searchParams.get(
      "state"
    );

  if (
    !code ||
    !state
  ) {
    return createDashboardRedirect(
      req,
      {
        error:
          "missing_google_oauth_response",

        platform:
          "youtube",
      }
    );
  }

  try {
    // ---------------------------------------------------
    // Verify signed Autoaffi state
    // ---------------------------------------------------

    const stateSecret =
      getStateSecret();

    if (!stateSecret) {
      throw new Error(
        "missing_google_state_secret"
      );
    }

    const statePayload =
      verifyAndDecodeState(
        state,
        stateSecret
      );

    // ---------------------------------------------------
    // Verify current Autoaffi session
    // ---------------------------------------------------

    const session =
      await getServerSession(
        authOptions
      );

    const rawSessionUserId =
      session?.user?.id;

    if (!rawSessionUserId) {
      return createDashboardRedirect(
        req,
        {
          error:
            "session_expired",

          platform:
            "youtube",
        }
      );
    }

    const sessionUserId =
      String(
        rawSessionUserId
      );

    if (
      !isUuid(
        sessionUserId
      )
    ) {
      return createDashboardRedirect(
        req,
        {
          error:
            "bad_session_userid",

          platform:
            "youtube",
        }
      );
    }

    if (
      sessionUserId !==
      statePayload.userId
    ) {
      console.error(
        "[google-oauth-callback] Session user mismatch"
      );

      return createDashboardRedirect(
        req,
        {
          error:
            "oauth_user_mismatch",

          platform:
            "youtube",
        }
      );
    }

    // ---------------------------------------------------
    // Configuration
    // ---------------------------------------------------

    const clientId =
      process.env
        .GOOGLE_CLIENT_ID
        ?.trim();

    const clientSecret =
      process.env
        .GOOGLE_CLIENT_SECRET
        ?.trim();

    if (
      !clientId ||
      !clientSecret
    ) {
      throw new Error(
        "missing_google_env"
      );
    }

    /*
     * Must exactly match the URI used by the start route
     * and Google Cloud Console.
     */
    const origin =
      req.nextUrl.origin;

    const redirectUri =
      new URL(
        "/api/oauth/google/callback",
        origin
      ).toString();

    // ---------------------------------------------------
    // Authorization code → Google tokens
    // ---------------------------------------------------

    const tokenResponse =
      await fetch(
        "https://oauth2.googleapis.com/token",
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
          },

          body:
            new URLSearchParams({
              code,

              client_id:
                clientId,

              client_secret:
                clientSecret,

              redirect_uri:
                redirectUri,

              grant_type:
                "authorization_code",
            }),

          cache:
            "no-store",
        }
      );

    const token =
      (await tokenResponse
        .json()
        .catch(
          () =>
            ({}) as GoogleTokenResponse
        )) as GoogleTokenResponse;

    if (
      !tokenResponse.ok ||
      token.error ||
      !token.access_token
    ) {
      console.error(
        "[google-oauth-callback] Token exchange failed",
        {
          status:
            tokenResponse.status,

          error:
            token.error ??
            null,

          description:
            token
              .error_description ??
            null,
        }
      );

      throw new Error(
        "google_token_exchange_failed"
      );
    }

    const accessToken =
      token.access_token;

    const refreshToken =
      token.refresh_token ??
      null;

    const expiresInSec =
      typeof token.expires_in ===
        "number" &&
      token.expires_in > 0
        ? token.expires_in
        : null;

    const grantedScopes =
      parseGrantedScopes(
        token.scope
      );

    /*
     * Google supports granular consent.
     *
     * If Google explicitly tells us which scopes were
     * granted and youtube.readonly is absent, do not
     * create a connected YouTube account.
     */
    if (
      grantedScopes.length >
        0 &&
      !grantedScopes.includes(
        YOUTUBE_READONLY_SCOPE
      )
    ) {
      await revokeGoogleTokenBestEffort(
        refreshToken ||
          accessToken
      );

      throw new Error(
        "missing_youtube_scope"
      );
    }

    // ---------------------------------------------------
    // Persist through Autoaffi's encrypted token store
    // ---------------------------------------------------

    await upsertSocialAccount({
      userId:
        statePayload.userId,

      platform:
        "youtube",

      provider:
        "google",

      accessToken,

      refreshToken,

      expiresInSec,

      /*
       * IMPORTANT:
       *
       * No raw access token, refresh token or complete
       * Google token response is duplicated into metadata.
       */
      meta: {
        oauth_connected_at:
          new Date()
            .toISOString(),

        oauth_flow:
          "google_oauth2_web_server",

        token_type:
          token.token_type ??
          null,

        granted_scopes:
          grantedScopes,

        youtube_readonly_granted:
          grantedScopes.length ===
            0
            ? true
            : grantedScopes.includes(
                YOUTUBE_READONLY_SCOPE
              ),

        refresh_token_available:
          Boolean(
            refreshToken
          ),
      },
    });

    console.info(
      "[google-oauth-callback] YouTube connected",
      {
        platform:
          "youtube",

        refreshTokenAvailable:
          Boolean(
            refreshToken
          ),

        grantedScopes,

        expiresInSec,
      }
    );

    return createDashboardRedirect(
      req,
      {
        connected:
          "youtube",

        platform:
          "youtube",
      }
    );
  } catch (
    error
  ) {
    const message =
      error instanceof
      Error
        ? error.message
        : "unknown_error";

    console.error(
      "[google-oauth-callback] OAuth callback failed",
      {
        platform:
          "youtube",

        error:
          message,
      }
    );

    const publicError =
      message ===
      "expired_google_state"
        ? "oauth_state_expired"

        : message.startsWith(
              "invalid_google_state"
            )
          ? "bad_oauth_state"

          : message ===
              "missing_google_state_secret"
            ? "missing_google_state_secret"

          : message ===
              "missing_google_env"
            ? "missing_google_env"

          : message ===
              "google_token_exchange_failed"
            ? "token_failed"

          : message ===
              "missing_youtube_scope"
            ? "missing_youtube_scope"

          : "youtube_connect_failed";

    return createDashboardRedirect(
      req,
      {
        error:
          publicError,

        platform:
          "youtube",
      }
    );
  }
}