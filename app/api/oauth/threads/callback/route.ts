// app/api/oauth/threads/callback/route.ts

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

type OAuthStatePayload = {
  userId: string;
  platform: "threads";
  issuedAt: number;
  nonce: string;
};

type ThreadsApiError = {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
};

type ThreadsShortTokenResponse = {
  access_token?: string;
  user_id?: string | number;
  error?: ThreadsApiError;
};

type ThreadsLongTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: ThreadsApiError;
};

type ThreadsProfileResponse = {
  id?: string;
  username?: string;
  name?: string;
  threads_profile_picture_url?: string;
  threads_biography?: string;
  error?: ThreadsApiError;
};

const STATE_MAX_AGE_MS =
  10 * 60 * 1000;

/*
 * -------------------------------------------------------
 * Helpers
 * -------------------------------------------------------
 */

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
      .META_OAUTH_STATE_SECRET
      ?.trim() ||
    process.env
      .NEXTAUTH_SECRET
      ?.trim() ||
    ""
  );
}

function getRedirectUri(): string {
  return (
    process.env
      .THREADS_REDIRECT_URI
      ?.trim() ||
    process.env
      .NEXT_PUBLIC_THREADS_REDIRECT
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
      encodedPayload
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
): OAuthStatePayload {
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
      "invalid_state_signature"
    );
  }

  let payload:
    OAuthStatePayload;

  try {
    payload =
      JSON.parse(
        Buffer.from(
          encodedPayload,
          "base64url"
        ).toString(
          "utf8"
        )
      ) as OAuthStatePayload;
  } catch {
    throw new Error(
      "invalid_state_payload"
    );
  }

  if (
    !payload?.userId ||
    !payload?.issuedAt ||
    !payload?.nonce ||
    payload.platform !==
      "threads"
  ) {
    throw new Error(
      "invalid_state_values"
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
      "expired_state"
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

/*
 * -------------------------------------------------------
 * STEP 1
 * Authorization code → short-lived Threads token
 * -------------------------------------------------------
 */

async function exchangeCodeForShortLivedToken(
  args: {
    code: string;
    appId: string;
    appSecret: string;
    redirectUri: string;
  }
): Promise<ThreadsShortTokenResponse> {
  const body =
    new URLSearchParams({
      client_id:
        args.appId,

      client_secret:
        args.appSecret,

      grant_type:
        "authorization_code",

      redirect_uri:
        args.redirectUri,

      code:
        args.code,
    });

  const response =
    await fetch(
      "https://graph.threads.com/oauth/access_token",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",

          Accept:
            "application/json",
        },

        body:
          body.toString(),

        cache:
          "no-store",
      }
    );

  const result =
    (await response
      .json()
      .catch(
        () =>
          ({}) as ThreadsShortTokenResponse
      )) as ThreadsShortTokenResponse;

  if (
    !response.ok ||
    result.error ||
    !result.access_token
  ) {
    console.error(
      "[threads-oauth-callback] Short-lived token exchange failed",
      {
        status:
          response.status,

        errorMessage:
          result.error
            ?.message ??
          null,

        errorType:
          result.error
            ?.type ??
          null,

        errorCode:
          result.error
            ?.code ??
          null,

        errorSubcode:
          result.error
            ?.error_subcode ??
          null,
      }
    );

    throw new Error(
      "threads_code_exchange_failed"
    );
  }

  return result;
}

/*
 * -------------------------------------------------------
 * STEP 2
 * Short-lived token → long-lived Threads token
 * -------------------------------------------------------
 */

async function exchangeForLongLivedToken(
  args: {
    shortLivedToken: string;
    appSecret: string;
  }
): Promise<ThreadsLongTokenResponse> {
  const params =
    new URLSearchParams({
      grant_type:
        "th_exchange_token",

      client_secret:
        args.appSecret,

      access_token:
        args.shortLivedToken,
    });

  const response =
    await fetch(
      `https://graph.threads.com/access_token?${params.toString()}`,
      {
        method:
          "GET",

        headers: {
          Accept:
            "application/json",
        },

        cache:
          "no-store",
      }
    );

  const result =
    (await response
      .json()
      .catch(
        () =>
          ({}) as ThreadsLongTokenResponse
      )) as ThreadsLongTokenResponse;

  if (
    !response.ok ||
    result.error ||
    !result.access_token
  ) {
    console.error(
      "[threads-oauth-callback] Long-lived token exchange failed",
      {
        status:
          response.status,

        errorMessage:
          result.error
            ?.message ??
          null,

        errorType:
          result.error
            ?.type ??
          null,

        errorCode:
          result.error
            ?.code ??
          null,

        errorSubcode:
          result.error
            ?.error_subcode ??
          null,
      }
    );

    throw new Error(
      "threads_long_lived_exchange_failed"
    );
  }

  return result;
}

