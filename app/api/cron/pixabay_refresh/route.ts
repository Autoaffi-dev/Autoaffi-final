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
const DAILY_CAP = 80;
const MIN_DELAY_MS = 250;

type AssetInsert = {
  provider: "pixabay";
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

async function getJson(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  const json = await safeJson(res);
  if (!res.ok) throw new Error(`Pixabay API error ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

export async function GET(req: Request) {
  try {
    if (!checkCronSecret(req)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = assertEnv("PIXABAY_API_KEY");
    const rotation = getRotationForToday();
    const KEYWORDS = rotation.keywords;

    const { existingUrl, existingPid } = await loadExistingIndex();

    const inserts: AssetInsert[] = [];

    for (const q of KEYWORDS) {
      if (inserts.length >= DAILY_CAP) break;

      // Images (popular)
      const images = await getJson(
        `https://pixabay.com/api/?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(
          q
        )}&image_type=photo&per_page=${PER_KEYWORD}&safesearch=true&order=popular`
      );

      for (const img of images?.hits || []) {
        if (inserts.length >= DAILY_CAP) break;

        const id = String(img?.id ?? "");
        if (!id) continue;

        const provider_asset_id = `image_${id}`;
        const pid = `pixabay::${provider_asset_id}`;
        if (existingPid.has(pid)) continue;

        const url = img?.largeImageURL || img?.webformatURL || null;
        const preview = img?.previewURL || img?.webformatURL || null;
        if (!url || existingUrl.has(url)) continue;

        const width = img?.imageWidth ?? null;
        const height = img?.imageHeight ?? null;

        inserts.push({
          provider: "pixabay",
          provider_asset_id,
          media_type: "image",
          keyword: q,
          title: img?.tags ? `Pixabay: ${img.tags}` : `Pixabay image ${id}`,
          url,
          cover_url: preview,
          duration: null,
          width,
          height,
          source_page: img?.pageURL ?? null,
          score: scoreAsset({ media_type: "image", width, height, keyword: q }),
          raw: img,
        });
      }

      if (inserts.length >= DAILY_CAP) break;
      await sleep(MIN_DELAY_MS);

      // Videos (popular)
      const videos = await getJson(
        `https://pixabay.com/api/videos/?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(
          q
        )}&per_page=${PER_KEYWORD}&safesearch=true&order=popular`
      );

      for (const v of videos?.hits || []) {
        if (inserts.length >= DAILY_CAP) break;

        const id = String(v?.id ?? "");
        if (!id) continue;

        const provider_asset_id = `video_${id}`;
        const pid = `pixabay::${provider_asset_id}`;
        if (existingPid.has(pid)) continue;

        const best = v?.videos?.large || v?.videos?.medium || v?.videos?.small || null;
        const url = best?.url || null;
        if (!url || existingUrl.has(url)) continue;

        const width = best?.width ?? null;
        const height = best?.height ?? null;
        const duration = v?.duration ?? null;

        const preview = v?.picture_id
          ? `https://i.vimeocdn.com/video/${v.picture_id}_640x360.jpg`
          : null;

        inserts.push({
          provider: "pixabay",
          provider_asset_id,
          media_type: "video",
          keyword: q,
          title: v?.tags ? `Pixabay: ${v.tags}` : `Pixabay video ${id}`,
          url,
          cover_url: preview,
          duration,
          width,
          height,
          source_page: v?.pageURL ?? null,
          score: scoreAsset({ media_type: "video", width, height, duration, keyword: q }),
          raw: v,
        });
      }

      await sleep(MIN_DELAY_MS);
    }

    // Local dedupe
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
        provider: "pixabay",
        inserted: 0,
        reason: `No new assets (rotation day ${rotation.day}: ${rotation.label})`,
        rotation,
      });
    }

    const inserted = await insertChunk(finalInserts, 25);

    return NextResponse.json({
      ok: true,
      provider: "pixabay",
      inserted,
      rotation,
    });
  } catch (err: any) {
    console.error("PIXABAY CRON ERROR:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}