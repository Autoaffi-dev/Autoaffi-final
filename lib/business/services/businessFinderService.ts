import {
  BusinessSearchParams,
  BusinessSearchResponse,
  BusinessSearchResultItem,
  NormalizedBusinessTarget,
  EmailEnrichmentBadge,
  BusinessAvailability,
} from "../types";

import { scoreTarget } from "../scoring";
import { recommendContactStrategy } from "../contactStrategy";

import { searchPlaces } from "../providers/placesProvider";
import { searchRegistry } from "../providers/registryProvider";
import { normalizeFromPlaces, normalizeFromRegistry } from "../normalize";

// Email Enrichment V1.1
import { enrichEmailBatch } from "../enrich/emailEnricher";
import type { EmailEnrichment } from "../enrich/emailEnricher";

import { createClient } from "@supabase/supabase-js";

function normalizeLimit(limit?: number): number {
  const n = Number(limit ?? 10);
  if (!Number.isFinite(n)) return 10;
  return Math.min(100, Math.max(1, Math.round(n)));
}

function normalizeMode(mode: BusinessSearchParams["mode"] | undefined) {
  return mode === "company" ? "company" : "local";
}

function shuffleArray<T>(items: T[]): T[] {
  const clone = [...items];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function takeRandomItems<T>(items: T[], count: number): T[] {
  if (count <= 0) return [];
  if (items.length <= count) return [...items];
  return shuffleArray(items).slice(0, count);
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

function getAdminClient() {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRole =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY ?? "";

  if (!url) {
    throw new Error("Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!serviceRole) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, serviceRole, {
    auth: { persistSession: false },
  });
}

function buildLookupKey(source: string, sourceId: string) {
  return `${source}:${sourceId}`;
}

type DbTargetRow = {
  id: string;
  source: string;
  source_id: string;
};

type DbClaimRow = {
  target_id: string;
  claimed_by: string | null;
};

type DbSuppressionRow = {
  target_id: string;
  type: string | null;
  suppressed_until: string | null;
};

type DbWinRow = {
  target_id: string;
  user_id: string | null;
};

async function loadAvailabilityMaps(
  targets: NormalizedBusinessTarget[],
  currentUserId?: string
): Promise<{
  targetIdByLookupKey: Map<string, string>;
  claimedTargetIds: Set<string>;
  claimedByMeTargetIds: Set<string>;
  wonByMeTargetIds: Set<string>;
  suppressedTargetIds: Set<string>;
}> {
  const targetIdByLookupKey = new Map<string, string>();
  const claimedTargetIds = new Set<string>();
  const claimedByMeTargetIds = new Set<string>();
  const wonByMeTargetIds = new Set<string>();
  const suppressedTargetIds = new Set<string>();

  if (!targets.length) {
    return {
      targetIdByLookupKey,
      claimedTargetIds,
      claimedByMeTargetIds,
      wonByMeTargetIds,
      suppressedTargetIds,
    };
  }

  const supabase = getAdminClient();

  const grouped = new Map<string, string[]>();
  for (const t of targets) {
    const arr = grouped.get(t.source) ?? [];
    arr.push(t.sourceId);
    grouped.set(t.source, arr);
  }

  const matchedTargets: DbTargetRow[] = [];

  for (const [source, rawIds] of grouped.entries()) {
    const sourceIds = Array.from(new Set(rawIds.filter(Boolean)));
    if (!sourceIds.length) continue;

    const { data, error } = await supabase
      .from("business_targets")
      .select("id, source, source_id")
      .eq("source", source)
      .in("source_id", sourceIds);

    if (error) {
      throw new Error(`Failed to load business_targets: ${error.message}`);
    }

    matchedTargets.push(...((data ?? []) as DbTargetRow[]));
  }

  for (const row of matchedTargets) {
    targetIdByLookupKey.set(buildLookupKey(row.source, row.source_id), row.id);
  }

  const targetIds = matchedTargets.map((r) => r.id);
  if (!targetIds.length) {
    return {
      targetIdByLookupKey,
      claimedTargetIds,
      claimedByMeTargetIds,
      wonByMeTargetIds,
      suppressedTargetIds,
    };
  }

  const queries = [
    supabase
      .from("business_claims")
      .select("target_id, claimed_by")
      .in("target_id", targetIds),

    supabase
      .from("business_suppressions")
      .select("target_id, type, suppressed_until")
      .in("target_id", targetIds),
  ];

  const includeWins = !!currentUserId;
  const winsQuery = includeWins
    ? supabase
        .from("business_wins")
        .select("target_id, user_id")
        .in("target_id", targetIds)
        .eq("user_id", currentUserId)
    : null;

  const results = await Promise.all(
    includeWins && winsQuery ? [...queries, winsQuery] : queries
  );

  const claimsResult = results[0] as {
    data: DbClaimRow[] | null;
    error: { message: string } | null;
  };

  const suppressionsResult = results[1] as {
    data: DbSuppressionRow[] | null;
    error: { message: string } | null;
  };

  const winsResult = includeWins
    ? (results[2] as {
        data: DbWinRow[] | null;
        error: { message: string } | null;
      })
    : null;

  if (claimsResult.error) {
    throw new Error(`Failed to load business_claims: ${claimsResult.error.message}`);
  }

  if (suppressionsResult.error) {
    throw new Error(
      `Failed to load business_suppressions: ${suppressionsResult.error.message}`
    );
  }

  if (winsResult?.error) {
    throw new Error(`Failed to load business_wins: ${winsResult.error.message}`);
  }

  for (const row of claimsResult.data ?? []) {
    if (!row?.target_id) continue;

    claimedTargetIds.add(row.target_id);

    if (currentUserId && row.claimed_by && row.claimed_by === currentUserId) {
      claimedByMeTargetIds.add(row.target_id);
    }
  }

  for (const row of suppressionsResult.data ?? []) {
    if (!row?.target_id) continue;

    if (!row.suppressed_until) {
      suppressedTargetIds.add(row.target_id);
      continue;
    }

    const until = new Date(row.suppressed_until).getTime();
    if (Number.isFinite(until) && until > Date.now()) {
      suppressedTargetIds.add(row.target_id);
    }
  }

  for (const row of winsResult?.data ?? []) {
    if (!row?.target_id) continue;
    if (currentUserId && row.user_id === currentUserId) {
      wonByMeTargetIds.add(row.target_id);
    }
  }

  return {
    targetIdByLookupKey,
    claimedTargetIds,
    claimedByMeTargetIds,
    wonByMeTargetIds,
    suppressedTargetIds,
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

  // 2) Apply basic filters requested by user
  if (params.requireWebsite) {
    normalizedTargets = normalizedTargets.filter((t) => !!t.website || !!t.domain);
  }

  if (params.requirePhone) {
    normalizedTargets = normalizedTargets.filter((t) => !!t.phone);
  }

  if (params.requireContactForm) {
    normalizedTargets = normalizedTargets.filter((t) => !!t.website || !!t.domain);
  }

  // 3) De-dupe by source + sourceId before any final selection
  const dedupedMap = new Map<string, NormalizedBusinessTarget>();
  for (const target of normalizedTargets) {
    const key = buildLookupKey(target.source, target.sourceId);
    if (!dedupedMap.has(key)) {
      dedupedMap.set(key, target);
    }
  }

  const dedupedTargets = Array.from(dedupedMap.values());

  // 4) Shuffle early so same provider response does not always surface same top rows
  const shuffledTargets = shuffleArray(dedupedTargets);

  // 5) Build a larger candidate pool before scoring/final selection
  const candidatePoolSize = Math.min(
    shuffledTargets.length,
    Math.max(limit * 5, 50)
  );
  const candidateTargets = shuffledTargets.slice(0, candidatePoolSize);

  // 6) Load live DB availability state for the candidate pool
  const {
    targetIdByLookupKey,
    claimedTargetIds,
    claimedByMeTargetIds,
    wonByMeTargetIds,
    suppressedTargetIds,
  } = await loadAvailabilityMaps(candidateTargets, params.userId);

  // 7) Email enrichment on candidate pool
  const enrichEmails = params.enrichEmails !== false;

  let emailMap: Record<string, EmailEnrichment> = {};
  let enrichedCount = 0;

  if (enrichEmails) {
    const batchInput = candidateTargets.map((t) => ({
      key: buildLookupKey(t.source, t.sourceId),
      website: t.website ?? null,
    }));

    enrichedCount = batchInput.filter((b) => !!b.website).length;

    emailMap = await enrichEmailBatch(batchInput, {
      concurrency: Number(params.emailConcurrency ?? 4),
      timeoutMs: Number(params.emailTimeoutMs ?? 6000),
    });
  }

  // 8) Score + recommended contact strategy + live availability
  const mappedResults: BusinessSearchResultItem[] = candidateTargets.map((target) => {
    const s = scoreTarget(target);
    const contactStrategy = recommendContactStrategy(target, s.status);

    const enrich = enrichEmails
      ? emailMap[buildLookupKey(target.source, target.sourceId)]
      : undefined;
    const email = enrichEmails ? toEmailBadge(enrich) : undefined;

    const lookupKey = buildLookupKey(target.source, target.sourceId);
    const dbTargetId = targetIdByLookupKey.get(lookupKey);

    let availability: BusinessAvailability = "available";

    if (dbTargetId) {
      if (suppressedTargetIds.has(dbTargetId)) {
        availability = "suppressed";
      } else if (wonByMeTargetIds.has(dbTargetId)) {
        availability = "won_by_me";
      } else if (claimedByMeTargetIds.has(dbTargetId)) {
        availability = "claimed_by_me";
      } else if (claimedTargetIds.has(dbTargetId)) {
        availability = "claimed";
      }
    }

    const item: BusinessSearchResultItem = {
      target,
      status: s.status,
      score: s.score,
      why: s.why,
      contactStrategy,
      availability,
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

  // 9) Prefer non-suppressed first, but keep randomness within each bucket
  const availableResults = mappedResults.filter(
    (item) => item.availability !== "suppressed"
  );
  const suppressedResults = mappedResults.filter(
    (item) => item.availability === "suppressed"
  );

  const pickedAvailable = takeRandomItems(availableResults, limit);
  const remaining = Math.max(0, limit - pickedAvailable.length);
  const pickedSuppressed =
    remaining > 0 ? takeRandomItems(suppressedResults, remaining) : [];

  const results = [...pickedAvailable, ...pickedSuppressed];

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