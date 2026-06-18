import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type MusicItem = {
  id: string;
  title: string;
  url: string;
  previewUrl?: string;
  duration?: number;
  source: "pixabay" | "local_library";
  tags: string[];
  mood?: string;
  genre?: string;
  energy?: "low" | "medium" | "high";
  bpm?: number;
};

type MusicFetchBody = {
  query?: string;
  mood?: string;
  genre?: string;
  energy?: string;
  limit?: number;
};

type PixabayTrack = {
  id?: number | string;
  pageURL?: string;
  type?: string;
  tags?: string;
  duration?: number;
  picture_id?: string | number;
  user?: string;
  user_id?: number;
  likes?: number;
  downloads?: number;
  comments?: number;
  views?: number;
  audio?: string;
  audio_url?: string;
  url?: string;
  name?: string;
};

type PixabayResponse = {
  total?: number;
  totalHits?: number;
  hits?: PixabayTrack[];
};

function normalizeText(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeNumber(
  value: unknown,
  fallback: number,
  min?: number,
  max?: number
): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;

  let out = n;
  if (typeof min === "number") out = Math.max(min, out);
  if (typeof max === "number") out = Math.min(max, out);
  return out;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function getBaseUrl(req: NextRequest): string {
  const origin = req.headers.get("origin");
  if (origin) return origin;

  const proto =
    req.headers.get("x-forwarded-proto") ||
    (req.nextUrl.protocol?.replace(":", "") || "http");

  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    process.env.VERCEL_URL;

  if (!host) return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  return host.startsWith("http") ? host : `${proto}://${host}`;
}

function buildQueryBlob(body: MusicFetchBody): string {
  return [
    normalizeText(body.query, ""),
    normalizeText(body.mood, ""),
    normalizeText(body.genre, ""),
    normalizeText(body.energy, ""),
  ]
    .filter(Boolean)
    .join(" ")
    .trim()
    .toLowerCase();
}

function deriveMood(queryBlob: string): string | undefined {
  if (!queryBlob) return undefined;

  if (
    ["luxury", "freedom", "travel", "premium", "lifestyle", "remote"].some((t) =>
      queryBlob.includes(t)
    )
  ) {
    return "luxury";
  }

  if (
    ["ai", "automation", "tech", "software", "saas", "startup", "dashboard"].some((t) =>
      queryBlob.includes(t)
    )
  ) {
    return "tech";
  }

  if (
    ["motivational", "success", "growth", "business", "commercial"].some((t) =>
      queryBlob.includes(t)
    )
  ) {
    return "motivational";
  }

  if (
    ["ambient", "clean", "soft", "minimal", "calm"].some((t) =>
      queryBlob.includes(t)
    )
  ) {
    return "ambient";
  }

  if (
    ["viral", "social", "trending", "reels", "hook", "hype"].some((t) =>
      queryBlob.includes(t)
    )
  ) {
    return "hype";
  }

  return undefined;
}

function deriveEnergy(queryBlob: string): "low" | "medium" | "high" | undefined {
  if (!queryBlob) return undefined;

  if (
    ["calm", "ambient", "soft", "minimal", "clean"].some((t) => queryBlob.includes(t))
  ) {
    return "low";
  }

  if (
    ["hype", "viral", "fast", "trending", "social", "promo"].some((t) =>
      queryBlob.includes(t)
    )
  ) {
    return "high";
  }

  if (
    ["motivational", "business", "tech", "premium", "commercial"].some((t) =>
      queryBlob.includes(t)
    )
  ) {
    return "medium";
  }

  return undefined;
}

function buildLocalLibrary(baseUrl: string): MusicItem[] {
  return [
    {
      id: "cinematic-rise-01",
      title: "Cinematic Rise",
      url: `${baseUrl}/music/cinematic-rise-01.mp3`,
      previewUrl: `${baseUrl}/music/cinematic-rise-01.mp3`,
      duration: 28,
      source: "local_library",
      mood: "cinematic",
      genre: "trailer",
      energy: "medium",
      bpm: 96,
      tags: [
        "cinematic",
        "trailer",
        "motivational",
        "premium",
        "commercial",
        "build",
        "dramatic",
        "reel",
        "short-form",
      ],
    },
    {
      id: "motivational-drive-01",
      title: "Motivational Drive",
      url: `${baseUrl}/music/motivational-drive-01.mp3`,
      previewUrl: `${baseUrl}/music/motivational-drive-01.mp3`,
      duration: 24,
      source: "local_library",
      mood: "motivational",
      genre: "commercial",
      energy: "high",
      bpm: 118,
      tags: [
        "motivational",
        "commercial",
        "upbeat",
        "business",
        "growth",
        "success",
        "creator",
        "ads",
        "promo",
      ],
    },
    {
      id: "luxury-lifestyle-01",
      title: "Luxury Lifestyle",
      url: `${baseUrl}/music/luxury-lifestyle-01.mp3`,
      previewUrl: `${baseUrl}/music/luxury-lifestyle-01.mp3`,
      duration: 26,
      source: "local_library",
      mood: "luxury",
      genre: "lifestyle",
      energy: "medium",
      bpm: 102,
      tags: [
        "luxury",
        "lifestyle",
        "freedom",
        "travel",
        "premium",
        "elegant",
        "smooth",
        "brand",
        "remote work",
      ],
    },
    {
      id: "tech-pulse-01",
      title: "Tech Pulse",
      url: `${baseUrl}/music/tech-pulse-01.mp3`,
      previewUrl: `${baseUrl}/music/tech-pulse-01.mp3`,
      duration: 22,
      source: "local_library",
      mood: "tech",
      genre: "electronic",
      energy: "high",
      bpm: 124,
      tags: [
        "tech",
        "electronic",
        "ai",
        "automation",
        "startup",
        "software",
        "dashboard",
        "saas",
        "modern",
      ],
    },
    {
      id: "ambient-clean-01",
      title: "Ambient Clean",
      url: `${baseUrl}/music/ambient-clean-01.mp3`,
      previewUrl: `${baseUrl}/music/ambient-clean-01.mp3`,
      duration: 30,
      source: "local_library",
      mood: "ambient",
      genre: "minimal",
      energy: "low",
      bpm: 80,
      tags: [
        "ambient",
        "minimal",
        "clean",
        "soft",
        "background",
        "calm",
        "premium",
        "subtle",
        "presentation",
      ],
    },
    {
      id: "social-hype-01",
      title: "Social Hype",
      url: `${baseUrl}/music/social-hype-01.mp3`,
      previewUrl: `${baseUrl}/music/social-hype-01.mp3`,
      duration: 20,
      source: "local_library",
      mood: "hype",
      genre: "social",
      energy: "high",
      bpm: 128,
      tags: [
        "hype",
        "social",
        "viral",
        "fast",
        "hook",
        "short-form",
        "trending",
        "creator",
        "reels",
      ],
    },
  ];
}

function scoreTrack(track: MusicItem, queryBlob: string): number {
  const q = tokenize(queryBlob);
  const blob = [
    track.title,
    track.mood || "",
    track.genre || "",
    track.energy || "",
    ...(Array.isArray(track.tags) ? track.tags : []),
  ]
    .join(" ")
    .toLowerCase();

  let score = 0;

  for (const token of q) {
    if (blob.includes(token)) score += 8;
  }

  const boostMap: Array<{ terms: string[]; points: number }> = [
    {
      terms: ["ai", "automation", "saas", "dashboard", "software", "tech", "startup"],
      points: track.tags.some((t) =>
        ["tech", "ai", "automation", "saas", "modern"].includes(t)
      )
        ? 14
        : 0,
    },
    {
      terms: ["luxury", "freedom", "travel", "remote", "lifestyle", "premium"],
      points: track.tags.some((t) =>
        ["luxury", "lifestyle", "freedom", "travel", "premium"].includes(t)
      )
        ? 14
        : 0,
    },
    {
      terms: ["motivational", "success", "growth", "business", "commercial"],
      points: track.tags.some((t) =>
        ["motivational", "commercial", "business", "growth", "success"].includes(t)
      )
        ? 12
        : 0,
    },
    {
      terms: ["ambient", "clean", "soft", "minimal", "calm"],
      points: track.tags.some((t) =>
        ["ambient", "minimal", "clean", "soft", "calm"].includes(t)
      )
        ? 12
        : 0,
    },
    {
      terms: ["viral", "social", "fast", "hook", "reels", "trending"],
      points: track.tags.some((t) =>
        ["hype", "social", "viral", "reels", "trending", "hook"].includes(t)
      )
        ? 12
        : 0,
    },
  ];

  for (const row of boostMap) {
    if (row.terms.some((term) => queryBlob.includes(term))) {
      score += row.points;
    }
  }

  if (!queryBlob) score += 1;

  return score;
}

function normalizeResults(
  library: MusicItem[],
  queryBlob: string,
  limit: number
): MusicItem[] {
  return library
    .map((track, idx) => ({
      track,
      score: scoreTrack(track, queryBlob) + idx * 0.0001,
    }))
    .sort((a, b) => b.score - a.score)
    .map((row) => row.track)
    .slice(0, limit);
}

function mapPixabayTrack(hit: PixabayTrack, queryBlob: string): MusicItem | null {
  const rawUrl =
    normalizeText(hit.audio) ||
    normalizeText(hit.audio_url) ||
    normalizeText(hit.url);

  if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) return null;

  const title =
    normalizeText(hit.name) ||
    (Array.isArray(hit.tags)
      ? hit.tags.join(" ")
      : normalizeText(hit.tags, "Pixabay Track"));

  const tags = unique(
    [
      ...tokenize(normalizeText(hit.tags, "")),
      ...tokenize(queryBlob),
    ].filter(Boolean)
  );

  return {
    id: String(hit.id ?? `pixabay_${Math.random().toString(36).slice(2)}`),
    title: title || "Pixabay Track",
    url: rawUrl,
    previewUrl: rawUrl,
    duration: typeof hit.duration === "number" ? hit.duration : undefined,
    source: "pixabay",
    tags,
    mood: deriveMood(queryBlob),
    genre: "stock_music",
    energy: deriveEnergy(queryBlob),
  };
}

