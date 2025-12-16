import { MegaEngine1 } from "@/lib/engines/mega-engine-1";
import {
  searchProductIndex,
  RawProductRecord,
} from "../product-indexer/indexer";
import {
  buildAffiliateLink,
  ProductPlatform,
} from "../affiliate/build-affiliate-link";

// ----------------------------------------------------------
// PLATFORM TYPE — must match ProductPlatform EXACTLY
// ----------------------------------------------------------

export type ProductSource = ProductPlatform;
// ProductPlatform: "digistore" | "mylead" | "cpalead" | "amazon" | "impact"

// ----------------------------------------------------------
// Result-typer
// ----------------------------------------------------------

export interface RawProductResult {
  id: string;
  title: string;
  description: string | null;
  epc: number;
  category: string | null;
  platform: ProductSource;
  productUrl: string;
}

export interface DiscoveredProduct extends RawProductResult {
  affiliateLink: string | null;
}

// ----------------------------------------------------------
// MAIN: discoverProductsForUser
// ----------------------------------------------------------

export async function discoverProductsForUser(
  userId: string,
  query: string,
  limit: number = 30
): Promise<DiscoveredProduct[]> {
  // 1) Hämta affiliate IDs via Mega Engine 1
  const userIds = await MegaEngine1.getAffiliateIdsForUser(userId);

  // 2) Hämta råa records från indexer
  const rawList: RawProductRecord[] = await searchProductIndex({
    query,
    limit,
  });

  // 3) Normalisera → RawProductResult
  const normalized: RawProductResult[] = rawList.map((item) => {
    const platform = inferPlatformFromUrl(item.url) as ProductSource;

    return {
      id: item.id,
      title: item.title,
      description: item.description ?? "",
      epc: item.epc ?? 0,
      category: item.category ?? "general",
      platform,
      productUrl: item.url,
    };
  });

  // 4) Lägg på affiliate-länkar
  const finalResults: DiscoveredProduct[] = normalized.map((product) => {
    const affiliateId = resolveAffiliateId(product.platform, userIds);

    return {
      ...product,
      affiliateLink:
        affiliateId != null
          ? buildAffiliateLink({
              platform: product.platform,
              affiliateId,
              productUrl: product.productUrl, // ✅ FIX: lägg till productUrl så BuildLinkInput matchar
            })
          : null,
    };
  });

  return finalResults;
}

// ----------------------------------------------------------
// Hjälpare: bestäm plattform utifrån URL
// ----------------------------------------------------------

function inferPlatformFromUrl(url: string): ProductSource {
  const lower = url.toLowerCase();

  if (lower.includes("digistore24.com")) return "digistore";
  if (lower.includes("mylead.global")) return "mylead";
  if (lower.includes("cpalead.com")) return "cpalead";
  if (lower.includes("amazon.")) return "amazon";
  if (lower.includes("impact.com") || lower.includes("impactradius.com"))
    return "impact";

  // fallback – behandla som digistore om vi inte vet bättre (v1.0)
  return "digistore";
}

// ----------------------------------------------------------
// Hjälpare: slå upp rätt affiliateId per plattform
// ----------------------------------------------------------

function resolveAffiliateId(
  platform: ProductSource,
  ids: Awaited<ReturnType<typeof MegaEngine1.getAffiliateIdsForUser>>
): string | null {
  switch (platform) {
    case "digistore":
      return ids.digistoreId ?? null;
    case "mylead":
      return ids.myleadId ?? null;
    case "cpalead":
      return ids.cpaleadId ?? null;
    case "amazon":
      return ids.amazonTag ?? null;
    case "impact":
      return ids.impactId ?? null;
    default:
      return null;
  }
}