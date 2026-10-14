import type {
  AffiliateConnector,
  AffiliateTrackingLinkRequest,
  AffiliateTrackingLinkResult,
} from "./types";
import { buildStableSubId } from "../stableOfferSubId";
import { buildWarriorPlusLink } from "../sources/warriorplus";

/**
 * Passive WarriorPlus adapter. Stage 1 has no production caller.
 *
 * createTrackingLink mints the stable SubID and delegates the URL edit to
 * buildWarriorPlusLink. It does not authenticate, read product_index, or
 * apply save-route validation. Those stay in /api/offers/select.
 *
 * The request has no caller-supplied SubID. promotionContext is the
 * production `context` value: body.from, or "affiliate_offers" when from
 * is empty. That context is always non-empty on the save path, so the
 * builder's campaign fallback does not affect production hop_tid. An empty
 * promotionContext uses the builder default "affiliate_offers".
 *
 * deepLinks is false. The builder appends hop_sid, sid, and hop_tid to an
 * existing promote URL. It does not generate an affiliate link for an
 * arbitrary merchant URL. productFeed is true because the WarriorPlus
 * indexer feed already writes product_index. This adapter does not own
 * that ingestion, and offerSync stays false.
 */
export const WARRIORPLUS_CONNECTOR_CAPABILITIES = {
  offerSync: false,
  productFeed: true,
  advertiserSync: false,
  deepLinks: false,
  subId: true,
  transactions: false,
  reporting: false,
  promotionalProperties: false,
} as const;

export async function createWarriorPlusTrackingLink(
  input: AffiliateTrackingLinkRequest
): Promise<AffiliateTrackingLinkResult> {
  const subid = buildStableSubId(input.userId, "warriorplus", input.externalId);
  const built = await buildWarriorPlusLink({
    source: "warriorplus",
    productUrl: input.indexRow?.product_url ?? "",
    externalId: input.externalId,
    userId: input.userId,
    subid,
    context: input.promotionContext,
  });

  return {
    affiliateLink: built.affiliateLink,
    subid: built.subid,
  };
}

export const warriorPlusAdapter = {
  source: "warriorplus",
  capabilities: WARRIORPLUS_CONNECTOR_CAPABILITIES,
  createTrackingLink(input: AffiliateTrackingLinkRequest) {
    return createWarriorPlusTrackingLink(input);
  },
} satisfies AffiliateConnector<"warriorplus">;
