// lib/socialTokens.ts
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  encryptToken,
  decryptToken,
} from "@/lib/socialCrypto";

export type SocialPlatform =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "youtube"
  | "linkedin"
  | "x";

export type SocialProvider =
  | "meta"
  | "tiktok"
  | "google"
  | "linkedin"
  | "x";

type SocialAccountRow = {
  id: string;
  user_id: string;
  platform: SocialPlatform;
  provider: SocialProvider;
  status: string;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  token_expires_at: string | null;
  meta: Record<string, unknown> | null;
  updated_at: string | null;
};

type ValidAccessTokenResult = {
  accessToken: string;
  refreshed: boolean;
  platform: SocialPlatform;
  provider: SocialProvider;
  expiresAt: string | null;
};

type GoogleRefreshResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

type MetaRefreshResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
};

type TikTokRefreshResponse = {
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

type XRefreshResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

class TokenRefreshError extends Error {
  provider: SocialProvider;
  reconnectRequired: boolean;
  providerCode: string | number | null;

  constructor(args: {
    provider: SocialProvider;
    message: string;
    reconnectRequired?: boolean;
    providerCode?: string | number | null;
  }) {
    super(args.message);

    this.name = "TokenRefreshError";
    this.provider = args.provider;
    this.reconnectRequired =
      args.reconnectRequired ?? false;
    this.providerCode =
      args.providerCode ?? null;
  }
}

function normalizePlatform(
  value: unknown
): SocialPlatform {
  const platform = String(value ?? "")
    .toLowerCase()
    .trim();

  if (
    platform === "instagram" ||
    platform === "facebook" ||
    platform === "tiktok" ||
    platform === "youtube" ||
    platform === "linkedin" ||
    platform === "x"
  ) {
    return platform;
  }

  throw new Error(
    `invalid_platform:${platform}`
  );
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`missing_env:${name}`);
  }

  return value;
}

function getMetaGraphApiVersion(): string {
  const configured =
    process.env.META_GRAPH_API_VERSION?.trim() ||
    "v25.0";

  return configured.startsWith("v")
    ? configured
    : `v${configured}`;
}

function isExpiringSoon(
  expiresAtIso: string | null,
  skewSec = 5 * 60
): boolean {
  if (!expiresAtIso) {
    /*
     * Vissa providers eller äldre anslutningar kan sakna
     * registrerad expiry. Vi kan då inte avgöra om tokenen
     * håller på att löpa ut.
     */
    return false;
  }

  const expiresAtMs = Date.parse(expiresAtIso);

  if (!Number.isFinite(expiresAtMs)) {
    return false;
  }

  return (
    expiresAtMs - Date.now() <=
    Math.max(0, skewSec) * 1000
  );
}

