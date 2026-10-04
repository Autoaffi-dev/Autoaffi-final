/**
 * Passive Affiliate Connector contract.
 * Stage 1 declares the seam only. No production caller reads capabilities,
 * and Product Discovery does not branch on productFeed.
 *
 * Future design, not implemented here: a database upsert being idempotent
 * does not settle an unknown outcome from a remote side effect. Remote
 * reconciliation and idempotency have to be designed later for operations
 * such as remote promotional-property creation.
 */

export type AffiliateConnectorCapabilities = {
  offerSync: boolean;
  productFeed: boolean;
  advertiserSync: boolean;
  deepLinks: boolean;
  subId: boolean;
  transactions: boolean;
  reporting: boolean;
  promotionalProperties: boolean;
};

/**
 * Canonical product_index snapshot the save path already re-reads.
 * The connector does not accept a caller-supplied SubID.
 */
export type AffiliateIndexSnapshot = {
  merchant_id?: string | null;
  product_url?: string | null;
  is_active?: boolean | null;
  is_approved?: boolean | null;
};

export type AffiliateTrackingLinkRequest = {
  userId: string;
  externalId: string;
  indexRow: AffiliateIndexSnapshot;
  promotionContext: string;
  promotionPlatform?: string | null;
};

export type AffiliateTrackingLinkResult = {
  affiliateLink: string;
  subid: string;
};

export type AffiliateConnector = {
  readonly source: string;
  readonly capabilities: AffiliateConnectorCapabilities;
  createTrackingLink?(
    input: AffiliateTrackingLinkRequest
  ): Promise<AffiliateTrackingLinkResult>;
};
