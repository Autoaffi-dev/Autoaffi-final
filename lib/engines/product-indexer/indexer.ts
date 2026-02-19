import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import type {
  ProductIndexerSource,
  ProductIndexRow,
  ProductIndexerReport,
  RawProductRecord,
} from "./types";

/**
 * BEAST FINAL (LOCKED)
 * - Sources: warriorplus (default) + awin + impact + (legacy)
 * - Upsert into public.product_index using (source, external_id)
 * - Never send "id" unless it is a uuid
 * - IMPORTANT: quality_score MUST NEVER be null (db NOT NULL)
 * - Includes winner_tier scoring + searchProductIndex exports
 *
 * + CANONICAL DEDUPE READY:
 *   canonical_url + canonical_hash + merchant_name/id + price_band
 *   so SQL winner-policy can dedupe across sources (WP + AWIN + CJ later)
 */

function isUuid(v: unknown): v is string {
  if (typeof v !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

function toIsoNow() {
  return new Date().toISOString();
}

function toFiniteNumberOrNull(v: any): number | null {
  if (v === undefined || v === null) return null;
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

// quality_score får aldrig bli null
function toFiniteNumberOrDefault(v: any, fallback: number): number {
  if (v === undefined || v === null) return fallback;
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : fallback;
}

/* ===========================
   CANONICAL (BEAST)
   =========================== */

function envBool(key: string, fallback: boolean) {
  const v = process.env[key];
  if (v === undefined) return fallback;
  return String(v).toLowerCase() === "true";
}

function sha1(input: string) {
  return crypto.createHash("sha1").update(input).digest("hex");
}

function normalizeUrlForCanonical(url: string) {
  const raw = String(url || "").trim();
  if (!raw) return "";

  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return raw.replace(/#.*$/, "").trim();
  }

  u.hash = "";

  // normalize host
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");

  // normalize path (strip trailing slash except root)
  if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, "");

  // drop known tracking params (keep only stable identifiers)
  const drop = new Set([
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "fbclid",
    "msclkid",
    "ttclid",
    "igshid",
    "ref",
    "ref_id",
    "refid",
    "aff",
    "affiliate",
    "affiliate_id",
    "affiliateid",
    "clickid",
    "subid",
    "sub_id",
    "sub1",
    "sub2",
    "sub3",
    "source",
    "src",
  ]);

  // For AWIN: keep ONLY product identity params if present, drop the rest
  // (AWIN deep links can be tracking-heavy)
  const keepIfPresent = new Set(["p", "product", "productid", "id", "pid", "sku"]);

  const params = new URLSearchParams(u.search);
  const out = new URLSearchParams();

  // strict mode means: if keepIfPresent exists, only keep those
  const strict = envBool("PRODUCT_INDEX_CANONICAL_STRICT", true);

  const hasKeep = Array.from(params.keys()).some((k) => keepIfPresent.has(k.toLowerCase()));

  for (const [k, v] of params.entries()) {
    const kk = k.toLowerCase();
    if (drop.has(kk)) continue;

    if (strict && hasKeep && !keepIfPresent.has(kk)) continue;

    out.append(kk, v);
  }

  // sort params for deterministic canonical
  const sorted = Array.from(out.entries()).sort(([a], [b]) => a.localeCompare(b));
  const finalParams = new URLSearchParams();
  for (const [k, v] of sorted) finalParams.append(k, v);

  u.search = finalParams.toString() ? `?${finalParams.toString()}` : "";
  return u.toString();
}

function computeCanonical(urlA: string | null, urlB: string | null) {
  const pick = String(urlA || urlB || "").trim();
  const canonical_url = pick ? normalizeUrlForCanonical(pick) : null;
  const canonical_hash = canonical_url ? sha1(canonical_url) : null;
  return { canonical_url, canonical_hash };
}

function parsePriceBandsEnv() {
  const v = (process.env.PRODUCT_INDEX_PRICE_BANDS || "20,100").trim();
  const [a, b] = v.split(",").map((x) => Number(x.trim()));
  const lowMax = Number.isFinite(a) ? a : 20;
  const midMax = Number.isFinite(b) ? b : 100;
  return { lowMax, midMax };
}

function getPriceBand(price: number | null) {
  const { lowMax, midMax } = parsePriceBandsEnv();
  if (price === null || !Number.isFinite(price)) return "mid";
  if (price <= lowMax) return "low";
  if (price <= midMax) return "mid";
  return "high";
}

/**
 * BEAST scoring:
 * - Deterministic quality_score (0..100), never null.
 * - winner_tier based on quality_score.
 */
function computeQualityScore(input: any): number {
  const epc = toFiniteNumberOrNull(input?.epc);
  const commission = toFiniteNumberOrNull(input?.commission);
  const price = toFiniteNumberOrNull(input?.price);

  const explicit =
    toFiniteNumberOrNull(input?.quality_score) ??
    toFiniteNumberOrNull(input?.qualityScore) ??
    toFiniteNumberOrNull(input?.score) ??
    toFiniteNumberOrNull(input?.rating);

  if (explicit !== null) return Math.max(0, Math.min(100, explicit));

  let q = 0;
  if (epc !== null) q += Math.max(0, Math.min(70, epc * 7));
  if (commission !== null) q += Math.max(0, Math.min(20, commission * 0.2));
  if (price !== null) q += Math.max(0, Math.min(10, price * 0.02));
  return Math.max(0, Math.min(100, Math.round(q)));
}

function computeWinnerTier(quality_score: number): string | null {
  if (quality_score >= 85) return "A";
  if (quality_score >= 70) return "B";
  if (quality_score >= 55) return "C";
  return null;
}

/**
 * IMPORTANT:
 * - Do NOT send id unless uuid.
 * - Must always have (source + external_id)
 * - quality_score ALWAYS number
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
    input?.id;

  const external_id = String(externalIdRaw ?? "").trim();
  if (!external_id) return null;

  const idCandidate = input?.id;
  const id = isUuid(idCandidate) ? idCandidate : undefined;

  const now = toIsoNow();

  // BEAST URL fallback:
  const product_url =
    input?.product_url ??
    input?.productUrl ??
    input?.url ??
    input?.deep_link ??
    input?.deepLink ??
    input?.aw_deep_link ??
    null;

  const landing_url =
    input?.landing_url ??
    input?.landingUrl ??
    input?.landing ??
    null;

  const image_url =
    input?.image_url ??
    input?.imageUrl ??
    input?.image ??
    input?.image_url_primary ??
    null;

  const is_approved =
    typeof input?.is_approved === "boolean"
      ? input.is_approved
      : typeof input?.approved === "boolean"
      ? input.approved
      : typeof input?.isApproved === "boolean"
      ? input.isApproved
      : true; // BEAST default true

  const quality_score = toFiniteNumberOrDefault(
    input?.quality_score ?? computeQualityScore(input),
    0
  );

  const scoreRaw =
    input?.score ??
    input?.quality_score ??
    input?.qualityScore ??
    input?.rating ??
    quality_score;

  const score = toFiniteNumberOrNull(scoreRaw) ?? quality_score;

  const winner_tier =
    input?.winner_tier ?? input?.winnerTier ?? computeWinnerTier(quality_score);

  // Merchant fields (used for caps)
  const merchant_name =
    input?.merchant_name ??
    input?.merchantName ??
    input?.vendor_name ??
    input?.vendorName ??
    input?.advertiser_name ??
    input?.merchant ??
    null;

  const merchant_id =
    input?.merchant_id ??
    input?.merchantId ??
    input?.vendor_id ??
    input?.vendorId ??
    input?.advertiser_id ??
    null;

  // Price band (used for category+band cap)
  const priceNum = toFiniteNumberOrNull(input?.price);
  const price_band = input?.price_band ?? input?.priceBand ?? getPriceBand(priceNum);

  // Canonical (for cross-source dedupe)
  const { canonical_url, canonical_hash } = computeCanonical(
    product_url ? String(product_url) : null,
    landing_url ? String(landing_url) : null
  );

  const row: ProductIndexRow = {
    ...(id ? { id } : {}),

    source,
    external_id,

    title:
      input?.title ??
      input?.name ??
      input?.product_title ??
      input?.product_name ??
      null,

    description: input?.description ?? input?.desc ?? null,
    category: input?.category ?? input?.merchant_category ?? null,

    product_url: product_url ? String(product_url) : null,
    landing_url: landing_url ? String(landing_url) : null,
    image_url: image_url ? String(image_url) : null,

    epc: toFiniteNumberOrNull(input?.epc),
    commission: toFiniteNumberOrNull(input?.commission),
    currency: input?.currency ?? null,
    price: priceNum,

    merchant_name: merchant_name ? String(merchant_name) : null,
    merchant_id: merchant_id ? String(merchant_id) : null,

    canonical_url,
    canonical_hash,
    price_band: price_band ? String(price_band) : null,

    score,
    quality_score,

    is_approved,
    winner_tier,
    geo_scope: input?.geo_scope ?? input?.geoScope ?? "worldwide",

    is_active: typeof input?.is_active === "boolean" ? input.is_active : true,
    dead_reason: input?.dead_reason ?? null,

    last_seen_at: input?.last_seen_at ?? now,
    updated_at: now,
  };

  return row;
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE env vars (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)."
    );
  }

  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

async function loadFetcher(source: ProductIndexerSource) {
  const map: Record<ProductIndexerSource, string> = {
    digistore: "./fetch-digistore",
    mylead: "./fetch-mylead",
    warriorplus: "./fetch-warriorplus",
    impact: "./fetch-impact",
    awin: "./fetch-awin",
  };

  const mod: any = await import(map[source]);

  const candidates: any[] = [
    mod?.fetchProducts,
    mod?.fetchProductIndex,

    mod?.fetchDigistore,
    mod?.fetchMylead,
    mod?.fetchWarriorplus,
    mod?.fetchImpact,
    mod?.fetchAwin,

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
    throw new Error(
      `Fetcher for "${source}" not found (no function export in ${map[source]}).`
    );
  }

  return fn as (args: { limit: number }) => Promise<any[]>;
}

async function applyWinnerPolicyIfEnabled() {
  const enabled = envBool("PRODUCT_INDEX_GLOBAL_WINNERS", false);
  if (!enabled) return null;

  const supabase = getSupabaseAdmin();

  const p_source_cap = Number(process.env.PRODUCT_INDEX_SOURCE_CAP || 800);
  const p_category_cap = Number(process.env.PRODUCT_INDEX_CATEGORY_CAP || 250);
  const p_merchant_cap = Number(process.env.PRODUCT_INDEX_MERCHANT_CAP || 35);
  const p_merchant_category_cap = Number(process.env.PRODUCT_INDEX_MERCHANT_CATEGORY_CAP || 12);
  const p_category_band_cap = Number(process.env.PRODUCT_INDEX_CATEGORY_BAND_CAP || 120);

  const { data, error } = await supabase.rpc("product_index_apply_winner_policy", {
    p_source_cap,
    p_category_cap,
    p_merchant_cap,
    p_merchant_category_cap,
    p_category_band_cap,
  } as any);

  if (error) throw new Error(`winner_policy rpc failed: ${error.message}`);
  return data ?? null;
}

export async function runProductIndexer(args?: {
  sources?: ProductIndexerSource[];
  limit?: number;
}): Promise<ProductIndexerReport> {
  const started = Date.now();
  const triggeredAt = toIsoNow();

  const sources: ProductIndexerSource[] = args?.sources ?? ["warriorplus"];
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
      impact: { fetched: 0, normalized: 0, upserted: 0, skipped: 0, errors: [] },
      awin: { fetched: 0, normalized: 0, upserted: 0, skipped: 0, errors: [] },
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

  // After upserts: apply global winner policy (dedupe+caps)
  try {
    const rpcRes = await applyWinnerPolicyIfEnabled();
    (report as any).winnerPolicy = rpcRes;
  } catch (e: any) {
    report.ok = false;
    (report as any).winnerPolicyError = e?.message ?? String(e);
  }

  report.tookMs = Date.now() - started;
  return report;
}

/* ==========================================================
   ✅ REQUIRED BY product-discovery-engine.ts
   ========================================================== */

export async function searchProductIndex(args: {
  query: string;
  limit: number;
  geo_scope?: string;
  approvedOnly?: boolean;
}): Promise<RawProductRecord[]> {
  const supabase = getSupabaseAdmin();

  const q = (args?.query || "").trim();
  const limit = Math.max(1, Math.min(args?.limit ?? 30, 200));
  const geo = (args?.geo_scope || "").trim();
  const approvedOnly = args?.approvedOnly !== false;

  let qb = supabase
    .from("product_index")
    .select(
      "source,external_id,title,description,category,epc,product_url,landing_url,score,is_active,geo_scope,is_approved"
    )
    .eq("is_active", true)
    .limit(limit);

  if (approvedOnly) qb = qb.eq("is_approved", true);
  if (geo) qb = qb.eq("geo_scope", geo);

  if (q) {
    const like = `%${q}%`;
    qb = qb.or(`title.ilike.${like},description.ilike.${like},category.ilike.${like}`);
  }

  qb = qb.order("score", { ascending: false, nullsFirst: false });

  const { data, error } = await qb;
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