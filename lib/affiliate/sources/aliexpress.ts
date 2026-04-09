import crypto from "crypto";
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

function buildAliExpressSignature(params: Record<string, string>, secret: string) {
  const sortedKeys = Object.keys(params).sort();

  let base = secret;
  for (const key of sortedKeys) {
    base += key + params[key];
  }
  base += secret;

  return crypto.createHash("md5").update(base, "utf8").digest("hex").toUpperCase();
}

export async function buildAliExpressLink(
  input: BuildAffiliateLinkInput
): Promise<BuildAffiliateLinkResult> {
  const productUrl = input.productUrl;

  if (!isValidUrl(productUrl)) {
    throw new Error("AliExpress requires a valid productUrl");
  }

  const appKey = String(process.env.ALIEXPRESS_APP_KEY || "").trim();
  const appSecret = String(process.env.ALIEXPRESS_APP_SECRET || "").trim();
  const apiUrl = String(process.env.ALIEXPRESS_API_URL || "").trim();
  const trackingId = String(process.env.ALIEXPRESS_TRACKING_ID || "").trim();
  const targetCurrency = String(process.env.ALIEXPRESS_TARGET_CURRENCY || "USD").trim();
  const targetLanguage = String(process.env.ALIEXPRESS_TARGET_LANGUAGE || "EN").trim();
  const shipToCountry = String(process.env.ALIEXPRESS_SHIP_TO_COUNTRY || "US").trim();

  // Beast-safe v1:
  // If config is missing, do not break saving. Fall back to source URL.
  if (!appKey || !appSecret || !apiUrl || !trackingId) {
    return {
      affiliateLink: productUrl,
      productUrl,
      subid: input.subid,
      network: "aliexpress",
      meta: {
        mode: "missing_env_fallback",
      },
    };
  }

  // NOTE:
  // This is the clean adapter location for the official AliExpress deeplink call.
  // If the endpoint/method in your account differs, you only update THIS file.
  const timestamp = new Date().toISOString().replace("Z", "000+0000");
  const params: Record<string, string> = {
    app_key: appKey,
    method: "aliexpress.affiliate.link.generate",
    timestamp,
    format: "json",
    v: "2.0",
    sign_method: "md5",
    promotion_link_type: "0",
    source_values: productUrl,
    tracking_id: trackingId,
    target_currency: targetCurrency,
    target_language: targetLanguage,
    ship_to_country: shipToCountry,
  };

  const sign = buildAliExpressSignature(params, appSecret);
  params.sign = sign;

  try {
    const body = new URLSearchParams(params).toString();

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
      cache: "no-store",
    });

    const json = await res.json().catch(() => null);

    // Flexible parse because AliExpress responses can vary by wrapper.
    const candidate =
      json?.aliexpress_affiliate_link_generate_response?.resp_result?.result?.promotion_links?.[0]
        ?.promotion_link ||
      json?.aliexpress_affiliate_link_generate_response?.result?.promotion_links?.[0]?.promotion_link ||
      json?.result?.promotion_links?.[0]?.promotion_link ||
      json?.promotion_links?.[0]?.promotion_link ||
      null;

    if (candidate && isValidUrl(candidate)) {
      return {
        affiliateLink: String(candidate),
        productUrl,
        subid: input.subid,
        network: "aliexpress",
        meta: {
          mode: "official_generated_link",
          trackingId,
        },
      };
    }

    return {
      affiliateLink: productUrl,
      productUrl,
      subid: input.subid,
      network: "aliexpress",
      meta: {
        mode: "generator_fallback",
        trackingId,
        responsePreview: json ? JSON.stringify(json).slice(0, 500) : null,
      },
    };
  } catch (error: any) {
    return {
      affiliateLink: productUrl,
      productUrl,
      subid: input.subid,
      network: "aliexpress",
      meta: {
        mode: "request_failed_fallback",
        trackingId,
        error: error?.message || "unknown_aliexpress_error",
      },
    };
  }
}