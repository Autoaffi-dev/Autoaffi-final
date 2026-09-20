export type PostsCtaMode = "content_only" | "content_and_offer";
export type PostsCtaOfferType = "product" | "recurring" | "funnel";
export type PostsCtaDestinationMode = "product" | "funnel" | "recurring";

/**
 * Destination mode is the user's explicit Posts CTA choice.
 * Default remains product unless Funnel or Recurring was clicked.
 */
export function resolvePostsCtaOfferType(input: {
  destinationMode: PostsCtaDestinationMode;
  hasProduct: boolean;
}): PostsCtaOfferType | undefined {
  if (input.destinationMode === "funnel") return "funnel";
  if (input.destinationMode === "recurring") return "recurring";
  if (input.hasProduct) return "product";
  return undefined;
}

export function buildPostsFinalLink(input: {
  mode: PostsCtaMode;
  offerType?: PostsCtaOfferType;
  productAffiliateUrl?: string;
  recurringPromoLink?: string;
  funnelLink?: string;
}): string {
  if (input.mode === "content_only") return "";

  if (input.offerType === "product") {
    return input.productAffiliateUrl || "";
  }

  if (input.offerType === "recurring") {
    return String(input.recurringPromoLink || "").trim();
  }

  if (input.offerType === "funnel") {
    return String(input.funnelLink || "").trim();
  }

  return "";
}
