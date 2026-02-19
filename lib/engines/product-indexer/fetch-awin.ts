import crypto from "crypto";
import { PassThrough, Readable } from "stream";
import { createGunzip } from "zlib";
import * as readline from "readline";

export type AwinIndexedProduct = {
  source: "awin";
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

  last_updated?: string | null; // ISO string

  // BEAST scoring (0..100)
  quality_score: number;
  score: number;
  winner_tier?: "A" | "B" | "C" | null;

  geo_scope?: string; // default worldwide
  is_active?: boolean;
  is_approved?: boolean;

  // Useful for debugging / future mapping
  raw?: Record<string, string>;
};

type FetchAwinOptions = {
  feedUrl?: string; // if omitted, uses env
  maxItems?: number; // FINAL max returned items (winners)
  timeoutMs?: number; // fetch timeout
  userAgent?: string;

  // WINNER FILTER
  winnersOnly?: boolean; // default true
  maxPerMerchant?: number; // default 30 (overall per merchant)
  minDescriptionLen?: number; // default 60
  requireImage?: boolean; // default true
  minPrice?: number; // default 0
  maxAgeDays?: number; // default 3650 (ignore if null)

  // BEAST add-ons
  maxPerMerchantCategory?: number; // default 10 (per merchant+category+band)
  maxPerCategory?: number; // default 200 (global per category cap)
  priceBands?: { lowMax: number; midMax: number }; // default { lowMax: 20, midMax: 100 }
  enforceCurrency?: string | null; // e.g. "SEK" (null disables)
  enforceLang?: string | null; // e.g. "sv" (null disables)

  // NEW: category normalize depth
  categoryDepth?: 1 | 2 | 3; // default 2 (top/sub)
};

const DEFAULT_TIMEOUT = 120_000;
const DEFAULT_MAX_ITEMS = 1500;

const DEFAULT_WINNERS_ONLY = true;
const DEFAULT_MAX_PER_MERCHANT = 30;
const DEFAULT_MAX_PER_MERCHANT_CATEGORY = 10;
const DEFAULT_MAX_PER_CATEGORY = 200;

const DEFAULT_MIN_DESC = 60;
const DEFAULT_REQUIRE_IMAGE = true;
const DEFAULT_MIN_PRICE = 0;

const DEFAULT_PRICE_BANDS = { lowMax: 20, midMax: 100 };
const DEFAULT_CATEGORY_DEPTH: 1 | 2 | 3 = 2;

