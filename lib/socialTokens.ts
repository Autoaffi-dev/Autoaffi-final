import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { encryptToken, decryptToken } from "@/lib/socialCrypto";

export type SocialPlatform =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "youtube"
  | "linkedin"
  | "x";

export type SocialProvider = "meta" | "tiktok" | "google" | "linkedin";

type SocialAccountRow = {
  id: string;
  user_id: string;
  platform: SocialPlatform;
  provider: SocialProvider;
  status: "connected" | "disconnected" | string;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  token_expires_at: string | null;
  meta: any | null;
  updated_at: string | null;
};

type ValidAccessTokenResult = {
  accessToken: string;
  refreshed: boolean;
  platform: SocialPlatform;
  provider: SocialProvider;
  expiresAt: string | null;
};

function normalizePlatform(v: any): SocialPlatform {
  const p = String(v || "").toLowerCase().trim();
  if (
    p === "instagram" ||
    p === "facebook" ||
    p === "tiktok" ||
    p === "youtube" ||
    p === "linkedin" ||
    p === "x"
  ) {
    return p;
  }
  throw new Error(`invalid_platform:${p}`);
}

function isExpiringSoon(expiresAtIso: string | null, skewSec = 5 * 60): boolean {
  if (!expiresAtIso) return false; // vissa providers ger inte expiry => behandla som "ok"
  const ms = Date.parse(expiresAtIso);
  if (!Number.isFinite(ms)) return false;
  return ms - Date.now() <= skewSec * 1000;
}

function requireEnv(name: string) {
  const v = (process.env as any)[name];
  if (!v || String(v).trim().length === 0) throw new Error(`missing_env:${name}`);
  return String(v);
}

function requireAnyEnv(names: string[]) {
  for (const n of names) {
    const v = (process.env as any)[n];
    if (v && String(v).trim().length > 0) return String(v);
  }
  throw new Error(`missing_env_any_of:${names.join(",")}`);
}

// -------------------- Single-flight refresh guard --------------------
// Hindrar dubbel-refresh om två requests syncar samtidigt.
const inflight = new Map<string, Promise<ValidAccessTokenResult>>();

// -------------------- DB helpers --------------------

async function getConnectedRow(userId: string, platform: SocialPlatform): Promise<SocialAccountRow> {
  const { data, error } = await supabaseAdmin
    .from("user_social_accounts")
    .select("id,user_id,platform,provider,status,access_token_enc,refresh_token_enc,token_expires_at,meta,updated_at")
    .eq("user_id", userId)
    .eq("platform", platform)
    .eq("status", "connected")
    .maybeSingle();

  if (error) throw new Error(`db_read_failed:${error.message}`);
  if (!data) throw new Error("no_connected_account");
  return data as SocialAccountRow;
}

async function readRowMeta(rowId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_social_accounts")
    .select("meta")
    .eq("id", rowId)
    .single();

  if (error) throw new Error(`db_meta_read_failed:${error.message}`);
  return (data?.meta || {}) as any;
}

async function updateRowTokens(args: {
  rowId: string;
  accessToken: string;
  refreshToken?: string | null; // undefined = leave unchanged, null = clear, string = set
  expiresInSec?: number | null;
  tokenExpiresAtIso?: string | null; // optional explicit override (if provider returns exact)
  metaPatch?: Record<string, any>;
}) {
  const access_token_enc = encryptToken(args.accessToken);

  const refresh_token_enc =
    typeof args.refreshToken === "string" && args.refreshToken.length > 0
      ? encryptToken(args.refreshToken)
      : args.refreshToken === null
      ? null
      : undefined;

  const token_expires_at =
    typeof args.tokenExpiresAtIso === "string"
      ? args.tokenExpiresAtIso
      : args.expiresInSec && args.expiresInSec > 0
      ? new Date(Date.now() + args.expiresInSec * 1000).toISOString()
      : null;

  const existingMeta = await readRowMeta(args.rowId);

  const mergedMeta = {
    ...(existingMeta || {}),
    ...(args.metaPatch || {}),
  };

  const updatePayload: any = {
    access_token_enc,
    token_expires_at,
    meta: mergedMeta,
    updated_at: new Date().toISOString(),
  };

  // refresh_token_enc: bara om vi explicit skickar null eller string
  if (refresh_token_enc !== undefined) {
    updatePayload.refresh_token_enc = refresh_token_enc;
  }

  const { error } = await supabaseAdmin
    .from("user_social_accounts")
    .update(updatePayload)
    .eq("id", args.rowId);

  if (error) throw new Error(`db_update_failed:${error.message}`);

  return { token_expires_at };
}

// -------------------- GOOGLE REFRESH --------------------

async function refreshGoogleAccessToken(refreshToken: string) {
  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok || !json?.access_token) {
    const msg = json?.error_description || json?.error || "google_refresh_failed";
    throw new Error(`google_refresh_failed:${msg}`);
  }

  return {
    accessToken: String(json.access_token),
    expiresInSec: typeof json.expires_in === "number" ? json.expires_in : null,
    // Google skickar oftast inte ny refresh_token här — behåll din gamla
    refreshToken: json.refresh_token ? String(json.refresh_token) : null,
    raw: json,
  };
}

