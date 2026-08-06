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

type MetaGranularScope = {
  scope?: string;
  target_ids?: Array<
    string | number
  >;
};

type MetaDebugTokenData = {
  app_id?: string;
  type?: string;
  application?: string;
  data_access_expires_at?: number;
  expires_at?: number;
  is_valid?: boolean;
  issued_at?: number;
  scopes?: string[];
  granular_scopes?: MetaGranularScope[];
  user_id?: string;
};

type MetaDebugTokenResponse = {
  data?: MetaDebugTokenData;
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

type MetaInstagramAccount = {
  id?: string;
  username?: string;
  name?: string;
};

type MetaPage = {
  id: string;
  name?: string;
  category?: string;
  access_token?: string;
  instagram_business_account?:
    MetaInstagramAccount;
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

type MetaSinglePageResponse =
  MetaPage & {
    error?: MetaApiError;
  };

type NormalizedMetaPage = {
  id: string;
  name: string | null;
  category: string | null;
  instagramBusinessAccount: {
    id: string;
    username: string | null;
    name: string | null;
  } | null;
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
    discoveryMethod:
      | "granular_scopes"
      | "me_accounts"
      | "none";
    targetIds: string[];
    count: number;
    pages: NormalizedMetaPage[];
    errorMessage: string | null;
    errorCode: number | null;
    errorSubcode: number | null;
  };
};

type PermissionGroups = {
  granted: string[];
  declined: string[];
  expired: string[];
};

const STATE_MAX_AGE_MS =
  10 * 60 * 1000;

const REQUIRED_PAGE_PERMISSIONS = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_metadata",
] as const;

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
    .createHmac(
      "sha256",
      secret
    )
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
  const url = new URL(
    "/login/dashboard/social-accounts",
    req.url
  );

  for (
    const [
      key,
      value,
    ] of Object.entries(values)
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
      client_id:
        args.clientId,
      client_secret:
        args.clientSecret,
      redirect_uri:
        args.redirectUri,
      code:
        args.code,
    });

  const response =
    await fetch(
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
    body.error ||
    !body.access_token
  ) {
    console.error(
      "[meta-oauth-callback] Code exchange failed",
      {
        status:
          response.status,
        errorMessage:
          body.error
            ?.message ??
          null,
        errorType:
          body.error?.type ??
          null,
        errorCode:
          body.error?.code ??
          null,
        errorSubcode:
          body.error
            ?.error_subcode ??
          null,
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
      client_id:
        args.clientId,
      client_secret:
        args.clientSecret,
      fb_exchange_token:
        args.shortLivedToken,
    });

  const response =
    await fetch(
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
    body.error ||
    !body.access_token
  ) {
    console.error(
      "[meta-oauth-callback] Long-lived USER token exchange failed",
      {
        status:
          response.status,
        errorMessage:
          body.error
            ?.message ??
          null,
        errorType:
          body.error?.type ??
          null,
        errorCode:
          body.error?.code ??
          null,
        errorSubcode:
          body.error
            ?.error_subcode ??
          null,
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
): Promise<MetaDebugTokenData> {
  const appAccessToken =
    `${args.clientId}|${args.clientSecret}`;

  const params =
    new URLSearchParams({
      input_token:
        args.accessToken,
      access_token:
        appAccessToken,
    });

  const response =
    await fetch(
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

  const data =
    body.data;

  if (
    !response.ok ||
    body.error ||
    !data?.is_valid ||
    String(data.app_id) !==
      String(args.clientId)
  ) {
    console.error(
      "[meta-oauth-callback] Token validation failed",
      {
        status:
          response.status,
        errorMessage:
          body.error
            ?.message ??
          null,
        errorCode:
          body.error?.code ??
          null,
        errorSubcode:
          body.error
            ?.error_subcode ??
          null,
        isValid:
          data?.is_valid ??
          null,
        tokenAppId:
          data?.app_id ??
          null,
        expectedAppId:
          args.clientId,
        appIdMatches:
          String(
            data?.app_id ?? ""
          ) ===
          String(
            args.clientId
          ),
        tokenType:
          data?.type ??
          null,
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
    debugTokenData:
      MetaDebugTokenData;
  }
): Promise<PermissionGroups> {
  const debugScopes =
    args.debugTokenData
      .scopes ?? [];

  const params =
    new URLSearchParams({
      access_token:
        args.accessToken,
    });

  const response =
    await fetch(
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

  /*
   * SYSTEM_USER-token kan i vissa Meta-flöden
   * inte returnera /me/permissions på samma sätt
   * som en vanlig USER-token.
   *
   * Då använder vi verifierade scopes från
   * debug_token som fallback.
   */
  if (
    !response.ok ||
    body.error
  ) {
    if (
      debugScopes.length > 0
    ) {
      console.warn(
        "[meta-oauth-callback] /me/permissions unavailable; using debug_token scopes",
        {
          status:
            response.status,
          tokenType:
            args.debugTokenData
              .type ??
            null,
          errorMessage:
            body.error
              ?.message ??
            null,
          debugScopes,
        }
      );

      return {
        granted:
          debugScopes,
        declined: [],
        expired: [],
      };
    }

    console.error(
      "[meta-oauth-callback] Permission lookup failed",
      {
        status:
          response.status,
        errorMessage:
          body.error
            ?.message ??
          null,
        errorType:
          body.error?.type ??
          null,
        errorCode:
          body.error?.code ??
          null,
        errorSubcode:
          body.error
            ?.error_subcode ??
          null,
      }
    );

    throw new Error(
      "permission_lookup_failed"
    );
  }

  const permissions =
    body.data ?? [];

  const granted =
    permissions
      .filter(
        (item) =>
          item.status ===
          "granted"
      )
      .map(
        (item) =>
          item.permission
      );

  /*
   * Lägg även till debug_token-scopes.
   * Detta gör kontrollen stabil för både
   * USER och SYSTEM_USER.
   */
  const combinedGranted =
    Array.from(
      new Set([
        ...granted,
        ...debugScopes,
      ])
    );

  return {
    granted:
      combinedGranted,

    declined:
      permissions
        .filter(
          (item) =>
            item.status ===
            "declined"
        )
        .map(
          (item) =>
            item.permission
        ),

    expired:
      permissions
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

function extractPageTargetIds(
  tokenData:
    MetaDebugTokenData
): string[] {
  const granularScopes =
    tokenData
      .granular_scopes ??
    [];

  const pageScopes =
    new Set([
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_metadata",
      "pages_manage_posts",
      "pages_read_user_content",
    ]);

  const targetIds =
    granularScopes
      .filter(
        (item) =>
          Boolean(
            item.scope &&
            pageScopes.has(
              item.scope
            )
          )
      )
      .flatMap(
        (item) =>
          item.target_ids ??
          []
      )
      .map(
        (id) =>
          String(id).trim()
      )
      .filter(Boolean);

  return Array.from(
    new Set(targetIds)
  );
}

function normalizePage(
  page: MetaPage
): NormalizedMetaPage {
  const instagramAccount =
    page
      .instagram_business_account;

  return {
    id:
      String(page.id),

    name:
      page.name ??
      null,

    category:
      page.category ??
      null,

    instagramBusinessAccount:
      instagramAccount?.id
        ? {
            id:
              String(
                instagramAccount.id
              ),

            username:
              instagramAccount
                .username ??
              null,

            name:
              instagramAccount
                .name ??
              null,
          }
        : null,
  };
}

async function fetchPageById(
  args: {
    pageId: string;
    accessToken: string;
    graphApiVersion: string;
  }
): Promise<
  NormalizedMetaPage | null
> {
  const url = new URL(
    `https://graph.facebook.com/${args.graphApiVersion}/${encodeURIComponent(args.pageId)}`
  );

  url.searchParams.set(
    "fields",
    [
      "id",
      "name",
      "category",
      "instagram_business_account{id,username,name}",
    ].join(",")
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

  const body =
    (await response
      .json()
      .catch(
        () =>
          ({}) as MetaSinglePageResponse
      )) as MetaSinglePageResponse;

  if (
    !response.ok ||
    body.error ||
    !body.id
  ) {
    console.warn(
      "[meta-oauth-callback] Assigned Page target could not be loaded",
      {
        pageId:
          args.pageId,
        status:
          response.status,
        errorMessage:
          body.error
            ?.message ??
          null,
        errorCode:
          body.error?.code ??
          null,
        errorSubcode:
          body.error
            ?.error_subcode ??
          null,
      }
    );

    return null;
  }

  return normalizePage(
    body
  );
}

async function fetchPagesFromTargetIds(
  args: {
    targetIds: string[];
    accessToken: string;
    graphApiVersion: string;
  }
): Promise<
  NormalizedMetaPage[]
> {
  if (
    args.targetIds.length ===
    0
  ) {
    return [];
  }

  const results =
    await Promise.all(
      args.targetIds.map(
        (pageId) =>
          fetchPageById({
            pageId,
            accessToken:
              args.accessToken,
            graphApiVersion:
              args.graphApiVersion,
          })
      )
    );

  const pages =
    results.filter(
      (
        page
      ): page is NormalizedMetaPage =>
        page !== null
    );

  return Array.from(
    new Map(
      pages.map(
        (page) => [
          page.id,
          page,
        ]
      )
    ).values()
  );
}

async function fetchPagesFromMeAccounts(
  args: {
    accessToken: string;
    graphApiVersion: string;
  }
): Promise<{
  status: number;
  pages: NormalizedMetaPage[];
  error:
    | MetaApiError
    | null;
}> {
  const url = new URL(
    `https://graph.facebook.com/${args.graphApiVersion}/me/accounts`
  );

  url.searchParams.set(
    "fields",
    [
      "id",
      "name",
      "category",
      "instagram_business_account{id,username,name}",
    ].join(",")
  );

  url.searchParams.set(
    "limit",
    "100"
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

  const body =
    (await response
      .json()
      .catch(
        () =>
          ({}) as MetaPagesResponse
      )) as MetaPagesResponse;

  return {
    status:
      response.status,

    pages:
      (body.data ?? [])
        .filter(
          (page) =>
            Boolean(page.id)
        )
        .map(normalizePage),

    error:
      body.error ??
      null,
  };
}

async function testMetaGraphAccess(
  args: {
    accessToken: string;
    graphApiVersion: string;
    tokenData:
      MetaDebugTokenData;
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

  const meResponse =
    await fetch(
      meUrl.toString(),
      {
        method: "GET",
        cache: "no-store",
      }
    );

  const meBody =
    (await meResponse
      .json()
      .catch(
        () =>
          ({}) as MetaMeResponse
      )) as MetaMeResponse;

  /*
   * Först använder vi tillgångarnas target_ids
   * från debug_token.
   *
   * Detta är rätt väg för konfigurationsstyrda
   * Facebook Login for Business-token där
   * specifika Pages har valts som assets.
   */
  const targetIds =
    extractPageTargetIds(
      args.tokenData
    );

  const targetedPages =
    await fetchPagesFromTargetIds({
      targetIds,
      accessToken:
        args.accessToken,
      graphApiVersion:
        args.graphApiVersion,
    });

  if (
    targetedPages.length > 0
  ) {
    const diagnostic:
      MetaGraphDiagnostic = {
      me: {
        ok:
          meResponse.ok &&
          !meBody.error &&
          Boolean(meBody.id),

        status:
          meResponse.status,

        id:
          meBody.id ??
          args.tokenData
            .user_id ??
          null,

        name:
          meBody.name ??
          null,

        errorMessage:
          meBody.error
            ?.message ??
          null,

        errorCode:
          meBody.error
            ?.code ??
          null,

        errorSubcode:
          meBody.error
            ?.error_subcode ??
          null,
      },

      pages: {
        ok: true,
        status: 200,
        discoveryMethod:
          "granular_scopes",
        targetIds,
        count:
          targetedPages.length,
        pages:
          targetedPages,
        errorMessage: null,
        errorCode: null,
        errorSubcode: null,
      },
    };

    console.info(
      "[meta-oauth-callback] Direct Graph API token diagnostic",
      {
        tokenType:
          args.tokenData
            .type ??
          null,
        me:
          diagnostic.me,
        pages:
          diagnostic.pages,
      }
    );

    return diagnostic;
  }

  /*
   * Fallback för vanlig USER-token.
   */
  const meAccounts =
    await fetchPagesFromMeAccounts({
      accessToken:
        args.accessToken,
      graphApiVersion:
        args.graphApiVersion,
    });

  const diagnostic:
    MetaGraphDiagnostic = {
    me: {
      ok:
        meResponse.ok &&
        !meBody.error &&
        Boolean(meBody.id),

      status:
        meResponse.status,

      id:
        meBody.id ??
        args.tokenData
          .user_id ??
        null,

      name:
        meBody.name ??
        null,

      errorMessage:
        meBody.error
          ?.message ??
        null,

      errorCode:
        meBody.error
          ?.code ??
        null,

      errorSubcode:
        meBody.error
          ?.error_subcode ??
        null,
    },

    pages: {
      ok:
        !meAccounts.error,

      status:
        meAccounts.status,

      discoveryMethod:
        meAccounts.pages
          .length > 0
          ? "me_accounts"
          : "none",

      targetIds,

      count:
        meAccounts.pages
          .length,

      pages:
        meAccounts.pages,

      errorMessage:
        meAccounts.error
          ?.message ??
        null,

      errorCode:
        meAccounts.error
          ?.code ??
        null,

      errorSubcode:
        meAccounts.error
          ?.error_subcode ??
        null,
    },
  };

  console.info(
    "[meta-oauth-callback] Direct Graph API token diagnostic",
    {
      tokenType:
        args.tokenData
          .type ??
        null,
      me:
        diagnostic.me,
      pages:
        diagnostic.pages,
    }
  );

  return diagnostic;
}

function calculateExpiresInSec(
  args: {
    tokenType:
      string | undefined;
    tokenExpiresIn:
      number | undefined;
    debugExpiresAt:
      number | undefined;
  }
): number | null {
  const normalizedType =
    args.tokenType
      ?.toUpperCase()
      .trim();

  /*
   * Den valda Facebook Login for Business-
   * konfigurationen använder en System User-token
   * med "Never expire".
   */
  if (
    normalizedType ===
    "SYSTEM_USER"
  ) {
    if (
      !args.debugExpiresAt ||
      args.debugExpiresAt === 0
    ) {
      return null;
    }
  }

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

function getPublicError(
  message: string
): string {
  if (
    message ===
    "expired_state"
  ) {
    return "oauth_state_expired";
  }

  if (
    message.startsWith(
      "invalid_state"
    )
  ) {
    return "bad_oauth_state";
  }

  if (
    message ===
    "code_exchange_failed"
  ) {
    return "code_exchange_failed";
  }

  if (
    message ===
    "long_lived_exchange_failed"
  ) {
    return "long_lived_token_failed";
  }

  if (
    message ===
    "invalid_meta_token"
  ) {
    return "token_validation_failed";
  }

  if (
    message ===
    "permission_lookup_failed"
  ) {
    return "permission_check_failed";
  }

  if (
    message ===
    "missing_page_permissions"
  ) {
    return "missing_page_permissions";
  }

  if (
    message ===
    "no_assigned_meta_assets"
  ) {
    return "no_assigned_meta_assets";
  }

  return "token_failed";
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
        error:
          metaError,
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

  if (
    !code ||
    !state
  ) {
    return createDashboardRedirect(
      req,
      {
        error:
          "missing_oauth_response",
      }
    );
  }

  let platform:
    MetaPlatform =
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

    /*
     * Steg 1:
     * Växla authorization code mot den token
     * som valts i Login Configuration.
     */
    const issuedToken =
      await exchangeCodeForToken({
        code,
        clientId,
        clientSecret,
        redirectUri,
        graphApiVersion,
      });

    const issuedAccessToken =
      issuedToken
        .access_token!;

    /*
     * Steg 2:
     * Kontrollera tokenens riktiga typ innan
     * vi beslutar om long-lived-växling.
     */
    const issuedTokenData =
      await debugAccessToken({
        accessToken:
          issuedAccessToken,
        clientId,
        clientSecret,
        graphApiVersion,
      });

    const issuedTokenType =
      issuedTokenData
        .type
        ?.toUpperCase()
        .trim() ||
      "UNKNOWN";

    let accessToken =
      issuedAccessToken;

    let finalTokenResponse =
      issuedToken;

    let tokenData =
      issuedTokenData;

    let usedLongLivedExchange =
      false;

    /*
     * SYSTEM_USER:
     * Använd tokenen direkt.
     *
     * USER:
     * Växla till long-lived User token.
     */
    if (
      issuedTokenType ===
      "USER"
    ) {
      finalTokenResponse =
        await exchangeForLongLivedToken({
          shortLivedToken:
            issuedAccessToken,
          clientId,
          clientSecret,
          graphApiVersion,
        });

      accessToken =
        finalTokenResponse
          .access_token!;

      tokenData =
        await debugAccessToken({
          accessToken,
          clientId,
          clientSecret,
          graphApiVersion,
        });

      usedLongLivedExchange =
        true;
    }

    const finalTokenType =
      tokenData
        .type
        ?.toUpperCase()
        .trim() ||
      issuedTokenType;

    const permissions =
      await fetchGrantedPermissions({
        accessToken,
        graphApiVersion,
        debugTokenData:
          tokenData,
      });

    const missingPagePermissions =
      REQUIRED_PAGE_PERMISSIONS
        .filter(
          (permission) =>
            !permissions
              .granted
              .includes(
                permission
              )
        );

    if (
      missingPagePermissions
        .length > 0
    ) {
      console.error(
        "[meta-oauth-callback] Required Meta Page permissions are missing",
        {
          platform,
          tokenType:
            finalTokenType,
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
     * Hämta valda tillgångar.
     *
     * SYSTEM_USER använder i första hand
     * granular_scopes.target_ids.
     *
     * USER använder /me/accounts som fallback.
     */
    const graphDiagnostic =
      await testMetaGraphAccess({
        accessToken,
        graphApiVersion,
        tokenData,
      });

    /*
     * Eftersom den nya konfigurationen kräver
     * Pages och Instagram accounts ska minst
     * en Facebook-sida hittas.
     */
    if (
      graphDiagnostic
        .pages.count === 0
    ) {
      console.error(
        "[meta-oauth-callback] No assigned Meta Page assets were returned",
        {
          platform,
          tokenType:
            finalTokenType,
          discoveryMethod:
            graphDiagnostic
              .pages
              .discoveryMethod,
          targetIds:
            graphDiagnostic
              .pages
              .targetIds,
          granularScopes:
            tokenData
              .granular_scopes ??
            [],
          grantedPermissions:
            permissions.granted,
        }
      );

      throw new Error(
        "no_assigned_meta_assets"
      );
    }

    console.info(
      "[meta-oauth-callback] Meta token and assigned assets after exchange",
      {
        platform,

        tokenAppId:
          tokenData.app_id ??
          null,

        tokenUserId:
          tokenData.user_id ??
          null,

        tokenType:
          finalTokenType,

        tokenApplication:
          tokenData
            .application ??
          null,

        debugTokenScopes:
          tokenData.scopes ??
          [],

        granularScopes:
          tokenData
            .granular_scopes ??
          [],

        grantedPermissions:
          permissions.granted,

        declinedPermissions:
          permissions.declined,

        expiredPermissions:
          permissions.expired,

        graphMeOk:
          graphDiagnostic
            .me.ok,

        graphPagesOk:
          graphDiagnostic
            .pages.ok,

        graphPageCount:
          graphDiagnostic
            .pages.count,

        pageDiscoveryMethod:
          graphDiagnostic
            .pages
            .discoveryMethod,

        assignedPageIds:
          graphDiagnostic
            .pages
            .pages
            .map(
              (page) =>
                page.id
            ),

        assignedInstagramIds:
          graphDiagnostic
            .pages
            .pages
            .map(
              (page) =>
                page
                  .instagramBusinessAccount
                  ?.id ??
                null
            )
            .filter(Boolean),

        usedLongLivedExchange,
      }
    );

    const expiresInSec =
      calculateExpiresInSec({
        tokenType:
          finalTokenType,

        tokenExpiresIn:
          finalTokenResponse
            .expires_in,

        debugExpiresAt:
          tokenData
            .expires_at,
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
          finalTokenType,

        token_response_type:
          finalTokenResponse
            .token_type ??
          null,

        meta_user_id:
          tokenData
            .user_id ??
          null,

        token_app_id:
          tokenData
            .app_id ??
          null,

        token_application:
          tokenData
            .application ??
          null,

        is_system_user_token:
          finalTokenType ===
          "SYSTEM_USER",

        used_long_lived_exchange:
          usedLongLivedExchange,

        debug_token_scopes:
          tokenData
            .scopes ??
          [],

        granular_scopes:
          tokenData
            .granular_scopes ??
          [],

        data_access_expires_at:
          tokenData
            .data_access_expires_at &&
          tokenData
            .data_access_expires_at >
            0
            ? new Date(
                tokenData
                  .data_access_expires_at *
                  1000
              ).toISOString()
            : null,

        token_expires_at:
          tokenData
            .expires_at &&
          tokenData
            .expires_at > 0
            ? new Date(
                tokenData
                  .expires_at *
                  1000
              ).toISOString()
            : null,

        granted_scopes:
          permissions.granted,

        declined_scopes:
          permissions.declined,

        expired_scopes:
          permissions.expired,

        assigned_pages:
          graphDiagnostic
            .pages.pages,

        assigned_page_ids:
          graphDiagnostic
            .pages.pages.map(
              (page) =>
                page.id
            ),

        assigned_instagram_ids:
          graphDiagnostic
            .pages.pages
            .map(
              (page) =>
                page
                  .instagramBusinessAccount
                  ?.id ??
                null
            )
            .filter(
              (
                id
              ): id is string =>
                Boolean(id)
            ),

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
              .me
              .errorMessage,

          me_error_code:
            graphDiagnostic
              .me
              .errorCode,

          me_error_subcode:
            graphDiagnostic
              .me
              .errorSubcode,

          pages_ok:
            graphDiagnostic
              .pages.ok,

          pages_status:
            graphDiagnostic
              .pages.status,

          page_discovery_method:
            graphDiagnostic
              .pages
              .discoveryMethod,

          page_target_ids:
            graphDiagnostic
              .pages
              .targetIds,

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
              .pages
              .errorCode,

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
        connected:
          platform,
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
        error:
          message,
      }
    );

    return createDashboardRedirect(
      req,
      {
        error:
          getPublicError(
            message
          ),
        platform,
      }
    );
  }
}