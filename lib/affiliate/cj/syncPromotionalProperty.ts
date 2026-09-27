import { readCjServerConfig } from "./config";
import {
  assertReusablePidMapping,
  CjPropertyMappingError,
  type CjPropertyMappingRow,
  type CjPropertyMappingStore,
} from "./propertyMapping";
import {
  createCJPromotionalProperty,
  listCJPromotionalProperties,
  normalizeCjSocialHandle,
  type CjSocialMediaProperty,
} from "./promotionalProperty";
import {
  resolveSocialPromotionalProperty,
  type CjSocialAccountSnapshot,
} from "./socialAccountProperty";

/**
 * Registers the canonical user's own Instagram account as a CJ promotional property.
 * Customer PID, userId, and handle input are not authority.
 * The same user + social account identifier returns the stored PID.
 */

export type SyncCjPromotionalPropertyResult = {
  mapping: CjPropertyMappingRow;
  idempotent: boolean;
};

export async function syncCjPromotionalProperty(args: {
  canonicalUserId: string;
  account: CjSocialAccountSnapshot | null;
  store: CjPropertyMappingStore;
  pat?: string;
  publisherId?: string;
  fetchImpl?: typeof fetch;
  requestedPid?: unknown;
  requestedUserId?: unknown;
  requestedHandle?: unknown;
}): Promise<SyncCjPromotionalPropertyResult> {
  void args.requestedPid;
  void args.requestedUserId;
  void args.requestedHandle;

  const canonicalUserId = String(args.canonicalUserId || "").trim();
  if (!canonicalUserId) {
    throw new CjPropertyMappingError("CJ_USER_MISSING");
  }

  const resolved = resolveSocialPromotionalProperty({
    canonicalUserId,
    account: args.account,
  });

  if (!resolved.ok) {
    throw new CjPropertyMappingError(resolved.reason);
  }

  const existing = await args.store.findByUserProperty(
    canonicalUserId,
    resolved.platform,
    resolved.socialAccountIdentifier
  );

  if (existing) {
    const reusable = assertReusablePidMapping(existing, {
      user_id: canonicalUserId,
      platform: resolved.platform,
      social_account_identifier: resolved.socialAccountIdentifier,
    });
    return { mapping: reusable, idempotent: true };
  }

  const config =
    args.pat && args.publisherId
      ? { pat: args.pat, publisherId: args.publisherId }
      : readCjServerConfig();

  const remote = await findRemoteInstagramProperty({
    pat: config.pat,
    publisherId: config.publisherId,
    handle: resolved.socialMediaHandle,
    fetchImpl: args.fetchImpl,
  });

  const property =
    remote ||
    (await createCJPromotionalProperty({
      pat: config.pat,
      publisherId: config.publisherId,
      fetchImpl: args.fetchImpl,
      name: `Instagram @${resolved.socialMediaHandle}`,
      description: "Connected Instagram account registered by Autoaffi.",
      socialMediaHandle: resolved.socialMediaHandle,
      socialMediaPlatform: "INSTAGRAM",
    }));

  if (property.status !== "ACTIVE" || !property.id) {
    throw new CjPropertyMappingError(
      property.id ? "CJ_PROPERTY_INACTIVE" : "CJ_PID_MISSING"
    );
  }

  const pidOwner = await args.store.findByPid(property.id);
  if (pidOwner) {
    const reusable = assertReusablePidMapping(pidOwner, {
      user_id: canonicalUserId,
      platform: resolved.platform,
      social_account_identifier: resolved.socialAccountIdentifier,
    });
    return { mapping: reusable, idempotent: true };
  }

  const mapping = await args.store.insert({
    user_id: canonicalUserId,
    platform: resolved.platform,
    social_account_id: resolved.socialAccountId,
    social_account_identifier: resolved.socialAccountIdentifier,
    social_media_handle: resolved.socialMediaHandle,
    cj_social_platform: resolved.socialMediaPlatform,
    cj_pid: property.id,
    property_type: resolved.propertyType,
    status: property.status,
  });

  assertReusablePidMapping(mapping, {
    user_id: canonicalUserId,
    platform: resolved.platform,
    social_account_identifier: resolved.socialAccountIdentifier,
  });

  return { mapping, idempotent: false };
}

async function findRemoteInstagramProperty(args: {
  pat: string;
  publisherId: string;
  handle: string;
  fetchImpl?: typeof fetch;
}): Promise<CjSocialMediaProperty | null> {
  const properties = await listCJPromotionalProperties({
    pat: args.pat,
    publisherId: args.publisherId,
    fetchImpl: args.fetchImpl,
  });

  const needle = normalizeCjSocialHandle(args.handle);
  const match =
    properties.find((property) => {
      if (property.propertyType !== "SOCIAL_MEDIA") return false;
      if (property.socialMediaPlatform !== "INSTAGRAM") return false;
      return normalizeCjSocialHandle(property.socialMediaHandle) === needle;
    }) || null;

  if (!match) return null;

  if (!match.publisherId || match.publisherId !== args.publisherId) {
    throw new CjPropertyMappingError("CJ_PROPERTY_RESPONSE_MISMATCH");
  }

  if (match.status !== "ACTIVE") {
    throw new CjPropertyMappingError("CJ_PROPERTY_INACTIVE");
  }

  return match;
}
