import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { query, type, seed } = await req.json();

    if (!query) {
      return NextResponse.json({
        ok: true,
        combined: [],
      });
    }

    const PEXELS_KEY = process.env.PEXELS_API_KEY!;
    const PIXABAY_KEY = process.env.PIXABAY_API_KEY!;
    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY!;

    // -----------------------------
    // SEED → STABILT TAL
    // -----------------------------
    const seedStr =
      typeof seed === "string"
        ? seed
        : seed != null
        ? String(seed)
        : "default";

    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
      hash = (hash * 31 + seedStr.charCodeAt(i)) >>> 0;
    }

    const pexelsPage = (hash % 3) + 1;       // 1–3
    const pixabayPage = ((hash >> 3) % 3) + 1; // 1–3

    // -----------------------------
    // SAFE FETCH WRAPPER
    // -----------------------------
    const safe = async (fn: () => Promise<any>) => {
      try {
        return await fn();
      } catch {
        return null;
      }
    };

    // -----------------------------
    // 1) PEXELS
    // -----------------------------
    const pexels = await safe(async () => {
      const r = await fetch(
        `https://api.pexels.com/videos/search?query=${encodeURIComponent(
          query
        )}&per_page=10&page=${pexelsPage}`,
        { headers: { Authorization: PEXELS_KEY } }
      );
      const json = await r.json();

      if (!json.videos) return [];

      return json.videos.map((v: any) => ({
        source: "pexels" as const,
        url:
          v.video_files?.find((f: any) => f.quality === "hd")?.link || "",
        thumb: v.image || "",
        duration: v.duration || 0,
      }));
    });

    // -----------------------------
    // 2) PIXABAY
    // -----------------------------
    const pixabay = await safe(async () => {
      const r = await fetch(
        `https://pixabay.com/api/videos/?key=${PIXABAY_KEY}&q=${encodeURIComponent(
          query
        )}&per_page=10&page=${pixabayPage}`
      );
      const json = await r.json();
      if (!json.hits) return [];

      return json.hits.map((h: any) => ({
        source: "pixabay" as const,
        url: h.videos?.large?.url || "",
        thumb: h.picture_id
          ? `https://i.vimeocdn.com/video/${h.picture_id}_640x360.jpg`
          : "",
        duration: h.duration || 0,
      }));
    });

    // -----------------------------
    // 3) VIDEEZY (via Supabase-cache)
    // -----------------------------
    const videezy = await safe(async () => {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/videezy_assets?select=*`, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      });

      const json = await r.json();
      if (!Array.isArray(json) || json.length === 0) return [];

      // Seed-baserad start-index för variation
      const startIndex = hash % json.length;
      const picked: any[] = [];

      for (let i = 0; i < 10 && i < json.length; i++) {
        const idx = (startIndex + i) % json.length;
        const item = json[idx];
        picked.push({
          source: "videezy" as const,
          url: item.video_url || "",
          thumb: item.thumbnail_url || "",
          duration: item.duration || 0,
        });
      }

      return picked;
    });

    // -----------------------------
    // COMBINE ALL SOURCES
    // Videezy först (bäst), sen Pixabay, sen Pexels
    // -----------------------------
    const combined = [
      ...(videezy || []),
      ...(pixabay || []),
      ...(pexels || []),
    ].filter((m) => m.url);

    // -----------------------------
    // 100 % FALLBACK (ALLTID NÅGOT MEDIA)
    // -----------------------------
    if (combined.length === 0) {
      combined.push({
        source: "fallback" as const,
        url: "https://public.autoaffi.com/fallback/fallback1.mp4",
        thumb: "https://public.autoaffi.com/fallback/thumb1.jpg",
        duration: 8,
      });
    }

    return NextResponse.json({
      ok: true,
      combined: combined.slice(0, 15),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Media fetch failed",
      },
      { status: 500 }
    );
  }
}