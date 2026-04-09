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

export async function buildWarriorPlusLink(
  input: BuildAffiliateLinkInput
): Promise<BuildAffiliateLinkResult> {
  const base = input.productUrl;

  if (!isValidUrl(base)) {
    throw new Error("WarriorPlus requires a valid productUrl");
  }

  const url = new URL(base);

  // Beast v1:
  // WarriorPlus docs show sid / hop_sid / hop_tid usage.
  // We store user-level identity in hop_sid and context/campaign in hop_tid.
  if (!url.searchParams.get("hop_sid")) {
    url.searchParams.set("hop_sid", input.subid);
  }

  if (!url.searchParams.get("hop_tid")) {
    url.searchParams.set("hop_tid", input.context || input.campaign || "affiliate_offers");
  }

  // Keep sid too if vendor/pages consume sid directly.
  if (!url.searchParams.get("sid")) {
    url.searchParams.set("sid", input.subid);
  }

  return {
    affiliateLink: url.toString(),
    productUrl: input.productUrl,
    subid: input.subid,
    network: "warriorplus",
    meta: {
      mode: "tokenized",
      hop_sid: input.subid,
      hop_tid: input.context || input.campaign || "affiliate_offers",
    },
  };
}