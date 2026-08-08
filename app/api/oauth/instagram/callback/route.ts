// app/api/oauth/instagram/callback/route.ts

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
  platform: "instagram";
  issuedAt: number;
  nonce: string;
};

type InstagramApiError = {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
};

type InstagramShortTokenResponse = {
  access_token?: string;
  user_id?: number | string;
  permissions?: string[];
  error_type?: string;
  code?: number;
  error_message?: string;
};

type InstagramLongTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: InstagramApiError;
};

type InstagramMeResponse = {
  id?: string;
  username?: string;
  account_type?: string;
  user_id?: string;
  error?: InstagramApiError;
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
    process.env.NEXTAUTH_SECRET?.trim() ||
    ""
  );
}

function getGraphApiVersion(): string {
  const configuredVersion =
    process.env
      .META_GRAPH_API_VERSION
      ?.trim() || "v26.0";

  return configuredVersion.startsWith(
    "v"
  )
    ? configuredVersion
    : `v${configuredVersion}`;
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

  if (parts.length !== 2) {
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
        ).toString("utf8")
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
      "instagram"
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
    age > STATE_MAX_AGE_MS
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
 * Authorization code → short-lived Instagram token
 * -------------------------------------------------------
 *
 * IMPORTANT:
 *
 * This endpoint is api.instagram.com
 *
 * NOT graph.facebook.com.
 */

async function exchangeCodeForShortLivedToken(
  args: {
    code: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  }
): Promise<InstagramShortTokenResponse> {
  const body =
    new URLSearchParams({
      client_id:
        args.clientId,

      client_secret:
        args.clientSecret,

      grant_type:
        "authorization_code",

      redirect_uri:
        args.redirectUri,

      code:
        args.code,
    });

  const response =
    await fetch(
      "https://api.instagram.com/oauth/access_token",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          body.toString(),

        cache: "no-store",
      }
    );

  const result =
    (await response
      .json()
      .catch(
        () =>
          ({}) as InstagramShortTokenResponse
      )) as InstagramShortTokenResponse;

  if (
    !response.ok ||
    !result.access_token
  ) {
    console.error(
      "[instagram-oauth-callback] Short-lived token exchange failed",
      {
        status:
          response.status,

        errorType:
          result.error_type ??
          null,

        errorCode:
          result.code ??
          null,

        errorMessage:
          result.error_message ??
          null,
      }
    );

    throw new Error(
      "instagram_code_exchange_failed"
    );
  }

  return result;
}

/*
 * -------------------------------------------------------
 * STEP 2
 * Short-lived token → long-lived token
 * -------------------------------------------------------
 */

async function exchangeForLongLivedToken(
  args: {
    shortLivedToken: string;
    clientSecret: string;
  }
): Promise<InstagramLongTokenResponse> {
  const params =
    new URLSearchParams({
      grant_type:
        "ig_exchange_token",

      client_secret:
        args.clientSecret,

      access_token:
        args.shortLivedToken,
    });

  const response =
    await fetch(
      `https://graph.instagram.com/access_token?${params.toString()}`,
      {
        method: "GET",
        cache: "no-store",
      }
    );

  const result =
    (await response
      .json()
      .catch(
        () =>
          ({}) as InstagramLongTokenResponse
      )) as InstagramLongTokenResponse;

  if (
    !response.ok ||
    result.error ||
    !result.access_token
  ) {
    console.error(
      "[instagram-oauth-callback] Long-lived token exchange failed",
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
      "instagram_long_lived_exchange_failed"
    );
  }

  return result;
}

/*
 * -------------------------------------------------------
 * STEP 3
 * Read connected Instagram Professional Account
 * -------------------------------------------------------
 *
 * This goes directly against graph.instagram.com.
 *
 * No Facebook Page is required.
 */

