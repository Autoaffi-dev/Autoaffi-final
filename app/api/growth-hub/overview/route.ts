import { NextResponse } from "next/server";
import {
  getSupabaseAdmin,
  requireUserId,
} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SupportedPlatform =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "youtube"
  | "linkedin"
  | "x";

type FrontendPlatform =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "youtube"
  | "linkedin"
  | "other";

type ConnectionStatus =
  | "connected"
  | "needs_reconnect"
  | "pending"
  | "not_connected";

type RecommendationPriority = "high" | "medium" | "low";

type RecommendationFormat =
  | "post"
  | "reel"
  | "short"
  | "carousel"
  | "video";

type RecommendationMode = "value" | "proof" | "offer";

type ContentMode = "VALUE" | "PROOF" | "OFFER";

type ConfidenceLevel = "high" | "medium" | "low";

type MetricKind =
  | "views"
  | "plays"
  | "reach"
  | "impressions"
  | "engagements";

type SocialAccountRow = {
  id: string;
  user_id: string;
  platform: SupportedPlatform;
  provider: string | null;
  status: string | null;
  username: string | null;
  account_id: string | null;
  token_expires_at: string | null;
  updated_at: string | null;
  meta: Record<string, any> | null;
};

type SocialPostRow = {
  user_id: string;
  platform: SupportedPlatform;
  account_id: string | null;
  post_id: string;
  permalink: string | null;
  caption: string | null;
  media_type: string | null;
  posted_at: string | null;
};

type SocialMetricRow = {
  user_id: string;
  platform: SupportedPlatform;
  post_id: string;
  likes: number | null;
  comments: number | null;
  views: number | null;
  plays: number | null;
  reach: number | null;
  impressions: number | null;
  fetched_at: string | null;
};

type GrowthRecommendation = {
  id: string;
  priority: RecommendationPriority;
  title: string;
  explanation: string;
  action: string;
  platform: string | null;
  format: RecommendationFormat | null;
  mode: RecommendationMode | null;
  topic: string | null;
  goal: string | null;
  cta: string | null;
};

type PublishingWindow = {
  platform: string | null;
  recommendedStart: string | null;
  recommendedEnd: string | null;
  expectedPeak: string | null;
  confidenceLevel: ConfidenceLevel | null;
  explanation: string | null;
};

type DailyGrowthPost = {
  platform: string;
  mode: ContentMode;
  topic: string;
  reason: string;
  algorithmNote: string;
  hook: string;
  alternativeHooks: string[];
  caption: string;
  cta: string;
  commentQuestion: string;
  hashtags: string[];
  visualIdea: string;
  imagePrompt: string;
  offerMeta: null;
};

type DailyGrowthReelScene = {
  timing: string;
  visual: string;
  voiceover: string;
  overlay: string;
  transition: string;
};

type DailyGrowthReel = {
  platform: string;
  mode: ContentMode;
  topic: string;
  reason: string;
  algorithmNote: string;
  durationSeconds: number;
  hook: string;
  alternativeHooks: string[];
  voiceover: string;
  scenes: DailyGrowthReelScene[];
  caption: string;
  cta: string;
  coverText: string;
  offerMeta: null;
};

type DailyGrowthContent = {
  contentDate: string;
  generationVersion: string;
  sourceType:
    | "real_social_data"
    | "settings_fallback"
    | "onboarding_fallback";
  confidenceLevel: ConfidenceLevel;
  publishingWindow: PublishingWindow | null;
  post: DailyGrowthPost;
  reel: DailyGrowthReel;
};

type RankedPlatformPost = {
  post: SocialPostRow;
  metric: SocialMetricRow | undefined;
  metricKind: MetricKind;
  metricValue: number;
};

type SupabaseAdminClient = any;

const DAY_MS = 24 * 60 * 60 * 1000;

function jsonError(status: number, payload: any) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

function sanitizeHeaderId(raw: string) {
  return String(raw || "")
    .trim()
    .replace(/^"+|"+$/g, "")
    .replace(/^'+|'+$/g, "");
}

function isUuid(value: string | null | undefined) {
  if (!value) return false;

  const cleaned = sanitizeHeaderId(value);

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    cleaned
  );
}

async function getEffectiveUserId(req: Request) {
  try {
    return await requireUserId(req);
  } catch {
    if (process.env.NODE_ENV === "production") {
      throw new Error("UNAUTHORIZED");
    }

    const headerUserId = sanitizeHeaderId(
      req.headers.get("x-autoaffi-user-id") || ""
    );

    const devUserId = sanitizeHeaderId(
      (process.env.NEXT_PUBLIC_DEV_USER_ID || "").trim() ||
        (process.env.DEV_USER_ID || "").trim() ||
        (process.env.AUTOAFFI_DEV_USER_ID || "").trim()
    );

    if (isUuid(headerUserId)) return headerUserId;
    if (isUuid(devUserId)) return devUserId;

    throw new Error("UNAUTHORIZED");
  }
}

function asString(value: unknown, fallback = "") {
  if (typeof value === "string") return value.trim();

  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value).trim();
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function safeDate(value: string | null | undefined) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function isAfter(
  value: string | null | undefined,
  threshold: Date
) {
  const date = safeDate(value);

  return Boolean(date && date.getTime() >= threshold.getTime());
}

function frontendPlatform(
  platform: SupportedPlatform
): FrontendPlatform {
  if (platform === "x") return "other";

  return platform;
}

function platformDisplayName(platform: SupportedPlatform) {
  switch (platform) {
    case "instagram":
      return "Instagram";
    case "facebook":
      return "Facebook";
    case "tiktok":
      return "TikTok";
    case "youtube":
      return "YouTube";
    case "linkedin":
      return "LinkedIn";
    case "x":
      return "X";
  }
}

function platformFromDisplayName(
  value: string | null | undefined
): SupportedPlatform | null {
  const normalized = asString(value).toLowerCase();

  if (normalized === "instagram") return "instagram";
  if (normalized === "facebook") return "facebook";
  if (normalized === "tiktok") return "tiktok";
  if (normalized === "youtube") return "youtube";
  if (normalized === "linkedin") return "linkedin";
  if (normalized === "x") return "x";

  return null;
}

function normalizeAccountStatus(
  value: unknown
): ConnectionStatus {
  const status = asString(value).toLowerCase();

  if (status === "connected") return "connected";

  if (
    status === "expired" ||
    status === "error" ||
    status === "needs_reconnect" ||
    status === "reconnect_required" ||
    status === "revoked"
  ) {
    return "needs_reconnect";
  }

  if (
    status === "pending" ||
    status === "connecting"
  ) {
    return "pending";
  }

  return "not_connected";
}

function resolveAccountStatus(
  account: SocialAccountRow
): ConnectionStatus {
  const normalized = normalizeAccountStatus(
    account.status
  );

  if (normalized !== "connected") {
    return normalized;
  }

  const expiresAt = safeDate(
    account.token_expires_at
  );

  if (
    expiresAt &&
    expiresAt.getTime() <= Date.now()
  ) {
    return "needs_reconnect";
  }

  return "connected";
}

function normalizeMediaType(
  platform: SupportedPlatform,
  value: unknown
): RecommendationFormat {
  const raw = asString(value).toLowerCase();

  if (raw.includes("carousel")) return "carousel";
  if (raw.includes("reel")) return "reel";
  if (raw.includes("short")) return "short";

  if (
    raw.includes("video") ||
    platform === "youtube"
  ) {
    return platform === "youtube"
      ? "video"
      : "reel";
  }

  return "post";
}

