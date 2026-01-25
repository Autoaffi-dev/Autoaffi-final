export type EmailEnrichmentStatus = "FOUND" | "GUESSED" | "NONE" | "ERROR";

export type EmailEnrichment = {
  status: EmailEnrichmentStatus;
  emailsFound: string[];
  emailsGuessed: string[];
  contactUrl?: string;
  checkedUrls: string[];
  error?: string;
  checkedAt: string;
};

type EnrichOpts = {
  timeoutMs?: number;          // per request
  cacheTtlMs?: number;         // per website origin
  maxBytes?: number;           // safety: limit response size
  userAgent?: string;
};

type BatchItem = { key: string; website?: string | null };

const DEFAULT_OPTS: Required<EnrichOpts> = {
  timeoutMs: 6000,
  cacheTtlMs: 1000 * 60 * 60 * 24 * 14, // 14 days
  maxBytes: 800_000,                    // ~0.8 MB
  userAgent: "AutoaffiBot/1.0 (email-enrich; +https://autoaffi.com)",
};

// Simple TTL cache (per website origin)
const cache = new Map<string, { expiresAt: number; value: EmailEnrichment }>();

function nowIso() {
  return new Date().toISOString();
}

function normalizeWebsiteUrl(input: string): URL | null {
  try {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // If user stored "example.com", force https
    const url =
      trimmed.startsWith("[http://]http://") || trimmed.startsWith("[https://]https://")
        ? new URL(trimmed)
        : new URL(`https://${trimmed}`);

    // Remove hash; keep path
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

function originKey(url: URL) {
  return url.origin.toLowerCase();
}

function dedupeEmails(emails: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const e of emails) {
    const v = e.trim().toLowerCase();
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function looksLikeFakeEmail(e: string) {
  // kill very common placeholders
  const bad = [
    "example.com",
    "email.com",
    "yourdomain.com",
    "domain.com",
    "test.com",
  ];
  return bad.some((b) => e.endsWith(`@${b}`));
}

function extractEmailsFromHtml(html: string): string[] {
  // 1) mailto:
  const mailto: string[] = [];
  const mailtoRe = /mailto:([^\s"'?>]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = mailtoRe.exec(html))) {
    const raw = m[1].split("?")[0];
    if (raw && raw.includes("@")) mailto.push(raw);
  }

  // 2) plain emails
  const plain: string[] = [];
  const plainRe = /([a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,})/gi;
  while ((m = plainRe.exec(html))) {
    plain.push(m[1]);
  }

  return dedupeEmails([...mailto, ...plain]).filter((e) => !looksLikeFakeEmail(e));
}

function extractContactUrl(html: string, baseUrl: URL): string | undefined {
  // Prefer explicit paths that usually contain contact info
  const preferred = [
    "/contact",
    "/contact-us",
    "/kontakt",
    "/impressum",
    "/about",
    "/om",
    "/support",
    "/help",
  ];

  // 1) direct href match containing those keywords
  const hrefRe = /href\s*=\s*["']([^"']+)["']/gi;
  const candidates: string[] = [];
  let m: RegExpExecArray | null;

  while ((m = hrefRe.exec(html))) {
    const href = (m[1] ?? "").trim();
    if (!href) continue;
    if (href.startsWith("mailto:")) continue;
    if (href.startsWith("tel:")) continue;
    if (href.startsWith("javascript:")) continue;
    if (href.startsWith("#")) continue;

    const lower = href.toLowerCase();
    if (
      lower.includes("contact") ||
      lower.includes("kontakt") ||
      lower.includes("impress") ||
      lower.includes("about") ||
      lower.includes("support") ||
      lower.includes("help")
    ) {
      candidates.push(href);
    }
  }

  // Try preferred first
  for (const path of preferred) {
    const hit = candidates.find((c) => c.toLowerCase().includes(path));
    if (hit) {
      try {
        return new URL(hit, baseUrl).toString();
      } catch {}
    }
  }

  // Else first candidate
  if (candidates.length) {
    try {
      return new URL(candidates[0], baseUrl).toString();
    } catch {}
  }

  // Else guess /contact
  try {
    return new URL("/contact", baseUrl).toString();
  } catch {
    return undefined;
  }
}

async function fetchHtml(url: string, opts: Required<EnrichOpts>): Promise<string> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), opts.timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": opts.userAgent,
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) {
      throw new Error(`Not HTML (${contentType || "unknown"})`);
    }

    // Limit bytes to avoid huge pages
    const reader = res.body?.getReader();
    if (!reader) {
      // fallback (rare)
      const text = await res.text();
      return text.slice(0, opts.maxBytes);
    }

    const chunks: Uint8Array[] = [];
    let total = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > opts.maxBytes) {
          // Stop reading further
          break;
        }
        chunks.push(value);
      }
    }

    const merged = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.byteLength;
    }

    return new TextDecoder("utf-8").decode(merged);
  } finally {
    clearTimeout(t);
  }
}