// -------------------- META REFRESH (IG/FB) --------------------
// Exchange short-lived token for long-lived token:
// GET /oauth/access_token?grant_type=fb_exchange_token&client_id=...&client_secret=...&fb_exchange_token=...
async function refreshMetaAccessToken(currentAccessToken: string) {
  const appId = requireAnyEnv(["META_APP_ID", "FACEBOOK_APP_ID"]);
  const appSecret = requireAnyEnv(["META_APP_SECRET", "FACEBOOK_APP_SECRET"]);

  const url =
    "https://graph.facebook.com/v20.0/oauth/access_token?" +
    new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: currentAccessToken,
    }).toString();

  const res = await fetch(url, { method: "GET", cache: "no-store" });
  const json = await res.json().catch(() => ({}));

  if (!res.ok || !json?.access_token) {
    const msg = json?.error?.message || json?.error_message || "meta_refresh_failed";
    throw new Error(`meta_refresh_failed:${msg}`);
  }

  // Meta returns expires_in (seconds) typically ~5184000 (~60 days)
  return {
    accessToken: String(json.access_token),
    expiresInSec: typeof json.expires_in === "number" ? json.expires_in : null,
    raw: json,
  };
}

// -------------------- MAIN: Get a valid access token --------------------

export async function getValidAccessToken(args: {
  userId: string;
  platform: SocialPlatform | string;
  provider?: SocialProvider;
  skewSec?: number;
}): Promise<ValidAccessTokenResult> {
  const platform = normalizePlatform(args.platform);
  const skewSec = typeof args.skewSec === "number" ? args.skewSec : 5 * 60;

  const key = `${args.userId}:${platform}:${args.provider || "any"}`;
  if (inflight.has(key)) {
    return inflight.get(key)!;
  }

  const p = (async () => {
    const row = await getConnectedRow(args.userId, platform);

    if (args.provider && row.provider !== args.provider) {
      throw new Error(`wrong_provider:${row.provider}`);
    }

    if (!row.access_token_enc) throw new Error("missing_access_token_enc");

    const accessToken = decryptToken(row.access_token_enc);
    const refreshToken = row.refresh_token_enc ? decryptToken(row.refresh_token_enc) : null;

    // Not expiring soon => return
    if (!isExpiringSoon(row.token_expires_at, skewSec)) {
      return {
        accessToken,
        refreshed: false,
        platform: row.platform,
        provider: row.provider,
        expiresAt: row.token_expires_at,
      };
    }

    // Expiring soon => refresh per provider
    if (row.provider === "google") {
      if (!refreshToken) throw new Error("missing_refresh_token");

      const refreshed = await refreshGoogleAccessToken(refreshToken);

      const metaPatch = {
        token_refreshed_at: new Date().toISOString(),
        token_refresh_provider: "google",
        // spara bara lätt debug-info (undvik stora payloads)
        token_refresh_note: "google_access_token_refreshed",
      };

      const upd = await updateRowTokens({
        rowId: row.id,
        accessToken: refreshed.accessToken,
        // om google gav ny refresh_token: använd den, annars behåll befintlig (undefined => ändra ej)
        refreshToken: refreshed.refreshToken ? refreshed.refreshToken : undefined,
        expiresInSec: refreshed.expiresInSec,
        metaPatch,
      });

      return {
        accessToken: refreshed.accessToken,
        refreshed: true,
        platform: row.platform,
        provider: row.provider,
        expiresAt: upd.token_expires_at,
      };
    }

    if (row.provider === "meta") {
      // Meta använder inte refresh_token på samma sätt.
      // Vi byter/“förlänger” access token via fb_exchange_token.
      const refreshed = await refreshMetaAccessToken(accessToken);

      const metaPatch = {
        token_refreshed_at: new Date().toISOString(),
        token_refresh_provider: "meta",
        token_refresh_note: "meta_long_lived_token_exchanged",
      };

      const upd = await updateRowTokens({
        rowId: row.id,
        accessToken: refreshed.accessToken,
        // Meta returnerar ingen refresh_token här
        refreshToken: undefined,
        expiresInSec: refreshed.expiresInSec,
        metaPatch,
      });

      return {
        accessToken: refreshed.accessToken,
        refreshed: true,
        platform: row.platform,
        provider: row.provider,
        expiresAt: upd.token_expires_at,
      };
    }

    // TikTok/LinkedIn/X refresh implementeras när du har scopes + refresh token policies klara.
    throw new Error(`refresh_not_implemented_for_provider:${row.provider}`);
  })();

  inflight.set(key, p);
  try {
    return await p;
  } finally {
    inflight.delete(key);
  }
}

/**
 * Helper: Mark "last synced" without doing full API sync.
 * (Bra för UI och run-loggning när approvals är klara)
 *
 * Viktigt: vi MERGE:ar meta istället för att skriva över den.
 */
export async function markLastSynced(args: {
  userId: string;
  platform: SocialPlatform | string;
  metaPatch?: Record<string, any>;
}) {
  const platform = normalizePlatform(args.platform);

  // hitta row först så vi kan merge:a meta säkert
  const { data: row, error: readErr } = await supabaseAdmin
    .from("user_social_accounts")
    .select("id,meta")
    .eq("user_id", args.userId)
    .eq("platform", platform)
    .eq("status", "connected")
    .maybeSingle();

  if (readErr) throw new Error(`db_mark_sync_read_failed:${readErr.message}`);
  if (!row?.id) throw new Error("no_connected_account");

  const mergedMeta = {
    ...(row.meta || {}),
    last_sync_marked_at: new Date().toISOString(),
    ...(args.metaPatch || {}),
  };

  const { error: updErr } = await supabaseAdmin
    .from("user_social_accounts")
    .update({
      updated_at: new Date().toISOString(),
      meta: mergedMeta,
    })
    .eq("id", row.id);

  if (updErr) throw new Error(`db_mark_sync_failed:${updErr.message}`);
  return { ok: true };
}