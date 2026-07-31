// app/api/oauth/x/callback/route.ts
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/authOptions";
import { upsertSocialAccount } from "@/lib/socialStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const X_PKCE_COOKIE_NAME = "autoaffi_x_oauth_pkce";
const OAUTH_MAX_AGE_MS = 10 * 60 * 1000;

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

type XTokenResponse = {
  token_type?: string;
  expires_in?: number;
  access_token?: string;
  scope?: string;
  refresh_token?: string;

  error?: string;
  error_description?: string;
};

type XUser = {
  id: string;
  name: string;
  username: string;

  created_at?: string;
  description?: string;
  location?: string;
  profile_image_url?: string;
  protected?: boolean;
  public_metrics?: {
    followers_count?: number;
    following_count?: number;
    tweet_count?: number;
    listed_count?: number;
    like_count?: number;
    media_count?: number;
  };
  url?: string;
  verified?: boolean;
  verified_type?: string;
};

type XUserResponse = {
  data?: XUser;
  errors?: Array<{
    title?: string;
    detail?: string;
    type?: string;
    status?: number;
  }>;
};

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
    process.env.X_OAUTH_STATE_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    ""
  );
}

function signValue(
  value: string,
  secret: string
): string {
  return crypto
    .createHmac("sha256", secret)
    .update(value)
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

function decodeSignedPayload<T>(
  signedValue: string,
  secret: string
): T {
  const parts = signedValue.split(".");

  if (parts.length !== 2) {
    throw new Error("invalid_signed_value_format");
  }

  const [encodedPayload, receivedSignature] = parts;

  if (!encodedPayload || !receivedSignature) {
    throw new Error("invalid_signed_value_format");
  }

  const expectedSignature = signValue(
    encodedPayload,
    secret
  );

  if (
    !signaturesMatch(
      receivedSignature,
      expectedSignature
    )
  ) {
    throw new Error("invalid_signed_value_signature");
  }

  try {
    return JSON.parse(
      Buffer.from(
        encodedPayload,
        "base64url"
      ).toString("utf8")
    ) as T;
  } catch {
    throw new Error("invalid_signed_value_payload");
  }
}

function validateIssuedAt(
  issuedAt: number
): void {
  if (
    typeof issuedAt !== "number" ||
    !Number.isFinite(issuedAt)
  ) {
    throw new Error("invalid_oauth_timestamp");
  }

  const age = Date.now() - issuedAt;

  if (
    age < 0 ||
    age > OAUTH_MAX_AGE_MS
  ) {
    throw new Error("expired_oauth_attempt");
  }
}

function verifyStatePayload(
  payload: XOAuthStatePayload
): void {
  if (
    !payload ||
    payload.platform !== "x" ||
    typeof payload.userId !== "string" ||
    !payload.userId.trim() ||
    typeof payload.nonce !== "string" ||
    !payload.nonce.trim()
  ) {
    throw new Error("invalid_state_values");
  }

  validateIssuedAt(payload.issuedAt);
}

function verifyCookiePayload(
  payload: XOAuthCookiePayload
): void {
  if (
    !payload ||
    payload.platform !== "x" ||
    typeof payload.userId !== "string" ||
    !payload.userId.trim() ||
    typeof payload.nonce !== "string" ||
    !payload.nonce.trim() ||
    typeof payload.codeVerifier !== "string" ||
    payload.codeVerifier.length < 43 ||
    payload.codeVerifier.length > 128
  ) {
    throw new Error("invalid_pkce_cookie_values");
  }

  validateIssuedAt(payload.issuedAt);
}

function parseGrantedScopes(
  scope: string | undefined
): string[] {
  if (!scope) {
    return [];
  }

  return scope
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function createDashboardRedirect(
  req: NextRequest,
  values: Record<string, string>
): NextResponse {
  const url = new URL(
    "/dashboard/social-accounts",
    req.url
  );

  for (const [key, value] of Object.entries(
    values
  )) {
    url.searchParams.set(key, value);
  }

  const response = NextResponse.redirect(url);

  /*
   * PKCE-cookien får bara användas en gång och tas därför
   * bort oavsett om flödet lyckas eller misslyckas.
   */
  response.cookies.set({
    name: X_PKCE_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure:
      process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/oauth/x",
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}

async function exchangeCodeForToken(args: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<XTokenResponse> {
  /*
   * Autoaffi kör som Web App/confidential client.
   * Client ID och Client Secret skickas därför med HTTP Basic.
   */
  const basicCredentials = Buffer.from(
    `${args.clientId}:${args.clientSecret}`,
    "utf8"
  ).toString("base64");

  const response = await fetch(
    "https://api.x.com/2/oauth2/token",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicCredentials}`,
        "Content-Type":
          "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: args.code,
        redirect_uri: args.redirectUri,
        code_verifier: args.codeVerifier,
      }),
      cache: "no-store",
    }
  );

  const body = (await response
    .json()
    .catch(() => ({}))) as XTokenResponse;

  if (
    !response.ok ||
    body.error ||
    !body.access_token
  ) {
    console.error(
      "[x-oauth-callback] Token exchange failed",
      {
        status: response.status,
        error: body.error,
        description: body.error_description,
      }
    );

    throw new Error("x_token_exchange_failed");
  }

  return body;
}

async function fetchAuthenticatedXUser(
  accessToken: string
): Promise<XUser> {
  const userFields = [
    "created_at",
    "description",
    "location",
    "profile_image_url",
    "protected",
    "public_metrics",
    "url",
    "verified",
    "verified_type",
  ].join(",");

  const url = new URL(
    "https://api.x.com/2/users/me"
  );

  url.searchParams.set(
    "user.fields",
    userFields
  );

  const response = await fetch(
    url.toString(),
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
    .catch(() => ({}))) as XUserResponse;

  if (
    !response.ok ||
    !body.data?.id ||
    !body.data?.username
  ) {
    console.error(
      "[x-oauth-callback] User lookup failed",
      {
        status: response.status,
        errors: body.errors ?? null,
      }
    );

    throw new Error("x_user_lookup_failed");
  }

  return body.data;
}

export async function GET(
  req: NextRequest
) {
  const oauthError =
    req.nextUrl.searchParams.get("error");

  const oauthErrorDescription =
    req.nextUrl.searchParams.get(
      "error_description"
    );

  if (oauthError) {
    console.warn(
      "[x-oauth-callback] X authorization rejected",
      {
        error: oauthError,
        description: oauthErrorDescription,
      }
    );

    return createDashboardRedirect(req, {
      error:
        oauthError === "access_denied"
          ? "x_access_denied"
          : "x_oauth_failed",
      platform: "x",
    });
  }

  const code =
    req.nextUrl.searchParams.get("code");

  const state =
    req.nextUrl.searchParams.get("state");

  const signedPkceCookie =
    req.cookies.get(
      X_PKCE_COOKIE_NAME
    )?.value;

  if (!code || !state) {
    return createDashboardRedirect(req, {
      error: "missing_oauth_response",
      platform: "x",
    });
  }

  if (!signedPkceCookie) {
    return createDashboardRedirect(req, {
      error: "missing_pkce_cookie",
      platform: "x",
    });
  }

  try {
    const stateSecret = getStateSecret();

    if (!stateSecret) {
      throw new Error(
        "Missing X_OAUTH_STATE_SECRET or NEXTAUTH_SECRET"
      );
    }

    const statePayload =
      decodeSignedPayload<XOAuthStatePayload>(
        state,
        stateSecret
      );

    const cookiePayload =
      decodeSignedPayload<XOAuthCookiePayload>(
        signedPkceCookie,
        stateSecret
      );

    verifyStatePayload(statePayload);
    verifyCookiePayload(cookiePayload);

    /*
     * State och PKCE-cookie måste höra till exakt samma
     * OAuth-försök.
     */
    if (
      statePayload.userId !==
        cookiePayload.userId ||
      statePayload.nonce !==
        cookiePayload.nonce ||
      statePayload.issuedAt !==
        cookiePayload.issuedAt
    ) {
      throw new Error(
        "oauth_state_cookie_mismatch"
      );
    }

    const session = await getServerSession(
      authOptions
    );

    const sessionUserId =
      session?.user?.id;

    if (!sessionUserId) {
      return createDashboardRedirect(req, {
        error: "session_expired",
        platform: "x",
      });
    }

    if (
      sessionUserId !==
        statePayload.userId
    ) {
      console.error(
        "[x-oauth-callback] Session user mismatch",
        {
          sessionUserId,
          stateUserId:
            statePayload.userId,
        }
      );

      return createDashboardRedirect(req, {
        error: "oauth_user_mismatch",
        platform: "x",
      });
    }

    const clientId =
      requireEnv("X_CLIENT_ID");

    const clientSecret =
      requireEnv("X_CLIENT_SECRET");

    const redirectUri =
      requireEnv(
        "NEXT_PUBLIC_X_REDIRECT"
      );

    const token =
      await exchangeCodeForToken({
        code,
        codeVerifier:
          cookiePayload.codeVerifier,
        redirectUri,
        clientId,
        clientSecret,
      });

    const xUser =
      await fetchAuthenticatedXUser(
        token.access_token!
      );

    const grantedScopes =
      parseGrantedScopes(token.scope);

    await upsertSocialAccount({
      userId: statePayload.userId,
      platform: "x",
      provider: "x",

      accessToken: token.access_token!,

      /*
       * offline.access gör att X normalt returnerar en
       * refresh-token. undefined bevarar en befintlig token
       * om användaren ansluter kontot på nytt och X inte
       * skickar en ny.
       */
      refreshToken:
        token.refresh_token ||
        undefined,

      expiresInSec:
        typeof token.expires_in ===
        "number"
          ? token.expires_in
          : null,

      accountId: xUser.id,
      username: xUser.username,

      meta: {
        oauth_connected_at:
          new Date().toISOString(),

        x_user_id: xUser.id,
        display_name:
          xUser.name ?? null,
        username:
          xUser.username ?? null,

        profile_image_url:
          xUser.profile_image_url ??
          null,

        description:
          xUser.description ?? null,

        location:
          xUser.location ?? null,

        profile_url:
          xUser.url ?? null,

        account_created_at:
          xUser.created_at ?? null,

        protected:
          xUser.protected ?? null,

        verified:
          xUser.verified ?? null,

        verified_type:
          xUser.verified_type ?? null,

        followers_count:
          xUser.public_metrics
            ?.followers_count ?? null,

        following_count:
          xUser.public_metrics
            ?.following_count ?? null,

        post_count:
          xUser.public_metrics
            ?.tweet_count ?? null,

        listed_count:
          xUser.public_metrics
            ?.listed_count ?? null,

        like_count:
          xUser.public_metrics
            ?.like_count ?? null,

        media_count:
          xUser.public_metrics
            ?.media_count ?? null,

        token_type:
          token.token_type ??
          "bearer",

        granted_scopes:
          grantedScopes,

        refresh_token_available:
          Boolean(
            token.refresh_token
          ),
      },
    });

    return createDashboardRedirect(req, {
      connected: "x",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "unknown_error";

    console.error(
      "[x-oauth-callback] OAuth callback failed",
      {
        error: message,
      }
    );

    const publicError =
      message ===
        "expired_oauth_attempt"
        ? "oauth_state_expired"
        : message.startsWith(
              "invalid_signed_value"
            ) ||
            message ===
              "invalid_state_values" ||
            message ===
              "invalid_pkce_cookie_values" ||
            message ===
              "invalid_oauth_timestamp"
          ? "bad_oauth_state"
          : message ===
              "oauth_state_cookie_mismatch"
            ? "oauth_attempt_mismatch"
            : message ===
                "x_token_exchange_failed"
              ? "token_failed"
              : message ===
                  "x_user_lookup_failed"
                ? "profile_fetch_failed"
                : "x_callback_failed";

    return createDashboardRedirect(req, {
      error: publicError,
      platform: "x",
    });
  }
}