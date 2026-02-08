import type { IndexedProductInput } from "./types";
import crypto from "crypto";

/**
 * WarriorPlus V1 = Curated Seed Bank
 * - Detta är INTE ett "open catalog" fetch.
 * - Du matar in winners/seeds manuellt (50-150 st är helt rimligt).
 * - Varje offer får stabilt external_id baserat på normaliserad URL.
 */

function normalizeUrl(raw: string) {
  try {
    const u = new URL(raw.trim());

    // Ta bort tracking/query så ID blir stabilt
    u.search = "";
    u.hash = "";

    // Standardisera trailing slash
    const s = u.toString();
    return s.endsWith("/") ? s.slice(0, -1) : s;
  } catch {
    return raw.trim();
  }
}

function stableId(input: string) {
  return crypto.createHash("sha1").update(input).digest("hex").slice(0, 12);
}

/**
 * Lägg in riktiga offers här.
 * Viktigt:
 * - product_url = den URL du vill att Autoaffi ska spara som "product url" i indexet
 * - landing_url = den URL kunden ska landa på (kan vara samma)
 * - Sätt title/description så det känns premium i UI.
 */
const RAW_WARRIORPLUS_SEEDS = [
  {
    title: "WarriorPlus Winner – Seed 001",
    description: "Curated offer. Approval required in WarriorPlus.",
    category: "make-money-online",
    product_url: "https://warriorplus.com/",
    landing_url: "https://warriorplus.com/",
    image_url: null,
    geo_scope: "worldwide",
    winner_tier: "seed",
  },

  // ✅ Exempel på hur du lägger fler:
  // {
  //   title: "WP Winner – Example Offer",
  //   description: "High converting offer (curated). Approval required.",
  //   category: "make-money-online",
  //   product_url: "https://vendor-or-offer-page.com/offer",
  //   landing_url: "https://vendor-or-offer-page.com/offer",
  //   image_url: "[https://.../image.png]https://.../image.png",
  //   geo_scope: "worldwide",
  //   winner_tier: "winner",
  // },
] as const;

function buildSeeds(): IndexedProductInput[] {
  return RAW_WARRIORPLUS_SEEDS
    .map((s) => {
      const productUrl = normalizeUrl(s.product_url);
      const landingUrl = s.landing_url ? normalizeUrl(s.landing_url) : productUrl;

      const idBase = productUrl || landingUrl;
      const external_id = `wp_${stableId(idBase)}`;

      const seed: IndexedProductInput = {
        source: "warriorplus",
        external_id,
        title: s.title,
        description: s.description,
        category: s.category,
        product_url: productUrl,
        landing_url: landingUrl,
        image_url: s.image_url ?? null,
        geo_scope: s.geo_scope,
        winner_tier: s.winner_tier,
      };

      return seed;
    })
    .filter((x) => !!x.product_url);
}

export async function fetchProducts({ limit = 200 }: { limit?: number }) {
  const seeds = buildSeeds();

  // extra safety: inga dubbletter
  const seen = new Set<string>();
  const unique = seeds.filter((p) => {
    const key = `${p.source}:${p.external_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.slice(0, limit);
}