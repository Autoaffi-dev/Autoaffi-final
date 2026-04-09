import crypto from "crypto";

/**
 * CJ (GraphQL) → Autoaffi Indexed Products
 * Endpoint: https://ads.api.cj.com/query
 * Auth: Authorization: Bearer <CJ_PAT>
 *
 * BEAST MODE:
 * - Auto-detect schema (productFeed vs products)
 * - Auto-resolve companyId (viewer/me) if CJ_COMPANY_ID not set
 * - Schema-B: partnerIds + keywords:[String!] + page:String
 * - Handles price as object (price { amount currency })
 * - ✅ Auto-detect a usable deep-link field (mobileLink is often null)
 * - ✅ FIX paging: CJ "page" cursor format differs; avoid "Invalid page format" by stopping after first page
 *   (still gives you 100+ CJ products per run; later we can implement true cursor once CJ exposes it for your account)
 */

export type CjIndexedProduct = {
  source: "cj";
  external_id: string;

  title: string;
  description?: string | null;

  merchant_name?: string | null;
  merchant_id?: string | null;

  category?: string | null;

  image_url?: string | null;
  deep_link?: string | null;

  price?: number | null;
  currency?: string | null;

  last_updated?: string | null;

  quality_score: number;
  score: number;
  winner_tier?: "A" | "B" | "C" | null;

  geo_scope?: string;
  is_active?: boolean;
  is_approved?: boolean;

  raw?: Record<string, any>;
};

type FetchCjOptions = {
  endpoint?: string;
  pat?: string;

  maxItems?: number;
  pageSize?: number;
  timeoutMs?: number;

  keywords?: string;
  advertiserIds?: string[]; // schema-B uses partnerIds (we reuse this list)

  winnersOnly?: boolean;
  maxPerMerchant?: number;
  maxPerMerchantCategory?: number;
  maxPerCategory?: number;
  minDescriptionLen?: number;
  requireImage?: boolean;
  minPrice?: number;
  maxAgeDays?: number;

  categoryDepth?: 1 | 2 | 3;

  requireAllowlist?: boolean;
  allowlist?: Set<string>;

  gqlQueryOverride?: string;
  companyId?: string;
};

const DEFAULT_TIMEOUT = 45_000;
const DEFAULT_MAX_ITEMS = 1500;
const DEFAULT_PAGE_SIZE = 100;

const DEFAULT_WINNERS_ONLY = true;
const DEFAULT_MAX_PER_MERCHANT = 35;
const DEFAULT_MAX_PER_MERCHANT_CATEGORY = 12;
const DEFAULT_MAX_PER_CATEGORY = 250;
const DEFAULT_MIN_DESC = 60;
const DEFAULT_REQUIRE_IMAGE = true;
const DEFAULT_MIN_PRICE = 0;
const DEFAULT_CATEGORY_DEPTH: 1 | 2 | 3 = 2;

const DEBUG = (process.env.CJ_DEBUG || "").toLowerCase() === "true";

/**
 * Schema A (some accounts): productFeed(...)
 */
const GQL_PRODUCT_FEED = `
query ProductFeedSearch($advertiserIds: [String!], $keywords: String, $page: Int!, $limit: Int!) {
  productFeed(
    forAdvertisers: $advertiserIds,
    keywords: $keywords,
    pageNumber: $page,
    pageSize: $limit
  ) {
    totalCount
    resultList {
      advertiserId
      advertiserName

      productId
      sku
      productName
      description
      productCategory

      imageUrl
      buyUrl

      price
      currency

      lastUpdated
    }
  }
}
`;

/**
 * Schema B (products) query template.
 * We inject the chosen deepLinkField into the selection to avoid schema validation errors.
 */
function buildGqlProducts(deepLinkField: string) {
  return `
query Products(
  $companyId: ID!,
  $partnerIds: [ID!],
  $keywords: [String!],
  $page: String,
  $limit: Int!
) {
  products(
    companyId: $companyId,
    partnerIds: $partnerIds,
    keywords: $keywords,
    page: $page,
    limit: $limit
  ) {
    totalCount
    resultList {
      advertiserId
      advertiserName

      id
      description

      imageLink
      ${deepLinkField}

      price { amount currency }
      lastUpdated
    }
  }
}
`;
}

/**
 * Auto-resolve companyId
 */
