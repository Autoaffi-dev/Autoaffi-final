import crypto from "crypto";

export type AliExpressIndexedProduct = {
  source: "aliexpress";
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

type FetchAliExpressOptions = {
  apiUrl?: string;
  appKey?: string;
  appSecret?: string;

  appSignature?: string | null;
  trackingId?: string | null;

  maxItems?: number;
  pageSize?: number;
  timeoutMs?: number;
  maxPagesPerKeyword?: number;

  keywords?: string[];
  categoryIds?: string[];

  targetCurrency?: string | null;
  targetLanguage?: string | null;
  shipToCountry?: string | null;
  platformProductType?: "ALL" | "PLAZA" | "TMALL";
  sort?: "SALE_PRICE_ASC" | "SALE_PRICE_DESC" | "LAST_VOLUME_ASC" | "LAST_VOLUME_DESC";

  winnersOnly?: boolean;
  maxPerMerchant?: number;
  maxPerMerchantCategory?: number;
  maxPerCategory?: number;
  minDescriptionLen?: number;
  requireImage?: boolean;
  minPrice?: number;
  maxAgeDays?: number;
  categoryDepth?: 1 | 2 | 3;
};

const DEFAULT_TIMEOUT = 45_000;
const DEFAULT_MAX_ITEMS = 1500;
const DEFAULT_PAGE_SIZE = 20; // matcha Explorer först
const DEFAULT_MAX_PAGES_PER_KEYWORD = 3;

const DEFAULT_WINNERS_ONLY = true;
const DEFAULT_MAX_PER_MERCHANT = 35;
const DEFAULT_MAX_PER_MERCHANT_CATEGORY = 12;
const DEFAULT_MAX_PER_CATEGORY = 250;
const DEFAULT_MIN_DESC = 20;
const DEFAULT_REQUIRE_IMAGE = true;
const DEFAULT_MIN_PRICE = 0;
const DEFAULT_CATEGORY_DEPTH: 1 | 2 | 3 = 2;

const DEBUG = (process.env.ALIEXPRESS_DEBUG || "").toLowerCase() === "true";

const METHOD_PRODUCT_QUERY = "aliexpress.affiliate.product.query";

/**
 * Håll fields nära det som redan fungerade i Explorer.
 * När allt rullar kan vi lägga tillbaka fler fields.
 */
const DEFAULT_FIELDS = [
  "product_id",
  "product_title",
  "product_detail_url",
  "promotion_link",
  "product_main_image_url",
  "product_small_image_urls",
  "sale_price",
  "sale_price_currency",
  "target_sale_price",
  "target_sale_price_currency",
  "target_app_sale_price",
  "target_app_sale_price_currency",
  "evaluate_rate",
  "commission_rate",
  "discount",
  "shop_name",
  "shop_id",
  "first_level_category_name",
  "second_level_category_name",
  "lastest_volume",
].join(",");

export async function fetchAliexpress(
  opts: FetchAliExpressOptions = {}
): Promise<AliExpressIndexedProduct[]> {
  const apiUrl =
    opts.apiUrl ||
    process.env.ALIEXPRESS_API_URL ||
    "https://api-sg.aliexpress.com/sync";

  const appKey = opts.appKey || process.env.ALIEXPRESS_APP_KEY || "";
  const appSecret = opts.appSecret || process.env.ALIEXPRESS_APP_SECRET || "";

  if (!appKey || !appSecret) {
    throw new Error(
      "AliExpress credentials missing. Set ALIEXPRESS_APP_KEY and ALIEXPRESS_APP_SECRET."
    );
  }

  /**
   * VIKTIGT:
   * Sätt samma case som i Explorer-testet som gav 200.
   * Ditt fungerande anrop visade app_signature=Autoaffi
   */
  const appSignature =
    opts.appSignature ??
    (process.env.ALIEXPRESS_APP_SIGNATURE
      ? process.env.ALIEXPRESS_APP_SIGNATURE
      : "Autoaffi");

  const trackingId =
    opts.trackingId ??
    (process.env.ALIEXPRESS_TRACKING_ID
      ? process.env.ALIEXPRESS_TRACKING_ID
      : "Autoaffi");

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT;

  const maxItems =
    opts.maxItems ??
    (process.env.ALIEXPRESS_WINNERS_MAX_TOTAL
      ? Number(process.env.ALIEXPRESS_WINNERS_MAX_TOTAL)
      : DEFAULT_MAX_ITEMS);

  const pageSize = Math.max(
    1,
    Math.min(
      50,
      opts.pageSize ??
        (process.env.ALIEXPRESS_PAGE_SIZE
          ? Number(process.env.ALIEXPRESS_PAGE_SIZE)
          : DEFAULT_PAGE_SIZE)
    )
  );

  const maxPagesPerKeyword = Math.max(
    1,
    Math.min(
      20,
      opts.maxPagesPerKeyword ??
        (process.env.ALIEXPRESS_MAX_PAGES_PER_KEYWORD
          ? Number(process.env.ALIEXPRESS_MAX_PAGES_PER_KEYWORD)
          : DEFAULT_MAX_PAGES_PER_KEYWORD)
    )
  );

  const winnersOnly =
    opts.winnersOnly ??
    (process.env.ALIEXPRESS_WINNERS_ONLY
      ? process.env.ALIEXPRESS_WINNERS_ONLY === "true"
      : DEFAULT_WINNERS_ONLY);

  const maxPerMerchant =
    opts.maxPerMerchant ??
    (process.env.ALIEXPRESS_WINNERS_PER_MERCHANT
      ? Number(process.env.ALIEXPRESS_WINNERS_PER_MERCHANT)
      : DEFAULT_MAX_PER_MERCHANT);

  const maxPerMerchantCategory =
    opts.maxPerMerchantCategory ??
    (process.env.ALIEXPRESS_WINNERS_PER_MERCHANT_CATEGORY
      ? Number(process.env.ALIEXPRESS_WINNERS_PER_MERCHANT_CATEGORY)
      : DEFAULT_MAX_PER_MERCHANT_CATEGORY);

  const maxPerCategory =
    opts.maxPerCategory ??
    (process.env.ALIEXPRESS_WINNERS_PER_CATEGORY
      ? Number(process.env.ALIEXPRESS_WINNERS_PER_CATEGORY)
      : DEFAULT_MAX_PER_CATEGORY);

  const minDescriptionLen =
    opts.minDescriptionLen ??
    (process.env.ALIEXPRESS_MIN_DESC_LEN
      ? Number(process.env.ALIEXPRESS_MIN_DESC_LEN)
      : DEFAULT_MIN_DESC);

  const requireImage =
    opts.requireImage ??
    (process.env.ALIEXPRESS_REQUIRE_IMAGE
      ? process.env.ALIEXPRESS_REQUIRE_IMAGE === "true"
      : DEFAULT_REQUIRE_IMAGE);

  const minPrice =
    opts.minPrice ??
    (process.env.ALIEXPRESS_MIN_PRICE
      ? Number(process.env.ALIEXPRESS_MIN_PRICE)
      : DEFAULT_MIN_PRICE);

  const maxAgeDays =
    opts.maxAgeDays ??
    (process.env.ALIEXPRESS_MAX_AGE_DAYS
      ? Number(process.env.ALIEXPRESS_MAX_AGE_DAYS)
      : 3650);

  const categoryDepth =
    opts.categoryDepth ??
    (process.env.ALIEXPRESS_CATEGORY_DEPTH
      ? (Math.max(
          1,
          Math.min(3, Number(process.env.ALIEXPRESS_CATEGORY_DEPTH))
        ) as 1 | 2 | 3)
      : DEFAULT_CATEGORY_DEPTH);

  const targetCurrency =
    opts.targetCurrency ??
    (process.env.ALIEXPRESS_TARGET_CURRENCY || "USD");

  const targetLanguage =
    opts.targetLanguage ??
    (process.env.ALIEXPRESS_TARGET_LANGUAGE || "EN");

  const shipToCountry =
    opts.shipToCountry ??
    (process.env.ALIEXPRESS_SHIP_TO_COUNTRY || "US");

  const platformProductType =
    opts.platformProductType ??
    ((process.env.ALIEXPRESS_PLATFORM_PRODUCT_TYPE || "ALL") as
      | "ALL"
      | "PLAZA"
      | "TMALL");

  const sort =
    opts.sort ??
    ((process.env.ALIEXPRESS_SORT || "LAST_VOLUME_DESC") as
      | "SALE_PRICE_ASC"
      | "SALE_PRICE_DESC"
      | "LAST_VOLUME_ASC"
      | "LAST_VOLUME_DESC");

  const keywords =
    opts.keywords?.length
      ? opts.keywords
      : String(process.env.ALIEXPRESS_KEYWORDS || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

  const categoryIds =
    opts.categoryIds?.length
      ? opts.categoryIds
      : String(process.env.ALIEXPRESS_CATEGORY_IDS || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

  const searchTerms = keywords.length
    ? keywords
    : ["tech", "gadgets", "home", "fitness", "beauty"];

  if (DEBUG) {
    console.log("[AliExpress] apiUrl:", apiUrl);
    console.log("[AliExpress] appKey:", appKey);
    console.log("[AliExpress] appSecret exists:", !!appSecret);
    console.log("[AliExpress] trackingId:", trackingId);
    console.log("[AliExpress] appSignature:", appSignature);
  }

  const primaryBuckets = new Map<string, AliExpressIndexedProduct[]>();
  const globalSeen = new Set<string>();

  for (const keyword of searchTerms) {
    for (let pageNo = 1; pageNo <= maxPagesPerKeyword; pageNo++) {
      const payload: Record<string, string> = {
        method: METHOD_PRODUCT_QUERY,
        app_key: appKey,
        sign_method: "sha256",
        timestamp: Date.now().toString(),

        fields: DEFAULT_FIELDS,
        page_no: String(pageNo),
        page_size: String(pageSize),
        sort,
        target_currency: targetCurrency,
        target_language: targetLanguage,
        ship_to_country: shipToCountry,
        platform_product_type: platformProductType,
        tracking_id: trackingId,
        app_signature: appSignature,
      };

      if (keyword) payload.keywords = keyword;
      if (categoryIds.length) payload.category_ids = categoryIds.join(",");

      const data = await syncGetWithSignatureFallback(apiUrl, payload, appSecret, timeoutMs);
      const products = pickAliExpressProducts(data);

      if (DEBUG && pageNo === 1) {
        console.log("[AliExpress] keyword:", keyword);
        console.log("[AliExpress] products:", products.length);
        console.log(
          "[AliExpress] sample:",
          products[0] ? safeJson(products[0]).slice(0, 1200) : "none"
        );
      }

      if (!products.length) break;

      for (const raw of products) {
        const mapped = mapAliExpressRow(raw);
        if (!mapped) continue;

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

        const externalId =
          mapped.external_id || `aliexpress_${sha1(mapped.deep_link || mapped.title)}`;
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

        const merchantKey = normalizeKey(
          mapped.merchant_name || mapped.merchant_id || "unknown"
        );
        const primaryKey = `${merchantKey}::${catNorm.key}`;
        insertTopK(primaryBuckets, primaryKey, mapped, maxPerMerchantCategory);
      }

      const collected = totalBucketCount(primaryBuckets, winnersOnly);
      if (collected >= maxItems) break;
    }

    const collected = totalBucketCount(primaryBuckets, winnersOnly);
    if (collected >= maxItems) break;
  }

  if (!winnersOnly) {
    const rawAll = primaryBuckets.get("__all__") || [];
    return rawAll
      .slice()
      .sort((a, b) => {
        if ((b.score ?? 0) !== (a.score ?? 0)) return (b.score ?? 0) - (a.score ?? 0);
        return (a.title || "").localeCompare(b.title || "");
      })
      .slice(0, maxItems);
  }

  let candidates: AliExpressIndexedProduct[] = [];
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

  const winners: AliExpressIndexedProduct[] = [];

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

/* ----------------------------- sync GET + signature fallback ----------------------------- */

async function syncGetWithSignatureFallback(
  apiUrl: string,
  payload: Record<string, string>,
  appSecret: string,
  timeoutMs: number
) {
  const signers = [
    {
      name: "sha256_hmac_keyValueConcat",
      fn: (params: Record<string, string>, secret: string) =>
        crypto.createHmac("sha256", secret).update(buildSignBase(params), "utf8").digest("hex").toUpperCase(),
    },
    {
      name: "sha256_secretWrap_keyValueConcat",
      fn: (params: Record<string, string>, secret: string) =>
        crypto.createHash("sha256").update(secret + buildSignBase(params) + secret, "utf8").digest("hex").toUpperCase(),
    },
  ];

  let lastErr: any = null;

  for (const signer of signers) {
    const signedPayload = { ...payload, sign: signer.fn(payload, appSecret) };
    const requestUrl = `${apiUrl}?${new URLSearchParams(signedPayload).toString()}`;

    if (DEBUG) {
      console.log("[AliExpress] signer:", signer.name);
      console.log("[AliExpress] requestUrl:", requestUrl);
    }

    try {
      const data = await httpGetJson(requestUrl, timeoutMs);

      const rootError =
        data?.error_response ||
        data?.errorResp ||
        data?.error ||
        null;

      if (rootError) {
        const msg = safeJson(rootError);
        if (DEBUG) console.log("[AliExpress] signer failed:", signer.name, msg);
        lastErr = new Error(`AliExpress API error: ${msg}`);
        continue;
      }

      const root =
        data?.aliexpress_affiliate_product_query_response ||
        data?.aliexpress_affiliate_hotproduct_query_response ||
        firstResponseNode(data) ||
        data;

      const respCode =
        root?.resp_result?.resp_code ??
        root?.resp_code ??
        null;

      if (respCode && Number(respCode) !== 200) {
        lastErr = new Error(`AliExpress API non-200 resp_code: ${safeJson(root)}`);
        continue;
      }

      return data;
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr || new Error("AliExpress signing failed.");
}

async function httpGetJson(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        accept: "application/json,text/plain,*/*",
        "user-agent": "Autoaffi/1.0 (AliExpress Fetcher)",
      },
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
      throw new Error(
        `AliExpress request failed: ${res.status} ${res.statusText} :: ${text || safeJson(json)}`
      );
    }

    return json;
  } finally {
    clearTimeout(t);
  }
}

function buildSignBase(params: Record<string, string>) {
  return Object.keys(params)
    .filter((k) => k !== "sign" && params[k] !== undefined && params[k] !== null && params[k] !== "")
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join("");
}

/* ----------------------------- response unwrap ----------------------------- */

function pickAliExpressProducts(data: any): any[] {
  const root =
    data?.aliexpress_affiliate_product_query_response ||
    data?.aliexpress_affiliate_hotproduct_query_response ||
    firstResponseNode(data) ||
    data;

  const respResult =
    root?.resp_result ||
    root?.result ||
    root?.aliexpress_affiliate_product_query_response?.resp_result ||
    null;

  const result =
    respResult?.result ||
    root?.result ||
    null;

  const products =
    result?.products ||
    result?.product ||
    root?.products ||
    [];

  if (Array.isArray(products)) return products;
  if (products?.product && Array.isArray(products.product)) return products.product;
  if (products?.products && Array.isArray(products.products)) return products.products;
  if (result?.products?.product && Array.isArray(result.products.product)) {
    return result.products.product;
  }

  return [];
}

function firstResponseNode(data: any) {
  if (!data || typeof data !== "object") return null;
  for (const key of Object.keys(data)) {
    if (key.endsWith("_response")) return data[key];
  }
  return null;
}

/* ----------------------------- mapping ----------------------------- */

function mapAliExpressRow(row: Record<string, any>): AliExpressIndexedProduct | null {
  const title = String(
    row.product_title ||
      row.productName ||
      row.title ||
      row.product_id ||
      ""
  ).trim();

  const productId = String(row.product_id || row.productId || "").trim();

  const promotionLink = String(row.promotion_link || row.promotionLink || "").trim() || null;
  const detailUrl = String(row.product_detail_url || row.productDetailUrl || "").trim() || null;

  const imageUrl =
    String(
      row.product_main_image_url ||
        row.productMainImageUrl ||
        row.product_image_url ||
        row.image_url ||
        ""
    ).trim() || null;

  const merchantId = String(row.shop_id || row.shopId || "").trim() || null;
  const merchantName =
    String(row.shop_name || row.shopName || row.seller_name || "").trim() || merchantId;

  const firstCat = String(row.first_level_category_name || "").trim();
  const secondCat = String(row.second_level_category_name || "").trim();
  const category = [firstCat, secondCat].filter(Boolean).join(" > ") || null;

  const { price, currency } = pickBestPrice(row);

  const descParts = [
    title || null,
    category || null,
    row.discount ? `Discount: ${String(row.discount).trim()}` : null,
    row.evaluate_rate ? `Rating: ${String(row.evaluate_rate).trim()}` : null,
    row.commission_rate ? `Commission: ${String(row.commission_rate).trim()}` : null,
    row.hot_product_commission_rate
      ? `Hot commission: ${String(row.hot_product_commission_rate).trim()}`
      : null,
    row.lastest_volume !== undefined && row.lastest_volume !== null
      ? `Recent volume: ${String(row.lastest_volume)}`
      : null,
  ].filter(Boolean);

  if (!title || !(promotionLink || detailUrl)) return null;

  return {
    source: "aliexpress",
    external_id: productId ? `aliexpress_${productId}` : "",

    title,
    description: descParts.join(" | "),

    merchant_name: merchantName,
    merchant_id: merchantId,

    category,

    image_url: imageUrl,
    deep_link: promotionLink || detailUrl,

    price,
    currency,

    last_updated: null,

    quality_score: 0,
    score: 0,
    winner_tier: null,

    geo_scope: "worldwide",
    is_active: true,
    is_approved: true,

    raw: row,
  };
}

function pickBestPrice(row: Record<string, any>) {
  const candidates = [
    [row.target_app_sale_price, row.target_app_sale_price_currency],
    [row.target_sale_price, row.target_sale_price_currency],
    [row.app_sale_price, row.app_sale_price_currency],
    [row.sale_price, row.sale_price_currency],
    [row.original_price, row.original_price_currency],
  ] as Array<[any, any]>;

  for (const [p, c] of candidates) {
    const price = parsePrice(p);
    if (price !== null) {
      return {
        price,
        currency: c ? String(c).trim() : null,
      };
    }
  }

  return { price: null, currency: null };
}

/* ----------------------------- scoring + winner helpers ----------------------------- */

function computeQualityScore(p: AliExpressIndexedProduct): number {
  let q = 0;

  const hasImg = !!(p.image_url && p.image_url.length > 6);
  const descLen = (p.description || "").trim().length;
  const hasPrice = typeof p.price === "number" && Number.isFinite(p.price) && p.price > 0;
  const hasMerchant = !!(p.merchant_name || p.merchant_id);
  const hasCategory = !!(p.category && p.category.length > 2);

  if (hasImg) q += 30;
  if (descLen >= 20) q += 15;
  if (descLen >= 80) q += 10;
  if (hasPrice) q += 20;
  if (hasMerchant) q += 10;
  if (hasCategory) q += 10;

  const priceValue = typeof p.price === "number" && Number.isFinite(p.price) ? p.price : null;
  if (priceValue !== null && priceValue >= 5 && priceValue <= 120) q += 5;

  const raw = p.raw || {};
  const latestVolume = Number(raw.lastest_volume);
  if (Number.isFinite(latestVolume)) {
    if (latestVolume >= 5000) q += 10;
    else if (latestVolume >= 1000) q += 7;
    else if (latestVolume >= 100) q += 4;
  }

  const evalRate = parsePercent(raw.evaluate_rate);
  if (evalRate !== null) {
    if (evalRate >= 95) q += 5;
    else if (evalRate >= 90) q += 3;
  }

  return Math.max(0, Math.min(100, Math.round(q)));
}

function parsePercent(v: any): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace("%", "").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function insertTopK(
  buckets: Map<string, AliExpressIndexedProduct[]>,
  key: string,
  item: AliExpressIndexedProduct,
  k: number
) {
  const kk = Math.max(1, Number.isFinite(k) ? k : 1);
  const arr = buckets.get(key) || [];

  const s = item.score ?? 0;
  let i = 0;
  while (i < arr.length && (arr[i].score ?? 0) >= s) i++;
  arr.splice(i, 0, item);

  if (arr.length > kk) arr.length = kk;
  buckets.set(key, arr);
}

function totalBucketCount(
  buckets: Map<string, AliExpressIndexedProduct[]>,
  winnersOnly: boolean
) {
  if (!winnersOnly) return (buckets.get("__all__") || []).length;
  let n = 0;
  for (const [k, arr] of buckets.entries()) {
    if (k === "__all__") continue;
    n += arr.length;
  }
  return n;
}

/* ----------------------------- generic helpers ----------------------------- */

function normalizeCategory(
  input: string,
  depth: 1 | 2 | 3 = 2
): { key: string; label: string | null } {
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

function normalizeKey(v: string) {
  const s = String(v || "").trim().toLowerCase();
  return s || "unknown";
}

function sha1(input: string) {
  return crypto.createHash("sha1").update(input).digest("hex");
}

function parsePrice(v: any): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;

  const s = String(v).replace(/\s/g, "").replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function safeJson(v: any) {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export default fetchAliexpress;