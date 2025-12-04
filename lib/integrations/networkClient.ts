import { callAffiliateAPI } from "@/app/api/network/_base";

export async function fetchNetworkData(
  network: string,
  type: string = "offers"
) {
  let endpoint = "";

  switch (network) {
    case "clickbank":
      endpoint = type === "offers" ? "products/list" : "analytics/sales";
      break;
    case "digistore24":
      endpoint = type === "offers" ? "product/list" : "transaction/list";
      break;
    case "awin":
      endpoint = "publishers/transactions";
      break;
    case "cj":
      endpoint = "commissions";
      break;
    case "impact":
      endpoint = "Advertisers";
      break;
    case "partnerstack":
      endpoint = "campaigns";
      break;
    case "tradedoubler":
      endpoint = "affiliate";
      break;
    case "rakuten":
      endpoint = "network/1.0/getMerchants";
      break;
    case "shareasale":
      endpoint = "merchantApi";
      break;
    case "amazon":
      endpoint = "searchItems";
      break;
    case "metricool":
      endpoint = "posts";
      break;
    case "tiktok":
      endpoint = "data/insights";
      break;
    case "youtube":
      endpoint = "videos";
      break;
    case "linkedin":
      endpoint = "me";
      break;
    case "instagram":
      endpoint = "me/media";
      break;
    default:
      endpoint = "status";
  }

  return await callAffiliateAPI(network as any, endpoint);
}