const GQL_VIEWER_COMPANY = `query Viewer { viewer { companyId } }`;
const GQL_ME_COMPANY = `query Me { me { companyId } }`;

export async function fetchCj(opts: FetchCjOptions = {}): Promise<CjIndexedProduct[]> {
  const endpoint = opts.endpoint || process.env.CJ_GRAPHQL_ENDPOINT || "https://ads.api.cj.com/query";
  const pat = opts.pat || process.env.CJ_PAT || "";

  if (!pat) {
    throw new Error("CJ_PAT missing. Create a Personal Access Token in CJ Developer Portal and set CJ_PAT.");
  }

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT;

  const maxItems =
    opts.maxItems ?? (process.env.CJ_WINNERS_MAX_TOTAL ? Number(process.env.CJ_WINNERS_MAX_TOTAL) : DEFAULT_MAX_ITEMS);

  const pageSize = Math.max(10, Math.min(200, opts.pageSize ?? DEFAULT_PAGE_SIZE));

  const winnersOnly =
    opts.winnersOnly ?? (process.env.CJ_WINNERS_ONLY ? process.env.CJ_WINNERS_ONLY === "true" : DEFAULT_WINNERS_ONLY);

  const maxPerMerchant =
    opts.maxPerMerchant ??
    (process.env.CJ_WINNERS_PER_MERCHANT ? Number(process.env.CJ_WINNERS_PER_MERCHANT) : DEFAULT_MAX_PER_MERCHANT);

  const maxPerMerchantCategory =
    opts.maxPerMerchantCategory ??
    (process.env.CJ_WINNERS_PER_MERCHANT_CATEGORY
      ? Number(process.env.CJ_WINNERS_PER_MERCHANT_CATEGORY)
      : DEFAULT_MAX_PER_MERCHANT_CATEGORY);

  const maxPerCategory =
    opts.maxPerCategory ?? (process.env.CJ_WINNERS_PER_CATEGORY ? Number(process.env.CJ_WINNERS_PER_CATEGORY) : DEFAULT_MAX_PER_CATEGORY);

  const minDescriptionLen =
    opts.minDescriptionLen ?? (process.env.CJ_MIN_DESC_LEN ? Number(process.env.CJ_MIN_DESC_LEN) : DEFAULT_MIN_DESC);

  const requireImage =
    opts.requireImage ?? (process.env.CJ_REQUIRE_IMAGE ? process.env.CJ_REQUIRE_IMAGE === "true" : DEFAULT_REQUIRE_IMAGE);

  const minPrice = opts.minPrice ?? (process.env.CJ_MIN_PRICE ? Number(process.env.CJ_MIN_PRICE) : DEFAULT_MIN_PRICE);

  const maxAgeDays = opts.maxAgeDays ?? (process.env.CJ_MAX_AGE_DAYS ? Number(process.env.CJ_MAX_AGE_DAYS) : 3650);

  const categoryDepth =
    opts.categoryDepth ??
    (process.env.CJ_CATEGORY_DEPTH
      ? (Math.max(1, Math.min(3, Number(process.env.CJ_CATEGORY_DEPTH))) as 1 | 2 | 3)
      : DEFAULT_CATEGORY_DEPTH);

  const requireAllowlist =
    opts.requireAllowlist ?? (process.env.CJ_REQUIRE_ALLOWLIST ? process.env.CJ_REQUIRE_ALLOWLIST === "true" : false);

  const allowlistSet =
    opts.allowlist ??
    new Set(
      String(process.env.CJ_SUBNETWORK_ALLOWLIST || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    );

  const primaryBuckets = new Map<string, CjIndexedProduct[]>();
  const globalSeen = new Set<string>();

  const schemaMode = await detectSchemaMode({ endpoint, pat, timeoutMs });

  let companyId = opts.companyId || process.env.CJ_COMPANY_ID || "";
  if (schemaMode === "products" && !companyId) {
    companyId = await resolveCompanyId({ endpoint, pat, timeoutMs });
  }

  // ✅ pick a deep link field that actually exists and returns URLs
  let deepLinkField = "mobileLink";
  if (schemaMode === "products") {
    deepLinkField = await detectDeepLinkField({
      endpoint,
      pat,
      timeoutMs,
      companyId,
      partnerIds: opts.advertiserIds?.length ? opts.advertiserIds : null,
    });
  }

  if (DEBUG) {
    console.log("[CJ] schemaMode:", schemaMode);
    console.log("[CJ] companyId:", companyId ? "(set)" : "(missing)");
    console.log("[CJ] deepLinkField:", deepLinkField);
    console.log("[CJ] requireAllowlist:", requireAllowlist, "allowlist_size:", allowlistSet.size);
  }

  const hardStopPages = 50;
  let pageNum = 1;
  let pageCursor: string | null = null;

  while (pageNum <= hardStopPages) {
    const query =
      opts.gqlQueryOverride || (schemaMode === "productFeed" ? GQL_PRODUCT_FEED : buildGqlProducts(deepLinkField));

    const variables =
      schemaMode === "productFeed"
        ? {
            advertiserIds: opts.advertiserIds?.length ? opts.advertiserIds : null,
            keywords: opts.keywords || null,
            page: pageNum,
            limit: pageSize,
          }
        : {
            companyId: companyId || null,
            partnerIds: opts.advertiserIds?.length ? opts.advertiserIds : null,
            keywords: opts.keywords ? [opts.keywords] : null,
            page: pageCursor,
            limit: pageSize,
          };

    if (schemaMode === "products" && !variables.companyId) {
      throw new Error(
        "CJ_COMPANY_ID missing (schema requires companyId). Set CJ_COMPANY_ID in .env.local OR keep CJ_PAT valid so auto-resolve can work."
      );
    }

    // ✅ Fail-safe: if CJ rejects page format, stop paging (keep what we got)
    let data: any;
    try {
      data = await cjGraphql({
        endpoint,
        pat,
        timeoutMs,
        query,
        variables,
      });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg.includes("Invalid page format")) {
        if (DEBUG) console.log("[CJ] paging stopped:", msg);
        break;
      }
      throw e;
    }

    const { items, total } = pickProductsFromResponse(data);

    if (DEBUG && pageNum === 1) {
      console.log("[CJ] total:", total, "items:", items.length);
      console.log("[CJ] sampleKeys:", items[0] ? Object.keys(items[0]) : []);
      console.log("[CJ] sampleRow:", items[0] ? safeJson(items[0]).slice(0, 900) : "none");
    }

    if (!items.length) break;

    for (const raw of items) {
      const mapped = mapCjRow(raw, deepLinkField);
      if (!mapped) continue;

      if (requireAllowlist) {
        const adv = String(mapped.merchant_id || "").trim();
        if (!adv) continue;
        if (!allowlistSet.has(adv)) {
          mapped.is_approved = false;
          continue;
        }
      }

      if (!mapped.title || mapped.title.length < 2) continue;
      if (!mapped.deep_link) continue;
      if (requireImage && !mapped.image_url) continue;

      if (minDescriptionLen > 0) {
        const d = (mapped.description || "").trim();
        if (d.length < minDescriptionLen) continue;
      }

      if (minPrice > 0 && (mapped.price ?? 0) < minPrice) continue;

      if (maxAgeDays && mapped.last_updated) {
        const t = new Date(mapped.last_updated).getTime();
        if (Number.isFinite(t)) {
          const ageDays = (Date.now() - t) / (1000 * 60 * 60 * 24);
          if (ageDays > maxAgeDays) continue;
        }
      }

      const pid = String((raw as any).productId || (raw as any).product_id || (raw as any).id || "").trim();
      const sku = String((raw as any).sku || (raw as any).SKU || "").trim();
      const advId = String(mapped.merchant_id || "unknown").trim();
      const deep = normalizeUrlForId(mapped.deep_link || "");
      const externalId = pid ? `cj_${advId}_${pid}` : sku ? `cj_${advId}_${sku}` : `cj_${advId}_${sha1(deep)}`;

      if (globalSeen.has(externalId)) continue;
      globalSeen.add(externalId);
      mapped.external_id = externalId;

      const catNorm = normalizeCategory(mapped.category || "uncategorized", categoryDepth);
      mapped.category = catNorm.label || mapped.category;

      const q = computeQualityScore(mapped);
      mapped.quality_score = q;
      mapped.score = q;
      mapped.winner_tier = q >= 85 ? "A" : q >= 70 ? "B" : q >= 55 ? "C" : null;

      mapped.is_active = true;
      mapped.is_approved = true;
      mapped.geo_scope = "worldwide";

      if (!winnersOnly) {
        insertTopK(primaryBuckets, "__all__", mapped, maxItems);
        continue;
      }

      const merchantKey = normalizeKey(mapped.merchant_name || mapped.merchant_id || "unknown");
      const primaryKey = `${merchantKey}::${catNorm.key}`;
      insertTopK(primaryBuckets, primaryKey, mapped, maxPerMerchantCategory);
    }

    const collected = totalBucketCount(primaryBuckets, winnersOnly);
    if (collected >= maxItems) break;

    if (schemaMode === "products") {
      // ✅ CJ page cursor format varies. Avoid invalid page format errors by stopping after page 1.
      break;
    }

    pageNum++;
  }

  if (!winnersOnly) {
    const rawAll = primaryBuckets.get("__all__") || [];
    return rawAll
      .slice()
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, maxItems);
  }

  let candidates: CjIndexedProduct[] = [];
  for (const [k, arr] of primaryBuckets.entries()) {
    if (k === "__all__") continue;
    candidates = candidates.concat(arr);
  }

  candidates.sort((a, b) => {
    if ((b.score ?? 0) !== (a.score ?? 0)) return (b.score ?? 0) - (a.score ?? 0);
    return (a.title || "").localeCompare(b.title || "");
  });

  const merchantCount = new Map<string, number>();
  const categoryCount = new Map<string, number>();
  const primaryCount = new Map<string, number>();

  const winners: CjIndexedProduct[] = [];

  for (const p of candidates) {
    if (winners.length >= maxItems) break;

    const merchantKey = normalizeKey(p.merchant_name || p.merchant_id || "unknown");
    const catNorm = normalizeCategory(p.category || "uncategorized", categoryDepth);
    const categoryKey = catNorm.key;
    const primaryKey = `${merchantKey}::${categoryKey}`;

    const mC = merchantCount.get(merchantKey) ?? 0;
    if (mC >= maxPerMerchant) continue;

    const cC = categoryCount.get(categoryKey) ?? 0;
    if (cC >= maxPerCategory) continue;

    const pC = primaryCount.get(primaryKey) ?? 0;
    if (pC >= maxPerMerchantCategory) continue;

    merchantCount.set(merchantKey, mC + 1);
    categoryCount.set(categoryKey, cC + 1);
    primaryCount.set(primaryKey, pC + 1);

    p.category = catNorm.label || p.category;
    winners.push(p);
  }

  return winners;
}

