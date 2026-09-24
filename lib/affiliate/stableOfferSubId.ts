import crypto from "crypto";

/**
 * Canonical user_offers SubID.
 * Same user UUID + source + external id always returns the same value.
 */
export function buildStableSubId(
  userId: string,
  source: string,
  sourceOfferId: string
) {
  const shortUser = crypto.createHash("sha1").update(userId).digest("hex").slice(0, 6);

  const shortOffer = crypto
    .createHash("sha1")
    .update(`${source}:${sourceOfferId}`)
    .digest("hex")
    .slice(0, 6);

  return `aa_u_${shortUser}__src_${source}__of_${shortOffer}`;
}
