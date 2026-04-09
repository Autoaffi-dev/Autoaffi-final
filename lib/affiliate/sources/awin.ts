import type { BuildAffiliateLinkInput, BuildAffiliateLinkResult } from "../types";

function isValidUrl(value?: string | null) {
  if (!value) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export async function buildAwinLink(
  input: BuildAffiliateLinkInput
): Promise<BuildAffiliateLinkResult> {
  const base = input.productUrl;

  if (!isValidUrl(base)) {
    throw new Error("Awin requires a valid productUrl");
  }

  const publisherId = String(process.env.AWIN_PUBLISHER_ID || "").trim();
  const url = new URL(base);

  // If already a generated Awin link, preserve it and append click refs.
  if (url.hostname.includes("awin1.com") || url.hostname.includes("awin.com")) {
    if (!url.searchParams.get("clickref")) {
      url.searchParams.set("clickref", input.subid);
    }

    if (!url.searchParams.get("clickref2")) {
      url.searchParams.set("clickref2", input.context || "affiliate_offers");
    }

    return {
      affiliateLink: url.toString(),
      productUrl: input.productUrl,
      subid: input.subid,
      network: "awin",
      meta: {
        mode: "clickref_on_awin_link",
        publisherId: publisherId || null,
        clickref: input.subid,
        clickref2: input.context || "affiliate_offers",
      },
    };
  }

  // Beast-safe v1:
  // We do not fake a final awin1 deeplink if it has not been generated yet.
  // We keep the product URL and preserve the clickref payload in meta.
  return {
    affiliateLink: input.productUrl,
    productUrl: input.productUrl,
    subid: input.subid,
    network: "awin",
    meta: {
      mode: "needs_awin_generated_deeplink",
      publisherId: publisherId || null,
      clickref: input.subid,
      clickref2: input.context || "affiliate_offers",
    },
  };
}