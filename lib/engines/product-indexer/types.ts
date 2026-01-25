export type ProductSource = "digistore" | "mylead" | "warriorplus";

export type GeoScope = "worldwide" | "tier1" | "eu" | "us" | "nordics";

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