import { cjReviewAllowsSocial, type CjProgramReviewSnapshot } from "./eligibility";
import { eligibleInstagramProperties } from "./searchGate";
import type { CjPropertyMappingRow } from "./propertyMapping";
import type { CjSocialAccountSnapshot } from "./socialAccountProperty";
import { assertStoredCjTrackingUrl } from "./trackingUrl";

/**
 * Local click decision for one stored CJ offer.
 * Review and Instagram eligibility are the same helpers used by search and save.
 * This does not call CJ and does not build a URL.
 */

export function resolveCjGoClick(args: {
  userId: string;
  merchantId?: string | null;
  affiliateLink?: string | null;
  subid?: string | null;
  account: CjSocialAccountSnapshot | null;
  properties: CjPropertyMappingRow[];
  review: CjProgramReviewSnapshot | null;
}): string | null {
  const userId = String(args.userId || "").trim();
  const advertiserId = String(args.merchantId || "").trim();
  if (!userId || !advertiserId) return null;
  if (!cjReviewAllowsSocial(args.review, advertiserId)) return null;

  let stored: { href: string; pid: string };
  try {
    stored = assertStoredCjTrackingUrl(
      String(args.affiliateLink || ""),
      String(args.subid || "")
    );
  } catch {
    return null;
  }

  const eligible = eligibleInstagramProperties({
    canonicalUserId: userId,
    account: args.account,
    properties: args.properties,
  });
  if (eligible.length !== 1) return null;
  if (String(eligible[0].cj_pid || "") !== stored.pid) return null;
  return stored.href;
}
