import { NextResponse } from "next/server";
import { getRotationForToday } from "../_shared/media-rotation";
import {
  checkCronSecret,
  assertEnv,
  safeJson,
  loadExistingIndex,
  insertChunk,
  scoreAsset,
  sleep,
} from "../_shared/media-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PER_KEYWORD = 10;
const DAILY_CAP = 70;
const MIN_DELAY_MS = 250;

type AssetInsert = {
  provider: "pexels";
  provider_asset_id: string;
  media_type: "image" | "video";
  keyword: string;
  title: string;
  url: string;
  cover_url: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  source_page: string | null;
  score: number;
  raw: any;
};

async function pexelsFetch(url: string, apiKey: string, tries = 3) {
  let lastErr: any = null;

  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, {
      headers: { Authorization: apiKey },
      cache: "no-store",
    });

    const json = await safeJson(res);
    if (res.ok) return json;

    lastErr = new Error(`Pexels API error ${res.status}: ${JSON.stringify(json)}`);

    if (res.status === 429 || res.status >= 500) {
      await sleep(600 * (i + 1));
      continue;
    }
    throw lastErr;
  }

  throw lastErr;
}

function pickBestVideoFile(files: any[]) {
  if (!Array.isArray(files)) return null;

  const hd = files.find((f) => f?.quality === "hd" && f?.link);
  if (hd) return hd;

  const sorted = [...files]
    .filter((f) => f?.link && f?.width && f?.height)
    .sort((a, b) => (b.width * b.height) - (a.width * a.height));

  return sorted[0] || files.find((f) => f?.link) || null;
}

export async function GET(req: Request) {
  try {
    if (!checkCronSecret(req)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = assertEnv("PEXELS_API_KEY");
    const rotation = getRotationForToday();
    const KEYWORDS = rotation.keywords;

    const { existingUrl, existingPid } = await loadExistingIndex();

    const inserts: AssetInsert[] = [];

    for (const q of KEYWORDS) {
      if (inserts.length >= DAILY_CAP) break;

      // Photos
      const photos = await pexelsFetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${PER_KEYWORD}&page=1`,
        apiKey
      );

      for (const p of photos?.photos || []) {
        if (inserts.length >= DAILY_CAP) break;

        const id = String(p?.id ?? "");
        if (!id) continue;

        const provider_asset_id = `photo_${id}`;
        const pid = `pexels::${provider_asset_id}`;
        if (existingPid.has(pid)) continue;

        const url = p?.src?.original || p?.src?.large2x || null;
        const preview = p?.src?.medium || p?.src?.small || null;
        if (!url || existingUrl.has(url)) continue;

        const width = p?.width ?? null;
        const height = p?.height ?? null;

        inserts.push({
          provider: "pexels",
          provider_asset_id,
          media_type: "image",
          keyword: q,
          title: p?.alt || `Pexels photo ${id}`,
          url,
          cover_url: preview,
          duration: null,
          width,
          height,
          source_page: p?.url ?? null,
          score: scoreAsset({ media_type: "image", width, height, keyword: q }),
          raw: p,
        });
      }

      if (inserts.length >= DAILY_CAP) break;
      await sleep(MIN_DELAY_MS);

      // Videos
      const vids = await pexelsFetch(
        `https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&per_page=${PER_KEYWORD}&page=1`,
        apiKey
      );

      for (const v of vids?.videos || []) {
        if (inserts.length >= DAILY_CAP) break;

        const id = String(v?.id ?? "");
        if (!id) continue;

        const provider_asset_id = `video_${id}`;
        const pid = `pexels::${provider_asset_id}`;
        if (existingPid.has(pid)) continue;

        const best = pickBestVideoFile(v?.video_files || []);
        const url = best?.link || null;
        if (!url || existingUrl.has(url)) continue;

        const width = best?.width ?? v?.width ?? null;
        const height = best?.height ?? v?.height ?? null;
        const duration = v?.duration ?? null;

        inserts.push({
          provider: "pexels",
          provider_asset_id,
          media_type: "video",
          keyword: q,
          title: `Pexels video ${id}`,
          url,
          cover_url: v?.image || null,
          duration,
          width,
          height,
          source_page: v?.url ?? null,
          score: scoreAsset({ media_type: "video", width, height, duration, keyword: q }),
          raw: v,
        });
      }

      await sleep(MIN_DELAY_MS);
    }

    // Local dedupe (extra safe)
    const seenUrl = new Set<string>();
    const seenPid = new Set<string>();
    const finalInserts = inserts.filter((a) => {
      const pid = `${a.provider}::${a.provider_asset_id}`;
      if (seenPid.has(pid)) return false;
      if (seenUrl.has(a.url)) return false;
      seenPid.add(pid);
      seenUrl.add(a.url);
      return true;
    });

    if (finalInserts.length === 0) {
      return NextResponse.json({
        ok: true,
        provider: "pexels",
        inserted: 0,
        reason: `No new assets (rotation day ${rotation.day}: ${rotation.label})`,
        rotation,
      });
    }

    const inserted = await insertChunk(finalInserts, 25);

    return NextResponse.json({
      ok: true,
      provider: "pexels",
      inserted,
      rotation,
    });
  } catch (err: any) {
    console.error("PEXELS CRON ERROR:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}