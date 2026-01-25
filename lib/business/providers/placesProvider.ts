import { BusinessSearchParams } from "../types";
import { RawPlaceResult } from "../normalize";

function getGoogleMapsApiKey() {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("Missing env: GOOGLE_MAPS_API_KEY");
  return key;
}

function buildTextQuery(params: Pick<BusinessSearchParams, "keyword" | "country" | "city">) {
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

/**
 * Google Places API (New) – Text Search
 * POST https://places.googleapis.com/v1/places:searchText
 * NOTE: max pageSize = 20 per request.
 */
export async function searchPlaces(params: BusinessSearchParams): Promise<RawPlaceResult[]> {
  const key = getGoogleMapsApiKey();

  const textQuery = buildTextQuery(params);
  const pageSize = Math.min(20, Math.max(1, Number(params.limit ?? 20)));

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      // FieldMask: bara det vi behöver för RawPlaceResult + normalize
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.websiteUri,places.nationalPhoneNumber,places.internationalPhoneNumber,places.rating,places.primaryTypeDisplayName",
    },
    body: JSON.stringify({
      textQuery,
      pageSize,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Places search failed: ${res.status} ${txt}`);
  }

  const json = await res.json();
  const places = (json?.places ?? []) as any[];

  return places.map(toRawPlaceResult);
}

/**
 * Optional details (V1)
 * GET https://places.googleapis.com/v1/places/{placeId}
 */
export async function getPlaceDetails(placeId: string): Promise<RawPlaceResult | null> {
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