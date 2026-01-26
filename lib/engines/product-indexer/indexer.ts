import { createClient } from "@supabase/supabase-js";

/**
 * AUTOAFFI — Product Indexer BEAST FINAL
 * Sources: digistore + mylead + warriorplus
 * Writes to: public.product_index (upsert on source,external_id)
 * Guarantees: quality_score + score never null, winner_tier always set
 */

export type ProductIndexerSource = "digistore" | "mylead" | "warriorplus";

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

  score?: number | null; // will be forced to number
  quality_score?: number | null; // will be forced to number

  is_active?: boolean;
  winner_tier?: string | null;
  dead_reason?: string | null;

  geo_scope?: string | null; // worldwide / tier1 / eu / nordics etc

  last_seen_at?: string;
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
};

function toIsoNow() {
  return new Date().toISOString();
}

function isUuid(v: unknown): v is string {
  if (typeof v !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function numOrNull(v: any): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE env vars (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).");
  }

  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

async function loadFetcher(source: ProductIndexerSource) {
  const map: Record<ProductIndexerSource, string> = {
    digistore: "./fetch-digistore",
    mylead: "./fetch-mylead",
    warriorplus: "./fetch-warriorplus",
  };

  const mod: any = await import(map[source]);

  const candidates: any[] = [
    mod?.fetchProducts,
    mod?.fetchProductIndex,
    mod?.fetchDigistore,
    mod?.fetchMylead,
    mod?.fetchWarriorplus,
    mod?.default,
  ];

  let fn = candidates.find((x) => typeof x === "function");

  if (!fn) {
    for (const key of Object.keys(mod || {})) {
      if (typeof mod[key] === "function") {
        fn = mod[key];
        break;
      }
    }
  }

  if (typeof fn !== "function") {
    throw new Error(`Fetcher for "${source}" not found (no function export in ${map[source]}).`);
  }

  return fn as (args: { limit: number }) => Promise<any[]>;
}

/**
 * BEAST scoring:
 * - Always produces 0..100
 * - Prefers products with: title + url + image + category + epc/commission
 * - Keeps it network-safe (no scraping required beyond what fetchers already do)
 */
function computeQualityScore(row: ProductIndexRow): number {
  let s = 0;

  // data completeness
  if (row.title && row.title.trim().length >= 6) s += 18;
  if (row.description && row.description.trim().length >= 20) s += 10;
  if (row.category && row.category.trim().length >= 3) s += 10;

  // urls
  if (row.product_url && row.product_url.startsWith("http")) s += 18;
  if (row.landing_url && row.landing_url.startsWith("http")) s += 10;

  // image
  if (row.image_url && row.image_url.startsWith("http")) s += 10;

  // economics (lightweight heuristic)
  const epc = row.epc ?? null;
  const commission = row.commission ?? null;

  if (epc != null) {
    if (epc >= 3) s += 22;
    else if (epc >= 2) s += 16;
    else if (epc >= 1) s += 10;
    else s += 4;
  } else {
    s += 2;
  }

  if (commission != null) {
    if (commission >= 50) s += 12;
    else if (commission >= 25) s += 8;
    else if (commission >= 10) s += 5;
    else s += 2;
  } else {
    s += 2;
  }

  // clamp
  if (s < 0) s = 0;
  if (s > 100) s = 100;
  return s;
}

function winnerTierFromScore(score: number): "A" | "B" | "C" | "D" {
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 50) return "C";
  return "D";
}

function normalizeRow(input: any, source: ProductIndexerSource): ProductIndexRow | null {
  const externalIdRaw =
    input?.external_id ??
    input?.externalId ??
    input?.product_id ??
    input?.productId ??
    input?.offer_id ??
    input?.offerId ??
    input?.id;

  const external_id = String(externalIdRaw ?? "").trim();
  if (!external_id) return null;

  const idCandidate = input?.id;
  const id = isUuid(idCandidate) ? idCandidate : undefined;

  const now = toIsoNow();

  const product_url = input?.product_url ?? input?.productUrl ?? input?.url ?? null;
  const landing_url = input?.landing_url ?? input?.landingUrl ?? input?.landing ?? null;

  const row: ProductIndexRow = {
    ...(id ? { id } : {}),
    source,
    external_id,

    title: input?.title ?? input?.name ?? input?.product_title ?? null,
    description: input?.description ?? input?.desc ?? null,
    category: input?.category ?? null,

    product_url: product_url ? String(product_url) : null,
    landing_url: landing_url ? String(landing_url) : null,
    image_url: input?.image_url ?? input?.imageUrl ?? input?.image ?? null,

    epc: numOrNull(input?.epc),
    commission: numOrNull(input?.commission),
    currency: input?.currency ?? null,
    price: numOrNull(input?.price),

    geo_scope: input?.geo_scope ?? input?.geoScope ?? "worldwide",

    is_active: input?.is_active ?? true,
    dead_reason: input?.dead_reason ?? null,

    last_seen_at: input?.last_seen_at ?? now,
    updated_at: now,
  };

  // compute BEAST scores always
  const quality = computeQualityScore(row);
  row.quality_score = quality;
  row.score = quality;
  row.winner_tier = winnerTierFromScore(quality);

  return row;
}

export async function runProductIndexer(args?: {
  sources?: ProductIndexerSource[];
  limit?: number;
}): Promise<ProductIndexerReport> {
  const started = Date.now();
  const triggeredAt = toIsoNow();

  const sources: ProductIndexerSource[] = args?.sources ?? ["digistore", "mylead", "warriorplus"];
  const limit = Math.max(1, Math.min(args?.limit ?? 200, 500));

  const supabase = getSupabaseAdmin();

  const report: ProductIndexerReport = {
    ok: true,
    tookMs: 0,
    triggeredAt,
    sources: {
      digistore: { fetched: 0, normalized: 0, upserted: 0, skipped: 0, errors: [] },
      mylead: { fetched: 0, normalized: 0, upserted: 0, skipped: 0, errors: [] },
      warriorplus: { fetched: 0, normalized: 0, upserted: 0, skipped: 0, errors: [] },
    },
  };

  for (const source of sources) {
    try {
      const fetcher = await loadFetcher(source);
      const raw = await fetcher({ limit });

      report.sources[source].fetched = Array.isArray(raw) ? raw.length : 0;

      const normalized: ProductIndexRow[] = [];
      let skipped = 0;

      for (const item of raw ?? []) {
        const row = normalizeRow(item, source);
        if (!row) {
          skipped++;
          continue;
        }
        normalized.push(row);
      }

      report.sources[source].skipped = skipped;
      report.sources[source].normalized = normalized.length;

      if (normalized.length === 0) continue;

      const batchSize = 250;
      for (let i = 0; i < normalized.length; i += batchSize) {
        const batch = normalized.slice(i, i + batchSize);

        const { error } = await supabase
          .from("product_index")
          .upsert(batch, { onConflict: "source,external_id" });

        if (error) {
          report.ok = false;
          report.sources[source].errors.push(`upsert failed: ${error.message}`);
        } else {
          report.sources[source].upserted += batch.length;
        }
      }
    } catch (e: any) {
      report.ok = false;
      report.sources[source].errors.push(e?.message ?? String(e));
    }
  }

  report.tookMs = Date.now() - started;
  return report;
}

export default runProductIndexer;