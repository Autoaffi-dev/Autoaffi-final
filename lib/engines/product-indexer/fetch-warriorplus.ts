/**
 * WarriorPlus affiliate-request import.
 *
 * GET /api/v2/affiliate_requests?as=affiliate
 * Official list contract: apiKey query auth, page size at most 100,
 * starting_after set to the last affiliate-request id, and top-level
 * has_more as the strings "true" and "false".
 *
 * Only request status ACTIVE is importable. offer.id is the product
 * identity. The caller limit caps how many products are returned.
 * WARRIORPLUS_MAX_PAGE_REQUESTS is a separate safety stop.
 *
 * Each HTTP call receives an AbortSignal. The signal covers the response
 * body. A call waits at most the remaining shared budget,
 * and never longer than WARRIORPLUS_REQUEST_TIMEOUT_MS (10 seconds).
 * The whole fetchProducts run stops at WARRIORPLUS_FETCH_BUDGET_MS
 * (30 seconds). Timeout and an aborted body read throw WARRIORPLUS_TIMEOUT
 * and discard pages already collected.
 */

export const WARRIORPLUS_PAGE_SIZE = 100;
export const WARRIORPLUS_MAX_PAGE_REQUESTS = 10;
export const WARRIORPLUS_REQUEST_TIMEOUT_MS = 10_000;
export const WARRIORPLUS_FETCH_BUDGET_MS = 30_000;

const SAFE_CODES = {
  missingKey: "WARRIORPLUS_API_KEY_MISSING",
  http: "WARRIORPLUS_HTTP_ERROR",
  invalid: "WARRIORPLUS_INVALID_RESPONSE",
  emptyPage: "WARRIORPLUS_PAGINATION_EMPTY_PAGE",
  missingCursor: "WARRIORPLUS_PAGINATION_MISSING_CURSOR",
  repeatedCursor: "WARRIORPLUS_PAGINATION_REPEATED_CURSOR",
  requestCap: "WARRIORPLUS_PAGINATION_REQUEST_CAP",
  timeout: "WARRIORPLUS_TIMEOUT",
} as const;

export class WarriorPlusImportError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "WarriorPlusImportError";
    this.code = code;
  }
}

type IndexRow = {
  source: "warriorplus";
  external_id: string;
  title: string;
  description: null;
  category: null;
  product_url: string;
  landing_url: string;
  image_url: null;
  currency: null;
  price: null;
  merchant_name: string | null;
  merchant_id: string | null;
  is_approved: true;
  is_active: true;
  quality_score: 70;
  score: 70;
  geo_scope: "worldwide";
  winner_tier: "B";
};

type FetchProductsArgs = {
  limit?: number;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
  budgetMs?: number;
};

type AffiliateRequestOffer = {
  id?: unknown;
  name?: unknown;
  status?: unknown;
  vendor_name?: unknown;
  vendor_username?: unknown;
};

type AffiliateRequestRow = {
  id?: unknown;
  status?: unknown;
  promote_url?: unknown;
  offer?: AffiliateRequestOffer | null;
};

export async function fetchProducts({
  limit = 200,
  fetchImpl = fetch,
  requestTimeoutMs = WARRIORPLUS_REQUEST_TIMEOUT_MS,
  budgetMs = WARRIORPLUS_FETCH_BUDGET_MS,
}: FetchProductsArgs = {}) {
  const apiKey = requireApiKey();
  const callerLimit = normalizeCallerLimit(limit);
  const requestCap = normalizeDuration(requestTimeoutMs, WARRIORPLUS_REQUEST_TIMEOUT_MS);
  const budget = normalizeDuration(budgetMs, WARRIORPLUS_FETCH_BUDGET_MS);
  const deadline = Date.now() + budget;
  const out: IndexRow[] = [];
  const seenProductIds = new Set<string>();
  const seenCursors = new Set<string>();
  let cursor = "";

  for (let requestNumber = 1; requestNumber <= WARRIORPLUS_MAX_PAGE_REQUESTS; requestNumber += 1) {
    const timeoutMs = remainingTimeout(deadline, requestCap);
    const page = await fetchPage({ apiKey, cursor, fetchImpl, timeoutMs });

    for (const item of page.data) {
      if (out.length >= callerLimit) break;
      const row = toIndexRow(item);
      if (!row) continue;
      if (seenProductIds.has(row.external_id)) continue;
      seenProductIds.add(row.external_id);
      out.push(row);
    }

    if (out.length >= callerLimit) return out;

    if (page.hasMore === "false") return out;

    if (page.data.length === 0) {
      throw new WarriorPlusImportError(SAFE_CODES.emptyPage);
    }

    const nextCursor = text(page.data[page.data.length - 1]?.id);
    if (!nextCursor) {
      throw new WarriorPlusImportError(SAFE_CODES.missingCursor);
    }
    if (seenCursors.has(nextCursor)) {
      throw new WarriorPlusImportError(SAFE_CODES.repeatedCursor);
    }
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }

  throw new WarriorPlusImportError(SAFE_CODES.requestCap);
}

