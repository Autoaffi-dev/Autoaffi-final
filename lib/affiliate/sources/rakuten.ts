import type { BuildAffiliateLinkInput, BuildAffiliateLinkResult } from "../types";

export async function buildRakutenLink(
  input: BuildAffiliateLinkInput
): Promise<BuildAffiliateLinkResult> {
  return {
    affiliateLink: input.productUrl,
    productUrl: input.productUrl,
    subid: input.subid,
    network: "rakuten",
    meta: {
      mode: "paused_until_reactivation",
    },
  };
}