export async function fetchAwin(opts: FetchAwinOptions = {}): Promise<AwinIndexedProduct[]> {
  const feedUrl =
    opts.feedUrl || process.env.AWIN_FEED_URL || process.env.AWIN_FEED_URL_SE || "";

  if (!feedUrl) {
    throw new Error(
      "AWIN feed URL missing. Set AWIN_FEED_URL (or AWIN_FEED_URL_SE) to your signed productdata.awin.com download URL."
    );
  }

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT;

  // FINAL output cap (winners)
  const maxItems =
    opts.maxItems ??
    (process.env.AWIN_WINNERS_MAX_TOTAL ? Number(process.env.AWIN_WINNERS_MAX_TOTAL) : DEFAULT_MAX_ITEMS);

  const winnersOnly =
    opts.winnersOnly ??
    (process.env.AWIN_WINNERS_ONLY ? process.env.AWIN_WINNERS_ONLY === "true" : DEFAULT_WINNERS_ONLY);

  // Overall per merchant cap
  const maxPerMerchant =
    opts.maxPerMerchant ??
    (process.env.AWIN_WINNERS_PER_MERCHANT ? Number(process.env.AWIN_WINNERS_PER_MERCHANT) : DEFAULT_MAX_PER_MERCHANT);

  // Per merchant+category+band cap
  const maxPerMerchantCategory =
    opts.maxPerMerchantCategory ??
    (process.env.AWIN_WINNERS_PER_MERCHANT_CATEGORY
      ? Number(process.env.AWIN_WINNERS_PER_MERCHANT_CATEGORY)
      : DEFAULT_MAX_PER_MERCHANT_CATEGORY);

  // Global per category cap
  const maxPerCategory =
    opts.maxPerCategory ??
    (process.env.AWIN_WINNERS_PER_CATEGORY ? Number(process.env.AWIN_WINNERS_PER_CATEGORY) : DEFAULT_MAX_PER_CATEGORY);

  const minDescriptionLen =
    opts.minDescriptionLen ??
    (process.env.AWIN_MIN_DESC_LEN ? Number(process.env.AWIN_MIN_DESC_LEN) : DEFAULT_MIN_DESC);

  const requireImage =
    opts.requireImage ??
    (process.env.AWIN_REQUIRE_IMAGE ? process.env.AWIN_REQUIRE_IMAGE === "true" : DEFAULT_REQUIRE_IMAGE);

  const minPrice =
    opts.minPrice ?? (process.env.AWIN_MIN_PRICE ? Number(process.env.AWIN_MIN_PRICE) : DEFAULT_MIN_PRICE);

  const maxAgeDays =
    opts.maxAgeDays ?? (process.env.AWIN_MAX_AGE_DAYS ? Number(process.env.AWIN_MAX_AGE_DAYS) : 3650);

  const priceBands = opts.priceBands ?? DEFAULT_PRICE_BANDS;

  // Currency/language sanity (optional)
  const enforceCurrency =
    opts.enforceCurrency ?? (process.env.AWIN_ENFORCE_CURRENCY ? process.env.AWIN_ENFORCE_CURRENCY : null);

  const enforceLang =
    opts.enforceLang ?? (process.env.AWIN_ENFORCE_LANG ? process.env.AWIN_ENFORCE_LANG : null);

  const categoryDepth =
    opts.categoryDepth ??
    (process.env.AWIN_CATEGORY_DEPTH
      ? (Math.max(1, Math.min(3, Number(process.env.AWIN_CATEGORY_DEPTH))) as 1 | 2 | 3)
      : DEFAULT_CATEGORY_DEPTH);

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(feedUrl, {
      signal: controller.signal,
      headers: {
        "user-agent": opts.userAgent || "Autoaffi/1.0 (Awin Feed Fetcher)",
        accept: "*/*",
      },
    } as any);
  } finally {
    clearTimeout(t);
  }

  if (!res.ok || !res.body) {
    throw new Error(`AWIN feed fetch failed: ${res.status} ${res.statusText}`);
  }

  // Convert WHATWG stream → Node stream
  const nodeStream = Readable.fromWeb(res.body as any);

  // Peek first chunk to detect gzip/zip
  const { head, stream: rejoined } = await peekFirstChunk(nodeStream);

  const kind = detectArchiveKind(head, res.headers.get("content-type") || "", feedUrl);
  const csvStream = await toCsvStream(rejoined, kind, feedUrl);

  // MUST: We collect candidates per primary bucket (merchant::category::band),
  // then do a strict global selection pass enforcing:
  // - maxPerMerchant
  // - maxPerCategory
  // - maxPerMerchantCategory (per primary bucket)
  // - final maxItems
  const primaryBuckets = new Map<string, AwinIndexedProduct[]>();

  // Track dupes early
  const globalSeen = new Set<string>();

  await parseCsvStream(csvStream, async (row) => {
    const mapped = mapAwinRow(row);
    if (!mapped) return;

    // Language sanity (only blocks if feed provides a language column)
    if (enforceLang) {
      const lang = String(row["language"] || row["lang"] || "").trim().toLowerCase();
      if (lang && lang !== enforceLang.toLowerCase()) return;
    }

    // Currency sanity (only blocks if currency exists)
    if (enforceCurrency) {
      const cur = String(mapped.currency || "").trim().toUpperCase();
      if (cur && cur !== enforceCurrency.toUpperCase()) return;
    }

    // Hard filters (beast-safe)
    if (!mapped.title || mapped.title.length < 2) return;
    if (!mapped.deep_link) return;
    if (requireImage && !mapped.image_url) return;

    if (minDescriptionLen > 0) {
      const d = (mapped.description || "").trim();
      if (d.length < minDescriptionLen) return;
    }

    if (minPrice > 0 && (mapped.price ?? 0) < minPrice) return;

    // Age filter
    if (maxAgeDays && mapped.last_updated) {
      const d = new Date(mapped.last_updated).getTime();
      if (Number.isFinite(d)) {
        const ageDays = (Date.now() - d) / (1000 * 60 * 60 * 24);
        if (ageDays > maxAgeDays) return;
      }
    }

    // Stable external id (prefer feed ids, else hash deep link)
    const deep = normalizeUrlForId(mapped.deep_link || "");
    const externalId =
      mapped.raw?.aw_product_id
        ? `awin_${mapped.raw.aw_product_id}`
        : mapped.raw?.merchant_product_id
        ? `awin_${mapped.raw.merchant_product_id}`
        : `awin_${sha1(deep)}`;

    if (globalSeen.has(externalId)) return;
    globalSeen.add(externalId);

    mapped.external_id = externalId;

    // Score + tier
    const q = computeQualityScore(mapped);
    mapped.quality_score = q;
    mapped.score = q;
    mapped.winner_tier = q >= 85 ? "A" : q >= 70 ? "B" : q >= 55 ? "C" : null;

    mapped.is_active = true;
    mapped.is_approved = true;
    mapped.geo_scope = "worldwide";

    if (!winnersOnly) {
      // raw mode (rare): keep in one bucket and return later
      insertTopK(primaryBuckets, "__all__", mapped, maxItems);
      return;
    }

    const merchantKey = normalizeKey(mapped.merchant_name || mapped.merchant_id || "unknown");

    // CATEGORY NORMALIZE (KEY + LABEL)
    const catNorm = normalizeCategory(mapped.category || "uncategorized", categoryDepth);
    const categoryKey = catNorm.key;
    mapped.category = catNorm.label || mapped.category;

    const band = getPriceBand(mapped.price, priceBands.lowMax, priceBands.midMax);
    const bandKey = `band_${band}`;

    // Primary bucket: merchant + category + price band
    const primaryKey = `${merchantKey}::${categoryKey}::${bandKey}`;
    insertTopK(primaryBuckets, primaryKey, mapped, maxPerMerchantCategory);
  });

  // If not winnersOnly -> just return top global
  if (!winnersOnly) {
    const rawAll = primaryBuckets.get("__all__") || [];
    const out = rawAll
      .slice()
      .sort((a, b) => {
        if ((b.score ?? 0) !== (a.score ?? 0)) return (b.score ?? 0) - (a.score ?? 0);
        return (a.title || "").localeCompare(b.title || "");
      })
      .slice(0, maxItems);
    return out;
  }

  // Flatten candidates
  let candidates: AwinIndexedProduct[] = [];
  for (const [k, arr] of primaryBuckets.entries()) {
    if (k === "__all__") continue;
    candidates = candidates.concat(arr);
  }

  // Dedup again (safe)
  const seen2 = new Set<string>();
  candidates = candidates.filter((p) => {
    const k = p.external_id;
    if (!k) return false;
    if (seen2.has(k)) return false;
    seen2.add(k);
    return true;
  });

  // Sort best-first
  candidates.sort((a, b) => {
    if ((b.score ?? 0) !== (a.score ?? 0)) return (b.score ?? 0) - (a.score ?? 0);
    return (a.title || "").localeCompare(b.title || "");
  });

  // MUST: strict enforcement pass
  const merchantCount = new Map<string, number>();
  const categoryCount = new Map<string, number>();
  const primaryCount = new Map<string, number>();

  const winners: AwinIndexedProduct[] = [];

  for (const p of candidates) {
    if (winners.length >= maxItems) break;

    const merchantKey = normalizeKey(p.merchant_name || p.merchant_id || "unknown");
    const catNorm = normalizeCategory(p.category || "uncategorized", categoryDepth);
    const categoryKey = catNorm.key;

    const band = getPriceBand(p.price, priceBands.lowMax, priceBands.midMax);
    const bandKey = `band_${band}`;
    const primaryKey = `${merchantKey}::${categoryKey}::${bandKey}`;

    const mC = merchantCount.get(merchantKey) ?? 0;
    if (mC >= maxPerMerchant) continue;

    const cC = categoryCount.get(categoryKey) ?? 0;
    if (cC >= maxPerCategory) continue;

    const pC = primaryCount.get(primaryKey) ?? 0;
    if (pC >= maxPerMerchantCategory) continue;

    merchantCount.set(merchantKey, mC + 1);
    categoryCount.set(categoryKey, cC + 1);
    primaryCount.set(primaryKey, pC + 1);

    // keep pretty category label if we have it
    p.category = catNorm.label || p.category;

    winners.push(p);
  }

  return winners;
}