/* ----------------------------- Schema detection ----------------------------- */

async function detectSchemaMode(args: { endpoint: string; pat: string; timeoutMs: number }): Promise<"productFeed" | "products"> {
  try {
    await cjGraphql({
      endpoint: args.endpoint,
      pat: args.pat,
      timeoutMs: args.timeoutMs,
      query: `query _Test($page:Int!, $limit:Int!){ productFeed(pageNumber:$page,pageSize:$limit){ totalCount } }`,
      variables: { page: 1, limit: 1 },
    });
    return "productFeed";
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (msg.includes("Cannot query field") && msg.includes("productFeed")) return "products";
    if (msg.includes("403") || msg.toLowerCase().includes("authenticate")) throw e;
    return "products";
  }
}

async function resolveCompanyId(args: { endpoint: string; pat: string; timeoutMs: number }): Promise<string> {
  const tryQueries = [GQL_VIEWER_COMPANY, GQL_ME_COMPANY];
  for (const q of tryQueries) {
    try {
      const data = await cjGraphql({
        endpoint: args.endpoint,
        pat: args.pat,
        timeoutMs: args.timeoutMs,
        query: q,
        variables: {},
      });
      const cid = (data as any)?.viewer?.companyId || (data as any)?.me?.companyId || null;
      if (cid) return String(cid);
    } catch {
      // ignore
    }
  }
  return "";
}