function splitScopes(
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

function isReconnectErrorCode(
  errorCode: string | undefined
): boolean {
  const normalized = String(errorCode ?? "")
    .trim()
    .toLowerCase();

  return (
    normalized === "invalid_grant" ||
    normalized === "invalid_token" ||
    normalized === "invalid_request" ||
    normalized.includes("invalid_refresh") ||
    normalized.includes("revoked")
  );
}

/*
 * Hindrar att två samtidiga requests försöker rotera samma
 * refresh-token samtidigt i samma serverinstans.
 */
const inflight = new Map<
  string,
  Promise<ValidAccessTokenResult>
>();

// -------------------- DB helpers --------------------

async function getConnectedRow(
  userId: string,
  platform: SocialPlatform
): Promise<SocialAccountRow> {
  const { data, error } = await supabaseAdmin
    .from("user_social_accounts")
    .select(
      [
        "id",
        "user_id",
        "platform",
        "provider",
        "status",
        "access_token_enc",
        "refresh_token_enc",
        "token_expires_at",
        "meta",
        "updated_at",
      ].join(",")
    )
    .eq("user_id", userId)
    .eq("platform", platform)
    .eq("status", "connected")
    .maybeSingle();

  if (error) {
    throw new Error(
      `db_read_failed:${error.message}`
    );
  }

  if (!data) {
    throw new Error("no_connected_account");
  }

  return data as unknown as SocialAccountRow;
}

async function readRowMeta(
  rowId: string
): Promise<Record<string, unknown>> {
  const { data, error } = await supabaseAdmin
    .from("user_social_accounts")
    .select("meta")
    .eq("id", rowId)
    .single();

  if (error) {
    throw new Error(
      `db_meta_read_failed:${error.message}`
    );
  }

  const meta = data?.meta;

  if (
    typeof meta === "object" &&
    meta !== null &&
    !Array.isArray(meta)
  ) {
    return meta as Record<string, unknown>;
  }

  return {};
}

async function updateRowTokens(args: {
  rowId: string;
  accessToken: string;

  /**
   * undefined = behåll befintlig refresh-token
   * null = rensa refresh-token
   * string = ersätt refresh-token
   */
  refreshToken?: string | null;

  /**
   * undefined = behåll befintlig expiry
   * null = rensa expiry
   * number = räkna fram ny expiry
   */
  expiresInSec?: number | null;

  tokenExpiresAtIso?: string | null;
  metaPatch?: Record<string, unknown>;
}): Promise<{
  token_expires_at: string | null;
}> {
  if (!args.accessToken.trim()) {
    throw new Error(
      "db_update_failed:empty_access_token"
    );
  }

  const accessTokenEnc = encryptToken(
    args.accessToken
  );

  const existingMeta = await readRowMeta(
    args.rowId
  );

  const updatePayload: Record<string, unknown> = {
    access_token_enc: accessTokenEnc,
    meta: {
      ...existingMeta,
      ...(args.metaPatch ?? {}),
    },
    updated_at: new Date().toISOString(),
  };

  if (args.refreshToken !== undefined) {
    updatePayload.refresh_token_enc =
      typeof args.refreshToken === "string" &&
      args.refreshToken.length > 0
        ? encryptToken(args.refreshToken)
        : null;
  }

  let tokenExpiresAt:
    | string
    | null
    | undefined;

  if (args.tokenExpiresAtIso !== undefined) {
    tokenExpiresAt =
      args.tokenExpiresAtIso &&
      Number.isFinite(
        Date.parse(args.tokenExpiresAtIso)
      )
        ? args.tokenExpiresAtIso
        : null;
  } else if (
    args.expiresInSec !== undefined
  ) {
    tokenExpiresAt =
      typeof args.expiresInSec === "number" &&
      Number.isFinite(args.expiresInSec) &&
      args.expiresInSec > 0
        ? new Date(
            Date.now() +
              Math.floor(args.expiresInSec) *
                1000
          ).toISOString()
        : null;
  }

  if (tokenExpiresAt !== undefined) {
    updatePayload.token_expires_at =
      tokenExpiresAt;
  }

  const { error } = await supabaseAdmin
    .from("user_social_accounts")
    .update(updatePayload)
    .eq("id", args.rowId);

  if (error) {
    throw new Error(
      `db_update_failed:${error.message}`
    );
  }

  if (tokenExpiresAt === undefined) {
    const { data, error: readError } =
      await supabaseAdmin
        .from("user_social_accounts")
        .select("token_expires_at")
        .eq("id", args.rowId)
        .single();

    if (readError) {
      throw new Error(
        `db_expiry_read_failed:${readError.message}`
      );
    }

    tokenExpiresAt =
      data?.token_expires_at ?? null;
  }

  return {
    token_expires_at:
      tokenExpiresAt ?? null,
  };
}

async function markReconnectRequired(args: {
  row: SocialAccountRow;
  reason: string;
  providerCode?: string | number | null;
}): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("user_social_accounts")
    .update({
      status: "reconnect_required",
      updated_at: now,
      meta: {
        ...(args.row.meta ?? {}),
        reconnect_reason: args.reason,
        reconnect_provider:
          args.row.provider,
        reconnect_provider_code:
          args.providerCode ?? null,
        reconnect_required_at: now,
      },
    })
    .eq("id", args.row.id);

  if (error) {
    console.error(
      "[social-tokens] Failed to mark reconnect_required",
      {
        rowId: args.row.id,
        provider: args.row.provider,
        error: error.message,
      }
    );
  }
}