function normalizeTitle(
  caption: string | null,
  fallback: string
) {
  const value = asString(caption);

  if (!value) return fallback;

  const firstLine =
    value
      .split("\n")
      .map((part) => part.trim())
      .find(Boolean) || value;

  if (firstLine.length <= 90) {
    return firstLine;
  }

  return `${firstLine
    .slice(0, 87)
    .trim()}…`;
}

function normalizeTopic(
  caption: string | null,
  fallback: string
) {
  const title = normalizeTitle(
    caption,
    fallback
  );

  if (title.length <= 70) {
    return title;
  }

  return `${title
    .slice(0, 67)
    .trim()}…`;
}

function formatMetric(value: number) {
  return new Intl.NumberFormat("en", {
    notation:
      value >= 1_000
        ? "compact"
        : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function metricKindLabel(kind: MetricKind) {
  switch (kind) {
    case "views":
      return "Views";
    case "plays":
      return "Plays";
    case "reach":
      return "Reach";
    case "impressions":
      return "Impressions";
    case "engagements":
      return "Engagements";
  }
}

function engagementValue(
  metric: SocialMetricRow | undefined
): number | null {
  if (!metric) return null;

  const likes = asNumber(metric.likes);
  const comments = asNumber(metric.comments);

  if (likes === null && comments === null) {
    return null;
  }

  return (likes || 0) + (comments || 0);
}

function metricValueForKind(
  metric: SocialMetricRow | undefined,
  kind: MetricKind
): number | null {
  if (!metric) return null;

  switch (kind) {
    case "views":
      return asNumber(metric.views);

    case "plays":
      return asNumber(metric.plays);

    case "reach":
      return asNumber(metric.reach);

    case "impressions":
      return asNumber(metric.impressions);

    case "engagements":
      return engagementValue(metric);
  }
}

function hasAnyPerformanceMetric(
  metric: SocialMetricRow | undefined
) {
  if (!metric) return false;

  return (
    asNumber(metric.views) !== null ||
    asNumber(metric.plays) !== null ||
    asNumber(metric.reach) !== null ||
    asNumber(metric.impressions) !== null ||
    engagementValue(metric) !== null
  );
}

function getPreferredMetricKind(
  posts: SocialPostRow[],
  metricsByPost: Map<string, SocialMetricRow>
): MetricKind {
  const coverage: Record<MetricKind, number> = {
    views: 0,
    plays: 0,
    reach: 0,
    impressions: 0,
    engagements: 0,
  };

  for (const post of posts) {
    const metric = metricsByPost.get(
      `${post.platform}:${post.post_id}`
    );

    if (asNumber(metric?.views) !== null) {
      coverage.views += 1;
    }

    if (asNumber(metric?.plays) !== null) {
      coverage.plays += 1;
    }

    if (asNumber(metric?.reach) !== null) {
      coverage.reach += 1;
    }

    if (
      asNumber(metric?.impressions) !== null
    ) {
      coverage.impressions += 1;
    }

    if (engagementValue(metric) !== null) {
      coverage.engagements += 1;
    }
  }

  const priority: MetricKind[] = [
    "views",
    "plays",
    "reach",
    "impressions",
    "engagements",
  ];

  return priority.sort((a, b) => {
    const difference =
      coverage[b] - coverage[a];

    if (difference !== 0) {
      return difference;
    }

    return (
      priority.indexOf(a) -
      priority.indexOf(b)
    );
  })[0];
}

function latestSyncAt(
  account: SocialAccountRow
) {
  return (
    account.meta?.last_sync?.at ||
    account.updated_at ||
    null
  );
}

function lastSyncMode(
  account: SocialAccountRow
) {
  return asString(
    account.meta?.last_sync?.mode
  ).toLowerCase();
}

function profileUrl(
  account: SocialAccountRow
) {
  return (
    asString(
      account.meta?.profile_url ||
        account.meta?.profileUrl ||
        account.meta?.url
    ) || null
  );
}

function accountTimezone(
  account: SocialAccountRow | null | undefined
) {
  const timezone = asString(
    account?.meta?.timezone ||
      account?.meta?.time_zone ||
      account?.meta?.iana_timezone
  );

  if (!timezone) return null;

  try {
    new Intl.DateTimeFormat("en", {
      timeZone: timezone,
    }).format(new Date());

    return timezone;
  } catch {
    return null;
  }
}

function getStartOfToday() {
  const now = new Date();

  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
}

function getLastSevenCalendarDays() {
  const today = getStartOfToday();
  const days: Date[] = [];

  for (
    let index = 6;
    index >= 0;
    index -= 1
  ) {
    days.push(
      new Date(
        today.getTime() -
          index * DAY_MS
      )
    );
  }

  return days;
}

function sameCalendarDay(
  a: Date,
  b: Date
) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function scorePostingConsistency(
  postsLast30Days: SocialPostRow[]
) {
  if (postsLast30Days.length === 0) {
    return null;
  }

  const uniqueDays = new Set(
    postsLast30Days
      .map((post) =>
        safeDate(post.posted_at)
      )
      .filter(Boolean)
      .map(
        (date) =>
          `${date!.getFullYear()}-${date!.getMonth()}-${date!.getDate()}`
      )
  ).size;

  const activeDayScore = Math.min(
    100,
    (uniqueDays / 12) * 100
  );

  const volumeScore = Math.min(
    100,
    (postsLast30Days.length / 16) *
      100
  );

  return clampScore(
    activeDayScore * 0.65 +
      volumeScore * 0.35
  );
}

function scoreEngagementTrend(
  recentPosts: SocialPostRow[],
  previousPosts: SocialPostRow[],
  metricsByPost: Map<string, SocialMetricRow>
) {
  const recentValues = recentPosts
    .map((post) =>
      engagementValue(
        metricsByPost.get(
          `${post.platform}:${post.post_id}`
        )
      )
    )
    .filter(
      (value): value is number =>
        value !== null
    );

  const previousValues = previousPosts
    .map((post) =>
      engagementValue(
        metricsByPost.get(
          `${post.platform}:${post.post_id}`
        )
      )
    )
    .filter(
      (value): value is number =>
        value !== null
    );

  if (
    recentValues.length === 0 ||
    previousValues.length === 0
  ) {
    return null;
  }

  const recentAverage =
    recentValues.reduce(
      (sum, value) => sum + value,
      0
    ) / recentValues.length;

  const previousAverage =
    previousValues.reduce(
      (sum, value) => sum + value,
      0
    ) / previousValues.length;

  if (previousAverage === 0) {
    if (recentAverage === 0) {
      return 50;
    }

    return 75;
  }

  const change =
    (recentAverage - previousAverage) /
    previousAverage;

  return clampScore(
    50 + change * 50
  );
}

function scorePlatformActivity(
  accounts: SocialAccountRow[],
  recentPosts: SocialPostRow[]
) {
  const connectedPlatforms = Array.from(
    new Set(
      accounts
        .filter(
          (account) =>
            resolveAccountStatus(account) ===
            "connected"
        )
        .map(
          (account) => account.platform
        )
    )
  );

  if (
    connectedPlatforms.length === 0
  ) {
    return null;
  }

  const activePlatforms = new Set(
    recentPosts.map(
      (post) => post.platform
    )
  );

  const activeConnectedPlatforms =
    connectedPlatforms.filter((platform) =>
      activePlatforms.has(platform)
    ).length;

  return clampScore(
    (activeConnectedPlatforms /
      connectedPlatforms.length) *
      100
  );
}

function weightedAverage(
  values: Array<{
    score: number | null;
    weight: number;
  }>
) {
  const available = values.filter(
    (
      item
    ): item is {
      score: number;
      weight: number;
    } => item.score !== null
  );

  if (available.length === 0) {
    return null;
  }

  const totalWeight = available.reduce(
    (sum, item) =>
      sum + item.weight,
    0
  );

  if (totalWeight <= 0) {
    return null;
  }

  return clampScore(
    available.reduce(
      (sum, item) =>
        sum +
        item.score * item.weight,
      0
    ) / totalWeight
  );
}

function momentumLabel(
  score: number | null
) {
  if (score === null) return null;

  if (score >= 80) {
    return "Strong visibility momentum";
  }

  if (score >= 60) {
    return "Momentum is building";
  }

  if (score >= 40) {
    return "Visibility is warming up";
  }

  return "Your visibility needs fresh activity";
}

function rankTopPostsPerPlatform(
  posts: SocialPostRow[],
  metricsByPost: Map<string, SocialMetricRow>
) {
  const grouped = new Map<
    SupportedPlatform,
    SocialPostRow[]
  >();

  for (const post of posts) {
    const current =
      grouped.get(post.platform) || [];

    current.push(post);
    grouped.set(post.platform, current);
  }

  const ranked: RankedPlatformPost[] = [];

  for (const [
    platform,
    platformPosts,
  ] of grouped.entries()) {
    const metricKind =
      getPreferredMetricKind(
        platformPosts,
        metricsByPost
      );

    const sorted = [
      ...platformPosts,
    ].sort((a, b) => {
      const metricA =
        metricsByPost.get(
          `${a.platform}:${a.post_id}`
        );

      const metricB =
        metricsByPost.get(
          `${b.platform}:${b.post_id}`
        );

      const valueA =
        metricValueForKind(
          metricA,
          metricKind
        ) ?? -1;

      const valueB =
        metricValueForKind(
          metricB,
          metricKind
        ) ?? -1;

      if (valueB !== valueA) {
        return valueB - valueA;
      }

      return (
        (safeDate(
          b.posted_at
        )?.getTime() || 0) -
        (safeDate(
          a.posted_at
        )?.getTime() || 0)
      );
    });

    const topPost = sorted[0];

    if (!topPost) continue;

    const topMetric =
      metricsByPost.get(
        `${platform}:${topPost.post_id}`
      );

    ranked.push({
      post: topPost,
      metric: topMetric,
      metricKind,
      metricValue:
        metricValueForKind(
          topMetric,
          metricKind
        ) ?? 0,
    });
  }

  return ranked.sort((a, b) => {
    const aHasMetric =
      a.metricValue > 0 ? 1 : 0;

    const bHasMetric =
      b.metricValue > 0 ? 1 : 0;

    if (bHasMetric !== aHasMetric) {
      return bHasMetric - aHasMetric;
    }

    return (
      (safeDate(
        b.post.posted_at
      )?.getTime() || 0) -
      (safeDate(
        a.post.posted_at
      )?.getTime() || 0)
    );
  });
}

function buildRecommendations(args: {
  accounts: SocialAccountRow[];
  postsLast7Days: SocialPostRow[];
  postsLast30Days: SocialPostRow[];
  topPost: SocialPostRow | null;
  topMetric: SocialMetricRow | undefined;
  topMetricKind: MetricKind | null;
  engagementTrendScore: number | null;
}) {
  const {
    accounts,
    postsLast7Days,
    postsLast30Days,
    topPost,
    topMetric,
    topMetricKind,
    engagementTrendScore,
  } = args;

  const recommendations: GrowthRecommendation[] =
    [];

  const connectedAccounts =
    accounts.filter(
      (account) =>
        resolveAccountStatus(account) ===
        "connected"
    );

  if (postsLast7Days.length === 0) {
    const preferred =
      connectedAccounts.find(
        (account) =>
          account.platform ===
            "instagram" ||
          account.platform ===
            "tiktok" ||
          account.platform ===
            "youtube"
      ) || connectedAccounts[0];

    recommendations.push({
      id: "restart-publishing",
      priority: "high",
      title:
        "Restart your publishing rhythm",
      explanation:
        "Autoaffi has not found any main-content posts from your connected accounts during the last seven days.",
      action:
        "Publish one useful piece of content today. Focus on one clear problem your audience wants solved.",
      platform: preferred
        ? platformDisplayName(
            preferred.platform
          )
        : null,
      format:
        preferred?.platform ===
        "youtube"
          ? "short"
          : "reel",
      mode: "value",
      topic:
        "One useful lesson your audience can apply today",
      goal:
        "Restart consistency and create new visibility",
      cta:
        "Ask viewers which part they find most difficult",
    });
  }

  for (const account of connectedAccounts) {
    const platformPosts =
      postsLast7Days.filter(
        (post) =>
          post.platform ===
          account.platform
      );

    if (
      platformPosts.length === 0 &&
      postsLast7Days.length > 0
    ) {
      recommendations.push({
        id: `inactive-${account.platform}`,
        priority: "medium",
        title: `${platformDisplayName(
          account.platform
        )} needs fresh activity`,
        explanation: `Your account is connected, but Autoaffi has not found a new ${platformDisplayName(
          account.platform
        )} post during the last seven days.`,
        action:
          "Adapt one of your recent ideas for this platform instead of creating a completely new topic.",
        platform:
          platformDisplayName(
            account.platform
          ),
        format:
          account.platform ===
          "youtube"
            ? "short"
            : account.platform ===
                  "instagram" ||
                account.platform ===
                  "tiktok"
              ? "reel"
              : "post",
        mode: "value",
        topic:
          "Adapt your strongest recent idea for this platform",
        goal:
          "Increase cross-platform consistency",
        cta:
          "Ask the audience for their own experience",
      });
    }
  }

  if (topPost) {
    const title = normalizeTopic(
      topPost.caption,
      "Your strongest recent content"
    );

    const label = topMetricKind
      ? metricKindLabel(topMetricKind)
      : "activity";

    const value =
      topMetricKind !== null
        ? metricValueForKind(
            topMetric,
            topMetricKind
          ) || 0
        : 0;

    recommendations.push({
      id: "repurpose-top-content",
      priority:
        postsLast7Days.length > 0
          ? "high"
          : "medium",
      title:
        "Build on your strongest recent content",
      explanation:
        value > 0
          ? `"${title}" currently has the strongest available ${label.toLowerCase()} signal among the synced ${platformDisplayName(
              topPost.platform
            )} content Autoaffi can compare.`
          : `"${title}" is one of your most recent synced pieces of content.`,
      action:
        "Create a new variation with a different hook, one extra example and a clearer conversation-focused CTA.",
      platform:
        platformDisplayName(
          topPost.platform
        ),
      format: normalizeMediaType(
        topPost.platform,
        topPost.media_type
      ),
      mode: "proof",
      topic: title,
      goal:
        "Extend the life of an idea that already has evidence of audience interest",
      cta:
        "Ask the audience which variation they want next",
    });
  }

  if (
    engagementTrendScore !== null &&
    engagementTrendScore < 45 &&
    postsLast7Days.length > 0
  ) {
    const latestPost = [
      ...postsLast7Days,
    ].sort(
      (a, b) =>
        (safeDate(
          b.posted_at
        )?.getTime() || 0) -
        (safeDate(
          a.posted_at
        )?.getTime() || 0)
    )[0];

    recommendations.push({
      id: "improve-engagement",
      priority: "high",
      title:
        "Strengthen the opening and response prompt",
      explanation:
        "The available interaction average from the most recent seven days is below the preceding comparison period.",
      action:
        "Keep the next post focused on one problem, open with the result or tension immediately and end with one specific question.",
      platform: latestPost
        ? platformDisplayName(
            latestPost.platform
          )
        : null,
      format: latestPost
        ? normalizeMediaType(
            latestPost.platform,
            latestPost.media_type
          )
        : "post",
      mode: "value",
      topic:
        "A common mistake your audience can fix quickly",
      goal:
        "Improve meaningful comments and audience response",
      cta:
        "Ask readers to share the obstacle they face right now",
    });
  }

  if (
    postsLast30Days.length > 0 &&
    postsLast7Days.length > 0 &&
    recommendations.length === 0
  ) {
    const latestPost = [
      ...postsLast7Days,
    ].sort(
      (a, b) =>
        (safeDate(
          b.posted_at
        )?.getTime() || 0) -
        (safeDate(
          a.posted_at
        )?.getTime() || 0)
    )[0];

    recommendations.push({
      id: "maintain-momentum",
      priority: "medium",
      title:
        "Maintain your current publishing momentum",
      explanation:
        "Autoaffi can see recent publishing activity and no urgent visibility gap currently stands out.",
      action:
        "Publish another useful variation without changing topic too quickly. Consistency gives the platform more evidence about what works.",
      platform:
        platformDisplayName(
          latestPost.platform
        ),
      format: normalizeMediaType(
        latestPost.platform,
        latestPost.media_type
      ),
      mode: "value",
      topic: normalizeTopic(
        latestPost.caption,
        "A useful follow-up to your latest content"
      ),
      goal:
        "Maintain visibility and build a recognisable content series",
      cta:
        "Invite the audience to choose the next part",
    });
  }

  const unique = new Map<
    string,
    GrowthRecommendation
  >();

  for (const item of recommendations) {
    if (!unique.has(item.id)) {
      unique.set(item.id, item);
    }
  }

  return Array.from(
    unique.values()
  ).slice(0, 5);
}

function determineConfidenceLevel(args: {
  connectedAccounts: SocialAccountRow[];
  postsLast30Days: SocialPostRow[];
  metricsByPost: Map<string, SocialMetricRow>;
}) {
  const {
    connectedAccounts,
    postsLast30Days,
    metricsByPost,
  } = args;

  if (
    connectedAccounts.length === 0 ||
    postsLast30Days.length === 0
  ) {
    return "low" as const;
  }

  const postsWithMetrics =
    postsLast30Days.filter((post) =>
      hasAnyPerformanceMetric(
        metricsByPost.get(
          `${post.platform}:${post.post_id}`
        )
      )
    ).length;

  const uniquePublishingDays =
    new Set(
      postsLast30Days
        .map((post) =>
          safeDate(post.posted_at)
        )
        .filter(Boolean)
        .map(
          (date) =>
            `${date!.getFullYear()}-${date!.getMonth()}-${date!.getDate()}`
        )
    ).size;

  const metricCoverage =
    postsLast30Days.length > 0
      ? postsWithMetrics /
        postsLast30Days.length
      : 0;

  if (
    postsLast30Days.length >= 12 &&
    uniquePublishingDays >= 6 &&
    metricCoverage >= 0.7
  ) {
    return "high" as const;
  }

  if (
    postsLast30Days.length >= 5 &&
    uniquePublishingDays >= 3 &&
    metricCoverage >= 0.35
  ) {
    return "medium" as const;
  }

  return "low" as const;
}

function formatClockTime(
  hour: number,
  minute: number
) {
  const normalizedMinutes =
    ((hour * 60 + minute) %
      (24 * 60) +
      24 * 60) %
    (24 * 60);

  const normalizedHour =
    Math.floor(
      normalizedMinutes / 60
    );

  const normalizedMinute =
    normalizedMinutes % 60;

  return `${String(
    normalizedHour
  ).padStart(2, "0")}:${String(
    normalizedMinute
  ).padStart(2, "0")}`;
}

function getHourInTimezone(
  date: Date,
  timezone: string
) {
  const hourPart =
    new Intl.DateTimeFormat("en", {
      hour: "2-digit",
      hour12: false,
      timeZone: timezone,
    })
      .formatToParts(date)
      .find(
        (part) =>
          part.type === "hour"
      )?.value || "";

  const parsed = Number(hourPart);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed === 24 ? 0 : parsed;
}

function calculatePublishingWindow(args: {
  platform: SupportedPlatform | null;
  postsLast30Days: SocialPostRow[];
  metricsByPost: Map<string, SocialMetricRow>;
  account: SocialAccountRow | null;
  confidenceLevel: ConfidenceLevel;
}): PublishingWindow | null {
  const {
    platform,
    postsLast30Days,
    metricsByPost,
    account,
    confidenceLevel,
  } = args;

  if (!platform || !account) {
    return null;
  }

  const timezone =
    accountTimezone(account);

  if (!timezone) {
    return null;
  }

  const platformPosts =
    postsLast30Days.filter(
      (post) =>
        post.platform === platform
    );

  if (platformPosts.length < 8) {
    return null;
  }

  const preferredMetric =
    getPreferredMetricKind(
      platformPosts,
      metricsByPost
    );

  const usablePosts = platformPosts
    .map((post) => {
      const postedAt = safeDate(
        post.posted_at
      );

      const metric =
        metricsByPost.get(
          `${post.platform}:${post.post_id}`
        );

      const value =
        metricValueForKind(
          metric,
          preferredMetric
        );

      if (
        !postedAt ||
        value === null
      ) {
        return null;
      }

      const hour =
        getHourInTimezone(
          postedAt,
          timezone
        );

      if (hour === null) {
        return null;
      }

      return {
        hour,
        value,
      };
    })
    .filter(
      (
        item
      ): item is {
        hour: number;
        value: number;
      } => item !== null
    );

  if (usablePosts.length < 5) {
    return null;
  }

  const buckets = new Map<
    number,
    number[]
  >();

  for (const item of usablePosts) {
    const existing =
      buckets.get(item.hour) || [];

    existing.push(item.value);
    buckets.set(item.hour, existing);
  }

  const eligibleBuckets =
    Array.from(buckets.entries())
      .filter(
        ([, values]) =>
          values.length >= 2
      )
      .map(([hour, values]) => ({
        hour,
        count: values.length,
        average:
          values.reduce(
            (sum, value) =>
              sum + value,
            0
          ) / values.length,
      }));

  if (
    eligibleBuckets.length === 0
  ) {
    return null;
  }

  const strongest =
    eligibleBuckets.sort(
      (a, b) => {
        if (
          b.average !== a.average
        ) {
          return (
            b.average - a.average
          );
        }

        return b.count - a.count;
      }
    )[0];

  const peakMinutes =
    strongest.hour * 60 + 30;

  return {
    platform:
      platformDisplayName(platform),

    recommendedStart:
      formatClockTime(
        0,
        peakMinutes - 20
      ),

    recommendedEnd:
      formatClockTime(
        0,
        peakMinutes - 5
      ),

    expectedPeak:
      formatClockTime(
        0,
        peakMinutes
      ),

    confidenceLevel,

    explanation: `Based on ${strongest.count} comparable ${platformDisplayName(
      platform
    )} posts published around this time using ${metricKindLabel(
      preferredMetric
    ).toLowerCase()} as the available performance signal.`,
  };
}

function normalizeContentMode(
  value:
    | RecommendationMode
    | null
    | undefined
): ContentMode {
  if (value === "proof") {
    return "PROOF";
  }

  if (value === "offer") {
    return "OFFER";
  }

  return "VALUE";
}

function safeHashtag(
  value: string
) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/g)
    .filter(Boolean)
    .slice(0, 3)
    .join("");
}

function createTopicHashtags(
  topic: string,
  platform: string
) {
  const topicTag =
    safeHashtag(topic);

  const platformTag =
    safeHashtag(platform);

  const tags = [
    topicTag,
    platformTag
      ? `${platformTag}growth`
      : "",
    "contentstrategy",
  ].filter(Boolean);

  return Array.from(
    new Set(tags)
  ).slice(0, 3);
}

function shortenCoverText(
  topic: string
) {
  const words = topic
    .replace(/[^\w\s'-]/g, "")
    .split(/\s+/g)
    .filter(Boolean)
    .slice(0, 5);

  if (words.length === 0) {
    return "One Useful Idea";
  }

  return words.join(" ");
}

function buildDailyContent(args: {
  recommendation: GrowthRecommendation | null;
  connectedAccounts: SocialAccountRow[];
  postsLast30Days: SocialPostRow[];
  confidenceLevel: ConfidenceLevel;
  publishingWindow: PublishingWindow | null;
}) {
  const {
    recommendation,
    connectedAccounts,
    postsLast30Days,
    confidenceLevel,
    publishingWindow,
  } = args;

  const latestPost = [
    ...postsLast30Days,
  ].sort(
    (a, b) =>
      (safeDate(
        b.posted_at
      )?.getTime() || 0) -
      (safeDate(
        a.posted_at
      )?.getTime() || 0)
  )[0];

  const fallbackAccount =
    connectedAccounts.find(
      (account) =>
        account.platform ===
          "instagram" ||
        account.platform ===
          "tiktok" ||
        account.platform ===
          "youtube"
    ) || connectedAccounts[0];

  const platform =
    recommendation?.platform ||
    (latestPost
      ? platformDisplayName(
          latestPost.platform
        )
      : fallbackAccount
        ? platformDisplayName(
            fallbackAccount.platform
          )
        : "Instagram");

  const mode =
    normalizeContentMode(
      recommendation?.mode
    );

  const topic =
    asString(
      recommendation?.topic
    ) ||
    asString(
      recommendation?.title
    ) ||
    "One useful lesson your audience can apply today";

  const action =
    asString(
      recommendation?.action
    ) ||
    "Publish one useful piece of content today. Focus on one clear problem your audience wants solved.";

  const goal =
    asString(
      recommendation?.goal
    ) ||
    "Create useful content and encourage a meaningful audience response.";

  const recommendedCta =
    asString(
      recommendation?.cta
    ) ||
    "Ask the audience what they find most difficult right now.";

  const hasRealSocialData =
    connectedAccounts.length > 0 &&
    postsLast30Days.length > 0;

  const sourceType =
    hasRealSocialData
      ? ("real_social_data" as const)
      : connectedAccounts.length > 0
        ? ("settings_fallback" as const)
        : ("onboarding_fallback" as const);

  const reason =
    recommendation?.explanation ||
    (hasRealSocialData
      ? "Autoaffi selected this topic from your recent publishing activity, current consistency and available performance signals."
      : "This starter recommendation gives you a clear piece of content to publish while Growth Hub collects enough social activity.");

  const algorithmNote =
    hasRealSocialData
      ? "The structure uses one focused topic, an immediate opening, short readable sections and one low-friction audience action. Recommendations use only available synced activity and do not guarantee reach or engagement."
      : "Built with an algorithm-aware structure: one clear hook, one focused lesson, short readable sections and a low-friction next step. No reach, engagement or result is guaranteed.";

  const postHook =
    mode === "PROOF"
      ? `Your existing content already gives you a clue about what to create next.`
      : mode === "OFFER"
        ? `Before you promote anything, make the problem clear enough that the right person recognises it.`
        : `Most people make ${topic.toLowerCase()} harder than it needs to be.`;

  const alternativeHooks =
    mode === "PROOF"
      ? [
          "You do not always need a new topic. Sometimes you need a stronger version of what already worked.",
          "Your recent content can show you what your audience wants more of.",
          "Before changing direction, look at the idea that already earned attention.",
        ]
      : mode === "OFFER"
        ? [
            "A strong offer starts with a problem the audience already understands.",
            "Do not lead with the product. Lead with the change the audience wants.",
            "Promotion feels more natural when the lesson is useful before the link appears.",
          ]
        : [
            `One clear lesson about ${topic.toLowerCase()} is enough for today’s post.`,
            "Useful content becomes easier when you focus on one practical problem.",
            "The strongest post today may be the simplest idea your audience can apply immediately.",
          ];

  const postCaption =
    mode === "PROOF"
      ? `You do not always need to search for a completely new content idea.

Start with a topic that already received attention and improve the delivery.

Try this:
• Open with a clearer result or tension
• Add one new example
• Remove anything that distracts from the main lesson
• Finish with one specific response prompt

Today’s focus:
${action}

The goal is not to copy the old post. The goal is to build a stronger variation from evidence you already have.`
      : mode === "OFFER"
        ? `Promotion becomes easier when the audience understands the problem before they see the solution.

Start by explaining:
• What is making the problem difficult
• What a simpler approach looks like
• What the audience should check before choosing a solution
• Why the next step may be useful

Today’s focus:
${action}

Keep the message honest, specific and useful. Avoid unsupported claims and let the offer support the lesson instead of replacing it.`
        : `Useful content does not need to explain everything.

Choose one problem your audience already understands.
Give one practical lesson.
Show one simple next step.

Today’s focus:
${action}

The goal:
${goal}

Simple, focused content is easier to understand, easier to save and easier to respond to.`;

  const postCta =
    mode === "OFFER"
      ? "Comment LINK if you want to see the next step."
      : mode === "PROOF"
        ? "Comment NEXT if you want another variation of this idea."
        : "Comment GUIDE if you want the simple structure.";

  const conversationStarter =
    recommendedCta.endsWith("?")
      ? recommendedCta
      : `${recommendedCta.replace(
          /[.!]+$/g,
          ""
        )}?`;

  const visualIdea =
    mode === "PROOF"
      ? "A premium creator dashboard showing one recent content idea being transformed into a clearer new variation."
      : mode === "OFFER"
        ? "A clean visual showing a difficult audience problem on one side and a simpler structured solution on the other."
        : "A creator workspace where scattered notes are reduced into one clear practical lesson.";

  const imagePrompt =
    mode === "PROOF"
      ? `Create a premium vertical social media image showing a modern creator dashboard where one existing content idea is being transformed into a stronger new variation. Include subtle performance graphs, content cards and a clear improvement workflow. Dark charcoal and black background, warm gold highlights, cinematic lighting, crisp realistic details, high contrast, premium SaaS aesthetic, no logos, no brand names, no fake statistics, no unreadable text, 4:5 aspect ratio.`
      : mode === "OFFER"
        ? `Create a premium vertical social media image showing a clear audience problem being transformed into a practical structured solution. Dark charcoal and black background, warm gold highlights, subtle creator workflow elements, cinematic lighting, crisp realistic details, high contrast, premium SaaS aesthetic, no logos, no brand names, no income claims, no fake results, no unreadable text, 4:5 aspect ratio.`
        : `Create a premium vertical social media image representing the topic "${topic}". Show a modern creator workspace simplifying several scattered ideas into one clear practical lesson. Dark charcoal and black background, warm gold highlights, subtle social media interface elements, cinematic lighting, crisp realistic details, high contrast, premium SaaS aesthetic, no logos, no brand names, no fake metrics, no unreadable text, 4:5 aspect ratio.`;

  const reelHook =
    mode === "PROOF"
      ? "You may already have the idea for your next strong post."
      : mode === "OFFER"
        ? "Stop leading with the product before the audience understands the problem."
        : `Still making ${topic.toLowerCase()} harder than it needs to be?`;

  const reelVoiceover =
    mode === "PROOF"
      ? `You may already have the idea for your next strong post. Look at the recent topic that earned the clearest audience signal. Keep the useful core, change the opening, add one new example and finish with a more specific question. You do not need to copy the old content. You need to build a stronger variation from evidence you already have.`
      : mode === "OFFER"
        ? `Stop leading with the product before the audience understands the problem. Start with the difficulty they already recognise. Share one practical lesson. Explain what a good solution should help them do. Then present one honest next step without exaggerated claims. Useful promotion teaches first and invites action second.`
        : `Still making ${topic.toLowerCase()} harder than it needs to be? Start with one problem your audience already understands. Share one practical lesson. Give one clear next step. You do not need ten ideas today. You need one useful piece of content your audience can understand and apply.`;

  const scenes: DailyGrowthReelScene[] =
    mode === "PROOF"
      ? [
          {
            timing: "0–4 seconds",
            visual:
              "A creator looks at several recent posts inside a clean dashboard.",
            voiceover:
              "You may already have the idea for your next strong post.",
            overlay:
              "Your next idea may already exist",
            transition: "Fast cut",
          },
          {
            timing: "4–9 seconds",
            visual:
              "One recent topic is highlighted while the others fade back.",
            voiceover:
              "Look at the recent topic that earned the clearest audience signal.",
            overlay:
              "Find the clearest signal",
            transition: "Highlight zoom",
          },
          {
            timing: "9–15 seconds",
            visual:
              "The original opening is replaced with a clearer hook.",
            voiceover:
              "Keep the useful core and change the opening.",
            overlay:
              "Keep the idea · Improve the hook",
            transition: "Text swap",
          },
          {
            timing: "15–21 seconds",
            visual:
              "A new example is added to the content draft.",
            voiceover:
              "Add one new example and make the lesson easier to use.",
            overlay:
              "Add one new example",
            transition: "Slide up",
          },
          {
            timing: "21–28 seconds",
            visual:
              "The finished variation appears ready to publish.",
            voiceover:
              "Build a stronger variation from evidence you already have.",
            overlay:
              "Repeat the lesson · Improve the delivery",
            transition: "Smooth fade",
          },
        ]
      : mode === "OFFER"
        ? [
            {
              timing: "0–4 seconds",
              visual:
                "A product-first promotion is shown and quickly rejected.",
              voiceover:
                "Stop leading with the product before the audience understands the problem.",
              overlay:
                "Problem first · Product second",
              transition: "Fast cut",
            },
            {
              timing: "4–9 seconds",
              visual:
                "A clear audience problem appears on screen.",
              voiceover:
                "Start with the difficulty they already recognise.",
              overlay:
                "Name the real problem",
              transition: "Clean zoom",
            },
            {
              timing: "9–15 seconds",
              visual:
                "One practical lesson is demonstrated.",
              voiceover:
                "Share one practical lesson before mentioning the solution.",
              overlay:
                "Teach something useful",
              transition: "Swipe transition",
            },
            {
              timing: "15–21 seconds",
              visual:
                "A simple solution checklist appears.",
              voiceover:
                "Explain what a good solution should help them do.",
              overlay:
                "Show what good looks like",
              transition: "Checklist pop-in",
            },
            {
              timing: "21–28 seconds",
              visual:
                "One honest CTA appears without exaggerated claims.",
              voiceover:
                "Then present one honest next step. Teach first and invite action second.",
              overlay:
                "Useful first · Action second",
              transition: "Smooth fade",
            },
          ]
        : [
            {
              timing: "0–4 seconds",
              visual:
                "A creator looks overwhelmed by too many notes and content ideas.",
              voiceover:
                `Still making ${topic.toLowerCase()} harder than it needs to be?`,
              overlay:
                "Making it too complicated?",
              transition: "Fast cut",
            },
            {
              timing: "4–9 seconds",
              visual:
                "The notes are reduced until one clear problem remains.",
              voiceover:
                "Start with one problem your audience already understands.",
              overlay:
                "Choose one problem",
              transition: "Swipe away",
            },
            {
              timing: "9–14 seconds",
              visual:
                "One practical lesson appears inside a clean content draft.",
              voiceover:
                "Share one practical lesson.",
              overlay:
                "One useful lesson",
              transition: "Quick zoom",
            },
            {
              timing: "14–20 seconds",
              visual:
                "One clear audience action is selected.",
              voiceover:
                "Give one clear next step.",
              overlay:
                "One clear next step",
              transition: "Snap transition",
            },
            {
              timing: "20–28 seconds",
              visual:
                "The finished content appears ready to publish.",
              voiceover:
                "You do not need ten ideas today. You need one useful piece of content your audience can understand and apply.",
              overlay:
                "Simple · Useful · Clear",
              transition: "Smooth fade",
            },
          ];

  const hashtags =
    createTopicHashtags(
      topic,
      platform
    );

  const coverText =
    mode === "PROOF"
      ? "Build On What Worked"
      : mode === "OFFER"
        ? "Problem First"
        : shortenCoverText(topic);

  const dailyContent: DailyGrowthContent =
    {
      contentDate:
        new Date().toISOString(),

      generationVersion:
        "growth-hub-backend-v1",

      sourceType,
      confidenceLevel,
      publishingWindow,

      post: {
        platform,
        mode,
        topic,
        reason,
        algorithmNote,
        hook: postHook,
        alternativeHooks,
        caption: postCaption,
        cta: postCta,
        commentQuestion:
          conversationStarter,
        hashtags,
        visualIdea,
        imagePrompt,
        offerMeta: null,
      },

      reel: {
        platform,
        mode,
        topic,
        reason,
        algorithmNote,
        durationSeconds: 28,
        hook: reelHook,
        alternativeHooks,
        voiceover: reelVoiceover,
        scenes,
        caption: `${postCaption}

${postCta}`,
        cta: postCta,
        coverText,
        offerMeta: null,
      },
    };

  return dailyContent;
}

export async function GET(
  req: Request
) {
  try {
    const userId =
      await getEffectiveUserId(req);

    const supabase =
      getSupabaseAdmin() as SupabaseAdminClient;

    const now = new Date();

    const sevenDaysAgo = new Date(
      now.getTime() - 7 * DAY_MS
    );

    const fourteenDaysAgo =
      new Date(
        now.getTime() -
          14 * DAY_MS
      );

    const thirtyDaysAgo = new Date(
      now.getTime() -
        30 * DAY_MS
    );

    const [
      accountsResult,
      postsResult,
      metricsResult,
    ] = await Promise.all([
      supabase
        .from(
          "user_social_accounts"
        )
        .select(
          [
            "id",
            "user_id",
            "platform",
            "provider",
            "status",
            "username",
            "account_id",
            "token_expires_at",
            "updated_at",
            "meta",
          ].join(",")
        )
        .eq("user_id", userId)
        .order("platform", {
          ascending: true,
        }),

      supabase
        .from("social_posts")
        .select(
          [
            "user_id",
            "platform",
            "account_id",
            "post_id",
            "permalink",
            "caption",
            "media_type",
            "posted_at",
          ].join(",")
        )
        .eq("user_id", userId)
        .gte(
          "posted_at",
          thirtyDaysAgo.toISOString()
        )
        .order("posted_at", {
          ascending: false,
        })
        .limit(500),

      supabase
        .from(
          "social_post_metrics"
        )
        .select(
          [
            "user_id",
            "platform",
            "post_id",
            "likes",
            "comments",
            "views",
            "plays",
            "reach",
            "impressions",
            "fetched_at",
          ].join(",")
        )
        .eq("user_id", userId)
        .order("fetched_at", {
          ascending: false,
        })
        .limit(1000),
    ]);

    if (accountsResult.error) {
      return jsonError(500, {
        ok: false,
        error:
          "GROWTH_HUB_ACCOUNTS_FAILED",
        details:
          accountsResult.error.message,
      });
    }

    if (postsResult.error) {
      return jsonError(500, {
        ok: false,
        error:
          "GROWTH_HUB_POSTS_FAILED",
        details:
          postsResult.error.message,
      });
    }

    if (metricsResult.error) {
      return jsonError(500, {
        ok: false,
        error:
          "GROWTH_HUB_METRICS_FAILED",
        details:
          metricsResult.error.message,
      });
    }

    const accounts =
      (accountsResult.data ||
        []) as SocialAccountRow[];

    const allPosts =
      (postsResult.data ||
        []) as SocialPostRow[];

    const metricRows =
      (metricsResult.data ||
        []) as SocialMetricRow[];

    const metricsByPost = new Map<
      string,
      SocialMetricRow
    >();

    for (const metric of metricRows) {
      const key = `${metric.platform}:${metric.post_id}`;

      if (!metricsByPost.has(key)) {
        metricsByPost.set(
          key,
          metric
        );
      }
    }

    const connectedAccounts =
      accounts.filter(
        (account) =>
          resolveAccountStatus(
            account
          ) === "connected"
      );

    const postsLast7Days =
      allPosts.filter((post) =>
        isAfter(
          post.posted_at,
          sevenDaysAgo
        )
      );

    const postsPrevious7Days =
      allPosts.filter(
        (post) =>
          isAfter(
            post.posted_at,
            fourteenDaysAgo
          ) &&
          !isAfter(
            post.posted_at,
            sevenDaysAgo
          )
      );

    const postsLast30Days =
      allPosts.filter((post) =>
        isAfter(
          post.posted_at,
          thirtyDaysAgo
        )
      );

    const consistencyScore =
      scorePostingConsistency(
        postsLast30Days
      );

    const engagementTrendScore =
      scoreEngagementTrend(
        postsLast7Days,
        postsPrevious7Days,
        metricsByPost
      );

    const platformActivityScore =
      scorePlatformActivity(
        accounts,
        postsLast7Days
      );

    const overallMomentumScore =
      weightedAverage([
        {
          score: consistencyScore,
          weight: 0.5,
        },
        {
          score:
            engagementTrendScore,
          weight: 0.3,
        },
        {
          score:
            platformActivityScore,
          weight: 0.2,
        },
      ]);

    const platformInsights =
      accounts.map((account) => {
        const resolvedStatus =
          resolveAccountStatus(
            account
          );

        const platformPosts30 =
          postsLast30Days.filter(
            (post) =>
              post.platform ===
              account.platform
          );

        const platformPosts7 =
          postsLast7Days.filter(
            (post) =>
              post.platform ===
              account.platform
          );

        const platformConsistency =
          resolvedStatus ===
          "connected"
            ? scorePostingConsistency(
                platformPosts30
              )
            : null;

        const platformMetrics =
          platformPosts7
            .map((post) =>
              metricsByPost.get(
                `${post.platform}:${post.post_id}`
              )
            )
            .filter(
              Boolean
            ) as SocialMetricRow[];

        const hasViews =
          platformMetrics.some(
            (metric) =>
              asNumber(
                metric.views
              ) !== null
          );

        const hasImpressions =
          platformMetrics.some(
            (metric) =>
              asNumber(
                metric.impressions
              ) !== null
          );

        const hasReach =
          platformMetrics.some(
            (metric) =>
              asNumber(
                metric.reach
              ) !== null
          );

        const hasEngagements =
          platformMetrics.some(
            (metric) =>
              engagementValue(
                metric
              ) !== null
          );

        const totalViews =
          platformMetrics.reduce(
            (sum, metric) =>
              sum +
              (asNumber(
                metric.views
              ) || 0),
            0
          );

        const totalImpressions =
          platformMetrics.reduce(
            (sum, metric) =>
              sum +
              (asNumber(
                metric.impressions
              ) || 0),
            0
          );

        const totalReach =
          platformMetrics.reduce(
            (sum, metric) =>
              sum +
              (asNumber(
                metric.reach
              ) || 0),
            0
          );

        const totalEngagements =
          platformMetrics.reduce(
            (sum, metric) =>
              sum +
              (engagementValue(
                metric
              ) || 0),
            0
          );

        const lastPublishedAt =
          platformPosts30
            .map((post) =>
              safeDate(
                post.posted_at
              )
            )
            .filter(Boolean)
            .sort(
              (a, b) =>
                b!.getTime() -
                a!.getTime()
            )[0]?.toISOString() ||
          null;

        const mode =
          lastSyncMode(account);

        let note: string;

        if (
          resolvedStatus ===
          "needs_reconnect"
        ) {
          note =
            "This account needs to be reconnected before Autoaffi can continue syncing new activity.";
        } else if (
          resolvedStatus ===
          "pending"
        ) {
          note =
            "The account connection is still pending.";
        } else if (
          resolvedStatus !==
          "connected"
        ) {
          note =
            "This account is not currently connected.";
        } else if (mode === "stub") {
          note =
            "The account is connected. Full performance sync will activate after the required platform API access is approved.";
        } else if (
          platformPosts7.length === 0
        ) {
          note =
            "No synced main-content posts were found during the last seven days.";
        } else if (
          platformPosts7.length === 1
        ) {
          note =
            "One synced post was found during the last seven days. Another publishing day would strengthen consistency.";
        } else {
          note = `${platformPosts7.length} synced posts were found during the last seven days.`;
        }

        return {
          platform:
            frontendPlatform(
              account.platform
            ),

          displayName:
            platformDisplayName(
              account.platform
            ),

          status: resolvedStatus,

          username:
            account.username || null,

          profileUrl:
            profileUrl(account),

          postsLast7Days:
            resolvedStatus ===
            "connected"
              ? platformPosts7.length
              : 0,

          postsLast30Days:
            resolvedStatus ===
            "connected"
              ? platformPosts30.length
              : 0,

          viewsLast7Days:
            hasViews
              ? totalViews
              : null,

          impressionsLast7Days:
            hasImpressions
              ? totalImpressions
              : null,

          reachLast7Days:
            hasReach
              ? totalReach
              : null,

          engagementsLast7Days:
            hasEngagements
              ? totalEngagements
              : null,

          profileVisitsLast7Days:
            null,

          consistencyScore:
            platformConsistency,

          visibilityScore:
            platformConsistency,

          lastPublishedAt,
          note,
        };
      });

    const weeklyActivity =
      getLastSevenCalendarDays().map(
        (day) => {
          if (
            connectedAccounts.length ===
            0
          ) {
            return {
              date: day.toISOString(),

              label:
                new Intl.DateTimeFormat(
                  "en",
                  {
                    weekday: "short",
                  }
                ).format(day),

              posts: 0,

              status:
                "unknown" as const,

              reason:
                "Connect a supported social account to activate this day.",
            };
          }

          const dayPosts =
            postsLast7Days.filter(
              (post) => {
                const postedAt =
                  safeDate(
                    post.posted_at
                  );

                return Boolean(
                  postedAt &&
                    sameCalendarDay(
                      postedAt,
                      day
                    )
                );
              }
            );

          const posts =
            dayPosts.length;

          return {
            date: day.toISOString(),

            label:
              new Intl.DateTimeFormat(
                "en",
                {
                  weekday: "short",
                }
              ).format(day),

            posts,

            status:
              posts >= 2
                ? ("good" as const)
                : posts === 1
                  ? ("ok" as const)
                  : ("bad" as const),

            reason:
              posts >= 2
                ? `${posts} main-content posts published`
                : posts === 1
                  ? "One main-content post published"
                  : "No synced main-content post",
          };
        }
      );

    const rankedPlatformPosts =
      rankTopPostsPerPlatform(
        postsLast30Days,
        metricsByPost
      );

    const topContent =
      rankedPlatformPosts
        .slice(0, 5)
        .map((item) => {
          const {
            post,
            metricKind,
            metricValue,
          } = item;

          const format =
            normalizeMediaType(
              post.platform,
              post.media_type
            );

          return {
            id: `${post.platform}:${post.post_id}`,

            platform:
              frontendPlatform(
                post.platform
              ),

            platformLabel:
              platformDisplayName(
                post.platform
              ),

            title: normalizeTitle(
              post.caption,
              `${platformDisplayName(
                post.platform
              )} ${format}`
            ),

            contentType: format,

            metricLabel:
              metricKindLabel(
                metricKind
              ),

            metricValue,

            metricFormatted:
              metricValue > 0
                ? formatMetric(
                    metricValue
                  )
                : "Synced",

            publishedAt:
              post.posted_at,

            sourceUrl:
              post.permalink,

            recommendation:
              metricValue > 0
                ? "Create a new variation with a different opening and one additional example."
                : "Use this synced content as a starting point for a fresh variation.",
          };
        });

    const strongestPlatformPost =
      rankedPlatformPosts[0] ||
      null;

    const topPost =
      strongestPlatformPost?.post ||
      null;

    const topMetric =
      strongestPlatformPost?.metric;

    const topMetricKind =
      strongestPlatformPost?.metricKind ||
      null;

    const recommendations =
      buildRecommendations({
        accounts,
        postsLast7Days,
        postsLast30Days,
        topPost,
        topMetric,
        topMetricKind,
        engagementTrendScore,
      });

    const primaryRecommendation =
      recommendations[0] || null;

    const confidenceLevel =
      determineConfidenceLevel({
        connectedAccounts,
        postsLast30Days,
        metricsByPost,
      });

    const requestedPlatform =
      platformFromDisplayName(
        primaryRecommendation?.platform
      );

    const publishingPlatform =
      requestedPlatform ||
      topPost?.platform ||
      connectedAccounts[0]
        ?.platform ||
      null;

    const publishingAccount =
      publishingPlatform
        ? connectedAccounts.find(
            (account) =>
              account.platform ===
              publishingPlatform
          ) || null
        : null;

    const publishingWindow =
      calculatePublishingWindow({
        platform:
          publishingPlatform,
        postsLast30Days,
        metricsByPost,
        account:
          publishingAccount,
        confidenceLevel,
      });

    const dailyContent =
      buildDailyContent({
        recommendation:
          primaryRecommendation,
        connectedAccounts,
        postsLast30Days,
        confidenceLevel,
        publishingWindow,
      });

    const lastSyncedAt =
      connectedAccounts
        .map((account) =>
          safeDate(
            latestSyncAt(account)
          )
        )
        .filter(Boolean)
        .sort(
          (a, b) =>
            b!.getTime() -
            a!.getTime()
        )[0]?.toISOString() ||
      null;

    const hasFullSync =
      connectedAccounts.some(
        (account) =>
          lastSyncMode(
            account
          ) === "full"
      );

    return NextResponse.json(
      {
        ok: true,

        overview: {
          generatedAt:
            new Date().toISOString(),

          hasConnectedAccounts:
            connectedAccounts.length > 0,

          connectedAccountCount:
            connectedAccounts.length,

          momentumScore:
            overallMomentumScore,

          momentumLabel:
            momentumLabel(
              overallMomentumScore
            ),

          momentumBreakdown: [
            {
              key:
                "posting-consistency",

              label:
                "Posting consistency",

              score:
                consistencyScore,

              explanation:
                consistencyScore ===
                null
                  ? "More publishing activity is required."
                  : "Based on real publishing days and main-content volume from the last 30 days.",
            },
            {
              key:
                "engagement-trend",

              label:
                "Engagement trend",

              score:
                engagementTrendScore,

              explanation:
                engagementTrendScore ===
                null
                  ? "Two comparable periods with interaction data are required."
                  : "Compares average likes and comments from the latest seven days with the preceding seven days.",
            },
            {
              key:
                "platform-activity",

              label:
                "Connected platform activity",

              score:
                platformActivityScore,

              explanation:
                platformActivityScore ===
                null
                  ? "Connect a supported social account first."
                  : "Shows how many connected platforms received synced content during the last seven days.",
            },
          ],

          platforms:
            platformInsights,

          weeklyActivity,
          topContent,
          recommendations,

          primaryRecommendation,

          dailyContent,

          dataStatus: {
            isLive: hasFullSync,
            lastSyncedAt,

            message:
              connectedAccounts.length ===
              0
                ? "Connect a social account to activate Growth Hub."
                : hasFullSync
                  ? "Growth Hub is using synced social activity."
                  : "Accounts are connected. Some platform metrics remain unavailable until full API sync is approved.",
          },
        },
      },
      {
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );
  } catch (error: any) {
    const message =
      error?.message ||
      "Unknown error";

    return jsonError(
      message === "UNAUTHORIZED"
        ? 401
        : 500,
      {
        ok: false,
        error: message,
      }
    );
  }
}