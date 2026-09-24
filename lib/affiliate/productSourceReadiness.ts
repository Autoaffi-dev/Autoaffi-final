/**
 * Private Beta product-source policy.
 *
 * BETA_TRACKING_READY_AUTOMATED_SOURCES is the only code-owned set that
 * may be shown as an automated Product source. Adding a network later
 * requires a tracking contract, tests, and a code change to this list.
 *
 * PRODUCT_BETA_ENABLED_SOURCES may only select from that set.
 * It cannot promote CJ, Awin, AliExpress, or any other source.
 *
 * Unset or blank env → the full ready set (currently warriorplus).
 * An explicit env whose intersection with the ready set is empty →
 * no automated sources. That never falls back to an unlisted network.
 */

export const BETA_TRACKING_READY_AUTOMATED_SOURCES = ["warriorplus"] as const;

export const BETA_MANUAL_SOURCE = "byo";

export function getBetaAutomatedSources(envValue?: string | null): string[] {
  const ready = BETA_TRACKING_READY_AUTOMATED_SOURCES.map((source) =>
    source.toLowerCase()
  );
  const raw =
    envValue === undefined ? process.env.PRODUCT_BETA_ENABLED_SOURCES : envValue;

  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return [...ready];
  }

  const requested = new Set(
    String(raw)
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean)
  );

  return ready.filter((source) => requested.has(source));
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