/* ----------------------------- CATEGORY NORMALIZE (BEAST) ----------------------------- */

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

  const mapped = picked.map((p) => normalizeCategoryToken(p));
  const label = mapped.map((p) => titleish(p)).join(" / ");

  const key = mapped
    .map((p) => p.toLowerCase())
    .join(" / ")
    .replace(/[^\p{L}\p{N}\s\/-]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  return { key: key || "uncategorized", label: label || null };
}

function normalizeCategoryToken(token: string) {
  const t = String(token || "").trim();
  const lower = t.toLowerCase();

  if (["kläder", "clothes", "clothing", "apparel"].includes(lower)) return "clothing";
  if (["skor", "shoes", "footwear"].includes(lower)) return "shoes";
  if (["elektronik", "electronics"].includes(lower)) return "electronics";
  if (["hem", "home", "home & living", "home and living"].includes(lower)) return "home";
  if (["hälsa", "health"].includes(lower)) return "health";
  if (["skönhet", "beauty"].includes(lower)) return "beauty";
  if (["sport", "sports"].includes(lower)) return "sports";
  if (["barn", "kids", "children"].includes(lower)) return "kids";

  return t;
}

function titleish(s: string) {
  if (!s) return s;
  if (s.toUpperCase() === s && s.length <= 6) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ----------------------------- WINNER helpers ----------------------------- */

function normalizeKey(v: string) {
  const s = String(v || "").trim().toLowerCase();
  return s || "unknown";
}

function getPriceBand(
  price: number | null | undefined,
  lowMax: number,
  midMax: number
): "low" | "mid" | "high" {
  const p = typeof price === "number" && Number.isFinite(price) ? price : null;
  if (p === null) return "mid";
  if (p <= lowMax) return "low";
  if (p <= midMax) return "mid";
  return "high";
}

function insertTopK(
  buckets: Map<string, AwinIndexedProduct[]>,
  key: string,
  item: AwinIndexedProduct,
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

function computeQualityScore(p: AwinIndexedProduct): number {
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

  if (hasPrice && p.price !== null && p.price !== undefined) {
    if (p.price >= 15 && p.price <= 150) q += 3;
  }

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

/* ----------------------------- helpers ----------------------------- */

function sha1(input: string) {
  return crypto.createHash("sha1").update(input).digest("hex");
}

// NICE (safe): normalize for stable hashing
function normalizeUrlForId(url: string) {
  const u = String(url || "").trim();
  if (!u) return "";
  return u.replace(/#.*$/, "");
}

function detectArchiveKind(
  head: Buffer,
  contentType: string,
  url: string
): "gzip" | "zip" | "plain" {
  const isGzip = head.length >= 2 && head[0] === 0x1f && head[1] === 0x8b;
  const isZip =
    head.length >= 4 &&
    head[0] === 0x50 &&
    head[1] === 0x4b &&
    head[2] === 0x03 &&
    head[3] === 0x04;

  if (isGzip) return "gzip";
  if (isZip) return "zip";

  const ct = (contentType || "").toLowerCase();
  if (ct.includes("gzip")) return "gzip";
  if (ct.includes("zip")) return "zip";
  if (ct.includes("csv") || ct.includes("text")) return "plain";

  const u = url.toLowerCase();
  if (u.includes("/compression/gzip") || u.endsWith(".gz")) return "gzip";
  if (u.endsWith(".zip")) return "zip";

  return "plain";
}

async function toCsvStream(input: Readable, kind: "gzip" | "zip" | "plain", feedUrl: string): Promise<Readable> {
  if (kind === "plain") return input;

  if (kind === "gzip") {
    const gunzip = createGunzip();
    input.pipe(gunzip);
    return gunzip;
  }

  // ✅ BEAST B-mode: NO unzipper (prevents Turbopack pulling AWS SDK deps)
  // If your AWIN download is truly ZIP: use the gzip URL (.gz) instead.
  throw new Error(
    `AWIN feed is ZIP but ZIP parsing is disabled (no unzipper). ` +
      `Please switch AWIN_FEED_URL to the gzip (.gz) download URL. Feed: ${feedUrl}`
  );
}

async function peekFirstChunk(stream: Readable): Promise<{ head: Buffer; stream: Readable }> {
  return await new Promise((resolve, reject) => {
    const pass = new PassThrough();
    let done = false;

    const onData = (chunk: Buffer) => {
      if (done) return;
      done = true;

      pass.write(chunk);
      stream.off("data", onData);
      stream.off("error", onErr);

      stream.pipe(pass);
      resolve({ head: Buffer.from(chunk), stream: pass });
    };

    const onErr = (e: any) => {
      if (done) return;
      done = true;
      reject(e);
    };

    stream.on("data", onData);
    stream.on("error", onErr);
  });
}

/**
 * Streaming CSV parser with quoted-field support and multiline safety.
 * It assumes delimiter is comma (,) and values may be quoted with "" escapes.
 */
async function parseCsvStream(
  csvStream: Readable,
  onRow: (row: Record<string, string>, header: string[]) => Promise<void>
): Promise<void> {
  const rl = readline.createInterface({
    input: csvStream,
    crlfDelay: Infinity,
  });

  let header: string[] | null = null;
  let buffer = "";

  try {
    for await (const line of rl) {
      if (!line) continue;

      buffer = buffer.length ? buffer + "\n" + line : line;
      if (!isCompleteCsvRecord(buffer)) continue;

      const cols = splitCsvLine(buffer);
      buffer = "";

      if (!header) {
        header = cols.map((h) => normalizeHeader(h));
        continue;
      }

      const row: Record<string, string> = {};
      for (let i = 0; i < header.length; i++) row[header[i]] = cols[i] ?? "";

      await onRow(row, header);
    }

    if (buffer && header) {
      if (isCompleteCsvRecord(buffer)) {
        const cols = splitCsvLine(buffer);
        const row: Record<string, string> = {};
        for (let i = 0; i < header.length; i++) row[header[i]] = cols[i] ?? "";
        await onRow(row, header);
      }
    }
  } finally {
    rl.close();
  }
}

function normalizeHeader(h: string) {
  return h.trim().toLowerCase();
}

function isCompleteCsvRecord(s: string) {
  let quotes = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '"') {
      if (i + 1 < s.length && s[i + 1] === '"') {
        i++;
        continue;
      }
      quotes++;
    }
  }
  return quotes % 2 === 0;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        cur += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }

  out.push(cur);
  return out.map((v) => v.trim());
}

/* ----------------------------- mapping ----------------------------- */

function parsePrice(v: string): number | null {
  if (!v) return null;
  const cleaned = v.replace(/\s/g, "").replace(",", ".");
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return null;
  return n;
}

function toIsoDate(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Expects headers like:
 * aw_deep_link, product_name, aw_product_id, merchant_product_id,
 * merchant_image_url, description, merchant_category, search_price,
 * aw_image_url, store_price, currency, merchant_name, last_updated, ...
 */
function mapAwinRow(row: Record<string, string>): AwinIndexedProduct | null {
  const product_name = row["product_name"] || row["name"] || "";
  const description = row["description"] || null;

  const deepLink = row["aw_deep_link"] || row["merchant_deep_link"] || row["deep_link"] || "";

  const image = row["merchant_image_url"] || row["aw_image_url"] || row["image_url"] || "";

  const merchantName = row["merchant_name"] || row["advertiser_name"] || null;
  const merchantId = row["merchant_id"] || row["advertiser_id"] || null;

  const category = row["merchant_category"] || row["category_name"] || row["category"] || null;

  const currency = row["currency"] || null;

  const price = parsePrice(row["store_price"] || "") ?? parsePrice(row["search_price"] || "");

  const lastUpdatedIso = toIsoDate(row["last_updated"] || row["lastupdated"] || "");

  if (!deepLink || !image || !product_name) return null;

  return {
    source: "awin",
    external_id: "",

    title: product_name,
    description,

    merchant_name: merchantName,
    merchant_id: merchantId,

    category,

    image_url: image,
    deep_link: deepLink,

    price,
    currency,

    last_updated: lastUpdatedIso,

    quality_score: 0,
    score: 0,
    winner_tier: null,

    geo_scope: "worldwide",
    is_active: true,
    is_approved: true,

    raw: {
      aw_product_id: row["aw_product_id"] || "",
      merchant_product_id: row["merchant_product_id"] || "",
    },
  };
}

export default fetchAwin;