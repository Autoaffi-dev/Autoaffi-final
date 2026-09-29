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

export function eligiblePostsSearchOffer<
  T extends { source?: string | null; external_id?: string | null }
>(
  offer: T | null | undefined,
  args: {
    platform?: string | null;
    selectedProductSource?: string | null;
    selectedProductExternalId?: string | null;
  }
): T | null {
  if (!offer) return null;

  const productSource = String(args.selectedProductSource || "").trim().toLowerCase();
  if (productSource) {
    const offerSource = String(offer.source || "").trim().toLowerCase();
    if (offerSource !== productSource) return null;
  }

  const productExternalId = args.selectedProductExternalId;
  if (typeof productExternalId === "string" && productExternalId !== "") {
    if (offer.external_id !== productExternalId) return null;
  }

  return eligiblePostsSavedOffer(offer, args.platform);
}

export function postsEligibleGoOfferId(args: {
  selectedSearchSavedOffer?: {
    id?: string | null;
    source?: string | null;
    external_id?: string | null;
  } | null;
  activeVaultOffer?: { id?: string | null; source?: string | null } | null;
  platform?: string | null;
  selectedProductSource?: string | null;
  selectedProductExternalId?: string | null;
}) {
  const search = eligiblePostsSearchOffer(args.selectedSearchSavedOffer, args);
  const vault = eligiblePostsSavedOffer(args.activeVaultOffer, args.platform);
  return String(search?.id || vault?.id || "");
}