async function fetchInstagramAccount(
  args: {
    accessToken: string;
    graphApiVersion: string;
  }
): Promise<InstagramMeResponse> {
  const url =
    new URL(
      `https://graph.instagram.com/${args.graphApiVersion}/me`
    );

  url.searchParams.set(
    "fields",
    "id,username,account_type,user_id"
  );

  url.searchParams.set(
    "access_token",
    args.accessToken
  );

  const response =
    await fetch(
      url.toString(),
      {
        method: "GET",
        cache: "no-store",
      }
    );

  const result =
    (await response
      .json()
      .catch(
        () =>
          ({}) as InstagramMeResponse
      )) as InstagramMeResponse;

  if (
    !response.ok ||
    result.error ||
    !result.id
  ) {
    console.error(
      "[instagram-oauth-callback] Instagram account lookup failed",
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
      "instagram_account_lookup_failed"
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
   * Meta / Instagram may redirect
   * here with an OAuth error.
   */

  const instagramError =
    req.nextUrl.searchParams.get(
      "error"
    );

  const instagramErrorReason =
    req.nextUrl.searchParams.get(
      "error_reason"
    );

  const instagramErrorDescription =
    req.nextUrl.searchParams.get(
      "error_description"
    );

  if (instagramError) {
    console.warn(
      "[instagram-oauth-callback] Instagram OAuth rejected",
      {
        error:
          instagramError,

        reason:
          instagramErrorReason,

        description:
          instagramErrorDescription,
      }
    );

    return createDashboardRedirect(
      req,
      {
        error:
          instagramError ===
          "access_denied"
            ? "instagram_access_denied"
            : "instagram_oauth_failed",

        platform:
          "instagram",
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

  if (!code || !state) {
    return createDashboardRedirect(
      req,
      {
        error:
          "missing_instagram_oauth_response",

        platform:
          "instagram",
      }
    );
  }

  try {
    /*
     * ---------------------------------------------------
     * Validate signed Autoaffi state
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
     * Verify Autoaffi session
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
            "instagram",
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
        "[instagram-oauth-callback] Session user mismatch",
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
            "instagram",
        }
      );
    }

    /*
     * ---------------------------------------------------
     * Configuration
     * ---------------------------------------------------
     */

    const clientId =
      getRequiredEnv(
        "INSTAGRAM_CLIENT_ID"
      );

    const clientSecret =
      getRequiredEnv(
        "INSTAGRAM_CLIENT_SECRET"
      );

    const redirectUri =
      getRequiredEnv(
        "NEXT_PUBLIC_INSTAGRAM_REDIRECT"
      );

    const graphApiVersion =
      getGraphApiVersion();

    /*
     * ---------------------------------------------------
     * Code → short-lived token
     * ---------------------------------------------------
     */

    const shortLived =
      await exchangeCodeForShortLivedToken(
        {
          code,
          clientId,
          clientSecret,
          redirectUri,
        }
      );

    /*
     * ---------------------------------------------------
     * Short-lived → long-lived
     * ---------------------------------------------------
     */

    const longLived =
      await exchangeForLongLivedToken(
        {
          shortLivedToken:
            shortLived
              .access_token!,

          clientSecret,
        }
      );

    const accessToken =
      longLived.access_token!;

    /*
     * ---------------------------------------------------
     * Resolve actual Instagram account
     * ---------------------------------------------------
     */

    const instagramAccount =
      await fetchInstagramAccount(
        {
          accessToken,
          graphApiVersion,
        }
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
     * Diagnostics
     * ---------------------------------------------------
     *
     * Never log the access token.
     */

    console.info(
      "[instagram-oauth-callback] Instagram Business Login connected",
      {
        platform:
          "instagram",

        instagramId:
          instagramAccount.id,

        instagramUserId:
          instagramAccount
            .user_id ??
          null,

        username:
          instagramAccount
            .username ??
          null,

        accountType:
          instagramAccount
            .account_type ??
          null,

        graphApiVersion,

        shortTokenUserId:
          shortLived
            .user_id ??
          null,

        grantedPermissions:
          shortLived
            .permissions ??
          [],

        tokenType:
          longLived
            .token_type ??
          null,

        expiresInSec,

        usesInstagramLogin:
          true,

        requiresFacebookPage:
          false,
      }
    );

    /*
     * ---------------------------------------------------
     * Save in Autoaffi social_accounts
     * ---------------------------------------------------
     */

    await upsertSocialAccount({
      userId:
        statePayload.userId,

      platform:
        "instagram",

      provider:
        "meta",

      accessToken,

      refreshToken:
        null,

      expiresInSec,

      meta: {
        oauth_connected_at:
          new Date()
            .toISOString(),

        oauth_flow:
          "instagram_business_login",

        graph_api_version:
          graphApiVersion,

        instagram_id:
          instagramAccount.id ??
          null,

        instagram_user_id:
          instagramAccount
            .user_id ??
          null,

        username:
          instagramAccount
            .username ??
          null,

        account_type:
          instagramAccount
            .account_type ??
          null,

        token_type:
          longLived
            .token_type ??
          null,

        short_token_user_id:
          shortLived
            .user_id ??
          null,

        granted_scopes:
          shortLived
            .permissions ??
          [],

        facebook_page_required:
          false,
      },
    });

    /*
     * ---------------------------------------------------
     * Success
     * ---------------------------------------------------
     */

    return createDashboardRedirect(
      req,
      {
        connected:
          "instagram",

        platform:
          "instagram",
      }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "unknown_error";

    console.error(
      "[instagram-oauth-callback] OAuth callback failed",
      {
        platform:
          "instagram",

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
              "instagram_code_exchange_failed"
            ? "instagram_code_exchange_failed"

          : message ===
              "instagram_long_lived_exchange_failed"
            ? "instagram_long_lived_token_failed"

          : message ===
              "instagram_account_lookup_failed"
            ? "instagram_account_lookup_failed"

          : "instagram_token_failed";

    return createDashboardRedirect(
      req,
      {
        error:
          publicError,

        platform:
          "instagram",
      }
    );
  }
}