function normalizeCallerLimit(limit: number) {
  const parsed = Math.floor(Number(limit));
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

function normalizeDuration(value: number, fallback: number) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

function remainingTimeout(deadline: number, requestCap: number) {
  const remaining = deadline - Date.now();
  if (remaining < 1) {
    throw new WarriorPlusImportError(SAFE_CODES.timeout);
  }
  return Math.min(requestCap, remaining);
}

function requireApiKey() {
  const key = text(process.env.WARRIORPLUS_API_KEY);
  if (!key) throw new WarriorPlusImportError(SAFE_CODES.missingKey);
  return key;
}

function baseUrl() {
  return text(process.env.WARRIORPLUS_BASE_URL || "https://warriorplus.com").replace(/\/+$/, "");
}

async function fetchPage(input: {
  apiKey: string;
  cursor: string;
  fetchImpl: typeof fetch;
  timeoutMs: number;
}) {
  const url = new URL(`${baseUrl()}/api/v2/affiliate_requests`);
  url.searchParams.set("apiKey", input.apiKey);
  url.searchParams.set("as", "affiliate");
  url.searchParams.set("status", "ACTIVE");
  url.searchParams.set("limit", String(WARRIORPLUS_PAGE_SIZE));
  if (input.cursor) url.searchParams.set("starting_after", input.cursor);

  const timed = startTimeout(input.timeoutMs);
  try {
    let response: Response;
    try {
      response = await input.fetchImpl(url.toString(), {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
        signal: timed.signal,
      });
    } catch (err) {
      throw sanitizedTransportError(err, timed.signal);
    }

    if (!response.ok) {
      throw new WarriorPlusImportError(SAFE_CODES.http);
    }

    const textBody = await readBody(response, timed.signal);
    let json: unknown = null;
    try {
      json = JSON.parse(textBody);
    } catch {
      throw new WarriorPlusImportError(SAFE_CODES.invalid);
    }

    return parsePage(json);
  } finally {
    timed.stop();
  }
}

function startTimeout(timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new DOMException("The operation was aborted due to timeout", "TimeoutError"));
  }, timeoutMs);
  return {
    signal: controller.signal,
    stop() {
      clearTimeout(timer);
    },
  };
}

function parsePage(json: unknown): { data: AffiliateRequestRow[]; hasMore: "true" | "false" } {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    throw new WarriorPlusImportError(SAFE_CODES.invalid);
  }
  const record = json as Record<string, unknown>;
  if (record.success !== 1) {
    throw new WarriorPlusImportError(SAFE_CODES.invalid);
  }
  if (!Array.isArray(record.data)) {
    throw new WarriorPlusImportError(SAFE_CODES.invalid);
  }
  if (record.has_more !== "true" && record.has_more !== "false") {
    throw new WarriorPlusImportError(SAFE_CODES.invalid);
  }
  return {
    data: record.data as AffiliateRequestRow[],
    hasMore: record.has_more,
  };
}

function toIndexRow(item: AffiliateRequestRow): IndexRow | null {
  if (text(item?.status) !== "ACTIVE") return null;

  const offer = item?.offer;
  const externalId = text(offer?.id);
  const title = text(offer?.name);
  const promoteUrl = httpUrl(item?.promote_url);
  if (!externalId || !title || !promoteUrl) return null;

  const vendorName = text(offer?.vendor_name);
  const vendorUser = text(offer?.vendor_username);

  return {
    source: "warriorplus",
    external_id: externalId,
    title,
    description: null,
    category: null,
    product_url: promoteUrl,
    landing_url: promoteUrl,
    image_url: null,
    currency: null,
    price: null,
    merchant_name: vendorName || null,
    merchant_id: vendorUser ? `wp_${vendorUser}` : null,
    is_approved: true,
    is_active: true,
    quality_score: 70,
    score: 70,
    geo_scope: "worldwide",
    winner_tier: "B",
  };
}

function httpUrl(value: unknown) {
  const raw = text(value);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function sanitizedTransportError(err: unknown, signal: AbortSignal) {
  if (isTimeoutOrAbort(err) || signal.aborted) {
    return new WarriorPlusImportError(SAFE_CODES.timeout);
  }
  return new WarriorPlusImportError(SAFE_CODES.http);
}

function isTimeoutOrAbort(err: unknown) {
  if (!err || typeof err !== "object") return false;
  const name = "name" in err ? String((err as { name?: unknown }).name) : "";
  return name === "AbortError" || name === "TimeoutError";
}

function readBody(response: Response, signal: AbortSignal) {
  if (signal.aborted) {
    return Promise.reject(new WarriorPlusImportError(SAFE_CODES.timeout));
  }

  return new Promise<string>((resolve, reject) => {
    const onAbort = () => {
      void response.body?.cancel().catch(() => undefined);
      reject(new WarriorPlusImportError(SAFE_CODES.timeout));
    };
    signal.addEventListener("abort", onAbort, { once: true });

    response.text().then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (err: unknown) => {
        signal.removeEventListener("abort", onAbort);
        void response.body?.cancel().catch(() => undefined);
        if (isTimeoutOrAbort(err) || signal.aborted) {
          reject(new WarriorPlusImportError(SAFE_CODES.timeout));
          return;
        }
        reject(new WarriorPlusImportError(SAFE_CODES.http));
      }
    );
  });
}

export default fetchProducts;
