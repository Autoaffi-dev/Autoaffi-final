// app/api/oauth/facebook/callback/route.ts
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

type MetaPlatform =
  | "facebook"
  | "instagram";

type OAuthStatePayload = {
  userId: string;
  platform: MetaPlatform;
  issuedAt: number;
  nonce: string;
};

type MetaApiError = {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
};

type MetaTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: MetaApiError;
};

type MetaDebugTokenResponse = {
  data?: {
    app_id?: string;
    type?: string;
    application?: string;
    data_access_expires_at?: number;
    expires_at?: number;
    is_valid?: boolean;
    issued_at?: number;
    scopes?: string[];
    user_id?: string;
  };
  error?: MetaApiError;
};

type MetaPermission = {
  permission: string;
  status:
    | "granted"
    | "declined"
    | "expired"
    | string;
};

type MetaPermissionsResponse = {
  data?: MetaPermission[];
  error?: MetaApiError;
};

type MetaMeResponse = {
  id?: string;
  name?: string;
  error?: MetaApiError;
};

type MetaPage = {
  id: string;
  name?: string;
  category?: string;
};

type MetaPagesResponse = {
  data?: MetaPage[];
  paging?: {
    cursors?: {
      before?: string;
      after?: string;
    };
    next?: string;
    previous?: string;
  };
  error?: MetaApiError;
};

type MetaGraphDiagnostic = {
  me: {
    ok: boolean;
    status: number;
    id: string | null;
    name: string | null;
    errorMessage: string | null;
    errorCode: number | null;
    errorSubcode: number | null;
  };
  pages: {
    ok: boolean;
    status: number;
    count: number;
    pages: Array<{
      id: string;
      name: string | null;
      category: string | null;
    }>;
    errorMessage: string | null;
    errorCode: number | null;
    errorSubcode: number | null;
  };
};

