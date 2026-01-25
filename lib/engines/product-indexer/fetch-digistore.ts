import type { IndexedProductInput } from "./types";

export async function fetchProducts({ limit = 200 }: { limit?: number }) {
  const url = "https://www.digistore24.com/en/search/products";
  const html = await fetch(url, {
    headers: {
      "User-Agent": "AutoaffiBot/1.0 (public catalog fetch)",
      Accept: "text/html",
    },
    cache: "no-store",
  }).then((r) => r.text());

  // Try find product ids
  const matches = [...html.matchAll(/product\/(\d+)/g)];
  const ids = [...new Set(matches.map((m) => m[1]))].slice(0, limit);

  const results: IndexedProductInput[] = ids.map((id) => ({
    source: "digistore",
    external_id: id,
    title: `Digistore Product ${id}`,
    description: null,
    category: "general",
    product_url: `https://www.digistore24.com/en/product/${id}`,
    landing_url: `https://www.digistore24.com/en/product/${id}`,
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