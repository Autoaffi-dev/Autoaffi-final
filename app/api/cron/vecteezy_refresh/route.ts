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

const PER_KEYWORD = 8;
const DAILY_CAP = 40;
const DOWNLOADS_PER_RUN_CAP = 10; // protects quota
const MIN_DELAY_MS = 350;

// ✅ Vecteezy valid content types (from their error message)
const CONTENT_TYPES: Array<"video" | "photo"> = ["video", "photo"];

type AssetInsert = {
  provider: "vecteezy";
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

async function vecteezyFetch(path: string, tries = 3) {
  // ✅ Default to API host (docs), but allow override
  const base = process.env.VECTEEZY_BASE_URL || "https://api.vecteezy.com";
  const apiKey = assertEnv("VECTEEZY_API_KEY");

  let lastErr: any = null;

  for (let i = 0; i < tries; i++) {
    const res = await fetch(`${base}${path}`, {
      headers: {
        Accept: "application/json",
        // Keep both (different key types may accept one or the other)
        Authorization: `Bearer ${apiKey}`,
        "X-Api-Key": apiKey,
      },
      cache: "no-store",
    });

    const json = await safeJson(res);
    if (res.ok) return json;

    const msg =
      json?.errors?.[0]?.message ||
      json?.message ||
      json?._raw ||
      `HTTP ${res.status}`;

    lastErr = new Error(`Vecteezy API error ${res.status}: ${msg}`);

    if (res.status === 429 || res.status >= 500) {
      await sleep(650 * (i + 1));
      continue;
    }
    throw lastErr;
  }

  throw lastErr;
}

function normalizeItems(list: any): any[] {
  return list?.resources || list?.results || list?.data || list?.items || [];
}

export async function GET(req: Request) {
  try {
    if (!checkCronSecret(req)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const accountId = assertEnv("VECTEEZY_ACCOUNT_ID");
    const rotation = getRotationForToday();
    const KEYWORDS = rotation.keywords;

    const { existingUrl, existingPid } = await loadExistingIndex();

    const inserts: AssetInsert[] = [];
    let downloadsUsed = 0;

    for (const q of KEYWORDS) {
      if (inserts.length >= DAILY_CAP) break;

      // ✅ IMPORTANT FIX:
      // Vecteezy rejects invalid content_type -> we must call with valid types
      for (const ct of CONTENT_TYPES) {
        if (inserts.length >= DAILY_CAP) break;

        const list = await vecteezyFetch(
          `/v2/${accountId}/resources?query=${encodeURIComponent(q)}&content_type=${ct}&page=1&per_page=${PER_KEYWORD}`
        );

        const items = normalizeItems(list);

        for (const item of items) {
          if (inserts.length >= DAILY_CAP) break;

          const id = String(item?.id ?? item?.resource_id ?? "");
          if (!id) continue;

          const provider_asset_id = id;
          const pid = `vecteezy::${provider_asset_id}`;
          if (existingPid.has(pid)) continue;

          // ✅ media_type is now deterministic based on the list call
          const media_type: "image" | "video" = ct === "video" ? "video" : "image";

          const width = item?.dimensions?.width ?? item?.width ?? null;
          const height = item?.dimensions?.height ?? item?.height ?? null;
          const duration = item?.duration ?? null;

          const cover =
            item?.thumbnail_url ||
            item?.preview_url ||
            item?.cover_url ||
            null;

          // Start with whatever URL the item provides
          let url: string | null =
            item?.file_url || item?.url || item?.download_url || null;

          // Try download endpoint for a limited number per run (quota-safe)
          if ((!url || String(url).includes("null")) && downloadsUsed < DOWNLOADS_PER_RUN_CAP) {
            try {
              const dl = await vecteezyFetch(`/v2/${accountId}/resources/${id}/download`);
              const downloadUrl =
                dl?.download_url || dl?.url || dl?.data?.download_url || null;
              if (downloadUrl) {
                url = downloadUrl;
                downloadsUsed++;
              }
            } catch {
              // ignore
            }
          }

          if (!url || existingUrl.has(url)) continue;

          inserts.push({
            provider: "vecteezy",
            provider_asset_id,
            media_type,
            keyword: q,
            title: item?.title || item?.name || `Vecteezy ${media_type} ${id}`,
            url,
            cover_url: cover,
            duration,
            width,
            height,
            source_page: item?.page_url || item?.source_page || null,
            score: scoreAsset({ media_type, width, height, duration, keyword: q }),
            raw: item,
          });
        }

        // gentle delay between content types
        await sleep(MIN_DELAY_MS);
      }

      // gentle delay between keywords
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
        provider: "vecteezy",
        inserted: 0,
        downloadsUsed,
        reason: `No new assets (rotation day ${rotation.day}: ${rotation.label})`,
        rotation,
      });
    }

    const inserted = await insertChunk(finalInserts, 20);

    return NextResponse.json({
      ok: true,
      provider: "vecteezy",
      inserted,
      downloadsUsed,
      rotation,
    });
  } catch (err: any) {
    console.error("VECTEEZY CRON ERROR:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}