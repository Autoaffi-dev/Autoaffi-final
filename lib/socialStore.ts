import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { encryptToken } from "@/lib/socialCrypto";

type UpsertArgs = {
  userId: string;
  platform: "instagram" | "facebook" | "tiktok" | "youtube" | "google" | "linkedin";
  provider: "meta" | "tiktok" | "google" | "linkedin";
  accessToken: string;
  refreshToken?: string | null;
  expiresInSec?: number | null;
  accountId?: string | null;
  username?: string | null;
  meta?: any;
};

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function upsertSocialAccount(args: UpsertArgs) {
  // ✅ stoppa direkt om fel userId
  if (!isUuid(args.userId)) {
    throw new Error(`db_upsert_failed: userId is not uuid: ${args.userId}`);
  }

  const access_token_enc = encryptToken(args.accessToken);
  const refresh_token_enc = args.refreshToken ? encryptToken(args.refreshToken) : null;

  const token_expires_at =
    args.expiresInSec && args.expiresInSec > 0
      ? new Date(Date.now() + args.expiresInSec * 1000).toISOString()
      : null;

  const payload = {
    user_id: args.userId,
    platform: args.platform,
    provider: args.provider,
    access_token_enc,
    refresh_token_enc,
    token_expires_at,
    status: "connected",
    account_id: args.accountId || null,
    username: args.username || null,
    meta: args.meta || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from("user_social_accounts")
    .upsert(payload, { onConflict: "user_id,platform" });

  if (error) throw new Error("db_upsert_failed: " + error.message);
}