import { readCjServerConfig } from "./config";
import { evaluateCjAdvertiserUse, type CjProgramReviewSnapshot } from "./eligibility";
import { CjGraphqlError } from "./graphql";
import { getCJProductClickUrl } from "./linkCode";
import { parseCjIndexedProduct } from "./productIdentity";
import type { CjAdvertiserContract } from "./programTerms";
import { CjPropertyMappingError, type CjPropertyMappingRow } from "./propertyMapping";
import { eligibleInstagramProperties } from "./searchGate";
import type { CjSocialAccountSnapshot } from "./socialAccountProperty";
import { buildStableSubId } from "../stableOfferSubId";
import { finalizeCjTrackingUrl } from "./trackingUrl";

/**
 * Server authority for a CJ product click.
 * Affiliate Offers may bind the single eligible ACTIVE Instagram property.
 * Posts may use that property only when promotionPlatform is instagram.
 * Reels has no promotional-property context and fails closed.
 * Browser PID, AID, advertiser, destination, and SID are ignored.
 */

export class CjOfferDestinationError extends Error {
  code: string;

  constructor(code: string) {
    super(code);
    this.name = "CjOfferDestinationError";
    this.code = code;
  }
}

export type CjOfferPromotionContext = "affiliate_offers" | "posts" | "reels";

export type CjOfferIndexRow = {
  source?: string | null;
  external_id?: string | null;
  merchant_id?: string | null;
  product_url?: string | null;
  is_active?: boolean | null;
  is_approved?: boolean | null;
};

export type ResolvedCjOfferDestination = {
  affiliateLink: string;
  subid: string;
  cjPid: string;
  advertiserId: string;
  productId: string;
  trackingLabel: "CJ · Instagram";
};

export async function resolveCjOfferDestination(args: {
  canonicalUserId: string;
  indexRow: CjOfferIndexRow;
  promotionContext: string;
  promotionPlatform?: string | null;
  account: CjSocialAccountSnapshot | null;
  properties: CjPropertyMappingRow[];
  contract: CjAdvertiserContract | null;
  review: CjProgramReviewSnapshot | null;
  pat?: string;
  companyId?: string;
  fetchImpl?: typeof fetch;
  clientAdvertiserId?: unknown;
  clientPid?: unknown;
  clientAid?: unknown;
  clientDestination?: unknown;
  clientSid?: unknown;
}): Promise<ResolvedCjOfferDestination> {
  void args.clientAdvertiserId;
  void args.clientPid;
  void args.clientAid;
  void args.clientDestination;
  void args.clientSid;

  const canonicalUserId = String(args.canonicalUserId || "").trim();
  if (!canonicalUserId) {
    throw new CjOfferDestinationError("CJ_USER_MISSING");
  }

  assertPromotionContext(args.promotionContext, args.promotionPlatform);

  if (String(args.indexRow.source || "").trim().toLowerCase() !== "cj") {
    throw new CjOfferDestinationError("CJ_PRODUCT_MISMATCH");
  }
  if (args.indexRow.is_active === false || args.indexRow.is_approved === false) {
    throw new CjOfferDestinationError("CJ_PRODUCT_MISMATCH");
  }

  const identity = parseCjIndexedProduct(args.indexRow);
  if (!identity) {
    throw new CjOfferDestinationError("CJ_PRODUCT_MISMATCH");
  }

  const property = selectInstagramProperty({
    canonicalUserId,
    account: args.account,
    properties: args.properties,
  });

  const eligibility = evaluateCjAdvertiserUse({
    canonicalUserId,
    advertiserId: identity.advertiserId,
    account: args.account,
    mapping: property,
    contract: args.contract,
    review: args.review,
    method: "social_media",
  });

  if (!eligibility.ok) {
    throw new CjOfferDestinationError(eligibility.reason);
  }
  if (eligibility.cjPid !== property.cj_pid) {
    throw new CjOfferDestinationError("CJ_TRACKING_PID_MISMATCH");
  }

  const externalId = String(args.indexRow.external_id || "").trim();
  const subid = buildStableSubId(canonicalUserId, "cj", externalId);
  const config =
    args.pat && args.companyId
      ? { pat: args.pat, publisherId: args.companyId }
      : readCjServerConfig();

  let click;
  try {
    click = await getCJProductClickUrl({
      pat: config.pat,
      companyId: config.publisherId,
      advertiserId: identity.advertiserId,
      productId: identity.productId,
      promotionalPropertyId: property.cj_pid,
      fetchImpl: args.fetchImpl,
    });
  } catch (err) {
    throw asDestinationError(err);
  }

  if (click.advertiserId !== identity.advertiserId || click.productId !== identity.productId) {
    throw new CjOfferDestinationError("CJ_PRODUCT_MISMATCH");
  }

  let affiliateLink: string;
  try {
    affiliateLink = finalizeCjTrackingUrl({
      clickUrl: click.clickUrl,
      expectedPid: property.cj_pid,
      expectedSid: subid,
      merchantUrl: args.indexRow.product_url,
    });
  } catch (err) {
    throw asDestinationError(err);
  }

  return {
    affiliateLink,
    subid,
    cjPid: property.cj_pid,
    advertiserId: identity.advertiserId,
    productId: identity.productId,
    trackingLabel: "CJ · Instagram",
  };
}

function assertPromotionContext(context: string, promotionPlatform?: string | null) {
  const normalized = String(context || "").trim().toLowerCase();
  const platform = String(promotionPlatform || "").trim().toLowerCase();

  if (normalized === "affiliate_offers") {
    return;
  }

  if (normalized === "posts") {
    if (!platform) {
      throw new CjOfferDestinationError("CJ_PROMOTION_PLATFORM_REQUIRED");
    }
    if (platform !== "instagram") {
      throw new CjOfferDestinationError("CJ_PROMOTION_PLATFORM_UNSUPPORTED");
    }
    return;
  }

  throw new CjOfferDestinationError("CJ_PROMOTION_PLATFORM_REQUIRED");
}

function selectInstagramProperty(args: {
  canonicalUserId: string;
  account: CjSocialAccountSnapshot | null;
  properties: CjPropertyMappingRow[];
}) {
  const foreign = args.properties.some(
    (property) => property.user_id && property.user_id !== args.canonicalUserId
  );
  const eligible = eligibleInstagramProperties(args);

  if (eligible.length > 1) {
    throw new CjOfferDestinationError("CJ_PROPERTY_AMBIGUOUS");
  }
  if (eligible.length === 1) {
    return eligible[0];
  }

  if (foreign) {
    throw new CjPropertyMappingError("CJ_PID_OWNED_BY_ANOTHER_USER");
  }

  const ownedInstagram = args.properties.filter(
    (property) =>
      property.user_id === args.canonicalUserId && property.platform === "instagram"
  );
  if (
    ownedInstagram.some(
      (property) => String(property.status || "").trim().toUpperCase() !== "ACTIVE"
    )
  ) {
    throw new CjOfferDestinationError("CJ_PROPERTY_INACTIVE");
  }

  throw new CjOfferDestinationError("CJ_PROPERTY_MISSING");
}

function asDestinationError(err: unknown) {
  if (err instanceof CjOfferDestinationError || err instanceof CjPropertyMappingError) {
    return err;
  }
  if (err instanceof CjGraphqlError) {
    return new CjOfferDestinationError(err.code);
  }
  if (err instanceof Error && err.message) {
    return new CjOfferDestinationError(err.message);
  }
  return new CjOfferDestinationError("CJ_TRACKING_URL_INVALID");
}