/**
 * Detect a deep link field that:
 * - exists in schema
 * - returns a non-null URL for at least one item
 */
async function detectDeepLinkField(args: {
  endpoint: string;
  pat: string;
  timeoutMs: number;
  companyId: string;
  partnerIds: string[] | null;
}) {
  const candidates = ["mobileLink", "link", "buyLink", "productLink", "destinationUrl", "url"];

  for (const field of candidates) {
    const q = buildGqlProducts(field);
    try {
      const data = await cjGraphql({
        endpoint: args.endpoint,
        pat: args.pat,
        timeoutMs: args.timeoutMs,
        query: q,
        variables: {
          companyId: args.companyId,
          partnerIds: args.partnerIds,
          keywords: null,
          page: null,
          limit: 25,
        },
      });

      const { items } = pickProductsFromResponse(data);
      if (!items.length) continue;

      const hasUrl = items.some((it: any) => {
        const v = it?.[field];
        return typeof v === "string" && v.trim().length > 10;
      });

      if (DEBUG) {
        console.log("[CJ] deepLink probe:", field, "items:", items.length, "hasUrl:", hasUrl);
      }

      if (hasUrl) return field;
    } catch (e: any) {
      if (DEBUG) console.log("[CJ] deepLink probe failed:", field, String(e?.message || e));
      continue;
    }
  }

  return "mobileLink";
}

