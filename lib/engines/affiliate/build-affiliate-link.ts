export type ProductPlatform =
  | "digistore"
  | "mylead"
  | "cpalead"
  | "impact"
  | "amazon";

interface BuildLinkInput {
  platform: ProductPlatform;
  productUrl: string;
  affiliateId: string;
}

export function buildAffiliateLink({
  platform,
  productUrl,
  affiliateId,
}: BuildLinkInput): string {
  switch (platform) {
    case "digistore":
      return `${productUrl}?aff=${affiliateId}`;

    case "mylead":
      return `${productUrl}&aff=${affiliateId}`;

    case "cpalead":
      return `${productUrl}&aff_id=${affiliateId}`;

    case "impact":
      return `${productUrl}&subId1=${affiliateId}`;

    case "amazon":
      return `${productUrl}?tag=${affiliateId}`;

    default:
      return productUrl;
  }
}