async function fetchPixabayMusic(
  queryBlob: string,
  limit: number
): Promise<MusicItem[]> {
  const apiKey = process.env.PIXABAY_API_KEY;

  if (!apiKey) {
    console.warn("[MUSIC/FETCH] Missing PIXABAY_API_KEY, skipping Pixabay");
    return [];
  }

  const q =
    queryBlob.trim() ||
    "motivational background music commercial cinematic premium";

  const endpoint = new URL("https://pixabay.com/api/audio/");
  endpoint.searchParams.set("key", apiKey);
  endpoint.searchParams.set("q", q);
  endpoint.searchParams.set("per_page", String(Math.min(Math.max(limit, 3), 20)));
  endpoint.searchParams.set("safesearch", "true");

  try {
    const res = await fetch(endpoint.toString(), {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[MUSIC/FETCH] Pixabay error", res.status, text);
      return [];
    }

    const json = (await res.json()) as PixabayResponse;
    const hits = Array.isArray(json?.hits) ? json.hits : [];

    return hits
      .map((hit) => mapPixabayTrack(hit, queryBlob))
      .filter((item): item is MusicItem => !!item)
      .slice(0, limit);
  } catch (error) {
    console.error("[MUSIC/FETCH] Pixabay crash", error);
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as MusicFetchBody;

    const baseUrl = getBaseUrl(req);
    const limit = normalizeNumber(body.limit, 8, 1, 20);
    const queryBlob = buildQueryBlob(body);

    const pixabayResults = await fetchPixabayMusic(queryBlob, limit);

    if (pixabayResults.length > 0) {
      return NextResponse.json(
        {
          ok: true,
          query: queryBlob,
          source: "pixabay",
          results: pixabayResults,
          items: pixabayResults,
          audioResults: pixabayResults,
          musicResults: pixabayResults,
          stockMusic: pixabayResults,
          count: pixabayResults.length,
          availableLibraryCount: pixabayResults.length,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        }
      );
    }

    const library = buildLocalLibrary(baseUrl);
    const localResults = normalizeResults(library, queryBlob, limit);

    return NextResponse.json(
      {
        ok: true,
        query: queryBlob,
        source: "local_music_library",
        fallbackUsed: true,
        results: localResults,
        items: localResults,
        audioResults: localResults,
        musicResults: localResults,
        stockMusic: localResults,
        count: localResults.length,
        availableLibraryCount: library.length,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("[MUSIC/FETCH] Crash", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "music/fetch failed",
        results: [],
        items: [],
        audioResults: [],
        musicResults: [],
        stockMusic: [],
      },
      { status: 500 }
    );
  }
}