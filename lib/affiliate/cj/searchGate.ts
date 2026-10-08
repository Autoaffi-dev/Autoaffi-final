import { cjReviewAllowsSocial, type CjProgramReviewSnapshot } from "./eligibility";
import { normalizeCjSocialHandle } from "./promotionalProperty";
import type { CjPropertyMappingRow } from "./propertyMapping";
import type { CjSocialAccountSnapshot } from "./socialAccountProperty";
import { resolveSocialPromotionalProperty } from "./socialAccountProperty";

/**
 * Search-time CJ visibility.
 * Context authorization happens before this gate. The gate itself uses the
 * admin review and the user's Instagram property.
 * Does not call Program Terms. The ACTIVE contract is checked at save.
 */

export const CJ_APPROVED_CUSTOMER_SEARCH_CONTEXTS = ["posts", "affiliate_offers"] as const;

export function isApprovedCjCustomerSearchContext(context: string | null | undefined) {
  const value = String(context ?? "").trim().toLowerCase();
  return (CJ_APPROVED_CUSTOMER_SEARCH_CONTEXTS as readonly string[]).includes(value);
}

/**
 * CJ rows reach the review/property gate only for an explicit approved context.
 * Missing, reels, and unknown contexts drop CJ before that gate.
 * Other sources stay in the list.
 */
export function prepareCjCustomerSearchItems<T extends { source?: string | null }>(
  items: T[],
  context: string | null | undefined
): { items: T[]; applyReviewGate: boolean } {
  if (isApprovedCjCustomerSearchContext(context)) {
    return { items, applyReviewGate: true };
  }

  return {
    applyReviewGate: false,
    items: items.filter((item) => String(item.source || "").trim().toLowerCase() !== "cj"),
  };
}

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
    return cjReviewAllowsSocial(reviews.get(advertiserId) || null, advertiserId);
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
