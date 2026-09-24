/**
 * Private Beta product-source policy.
 * Automated discovery defaults to WarriorPlus only.
 * PRODUCT_BETA_ENABLED_SOURCES may add sources later.
 * An empty or unset value never enables every indexed network.
 */

const DEFAULT_BETA_AUTOMATED_SOURCES = ["warriorplus"] as const;

export const BETA_MANUAL_SOURCE = "byo";

export function getBetaAutomatedSources(envValue?: string | null): string[] {
  const raw =
    envValue === undefined ? process.env.PRODUCT_BETA_ENABLED_SOURCES : envValue;

  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return [...DEFAULT_BETA_AUTOMATED_SOURCES];
  }

  const unique = [
    ...new Set(
      String(raw)
        .split(",")
        .map((part) => part.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];

  return unique.length > 0 ? unique : [...DEFAULT_BETA_AUTOMATED_SOURCES];
}

export function isBetaAutomatedSource(
  source: string,
  envValue?: string | null
): boolean {
  const key = String(source || "").trim().toLowerCase();
  if (!key || key === BETA_MANUAL_SOURCE) return false;
  return getBetaAutomatedSources(envValue).includes(key);
}

export function isBetaManualSource(source: string): boolean {
  return String(source || "").trim().toLowerCase() === BETA_MANUAL_SOURCE;
}

/** Private Beta has no source with verified commission semantics. */
export function customerFacingProductCommission(): null {
  return null;
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function warriorPlusTrackingMatches(
  affiliateUrl: string,
  subid: string
): boolean {
  const expected = String(subid || "").trim();
  if (!expected || !isHttpUrl(affiliateUrl)) return false;

  try {
    const url = new URL(affiliateUrl);
    return (
      url.searchParams.get("hop_sid") === expected &&
      url.searchParams.get("sid") === expected
    );
  } catch {
    return false;
  }
}
