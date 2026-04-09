import type { OfferSource } from "./subid";

/**
 * IMPORTANT:
 * - Different networks accept different "subid" formats/params.
 * - This file standardizes how we attach sub-id across networks.
 *
 * NOTE:
 * - Exact param naming can differ per advertiser/program.
 * - We keep a sane default and can override per-network later if needed.
 */

function safeUrl(u: string) {
  const s = String(u || "").trim();
  if (!s) return "";
  // Keep it as-is if it already looks like a URL
  return s;
}

function addParam(url: string, key: string, value: string) {
  const u = new URL(url);
  u.searchParams.set(key, value);
  return u.toString();
}

function addParamIfMissing(url: string, key: string, value: string) {
  const u = new URL(url);
  if (!u.searchParams.has(key)) u.searchParams.set(key, value);
  return u.toString();
}

/**
 * Build a tracked outbound link
 * - inputUrl should be the final product page OR affiliate deep link template.
 * - subId is Autoaffi's unique ID for payout matching.
 */
export function buildTrackedLink(args: {
  source: OfferSource;
  inputUrl: string;      // product_url or promotion_link
  subId: string;         // aa_v1_...
  // Optional “source platform” context e.g. ig/tiktok/youtube later
  sub2?: string | null;
  sub3?: string | null;
}): string {
  const raw = safeUrl(args.inputUrl);
  if (!raw) throw new Error("buildTrackedLink: missing inputUrl");
  const subId = String(args.subId || "").trim();
  if (!subId) throw new Error("buildTrackedLink: missing subId");

  // If it's not a valid URL, just return raw (avoid crash)
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return raw;
  }

  const source = args.source;

  /**
   * Defaults:
   * - AWIN: clickref is the standard subid parameter for reporting (commonly used).
   * - CJ: "sid" is commonly used in CJ deep links; some setups use "sid" or "cjdata" (cjdata is auto).
   * - WarriorPlus: often supports "source" or "subid" patterns depending on link type.
   * - AliExpress: many affiliate links already include tracking, but we can append "sub_aff_id" or "aff_fcid" style params in some contexts.
   * - Rakuten: often uses "u1" as subid parameter (Rakuten Linkshare legacy pattern).
   *
   * We pick safe defaults and can evolve per program later.
   */

  // AWIN
  if (source === "awin") {
    // clickref = subid
    return addParam(raw, "clickref", subId);
  }

  // CJ
  if (source === "cj") {
    // sid is commonly used
    let out = addParam(raw, "sid", subId);
    if (args.sub2) out = addParam(out, "sid2", String(args.sub2));
    if (args.sub3) out = addParam(out, "sid3", String(args.sub3));
    return out;
  }

  // Rakuten
  if (source === "rakuten") {
    // u1 is the typical Rakuten subid field
    let out = addParam(raw, "u1", subId);
    if (args.sub2) out = addParam(out, "u2", String(args.sub2));
    if (args.sub3) out = addParam(out, "u3", String(args.sub3));
    return out;
  }

  // WarriorPlus
  if (source === "warriorplus") {
    // Different formats exist, but a safe universal pattern is to append "source" / "subid"
    // We'll prefer "source" if not present (W+ often uses it in tracking).
    let out = raw;
    out = addParamIfMissing(out, "source", subId);
    // also set "subid" for compatibility (won't hurt if ignored)
    out = addParamIfMissing(out, "subid", subId);
    return out;
  }

  // AliExpress
  if (source === "aliexpress") {
    // Many AliExpress promotion links are already tracked.
    // We'll add a "sub_aff_id" if not present (common pattern in some AE affiliate tooling),
    // and also keep "aff_fcid" style if needed later.
    let out = raw;
    out = addParamIfMissing(out, "sub_aff_id", subId);
    out = addParamIfMissing(out, "subid", subId);
    return out;
  }

  // Default fallback: append a generic "subid"
  return addParam(raw, "subid", subId);
}
