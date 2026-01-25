import { BusinessSource, NormalizedBusinessTarget } from "./types";

/**
 * Normalize helpers (V1):
 * - Providers will return different fields; we standardize here.
 * - Keep it strict: source + sourceId must exist.
 */

export type RawPlaceResult = {
  placeId: string;
  name: string;
  country?: string;
  city?: string;
  category?: string;
  website?: string;
  phone?: string;
  rating?: number;
};

export type RawRegistryResult = {
  registryId: string;
  name: string;
  country?: string;
  jurisdiction?: string;
  status?: string;
  domain?: string;
  website?: string;
  sizeHint?: "SMALL" | "MID" | "LARGE";
};

export function normalizeFromPlaces(raw: RawPlaceResult): NormalizedBusinessTarget {
  return {
    source: "places",
    sourceId: raw.placeId,
    name: raw.name?.trim() ?? "Unknown",

    country: raw.country,
    city: raw.city,
    category: raw.category,

    website: raw.website,
    phone: raw.phone,
    rating: raw.rating,
  };
}

export function normalizeFromRegistry(raw: RawRegistryResult): NormalizedBusinessTarget {
  return {
    source: "registry",
    sourceId: raw.registryId,
    name: raw.name?.trim() ?? "Unknown",

    country: raw.country ?? raw.jurisdiction,
    website: raw.website,
    domain: raw.domain,
    sizeHint: raw.sizeHint,
  };
}

export function ensureSource(source: BusinessSource): BusinessSource {
  if (source !== "places" && source !== "registry") {
    throw new Error(`Invalid source: ${String(source)}`);
  }
  return source;
}