function guessEmailsFromWebsite(base: URL): string[] {
  const host = base.hostname.replace(/^www\./i, "");
  if (!host || !host.includes(".")) return [];

  const prefixes = ["info", "hello", "sales", "support", "contact", "admin"];
  return prefixes.map((p) => `${p}@${host}`);
}

export async function enrichEmailFromWebsite(
  website: string,
  inputOpts: EnrichOpts = {}
): Promise<EmailEnrichment> {
  const opts = { ...DEFAULT_OPTS, ...inputOpts };
  const checkedAt = nowIso();

  const baseUrl = normalizeWebsiteUrl(website);
  if (!baseUrl) {
    return {
      status: "ERROR",
      emailsFound: [],
      emailsGuessed: [],
      checkedUrls: [],
      error: "Invalid website URL",
      checkedAt,
    };
  }

  const key = originKey(baseUrl);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const checkedUrls: string[] = [];
  try {
    // 1) Homepage
    const homeUrl = baseUrl.toString();
    checkedUrls.push(homeUrl);

    const html1 = await fetchHtml(homeUrl, opts);
    const emails1 = extractEmailsFromHtml(html1);

    if (emails1.length) {
      const value: EmailEnrichment = {
        status: "FOUND",
        emailsFound: emails1,
        emailsGuessed: [],
        contactUrl: extractContactUrl(html1, baseUrl),
        checkedUrls,
        checkedAt,
      };
      cache.set(key, { expiresAt: Date.now() + opts.cacheTtlMs, value });
      return value;
    }

    // 2) One contact page (light crawl)
    const contactUrl = extractContactUrl(html1, baseUrl);
    if (contactUrl && contactUrl !== homeUrl) {
      checkedUrls.push(contactUrl);
      const html2 = await fetchHtml(contactUrl, opts);
      const emails2 = extractEmailsFromHtml(html2);

      if (emails2.length) {
        const value: EmailEnrichment = {
          status: "FOUND",
          emailsFound: emails2,
          emailsGuessed: [],
          contactUrl,
          checkedUrls,
          checkedAt,
        };
        cache.set(key, { expiresAt: Date.now() + opts.cacheTtlMs, value });
        return value;
      }
    }

    // 3) Fallback: guessed
    const guessed = guessEmailsFromWebsite(baseUrl);
    const value: EmailEnrichment = {
      status: guessed.length ? "GUESSED" : "NONE",
      emailsFound: [],
      emailsGuessed: guessed,
      contactUrl,
      checkedUrls,
      checkedAt,
    };
    cache.set(key, { expiresAt: Date.now() + opts.cacheTtlMs, value });
    return value;
  } catch (e: any) {
    const guessed = guessEmailsFromWebsite(baseUrl);
    const value: EmailEnrichment = {
      status: guessed.length ? "GUESSED" : "ERROR",
      emailsFound: [],
      emailsGuessed: guessed,
      checkedUrls,
      error: String(e?.message ?? e),
      checkedAt,
    };
    cache.set(key, { expiresAt: Date.now() + opts.cacheTtlMs, value });
    return value;
  }
}

/**
 * Batch helper with concurrency (beast-safe)
 */
export async function enrichEmailBatch(
  items: BatchItem[],
  opts: EnrichOpts & { concurrency?: number } = {}
): Promise<Record<string, EmailEnrichment>> {
  const concurrency = Math.min(10, Math.max(1, opts.concurrency ?? 4));
  const results: Record<string, EmailEnrichment> = {};

  let idx = 0;
  const worker = async () => {
    while (idx < items.length) {
      const current = items[idx++];
      if (!current?.key) continue;

      if (!current.website) {
        results[current.key] = {
          status: "NONE",
          emailsFound: [],
          emailsGuessed: [],
          checkedUrls: [],
          checkedAt: nowIso(),
        };
        continue;
      }

      results[current.key] = await enrichEmailFromWebsite(current.website, opts);
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}