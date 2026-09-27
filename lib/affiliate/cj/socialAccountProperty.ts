/**
 * Maps an existing Autoaffi social account into a CJ SOCIAL_MEDIA property.
 * Phase 1 supports Instagram only, because that OAuth callback stores meta.username.
 * Other platforms fail closed. Email is never a social handle.
 */

export type CjSocialAccountSnapshot = {
  id: string;
  user_id: string;
  platform: string;
  status: string;
  username: string | null;
  meta: Record<string, unknown> | null;
};

export type ResolvedInstagramProperty = {
  ok: true;
  platform: "instagram";
  socialAccountId: string;
  socialAccountIdentifier: string;
  socialMediaHandle: string;
  socialMediaPlatform: "INSTAGRAM";
  propertyType: "SOCIAL_MEDIA";
  instagramAccountId: string | null;
};

export type SocialPropertyResolution =
  | ResolvedInstagramProperty
  | {
      ok: false;
      reason:
        | "CJ_PLATFORM_UNSUPPORTED"
        | "CJ_SOCIAL_ACCOUNT_NOT_CONNECTED"
        | "CJ_SOCIAL_HANDLE_MISSING"
        | "CJ_SOCIAL_ACCOUNT_OWNER_MISMATCH";
    };

export function resolveSocialPromotionalProperty(args: {
  canonicalUserId: string;
  account: CjSocialAccountSnapshot | null;
}): SocialPropertyResolution {
  const account = args.account;
  if (!account) {
    return { ok: false, reason: "CJ_SOCIAL_ACCOUNT_NOT_CONNECTED" };
  }

  if (account.user_id !== args.canonicalUserId) {
    return { ok: false, reason: "CJ_SOCIAL_ACCOUNT_OWNER_MISMATCH" };
  }

  const platform = String(account.platform || "").trim().toLowerCase();
  if (platform !== "instagram") {
    return { ok: false, reason: "CJ_PLATFORM_UNSUPPORTED" };
  }

  if (String(account.status || "").trim().toLowerCase() !== "connected") {
    return { ok: false, reason: "CJ_SOCIAL_ACCOUNT_NOT_CONNECTED" };
  }

  const handle = readInstagramHandle(account);
  if (!handle) {
    return { ok: false, reason: "CJ_SOCIAL_HANDLE_MISSING" };
  }

  const instagramAccountId = readInstagramAccountId(account.meta);
  const socialAccountIdentifier = instagramAccountId
    ? `instagram:${instagramAccountId}`
    : `instagram:handle:${handle.toLowerCase()}`;

  return {
    ok: true,
    platform: "instagram",
    socialAccountId: account.id,
    socialAccountIdentifier,
    socialMediaHandle: handle,
    socialMediaPlatform: "INSTAGRAM",
    propertyType: "SOCIAL_MEDIA",
    instagramAccountId,
  };
}

export function readInstagramHandle(account: CjSocialAccountSnapshot) {
  const meta = account.meta || {};
  const fromMeta = normalizeInstagramHandle(meta.username);
  if (fromMeta) return fromMeta;
  return normalizeInstagramHandle(account.username);
}

export function normalizeInstagramHandle(value: unknown) {
  if (typeof value !== "string") return null;
  let handle = value.trim();
  if (handle.startsWith("@")) handle = handle.slice(1).trim();
  if (!handle) return null;
  if (handle.includes("@") || /\s/.test(handle) || handle.includes("/")) {
    return null;
  }
  return handle;
}

function readInstagramAccountId(meta: Record<string, unknown> | null) {
  const source = meta || {};
  const raw = source.instagram_id ?? source.instagram_user_id;
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const id = String(raw).trim();
  if (!id || id.includes("@") || /\s/.test(id)) return null;
  return id;
}
