// lib/socialStore.ts
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { encryptToken } from "@/lib/socialCrypto";

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

type MetaValue =
  | string
  | number
  | boolean
  | null
  | MetaValue[]
  | { [key: string]: MetaValue };

type MetaObject = Record<string, MetaValue>;

type UpsertArgs = {
  userId: string;
  platform: SocialPlatform;
  provider: SocialProvider;
  accessToken: string;

  /**
   * undefined = behåll befintligt värde
   * null = rensa befintligt värde
   * string = ersätt med nytt värde
   */
  refreshToken?: string | null;

  /**
   * undefined = behåll befintlig expiry
   * null = rensa expiry
   * number = räkna ut ny expiry
   */
  expiresInSec?: number | null;

  /**
   * undefined = behåll befintligt värde
   * null = rensa befintligt värde
   */
  accountId?: string | null;
  username?: string | null;

  /**
   * undefined = behåll befintlig metadata
   * null = rensa metadata
   * objekt = slå ihop med befintlig metadata
   */
  meta?: MetaObject | null;
};

type ExistingSocialAccount = {
  account_id: string | null;
  username: string | null;
  meta: unknown;
  refresh_token_enc: string | null;
  token_expires_at: string | null;
};

const SENSITIVE_META_KEYS = new Set([
  "access_token",
  "accesstoken",
  "access_token_enc",
  "refresh_token",
  "refreshtoken",
  "refresh_token_enc",
  "token_raw",
  "client_secret",
  "clientsecret",
  "app_secret",
  "appsecret",
]);

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function normalizeSensitiveKey(key: string): string {
  return key.trim().toLowerCase().replace(/[-\s]/g, "_");
}

/**
 * Tar bort känsliga tokenvärden som av misstag kan ha sparats
 * i metadata av äldre OAuth-kod.
 */
function sanitizeMetaValue(value: unknown): MetaValue | undefined {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    const sanitizedArray = value
      .map((item) => sanitizeMetaValue(item))
      .filter(
        (item): item is MetaValue => item !== undefined
      );

    return sanitizedArray;
  }

  if (isPlainObject(value)) {
    const sanitizedObject: MetaObject = {};

    for (const [key, childValue] of Object.entries(value)) {
      const normalizedKey = normalizeSensitiveKey(key);

      if (SENSITIVE_META_KEYS.has(normalizedKey)) {
        continue;
      }

      const sanitizedChild = sanitizeMetaValue(childValue);

      if (sanitizedChild !== undefined) {
        sanitizedObject[key] = sanitizedChild;
      }
    }

    return sanitizedObject;
  }

  return undefined;
}

function sanitizeMetaObject(value: unknown): MetaObject {
  const sanitized = sanitizeMetaValue(value);

  return isPlainObject(sanitized)
    ? (sanitized as MetaObject)
    : {};
}

function mergeMeta(
  existingMeta: unknown,
  incomingMeta: MetaObject | null | undefined
): MetaObject | null {
  const safeExistingMeta = sanitizeMetaObject(existingMeta);

  if (incomingMeta === undefined) {
    return Object.keys(safeExistingMeta).length > 0
      ? safeExistingMeta
      : null;
  }

  if (incomingMeta === null) {
    return null;
  }

  const safeIncomingMeta = sanitizeMetaObject(incomingMeta);

  const mergedMeta: MetaObject = {
    ...safeExistingMeta,
    ...safeIncomingMeta,
  };

  return Object.keys(mergedMeta).length > 0
    ? mergedMeta
    : null;
}

function calculateTokenExpiry(
  expiresInSec: number | null
): string | null {
  if (
    typeof expiresInSec !== "number" ||
    !Number.isFinite(expiresInSec) ||
    expiresInSec <= 0
  ) {
    return null;
  }

  return new Date(
    Date.now() + Math.floor(expiresInSec) * 1000
  ).toISOString();
}

export async function upsertSocialAccount(
  args: UpsertArgs
): Promise<void> {
  if (!isUuid(args.userId)) {
    throw new Error(
      `db_upsert_failed: userId is not uuid: ${args.userId}`
    );
  }

  if (!args.accessToken?.trim()) {
    throw new Error(
      "db_upsert_failed: accessToken is missing"
    );
  }

  const { data: existingData, error: existingError } =
    await supabaseAdmin
      .from("user_social_accounts")
      .select(
        [
          "account_id",
          "username",
          "meta",
          "refresh_token_enc",
          "token_expires_at",
        ].join(",")
      )
      .eq("user_id", args.userId)
      .eq("platform", args.platform)
      .maybeSingle();

  if (existingError) {
    throw new Error(
      `db_existing_account_lookup_failed: ${existingError.message}`
    );
  }

  const existing =
    (existingData as ExistingSocialAccount | null) ?? null;

  const accessTokenEnc = encryptToken(args.accessToken);

  const refreshTokenEnc =
    args.refreshToken === undefined
      ? existing?.refresh_token_enc ?? null
      : args.refreshToken
        ? encryptToken(args.refreshToken)
        : null;

  const tokenExpiresAt =
    args.expiresInSec === undefined
      ? existing?.token_expires_at ?? null
      : calculateTokenExpiry(args.expiresInSec);

  const accountId =
    args.accountId === undefined
      ? existing?.account_id ?? null
      : args.accountId;

  const username =
    args.username === undefined
      ? existing?.username ?? null
      : args.username;

  const meta = mergeMeta(existing?.meta, args.meta);

  const now = new Date().toISOString();

  const payload = {
    user_id: args.userId,
    platform: args.platform,
    provider: args.provider,

    access_token_enc: accessTokenEnc,
    refresh_token_enc: refreshTokenEnc,
    token_expires_at: tokenExpiresAt,

    status: "connected",

    account_id: accountId,
    username,
    meta,

    updated_at: now,
  };

  const { error: upsertError } = await supabaseAdmin
    .from("user_social_accounts")
    .upsert(payload, {
      onConflict: "user_id,platform",
    });

  if (upsertError) {
    throw new Error(
      `db_upsert_failed: ${upsertError.message}`
    );
  }
}