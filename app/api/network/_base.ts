import axios from "axios";

type NetworkName =
  | "clickbank"
  | "digistore24"
  | "awin"
  | "cj"
  | "impact"
  | "partnerstack"
  | "tradedoubler"
  | "rakuten"
  | "shareasale"
  | "amazon"
  | "metricool"
  | "tiktok"
  | "youtube"
  | "linkedin"
  | "instagram";

interface NetworkConfig {
  baseUrl: string;
  keyEnv: string;
  authHeader?: string;
}

const NETWORKS: Record<NetworkName, NetworkConfig> = {
  clickbank: {
    baseUrl: "https://api.clickbank.com/rest/1.3/",
    keyEnv: "CLICKBANK_API_KEY",
  },
  digistore24: {
    baseUrl: "https://www.digistore24.com/api/call/",
    keyEnv: "DIGISTORE24_API_KEY",
    authHeader: "X-DS-API-KEY",
  },
  awin: {
    baseUrl: "https://api.awin.com/",
    keyEnv: "AWIN_API_KEY",
  },
  cj: {
    baseUrl: "https://commission-detail.api.cj.com/v3/",
    keyEnv: "CJ_API_KEY",
    authHeader: "Authorization",
  },
  impact: {
    baseUrl: "https://api.impact.com/",
    keyEnv: "IMPACT_API_KEY",
  },
  partnerstack: {
    baseUrl: "https://api.partnerstack.com/v1/",
    keyEnv: "PARTNERSTACK_API_KEY",
  },
  tradedoubler: {
    baseUrl: "https://api.tradedoubler.com/1.0/",
    keyEnv: "TRADEDOUBLER_API_KEY",
  },
  rakuten: {
    baseUrl: "https://api.rakutenmarketing.com/",
    keyEnv: "RAKUTEN_API_KEY",
  },
  shareasale: {
    baseUrl: "https://api.shareasale.com/x.cfm?",
    keyEnv: "SHAREASALE_API_KEY",
  },
  amazon: {
    baseUrl: "https://webservices.amazon.com/paapi5/",
    keyEnv: "AMAZON_ASSOCIATES_KEY",
  },
  metricool: {
    baseUrl: "https://api.metricool.com/v2/",
    keyEnv: "METRICOOL_API_KEY",
  },
  tiktok: {
    baseUrl: "https://open.tiktokapis.com/v2/",
    keyEnv: "TIKTOK_API_KEY",
  },
  youtube: {
    baseUrl: "https://youtube.googleapis.com/youtube/v3/",
    keyEnv: "YOUTUBE_API_KEY",
  },
  linkedin: {
    baseUrl: "https://api.linkedin.com/v2/",
    keyEnv: "LINKEDIN_API_KEY",
  },
  instagram: {
    baseUrl: "https://graph.instagram.com/",
    keyEnv: "INSTAGRAM_API_KEY",
  },
};

export async function callAffiliateAPI(
  network: NetworkName,
  endpoint: string,
  params: Record<string, any> = {}
) {
  const config = NETWORKS[network];
  if (!config) {
    return { success: false, error: `Unknown network: ${network}` };
  }

  const apiKey = process.env[config.keyEnv];
  if (!apiKey) {
    return { success: false, error: `Missing API key for ${network}` };
  }

  const url = config.baseUrl + endpoint;

  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (config.authHeader) headers[config.authHeader] = apiKey;

    const res = await axios.get(url, { headers, params });
    return { success: true, data: res.data };
  } catch (error: any) {
    console.error(`❌ [${network}] API Error:`, error.message);
    return {
      success: false,
      error: error.message,
      status: error.response?.status,
      data: error.response?.data,
    };
  }
}