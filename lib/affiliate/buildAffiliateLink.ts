import type { BuildAffiliateLinkInput, BuildAffiliateLinkResult } from "./types";
import { buildAliExpressLink } from "./sources/aliexpress";
import { buildAwinLink } from "./sources/awin";
import { buildWarriorPlusLink } from "./sources/warriorplus";
import { buildCJLink } from "./sources/cj";
import { buildRakutenLink } from "./sources/rakuten";
import { buildByoLink } from "./sources/byo";

export async function buildAffiliateLink(
  input: BuildAffiliateLinkInput
): Promise<BuildAffiliateLinkResult> {
  const source = String(input.source || "").trim().toLowerCase();

  switch (source) {
    case "aliexpress":
      return buildAliExpressLink(input);

    case "awin":
      return buildAwinLink(input);

    case "warriorplus":
      return buildWarriorPlusLink(input);

    case "cj":
      return buildCJLink(input);

    case "rakuten":
      return buildRakutenLink(input);

    case "byo":
    case "manual":
      return buildByoLink(input);

    default:
      return {
        affiliateLink: input.productUrl,
        productUrl: input.productUrl,
        subid: input.subid,
        network: "unknown",
        meta: {
          mode: "unknown_source_fallback",
          source,
        },
      };
  }
}