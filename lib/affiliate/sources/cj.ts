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

export async function buildCJLink(
  input: BuildAffiliateLinkInput
): Promise<BuildAffiliateLinkResult> {
  const base = input.productUrl;

  if (!isValidUrl(base)) {
    throw new Error("CJ requires a valid productUrl");
  }

  const url = new URL(base);

  // Beast-safe v1:
  // If the saved/product URL is already a CJ deeplink, preserve it and inject SID.
  // If it is not yet a CJ deeplink, we still keep the source URL for now and save SID in meta.
  if (
    url.hostname.includes("cj.com") ||
    url.hostname.includes("anrdoezrs.net") ||
    url.hostname.includes("tkqlhce.com") ||
    url.hostname.includes("dpbolvw.net") ||
    url.hostname.includes("jdoqocy.com")
  ) {
    if (!url.searchParams.get("sid")) {
      url.searchParams.set("sid", input.subid);
    }

    return {
      affiliateLink: url.toString(),
      productUrl: input.productUrl,
      subid: input.subid,
      network: "cj",
      meta: {
        mode: "sid_on_cj_link",
        sid: input.subid,
      },
    };
  }

  return {
    affiliateLink: input.productUrl,
    productUrl: input.productUrl,
    subid: input.subid,
    network: "cj",
    meta: {
      mode: "needs_cj_generated_deeplink",
      sid: input.subid,
    },
  };
}