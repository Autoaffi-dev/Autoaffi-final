import type { IndexedProductInput } from "./types";

export async function fetchProducts({ limit = 200 }: { limit?: number }) {
  const url = "https://mylead.global/en/campaigns";
  const html = await fetch(url, {
    headers: {
      "User-Agent": "AutoaffiBot/1.0 (public catalog fetch)",
      Accept: "text/html",
    },
    cache: "no-store",
  }).then((r) => r.text());

  // Try find campaign ids
  const matches = [...html.matchAll(/campaign\/(\d+)/g)];
  const ids = [...new Set(matches.map((m) => m[1]))].slice(0, limit);

  const results: IndexedProductInput[] = ids.map((id) => ({
    source: "mylead",
    external_id: id,
    title: `MyLead Campaign ${id}`,
    description: null,
    category: "general",
    product_url: `https://mylead.global/en/campaign/${id}`,
    landing_url: `https://mylead.global/en/campaign/${id}`,
    image_url: null,
    epc: null,
    commission: null,
    currency: null,
    price: null,
    score: null,
    quality_score: null,
    geo_scope: "worldwide",
    winner_tier: null,
  }));

  return results;
}