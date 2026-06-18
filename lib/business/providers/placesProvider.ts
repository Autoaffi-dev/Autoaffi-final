import { BusinessSearchParams } from "../types";
import { RawPlaceResult } from "../normalize";

function getGoogleMapsApiKey() {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("Missing env: GOOGLE_MAPS_API_KEY");
  return key;
}

function buildTextQuery(
  params: Pick<BusinessSearchParams, "keyword" | "country" | "city">
) {
  const keyword = (params.keyword ?? "").trim();
  const city = (params.city ?? "").trim();
  const country = (params.country ?? "").trim();

  if (city && country) return `${keyword} in ${city} ${country}`;
  if (country) return `${keyword} in ${country}`;
  if (city) return `${keyword} in ${city}`;
  return keyword;
}

function toRawPlaceResult(p: any): RawPlaceResult {
  return {
    placeId: p.id,
    name: p.displayName?.text ?? "Unknown",
    category: p.primaryTypeDisplayName?.text ?? undefined,
    website: p.websiteUri ?? undefined,
    phone: p.internationalPhoneNumber ?? p.nationalPhoneNumber ?? undefined,
    rating: typeof p.rating === "number" ? p.rating : undefined,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shuffleArray<T>(items: T[]): T[] {
  const clone = [...items];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function dedupePlaces(items: RawPlaceResult[]): RawPlaceResult[] {
  const seen = new Set<string>();
  const out: RawPlaceResult[] = [];

  for (const item of items) {
    const key = item.placeId?.trim();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

async function fetchSearchTextPage(input: {
  key: string;
  textQuery: string;
  pageSize: number;
  pageToken?: string;
}) {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": input.key,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.websiteUri,places.nationalPhoneNumber,places.internationalPhoneNumber,places.rating,places.primaryTypeDisplayName,nextPageToken",
    },
    body: JSON.stringify({
      textQuery: input.textQuery,
      pageSize: input.pageSize,
      ...(input.pageToken ? { pageToken: input.pageToken } : {}),
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Places search failed: ${res.status} ${txt}`);
  }

  return res.json();
}

/**
 * Google Places API (New) – Text Search
 * Improvements:
 * - fetches multiple pages
 * - builds a larger candidate pool
 * - dedupes results
 * - shuffles final result set so reset/search can surface new companies
 */
export async function searchPlaces(
  params: BusinessSearchParams
): Promise<RawPlaceResult[]> {
  const key = getGoogleMapsApiKey();
  const textQuery = buildTextQuery(params);

  const requestedLimit = Number(params.limit ?? 20);
  const safeLimit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.round(requestedLimit))
    : 20;

  // Beast-mode candidate pool:
  // enough extra inventory so backend/UI can surface different companies
  const desiredCandidates = Math.min(60, Math.max(40, safeLimit * 4));
  const pageSize = 20;
  const maxPages = Math.max(1, Math.ceil(desiredCandidates / pageSize));

  const collected: RawPlaceResult[] = [];
  let nextPageToken: string | undefined;

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    if (pageIndex > 0) {
      if (!nextPageToken) break;

      // Google nextPageToken can require a short delay before becoming valid
      await sleep(1500);
    }

    const json = await fetchSearchTextPage({
      key,
      textQuery,
      pageSize,
      pageToken: nextPageToken,
    });

    const places = (json?.places ?? []) as any[];
    const mapped = places.map(toRawPlaceResult);

    collected.push(...mapped);
    nextPageToken =
      typeof json?.nextPageToken === "string" && json.nextPageToken.trim()
        ? json.nextPageToken.trim()
        : undefined;

    if (collected.length >= desiredCandidates) break;
    if (!nextPageToken) break;
  }

  const deduped = dedupePlaces(collected);

  // Important:
  // shuffle the full candidate pool before returning so the service layer,
  // which later slices results, has a better chance to surface new companies
  // on reset/new searches.
  return shuffleArray(deduped);
}

/**
 * Optional details (V1)
 * GET https://places.googleapis.com/v1/places/{placeId}
 */
export async function getPlaceDetails(
  placeId: string
): Promise<RawPlaceResult | null> {
  const key = getGoogleMapsApiKey();

  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "id,displayName,websiteUri,nationalPhoneNumber,internationalPhoneNumber,rating,primaryTypeDisplayName",
    },
  });

  if (!res.ok) return null;

  const p = await res.json();
  return toRawPlaceResult(p);
}