// -------------------- Google refresh --------------------

async function refreshGoogleAccessToken(
  refreshToken: string
): Promise<{
  accessToken: string;
  expiresInSec: number | null;
  refreshToken?: string;
  tokenType: string | null;
  scopes: string[];
}> {
  const clientId = requireEnv(
    "GOOGLE_CLIENT_ID"
  );

  const clientSecret = requireEnv(
    "GOOGLE_CLIENT_SECRET"
  );

  const response = await fetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
      cache: "no-store",
    }
  );

  const body = (await response
    .json()
    .catch(() => ({}))) as GoogleRefreshResponse;

  if (!response.ok || !body.access_token) {
    const reason =
      body.error_description ||
      body.error ||
      "google_refresh_failed";

    throw new TokenRefreshError({
      provider: "google",
      message:
        `google_refresh_failed:${reason}`,
      reconnectRequired:
        body.error === "invalid_grant",
      providerCode: body.error ?? null,
    });
  }

  return {
    accessToken: body.access_token,
    expiresInSec:
      typeof body.expires_in === "number"
        ? body.expires_in
        : null,
    refreshToken:
      body.refresh_token || undefined,
    tokenType:
      body.token_type ?? null,
    scopes: splitScopes(body.scope),
  };
}

// -------------------- Meta refresh --------------------

async function refreshMetaAccessToken(
  currentAccessToken: string
): Promise<{
  accessToken: string;
  expiresInSec: number | null;
  tokenType: string | null;
}> {
  const clientId = requireEnv(
    "FACEBOOK_CLIENT_ID"
  );

  const clientSecret = requireEnv(
    "FACEBOOK_CLIENT_SECRET"
  );

  const graphVersion =
    getMetaGraphApiVersion();

  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: clientId,
    client_secret: clientSecret,
    fb_exchange_token:
      currentAccessToken,
  });

  const response = await fetch(
    `https://graph.facebook.com/${graphVersion}/oauth/access_token?${params.toString()}`,
    {
      method: "GET",
      cache: "no-store",
    }
  );

  const body = (await response
    .json()
    .catch(() => ({}))) as MetaRefreshResponse;

  if (!response.ok || !body.access_token) {
    const providerCode =
      body.error?.code ?? null;

    const providerSubcode =
      body.error?.error_subcode ?? null;

    const reason =
      body.error?.message ||
      "meta_refresh_failed";

    throw new TokenRefreshError({
      provider: "meta",
      message:
        `meta_refresh_failed:${reason}`,
      reconnectRequired:
        providerCode === 190,
      providerCode:
        providerSubcode ??
        providerCode,
    });
  }

  return {
    accessToken: body.access_token,
    expiresInSec:
      typeof body.expires_in === "number"
        ? body.expires_in
        : null,
    tokenType:
      body.token_type ?? null,
  };
}

// -------------------- TikTok refresh --------------------

