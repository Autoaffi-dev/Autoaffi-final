// app/api/oauth/tiktok/callback/route.ts

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

type TikTokOAuthStatePayload = {
  userId: string;
  platform: "tiktok";
  issuedAt: number;
  nonce: string;
};

type TikTokTokenResponse = {
  access_token?: string;
  expires_in?: number;
  open_id?: string;
  refresh_expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;

  error?: string;
  error_description?: string;
  log_id?: string;
};

type TikTokApiError = {
  code?: string | number;
  message?: string;
  log_id?: string;
};

type TikTokUser = {
  open_id?: string;
  union_id?: string;
  avatar_url?: string;
  display_name?: string;
};

type TikTokUserInfoResponse = {
  data?: {
    user?: TikTokUser;
  };

  error?: TikTokApiError;
};

const STATE_MAX_AGE_MS =
  10 * 60 * 1000;

// -------------------------------------------------------
// Environment
// -------------------------------------------------------

function getRequiredEnv(
  name: string
): string {
  const value =
    process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}`
    );
  }

  return value;
}

function getStateSecret(): string {
  return (
    process.env
      .TIKTOK_OAUTH_STATE_SECRET
      ?.trim() ||
    process.env
      .NEXTAUTH_SECRET
      ?.trim() ||
    ""
  );
}

// -------------------------------------------------------
// OAuth state
// -------------------------------------------------------

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
      encodedPayload
    )
    .digest(
      "base64url"
    );
}

function signaturesMatch(
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
): TikTokOAuthStatePayload {
  const parts =
    state.split(".");

  if (
    parts.length !== 2
  ) {
    throw new Error(
      "invalid_state_format"
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
      "invalid_state_format"
    );
  }

  const expectedSignature =
    signState(
      encodedPayload,
      secret
    );

  if (
    !signaturesMatch(
      receivedSignature,
      expectedSignature
    )
  ) {
    throw new Error(
      "invalid_state_signature"
    );
  }

  let payload:
    TikTokOAuthStatePayload;

  try {
    payload =
      JSON.parse(
        Buffer.from(
          encodedPayload,
          "base64url"
        ).toString(
          "utf8"
        )
      ) as TikTokOAuthStatePayload;
  } catch {
    throw new Error(
      "invalid_state_payload"
    );
  }

  if (
    !payload?.userId ||
    payload.platform !==
      "tiktok" ||
    !payload.issuedAt ||
    !payload.nonce
  ) {
    throw new Error(
      "invalid_state_values"
    );
  }

  const stateAge =
    Date.now() -
    payload.issuedAt;

  if (
    stateAge < 0 ||
    stateAge >
      STATE_MAX_AGE_MS
  ) {
    throw new Error(
      "expired_state"
    );
  }

  return payload;
}

// -------------------------------------------------------
// Redirect helper
// -------------------------------------------------------

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

// -------------------------------------------------------
// Token exchange
// -------------------------------------------------------

async function exchangeCodeForToken(
  args: {
    code: string;
    clientKey: string;
    clientSecret: string;
    redirectUri: string;
  }
): Promise<TikTokTokenResponse> {
  const response =
    await fetch(
      "https://open.tiktokapis.com/v2/oauth/token/",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",

          "Cache-Control":
            "no-cache",
        },

        body:
          new URLSearchParams({
            client_key:
              args.clientKey,

            client_secret:
              args.clientSecret,

            code:
              args.code,

            grant_type:
              "authorization_code",

            redirect_uri:
              args.redirectUri,
          }),

        cache:
          "no-store",
      }
    );

  const body =
    (await response
      .json()
      .catch(
        () =>
          ({}) as TikTokTokenResponse
      )) as TikTokTokenResponse;

  if (
    !response.ok ||
    body.error ||
    !body.access_token
  ) {
    console.error(
      "[tiktok-oauth-callback] Token exchange failed",
      {
        status:
          response.status,

        error:
          body.error ??
          null,

        description:
          body
            .error_description ??
          null,

        logId:
          body.log_id ??
          null,
      }
    );

    throw new Error(
      "tiktok_token_exchange_failed"
    );
  }

  return body;
}

// -------------------------------------------------------
// TikTok profile
// -------------------------------------------------------

/*
 * user.info.basic gives Autoaffi:
 *
 * - open_id
 * - union_id
 * - avatar_url
 * - display_name
 *
 * This allows Social Accounts to show the actual
 * connected TikTok profile instead of the generic
 * fallback "TikTok Account".
 */
async function fetchTikTokUserInfo(
  accessToken: string
): Promise<TikTokUser> {
  const url =
    new URL(
      "https://open.tiktokapis.com/v2/user/info/"
    );

  url.searchParams.set(
    "fields",
    [
      "open_id",
      "union_id",
      "avatar_url",
      "display_name",
    ].join(",")
  );

  const response =
    await fetch(
      url.toString(),
      {
        method:
          "GET",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },

        cache:
          "no-store",
      }
    );

  const body =
    (await response
      .json()
      .catch(
        () =>
          ({}) as TikTokUserInfoResponse
      )) as TikTokUserInfoResponse;

  const errorCode =
    body.error?.code;

  const apiError =
    errorCode !==
      undefined &&
    errorCode !==
      null &&
    errorCode !==
      0 &&
    errorCode !==
      "0" &&
    String(
      errorCode
    ).toLowerCase() !==
      "ok";

  const user =
    body.data?.user;

  if (
    !response.ok ||
    apiError ||
    !user?.open_id
  ) {
    console.error(
      "[tiktok-oauth-callback] TikTok user info lookup failed",
      {
        status:
          response.status,

        errorCode:
          body.error?.code ??
          null,

        errorMessage:
          body.error
            ?.message ??
          null,

        logId:
          body.error
            ?.log_id ??
          null,
      }
    );

    throw new Error(
      "tiktok_user_info_failed"
    );
  }

  return user;
}

// -------------------------------------------------------
// Scopes
// -------------------------------------------------------

function parseGrantedScopes(
  scope:
    | string
    | undefined
): string[] {
  if (
    !scope
  ) {
    return [];
  }

  return scope
    .split(",")
    .map(
      (item) =>
        item.trim()
    )
    .filter(
      Boolean
    );
}

// -------------------------------------------------------
// GET callback
// -------------------------------------------------------

export async function GET(
  req: NextRequest
): Promise<NextResponse> {
  const oauthError =
    req.nextUrl
      .searchParams
      .get(
        "error"
      );

  const oauthErrorDescription =
    req.nextUrl
      .searchParams
      .get(
        "error_description"
      );

  if (
    oauthError
  ) {
    console.warn(
      "[tiktok-oauth-callback] TikTok OAuth rejected",
      {
        error:
          oauthError,

        description:
          oauthErrorDescription,
      }
    );

    return createDashboardRedirect(
      req,
      {
        error:
          oauthError ===
          "access_denied"
            ? "tiktok_access_denied"
            : "tiktok_oauth_failed",

        platform:
          "tiktok",
      }
    );
  }

  const code =
    req.nextUrl
      .searchParams
      .get(
        "code"
      );

  const state =
    req.nextUrl
      .searchParams
      .get(
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
          "missing_oauth_response",

        platform:
          "tiktok",
      }
    );
  }

  try {
    // ---------------------------------------------------
    // Verify Autoaffi state
    // ---------------------------------------------------

    const stateSecret =
      getStateSecret();

    if (
      !stateSecret
    ) {
      throw new Error(
        "Missing TIKTOK_OAUTH_STATE_SECRET or NEXTAUTH_SECRET"
      );
    }

    const statePayload =
      verifyAndDecodeState(
        state,
        stateSecret
      );

    // ---------------------------------------------------
    // Verify logged-in Autoaffi user
    // ---------------------------------------------------

    const session =
      await getServerSession(
        authOptions
      );

    const sessionUserId =
      session?.user?.id;

    if (
      !sessionUserId
    ) {
      return createDashboardRedirect(
        req,
        {
          error:
            "session_expired",

          platform:
            "tiktok",
        }
      );
    }

    if (
      String(
        sessionUserId
      ) !==
      statePayload.userId
    ) {
      console.error(
        "[tiktok-oauth-callback] Session user mismatch",
        {
          sessionUserId:
            String(
              sessionUserId
            ),

          stateUserId:
            statePayload.userId,
        }
      );

      return createDashboardRedirect(
        req,
        {
          error:
            "oauth_user_mismatch",

          platform:
            "tiktok",
        }
      );
    }

    // ---------------------------------------------------
    // Configuration
    // ---------------------------------------------------

    const clientKey =
      getRequiredEnv(
        "TIKTOK_CLIENT_ID"
      );

    const clientSecret =
      getRequiredEnv(
        "TIKTOK_CLIENT_SECRET"
      );

    const redirectUri =
      getRequiredEnv(
        "NEXT_PUBLIC_TIKTOK_REDIRECT"
      );

    // ---------------------------------------------------
    // Authorization code -> access token
    // ---------------------------------------------------

    const token =
      await exchangeCodeForToken({
        code,
        clientKey,
        clientSecret,
        redirectUri,
      });

    const grantedScopes =
      parseGrantedScopes(
        token.scope
      );

    // ---------------------------------------------------
    // Resolve actual TikTok profile
    // ---------------------------------------------------

    const tiktokUser =
      await fetchTikTokUserInfo(
        token.access_token!
      );

    /*
     * The token's open_id and /v2/user/info open_id
     * should identify the same connected TikTok user.
     *
     * Fail closed if TikTok unexpectedly returns two
     * different identities.
     */
    if (
      token.open_id &&
      tiktokUser.open_id &&
      String(
        token.open_id
      ) !==
        String(
          tiktokUser.open_id
        )
    ) {
      console.error(
        "[tiktok-oauth-callback] TikTok open_id mismatch",
        {
          tokenOpenIdPresent:
            true,

          profileOpenIdPresent:
            true,
        }
      );

      throw new Error(
        "tiktok_open_id_mismatch"
      );
    }

    const resolvedOpenId =
      tiktokUser.open_id ??
      token.open_id;

    if (
      !resolvedOpenId
    ) {
      throw new Error(
        "tiktok_missing_open_id"
      );
    }

    // ---------------------------------------------------
    // Diagnostics
    // ---------------------------------------------------
    //
    // Never log tokens or the user's raw open_id.
    //

    console.info(
      "[tiktok-oauth-callback] TikTok account connected",
      {
        platform:
          "tiktok",

        displayNamePresent:
          Boolean(
            tiktokUser
              .display_name
          ),

        avatarPresent:
          Boolean(
            tiktokUser
              .avatar_url
          ),

        unionIdPresent:
          Boolean(
            tiktokUser
              .union_id
          ),

        grantedScopes,

        tokenType:
          token.token_type ??
          null,

        expiresInSec:
          typeof token
            .expires_in ===
            "number"
            ? token.expires_in
            : null,
      }
    );

    // ---------------------------------------------------
    // Save Autoaffi social account
    // ---------------------------------------------------

    await upsertSocialAccount({
      userId:
        statePayload.userId,

      platform:
        "tiktok",

      provider:
        "tiktok",

      accessToken:
        token.access_token!,

      refreshToken:
        token.refresh_token ??
        null,

      expiresInSec:
        typeof token
          .expires_in ===
          "number"
          ? token.expires_in
          : null,

      accountId:
        resolvedOpenId,

      meta: {
        oauth_connected_at:
          new Date()
            .toISOString(),

        oauth_flow:
          "tiktok_login_kit",

        open_id:
          resolvedOpenId,

        union_id:
          tiktokUser
            .union_id ??
          null,

        display_name:
          tiktokUser
            .display_name ??
          null,

        avatar_url:
          tiktokUser
            .avatar_url ??
          null,

        tiktok_profile: {
          display_name:
            tiktokUser
              .display_name ??
            null,

          avatar_url:
            tiktokUser
              .avatar_url ??
            null,

          open_id:
            resolvedOpenId,

          union_id:
            tiktokUser
              .union_id ??
            null,
        },

        token_type:
          token.token_type ??
          "Bearer",

        granted_scopes:
          grantedScopes,

        refresh_token_expires_in:
          typeof token
            .refresh_expires_in ===
            "number"
            ? token.refresh_expires_in
            : null,

        refresh_token_expires_at:
          typeof token
            .refresh_expires_in ===
            "number" &&
          token
            .refresh_expires_in >
            0
            ? new Date(
                Date.now() +
                  token.refresh_expires_in *
                    1000
              ).toISOString()
            : null,
      },
    });

    // ---------------------------------------------------
    // Success
    // ---------------------------------------------------

    return createDashboardRedirect(
      req,
      {
        connected:
          "tiktok",

        platform:
          "tiktok",
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
      "[tiktok-oauth-callback] OAuth callback failed",
      {
        error:
          message,
      }
    );

    const publicError =
      message ===
      "expired_state"
        ? "oauth_state_expired"

        : message.startsWith(
              "invalid_state"
            )
          ? "bad_oauth_state"

          : message ===
              "tiktok_token_exchange_failed"
            ? "token_failed"

          : message ===
              "tiktok_user_info_failed"
            ? "profile_lookup_failed"

          : message ===
                "tiktok_open_id_mismatch" ||
              message ===
                "tiktok_missing_open_id"
            ? "tiktok_identity_failed"

          : "tiktok_callback_failed";

    return createDashboardRedirect(
      req,
      {
        error:
          publicError,

        platform:
          "tiktok",
      }
    );
  }
}