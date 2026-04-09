import type { BuildAffiliateLinkInput, BuildAffiliateLinkResult } from "../types";

export async function buildByoLink(
  input: BuildAffiliateLinkInput
): Promise<BuildAffiliateLinkResult> {
  return {
    affiliateLink: input.productUrl,
    productUrl: input.productUrl,
    subid: input.subid,
    network: "byo",
    meta: {
      mode: "direct",
    },
  };
}