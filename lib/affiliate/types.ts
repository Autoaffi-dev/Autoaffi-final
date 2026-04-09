export type AffiliateSource =
  | "aliexpress"
  | "awin"
  | "warriorplus"
  | "cj"
  | "rakuten"
  | "byo"
  | "manual";

export type BuildAffiliateLinkInput = {
  source: string;
  productUrl: string;
  externalId: string;
  userId: string;
  subid: string;
  title?: string | null;
  merchantName?: string | null;
  campaign?: string | null;
  context?: string | null; // affiliate_offers | reels | posts
};

export type BuildAffiliateLinkResult = {
  affiliateLink: string;
  productUrl: string;
  subid: string;
  network: AffiliateSource | "unknown";
  meta?: Record<string, any>;
};