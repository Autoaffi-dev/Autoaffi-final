import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const FREESOUND_API_KEY = process.env.FREESOUND_API_KEY!;
const CRON_SECRET = process.env.CRON_SECRET || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const SEARCH_QUERIES = [
  "cinematic ambient",
  "ambient texture",
  "documentary ambient",
  "uplifting ambient",
  "tech ambient",
  "inspiring ambient",
  "corporate ambient",
  "motivational ambient",
  "dark ambient",
  "emotional ambient",
];

const ALLOWED_LICENSES = new Set([
  "http://creativecommons.org/publicdomain/zero/1.0/",
  "https://creativecommons.org/publicdomain/zero/1.0/",
  "Creative Commons 0",
  "CC0",
]);

const BLOCK_TERMS = [
  "voice",
  "vocal",
  "speech",
  "podcast",
  "oneshot",
  "one-shot",
  "hit",
  "boom",
  "sfx",
  "foley",
  "transition",
  "whoosh",
  "impact",
  "scream",
  "horror hit",
  "gun",
  "explosion",
  "loop pack",
  "sample pack",
  "drum kit",
  "note c",
  "note d",
  "note e",
  "note f",
  "note g",
  "note a",
  "note b",
];

const PREFER_TERMS = [
  "ambient",
  "cinematic",
  "background",
  "soundscape",
  "texture",
  "pad",
  "documentary",
  "uplifting",
  "inspiring",
  "corporate",
  "emotional",
  "motivational",
  "atmosphere",
  "drone",
];

type FreesoundResult = {
  id: number;
  name?: string;
  username?: string;
  license?: string;
  tags?: string[];
  duration?: number;
  previews?: {
    "preview-hq-mp3"?: string;
    "preview-lq-mp3"?: string;
    "preview-hq-ogg"?: string;
    "preview-lq-ogg"?: string;
  };
};

type MusicBankRow = {
  source: "freesound";
  external_id: string;
  title: string;
  slug: string;
  provider_username: string | null;
  license: string | null;
  preview_mp3_url: string | null;
  preview_ogg_url: string | null;
  duration_seconds: number | null;
  mood: string | null;
  genre: string | null;
  tags: string[];
  search_query: string | null;
  quality_score: number;
  is_active: boolean;
  metadata: Record<string, unknown>;
  fetched_at: string;
  updated_at: string;
};

