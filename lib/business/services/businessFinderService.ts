import {
  BusinessSearchParams,
  BusinessSearchResponse,
  BusinessSearchResultItem,
  NormalizedBusinessTarget,
  EmailEnrichmentBadge,
} from "../types";

import { scoreTarget } from "../scoring";
import { recommendContactStrategy } from "../contactStrategy";
import { filterSuppressedAndClaimed } from "../filters";

import { searchPlaces } from "../providers/placesProvider";
import { searchRegistry } from "../providers/registryProvider";
import { normalizeFromPlaces, normalizeFromRegistry } from "../normalize";

// Email Enrichment V1.1
import { enrichEmailBatch } from "../enrich/emailEnricher";
import type { EmailEnrichment } from "../enrich/emailEnricher";

function normalizeLimit(limit?: number): number {
  const n = Number(limit ?? 20);
  if (!Number.isFinite(n)) return 20;
  return Math.min(100, Math.max(20, n));
}

function normalizeMode(mode: BusinessSearchParams["mode"] | undefined) {
  return mode === "company" ? "company" : "local";
}

function toEmailBadge(enrich: EmailEnrichment | undefined): EmailEnrichmentBadge {
  const found = enrich?.emailsFound ?? [];
  const guessed = enrich?.emailsGuessed ?? [];
  const best = found[0] ?? guessed[0];

  return {
    status: enrich?.status ?? "NONE",
    best: best || undefined,
    found,
    guessed,
    contactUrl: enrich?.contactUrl,
    checkedUrls: enrich?.checkedUrls,
    error: enrich?.error,
    checkedAt: enrich?.checkedAt,
  };
}

export async function searchBusinesses(
  params: BusinessSearchParams
): Promise<BusinessSearchResponse> {
  const mode = normalizeMode(params.mode);
  const limit = normalizeLimit(params.limit);

  // 1) Fetch raw from provider, normalize into shared target model
  let normalizedTargets: NormalizedBusinessTarget[] = [];

  if (mode === "local") {
    const raw = await searchPlaces({ ...params, mode, limit });
    normalizedTargets = raw.map(normalizeFromPlaces);
  } else {
    const raw = await searchRegistry({ ...params, mode, limit });
    normalizedTargets = raw.map(normalizeFromRegistry);
  }

  // 2) Apply basic filters requested by user (V1)
  if (params.requireWebsite) {
    normalizedTargets = normalizedTargets.filter((t) => !!t.website || !!t.domain);
  }

  if (params.requirePhone) {
    normalizedTargets = normalizedTargets.filter((t) => !!t.phone);
  }

  // requireContactForm is reserved for enrichment later (V1 keeps it as a no-op)

  // 3) Filter suppressed/claimed (V1: no DB yet -> empty context)
  // In Del 3 we will replace these sets with DB lookups.
  normalizedTargets = filterSuppressedAndClaimed(normalizedTargets, {
    suppressedKeys: new Set<string>(),
    claimedKeys: new Set<string>(),
  });

  // ---- BEAST: Email enrichment V1.1 (light crawl) ----
  const slice = normalizedTargets.slice(0, limit);

  // Default ON, can be disabled by caller: enrichEmails=false
  const enrichEmails = (params as any).enrichEmails !== false;

  let emailMap: Record<string, EmailEnrichment> = {};
  let enrichedCount = 0;

  if (enrichEmails) {
    const batchInput = slice.map((t) => ({
      key: `${t.source}:${t.sourceId}`,
      website: t.website ?? null,
    }));

    enrichedCount = batchInput.filter((b) => !!b.website).length;

    emailMap = await enrichEmailBatch(batchInput, {
      concurrency: Number((params as any).emailConcurrency ?? 4),
      timeoutMs: Number((params as any).emailTimeoutMs ?? 6000),
    });
  }

  // 4) Score + recommended contact strategy + availability (+ email badge + ui helpers)
  const results: BusinessSearchResultItem[] = slice.map((target) => {
    const s = scoreTarget(target);
    const contactStrategy = recommendContactStrategy(target, s.status);

    const enrich = enrichEmails ? emailMap[`${target.source}:${target.sourceId}`] : undefined;
    const email = enrichEmails ? toEmailBadge(enrich) : undefined;

    const item: BusinessSearchResultItem = {
      target,
      status: s.status,
      score: s.score,
      why: s.why,
      contactStrategy,
      availability: "available", // Del 3: will reflect claimed/suppressed

      // ✅ New (Types V1.1)
      email,
      contactMethods: {
        hasWebsite: !!(target.website || target.domain),
        hasPhone: !!target.phone,
        hasEmail: !!email?.best,
        hasContactUrl: !!email?.contactUrl,
      },
    };

    return item;
  });

  return {
    ok: true,
    mode,
    params: { ...params, mode, limit },
    results,
    meta: {
      returned: results.length,
      emailEnrichment: {
        enabled: enrichEmails,
        enriched: enrichedCount,
      },
    },
  };
}