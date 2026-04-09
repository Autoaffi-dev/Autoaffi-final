export type ProductIndexerSource =
  | "digistore"
  | "mylead"
  | "warriorplus"
  | "impact"
  | "awin"
  | "cj"
  | "aliexpress";

export type ProductSource = ProductIndexerSource;

export type GeoScope = "worldwide" | "tier1" | "eu" | "us" | "nordics";

export type ProductIndexRow = {
  id?: string;
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
  quality_score: number;

  is_approved?: boolean;
  is_active?: boolean;
  winner_tier?: string | null;
  dead_reason?: string | null;

  geo_scope?: string | null;

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

  winnerPolicy?: any;
  winnerPolicyError?: string;
};

export type RawProductRecord = {
  id: string;
  title: string;
  description: string | null;
  epc: number | null;
  category: string | null;
  url: string;
};

export interface IndexedProductInput {
  source: ProductSource;
  external_id: string;
  title: string;
  description?: string | null;
  category?: string | null;

  product_url: string;
  landing_url?: string | null;
  image_url?: string | null;

  epc?: number | null;
  commission?: number | null;
  currency?: string | null;
  price?: number | null;

  score?: number | null;
  quality_score?: number | null;

  geo_scope?: GeoScope;
  winner_tier?: string | null;

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