function normalizeText(input: string | null | undefined): string {
  return (input || "").trim().toLowerCase();
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function parseMood(query: string, title: string, tags: string[]): string {
  const text = `${query} ${title} ${tags.join(" ")}`.toLowerCase();

  if (
    text.includes("uplifting") ||
    text.includes("inspiring") ||
    text.includes("motivational")
  ) {
    return "uplifting";
  }
  if (
    text.includes("dark") ||
    text.includes("suspense") ||
    text.includes("thriller")
  ) {
    return "dark";
  }
  if (
    text.includes("emotional") ||
    text.includes("sad") ||
    text.includes("melancholic")
  ) {
    return "emotional";
  }
  if (text.includes("corporate") || text.includes("documentary")) {
    return "corporate";
  }
  if (
    text.includes("tech") ||
    text.includes("cyber") ||
    text.includes("sci-fi")
  ) {
    return "tech";
  }

  return "ambient";
}

function parseGenre(query: string, title: string, tags: string[]): string {
  const text = `${query} ${title} ${tags.join(" ")}`.toLowerCase();

  if (text.includes("documentary")) return "documentary";
  if (text.includes("corporate")) return "corporate";
  if (
    text.includes("sci-fi") ||
    text.includes("cyber") ||
    text.includes("tech")
  ) {
    return "tech";
  }
  if (text.includes("cinematic")) return "cinematic";
  return "ambient";
}

function hasBlockedTerms(title: string, tags: string[]): boolean {
  const text = `${title} ${tags.join(" ")}`.toLowerCase();
  return BLOCK_TERMS.some((term) => text.includes(term));
}

function scoreTrack(item: FreesoundResult, query: string): number {
  const title = normalizeText(item.name);
  const tags = (item.tags || []).map((t) => normalizeText(t));
  const text = `${title} ${tags.join(" ")} ${normalizeText(query)}`;

  let score = 0;

  for (const term of PREFER_TERMS) {
    if (text.includes(term)) score += 8;
  }

  if (text.includes("loop")) score += 12;
  if (text.includes("background")) score += 10;
  if (text.includes("music")) score += 6;
  if (text.includes("cinematic")) score += 10;
  if (text.includes("ambient")) score += 10;
  if (text.includes("soundscape")) score += 8;
  if (text.includes("documentary")) score += 8;
  if (text.includes("corporate")) score += 7;
  if (text.includes("uplifting")) score += 7;

  const duration = item.duration ?? 0;
  if (duration >= 12 && duration <= 45) score += 12;
  else if (duration > 45 && duration <= 60) score += 8;
  else if (duration > 60 && duration <= 90) score += 3;
  else score -= 15;

  if (title.length > 10 && title.length < 120) score += 5;

  if (hasBlockedTerms(title, tags)) score -= 100;

  return score;
}

function isAllowed(item: FreesoundResult): boolean {
  const license = item.license || "";
  if (!ALLOWED_LICENSES.has(license)) return false;

  const title = normalizeText(item.name);
  const tags = (item.tags || []).map((t) => normalizeText(t));
  const previewMp3 =
    item.previews?.["preview-hq-mp3"] ||
    item.previews?.["preview-lq-mp3"] ||
    null;

  if (!previewMp3) return false;
  if (!title) return false;
  if (hasBlockedTerms(title, tags)) return false;

  const duration = item.duration ?? 0;
  if (duration < 10 || duration > 90) return false;

  return true;
}

async function fetchFreesoundPage(
  query: string,
  page = 1
): Promise<FreesoundResult[]> {
  const url = new URL("https://freesound.org/apiv2/search/text/");

  url.searchParams.set("query", query);
  url.searchParams.set("fields", "id,name,username,license,tags,previews,duration");
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", "25");
  url.searchParams.set("token", FREESOUND_API_KEY);

  const finalUrl = url.toString();
  console.log("[music-bank][freesound] requesting:", finalUrl);

  const res = await fetch(finalUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Freesound fetch failed (${res.status}) url=${finalUrl} body=${text}`
    );
  }

  const data = await res.json();
  return Array.isArray(data.results) ? data.results : [];
}

function mapToRow(item: FreesoundResult, query: string): MusicBankRow {
  const title = (item.name || "untitled").trim();
  const tags = Array.isArray(item.tags)
    ? item.tags.map((t) => String(t).trim()).filter(Boolean)
    : [];
  const previewMp3 =
    item.previews?.["preview-hq-mp3"] ||
    item.previews?.["preview-lq-mp3"] ||
    null;
  const previewOgg =
    item.previews?.["preview-hq-ogg"] ||
    item.previews?.["preview-lq-ogg"] ||
    null;

  const qualityScore = scoreTrack(item, query);
  const now = new Date().toISOString();

  return {
    source: "freesound",
    external_id: String(item.id),
    title,
    slug: slugify(`freesound-${item.id}-${title}`),
    provider_username: item.username || null,
    license: item.license || null,
    preview_mp3_url: previewMp3,
    preview_ogg_url: previewOgg,
    duration_seconds:
      typeof item.duration === "number" ? Math.round(item.duration) : null,
    mood: parseMood(query, title, tags),
    genre: parseGenre(query, title, tags),
    tags,
    search_query: query,
    quality_score: qualityScore,
    is_active: true,
    metadata: {
      source: "freesound",
      query,
      freesound_id: item.id,
      username: item.username || null,
      raw_license: item.license || null,
      raw_tags: tags,
      provider_url: `https://freesound.org/people/${encodeURIComponent(
        item.username || ""
      )}/sounds/${item.id}/`,
    },
    fetched_at: now,
    updated_at: now,
  };
}

function dedupeByExternalId(rows: MusicBankRow[]): MusicBankRow[] {
  const best = new Map<string, MusicBankRow>();

  for (const row of rows) {
    const existing = best.get(row.external_id);
    if (!existing || row.quality_score > existing.quality_score) {
      best.set(row.external_id, row);
    }
  }

  return Array.from(best.values());
}

async function cleanupOldRows() {
  const staleDate = new Date(
    Date.now() - 1000 * 60 * 60 * 24 * 14
  ).toISOString();

  await supabase
    .from("music_bank")
    .update({ is_active: false })
    .eq("source", "freesound")
    .lt("fetched_at", staleDate);
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const urlSecret = req.nextUrl.searchParams.get("secret");
    const headerSecret = req.headers.get("x-cron-secret");

    const isAuthorized =
      (CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`) ||
      (CRON_SECRET && urlSecret === CRON_SECRET) ||
      (CRON_SECRET && headerSecret === CRON_SECRET);

    if (CRON_SECRET && !isAuthorized) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized",
          debug: {
            hasAuthHeader: Boolean(authHeader),
            hasUrlSecret: Boolean(urlSecret),
            hasXCronSecret: Boolean(headerSecret),
          },
        },
        { status: 401 }
      );
    }

    const allRows: MusicBankRow[] = [];
    const debug: Array<Record<string, unknown>> = [];

    for (const query of SEARCH_QUERIES) {
      const [page1, page2] = await Promise.all([
        fetchFreesoundPage(query, 1),
        fetchFreesoundPage(query, 2),
      ]);

      const merged = [...page1, ...page2];
      const filtered = merged.filter(isAllowed);
      const scored = filtered
        .map((item) => mapToRow(item, query))
        .filter((row) => row.quality_score >= 20)
        .sort((a, b) => b.quality_score - a.quality_score)
        .slice(0, 12);

      allRows.push(...scored);

      debug.push({
        query,
        fetched: merged.length,
        kept: scored.length,
      });
    }

    const deduped = dedupeByExternalId(allRows)
      .sort((a, b) => b.quality_score - a.quality_score)
      .slice(0, 150);

    if (!deduped.length) {
      return NextResponse.json(
        {
          ok: false,
          error: "No valid CC0 music found from Freesound.",
          debug,
        },
        { status: 500 }
      );
    }

    const { error: upsertError } = await supabase
      .from("music_bank")
      .upsert(deduped, {
        onConflict: "source,external_id",
      });

    if (upsertError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Supabase upsert failed",
          details: upsertError.message,
        },
        { status: 500 }
      );
    }

    await cleanupOldRows();

    return NextResponse.json({
      ok: true,
      source: "freesound",
      inserted_or_updated: deduped.length,
      queries: SEARCH_QUERIES.length,
      debug,
      sample: deduped.slice(0, 10).map((row) => ({
        external_id: row.external_id,
        title: row.title,
        mood: row.mood,
        genre: row.genre,
        quality_score: row.quality_score,
        preview_mp3_url: row.preview_mp3_url,
        license: row.license,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