const STATE_MAX_AGE_MS =
  10 * 60 * 1000;

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
      ?.trim() || "v25.0";

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
  const receivedBuffer = Buffer.from(
    received,
    "utf8"
  );

  const expectedBuffer = Buffer.from(
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
  const parts = state.split(".");

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

  let payload: OAuthStatePayload;

  try {
    payload = JSON.parse(
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
    ![
      "facebook",
      "instagram",
    ].includes(payload.platform)
  ) {
    throw new Error(
      "invalid_state_values"
    );
  }

  const age =
    Date.now() - payload.issuedAt;

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
  values: Record<string, string>
): NextResponse {
  const url = new URL(
    "/login/dashboard/social-accounts",
    req.url
  );

  for (const [
    key,
    value,
  ] of Object.entries(values)) {
    url.searchParams.set(
      key,
      value
    );
  }

  return NextResponse.redirect(url);
}

async function exchangeCodeForToken(
  args: {
    code: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    graphApiVersion: string;
  }
): Promise<MetaTokenResponse> {
  const params =
    new URLSearchParams({
      client_id: args.clientId,
      client_secret:
        args.clientSecret,
      redirect_uri:
        args.redirectUri,
      code: args.code,
    });

  const response = await fetch(
    `https://graph.facebook.com/${args.graphApiVersion}/oauth/access_token?${params.toString()}`,
    {
      method: "GET",
      cache: "no-store",
    }
  );

  const body =
    (await response
      .json()
      .catch(
        () =>
          ({}) as MetaTokenResponse
      )) as MetaTokenResponse;

  if (
    !response.ok ||
    !body.access_token
  ) {
    console.error(
      "[meta-oauth-callback] Code exchange failed",
      {
        status: response.status,
        errorMessage:
          body.error?.message ??
          null,
        errorType:
          body.error?.type ?? null,
        errorCode:
          body.error?.code ?? null,
        errorSubcode:
          body.error
            ?.error_subcode ?? null,
      }
    );

    throw new Error(
      "code_exchange_failed"
    );
  }

  return body;
}

async function exchangeForLongLivedToken(
  args: {
    shortLivedToken: string;
    clientId: string;
    clientSecret: string;
    graphApiVersion: string;
  }
): Promise<MetaTokenResponse> {
  const params =
    new URLSearchParams({
      grant_type:
        "fb_exchange_token",
      client_id: args.clientId,
      client_secret:
        args.clientSecret,
      fb_exchange_token:
        args.shortLivedToken,
    });

  const response = await fetch(
    `https://graph.facebook.com/${args.graphApiVersion}/oauth/access_token?${params.toString()}`,
    {
      method: "GET",
      cache: "no-store",
    }
  );

  const body =
    (await response
      .json()
      .catch(
        () =>
          ({}) as MetaTokenResponse
      )) as MetaTokenResponse;

  if (
    !response.ok ||
    !body.access_token
  ) {
    console.error(
      "[meta-oauth-callback] Long-lived token exchange failed",
      {
        status: response.status,
        errorMessage:
          body.error?.message ??
          null,
        errorType:
          body.error?.type ?? null,
        errorCode:
          body.error?.code ?? null,
        errorSubcode:
          body.error
            ?.error_subcode ?? null,
      }
    );

    throw new Error(
      "long_lived_exchange_failed"
    );
  }

  return body;
}

async function debugAccessToken(
  args: {
    accessToken: string;
    clientId: string;
    clientSecret: string;
    graphApiVersion: string;
  }
): Promise<
  MetaDebugTokenResponse["data"]
> {
  const appAccessToken =
    `${args.clientId}|${args.clientSecret}`;

  const params =
    new URLSearchParams({
      input_token:
        args.accessToken,
      access_token:
        appAccessToken,
    });

  const response = await fetch(
    `https://graph.facebook.com/${args.graphApiVersion}/debug_token?${params.toString()}`,
    {
      method: "GET",
      cache: "no-store",
    }
  );

  const body =
    (await response
      .json()
      .catch(
        () =>
          ({}) as MetaDebugTokenResponse
      )) as MetaDebugTokenResponse;

  const data = body.data;

  if (
    !response.ok ||
    body.error ||
    !data?.is_valid ||
    data.app_id !== args.clientId
  ) {
    console.error(
      "[meta-oauth-callback] Token validation failed",
      {
        status: response.status,
        errorMessage:
          body.error?.message ??
          null,
        errorCode:
          body.error?.code ?? null,
        isValid:
          data?.is_valid ?? null,
        tokenAppId:
          data?.app_id ?? null,
        expectedAppId:
          args.clientId,
        appIdMatches:
          data?.app_id ===
          args.clientId,
      }
    );

    throw new Error(
      "invalid_meta_token"
    );
  }

  return data;
}

async function fetchGrantedPermissions(
  args: {
    accessToken: string;
    graphApiVersion: string;
  }
): Promise<{
  granted: string[];
  declined: string[];
  expired: string[];
}> {
  const params =
    new URLSearchParams({
      access_token:
        args.accessToken,
    });

  const response = await fetch(
    `https://graph.facebook.com/${args.graphApiVersion}/me/permissions?${params.toString()}`,
    {
      method: "GET",
      cache: "no-store",
    }
  );

  const body =
    (await response
      .json()
      .catch(
        () =>
          ({}) as MetaPermissionsResponse
      )) as MetaPermissionsResponse;

  if (
    !response.ok ||
    body.error
  ) {
    console.error(
      "[meta-oauth-callback] Permission lookup failed",
      {
        status: response.status,
        errorMessage:
          body.error?.message ??
          null,
        errorType:
          body.error?.type ?? null,
        errorCode:
          body.error?.code ?? null,
        errorSubcode:
          body.error
            ?.error_subcode ?? null,
      }
    );

    throw new Error(
      "permission_lookup_failed"
    );
  }

  const permissions =
    body.data ?? [];

  return {
    granted: permissions
      .filter(
        (item) =>
          item.status ===
          "granted"
      )
      .map(
        (item) =>
          item.permission
      ),

    declined: permissions
      .filter(
        (item) =>
          item.status ===
          "declined"
      )
      .map(
        (item) =>
          item.permission
      ),

    expired: permissions
      .filter(
        (item) =>
          item.status ===
          "expired"
      )
      .map(
        (item) =>
          item.permission
      ),
  };
}

/**
 * Testar tokenen direkt mot Graph API.
 *
 * Vi hämtar inte Page Access Tokens här.
 * Därför loggas eller sparas inga sidtokens.
 */
async function testMetaGraphAccess(
  args: {
    accessToken: string;
    graphApiVersion: string;
  }
): Promise<MetaGraphDiagnostic> {
  const meUrl = new URL(
    `https://graph.facebook.com/${args.graphApiVersion}/me`
  );

  meUrl.searchParams.set(
    "fields",
    "id,name"
  );

  meUrl.searchParams.set(
    "access_token",
    args.accessToken
  );

  const pagesUrl = new URL(
    `https://graph.facebook.com/${args.graphApiVersion}/me/accounts`
  );

  pagesUrl.searchParams.set(
    "fields",
    "id,name,category"
  );

  pagesUrl.searchParams.set(
    "limit",
    "100"
  );

  pagesUrl.searchParams.set(
    "access_token",
    args.accessToken
  );

  const [
    meResponse,
    pagesResponse,
  ] = await Promise.all([
    fetch(meUrl.toString(), {
      method: "GET",
      cache: "no-store",
    }),
    fetch(pagesUrl.toString(), {
      method: "GET",
      cache: "no-store",
    }),
  ]);

  const meBody =
    (await meResponse
      .json()
      .catch(
        () =>
          ({}) as MetaMeResponse
      )) as MetaMeResponse;

  const pagesBody =
    (await pagesResponse
      .json()
      .catch(
        () =>
          ({}) as MetaPagesResponse
      )) as MetaPagesResponse;

  const pages =
    pagesBody.data ?? [];

  const diagnostic: MetaGraphDiagnostic =
    {
      me: {
        ok:
          meResponse.ok &&
          !meBody.error &&
          Boolean(meBody.id),

        status:
          meResponse.status,

        id:
          meBody.id ?? null,

        name:
          meBody.name ?? null,

        errorMessage:
          meBody.error?.message ??
          null,

        errorCode:
          meBody.error?.code ??
          null,

        errorSubcode:
          meBody.error
            ?.error_subcode ??
          null,
      },

      pages: {
        ok:
          pagesResponse.ok &&
          !pagesBody.error,

        status:
          pagesResponse.status,

        count:
          pages.length,

        pages: pages.map(
          (page) => ({
            id: page.id,
            name:
              page.name ?? null,
            category:
              page.category ?? null,
          })
        ),

        errorMessage:
          pagesBody.error
            ?.message ?? null,

        errorCode:
          pagesBody.error
            ?.code ?? null,

        errorSubcode:
          pagesBody.error
            ?.error_subcode ??
          null,
      },
    };

  console.info(
    "[meta-oauth-callback] Direct Graph API token diagnostic",
    {
      me: diagnostic.me,
      pages: diagnostic.pages,
    }
  );

  return diagnostic;
}

function calculateExpiresInSec(
  args: {
    tokenExpiresIn?: number;
    debugExpiresAt?: number;
  }
): number | null {
  if (
    typeof args.debugExpiresAt ===
      "number" &&
    args.debugExpiresAt > 0
  ) {
    return Math.max(
      0,
      Math.floor(
        args.debugExpiresAt -
          Date.now() / 1000
      )
    );
  }

  if (
    typeof args.tokenExpiresIn ===
      "number" &&
    args.tokenExpiresIn > 0
  ) {
    return args.tokenExpiresIn;
  }

  return null;
}

export async function GET(
  req: NextRequest
): Promise<NextResponse> {
  const metaError =
    req.nextUrl.searchParams.get(
      "error"
    );

  const metaErrorReason =
    req.nextUrl.searchParams.get(
      "error_reason"
    );

  const metaErrorDescription =
    req.nextUrl.searchParams.get(
      "error_description"
    );

  if (metaError) {
    console.warn(
      "[meta-oauth-callback] User or Meta rejected OAuth",
      {
        error: metaError,
        reason:
          metaErrorReason,
        description:
          metaErrorDescription,
      }
    );

    return createDashboardRedirect(
      req,
      {
        error:
          metaError ===
          "access_denied"
            ? "meta_access_denied"
            : "meta_oauth_failed",
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
          "missing_oauth_response",
      }
    );
  }

  let platform: MetaPlatform =
    "facebook";

  try {
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

    platform =
      statePayload.platform;

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
          platform,
        }
      );
    }

    if (
      String(sessionUserId) !==
      statePayload.userId
    ) {
      console.error(
        "[meta-oauth-callback] Session user mismatch",
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
          platform,
        }
      );
    }

    const clientId =
      getRequiredEnv(
        "FACEBOOK_CLIENT_ID"
      );

    const clientSecret =
      getRequiredEnv(
        "FACEBOOK_CLIENT_SECRET"
      );

    const redirectUri =
      getRequiredEnv(
        "NEXT_PUBLIC_FACEBOOK_REDIRECT"
      );

    const graphApiVersion =
      getGraphApiVersion();

    const shortLivedToken =
      await exchangeCodeForToken({
        code,
        clientId,
        clientSecret,
        redirectUri,
        graphApiVersion,
      });

    const longLivedToken =
      await exchangeForLongLivedToken({
        shortLivedToken:
          shortLivedToken
            .access_token!,
        clientId,
        clientSecret,
        graphApiVersion,
      });

    const accessToken =
      longLivedToken
        .access_token!;

    const tokenData =
      await debugAccessToken({
        accessToken,
        clientId,
        clientSecret,
        graphApiVersion,
      });

    const permissions =
  await fetchGrantedPermissions({
    accessToken,
    graphApiVersion,
  });

