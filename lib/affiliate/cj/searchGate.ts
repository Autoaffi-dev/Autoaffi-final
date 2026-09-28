import type { CjProgramReviewSnapshot } from "./eligibility";
import { normalizeCjSocialHandle } from "./promotionalProperty";
import type { CjPropertyMappingRow } from "./propertyMapping";
import type { CjSocialAccountSnapshot } from "./socialAccountProperty";
import { resolveSocialPromotionalProperty } from "./socialAccountProperty";

/**
 * Search-time CJ visibility.
 * Uses the admin review and the user's Instagram property.
 * Does not call Program Terms. The ACTIVE contract is checked at save.
 */

export function filterCjSearchItems<
  T extends { source?: string | null; merchant_id?: string | null }
>(
  items: T[],
  args: {
    canonicalUserId: string;
    account: CjSocialAccountSnapshot | null;
    properties: CjPropertyMappingRow[];
    reviews: CjProgramReviewSnapshot[];
  }
): T[] {
  const propertyReady = hasExactlyOneEligibleInstagramProperty(args);
  const reviews = new Map(
    args.reviews.map((review) => [String(review.advertiser_id || "").trim(), review])
  );

  return items.filter((item) => {
    if (String(item.source || "").trim().toLowerCase() !== "cj") return true;
    if (!propertyReady) return false;
    const advertiserId = String(item.merchant_id || "").trim();
    return reviewAllowsSocial(reviews.get(advertiserId) || null, advertiserId);
  });
}

export function hasExactlyOneEligibleInstagramProperty(args: {
  canonicalUserId: string;
  account: CjSocialAccountSnapshot | null;
  properties: CjPropertyMappingRow[];
}) {
  return eligibleInstagramProperties(args).length === 1;
}

export function eligibleInstagramProperties(args: {
  canonicalUserId: string;
  account: CjSocialAccountSnapshot | null;
  properties: CjPropertyMappingRow[];
}) {
  const resolved = resolveSocialPromotionalProperty({
    canonicalUserId: args.canonicalUserId,
    account: args.account,
  });
  if (!resolved.ok) return [];

  return args.properties.filter((property) => {
    return (
      property.user_id === args.canonicalUserId &&
      property.platform === resolved.platform &&
      property.social_account_identifier === resolved.socialAccountIdentifier &&
      property.property_type === resolved.propertyType &&
      property.cj_social_platform === resolved.socialMediaPlatform &&
      instagramHandlesMatch(property.social_media_handle, resolved.socialMediaHandle) &&
      String(property.status || "").trim().toUpperCase() === "ACTIVE" &&
      Boolean(String(property.cj_pid || "").trim())
    );
  });
}

function instagramHandlesMatch(stored: string, resolvedHandle: string) {
  const left = normalizeCjSocialHandle(stored);
  const right = normalizeCjSocialHandle(resolvedHandle);
  if (!left || !right) return false;
  return left === right;
}

function reviewAllowsSocial(
  review: CjProgramReviewSnapshot | null,
  advertiserId: string
) {
  if (!review || !advertiserId) return false;
  if (review.advertiser_id !== advertiserId) return false;
  if (String(review.status || "").trim().toLowerCase() !== "allowed") return false;
  const methods = (review.permitted_methods || []).map((item) =>
    String(item || "").trim().toLowerCase()
  );
  return methods.includes("social_media");
}