async function refreshTikTokAccessToken(
  refreshToken: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresInSec: number | null;
  refreshExpiresInSec: number | null;
  openId: string | null;
  tokenType: string | null;
  grantedScopes: string[];
}> {
  const clientKey = requireEnv(
    "TIKTOK_CLIENT_ID"
  );

  const clientSecret = requireEnv(
    "TIKTOK_CLIENT_SECRET"
  );

  const response = await fetch(
    "https://open.tiktokapis.com/v2/oauth/token/",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
        "Cache-Control": "no-cache",
      },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
      cache: "no-store",
    }
  );

  const body = (await response
    .json()
    .catch(() => ({}))) as TikTokRefreshResponse;

  if (
    !response.ok ||
    body.error ||
    !body.access_token ||
    !body.refresh_token
  ) {
    const reason =
      body.error_description ||
      body.error ||
      "tiktok_refresh_failed";

    const normalizedReason =
      String(body.error ?? "")
        .toLowerCase();

    const reconnectRequired =
      normalizedReason.includes(
        "invalid_grant"
      ) ||
      normalizedReason.includes(
        "invalid_token"
      ) ||
      normalizedReason.includes(
        "invalid_refresh"
      );

    console.error(
      "[social-tokens] TikTok refresh failed",
      {
        status: response.status,
        error: body.error,
        description:
          body.error_description,
        logId: body.log_id,
      }
    );

    throw new TokenRefreshError({
      provider: "tiktok",
      message:
        `tiktok_refresh_failed:${reason}`,
      reconnectRequired,
      providerCode:
        body.error ?? null,
    });
  }

  return {
    accessToken: body.access_token,

    /*
     * TikTok kan rotera refresh-tokenen.
     * Den senast returnerade tokenen ersätter den gamla.
     */
    refreshToken:
      body.refresh_token,

    expiresInSec:
      typeof body.expires_in === "number"
        ? body.expires_in
        : null,

    refreshExpiresInSec:
      typeof body.refresh_expires_in ===
      "number"
        ? body.refresh_expires_in
        : null,

    openId:
      body.open_id ?? null,

    tokenType:
      body.token_type ?? null,

    grantedScopes:
      splitScopes(body.scope),
  };
}

// -------------------- X refresh --------------------

async function refreshXAccessToken(
  currentRefreshToken: string
): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresInSec: number | null;
  tokenType: string | null;
  grantedScopes: string[];
}> {
  const clientId = requireEnv(
    "X_CLIENT_ID"
  );

  const clientSecret = requireEnv(
    "X_CLIENT_SECRET"
  );

  /*
   * Autoaffi är konfigurerad som en Web App/confidential
   * client. Klientuppgifterna skickas därför med HTTP Basic.
   */
  const basicCredentials = Buffer.from(
    `${clientId}:${clientSecret}`,
    "utf8"
  ).toString("base64");

  const response = await fetch(
    "https://api.x.com/2/oauth2/token",
    {
      method: "POST",
      headers: {
        Authorization:
          `Basic ${basicCredentials}`,
        "Content-Type":
          "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token:
          currentRefreshToken,
      }),
      cache: "no-store",
    }
  );

  const body = (await response
    .json()
    .catch(() => ({}))) as XRefreshResponse;

  if (
    !response.ok ||
    body.error ||
    !body.access_token
  ) {
    const reason =
      body.error_description ||
      body.error ||
      "x_refresh_failed";

    console.error(
      "[social-tokens] X refresh failed",
      {
        status: response.status,
        error: body.error,
        description:
          body.error_description,
      }
    );

    throw new TokenRefreshError({
      provider: "x",
      message:
        `x_refresh_failed:${reason}`,
      reconnectRequired:
        isReconnectErrorCode(
          body.error
        ),
      providerCode:
        body.error ?? null,
    });
  }

  return {
    accessToken:
      body.access_token,

    /*
     * Om X skickar en ny refresh-token sparas den.
     * Om ingen ny returneras behåller updateRowTokens()
     * den befintliga tokenen genom undefined.
     */
    refreshToken:
      body.refresh_token ||
      undefined,

    expiresInSec:
      typeof body.expires_in === "number"
        ? body.expires_in
        : null,

    tokenType:
      body.token_type ?? null,

    grantedScopes:
      splitScopes(body.scope),
  };
}

// -------------------- Main --------------------