/* ----------------------------- GraphQL caller ----------------------------- */

async function cjGraphql(args: { endpoint: string; pat: string; timeoutMs: number; query: string; variables: any }) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), args.timeoutMs);

  try {
    const res = await fetch(args.endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${args.pat}`,
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": "Autoaffi/1.0 (CJ Fetcher)",
      },
      body: JSON.stringify({
        query: args.query,
        variables: args.variables,
      }),
    } as any);

    const text = await res.text().catch(() => "");
    const json = text
      ? (() => {
          try {
            return JSON.parse(text);
          } catch {
            return null;
          }
        })()
      : null;

    if (!res.ok) {
      throw new Error(`CJ GraphQL failed: ${res.status} ${res.statusText} :: ${text || safeJson(json)}`);
    }

    if ((json as any)?.errors?.length) {
      throw new Error(`CJ GraphQL errors: ${safeJson((json as any).errors)}`);
    }

    return (json as any)?.data ?? json;
  } finally {
    clearTimeout(t);
  }
}

/* ----------------------------- Response picking ----------------------------- */

function pickProductsFromResponse(data: any): { items: any[]; total: number } {
  const pf = data?.productFeed;
  if (pf && Array.isArray(pf.resultList)) {
    return { items: pf.resultList, total: Number(pf.totalCount ?? pf.total ?? pf.count ?? pf.resultList.length) };
  }

  const pr = data?.products;
  if (pr && Array.isArray(pr.resultList)) {
    return { items: pr.resultList, total: Number(pr.totalCount ?? pr.total ?? pr.count ?? pr.resultList.length) };
  }

  const ps = data?.productSearch;
  if (ps) {
    const arr = ps.products || ps.resultList || ps.items || [];
    if (Array.isArray(arr)) {
      return { items: arr, total: Number(ps.totalCount ?? ps.total ?? ps.count ?? arr.length) };
    }
  }

  return { items: [], total: 0 };
}

/* ----------------------------- Mapping ----------------------------- */

function mapCjRow(row: Record<string, any>, deepLinkField: string): CjIndexedProduct | null {
  const title = String(row.productName || row.product_name || row.name || row.title || row.id || "CJ Product").trim();
  const description = (row.description ?? row.longDescription ?? row.shortDescription ?? null) as string | null;

  const advertiserId =
    String(row.advertiserId || row.partnerId || row.advertiser_id || row.companyId || row.cid || "").trim() || null;

  const advertiserName =
    String(row.advertiserName || row.partnerName || row.advertiser_name || row.merchantName || "").trim() || null;

  const category = (row.productCategory || row.category || row.categoryName || null) as string | null;

  const image = String(row.imageUrl || row.image_url || row.imageLink || row.image_link || "").trim() || null;

  const deepLinkRaw =
    (typeof row?.[deepLinkField] === "string" ? row[deepLinkField] : null) ||
    String(row.buyUrl || row.buy_url || row.buyLink || row.mobileLink || row.productUrl || row.deepLink || "").trim() ||
    null;

  const { price, currency } = parsePriceAndCurrency(row.price, row.currency || row.currencyCode);
  const lastUpdatedIso = toIsoDate(row.lastUpdated || row.last_updated || row.updatedAt || "");

  if (!title) return null;

  return {
    source: "cj",
    external_id: "",

    title,
    description,

    merchant_name: advertiserName,
    merchant_id: advertiserId,

    category,

    image_url: image,
    deep_link: deepLinkRaw,

    price,
    currency,

    last_updated: lastUpdatedIso,

    quality_score: 0,
    score: 0,
    winner_tier: null,

    geo_scope: "worldwide",
    is_active: true,
    is_approved: true,

    raw: row,
  };
}

/* ----------------------------- Scoring + helpers ----------------------------- */

function computeQualityScore(p: CjIndexedProduct): number {
  let q = 0;

  const hasImg = !!(p.image_url && p.image_url.length > 6);
  const descLen = (p.description || "").trim().length;
  const hasPrice = typeof p.price === "number" && Number.isFinite(p.price) && p.price > 0;
  const hasMerchant = !!(p.merchant_name || p.merchant_id);
  const hasCategory = !!(p.category && p.category.length > 2);

  if (hasImg) q += 30;
  if (descLen >= 60) q += 20;
  if (descLen >= 140) q += 10;
  if (hasPrice) q += 20;
  if (hasMerchant) q += 10;
  if (hasCategory) q += 10;

  if (p.last_updated) {
    const t = new Date(p.last_updated).getTime();
    if (Number.isFinite(t)) {
      const ageDays = (Date.now() - t) / (1000 * 60 * 60 * 24);
      if (ageDays < 30) q += 8;
      else if (ageDays < 90) q += 5;
      else if (ageDays < 180) q += 2;
    }
  }

  return Math.max(0, Math.min(100, Math.round(q)));
}

function insertTopK(buckets: Map<string, CjIndexedProduct[]>, key: string, item: CjIndexedProduct, k: number) {
  const kk = Math.max(1, Number.isFinite(k) ? k : 1);
  const arr = buckets.get(key) || [];

  const s = item.score ?? 0;
  let i = 0;
  while (i < arr.length && (arr[i].score ?? 0) >= s) i++;
  arr.splice(i, 0, item);

  if (arr.length > kk) arr.length = kk;
  buckets.set(key, arr);
}

function totalBucketCount(buckets: Map<string, CjIndexedProduct[]>, winnersOnly: boolean) {
  if (!winnersOnly) return (buckets.get("__all__") || []).length;
  let n = 0;
  for (const [k, arr] of buckets.entries()) {
    if (k === "__all__") continue;
    n += arr.length;
  }
  return n;
}

function normalizeKey(v: string) {
  const s = String(v || "").trim().toLowerCase();
  return s || "unknown";
}

function normalizeUrlForId(url: string) {
  const u = String(url || "").trim();
  if (!u) return "";
  return u.replace(/#.*$/, "");
}

function sha1(input: string) {
  return crypto.createHash("sha1").update(input).digest("hex");
}

function parsePriceAndCurrency(priceField: any, currencyField: any): { price: number | null; currency: string | null } {
  if (priceField && typeof priceField === "object") {
    const amount = priceField.amount ?? priceField.value ?? priceField.price ?? null;
    const c = priceField.currency ?? currencyField ?? null;
    return { price: parsePrice(amount), currency: c ? String(c).trim() : null };
  }
  return { price: parsePrice(priceField), currency: currencyField ? String(currencyField).trim() : null };
}

function parsePrice(v: any): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;

  const s = String(v).replace(/\s/g, "").replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function toIsoDate(v: any): string | null {
  if (!v) return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/* ----------------------------- CATEGORY NORMALIZE ----------------------------- */

function normalizeCategory(input: string, depth: 1 | 2 | 3 = 2): { key: string; label: string | null } {
  const raw = String(input || "").trim();
  if (!raw) return { key: "uncategorized", label: "Uncategorized" };

  const normalized = raw
    .replace(/\s+/g, " ")
    .replace(/&gt;|›|»|→/g, ">")
    .replace(/::/g, ">")
    .replace(/[|\\/]/g, ">")
    .replace(/\s*>\s*/g, ">")
    .trim();

  const parts = normalized
    .split(">")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 0) return { key: "uncategorized", label: "Uncategorized" };

  const take = Math.max(1, Math.min(depth, 3));
  const picked = parts.slice(0, take);

  const label = picked.map((p) => titleish(p)).join(" / ");
  const key = picked
    .map((p) => p.toLowerCase())
    .join(" / ")
    .replace(/[^\p{L}\p{N}\s\/-]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  return { key: key || "uncategorized", label: label || null };
}

function titleish(s: string) {
  if (!s) return s;
  if (s.toUpperCase() === s && s.length <= 6) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function safeJson(v: any) {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export default fetchCj;