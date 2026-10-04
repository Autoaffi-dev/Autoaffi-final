import type {
  AffiliateConnector,
  AffiliateTrackingLinkRequest,
  AffiliateTrackingLinkResult,
} from "./types";

type StoredCjResolver =
  typeof import("../cj/resolveStoredCjOfferDestination").resolveStoredCjOfferDestination;

async function loadStoredCjResolver(): Promise<StoredCjResolver> {
  // Existing save-path resolver. Loaded on the tracking call so this passive
  // module does not construct the service-role client at import time.
  const mod = await import("../cj/resolveStoredCjOfferDestination");
  return mod.resolveStoredCjOfferDestination;
}

/**
 * Passive CJ adapter. No production path calls this yet.
 * Tracking stays inside resolveStoredCjOfferDestination, which calls the
 * verified resolver. That resolver mints the stable SubID and sends it as
 * shopperId. This file does not build a CJ link and does not read client
 * pid, sid, or destination.
 *
 * Capabilities describe current proven CJ behavior. Transactions and
 * reporting are not implemented. Offer sync stays on the existing indexer.
 */
export const CJ_CONNECTOR_CAPABILITIES = {
  offerSync: false,
  productFeed: true,
  advertiserSync: false,
  deepLinks: true,
  subId: true,
  transactions: false,
  reporting: false,
  promotionalProperties: true,
} as const;

export async function createCjTrackingLink(
  input: AffiliateTrackingLinkRequest,
  resolve?: StoredCjResolver
): Promise<AffiliateTrackingLinkResult> {
  const resolveStored = resolve ?? (await loadStoredCjResolver());
  const resolved = await resolveStored({
    canonicalUserId: input.userId,
    indexRow: {
      source: "cj",
      external_id: input.externalId,
      merchant_id: input.indexRow?.merchant_id ?? null,
      product_url: input.indexRow?.product_url ?? null,
      is_active: input.indexRow?.is_active ?? null,
      is_approved: input.indexRow?.is_approved ?? null,
    },
    promotionContext: input.promotionContext,
    promotionPlatform: input.promotionPlatform,
  });

  return {
    affiliateLink: resolved.affiliateLink,
    subid: resolved.subid,
  };
}

export const cjAdapter: AffiliateConnector = {
  source: "cj",
  capabilities: CJ_CONNECTOR_CAPABILITIES,
  createTrackingLink(input) {
    return createCjTrackingLink(input);
  },
};
