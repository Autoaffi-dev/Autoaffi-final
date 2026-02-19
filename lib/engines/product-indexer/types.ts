export type ProductIndexerSource =
  | "digistore"
  | "mylead"
  | "warriorplus"
  | "impact"
  | "awin";
// NOTE: CJ lägger vi senare när du vill.

export type ProductSource = ProductIndexerSource;

export type GeoScope = "worldwide" | "tier1" | "eu" | "us" | "nordics";

export type ProductIndexRow = {
  id?: string; // uuid only if provided
  source: ProductIndexerSource;
  external_id: string;

  title?: string | null;
  description?: string | null;
  category?: string | null;

  product_url?: string | null;
  landing_url?: string | null;
  image_url?: string | null;

  epc?: number | null;
  commission?: number | null;
  currency?: string | null;
  price?: number | null;

  score?: number | null;

  // DB kräver NOT NULL -> vi skickar alltid number (default 0)
  quality_score: number;

  // BEAST: approved-state från källan (ex WarriorPlus affiliate_requests)
  is_approved?: boolean;

  is_active?: boolean;
  winner_tier?: string | null;
  dead_reason?: string | null;

  geo_scope?: string | null;

  // ✅ CANONICAL + DEDUPE (WP + AWIN + CJ senare)
  merchant_name?: string | null;
  merchant_id?: string | null;
  canonical_url?: string | null;
  canonical_hash?: string | null;
  price_band?: string | null;
  language?: string | null;

  last_seen_at?: string;
  created_at?: string;
  updated_at?: string;
};

export type ProductIndexerReport = {
  ok: boolean;
  tookMs: number;
  triggeredAt: string;

  sources: Record<
    ProductIndexerSource,
    {
      fetched: number;
      normalized: number;
      upserted: number;
      skipped: number;
      errors: string[];
    }
  >;

  // NICE: om indexer lägger in winner policy result
  winnerPolicy?: any;
  winnerPolicyError?: string;
};

export type RawProductRecord = {
  id: string; // stable id for UI
  title: string;
  description: string | null;
  epc: number | null;
  category: string | null;
  url: string;
};

export interface IndexedProductInput {
  source: ProductSource;
  external_id: string; // stable per source
  title: string;
  description?: string | null;
  category?: string | null;

  // canonical product page / landing
  product_url: string;
  landing_url?: string | null;
  image_url?: string | null;

  epc?: number | null;
  commission?: number | null;
  currency?: string | null;
  price?: number | null;

  score?: number | null;
  quality_score?: number | null;

  geo_scope?: GeoScope; // BEAST GEO
  winner_tier?: string | null;

  // ✅ optional canonical fields (indexer kommer fylla om de saknas)
  merchant_name?: string | null;
  merchant_id?: string | null;
  canonical_url?: string | null;
  canonical_hash?: string | null;
  price_band?: string | null;
  language?: string | null;
}

export interface RunIndexerResult {
  ok: boolean;
  sources: Array<{
    source: ProductSource;
    fetched: number;
    upserted: number;
    deactivated: number;
    errors: string[];
  }>;
  tookMs: number;
}