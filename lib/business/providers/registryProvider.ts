import { BusinessSearchParams } from "../types";
import { RawRegistryResult } from "../normalize";

function getOpenCorporatesToken() {
  const token = process.env.OPENCORPORATES_API_TOKEN;
  if (!token) throw new Error("Missing env: OPENCORPORATES_API_TOKEN");
  return token;
}

// Minimal size hint (heuristic, safe V1)
function sizeHintFromName(name: string): "SMALL" | "MID" | "LARGE" {
  const n = name.toLowerCase();
  if (n.includes("group") || n.includes("holding") || n.includes("international") || n.includes("plc")) return "LARGE";
  if (n.includes("ab") || n.includes("ltd") || n.includes("llc") || n.includes("inc") || n.includes("gmbh")) return "MID";
  return "SMALL";
}

/**
 * OpenCorporates: Companies Search
 * Docs endpoint typically:
 * GET https://api.opencorporates.com/v0.4/companies/search?q=...&api_token=...
 *
 * We keep V1 strict + light:
 * - Only returns registryId, name, country/jurisdiction/status + optional website/domain if present
 * - limit is clamped
 */
export async function searchRegistry(
  params: BusinessSearchParams
): Promise<RawRegistryResult[]> {
  const token = getOpenCorporatesToken();

  const q = String(params.keyword ?? "").trim();
  if (!q) return [];

  const country = params.country ? String(params.country).trim() : "";
  const limit = Math.min(50, Math.max(1, Number(params.limit ?? 20)));

  const url = new URL("https://api.opencorporates.com/v0.4/companies/search");
  url.searchParams.set("q", q);
  url.searchParams.set("api_token", token);

  // Optional filter if user selected a country (works for many jurisdictions)
  // OpenCorporates uses "jurisdiction_code" in many places; country naming varies.
  // We'll pass it when present. If API ignores it, fine.
  if (country) {
    url.searchParams.set("jurisdiction_code", country.toLowerCase());
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "User-Agent": "Autoaffi/1.0 (business-finder)",
    },
    // Next.js route is server-side. No caching in V1.
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenCorporates search failed: ${res.status} ${txt}`);
  }

  const json = await res.json();

  // OpenCorporates structure: results.companies[] where each item has company fields
  const companies = (json?.results?.companies ?? []) as any[];

  const out: RawRegistryResult[] = [];

  for (const item of companies.slice(0, limit)) {
    const c = item?.company ?? item;

    const name = String(c?.name ?? "").trim();
    if (!name) continue;

    const registryId =
      String(c?.company_number ?? c?.company_number ?? c?.opencorporates_url ?? c?.registry_url ?? "").trim() ||
      String(c?.opencorporates_url ?? "").trim() ||
      `${name}:${c?.jurisdiction_code ?? "unknown"}`;

    const jurisdiction = c?.jurisdiction_code ? String(c.jurisdiction_code).toUpperCase() : undefined;
    const status = c?.current_status ? String(c.current_status) : undefined;

    // Try pull a website if present (not always available)
    const website =
      (c?.homepage_url && String(c.homepage_url)) ||
      (c?.registry_url && String(c.registry_url)) ||
      undefined;

    // Domain (if website is real site)
    let domain: string | undefined;
    if (website) {
      try {
        const u = website.startsWith("http") ? new URL(website) : new URL(`https://${website}`);
        domain = u.hostname.replace(/^www\./i, "").toLowerCase();
      } catch {
        domain = undefined;
      }
    }

    out.push({
      registryId,
      name,
      country: jurisdiction, // good enough V1 (normalize will map)
      jurisdiction,
      status,
      website,
      domain,
      sizeHint: sizeHintFromName(name),
    });
  }

  return out;
}