/*
 * Både Facebook- och Instagram-anslutningen
 * behöver kunna läsa användarens Facebook-sidor.
 *
 * Instagram Business-kontot hämtas senare via
 * den Facebook-sida som Instagram-kontot är länkat till.
 */
const requiredPagePermissions = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_metadata",
];

const missingPagePermissions =
  requiredPagePermissions.filter(
    (permission) =>
      !permissions.granted.includes(
        permission
      )
  );

if (
  missingPagePermissions.length > 0
) {
  console.error(
    "[meta-oauth-callback] Required Meta Page permissions are missing",
    {
      platform,
      grantedPermissions:
        permissions.granted,
      missingPagePermissions,
    }
  );

  throw new Error(
    "missing_page_permissions"
  );
}

/*
 * Viktigt diagnostiktest:
 *
 * Kör tokenen direkt mot /me och
 * /me/accounts innan den sparas.
 */
const graphDiagnostic =
  await testMetaGraphAccess({
    accessToken,
    graphApiVersion,
  });

    console.info(
      "[meta-oauth-callback] Meta token permissions after exchange",
      {
        platform,

        tokenAppId:
          tokenData?.app_id ??
          null,

        tokenUserId:
          tokenData?.user_id ??
          null,

        tokenType:
          tokenData?.type ??
          null,

        tokenApplication:
          tokenData
            ?.application ??
          null,

        debugTokenScopes:
          tokenData?.scopes ??
          [],

        grantedPermissions:
          permissions.granted,

        declinedPermissions:
          permissions.declined,

        expiredPermissions:
          permissions.expired,

        graphMeOk:
          graphDiagnostic.me.ok,

        graphPagesOk:
          graphDiagnostic
            .pages.ok,

        graphPageCount:
          graphDiagnostic
            .pages.count,

        usedLongLivedToken:
          true,
      }
    );

    const expiresInSec =
      calculateExpiresInSec({
        tokenExpiresIn:
          longLivedToken
            .expires_in,

        debugExpiresAt:
          tokenData
            ?.expires_at,
      });

    await upsertSocialAccount({
      userId:
        statePayload.userId,

      platform,

      provider: "meta",

      accessToken,

      refreshToken: null,

      expiresInSec,

      meta: {
        oauth_connected_at:
          new Date()
            .toISOString(),

        graph_api_version:
          graphApiVersion,

        token_type:
          longLivedToken
            .token_type ??
          null,

        meta_user_id:
          tokenData?.user_id ??
          null,

        debug_token_scopes:
          tokenData?.scopes ??
          [],

        data_access_expires_at:
          tokenData
            ?.data_access_expires_at &&
          tokenData
            .data_access_expires_at >
            0
            ? new Date(
                tokenData
                  .data_access_expires_at *
                  1000
              ).toISOString()
            : null,

        granted_scopes:
          permissions.granted,

        declined_scopes:
          permissions.declined,

        expired_scopes:
          permissions.expired,

        graph_diagnostic: {
          tested_at:
            new Date()
              .toISOString(),

          me_ok:
            graphDiagnostic
              .me.ok,

          me_status:
            graphDiagnostic
              .me.status,

          me_id:
            graphDiagnostic
              .me.id,

          me_name:
            graphDiagnostic
              .me.name,

          me_error:
            graphDiagnostic
              .me.errorMessage,

          me_error_code:
            graphDiagnostic
              .me.errorCode,

          pages_ok:
            graphDiagnostic
              .pages.ok,

          pages_status:
            graphDiagnostic
              .pages.status,

          page_count:
            graphDiagnostic
              .pages.count,

          pages:
            graphDiagnostic
              .pages.pages,

          pages_error:
            graphDiagnostic
              .pages
              .errorMessage,

          pages_error_code:
            graphDiagnostic
              .pages.errorCode,

          pages_error_subcode:
            graphDiagnostic
              .pages
              .errorSubcode,
        },
      },
    });

    return createDashboardRedirect(
      req,
      {
        connected: platform,
      }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "unknown_error";

    console.error(
      "[meta-oauth-callback] OAuth callback failed",
      {
        platform,
        error: message,
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
          "code_exchange_failed"
        ? "code_exchange_failed"
        : message ===
            "long_lived_exchange_failed"
          ? "long_lived_token_failed"
          : message ===
              "invalid_meta_token"
            ? "token_validation_failed"
            : message ===
                "permission_lookup_failed"
              ? "permission_check_failed"
              : message ===
                  "missing_page_permissions"
                ? "missing_page_permissions"
                : "token_failed";

    return createDashboardRedirect(
      req,
      {
        error: publicError,
        platform,
      }
    );
  }
}