export async function getValidAccessToken(args: {
  userId: string;
  platform: SocialPlatform | string;
  provider?: SocialProvider;
  skewSec?: number;
}): Promise<ValidAccessTokenResult> {
  const platform = normalizePlatform(
    args.platform
  );

  const skewSec =
    typeof args.skewSec === "number"
      ? Math.max(0, args.skewSec)
      : 5 * 60;

  const key = [
    args.userId,
    platform,
    args.provider ?? "any",
  ].join(":");

  const existingPromise =
    inflight.get(key);

  if (existingPromise) {
    return existingPromise;
  }

  const refreshPromise = (async () => {
    const row = await getConnectedRow(
      args.userId,
      platform
    );

    if (
      args.provider &&
      row.provider !== args.provider
    ) {
      throw new Error(
        `wrong_provider:${row.provider}`
      );
    }

    if (!row.access_token_enc) {
      throw new Error(
        "missing_access_token_enc"
      );
    }

    const accessToken = decryptToken(
      row.access_token_enc
    );

    const refreshToken =
      row.refresh_token_enc
        ? decryptToken(
            row.refresh_token_enc
          )
        : null;

    if (
      !isExpiringSoon(
        row.token_expires_at,
        skewSec
      )
    ) {
      return {
        accessToken,
        refreshed: false,
        platform: row.platform,
        provider: row.provider,
        expiresAt:
          row.token_expires_at,
      };
    }

    try {
      // ---------------- Google ----------------

      if (row.provider === "google") {
        if (!refreshToken) {
          throw new TokenRefreshError({
            provider: "google",
            message:
              "missing_refresh_token",
            reconnectRequired: true,
          });
        }

        const refreshed =
          await refreshGoogleAccessToken(
            refreshToken
          );

        const update =
          await updateRowTokens({
            rowId: row.id,

            accessToken:
              refreshed.accessToken,

            refreshToken:
              refreshed.refreshToken,

            expiresInSec:
              refreshed.expiresInSec,

            metaPatch: {
              token_refreshed_at:
                new Date().toISOString(),

              token_refresh_provider:
                "google",

              token_type:
                refreshed.tokenType,

              ...(refreshed.scopes.length > 0
                ? {
                    granted_scopes:
                      refreshed.scopes,
                  }
                : {}),
            },
          });

        return {
          accessToken:
            refreshed.accessToken,

          refreshed: true,
          platform: row.platform,
          provider: row.provider,

          expiresAt:
            update.token_expires_at,
        };
      }

      // ---------------- Meta ----------------

      if (row.provider === "meta") {
        const refreshed =
          await refreshMetaAccessToken(
            accessToken
          );

        const update =
          await updateRowTokens({
            rowId: row.id,

            accessToken:
              refreshed.accessToken,

            refreshToken: undefined,

            expiresInSec:
              refreshed.expiresInSec,

            metaPatch: {
              token_refreshed_at:
                new Date().toISOString(),

              token_refresh_provider:
                "meta",

              token_refresh_note:
                "meta_long_lived_token_exchanged",

              token_type:
                refreshed.tokenType,

              graph_api_version:
                getMetaGraphApiVersion(),
            },
          });

        return {
          accessToken:
            refreshed.accessToken,

          refreshed: true,
          platform: row.platform,
          provider: row.provider,

          expiresAt:
            update.token_expires_at,
        };
      }

      // ---------------- TikTok ----------------

      if (row.provider === "tiktok") {
        if (!refreshToken) {
          throw new TokenRefreshError({
            provider: "tiktok",
            message:
              "missing_refresh_token",
            reconnectRequired: true,
          });
        }

        const refreshed =
          await refreshTikTokAccessToken(
            refreshToken
          );

        const now =
          new Date().toISOString();

        const refreshExpiresAt =
          typeof refreshed.refreshExpiresInSec ===
            "number" &&
          refreshed.refreshExpiresInSec > 0
            ? new Date(
                Date.now() +
                  refreshed.refreshExpiresInSec *
                    1000
              ).toISOString()
            : null;

        const update =
          await updateRowTokens({
            rowId: row.id,

            accessToken:
              refreshed.accessToken,

            /*
             * TikTok roterar refresh-tokenen.
             */
            refreshToken:
              refreshed.refreshToken,

            expiresInSec:
              refreshed.expiresInSec,

            metaPatch: {
              token_refreshed_at: now,

              token_refresh_provider:
                "tiktok",

              token_type:
                refreshed.tokenType,

              open_id:
                refreshed.openId ??
                row.meta?.open_id ??
                null,

              granted_scopes:
                refreshed.grantedScopes,

              refresh_token_expires_in:
                refreshed.refreshExpiresInSec,

              refresh_token_expires_at:
                refreshExpiresAt,
            },
          });

        return {
          accessToken:
            refreshed.accessToken,

          refreshed: true,
          platform: row.platform,
          provider: row.provider,

          expiresAt:
            update.token_expires_at,
        };
      }

      // ---------------- X ----------------

      if (row.provider === "x") {
        if (!refreshToken) {
          throw new TokenRefreshError({
            provider: "x",
            message:
              "missing_refresh_token",
            reconnectRequired: true,
          });
        }

        const refreshed =
          await refreshXAccessToken(
            refreshToken
          );

        const now =
          new Date().toISOString();

        const update =
          await updateRowTokens({
            rowId: row.id,

            accessToken:
              refreshed.accessToken,

            /*
             * Om X returnerar en ny refresh-token ersätts
             * den gamla. Om värdet är undefined bevaras den.
             */
            refreshToken:
              refreshed.refreshToken,

            expiresInSec:
              refreshed.expiresInSec,

            metaPatch: {
              token_refreshed_at: now,

              token_refresh_provider:
                "x",

              token_refresh_note:
                "x_access_token_refreshed",

              token_type:
                refreshed.tokenType,

              ...(refreshed.grantedScopes
                .length > 0
                ? {
                    granted_scopes:
                      refreshed.grantedScopes,
                  }
                : {}),

              refresh_token_available:
                true,
            },
          });

        return {
          accessToken:
            refreshed.accessToken,

          refreshed: true,
          platform: row.platform,
          provider: row.provider,

          expiresAt:
            update.token_expires_at,
        };
      }

      /*
       * LinkedIn hanteras först när vi vet om den faktiska
       * LinkedIn-appen får programmatisk refresh-token.
       * Om ingen refresh-token finns krävs återanslutning.
       */
      throw new Error(
        `refresh_not_implemented_for_provider:${row.provider}`
      );
    } catch (error) {
      if (
        error instanceof TokenRefreshError &&
        error.reconnectRequired
      ) {
        await markReconnectRequired({
          row,
          reason: error.message,
          providerCode:
            error.providerCode,
        });
      }

      throw error;
    }
  })();

  inflight.set(
    key,
    refreshPromise
  );

  try {
    return await refreshPromise;
  } finally {
    inflight.delete(key);
  }
}

