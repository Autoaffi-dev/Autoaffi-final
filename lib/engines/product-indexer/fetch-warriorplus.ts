import type { IndexedProductInput } from "./types";

const WARRIORPLUS_SEEDS: IndexedProductInput[] = [
  {
    source: "warriorplus",
    external_id: "seed-001",
    title: "WarriorPlus Offer Seed 001",
    description: "Curated seed offer. User must be approved in program.",
    category: "make-money-online",
    product_url: "https://warriorplus.com/",
    landing_url: "https://warriorplus.com/",
    image_url: null,
    geo_scope: "worldwide",
    winner_tier: "seed",
  },
  // Lägg fler seeds här över tid (du kan ha 50–150 som onboard/winners)
];

export async function fetchProducts({ limit = 200 }: { limit?: number }) {
  return WARRIORPLUS_SEEDS.slice(0, limit);
}