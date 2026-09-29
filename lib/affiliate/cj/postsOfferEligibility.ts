/**
 * Posts client eligibility for a saved offer.
 * CJ is Instagram-only. Other sources keep their existing identity.
 */

export function postsProductSyncKey(args: {
  source?: string | null;
  externalId?: string | null;
  platform?: string | null;
}) {
  const source = String(args.source ?? "");
  const externalId = String(args.externalId ?? "");
  if (!source || !externalId) return "";
  if (source.trim().toLowerCase() === "cj") {
    const platform = String(args.platform || "").trim().toLowerCase();
    return `cj:${externalId}:${platform}`;
  }
  return `${source}:${externalId}`;
}

export function eligiblePostsSavedOffer<T extends { source?: string | null }>(
  offer: T | null | undefined,
  platform?: string | null
): T | null {
  if (!offer) return null;
  if (String(offer.source || "").trim().toLowerCase() !== "cj") return offer;
  return String(platform || "").trim().toLowerCase() === "instagram" ? offer : null;
}

export function eligiblePostsSearchOffer<T extends { source?: string | null }>(
  offer: T | null | undefined,
  args: { platform?: string | null; selectedProductSource?: string | null }
): T | null {
  const productSource = String(args.selectedProductSource || "").trim().toLowerCase();
  const platform = String(args.platform || "").trim().toLowerCase();
  if (productSource === "cj" && platform !== "instagram") return null;
  return eligiblePostsSavedOffer(offer, args.platform);
}

export function postsEligibleGoOfferId(args: {
  selectedSearchSavedOffer?: { id?: string | null; source?: string | null } | null;
  activeVaultOffer?: { id?: string | null; source?: string | null } | null;
  platform?: string | null;
  selectedProductSource?: string | null;
}) {
  const search = eligiblePostsSearchOffer(args.selectedSearchSavedOffer, args);
  const vault = eligiblePostsSavedOffer(args.activeVaultOffer, args.platform);
  return String(search?.id || vault?.id || "");
}
