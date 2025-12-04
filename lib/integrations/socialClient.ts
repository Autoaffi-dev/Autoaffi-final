export type SocialProvider =
  | "tiktok"
  | "instagram"
  | "youtube"
  | "linkedin"
  | "facebook"
  | "x"
  | "pinterest"
  | "metricool";

interface SocialStatus {
  provider: SocialProvider;
  connected: boolean;
  // Här kan du lägga tokens senare (lagrat i DB / Supabase)
  details?: Record<string, any>;
}

export async function getSocialStatus(
  provider: SocialProvider,
  userId: string
): Promise<SocialStatus> {
  // TODO: hämta från Supabase / DB
  // just nu mockar vi:
  return {
    provider,
    connected: false,
    details: {
      message:
        "Social connection not stored yet. This is a mock status. Connect real tokens via Settings > Social Accounts.",
    },
  };
}

export async function getSocialMetrics(options: {
  provider: SocialProvider;
  userId: string;
}): Promise<{
  provider: SocialProvider;
  mock: boolean;
  metrics: Record<string, number>;
}> {
  // TODO: hämta riktiga metrics via respektive API senare
  return {
    provider: options.provider,
    mock: true,
    metrics: {
      followers: 0,
      postsLast30Days: 0,
      avgViews: 0,
      avgClicks: 0,
    },
  };
}