/*
 * -------------------------------------------------------
 * STEP 3
 * Resolve connected Threads profile
 * -------------------------------------------------------
 */

async function fetchThreadsProfile(
  accessToken: string
): Promise<ThreadsProfileResponse> {
  const url =
    new URL(
      "https://graph.threads.com/v1.0/me"
    );

  url.searchParams.set(
    "fields",
    [
      "id",
      "username",
      "name",
      "threads_profile_picture_url",
      "threads_biography",
    ].join(",")
  );

  url.searchParams.set(
    "access_token",
    accessToken
  );

  const response =
    await fetch(
      url.toString(),
      {
        method:
          "GET",

        headers: {
          Accept:
            "application/json",
        },

        cache:
          "no-store",
      }
    );

  const result =
    (await response
      .json()
      .catch(
        () =>
          ({}) as ThreadsProfileResponse
      )) as ThreadsProfileResponse;

  if (
    !response.ok ||
    result.error ||
    !result.id
  ) {
    console.error(
      "[threads-oauth-callback] Threads profile lookup failed",
      {
        status:
          response.status,

        errorMessage:
          result.error
            ?.message ??
          null,

        errorType:
          result.error
            ?.type ??
          null,

        errorCode:
          result.error
            ?.code ??
          null,

        errorSubcode:
          result.error
            ?.error_subcode ??
          null,
      }
    );

    throw new Error(
      "threads_profile_lookup_failed"
    );
  }

  return result;
}

/*
 * -------------------------------------------------------
 * GET CALLBACK
 * -------------------------------------------------------
 */