/**
 * Markerar senaste synk utan att skapa falska mätvärden.
 * Metadata slås ihop med befintlig metadata.
 */
export async function markLastSynced(args: {
  userId: string;
  platform: SocialPlatform | string;
  metaPatch?: Record<string, unknown>;
}): Promise<{ ok: true }> {
  const platform = normalizePlatform(
    args.platform
  );

  const { data: row, error: readError } =
    await supabaseAdmin
      .from("user_social_accounts")
      .select("id,meta")
      .eq("user_id", args.userId)
      .eq("platform", platform)
      .eq("status", "connected")
      .maybeSingle();

  if (readError) {
    throw new Error(
      `db_mark_sync_read_failed:${readError.message}`
    );
  }

  if (!row?.id) {
    throw new Error(
      "no_connected_account"
    );
  }

  const now =
    new Date().toISOString();

  const existingMeta =
    typeof row.meta === "object" &&
    row.meta !== null &&
    !Array.isArray(row.meta)
      ? row.meta
      : {};

  const { error: updateError } =
    await supabaseAdmin
      .from("user_social_accounts")
      .update({
        updated_at: now,
        meta: {
          ...existingMeta,
          last_sync_marked_at: now,
          ...(args.metaPatch ?? {}),
        },
      })
      .eq("id", row.id);

  if (updateError) {
    throw new Error(
      `db_mark_sync_failed:${updateError.message}`
    );
  }

  return { ok: true };
}