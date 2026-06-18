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
  timeoutMs?: number;
  cacheTtlMs?: number;
  maxBytes?: number;
  userAgent?: string;
};

type BatchItem = {
  key: string;
  website?: string | null;
};

const DEFAULT_OPTS: Required<EnrichOpts> = {
  timeoutMs: 6000,
  cacheTtlMs: 1000 * 60 * 60 * 24 * 14,
  maxBytes: 800_000,
  userAgent: "AutoaffiBot/1.0 (email-enrich; +https://autoaffi.com)",
};

const cache = new Map<string, { expiresAt: number; value: EmailEnrichment }>();

function nowIso() {
  return new Date().toISOString();
}

function dedupe(items: string[]) {
  return Array.from(
    new Set(
      items
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function stripWww(hostname: string) {
  return hostname.replace(/^www\./i, "").toLowerCase();
}

function isAssetLike(value: string) {
  return /\.(png|jpg|jpeg|gif|webp|svg|css|js|map|woff|woff2|ttf|eot|ico|pdf|zip|mp4|mov|webm|xml)(\?|#|$)/i.test(
    value
  );
}

function isBlockedContactUrl(value: string) {
  const lower = value.toLowerCase();

  if (isAssetLike(lower)) return true;
  if (lower.includes("/feed")) return true;
  if (lower.includes("/comments/feed")) return true;
  if (lower.includes("fonts.googleapis.com")) return true;
  if (lower.includes("fonts.gstatic.com")) return true;
  if (lower.includes("gstatic.com")) return true;
  if (lower.includes("googleapis.com")) return true;
  if (lower.includes("facebook.com")) return true;
  if (lower.includes("fb.com")) return true;
  if (lower.includes("instagram.com")) return true;
  if (lower.includes("linkedin.com")) return true;
  if (lower.includes("snap.licdn.com")) return true;
  if (lower.includes("tiktok.com")) return true;
  if (lower.includes("youtube.com")) return true;
  if (lower.includes("youtu.be")) return true;
  if (lower.includes("twitter.com")) return true;
  if (lower.includes("x.com")) return true;
  if (lower.includes("cdn.")) return true;
  if (lower.includes("cloudfront.net")) return true;
  if (lower.includes("squarespace-cdn.com")) return true;
  if (lower.includes("wixstatic.com")) return true;

  return false;
}

function isTelemetryEmail(email: string) {
  const lower = email.toLowerCase();
  const blockedDomains = [
    "sentry.io",
    "sentry.wixpress.com",
    "sentry-next.wixpress.com",
    "wixpress.com",
    "wix.com",
  ];
  return blockedDomains.some((d) => lower.endsWith(`@${d}`));
}

function looksLikeFakeEmail(email: string) {
  const lower = email.toLowerCase();

  if (!lower.includes("@")) return true;
  if (isAssetLike(lower)) return true;
  if (isTelemetryEmail(lower)) return true;

  const blockedFragments = [
    "@example.com",
    "@email.com",
    "@yourdomain.com",
    "@domain.com",
    "@test.com",
  ];

  if (blockedFragments.some((f) => lower.endsWith(f))) return true;

  const localPart = lower.split("@")[0] ?? "";
  const domainPart = lower.split("@")[1] ?? "";

  if (!domainPart.includes(".")) return true;
  if (domainPart.endsWith(".png") || domainPart.endsWith(".jpg") || domainPart.endsWith(".webp")) {
    return true;
  }

  if (/(@2x|-\d+x\d+|cropped-|group-\d+)/i.test(localPart)) return true;

  return false;
}

function cleanUrlString(input: string): string {
  let value = (input ?? "").trim();
  if (!value) return "";

  value = value.replace(/\\/g, "/");

  // Repair broken schemes correctly
  value = value.replace(/^https\/\//i, "[https://]https://");
  value = value.replace(/^http\/\//i, "[http://]http://");

  return value;
}

function normalizeWebsiteUrl(input: string): URL | null {
  try {
    let value = cleanUrlString(input);
    if (!value) return null;

    if (!/^https?:\/\//i.test(value)) {
      value = `https://${value}`;
    }

    const url = new URL(value);
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

function originKey(url: URL) {
  return url.origin.toLowerCase();
}

function buildPreferredHomeUrls(base: URL): string[] {
  const urls: string[] = [];
  const host = stripWww(base.hostname);
  const path = base.pathname && base.pathname !== "/" ? base.pathname : "/";
  const search = base.search ?? "";

  urls.push(`https://${host}${path}${search}`);

  if (/^www\./i.test(base.hostname)) {
    urls.push(`https://${base.hostname.toLowerCase()}${path}${search}`);
  }

  urls.push(base.toString());

  if (base.protocol === "http:") {
    urls.push(`http://${base.hostname.toLowerCase()}${path}${search}`);
  }

  return dedupe(urls);
}

function extractEmailsFromHtml(html: string): string[] {
  const emails: string[] = [];

  const mailtoRe = /mailto:([^\s"'?>]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = mailtoRe.exec(html))) {
    const raw = decodeURIComponent((m[1] ?? "").split("?")[0]).trim();
    if (raw.includes("@")) emails.push(raw);
  }

  const plainRe = /([a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,})/gi;
  while ((m = plainRe.exec(html))) {
    const cleaned = decodeURIComponent((m[1] ?? "").trim());
    emails.push(cleaned);
  }

  return dedupe(emails)
    .map((e) => e.replace(/^\s+/, ""))
    .filter((e) => !looksLikeFakeEmail(e));
}

function isLikelyContactHref(href: string) {
  const lower = href.toLowerCase();
  return (
    lower.includes("contact") ||
    lower.includes("kontakt") ||
    lower.includes("about") ||
    lower.includes("om-oss") ||
    lower.includes("support") ||
    lower.includes("help") ||
    lower.includes("customer-service") ||
    lower.includes("kundservice")
  );
}

function isSameBusinessHost(baseUrl: URL, candidateUrl: URL) {
  const baseHost = stripWww(baseUrl.hostname);
  const candidateHost = stripWww(candidateUrl.hostname);

  if (baseHost === candidateHost) return true;

  // Allow close subdomain/main-domain relationship only
  if (candidateHost.endsWith(`.${baseHost}`)) return true;
  if (baseHost.endsWith(`.${candidateHost}`)) return true;

  return false;
}

function sanitizeContactCandidate(baseUrl: URL, href: string): string | undefined {
  try {
    const full = new URL(href, baseUrl);

    if (!/^https?:$/i.test(full.protocol)) return undefined;
    if (!isSameBusinessHost(baseUrl, full)) return undefined;
    if (isBlockedContactUrl(full.toString())) return undefined;

    return full.toString();
  } catch {
    return undefined;
  }
}

function extractContactUrl(html: string, baseUrl: URL): string | undefined {
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
    if (isAssetLike(href)) continue;
    if (!isLikelyContactHref(href)) continue;

    const safe = sanitizeContactCandidate(baseUrl, href);
    if (safe) candidates.push(safe);
  }

  const deduped = dedupe(candidates);
  if (deduped.length) return deduped[0];

  const guesses = ["/contact", "/kontakt", "/about", "/support"];
  for (const path of guesses) {
    const safe = sanitizeContactCandidate(baseUrl, path);
    if (safe) return safe;
  }

  return undefined;
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
        Accept: "text/html,application/xhtml+xml",
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

    const reader = res.body?.getReader();
    if (!reader) {
      const text = await res.text();
      return text.slice(0, opts.maxBytes);
    }

    const chunks: Uint8Array[] = [];
    let total = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      total += value.byteLength;
      if (total > opts.maxBytes) break;
      chunks.push(value);
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
  const host = stripWww(base.hostname);
  if (!host || !host.includes(".")) return [];

  const prefixes = ["info", "hello", "sales", "support", "contact", "admin"];
  return prefixes.map((p) => `${p}@${host}`);
}

function makeValue(
  partial: Omit<EmailEnrichment, "checkedAt"> & { checkedAt?: string }
): EmailEnrichment {
  return {
    status: partial.status,
    emailsFound: dedupe(partial.emailsFound),
    emailsGuessed: dedupe(partial.emailsGuessed),
    contactUrl: partial.contactUrl,
    checkedUrls: dedupe(partial.checkedUrls),
    error: partial.error,
    checkedAt: partial.checkedAt ?? nowIso(),
  };
}

export async function enrichEmailFromWebsite(
  website: string,
  inputOpts: EnrichOpts = {}
): Promise<EmailEnrichment> {
  const opts = { ...DEFAULT_OPTS, ...inputOpts };
  const checkedAt = nowIso();

  const baseUrl = normalizeWebsiteUrl(website);
  if (!baseUrl) {
    return makeValue({
      status: "ERROR",
      emailsFound: [],
      emailsGuessed: [],
      checkedUrls: [],
      error: "Invalid website URL",
      checkedAt,
    });
  }

  const key = originKey(baseUrl);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const checkedUrls: string[] = [];
  const homeCandidates = buildPreferredHomeUrls(baseUrl);

  try {
    let html1 = "";
    let resolvedHomeUrl: URL | null = null;

    for (const candidate of homeCandidates) {
      try {
        checkedUrls.push(candidate);
        html1 = await fetchHtml(candidate, opts);
        resolvedHomeUrl = new URL(candidate);
        break;
      } catch {
        continue;
      }
    }

    if (!html1 || !resolvedHomeUrl) {
      throw new Error("Failed to fetch homepage");
    }

    const emails1 = extractEmailsFromHtml(html1);
    const contactUrl = extractContactUrl(html1, resolvedHomeUrl);

    if (emails1.length) {
      const value = makeValue({
        status: "FOUND",
        emailsFound: emails1,
        emailsGuessed: [],
        contactUrl,
        checkedUrls,
        checkedAt,
      });
      cache.set(key, { expiresAt: Date.now() + opts.cacheTtlMs, value });
      return value;
    }

    if (contactUrl && !checkedUrls.includes(contactUrl)) {
      try {
        checkedUrls.push(contactUrl);
        const html2 = await fetchHtml(contactUrl, opts);
        const emails2 = extractEmailsFromHtml(html2);

        if (emails2.length) {
          const value = makeValue({
            status: "FOUND",
            emailsFound: emails2,
            emailsGuessed: [],
            contactUrl,
            checkedUrls,
            checkedAt,
          });
          cache.set(key, { expiresAt: Date.now() + opts.cacheTtlMs, value });
          return value;
        }
      } catch (e: any) {
        const guessed = guessEmailsFromWebsite(resolvedHomeUrl);
        const value = makeValue({
          status: guessed.length ? "GUESSED" : "ERROR",
          emailsFound: [],
          emailsGuessed: guessed,
          contactUrl: undefined,
          checkedUrls,
          error: String(e?.message ?? e),
          checkedAt,
        });
        cache.set(key, { expiresAt: Date.now() + opts.cacheTtlMs, value });
        return value;
      }
    }

    const guessed = guessEmailsFromWebsite(resolvedHomeUrl);
    const value = makeValue({
      status: guessed.length ? "GUESSED" : "NONE",
      emailsFound: [],
      emailsGuessed: guessed,
      contactUrl,
      checkedUrls,
      checkedAt,
    });
    cache.set(key, { expiresAt: Date.now() + opts.cacheTtlMs, value });
    return value;
  } catch (e: any) {
    const guessed = guessEmailsFromWebsite(baseUrl);
    const value = makeValue({
      status: guessed.length ? "GUESSED" : "ERROR",
      emailsFound: [],
      emailsGuessed: guessed,
      checkedUrls,
      error: String(e?.message ?? e),
      checkedAt,
    });
    cache.set(key, { expiresAt: Date.now() + opts.cacheTtlMs, value });
    return value;
  }
}

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
        results[current.key] = makeValue({
          status: "NONE",
          emailsFound: [],
          emailsGuessed: [],
          checkedUrls: [],
        });
        continue;
      }

      results[current.key] = await enrichEmailFromWebsite(current.website, opts);
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}