export async function GET(
  req: NextRequest
): Promise<NextResponse> {
  /*
   * -----------------------------------------------------
   * Threads may redirect here with an OAuth error
   * -----------------------------------------------------
   */

  const threadsError =
    req.nextUrl.searchParams.get(
      "error"
    );

  const threadsErrorReason =
    req.nextUrl.searchParams.get(
      "error_reason"
    );

  const threadsErrorDescription =
    req.nextUrl.searchParams.get(
      "error_description"
    );

  if (threadsError) {
    console.warn(
      "[threads-oauth-callback] Threads OAuth rejected",
      {
        error:
          threadsError,

        reason:
          threadsErrorReason,

        description:
          threadsErrorDescription,
      }
    );

    return createDashboardRedirect(
      req,
      {
        error:
          threadsError ===
          "access_denied"
            ? "threads_access_denied"
            : "threads_oauth_failed",

        platform:
          "threads",
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
          "missing_threads_oauth_response",

        platform:
          "threads",
      }
    );
  }

  try {
    /*
     * ---------------------------------------------------
     * 1. Validate signed Autoaffi state
     * ---------------------------------------------------
     */

    const stateSecret =
      getStateSecret();

    if (!stateSecret) {
      throw new Error(
        "Missing META_OAUTH_STATE_SECRET or NEXTAUTH_SECRET"
      );
    }

    const statePayload =
      verifyAndDecodeState(
        state,
        stateSecret
      );

    /*
     * ---------------------------------------------------
     * 2. Verify current Autoaffi session
     * ---------------------------------------------------
     */

    const session =
      await getServerSession(
        authOptions
      );

    const sessionUserId =
      session?.user?.id;

    if (!sessionUserId) {
      return createDashboardRedirect(
        req,
        {
          error:
            "session_expired",

          platform:
            "threads",
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
        "[threads-oauth-callback] Session user mismatch",
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
            "threads",
        }
      );
    }

    /*
     * ---------------------------------------------------
     * 3. Configuration
     * ---------------------------------------------------
     */

    const appId =
      getRequiredEnv(
        "THREADS_APP_ID"
      );

    const appSecret =
      getRequiredEnv(
        "THREADS_APP_SECRET"
      );

    const redirectUri =
      getRedirectUri();

    if (!redirectUri) {
      throw new Error(
        "Missing THREADS_REDIRECT_URI or NEXT_PUBLIC_THREADS_REDIRECT"
      );
    }

    /*
     * ---------------------------------------------------
     * 4. Authorization code → short-lived token
     * ---------------------------------------------------
     */

    const shortLived =
      await exchangeCodeForShortLivedToken(
        {
          code,

          appId,

          appSecret,

          redirectUri,
        }
      );

    /*
     * ---------------------------------------------------
     * 5. Short-lived → long-lived token
     * ---------------------------------------------------
     */

    const longLived =
      await exchangeForLongLivedToken(
        {
          shortLivedToken:
            shortLived
              .access_token!,

          appSecret,
        }
      );

    const accessToken =
      longLived.access_token!;

    /*
     * ---------------------------------------------------
     * 6. Resolve actual Threads identity
     * ---------------------------------------------------
     */

    const threadsProfile =
      await fetchThreadsProfile(
        accessToken
      );

    const expiresInSec =
      typeof longLived
        .expires_in ===
        "number"
        ? longLived
            .expires_in
        : null;

    /*
     * ---------------------------------------------------
     * 7. Safe diagnostics
     * ---------------------------------------------------
     *
     * Never log:
     *
     * - access token
     * - Threads App Secret
     * - signed state
     */

    console.info(
      "[threads-oauth-callback] Threads account connected",
      {
        platform:
          "threads",

        provider:
          "meta",

        threadsUserId:
          threadsProfile.id,

        username:
          threadsProfile
            .username ??
          null,

        shortTokenUserId:
          shortLived
            .user_id ??
          null,

        tokenType:
          longLived
            .token_type ??
          null,

        expiresInSec,

        publishingRequested:
          false,
      }
    );

    /*
     * ---------------------------------------------------
     * 8. Store encrypted Threads connection
     * ---------------------------------------------------
     *
     * user_social_accounts remains the canonical
     * social connection table.
     *
     * Threads gets:
     *
     * platform = "threads"
     * provider = "meta"
     *
     * No parallel Threads table is created.
     */

    await upsertSocialAccount({
      userId:
        statePayload.userId,

      platform:
        "threads",

      provider:
        "meta",

      accessToken,

      /*
       * Threads long-lived user tokens do not use
       * a separate OAuth refresh_token in this flow.
       */
      refreshToken:
        null,

      expiresInSec,

      accountId:
        String(
          threadsProfile.id
        ),

      username:
        threadsProfile
          .username ??
        null,

      meta: {
        oauth_connected_at:
          new Date()
            .toISOString(),

        oauth_flow:
          "threads_oauth",

        threads_user_id:
          String(
            threadsProfile.id
          ),

        short_token_user_id:
          shortLived
            .user_id !==
          undefined
            ? String(
                shortLived.user_id
              )
            : null,

        username:
          threadsProfile
            .username ??
          null,

        display_name:
          threadsProfile
            .name ??
          null,

        profile_picture_url:
          threadsProfile
            .threads_profile_picture_url ??
          null,

        biography:
          threadsProfile
            .threads_biography ??
          null,

        token_type:
          longLived
            .token_type ??
          null,

        requested_scopes: [
          "threads_basic",
          "threads_manage_insights",
          "threads_read_replies",
        ],

        publishing_enabled:
          false,

        insights_requested:
          true,

        replies_requested:
          true,
      },
    });

    /*
     * ---------------------------------------------------
     * 9. Success
     * ---------------------------------------------------
     */

    return createDashboardRedirect(
      req,
      {
        connected:
          "threads",

        platform:
          "threads",
      }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "unknown_error";

    console.error(
      "[threads-oauth-callback] OAuth callback failed",
      {
        platform:
          "threads",

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
              "threads_code_exchange_failed"
            ? "threads_code_exchange_failed"

          : message ===
              "threads_long_lived_exchange_failed"
            ? "threads_long_lived_token_failed"

          : message ===
              "threads_profile_lookup_failed"
            ? "threads_profile_lookup_failed"

          : "threads_token_failed";

    return createDashboardRedirect(
      req,
      {
        error:
          publicError,

        platform:
          "threads",
      }
    );
  }
}