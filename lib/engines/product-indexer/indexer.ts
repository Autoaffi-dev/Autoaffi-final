import { createClient } from "@supabase/supabase-js";

/**
 * BEAST v1.4
 * - Sources: digistore + mylead + warriorplus
 * - Upsert into public.product_index using (source, external_id)
 * - Never send "id" unless it is a uuid
 * - IMPORTANT: quality_score MUST NEVER be null (db NOT NULL)
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

  score?: number | null;

  // DB kräver NOT NULL -> vi skickar alltid number (default 0)
  quality_score: number;

  is_active?: boolean;
  winner_tier?: string | null;
  dead_reason?: string | null;

  geo_scope?: string | null;

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
};

function isUuid(v: unknown): v is string {
  if (typeof v !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function toIsoNow() {
  return new Date().toISOString();
}

function toFiniteNumberOrNull(v: any): number | null {
  if (v === undefined || v === null) return null;
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

// BEAST: quality_score får aldrig bli null
function toFiniteNumberOrDefault(v: any, fallback: number): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : fallback;
}

/**
 * IMPORTANT:
 * - Do NOT send id unless uuid.
 * - Must always have (source + external_id)
 * - We normalize common field variants from fetchers.
 * - quality_score MUST ALWAYS be a number (default 0)
 */
function normalizeRow(input: any, source: ProductIndexerSource): ProductIndexRow | null {
  const externalIdRaw =
    input?.external_id ??
    input?.externalId ??
    input?.product_id ??
    input?.productId ??
    input?.network_id ??
    input?.networkId ??
    input?.offer_id ??
    input?.offerId ??
    input?.id; // fallback for external_id ONLY

  const external_id = String(externalIdRaw ?? "").trim();
  if (!external_id) return null;

  const idCandidate = input?.id;
  const id = isUuid(idCandidate) ? idCandidate : undefined;

  const now = toIsoNow();

  const product_url = input?.product_url ?? input?.productUrl ?? input?.url ?? null;
  const landing_url = input?.landing_url ?? input?.landingUrl ?? input?.landing ?? null;

  // BEST: plocka kvalitet/score från flera möjliga fält + default 0
  const qualityRaw = input?.quality_score ?? input?.qualityScore ?? input?.score ?? input?.rating ?? 0;
  const quality_score = toFiniteNumberOrDefault(qualityRaw, 0);

  // score kan vara null i db (men vi försöker fylla)
  const scoreRaw = input?.score ?? input?.quality_score ?? input?.qualityScore ?? null;
  const score = toFiniteNumberOrNull(scoreRaw);

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

    epc: toFiniteNumberOrNull(input?.epc),
    commission: toFiniteNumberOrNull(input?.commission),
    currency: input?.currency ?? null,
    price: toFiniteNumberOrNull(input?.price),

    score,
    quality_score, // ✅ aldrig null

    geo_scope: input?.geo_scope ?? input?.geoScope ?? "worldwide",

    is_active: input?.is_active ?? true,
    winner_tier: input?.winner_tier ?? input?.winnerTier ?? null,
    dead_reason: input?.dead_reason ?? null,

    last_seen_at: input?.last_seen_at ?? now,
    updated_at: now,
  };

  return row;
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

/* ==========================================================
   ✅ MINIMAL PATCH: add searchProductIndex + RawProductRecord
   ========================================================== */

export type RawProductRecord = {
  id: string; // stable id for UI
  title: string;
  description: string | null;
  epc: number | null;
  category: string | null;
  url: string; // what discovery-engine expects as item.url
};

export async function searchProductIndex(args: {
  query: string;
  limit: number;
}): Promise<RawProductRecord[]> {
  const supabase = getSupabaseAdmin();

  const q = (args?.query || "").trim();
  const limit = Math.max(1, Math.min(args?.limit ?? 30, 200));

  let queryBuilder = supabase
    .from("product_index")
    .select("source,external_id,title,description,category,epc,product_url,landing_url,score,is_active")
    .eq("is_active", true)
    .limit(limit);

  if (q) {
    const like = `%${q}%`;
    queryBuilder = queryBuilder.or(`title.ilike.${like},description.ilike.${like},category.ilike.${like}`);
  }

  queryBuilder = queryBuilder.order("score", { ascending: false, nullsFirst: false });

  const { data, error } = await queryBuilder;
  if (error) throw new Error(error.message);

  const rows = (data || []) as any[];

  return rows
    .map((r) => {
      const url = String(r.product_url || r.landing_url || "").trim();
      if (!url) return null;

      return {
        id: `${r.source}:${r.external_id}`,
        title: r.title ?? "",
        description: r.description ?? null,
        epc: r.epc === undefined || r.epc === null ? null : Number(r.epc),
        category: r.category ?? null,
        url,
      } satisfies RawProductRecord;
    })
    .filter(Boolean) as RawProductRecord[];
}

export default runProductIndexer;