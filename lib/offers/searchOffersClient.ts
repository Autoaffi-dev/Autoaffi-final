export type OfferSource = "awin" | "cj" | "rakuten" | "warriorplus" | "aliexpress";

export type OfferSearchResult = {
  source: OfferSource;
  external_id: string;

  title: string;
  description?: string | null;

  merchant_name?: string | null;
  merchant_id?: string | null;

  category?: string | null;
  niche?: string | null;

  image_url?: string | null;
  deep_link?: string | null;

  price?: number | null;
  currency?: string | null;

  geo_scope?: string | null;
  winner_tier?: "A" | "B" | "C" | null;
  quality_score?: number | null;

  raw?: Record<string, any> | null;
};

export type OfferSearchResponse = {
  ok: boolean;
  query: string;
  limit: number;
  results: OfferSearchResult[];
};

export type OfferSearchParams = {
  q: string;
  limit?: number;
  sources?: OfferSource[];
  geo?: string;
  category?: string;
  niche?: string;
};

function buildQuery(params: OfferSearchParams) {
  const sp = new URLSearchParams();
  sp.set("q", params.q);
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.geo) sp.set("geo", params.geo);
  if (params.category) sp.set("category", params.category);
  if (params.niche) sp.set("niche", params.niche);
  if (params.sources?.length) sp.set("sources", params.sources.join(","));
  return sp.toString();
}

export async function searchOffersClient(
  params: OfferSearchParams,
  signal?: AbortSignal
): Promise<OfferSearchResponse> {
  const qs = buildQuery(params);
  const res = await fetch(`/api/offers/search?${qs}`, {
    method: "GET",
    headers: { accept: "application/json" },
    signal,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Offer search failed (${res.status}): ${text || res.statusText}`);
  }

  const json = (await res.json()) as OfferSearchResponse;
  if (!json?.ok) throw new Error("Offer search returned ok=false");
  return json;
}
