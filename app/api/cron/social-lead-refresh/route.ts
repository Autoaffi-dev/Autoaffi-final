import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Temperature = "hot" | "warm" | "cold";
type Platform = "youtube" | "telegram" | "reddit" | "mlgs" | "bluesky";

type GlobalSocialLeadSource = {
  id: string;
  platform: Platform;
  source_type: string;
  source_url: string;
  source_external_id: string | null;
  title: string | null;
  enabled: boolean;
  niche: string;
  intent_group: string;
  priority: number | null;
  scan_frequency: "daily" | "weekly" | "manual";
  max_results: number | null;
  config: Record<string, any> | null;
};

type SocialLeadUserSetting = {
  id: string;
  user_id: string;
  enabled: boolean;
  plan: "basic" | "pro" | "elite";
  creator_mode: "beginner" | "consistent" | "growth";
  niche: string;
  intent_group: string;
  daily_lead_cap: number;
  include_youtube: boolean;
  include_telegram: boolean;
  include_mlgs: boolean;
  include_reddit: boolean;
  include_bluesky: boolean;
  last_distribution_day_key: string | null;
  leads_distributed_today: number | null;
};

type YouTubeCommentSignal = {
  externalId: string;
  sourcePlatform: "youtube";
  sourceType: "youtube_comment";
  sourceUrl: string;
  sourceVideoId: string;
  sourceVideoTitle: string | null;
  sourceChannelTitle: string | null;
  sourceUsername: string | null;
  sourceAuthorChannelUrl: string | null;
  sourceText: string;
  likeCount: number;
  publishedAt: string | null;
  updatedAt: string | null;
  score: number;
  temperature: Temperature;
  whyMatched: string[];
  suggestedOpener: string;
  tags: string[];
};

type YouTubeDiscoveredVideo = {
  videoId: string;
  title: string | null;
  channelTitle: string | null;
  publishedAt: string | null;
  sourceQuery: string;
  sourceSearchOrder: "date" | "relevance";
  videoDuration: "any" | "short" | "medium" | "long";
};

type BlueskyRawPost = {
  uri: string;
  cid?: string;
  author?: {
    did?: string;
    handle?: string;
    displayName?: string;
  };
  record?: {
    text?: string;
    createdAt?: string;
    reply?: unknown;
  };
  indexedAt?: string;
  likeCount?: number;
  replyCount?: number;
  repostCount?: number;
  quoteCount?: number;
};

type BlueskyQueryContext = {
  key: string;
  label: string;
  intent: "affiliate" | "newsletter" | "website" | "traffic" | "tool" | "income";
  commercialFit: boolean;
};

type BlueskyItem = {
  provider: "bluesky";
  sourceName: string;
  sourceType: "bluesky_search_post";
  query: string;
  queryContext: BlueskyQueryContext;
  title: string;
  text: string;
  link: string;
  id: string;
  uri: string;
  cid: string | null;
  authorHandle: string | null;
  authorDisplayName: string | null;
  authorDid: string | null;
  publishedAt: string | null;
  indexedAt: string | null;
  isReply: boolean;
  engagement: {
    likes: number;
    replies: number;
    reposts: number;
    quotes: number;
  };
};

type BlueskyScoringResult = {
  score: number;
  temperature: Temperature;
  whyMatched: string[];
  tags: string[];
};

type BlueskyLeadSignal = {
  externalId: string;
  sourcePlatform: "bluesky";
  sourceType: "bluesky_search_post";
  sourceUrl: string;
  sourcePostUri: string;
  sourceQuery: string;
  sourceQueryContext: BlueskyQueryContext;
  sourceUsername: string | null;
  sourceAuthorChannelUrl: string | null;
  sourceTitle: string | null;
  sourceChannel: string | null;
  sourceText: string;
  publishedAt: string | null;
  updatedAt: string | null;
  score: number;
  temperature: Temperature;
  whyMatched: string[];
  suggestedOpener: string;
  tags: string[];
  raw: BlueskyItem;
};

type RedditItem = {
  provider: "reddit";
  sourceName: string;
  sourceType: "reddit_rss_post";
  feed: string;
  subreddit: string;
  title: string;
  text: string;
  link: string;
  id: string;
  author: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
};

type RedditScoringResult = {
  score: number;
  temperature: Temperature;
  whyMatched: string[];
  tags: string[];
};

type RedditLeadSignal = {
  externalId: string;
  sourcePlatform: "reddit";
  sourceType: "reddit_rss_post";
  sourceUrl: string;
  sourcePostId: string;
  sourceFeed: string;
  sourceUsername: string | null;
  sourceAuthorChannelUrl: string | null;
  sourceTitle: string | null;
  sourceChannel: string | null;
  sourceText: string;
  publishedAt: string | null;
  updatedAt: string | null;
  score: number;
  temperature: Temperature;
  whyMatched: string[];
  suggestedOpener: string;
  tags: string[];
  raw: RedditItem;
};

type LeadSignal = YouTubeCommentSignal | BlueskyLeadSignal | RedditLeadSignal;

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const MAX_COMMENT_AGE_DAYS = 90;

const DEFAULT_YOUTUBE_SEARCH_QUERIES = [
  "affiliate marketing for beginners 2026",
  "how to start affiliate marketing",
  "make money online for beginners",
  "side hustle ideas 2026",
  "passive income for beginners",
  "affiliate marketing no sales",
  "affiliate marketing no clicks",
  "best affiliate marketing strategy for beginners",
];

const YOUTUBE_DISCOVERY_MAX_QUERIES_DEFAULT = 3;
const YOUTUBE_DISCOVERY_MAX_VIDEOS_DEFAULT = 5;
const YOUTUBE_DISCOVERY_MAX_COMMENTS_DEFAULT = 30;

const DEFAULT_YOUTUBE_SEARCH_ORDERS: Array<"relevance" | "date"> = [
  "relevance",
  "date",
];

const DEFAULT_YOUTUBE_VIDEO_DURATION: "any" | "short" | "medium" | "long" =
  "medium";

const DEFAULT_YOUTUBE_EXCLUDE_SHORTS = true;

const BSKY_SEARCH_BASES = [
  "https://api.bsky.app/xrpc/app.bsky.feed.searchPosts",
  "https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts",
];

const BSKY_SAVE_THRESHOLD_STRICT = 84;
const BSKY_SAVE_THRESHOLD_LOOSE = 80;

const DEFAULT_BLUESKY_QUERIES = [
  "substack alternative",
  "beehiiv alternative",
  "alternative to substack",
  "alternative to beehiiv",
  "newsletter platform alternative",
  "how do I monetize my newsletter",
  "how do I grow my newsletter",
  "website builder can't",
  "godaddy website builder",
  "need help website builder",
  "recommend landing page builder",
  "best landing page builder",
  "landing page builder for creators",
  "affiliate programs recommend",
  "affiliate program for bloggers",
  "affiliate program for travel bloggers",
  "best affiliate program for bloggers",
  "need advice affiliate marketing",
  "how do I start affiliate marketing",
  "affiliate marketing help",
  "how do I monetize my blog",
  "how do I get traffic to my blog",
  "how do I get traffic",
  "recommend email marketing tool",
];

const DEFAULT_REDDIT_FEEDS = [
  "sidehustle",
  "passive_income",
  "Affiliatemarketing",
  "WorkOnline",
  "Entrepreneur",
];

const REDDIT_SAVE_THRESHOLD_STRICT = 82;
const REDDIT_SAVE_THRESHOLD_LOOSE = 76;

function checkCronAuth(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;

  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      details,
    },
    { status }
  );
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanText(text: string | null | undefined) {
  return String(text || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
}

function getStockholmDayKey(d = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function getAgeDays(dateValue: string | null) {
  if (!dateValue) return null;

  const time = new Date(dateValue).getTime();
  if (!Number.isFinite(time)) return null;

  const diff = Date.now() - time;
  return Math.max(0, diff / (24 * 60 * 60 * 1000));
}

function safeExternalPart(input: string) {
  return String(input || "")
    .replace(/^at:\/\//i, "")
    .replace(/^https?:\/\//i, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .slice(0, 180);
}

function extractYouTubeVideoId(input?: string | null): string | null {
  if (!input) return null;

  const raw = input.trim();

  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;

  try {
    const url = new URL(raw);

    const v = url.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.split("/").filter(Boolean)[0];
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }

    if (url.pathname.includes("/shorts/")) {
      const id = url.pathname.split("/shorts/")[1]?.split("/")[0];
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }

    if (url.pathname.includes("/embed/")) {
      const id = url.pathname.split("/embed/")[1]?.split("/")[0];
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }

    return null;
  } catch {
    return null;
  }
}

function getManualYouTubeVideoIdsFromSource(source: GlobalSocialLeadSource) {
  const ids = new Set<string>();

  const fromMainSource =
    source.source_external_id || extractYouTubeVideoId(source.source_url);

  if (fromMainSource) {
    ids.add(fromMainSource);
  }

  const rawVideoIds = source.config?.videoIds;

  if (Array.isArray(rawVideoIds)) {
    for (const value of rawVideoIds) {
      const clean = String(value || "").trim();
      const parsed = extractYouTubeVideoId(clean) || clean;

      if (/^[a-zA-Z0-9_-]{11}$/.test(parsed)) {
        ids.add(parsed);
      }
    }
  }

  if (typeof rawVideoIds === "string") {
    const parts = rawVideoIds
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    for (const value of parts) {
      const parsed = extractYouTubeVideoId(value) || value;

      if (/^[a-zA-Z0-9_-]{11}$/.test(parsed)) {
        ids.add(parsed);
      }
    }
  }

  return Array.from(ids).slice(0, 10);
}

function isYouTubeDiscoveryEnabled(source: GlobalSocialLeadSource) {
  return source.config?.discovery === true;
}

function getYouTubeDiscoveryQueriesFromSource(source: GlobalSocialLeadSource) {
  const rawQueries = source.config?.searchQueries;

  if (Array.isArray(rawQueries)) {
    return rawQueries
      .map((query) => cleanText(query))
      .filter(Boolean)
      .slice(0, 20);
  }

  if (typeof rawQueries === "string") {
    return rawQueries
      .split(",")
      .map((query) => cleanText(query))
      .filter(Boolean)
      .slice(0, 20);
  }

  return DEFAULT_YOUTUBE_SEARCH_QUERIES;
}

function getYouTubeVideoHardBlockReason(text: string) {
  const cleaned = cleanText(text).toLowerCase();

  const blockedPatterns = [
    /\#shorts\b/i,
    /\bshorts\b/i,
    /\bcrypto\b/i,
    /\bbitcoin\b/i,
    /\bbtc\b/i,
    /\beth\b/i,
    /\bforex\b/i,
    /\btrading\b/i,
    /\btrader\b/i,
    /\bstocks?\b/i,
    /\boptions\b/i,
    /\bcasino\b/i,
    /\bbetting\b/i,
    /\bgambling\b/i,
    /\bonlyfans\b/i,
    /\badult\b/i,
    /\bnsfw\b/i,

    /\bogads\b/i,
    /\bcpa marketing\b/i,
    /\bcpagrip\b/i,
    /\bmaxbounty\b/i,
    /\bclickbank hack\b/i,
    /\bsecret method\b/i,

    /\bget rich quick\b/i,
    /\bguaranteed income\b/i,
    /\bguaranteed profit\b/i,
    /\bcopy paste system\b/i,
    /\bcopy and paste\b/i,
    /\bno work\b/i,
    /\bwithout doing anything\b/i,
    /\bearn \$?\d+\/day\b/i,
    /\bearn \$?\d+ per day\b/i,
    /\bmake \$?\d+\/day\b/i,
    /\bmake \$?\d+ per day\b/i,
    /\b\$?\d+\/day\b/i,
    /\b\$?\d+ per day\b/i,
  ];

  return blockedPatterns.some((pattern) => pattern.test(cleaned))
    ? "youtube_video_title_blocked"
    : null;
}

async function fetchYouTubeSearchVideos(params: {
  query: string;
  maxResults: number;
  order: "date" | "relevance";
  videoDuration: "any" | "short" | "medium" | "long";
  excludeShorts: boolean;
}) {
  if (!YOUTUBE_API_KEY) {
    throw new Error("Missing YOUTUBE_API_KEY");
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("key", YOUTUBE_API_KEY);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("q", params.query);
  url.searchParams.set("maxResults", String(params.maxResults));
  url.searchParams.set("order", params.order);
  url.searchParams.set("safeSearch", "moderate");
  url.searchParams.set("videoEmbeddable", "true");
  url.searchParams.set("relevanceLanguage", "en");

  if (params.videoDuration !== "any") {
    url.searchParams.set("videoDuration", params.videoDuration);
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`YouTube search failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  const items = Array.isArray(json?.items) ? json.items : [];

  return items
    .map((item: any): YouTubeDiscoveredVideo | null => {
      const videoId = item?.id?.videoId;
      const title = item?.snippet?.title ? cleanText(item.snippet.title) : null;
      const channelTitle = item?.snippet?.channelTitle
        ? cleanText(item.snippet.channelTitle)
        : null;
      const publishedAt = item?.snippet?.publishedAt || null;

      if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null;

      const titleText = cleanText(`${title || ""} ${channelTitle || ""}`);

      if (params.excludeShorts && /\b#shorts\b|\bshorts\b/i.test(titleText)) {
        return null;
      }

      if (titleText && getYouTubeVideoHardBlockReason(titleText)) {
        return null;
      }

      return {
        videoId,
        title,
        channelTitle,
        publishedAt,
        sourceQuery: params.query,
        sourceSearchOrder: params.order,
        videoDuration: params.videoDuration,
      };
    })
    .filter(Boolean) as YouTubeDiscoveredVideo[];
}

async function discoverYouTubeVideosFromSource(source: GlobalSocialLeadSource) {
  if (!isYouTubeDiscoveryEnabled(source)) {
    return {
      discoveryEnabled: false,
      queriesChecked: 0,
      queryResults: [] as any[],
      queryErrors: [] as any[],
      discoveredVideos: [] as YouTubeDiscoveredVideo[],
    };
  }

  const queries = getYouTubeDiscoveryQueriesFromSource(source);

  const maxSearchQueriesPerRun = clampNumber(
    source.config?.maxSearchQueriesPerRun,
    1,
    10,
    YOUTUBE_DISCOVERY_MAX_QUERIES_DEFAULT
  );

  const maxVideosPerQuery = clampNumber(
    source.config?.maxVideosPerQuery,
    1,
    10,
    3
  );

  const rawSearchOrders = Array.isArray(source.config?.searchOrders)
    ? source.config.searchOrders
    : null;

  const searchOrders: Array<"relevance" | "date"> =
    rawSearchOrders
      ?.map((value: unknown) => String(value).toLowerCase())
      .filter(
        (value: string): value is "relevance" | "date" =>
          value === "relevance" || value === "date"
      ) ?? DEFAULT_YOUTUBE_SEARCH_ORDERS;

  const uniqueSearchOrders = Array.from(new Set(searchOrders)).slice(0, 2);

  const configuredVideoDuration = String(
    source.config?.videoDuration || DEFAULT_YOUTUBE_VIDEO_DURATION
  ).toLowerCase();

  const videoDuration: "any" | "short" | "medium" | "long" =
    configuredVideoDuration === "any" ||
    configuredVideoDuration === "short" ||
    configuredVideoDuration === "medium" ||
    configuredVideoDuration === "long"
      ? configuredVideoDuration
      : DEFAULT_YOUTUBE_VIDEO_DURATION;

  const excludeShorts =
    typeof source.config?.excludeShorts === "boolean"
      ? source.config.excludeShorts
      : DEFAULT_YOUTUBE_EXCLUDE_SHORTS;

  const queriesToCheck = queries.slice(0, maxSearchQueriesPerRun);

  const allVideos: YouTubeDiscoveredVideo[] = [];
  const queryResults: any[] = [];
  const queryErrors: any[] = [];

  for (const query of queriesToCheck) {
    for (const order of uniqueSearchOrders) {
      try {
        const videos = await fetchYouTubeSearchVideos({
          query,
          maxResults: maxVideosPerQuery,
          order,
          videoDuration,
          excludeShorts,
        });

        allVideos.push(...videos);

        queryResults.push({
          query,
          order,
          videoDuration,
          excludeShorts,
          found: videos.length,
          videoIds: videos.map((video) => video.videoId),
        });
      } catch (error) {
        queryErrors.push({
          query,
          order,
          videoDuration,
          excludeShorts,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      await sleep(350);
    }
  }

  const dedupedMap = new Map<string, YouTubeDiscoveredVideo>();

  for (const video of allVideos) {
    if (!dedupedMap.has(video.videoId)) {
      dedupedMap.set(video.videoId, video);
    }
  }

  const maxVideosPerRun = clampNumber(
    source.config?.maxVideosPerRun,
    1,
    10,
    YOUTUBE_DISCOVERY_MAX_VIDEOS_DEFAULT
  );

  return {
    discoveryEnabled: true,
    queriesChecked: queriesToCheck.length,
    queryResults,
    queryErrors,
    discoveredVideos: Array.from(dedupedMap.values()).slice(0, maxVideosPerRun),
  };
}

function isCommentFreshEnough(publishedAt: string | null | undefined) {
  if (!publishedAt) return false;

  const publishedTime = new Date(publishedAt).getTime();
  if (!Number.isFinite(publishedTime)) return false;

  const ageMs = Date.now() - publishedTime;
  const maxAgeMs = MAX_COMMENT_AGE_DAYS * 24 * 60 * 60 * 1000;

  return ageMs <= maxAgeMs;
}

function hasRealQuestionIntent(text: string) {
  const cleaned = cleanText(text).toLowerCase();

  if (cleaned.includes("?")) return true;

  return (
    /^(how|what|which|where|when|why|can|should|would|do|does|is|are)\b/i.test(
      cleaned
    ) ||
    /\b(can you|could you|do you think|would you recommend|what should i|how can i|how do i|which platform|what platform)\b/i.test(
      cleaned
    )
  );
}

function isMostlyJunk(text: string) {
  const cleaned = cleanText(text);
  if (cleaned.length < 12) return true;

  const urlCount = (cleaned.match(/https?:\/\//gi) || []).length;
  if (urlCount >= 2) return true;

  const repeatedChars = /(.)\1{8,}/.test(cleaned);
  if (repeatedChars) return true;

  const emojiHeavy =
    [...cleaned].filter((char) => /\p{Extended_Pictographic}/u.test(char))
      .length > cleaned.length * 0.4;

  if (emojiHeavy) return true;

  return false;
}

const HOT_PATTERNS = [
  /i want to start/i,
  /i need (your )?help/i,
  /please guide me/i,
  /can you guide me/i,
  /help me (start|begin|get started)/i,
  /how (do|can) i (start|begin|get started)/i,
  /^how to (start|begin|get started)/i,
  /i am new/i,
  /i'm new/i,
  /complete beginner/i,
  /absolute beginner/i,
  /zero audience/i,
  /no audience/i,
  /no followers/i,
  /no clicks/i,
  /no sales/i,
  /no leads/i,
  /not getting (clicks|sales|leads|traffic)/i,
  /struggling/i,
  /i tried .*affiliate/i,
  /i failed/i,
  /does this actually work/i,
  /is this legit/i,
  /what should i do/i,
  /which platform/i,
  /recommend .*platform/i,
  /better .*platform/i,
];

const WARM_PATTERNS = [
  /affiliate marketing/i,
  /make money online/i,
  /extra income/i,
  /side hustle/i,
  /passive income/i,
  /online business/i,
  /recurring (income|commission)/i,
  /earn money/i,
  /earning money/i,
  /income stream/i,
  /digital product/i,
  /ai tool/i,
  /content creation/i,
  /faceless/i,
  /tiktok shop/i,
  /youtube automation/i,
  /dropshipping/i,
  /work from home/i,
  /financial freedom/i,
];

const LOW_ACTION_PATTERNS = [
  /great video/i,
  /fantastic/i,
  /thanks/i,
  /thank you/i,
  /helpful video/i,
  /awesome video/i,
  /very clear/i,
  /super clear/i,
  /love this/i,
  /good content/i,
  /practical thanks/i,
  /clear and practical/i,
];

const SUCCESS_STORY_PATTERNS = [
  /i made \$?\d+/i,
  /made \$?\d+/i,
  /hit \$?\d+/i,
  /earned \$?\d+/i,
  /commission in month/i,
  /paying the mortgage/i,
  /my blog made/i,
  /ad revenue/i,
  /book sales/i,
];

const POSSIBLE_PROMO_PATTERNS = [
  /dm me/i,
  /message me/i,
  /join my/i,
  /check my/i,
  /link in bio/i,
  /whatsapp/i,
  /telegram/i,
  /guaranteed/i,
  /earn \$?\d+ daily/i,
  /crypto/i,
  /investment/i,
];

const TRUST_CONCERN_PATTERNS = [
  /scam/i,
  /fake guru/i,
  /pyramid/i,
  /mlm/i,
  /get rich quick/i,
  /spam/i,
];

function scoreCommentIntent(text: string, likeCount: number) {
  const cleaned = cleanText(text);

  let score = 0;
  const whyMatched: string[] = [];
  const tags = new Set<string>();

  const hasQuestion = hasRealQuestionIntent(cleaned);

  const hasHelpIntent =
    /(i need help|need your help|please guide me|can you guide me|help me|get started|want to start|how do i start|how can i start)/i.test(
      cleaned
    );

  const hasPlatformIntent =
    /(which platform|recommend.*platform|better.*platform|what platform|amazon or|tool|system|software|automation|tracking)/i.test(
      cleaned
    );

  const hasPain =
    /(failed|tried|not working|no clicks|no sales|no leads|no traffic|struggling|stuck|confused)/i.test(
      cleaned
    );

  const hasBeginner =
    /(beginner|newbie|new to|starting|start from zero|zero audience|no audience|no experience|no followers)/i.test(
      cleaned
    );

  const hasAffiliate = /(affiliate|affiliate marketing|commission)/i.test(
    cleaned
  );

  const hasIncome =
    /(money|income|cash|earn|earning|revenue|commission|side hustle|passive income|make money online)/i.test(
      cleaned
    );

  const isLowAction = LOW_ACTION_PATTERNS.some((pattern) =>
    pattern.test(cleaned)
  );

  const isSuccessStory = SUCCESS_STORY_PATTERNS.some((pattern) =>
    pattern.test(cleaned)
  );

  const isPossiblePromo = POSSIBLE_PROMO_PATTERNS.some((pattern) =>
    pattern.test(cleaned)
  );

  for (const pattern of HOT_PATTERNS) {
    if (pattern.test(cleaned)) {
      score += 18;
      tags.add("high-intent");
    }
  }

  for (const pattern of WARM_PATTERNS) {
    if (pattern.test(cleaned)) {
      score += 7;
      tags.add("warm-intent");
    }
  }

  if (hasHelpIntent) {
    score += 32;
    whyMatched.push("Explicitly asks for help or guidance");
    tags.add("needs-help");
  }

  if (hasQuestion) {
    score += 12;
    whyMatched.push("Asks a question");
    tags.add("question");
  }

  if (hasBeginner) {
    score += 16;
    whyMatched.push("Shows beginner/startup intent");
    tags.add("beginner");
  }

  if (hasPain) {
    score += 18;
    whyMatched.push("Shows frustration or failed attempt");
    tags.add("pain-point");
  }

  if (hasPlatformIntent) {
    score += 18;
    whyMatched.push("Looks open to a platform, tool or system");
    tags.add("tool-interest");
  }

  if (hasAffiliate) {
    score += 12;
    whyMatched.push("Mentions affiliate marketing");
    tags.add("affiliate");
  }

  if (hasIncome) {
    score += 12;
    whyMatched.push("Mentions money, income or commissions");
    tags.add("income");
  }

  if (likeCount >= 5) {
    score += 4;
    whyMatched.push("Comment has engagement");
  }

  for (const pattern of TRUST_CONCERN_PATTERNS) {
    if (pattern.test(cleaned)) {
      score += 6;
      whyMatched.push("Mentions trust/risk concern");
      tags.add("trust-concern");
    }
  }

  if (cleaned.length > 80) {
    score += 4;
    whyMatched.push("Detailed comment");
  }

  if (isLowAction && !hasQuestion && !hasHelpIntent && !hasPain) {
    score -= 40;
    tags.add("low-action");
    whyMatched.push("Mostly praise/low-action comment");
  }

  if (isSuccessStory && !hasQuestion && !hasHelpIntent && !hasPain) {
    score -= 35;
    tags.add("success-story");
    whyMatched.push("Looks more like a success story than a lead request");
  }

  if (isPossiblePromo) {
    score -= 35;
    tags.add("possible-promo");
    whyMatched.push("May be promotional or low-quality outreach");
  }

  if (
    (hasHelpIntent || hasBeginner || hasPain) &&
    (hasAffiliate || hasIncome) &&
    !isLowAction &&
    !isSuccessStory &&
    !isPossiblePromo
  ) {
    score += 18;
    tags.add("autoaffi-fit");
    whyMatched.push("Strong Autoaffi fit");
  }

  score = Math.min(100, Math.max(0, score));

  const temperature: Temperature =
    score >= 72 ? "hot" : score >= 45 ? "warm" : "cold";

  const uniqueWhy = Array.from(new Set(whyMatched)).slice(0, 6);

  return {
    score,
    temperature,
    whyMatched:
      uniqueWhy.length > 0
        ? uniqueWhy
        : ["Matches online-income related language"],
    tags: Array.from(tags).slice(0, 10),
  };
}

function passesLeadIntentGate(signal: YouTubeCommentSignal) {
  const tags = new Set(signal.tags);

  return (
    tags.has("needs-help") ||
    tags.has("question") ||
    tags.has("beginner") ||
    tags.has("pain-point") ||
    tags.has("tool-interest") ||
    tags.has("trust-concern") ||
    signal.score >= 72
  );
}

function buildSuggestedOpener(signal: {
  sourceText: string;
  temperature: Temperature;
  tags: string[];
}) {
  const text = signal.sourceText;
  const hasQuestion = hasRealQuestionIntent(text);

  if (
    /(i need help|need your help|please guide me|can you guide me|help me|get started|want to start|how do i start|how can i start)/i.test(
      text
    )
  ) {
    return "I saw your comment about wanting to get started with affiliate marketing. The easiest way to avoid getting overwhelmed is to follow one simple workflow: pick one offer, create daily content around the problem it solves, and track every click so you know what works. I can share a beginner-friendly structure if you want.";
  }

  if (
    /(no clicks|no sales|no leads|no traffic|struggling|failed|not working|stuck|confused)/i.test(
      text
    )
  ) {
    return "I saw your comment about struggling with affiliate marketing. Most beginners do not fail because of the offer — they fail because they post without a clear workflow or tracking. I’d start with one offer, a simple content plan, and separate tracking links for each post so you can see what is actually working.";
  }

  if (
    /(which platform|recommend.*platform|better.*platform|what platform|amazon or|tool|system|software|automation|tracking)/i.test(
      text
    )
  ) {
    return "I saw your comment about choosing the right platform or system. I’d look for something that helps with three things: choosing the right offer, creating consistent content, and tracking properly. Without those three pieces, it is hard to know what is actually creating income.";
  }

  if (/affiliate/i.test(text)) {
    return hasQuestion
      ? "I saw your affiliate marketing question. A simple way to start is to choose one clear offer, create helpful content around the problem it solves, and track each post separately so you can see what gets clicks. That usually beats jumping between random products."
      : "I saw your comment about affiliate marketing. One thing that helps a lot is using a clear system instead of guessing: one offer, daily content, and tracking links so you can see what actually creates clicks.";
  }

  if (
    /(money|income|earn|side hustle|passive income|make money online)/i.test(
      text
    )
  ) {
    return "I saw your comment about building online income. A good first step is to avoid random methods and use a simple system: one clear offer, daily content, and tracking so you know what works. I can share a simple beginner-friendly structure if useful.";
  }

  return hasQuestion
    ? "I saw your question and thought it was relevant. If you are trying to build online income, I’d start with one clear offer, simple content, and proper tracking before adding more platforms."
    : "I saw your comment and thought it was relevant. If you are trying to build online income, I’d focus on one clear offer, simple content, and proper tracking before adding more platforms.";
}

async function fetchYouTubeVideoMeta(videoId: string) {
  if (!YOUTUBE_API_KEY) {
    throw new Error("Missing YOUTUBE_API_KEY");
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("key", YOUTUBE_API_KEY);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("id", videoId);

  const res = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`YouTube video metadata failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  const item = json?.items?.[0];

  return {
    title: item?.snippet?.title ? cleanText(item.snippet.title) : null,
    channelTitle: item?.snippet?.channelTitle
      ? cleanText(item.snippet.channelTitle)
      : null,
  };
}

async function fetchYouTubeComments(params: {
  videoId: string;
  maxResults: number;
  order: "time" | "relevance";
}) {
  if (!YOUTUBE_API_KEY) {
    throw new Error("Missing YOUTUBE_API_KEY");
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/commentThreads");
  url.searchParams.set("key", YOUTUBE_API_KEY);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("videoId", params.videoId);
  url.searchParams.set("maxResults", String(params.maxResults));
  url.searchParams.set("order", params.order);
  url.searchParams.set("textFormat", "plainText");

  const res = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");

    if (res.status === 403 && text.includes("commentsDisabled")) {
      return [];
    }

    throw new Error(`YouTube comments failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  return Array.isArray(json?.items) ? json.items : [];
}

function normalizeCommentToSignal(args: {
  item: any;
  videoId: string;
  videoTitle: string | null;
  channelTitle: string | null;
}): YouTubeCommentSignal | null {
  const top = args.item?.snippet?.topLevelComment;
  const snippet = top?.snippet;

  const commentId = top?.id || args.item?.id;
  const sourceText = cleanText(snippet?.textDisplay || snippet?.textOriginal);
  const publishedAt = snippet?.publishedAt || null;

  if (!commentId || !sourceText || isMostlyJunk(sourceText)) return null;
  if (!isCommentFreshEnough(publishedAt)) return null;

  const likeCount = Number(snippet?.likeCount || 0);
  const scoring = scoreCommentIntent(sourceText, likeCount);

  if (scoring.score < 30) return null;

  const authorName = snippet?.authorDisplayName
    ? cleanText(snippet.authorDisplayName)
    : null;

  const authorChannelUrl = snippet?.authorChannelUrl || null;

  const signal: YouTubeCommentSignal = {
    externalId: `youtube_${args.videoId}_${commentId}`,
    sourcePlatform: "youtube",
    sourceType: "youtube_comment",
    sourceUrl: `https://www.youtube.com/watch?v=${args.videoId}&lc=${commentId}`,
    sourceVideoId: args.videoId,
    sourceVideoTitle: args.videoTitle,
    sourceChannelTitle: args.channelTitle,
    sourceUsername: authorName,
    sourceAuthorChannelUrl: authorChannelUrl,
    sourceText,
    likeCount,
    publishedAt,
    updatedAt: snippet?.updatedAt || null,
    score: scoring.score,
    temperature: scoring.temperature,
    whyMatched: scoring.whyMatched,
    suggestedOpener: buildSuggestedOpener({
      sourceText,
      temperature: scoring.temperature,
      tags: scoring.tags,
    }),
    tags: scoring.tags,
  };

  if (!passesLeadIntentGate(signal)) return null;

  return signal;
}

/* ---------------------------------------------------
   BLUESKY ENGINE
--------------------------------------------------- */

function getBlueskyQueryContext(query: string): BlueskyQueryContext {
  const q = cleanText(query).toLowerCase();

  if (/\b(substack|beehiiv|newsletter)\b/i.test(q)) {
    return {
      key: "newsletter_platform",
      label: "Newsletter / platform alternative",
      intent: "newsletter",
      commercialFit: true,
    };
  }

  if (/\b(website builder|landing page|godaddy|carrd)\b/i.test(q)) {
    return {
      key: "website_builder",
      label: "Website / landing page builder",
      intent: "website",
      commercialFit: true,
    };
  }

  if (/\b(affiliate|affiliate program|affiliate marketing)\b/i.test(q)) {
    return {
      key: "affiliate_program",
      label: "Affiliate / program discovery",
      intent: "affiliate",
      commercialFit: true,
    };
  }

  if (/\b(traffic|monetize|monetise|blog)\b/i.test(q)) {
    return {
      key: "traffic_monetization",
      label: "Traffic / monetization",
      intent: "traffic",
      commercialFit: true,
    };
  }

  if (/\b(email marketing tool|recommend .*tool|tool)\b/i.test(q)) {
    return {
      key: "tool_recommendation",
      label: "Tool recommendation",
      intent: "tool",
      commercialFit: true,
    };
  }

  return {
    key: "income_general",
    label: "General online income",
    intent: "income",
    commercialFit: true,
  };
}

function getBlueskyAgeDays(dateValue: string | null) {
  return getAgeDays(dateValue);
}

function getBlueskyRkeyFromUri(uri: string) {
  const parts = String(uri || "").split("/");
  return parts[parts.length - 1] || "";
}

function buildBlueskyPostUrl(post: BlueskyRawPost) {
  const handle = post.author?.handle;
  const rkey = getBlueskyRkeyFromUri(post.uri);

  if (!handle || !rkey) return "";

  return `https://bsky.app/profile/${handle}/post/${rkey}`;
}

function hasBlueskyQuestionIntent(text: string) {
  const cleaned = cleanText(text).toLowerCase();

  if (cleaned.includes("?")) return true;

  return (
    /^(how|what|which|where|when|why|can|should|would|do|does|is|are)\b/i.test(
      cleaned
    ) ||
    /\b(how do i|how can i|what should i|which platform|what platform|any advice|need advice|looking for advice|recommend|recommendation|can someone explain|does anyone know|what is the best|what are the best|anyone know a good)\b/i.test(
      cleaned
    )
  );
}

function hasBlueskyDirectHelpIntent(text: string) {
  const cleaned = cleanText(text);

  return /\b(need help|need advice|any advice|please help|looking for advice|could use some help|really use some help|how do i|how can i|what should i|which platform|what platform|best platform|best affiliate program|recommend a|recommend an|recommend.*tool|where can i|need a good|not sure what to do|stuck|confused|struggling|looking for a tool|looking for an app|looking for software|anyone know a good|any recommendations|better alternative|alternative to)\b/i.test(
    cleaned
  );
}

function hasBlueskyPersonalLeadIntent(text: string) {
  const cleaned = cleanText(text);

  return /\b(i need|i'm trying|i am trying|i'm looking|i am looking|i'm stuck|i am stuck|i struggle|i'm struggling|i am struggling|my site|my website|my blog|my channel|my content|my startup|my side project|my product|my landing page|my funnel|my newsletter|my store|my audience|we need|we're trying|we are trying|we're looking|we are looking|we have been looking|we operate|we run|we publish|we had the revenue|our site|our audience)\b/i.test(
    cleaned
  );
}

function hasBlueskyMonetizationLeadIntent(text: string) {
  const cleaned = cleanText(text);

  return /\b(how do i monetize|how can i monetize|monetize my|monetise my|make money from my|earn from my|affiliate program for|affiliate programs for|promoting .* affiliate|getting clicks|getting sales|no sales|no clicks|no leads|no traffic|affiliate links not working|links dying|tracking clicks|track clicks|how do i get traffic|how can i get traffic|how to get traffic to my|how do i grow my newsletter|how can i grow my newsletter|financially viable alternative|if we had the revenue|shoestring budget|budget)\b/i.test(
    cleaned
  );
}

function hasBlueskyContextualInterest(text: string) {
  const cleaned = cleanText(text);

  return /\b(interested|following|bookmarking|saving this|this is useful|this helps|i need this|i could use this|i want to try|want to try|how did you|how does this|does this work|can beginners|for beginners|what did you use|which one did you use|what platform|what tool|what stack|would this work for|is this better than|has anyone tried|anyone tried|curious about|tell me more|where do i start|considering to start|considering using|prefer a platform|looking for an alternative|looking for alternative)\b/i.test(
    cleaned
  );
}

function getBlueskyHardBlockReason(text: string) {
  const cleaned = cleanText(text).toLowerCase();

  const blocks: Array<{ reason: string; patterns: RegExp[] }> = [
    {
      reason: "housing_property_or_politics_noise",
      patterns: [
        /\bgovernment\b/i,
        /\bgovt\b/i,
        /\bpolitics\b/i,
        /\bpolitical\b/i,
        /\belection\b/i,
        /\bdemocracy\b/i,
        /\bnazis?\b/i,
        /\bregulate\b/i,
        /\bregulation\b/i,
        /\brich\b/i,
        /\bwealthy\b/i,
        /\bassets\b/i,
        /\bproperty\b/i,
        /\breal estate\b/i,
        /\blandlord\b/i,
        /\brent\b/i,
        /\brenting\b/i,
        /\bmortgage\b/i,
        /\bhome affordability\b/i,
        /\bcan't afford a home\b/i,
        /\bcant afford a home\b/i,
        /\bhousing\b/i,
        /\bhouse prices\b/i,
      ],
    },
    {
      reason: "physical_tool_or_hobby_noise",
      patterns: [
        /\btool brand\b/i,
        /\bhand pump\b/i,
        /\bmulti-tool\b/i,
        /\bmultitool\b/i,
        /\bspare tube\b/i,
        /\bbike lock\b/i,
        /\bu-lock\b/i,
        /\bcable lock\b/i,
        /\bniterider\b/i,
        /\bgeologist\b/i,
        /\brocks?\b/i,
        /\blicking\b/i,
        /\bphotography processing\b/i,
        /\bdarktable\b/i,
        /\beeprom\b/i,
        /\bchips?\b/i,
        /\bsram\b/i,
        /\bgodot\b/i,
        /\btabletop\b/i,
        /\bhorror one-shot\b/i,
        /\bgame streaming\b/i,
        /\bremote game\b/i,
      ],
    },
    {
      reason: "crypto_or_trading_noise",
      patterns: [
        /\bcrypto\b/i,
        /\bbitcoin\b/i,
        /\bbtc\b/i,
        /\beth\b/i,
        /\bethereum\b/i,
        /\bsolana\b/i,
        /\busdt\b/i,
        /\bforex\b/i,
        /\btrading\b/i,
        /\btrader\b/i,
        /\bleverage\b/i,
        /\bliquidation\b/i,
        /\bmeme coin\b/i,
        /\btoken launch\b/i,
        /\bnft\b/i,
        /\bstaking\b/i,
        /\byield\b/i,
        /\bapr\b/i,
        /\bstablecoins?\b/i,
      ],
    },
    {
      reason: "gambling_or_adult_noise",
      patterns: [
        /\bcasino\b/i,
        /\bbetting\b/i,
        /\bgambling\b/i,
        /\bigaming\b/i,
        /\bonlyfans\b/i,
        /\badult\b/i,
        /\bnudes?\b/i,
        /\bescort\b/i,
        /\bnsfw\b/i,
        /��/i,
      ],
    },
    {
      reason: "spam_or_promo_noise",
      patterns: [
        /\bdm me\b/i,
        /\bmessage me\b/i,
        /\blink in bio\b/i,
        /\bwhatsapp\b/i,
        /\btelegram pump\b/i,
        /\bguaranteed profit\b/i,
        /\bguaranteed income\b/i,
        /\bget rich quick\b/i,
        /\bmake \$?\d+ per day guaranteed\b/i,
        /\bcopy paste system\b/i,
        /\bfree money\b/i,
        /\bairdrop\b/i,
        /\bstop scrolling\b/i,
        /\btry it now\b/i,
        /\bcontinue reading on medium\b/i,
        /\bcontinue reading\b/i,
        /\bjust published\b/i,
        /\bcheck out\b/i,
        /\bdirectly start\b/i,
        /\bdirekt starten\b/i,
        /\bmehr dazu\b/i,
      ],
    },
    {
      reason: "job_search_or_task_platform_noise",
      patterns: [
        /\bresume\b/i,
        /\bcv\b/i,
        /\binterview\b/i,
        /\bentry level job\b/i,
        /\bentry-level job\b/i,
        /\bjob opening\b/i,
        /\bhiring\b/i,
        /\bhire me\b/i,
        /\bexam\b/i,
        /\bid verification\b/i,
        /\bgetting accepted\b/i,
        /\baccepted\b/i,
        /\bmaximize earnings\b/i,
        /\bmaximizing earnings\b/i,
        /\btelus\b/i,
        /\btranscribeme\b/i,
        /\bdata annotation\b/i,
        /\bdataannotation\b/i,
        /\boutlier\b/i,
        /\bappen\b/i,
        /\bremotasks\b/i,
        /\buhrs\b/i,
        /\bmicrotask\b/i,
        /\bmicro-task\b/i,
      ],
    },
    {
      reason: "sensitive_or_medical_noise",
      patterns: [
        /\bwar\b/i,
        /\bcrime\b/i,
        /\blawsuit\b/i,
        /\bmedical\b/i,
        /\bdiagnosis\b/i,
        /\bmental health\b/i,
        /\btherapy\b/i,
        /\bvaccine\b/i,
        /\bvaccination\b/i,
        /\bherd immunity\b/i,
        /\binantibiotic\b/i,
      ],
    },
    {
      reason: "minor_or_age_risk",
      patterns: [
        /\bas a minor\b/i,
        /\bminor\b/i,
        /\b17yo\b/i,
        /\b17 yo\b/i,
        /\b16yo\b/i,
        /\b16 yo\b/i,
        /\b15yo\b/i,
        /\b15 yo\b/i,
      ],
    },
  ];

  for (const group of blocks) {
    if (group.patterns.some((pattern) => pattern.test(cleaned))) {
      return group.reason;
    }
  }

  return null;
}

function isBlueskyAccountLikelyPromoOrPublisher(item: BlueskyItem) {
  const handle = cleanText(item.authorHandle || "").toLowerCase();
  const displayName = cleanText(item.authorDisplayName || "").toLowerCase();
  const text = cleanText(item.text).toLowerCase();

  if (
    /\b(cnbc|makeit|consulting|review|reviews|coupon|deals|ads|marketing agency|agency|seo|vpn|newsletter bot|bot|activitypub|awakari|hubspot|froggyads|business marketplace|digitalwealth|finance|wealth|news|podcast)\b/i.test(
      `${handle} ${displayName}`
    )
  ) {
    return true;
  }

  if (
    /\b#affiliatemarketing\b/i.test(text) &&
    /\bhttps?:\/\//i.test(text) &&
    !hasBlueskyQuestionIntent(text)
  ) {
    return true;
  }

  if (
    /\b(blog|medium|newsletter|guide|review|spotlight|best .* ideas|ultimate|complete guide|tips for aspiring|here are \d+ tips)\b/i.test(
      text
    ) &&
    /\bhttps?:\/\//i.test(text)
  ) {
    return true;
  }

  return false;
}

function isBlueskyObservationalOrAdvisoryOnly(text: string) {
  const cleaned = cleanText(text).toLowerCase();

  return (
    /\b(i see folks|i see people|folks doing|people are using|people use|i recommend|i highly recommend|great alternative|is a great alternative|here are some|you could have|you should|if you follow me|i want to pledge|alternative version of this post|i need to stop going on substack|sharing this|was shared to me|recommendations reflect|today's recommendations|probably will the whole month)\b/i.test(
      cleaned
    ) &&
    !/\b(we have been looking|we're looking|we are looking|i am looking|i'm looking|i need help|need help|how do i|what should i|can't do the basic stuff|cant do the basic stuff|financially viable|shoestring budget|if we had the revenue|my newsletter|my website|my blog|my audience)\b/i.test(
      cleaned
    )
  );
}

function getBlueskyContentPostRiskReason(item: BlueskyItem) {
  const text = cleanText(`${item.title} ${item.text}`).toLowerCase();

  if (isBlueskyAccountLikelyPromoOrPublisher(item)) {
    return "publisher_or_promo_account_not_direct_lead";
  }

  if (isBlueskyObservationalOrAdvisoryOnly(text)) {
    return "observational_or_advisory_only_not_auto_save";
  }

  if (
    !hasBlueskyDirectHelpIntent(text) &&
    !hasBlueskyPersonalLeadIntent(text) &&
    !hasBlueskyMonetizationLeadIntent(text) &&
    !hasBlueskyContextualInterest(text) &&
    /\b(i built|we built|launching|launched|check out|new tool|new app|showing off|my new|our new|just shipped|just launched|spotlight:|review 2026|best .* ideas|complete guide)\b/i.test(
      text
    )
  ) {
    return "build_launch_or_article_not_direct_lead";
  }

  if (
    !hasBlueskyDirectHelpIntent(text) &&
    !hasBlueskyContextualInterest(text) &&
    /\b(article|newsletter|blog post|thread|guide|tutorial|review|top \d+|best practices|here are|i wrote|continue reading|medium)\b/i.test(
      text
    )
  ) {
    return "content_or_article_not_direct_lead";
  }

  return null;
}

function scoreBlueskyIntent(item: BlueskyItem): BlueskyScoringResult {
  const fullText = cleanText(`${item.title} ${item.text}`);

  let score = 0;
  const whyMatched: string[] = [];
  const tags = new Set<string>();

  const hasQuestion = hasBlueskyQuestionIntent(fullText);
  const directHelp = hasBlueskyDirectHelpIntent(fullText);
  const personalLead = hasBlueskyPersonalLeadIntent(fullText);
  const monetizationLead = hasBlueskyMonetizationLeadIntent(fullText);
  const contextualInterest = hasBlueskyContextualInterest(fullText);
  const observationalOnly = isBlueskyObservationalOrAdvisoryOnly(fullText);

  const hasHelpIntent =
    /\b(need help|need advice|any advice|please help|looking for advice|could use some help|really use some help|how do i start|how can i start|get started|beginner|newbie|new to this|zero skills|no skills|zero experience|no experience|need a good)\b/i.test(
      fullText
    );

  const hasIncomeIntent =
    /\b(extra income|side hustle|passive income|make money online|earn money|earning money|online income|income stream|work online|work from home|build income|monetize|monetise|monetization|monetisation)\b/i.test(
      fullText
    );

  const hasAffiliateIntent =
    /\b(affiliate|affiliate marketing|amazon associates|commission|commissions|referral income|recurring commission|affiliate links?|landing page|offers?|validating offers?|publish content|old links|clicks\/sales|clicks and sales|affiliate program|affiliate programs)\b/i.test(
      fullText
    );

  const hasPain =
    /\b(no clicks|no sales|no leads|no traffic|links dying|dead links|not working|failed|struggling|stuck|confused|overwhelmed|quietly dying|can't figure out|not sure what to do|get clicks|getting clicks|getting sales|can't do the basic stuff|cant do the basic stuff|have to migrate|migrate the newsletter|shoestring budget|financially viable)\b/i.test(
      fullText
    );

  const hasPlatformIntent =
    /\b(which platform|best platform|what platform|recommend.*platform|tool|software|system|tracking|automation|landing page builder|link checker|link management|analytics|dashboard|crm|workflow|website builder|email marketing tool|social media scheduler|beehiiv|substack|ghost|patreon|godaddy|carrd|wordpress|convertkit|mailchimp)\b/i.test(
      fullText
    );

  const hasCreatorIntent =
    /\b(content|creator|publish|posting|youtube|tiktok|instagram|blog|blogger|newsletter|audience|traffic|copywriting|social media|travel blogger|travel bloggers|writer|writers)\b/i.test(
      fullText
    );

  const hasAIAutomationIntent =
    /\b(ai tool|ai tools|automation|automate|agent|ai agent|workflow automation|marketing automation|content automation|lead generation|lead gen|ai video|ai copywriting)\b/i.test(
      fullText
    );

  const lowAction =
    /\b(thanks|thank you|great post|nice|cool|interesting|love this|agree|same here|hell yeah)\b/i.test(
      fullText
    ) && !hasQuestion;

  if (hasQuestion) {
    score += 14;
    whyMatched.push("Asks a question");
    tags.add("question");
  }

  if (directHelp) {
    score += 18;
    whyMatched.push("Direct help/request intent");
    tags.add("direct-help");
  }

  if (personalLead) {
    score += 24;
    whyMatched.push("Personal lead intent");
    tags.add("personal-lead");
  }

  if (monetizationLead) {
    score += 28;
    whyMatched.push("Monetization or tracking help intent");
    tags.add("monetization-lead");
  }

  if (contextualInterest) {
    score += 14;
    whyMatched.push("Contextual interest signal");
    tags.add("contextual-interest");
  }

  if (item.queryContext.commercialFit) {
    score += 10;
    whyMatched.push(`Relevant query context: ${item.queryContext.label}`);
    tags.add(`context-${item.queryContext.key}`);
  }

  if (hasHelpIntent) {
    score += 22;
    whyMatched.push("Asks for help, beginner advice or low-skill path");
    tags.add("needs-help");
  }

  if (hasIncomeIntent) {
    score += 14;
    whyMatched.push("Mentions extra income, side hustle or online income");
    tags.add("income");
  }

  if (hasAffiliateIntent) {
    score += 24;
    whyMatched.push("Mentions affiliate marketing, offers, commissions or links");
    tags.add("affiliate");
  }

  if (hasPain) {
    score += 24;
    whyMatched.push("Shows pain, confusion or lack of results");
    tags.add("pain-point");
  }

  if (hasPlatformIntent) {
    score += 22;
    whyMatched.push("Looks open to a platform, tool or system");
    tags.add("tool-interest");
  }

  if (hasCreatorIntent) {
    score += 12;
    whyMatched.push("Mentions content, traffic or audience");
    tags.add("creator-intent");
  }

  if (hasAIAutomationIntent) {
    score += 10;
    whyMatched.push("Mentions AI, automation or lead generation");
    tags.add("ai-automation-intent");
  }

  if (item.isReply) {
    score += 8;
    whyMatched.push("Reply/comment style post");
    tags.add("reply-signal");
  }

  const engagementScore =
    Math.min(6, item.engagement.replies * 2) +
    Math.min(4, item.engagement.likes);

  if (engagementScore > 0) {
    score += engagementScore;
    whyMatched.push("Has engagement");
    tags.add("engagement");
  }

  if (fullText.length > 80) {
    score += 4;
    whyMatched.push("Detailed post");
  }

  if (lowAction) {
    score -= 35;
    whyMatched.push("Mostly low-action reply");
    tags.add("low-action");
  }

  if (observationalOnly) {
    score -= 20;
    whyMatched.push("Observational/advisory only");
    tags.add("observational-only");
  }

  if (
    (hasHelpIntent ||
      hasPain ||
      hasPlatformIntent ||
      directHelp ||
      personalLead ||
      monetizationLead ||
      contextualInterest) &&
    (hasIncomeIntent ||
      hasAffiliateIntent ||
      hasCreatorIntent ||
      hasAIAutomationIntent ||
      item.queryContext.commercialFit)
  ) {
    score += 18;
    whyMatched.push("Strong Autoaffi fit");
    tags.add("autoaffi-fit");
  }

  if (
    !directHelp &&
    !personalLead &&
    !monetizationLead &&
    !hasPain &&
    !contextualInterest
  ) {
    score -= 34;
    whyMatched.push("Not direct enough");
    tags.add("not-direct-enough");
  }

  if (
    hasIncomeIntent &&
    !hasQuestion &&
    !directHelp &&
    !personalLead &&
    !monetizationLead &&
    !contextualInterest
  ) {
    score -= 25;
    whyMatched.push("Generic income mention without lead intent");
    tags.add("generic-income-no-lead");
  }

  score = Math.min(100, Math.max(0, score));

  const temperature: Temperature =
    score >= 76 ? "hot" : score >= 46 ? "warm" : "cold";

  return {
    score,
    temperature,
    whyMatched:
      whyMatched.length > 0
        ? Array.from(new Set(whyMatched)).slice(0, 14)
        : ["Matches public discussion signal language"],
    tags: Array.from(tags).slice(0, 24),
  };
}

function buildBlueskySuggestedOpener(item: BlueskyItem) {
  const text = cleanText(`${item.title} ${item.text}`);

  if (
    /\b(beehiiv|substack|ghost|patreon|newsletter|migrate the newsletter|financially viable alternative|shoestring budget)\b/i.test(
      text
    )
  ) {
    return "I saw your post about newsletter platforms. Before switching again, I’d compare the platform based on audience ownership, monetization options, tracking, and how easily you can connect content to offers.";
  }

  if (/\b(godaddy|website builder|landing page builder|carrd)\b/i.test(text)) {
    return "I saw your post about website builders. I’d focus on whether the tool can create simple landing pages, capture leads, and track which content or offer actually brings clicks.";
  }

  if (
    /\b(no clicks|no sales|no leads|no traffic|links dying|dead links|not working|failed|struggling|stuck|confused|overwhelmed|get clicks|getting clicks|getting sales)\b/i.test(
      text
    )
  ) {
    return "I saw your post about struggling to get results. The first thing I’d check is whether you are tracking each offer and each content post separately, because without that it is almost impossible to know what is actually working.";
  }

  if (
    /\b(affiliate|affiliate marketing|amazon associates|commission|commissions|affiliate links?|offers?|affiliate program)\b/i.test(
      text
    )
  ) {
    return "I saw your post about affiliate marketing. A simple way to improve is to choose one clear offer, create helpful content around the problem it solves, and track each post separately instead of jumping between random products.";
  }

  return "I saw your post and thought it was relevant. If you are trying to grow online, I’d focus on one clear offer, useful content, and proper tracking before adding more platforms.";
}

function shouldSaveBlueskyCandidate(params: {
  item: BlueskyItem;
  scoring: BlueskyScoringResult;
  strict: boolean;
}) {
  const { item, scoring, strict } = params;
  const tags = new Set(scoring.tags);
  const fullText = cleanText(`${item.title} ${item.text}`);
  const threshold = strict
    ? BSKY_SAVE_THRESHOLD_STRICT
    : BSKY_SAVE_THRESHOLD_LOOSE;

  const directEnough =
    hasBlueskyDirectHelpIntent(fullText) ||
    hasBlueskyPersonalLeadIntent(fullText) ||
    hasBlueskyMonetizationLeadIntent(fullText) ||
    (tags.has("pain-point") && tags.has("tool-interest"));

  const precisionEnough =
    (tags.has("personal-lead") &&
      (tags.has("pain-point") ||
        tags.has("monetization-lead") ||
        tags.has("direct-help"))) ||
    (tags.has("monetization-lead") && tags.has("tool-interest")) ||
    (tags.has("pain-point") &&
      tags.has("tool-interest") &&
      (tags.has("creator-intent") || tags.has("context-website_builder")));

  if (!directEnough) return false;
  if (!precisionEnough) return false;
  if (tags.has("observational-only")) return false;
  if (tags.has("generic-income-no-lead")) return false;
  if (isBlueskyAccountLikelyPromoOrPublisher(item)) return false;

  return (
    scoring.score >= threshold &&
    tags.has("autoaffi-fit") &&
    (tags.has("personal-lead") ||
      tags.has("monetization-lead") ||
      tags.has("direct-help") ||
      tags.has("pain-point")) &&
    (tags.has("affiliate") ||
      tags.has("creator-intent") ||
      tags.has("tool-interest") ||
      tags.has("autoaffi-fit"))
  );
}

function mapBlueskyPost(post: BlueskyRawPost, query: string): BlueskyItem | null {
  const text = cleanText(post.record?.text || "");
  const uri = String(post.uri || "");
  const link = buildBlueskyPostUrl(post);
  const publishedAt = post.record?.createdAt || post.indexedAt || null;

  if (!text || !uri || !link) return null;

  return {
    provider: "bluesky",
    sourceName: `bluesky:${query}`,
    sourceType: "bluesky_search_post",
    query,
    queryContext: getBlueskyQueryContext(query),
    title: text.slice(0, 120),
    text,
    link,
    id: uri,
    uri,
    cid: post.cid || null,
    authorHandle: post.author?.handle || null,
    authorDisplayName: post.author?.displayName || null,
    authorDid: post.author?.did || null,
    publishedAt,
    indexedAt: post.indexedAt || null,
    isReply: Boolean(post.record?.reply),
    engagement: {
      likes: Number(post.likeCount || 0),
      replies: Number(post.replyCount || 0),
      reposts: Number(post.repostCount || 0),
      quotes: Number(post.quoteCount || 0),
    },
  };
}

async function fetchBlueskySearch(params: { query: string; limit: number }) {
  const { query, limit } = params;

  const errors: string[] = [];

  for (const base of BSKY_SEARCH_BASES) {
    const url = new URL(base);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("sort", "latest");

    try {
      const res = await fetch(url.toString(), {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      const rawText = await res.text().catch(() => "");
      let data: any = null;

      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        data = null;
      }

      if (!res.ok || !data) {
        errors.push(
          `${base} failed ${res.status}: ${
            rawText.slice(0, 300) || "empty body"
          }`
        );
        continue;
      }

      const posts = Array.isArray(data.posts) ? data.posts : [];

      return posts
        .map((post: BlueskyRawPost) => mapBlueskyPost(post, query))
        .filter(Boolean) as BlueskyItem[];
    } catch (error) {
      errors.push(
        `${base} failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  throw new Error(errors.join(" | "));
}

function normalizeBlueskyItemToSignal(params: {
  item: BlueskyItem;
  strict: boolean;
  maxAgeDays: number;
}): BlueskyLeadSignal | null {
  const { item, strict, maxAgeDays } = params;
  const fullText = cleanText(`${item.title} ${item.text}`);

  if (isMostlyJunk(fullText)) return null;

  const ageDays = getBlueskyAgeDays(item.publishedAt);
  if (ageDays !== null && ageDays > maxAgeDays) return null;

  const hardBlockReason = getBlueskyHardBlockReason(fullText);
  if (hardBlockReason) return null;

  const contentRiskReason = getBlueskyContentPostRiskReason(item);
  if (contentRiskReason) return null;

  const scoring = scoreBlueskyIntent(item);

  if (!shouldSaveBlueskyCandidate({ item, scoring, strict })) {
    return null;
  }

  const externalId = `bluesky_${safeExternalPart(item.uri || item.id)}`;

  return {
    externalId,
    sourcePlatform: "bluesky",
    sourceType: "bluesky_search_post",
    sourceUrl: item.link,
    sourcePostUri: item.uri,
    sourceQuery: item.query,
    sourceQueryContext: item.queryContext,
    sourceUsername: item.authorHandle || item.authorDisplayName,
    sourceAuthorChannelUrl: item.authorHandle
      ? `https://bsky.app/profile/${item.authorHandle}`
      : null,
    sourceTitle: item.title,
    sourceChannel: "Bluesky",
    sourceText: item.text,
    publishedAt: item.publishedAt,
    updatedAt: item.indexedAt,
    score: scoring.score,
    temperature: scoring.temperature,
    whyMatched: scoring.whyMatched,
    suggestedOpener: buildBlueskySuggestedOpener(item),
    tags: scoring.tags,
    raw: item,
  };
}

function getBlueskyQueriesFromSource(source: GlobalSocialLeadSource) {
  const rawQueries = source.config?.queries;

  if (Array.isArray(rawQueries)) {
    return rawQueries
      .map((q) => cleanText(q))
      .filter(Boolean)
      .slice(0, 30);
  }

  if (typeof rawQueries === "string") {
    return rawQueries
      .split(",")
      .map((q) => cleanText(q))
      .filter(Boolean)
      .slice(0, 30);
  }

  return DEFAULT_BLUESKY_QUERIES;
}

/* ---------------------------------------------------
   REDDIT RSS ENGINE
--------------------------------------------------- */

function getRedditFeedsFromSource(source: GlobalSocialLeadSource) {
  const rawFeeds = source.config?.feeds;

  if (Array.isArray(rawFeeds)) {
    return rawFeeds
      .map((feed) => cleanText(feed).replace(/^r\//i, ""))
      .filter(Boolean)
      .slice(0, 30);
  }

  if (typeof rawFeeds === "string") {
    return rawFeeds
      .split(",")
      .map((feed) => cleanText(feed).replace(/^r\//i, ""))
      .filter(Boolean)
      .slice(0, 30);
  }

  return DEFAULT_REDDIT_FEEDS;
}

function getRotatedRedditFeeds(params: {
  feeds: string[];
  cursorIndex: number;
  maxFeedsPerRun: number;
}) {
  const { feeds, cursorIndex, maxFeedsPerRun } = params;

  if (!feeds.length) {
    return {
      feedsToScan: [] as string[],
      skippedFeeds: [] as string[],
      normalizedCursorIndex: 0,
      nextCursorIndex: 0,
    };
  }

  const normalizedCursorIndex =
    ((cursorIndex % feeds.length) + feeds.length) % feeds.length;

  const feedsToScan: string[] = [];

  for (let i = 0; i < Math.min(maxFeedsPerRun, feeds.length); i += 1) {
    const index = (normalizedCursorIndex + i) % feeds.length;
    feedsToScan.push(feeds[index]);
  }

  const scannedSet = new Set(feedsToScan);

  const skippedFeeds = feeds.filter((feed) => !scannedSet.has(feed));

  const nextCursorIndex =
    (normalizedCursorIndex + feedsToScan.length) % feeds.length;

  return {
    feedsToScan,
    skippedFeeds,
    normalizedCursorIndex,
    nextCursorIndex,
  };
}

function buildRedditFeedUrls(feed: string) {
  const cleanFeed = cleanText(feed).replace(/^r\//i, "");

  return [
    `https://www.reddit.com/r/${encodeURIComponent(cleanFeed)}/new/.rss`,
    `https://old.reddit.com/r/${encodeURIComponent(cleanFeed)}/new/.rss`,
    `https://www.reddit.com/r/${encodeURIComponent(cleanFeed)}/.rss`,
    `https://old.reddit.com/r/${encodeURIComponent(cleanFeed)}/.rss`,
  ];
}

function extractXmlTag(xml: string, tag: string) {
  const pattern = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = xml.match(pattern);
  return match?.[1] ? cleanText(match[1]) : "";
}

function extractRedditLink(entryXml: string) {
  const linkMatch =
    entryXml.match(/<link[^>]*href="([^"]+)"[^>]*>/i) ||
    entryXml.match(/<link[^>]*href='([^']+)'[^>]*>/i);

  return cleanText(linkMatch?.[1] || "");
}

function parseRedditRssFeed(xml: string, feed: string): RedditItem[] {
  const entries = xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  const subreddit = cleanText(feed).replace(/^r\//i, "");

  return entries
    .map((entry) => {
      const title = extractXmlTag(entry, "title");
      const content = extractXmlTag(entry, "content");
      const id = extractXmlTag(entry, "id");
      const publishedAt = extractXmlTag(entry, "published");
      const updatedAt = extractXmlTag(entry, "updated");
      const authorBlock = entry.match(/<author[\s\S]*?<\/author>/i)?.[0] || "";
      const author = extractXmlTag(authorBlock, "name") || null;
      const link = extractRedditLink(entry);

      const text = cleanText(`${title}. ${content}`);

      if (!title || !link || !text) return null;

      return {
        provider: "reddit" as const,
        sourceName: `reddit:r/${subreddit}`,
        sourceType: "reddit_rss_post" as const,
        feed: subreddit,
        subreddit,
        title,
        text,
        link,
        id: id || link,
        author,
        publishedAt: publishedAt || updatedAt || null,
        updatedAt: updatedAt || publishedAt || null,
      };
    })
    .filter(Boolean) as RedditItem[];
}

function getRedditHardBlockReason(text: string) {
  const cleaned = cleanText(text).toLowerCase();

  const blocks: Array<{ reason: string; patterns: RegExp[] }> = [
    {
      reason: "task_platform_or_job_noise",
      patterns: [
        /\btelus\b/i,
        /\bappen\b/i,
        /\boutlier\b/i,
        /\bremotasks\b/i,
        /\buhrs\b/i,
        /\bdata annotation\b/i,
        /\bdataannotation\b/i,
        /\btranscribeme\b/i,
        /\bbabel audio\b/i,
        /\brespondent\b/i,
        /\bprolific\b/i,
        /\bmturk\b/i,
        /\bmechanical turk\b/i,
        /\bexam\b/i,
        /\bid verification\b/i,
        /\bresume\b/i,
        /\bcv\b/i,
        /\binterview\b/i,
        /\bjob application\b/i,
        /\bhiring\b/i,
        /\bjob offer\b/i,
        /\bfull time job\b/i,
        /\bpart time job\b/i,
      ],
    },
    {
      reason: "crypto_trading_or_gambling_noise",
      patterns: [
        /\bcrypto\b/i,
        /\bbitcoin\b/i,
        /\bbtc\b/i,
        /\beth\b/i,
        /\bforex\b/i,
        /\btrading\b/i,
        /\btrader\b/i,
        /\bstocks?\b/i,
        /\boptions\b/i,
        /\bcasino\b/i,
        /\bbetting\b/i,
        /\bgambling\b/i,
        /\bsportsbook\b/i,
        /\bnft\b/i,
        /\bstaking\b/i,
      ],
    },
    {
      reason: "adult_or_sensitive_noise",
      patterns: [
        /\bonlyfans\b/i,
        /\badult\b/i,
        /\bnsfw\b/i,
        /\bnudes?\b/i,
        /\bescort\b/i,
        /��/i,
        /\bmedical\b/i,
        /\bdiagnosis\b/i,
        /\btherapy\b/i,
        /\bmental health\b/i,
        /\blawsuit\b/i,
        /\bcrime\b/i,
        /\bwar\b/i,
      ],
    },
    {
      reason: "spam_or_promo_noise",
      patterns: [
        /\bdm me\b/i,
        /\bmessage me\b/i,
        /\blink in bio\b/i,
        /\bwhatsapp\b/i,
        /\btelegram\b/i,
        /\bguaranteed income\b/i,
        /\bguaranteed profit\b/i,
        /\bget rich quick\b/i,
        /\bcopy paste\b/i,
        /\bfree money\b/i,
        /\bairdrop\b/i,
      ],
    },
    {
      reason: "minor_or_age_risk",
      patterns: [
        /\bas a minor\b/i,
        /\bminor\b/i,
        /\b17yo\b/i,
        /\b17 yo\b/i,
        /\b16yo\b/i,
        /\b16 yo\b/i,
        /\b15yo\b/i,
        /\b15 yo\b/i,
      ],
    },
  ];

  for (const group of blocks) {
    if (group.patterns.some((pattern) => pattern.test(cleaned))) {
      return group.reason;
    }
  }

  return null;
}

function hasRedditQuestionIntent(text: string) {
  return hasRealQuestionIntent(text);
}

function hasRedditDirectHelpIntent(text: string) {
  const cleaned = cleanText(text);

  return /\b(need help|need advice|any advice|please help|looking for advice|could use some advice|how do i|how can i|what should i|where do i start|how to start|best way to start|is there a way|recommend|recommendation|any recommendations|anyone know|does anyone know|what platform|which platform|what tool|which tool|legit way|realistic way)\b/i.test(
    cleaned
  );
}

function hasRedditPersonalLeadIntent(text: string) {
  const cleaned = cleanText(text);

  return /\b(i need|i want|i'm trying|i am trying|i'm looking|i am looking|i'm stuck|i am stuck|i struggle|i'm struggling|i am struggling|my blog|my website|my channel|my content|my audience|my newsletter|my side hustle|my affiliate|my links|my posts|starting from scratch|start from scratch|no experience|no audience|no followers|no money|low budget)\b/i.test(
    cleaned
  );
}

function hasRedditMonetizationIntent(text: string) {
  const cleaned = cleanText(text);

  return /\b(extra income|side income|side hustle|passive income|online income|make money online|earn money online|earn from|monetize|monetise|monetization|affiliate marketing|affiliate links?|affiliate program|commissions?|recurring income|income stream|no clicks|no sales|no leads|no traffic|getting traffic|track clicks|tracking links)\b/i.test(
    cleaned
  );
}

function hasRedditPainIntent(text: string) {
  const cleaned = cleanText(text);

  return /\b(no clicks|no sales|no leads|no traffic|not working|failed|struggling|stuck|confused|overwhelmed|scammy|too many options|don't know where to start|dont know where to start|lost|burned out|wasted money|nothing works)\b/i.test(
    cleaned
  );
}

function hasRedditToolIntent(text: string) {
  const cleaned = cleanText(text);

  return /\b(platform|tool|software|system|automation|tracking|analytics|dashboard|landing page|website builder|email marketing|newsletter|link tracker|affiliate network|content plan|workflow)\b/i.test(
    cleaned
  );
}

function isRedditLikelyArticleOrPromo(text: string) {
  const cleaned = cleanText(text).toLowerCase();

  return (
    /\b(here are|ultimate guide|complete guide|i wrote|my guide|check out|just launched|launching|newsletter issue|new blog post|case study:|watch my video|subscribe|join my|download my)\b/i.test(
      cleaned
    ) && !hasRedditDirectHelpIntent(cleaned)
  );
}

function scoreRedditIntent(item: RedditItem): RedditScoringResult {
  const fullText = cleanText(`${item.title}. ${item.text}`);

  let score = 0;
  const whyMatched: string[] = [];
  const tags = new Set<string>();

  const hasQuestion = hasRedditQuestionIntent(fullText);
  const directHelp = hasRedditDirectHelpIntent(fullText);
  const personalLead = hasRedditPersonalLeadIntent(fullText);
  const monetization = hasRedditMonetizationIntent(fullText);
  const pain = hasRedditPainIntent(fullText);
  const tool = hasRedditToolIntent(fullText);

  if (hasQuestion) {
    score += 14;
    whyMatched.push("Asks a question");
    tags.add("question");
  }

  if (directHelp) {
    score += 24;
    whyMatched.push("Direct help/request intent");
    tags.add("direct-help");
  }

  if (personalLead) {
    score += 24;
    whyMatched.push("Personal lead intent");
    tags.add("personal-lead");
  }

  if (monetization) {
    score += 26;
    whyMatched.push("Mentions monetization, affiliate or online income intent");
    tags.add("monetization");
  }

  if (pain) {
    score += 24;
    whyMatched.push("Shows pain, confusion or lack of results");
    tags.add("pain-point");
  }

  if (tool) {
    score += 14;
    whyMatched.push("Looks open to a platform, tool or system");
    tags.add("tool-interest");
  }

  if (
    /\b(beginner|newbie|starting from scratch|start from scratch|no experience|no audience|no followers|low budget)\b/i.test(
      fullText
    )
  ) {
    score += 12;
    whyMatched.push("Beginner/start-from-scratch signal");
    tags.add("beginner");
  }

  if (
    /\b(legit|scam|scammy|realistic|safe|worth it|fake guru|mlm|pyramid)\b/i.test(
      fullText
    )
  ) {
    score += 8;
    whyMatched.push("Trust-sensitive intent");
    tags.add("trust-concern");
  }

  if (fullText.length > 100) {
    score += 4;
    whyMatched.push("Detailed post");
  }

  if (isRedditLikelyArticleOrPromo(fullText)) {
    score -= 35;
    whyMatched.push("Looks like content/promo rather than direct lead");
    tags.add("content-or-promo");
  }

  if (!directHelp && !personalLead && !pain && !hasQuestion) {
    score -= 30;
    whyMatched.push("Not direct enough");
    tags.add("not-direct-enough");
  }

  if ((directHelp || personalLead || pain) && monetization) {
    score += 18;
    whyMatched.push("Strong Autoaffi fit");
    tags.add("autoaffi-fit");
  }

  score = Math.min(100, Math.max(0, score));

  const temperature: Temperature =
    score >= 76 ? "hot" : score >= 46 ? "warm" : "cold";

  return {
    score,
    temperature,
    whyMatched:
      whyMatched.length > 0
        ? Array.from(new Set(whyMatched)).slice(0, 12)
        : ["Matches Reddit online-income discussion language"],
    tags: Array.from(tags).slice(0, 18),
  };
}

function shouldSaveRedditCandidate(params: {
  item: RedditItem;
  scoring: RedditScoringResult;
  strict: boolean;
}) {
  const { item, scoring, strict } = params;
  const text = cleanText(`${item.title}. ${item.text}`);
  const tags = new Set(scoring.tags);
  const threshold = strict
    ? REDDIT_SAVE_THRESHOLD_STRICT
    : REDDIT_SAVE_THRESHOLD_LOOSE;

  if (getRedditHardBlockReason(text)) return false;
  if (isRedditLikelyArticleOrPromo(text)) return false;
  if (tags.has("content-or-promo")) return false;
  if (tags.has("not-direct-enough")) return false;

  const directEnough =
    tags.has("direct-help") ||
    tags.has("personal-lead") ||
    tags.has("pain-point") ||
    (tags.has("question") && tags.has("monetization"));

  const commercialEnough =
    tags.has("monetization") ||
    tags.has("tool-interest") ||
    tags.has("autoaffi-fit");

  return (
    scoring.score >= threshold &&
    directEnough &&
    commercialEnough &&
    tags.has("autoaffi-fit")
  );
}

function buildRedditSuggestedOpener(item: RedditItem) {
  const text = cleanText(`${item.title}. ${item.text}`);

  if (
    /\b(no clicks|no sales|no leads|no traffic|not working|failed|struggling|stuck|confused|overwhelmed)\b/i.test(
      text
    )
  ) {
    return "I saw your Reddit post about struggling to get results. The first thing I’d check is whether you are tracking each offer and each content post separately, because without that it is very hard to know what is actually working.";
  }

  if (
    /\b(affiliate marketing|affiliate links?|affiliate program|commissions?)\b/i.test(
      text
    )
  ) {
    return "I saw your Reddit post about affiliate marketing. A simple way to improve is to choose one clear offer, create helpful content around one problem, and track each post separately instead of jumping between random products.";
  }

  if (
    /\b(side hustle|passive income|extra income|online income|make money online|earn money online)\b/i.test(
      text
    )
  ) {
    return "I saw your Reddit post about building online income. A good first step is to avoid random methods and use a simple system: one clear offer, daily content, and tracking so you know what works.";
  }

  return "I saw your Reddit post and thought it was relevant. If you are trying to grow online, I’d focus on one clear offer, useful content, and proper tracking before adding more platforms.";
}

function normalizeRedditItemToSignal(params: {
  item: RedditItem;
  strict: boolean;
  maxAgeDays: number;
}): RedditLeadSignal | null {
  const { item, strict, maxAgeDays } = params;
  const fullText = cleanText(`${item.title}. ${item.text}`);

  if (isMostlyJunk(fullText)) return null;

  const ageDays = getAgeDays(item.publishedAt);
  if (ageDays !== null && ageDays > maxAgeDays) return null;

  const hardBlockReason = getRedditHardBlockReason(fullText);
  if (hardBlockReason) return null;

  const scoring = scoreRedditIntent(item);

  if (!shouldSaveRedditCandidate({ item, scoring, strict })) {
    return null;
  }

  const externalId = `reddit_${safeExternalPart(item.id || item.link)}`;

  return {
    externalId,
    sourcePlatform: "reddit",
    sourceType: "reddit_rss_post",
    sourceUrl: item.link,
    sourcePostId: item.id,
    sourceFeed: item.feed,
    sourceUsername: item.author,
    sourceAuthorChannelUrl: item.author
      ? `https://www.reddit.com/user/${encodeURIComponent(item.author)}`
      : null,
    sourceTitle: item.title,
    sourceChannel: `r/${item.subreddit}`,
    sourceText: item.text,
    publishedAt: item.publishedAt,
    updatedAt: item.updatedAt,
    score: scoring.score,
    temperature: scoring.temperature,
    whyMatched: scoring.whyMatched,
    suggestedOpener: buildRedditSuggestedOpener(item),
    tags: scoring.tags,
    raw: item,
  };
}

async function fetchRedditFeed(feed: string) {
  const urls = buildRedditFeedUrls(feed);
  const fallbackErrors: string[] = [];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept:
            "application/atom+xml, application/xml, text/xml, application/rss+xml",
          "User-Agent":
            "Mozilla/5.0 (compatible; AutoaffiLeadEngine/1.0; +https://autoaffi.com)",
        },
      });

      const text = await res.text().catch(() => "");

      if (!res.ok) {
        const message = `${url} failed ${res.status}: ${
          text.slice(0, 220) || "empty body"
        }`;

        fallbackErrors.push(message);

        if (res.status === 429) {
          throw new Error(message);
        }

        continue;
      }

      const items = parseRedditRssFeed(text, feed);

      if (!items.length) {
        fallbackErrors.push(`${url} returned 200 but parsed 0 items`);
        continue;
      }

      return {
        feed,
        usedUrl: url,
        items,
        fallbackErrors,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      fallbackErrors.push(`${url} failed: ${message}`);

      if (message.includes("429")) {
        throw new Error(fallbackErrors.join(" | "));
      }
    }
  }

  throw new Error(fallbackErrors.join(" | "));
}

/* ---------------------------------------------------
   SHARED / SCAN
--------------------------------------------------- */

type AutoaffiIdentity = {
  userId: string;
  autoaffiUserCode: string | null;
  status: "found" | "missing";
};

type GlobalPoolLeadRow = {
  id: string;
  external_id: string;
  source_platform: Platform;
  source_type: string;
  source_url: string | null;
  source_username: string | null;
  source_author_url: string | null;
  source_title: string | null;
  source_channel: string | null;
  source_text: string;
  score: number;
  temperature: "HOT" | "WARM" | "COLD";
  why_matched: string[] | null;
  suggested_opener: string | null;
  tags: string[] | null;
  niche: string | null;
  intent_group: string | null;
  raw: Record<string, any> | null;
  pool_status: "available" | "claimed" | "expired" | "blocked";
  expires_at: string;
  claimed_by_user_id: string | null;
  claimed_at: string | null;
  created_at: string;
  updated_at: string;
};

function dedupeSignals<T extends { externalId: string }>(signals: T[]) {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const signal of signals) {
    if (seen.has(signal.externalId)) continue;
    seen.add(signal.externalId);
    result.push(signal);
  }

  return result;
}

function upperTemperature(temp: Temperature): "HOT" | "WARM" | "COLD" {
  if (temp === "hot") return "HOT";
  if (temp === "warm") return "WARM";
  return "COLD";
}

function lowerPlatform(value: string | null | undefined): Platform | null {
  const clean = String(value || "").toLowerCase();

  if (clean === "youtube") return "youtube";
  if (clean === "telegram") return "telegram";
  if (clean === "reddit") return "reddit";
  if (clean === "mlgs") return "mlgs";
  if (clean === "bluesky") return "bluesky";

  return null;
}

function canUserReceivePlatform(user: SocialLeadUserSetting, platform: Platform) {
  if (platform === "youtube") return user.include_youtube;
  if (platform === "telegram") return user.include_telegram;
  if (platform === "mlgs") return user.include_mlgs;
  if (platform === "reddit") return user.include_reddit;
  if (platform === "bluesky") return user.include_bluesky;
  return false;
}

function sourceMatchesUser(
  source: GlobalSocialLeadSource,
  user: SocialLeadUserSetting
) {
  if (!canUserReceivePlatform(user, source.platform)) return false;

  if (source.niche && user.niche && source.niche !== user.niche) {
    return false;
  }

  if (
    source.intent_group &&
    user.intent_group &&
    source.intent_group !== user.intent_group &&
    source.intent_group !== "make_money_online"
  ) {
    return false;
  }

  return true;
}

function poolLeadMatchesUser(
  poolLead: GlobalPoolLeadRow,
  user: SocialLeadUserSetting
) {
  const platform = lowerPlatform(poolLead.source_platform);

  if (!platform) return false;
  if (!canUserReceivePlatform(user, platform)) return false;

  const leadNiche = poolLead.niche || "make_money_online";
  const leadIntentGroup = poolLead.intent_group || "make_money_online";

  if (leadNiche && user.niche && leadNiche !== user.niche) {
    return false;
  }

  if (
    leadIntentGroup &&
    user.intent_group &&
    leadIntentGroup !== user.intent_group &&
    leadIntentGroup !== "make_money_online"
  ) {
    return false;
  }

  return true;
}

function getUserRemainingCap(user: SocialLeadUserSetting, dayKey: string) {
  const cap = clampNumber(user.daily_lead_cap, 1, 50, 3);

  if (user.last_distribution_day_key !== dayKey) {
    return cap;
  }

  const used = Number(user.leads_distributed_today || 0);
  return Math.max(0, cap - used);
}

function getNextScanAt(scanFrequency: GlobalSocialLeadSource["scan_frequency"]) {
  const now = new Date();

  if (scanFrequency === "weekly") {
    now.setDate(now.getDate() + 7);
    return now.toISOString();
  }

  if (scanFrequency === "manual") {
    return null;
  }

  now.setDate(now.getDate() + 1);
  return now.toISOString();
}

function getSignalSourceTitle(signal: LeadSignal) {
  if (signal.sourcePlatform === "youtube") return signal.sourceVideoTitle;
  return signal.sourceTitle;
}

function getSignalSourceChannel(signal: LeadSignal) {
  if (signal.sourcePlatform === "youtube") return signal.sourceChannelTitle;
  return signal.sourceChannel;
}

function getSignalRaw(signal: LeadSignal) {
  if (signal.sourcePlatform === "youtube") return signal;

  if (signal.sourcePlatform === "bluesky") {
    return {
      ...signal.raw,
      sourceQuery: signal.sourceQuery,
      sourceQueryContext: signal.sourceQueryContext,
      score: signal.score,
      temperature: signal.temperature,
      whyMatched: signal.whyMatched,
      suggestedOpener: signal.suggestedOpener,
      tags: signal.tags,
    };
  }

  return {
    ...signal.raw,
    sourceFeed: signal.sourceFeed,
    score: signal.score,
    temperature: signal.temperature,
    whyMatched: signal.whyMatched,
    suggestedOpener: signal.suggestedOpener,
    tags: signal.tags,
  };
}

function buildTrackingContext(params: {
  source: GlobalSocialLeadSource;
  poolLead: GlobalPoolLeadRow;
  identity: AutoaffiIdentity;
}) {
  const { source, poolLead, identity } = params;

  return {
    source: "lead_engine",
    engine: "global_distribution_v5_best_of_day",
    platform: poolLead.source_platform,
    source_type: poolLead.source_type,
    source_id: source.id,
    global_pool_id: poolLead.id,
    external_id: poolLead.external_id,

    autoaffi_identity: {
      status: identity.status,
      source_table: "user_recurring_platforms",
      source_platform: "autoaffi",
      mode: "read_only_existing",
      created_by_lead_engine: false,
    },
  };
}

async function getActiveUsers() {
  const { data, error } = await supabaseAdmin
    .from("social_lead_user_settings")
    .select(
      "id, user_id, enabled, plan, creator_mode, niche, intent_group, daily_lead_cap, include_youtube, include_telegram, include_mlgs, include_reddit, include_bluesky, last_distribution_day_key, leads_distributed_today"
    )
    .eq("enabled", true)
    .limit(250);

  if (error) {
    throw new Error(`Failed to fetch social lead user settings: ${error.message}`);
  }

  return (data ?? []) as SocialLeadUserSetting[];
}

async function getDueGlobalSources(force: boolean) {
  let query = supabaseAdmin
    .from("global_social_lead_sources")
    .select(
      "id, platform, source_type, source_url, source_external_id, title, enabled, niche, intent_group, priority, scan_frequency, max_results, config"
    )
    .eq("enabled", true)
    .order("priority", { ascending: false })
    .limit(50);

  if (!force) {
    query = query.or("next_scan_at.is.null,next_scan_at.lte.now()");
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch global social lead sources: ${error.message}`);
  }

  return (data ?? []) as GlobalSocialLeadSource[];
}

async function updateGlobalSourceScanTime(source: GlobalSocialLeadSource) {
  await supabaseAdmin
    .from("global_social_lead_sources")
    .update({
      last_scanned_at: new Date().toISOString(),
      next_scan_at: getNextScanAt(source.scan_frequency),
      updated_at: new Date().toISOString(),
    })
    .eq("id", source.id);
}

async function updateRedditSourceCursor(params: {
  source: GlobalSocialLeadSource;
  nextRedditCursorIndex: number;
}) {
  const { source, nextRedditCursorIndex } = params;

  const nextConfig = {
    ...(source.config || {}),
    redditCursorIndex: nextRedditCursorIndex,
    redditCursorUpdatedAt: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from("global_social_lead_sources")
    .update({
      config: nextConfig,
      updated_at: new Date().toISOString(),
    })
    .eq("id", source.id);

  if (error) {
    throw new Error(`Failed to update Reddit cursor: ${error.message}`);
  }

  source.config = nextConfig;
}

async function getExistingAutoaffiIdentity(
  userId: string
): Promise<AutoaffiIdentity> {
  const { data, error } = await supabaseAdmin
    .from("user_recurring_platforms")
    .select("user_id, platform, autoaffi_user_code")
    .eq("user_id", userId)
    .eq("platform", "autoaffi")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read Autoaffi identity: ${error.message}`);
  }

  const code =
    typeof data?.autoaffi_user_code === "string" &&
    data.autoaffi_user_code.trim().length > 0
      ? data.autoaffi_user_code.trim()
      : null;

  return {
    userId,
    autoaffiUserCode: code,
    status: code ? "found" : "missing",
  };
}

async function scanYouTubeGlobalSource(source: GlobalSocialLeadSource) {
  const manualVideoIds = getManualYouTubeVideoIdsFromSource(source);
  const discovery = await discoverYouTubeVideosFromSource(source);

  const discoveredVideoIds = discovery.discoveredVideos.map(
    (video) => video.videoId
  );

  const videoIds = Array.from(
    new Set([...manualVideoIds, ...discoveredVideoIds])
  ).slice(
    0,
    clampNumber(
      source.config?.maxVideosPerRun,
      1,
      10,
      YOUTUBE_DISCOVERY_MAX_VIDEOS_DEFAULT
    )
  );

  if (!videoIds.length) {
    throw new Error(`Invalid YouTube source video id for source ${source.id}`);
  }

  const maxResults = clampNumber(
    source.config?.maxCommentsPerVideo ?? source.max_results,
    10,
    100,
    YOUTUBE_DISCOVERY_MAX_COMMENTS_DEFAULT
  );

  const configuredOrders = Array.isArray(source.config?.orders)
    ? source.config.orders
    : null;

  const orders: Array<"time" | "relevance"> =
    configuredOrders
      ?.map((value: unknown) => String(value).toLowerCase())
      .filter(
        (value: string): value is "time" | "relevance" =>
          value === "time" || value === "relevance"
      ) ?? ["time", "relevance"];

  const uniqueOrders = Array.from(new Set(orders));

  const discoveredMetaMap = new Map<string, YouTubeDiscoveredVideo>();

  for (const video of discovery.discoveredVideos) {
    discoveredMetaMap.set(video.videoId, video);
  }

  const allSignals: YouTubeCommentSignal[] = [];
  const videoResults: Array<{
    videoId: string;
    scannedComments: number;
    matchedSignals: number;
    title: string | null;
    channelTitle: string | null;
    sourceQuery: string | null;
    discovered: boolean;
    orderResults: Array<{
      order: "time" | "relevance";
      scannedComments: number;
      error: string | null;
    }>;
    error: string | null;
  }> = [];

  for (const videoId of videoIds) {
    try {
      const discoveredMeta = discoveredMetaMap.get(videoId);

      const videoMeta =
        discoveredMeta?.title || discoveredMeta?.channelTitle
          ? {
              title: discoveredMeta.title,
              channelTitle: discoveredMeta.channelTitle,
            }
          : await fetchYouTubeVideoMeta(videoId);

      if (videoMeta.title && getYouTubeVideoHardBlockReason(videoMeta.title)) {
        videoResults.push({
          videoId,
          scannedComments: 0,
          matchedSignals: 0,
          title: videoMeta.title,
          channelTitle: videoMeta.channelTitle,
          sourceQuery: discoveredMeta?.sourceQuery || null,
          discovered: Boolean(discoveredMeta),
          orderResults: [],
          error: "youtube_video_title_blocked",
        });

        continue;
      }

      const allItems: any[] = [];
      const orderResults: Array<{
        order: "time" | "relevance";
        scannedComments: number;
        error: string | null;
      }> = [];

      for (const order of uniqueOrders) {
        try {
          const items = await fetchYouTubeComments({
            videoId,
            maxResults,
            order,
          });

          allItems.push(...items);

          orderResults.push({
            order,
            scannedComments: items.length,
            error: null,
          });
        } catch (error) {
          orderResults.push({
            order,
            scannedComments: 0,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        if (uniqueOrders.length > 1) {
          await sleep(350);
        }
      }

      const dedupedCommentMap = new Map<string, any>();

      for (const item of allItems) {
        const commentId =
          item?.snippet?.topLevelComment?.id || item?.id || JSON.stringify(item);

        if (!dedupedCommentMap.has(commentId)) {
          dedupedCommentMap.set(commentId, item);
        }
      }

      const dedupedItems = Array.from(dedupedCommentMap.values());

      const signals = dedupeSignals(
        dedupedItems
          .map((item: any) =>
            normalizeCommentToSignal({
              item,
              videoId,
              videoTitle: videoMeta.title,
              channelTitle: videoMeta.channelTitle,
            })
          )
          .filter(Boolean) as YouTubeCommentSignal[]
      );

      allSignals.push(...signals);

      videoResults.push({
        videoId,
        scannedComments: dedupedItems.length,
        matchedSignals: signals.length,
        title: videoMeta.title,
        channelTitle: videoMeta.channelTitle,
        sourceQuery: discoveredMeta?.sourceQuery || null,
        discovered: Boolean(discoveredMeta),
        orderResults,
        error: null,
      });
    } catch (error) {
      videoResults.push({
        videoId,
        scannedComments: 0,
        matchedSignals: 0,
        title: null,
        channelTitle: null,
        sourceQuery: discoveredMetaMap.get(videoId)?.sourceQuery || null,
        discovered: discoveredMetaMap.has(videoId),
        orderResults: [],
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (videoIds.length > 1) {
      await sleep(500);
    }
  }

  const signals = dedupeSignals(allSignals).sort((a, b) => b.score - a.score);

  return {
    videoId: videoIds[0],
    videoIds,
    videosChecked: videoIds.length,
    scannedComments: videoResults.reduce(
      (sum, item) => sum + item.scannedComments,
      0
    ),
    discoveryEnabled: discovery.discoveryEnabled,
    searchQueriesChecked: discovery.queriesChecked,
    discoveryQueryResults: discovery.queryResults,
    discoveryQueryErrors: discovery.queryErrors,
    discoveredVideos: discovery.discoveredVideos,
    videoResults,
    orderResults: videoResults.flatMap((item) =>
      item.orderResults.map((orderResult) => ({
        videoId: item.videoId,
        ...orderResult,
      }))
    ),
    signals,
  };
}

async function scanBlueskyGlobalSource(source: GlobalSocialLeadSource) {
  const queries = getBlueskyQueriesFromSource(source);
  const maxResults = clampNumber(source.max_results, 1, 50, 15);
  const maxAgeDays = clampNumber(source.config?.maxAgeDays, 1, 90, 7);
  const strict = source.config?.strict === true;

  const allItems: BlueskyItem[] = [];
  const queryErrors: any[] = [];
  const queryResults: any[] = [];

  for (const query of queries) {
    try {
      const items = await fetchBlueskySearch({
        query,
        limit: maxResults,
      });

      allItems.push(...items);

      queryResults.push({
        query,
        found: items.length,
        used: items.length,
      });
    } catch (error) {
      queryErrors.push({
        query,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const dedupedMap = new Map<string, BlueskyItem>();

  for (const item of allItems) {
    const key = item.uri || item.id || item.link;
    dedupedMap.set(key, item);
  }

  const dedupedItems = Array.from(dedupedMap.values());

  const signals = dedupeSignals(
    dedupedItems
      .map((item) =>
        normalizeBlueskyItemToSignal({
          item,
          strict,
          maxAgeDays,
        })
      )
      .filter(Boolean) as BlueskyLeadSignal[]
  ).sort((a, b) => b.score - a.score);

  if (allItems.length === 0 && queryErrors.length === queries.length) {
    throw new Error(
      `All Bluesky queries failed: ${queryErrors
        .map((e) => `${e.query}: ${e.error}`)
        .join(" | ")}`
    );
  }

  return {
    queriesChecked: queries.length,
    queryErrors: queryErrors.length,
    queryResults,
    rawItemsFound: allItems.length,
    scannedPosts: dedupedItems.length,
    signals,
  };
}

async function scanRedditGlobalSource(source: GlobalSocialLeadSource) {
  const feeds = getRedditFeedsFromSource(source);

  const maxAgeDays = clampNumber(source.config?.maxAgeDays, 1, 90, 1);
  const strict = source.config?.strict === true;

  const maxFeedsPerRun = clampNumber(
    source.config?.maxFeedsPerRun,
    1,
    5,
    1
  );

  const delayMs = clampNumber(source.config?.delayMs, 0, 5000, 1200);

  const redditCursorIndex = clampNumber(
    source.config?.redditCursorIndex,
    0,
    Math.max(0, feeds.length - 1),
    0
  );

  const rotation = getRotatedRedditFeeds({
    feeds,
    cursorIndex: redditCursorIndex,
    maxFeedsPerRun,
  });

  const allItems: RedditItem[] = [];
  const feedErrors: any[] = [];
  const feedResults: any[] = [];

  for (let index = 0; index < rotation.feedsToScan.length; index += 1) {
    const feed = rotation.feedsToScan[index];

    try {
      const result = await fetchRedditFeed(feed);

      allItems.push(...result.items);

      feedResults.push({
        feed,
        usedUrl: result.usedUrl,
        found: result.items.length,
        used: result.items.length,
        fallbackErrors: result.fallbackErrors,
      });
    } catch (error) {
      feedErrors.push({
        feed,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (delayMs > 0 && index < rotation.feedsToScan.length - 1) {
      await sleep(delayMs);
    }
  }

  const dedupedMap = new Map<string, RedditItem>();

  for (const item of allItems) {
    const key = item.id || item.link;
    dedupedMap.set(key, item);
  }

  const dedupedItems = Array.from(dedupedMap.values());

  const signals = dedupeSignals(
    dedupedItems
      .map((item) =>
        normalizeRedditItemToSignal({
          item,
          strict,
          maxAgeDays,
        })
      )
      .filter(Boolean) as RedditLeadSignal[]
  ).sort((a, b) => b.score - a.score);

  return {
    feedsConfigured: feeds.length,
    feedsChecked: rotation.feedsToScan.length,
    feedsSkippedThisRun: rotation.skippedFeeds.length,
    scannedFeeds: rotation.feedsToScan,
    skippedFeeds: rotation.skippedFeeds,
    redditCursorIndex: rotation.normalizedCursorIndex,
    nextRedditCursorIndex: rotation.nextCursorIndex,
    feedErrors: feedErrors.length,
    feedResults,
    feedErrorDetails: feedErrors,
    rawItemsFound: allItems.length,
    scannedPosts: dedupedItems.length,
    signals,
  };
}

async function upsertSignalsToGlobalPool(params: {
  source: GlobalSocialLeadSource;
  signals: LeadSignal[];
}) {
  const { source, signals } = params;

  if (!signals.length) {
    return {
      upserted: 0,
      rows: [] as GlobalPoolLeadRow[],
    };
  }

  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  const rows = signals.map((signal) => ({
    external_id: signal.externalId,
    source_platform: signal.sourcePlatform,
    source_type: signal.sourceType,

    source_url: signal.sourceUrl,
    source_username: signal.sourceUsername,
    source_author_url: signal.sourceAuthorChannelUrl,
    source_title: getSignalSourceTitle(signal),
    source_channel: getSignalSourceChannel(signal),
    source_text: signal.sourceText,

    score: signal.score,
    temperature: upperTemperature(signal.temperature),
    why_matched: signal.whyMatched,
    suggested_opener: signal.suggestedOpener,
    tags: signal.tags,

    niche: source.niche || "make_money_online",
    intent_group: source.intent_group || "make_money_online",

    raw: getSignalRaw(signal),

    last_seen_at: now.toISOString(),
    expires_at: expiresAt,
    updated_at: now.toISOString(),
  }));

  const { data, error } = await supabaseAdmin
    .from("global_social_lead_pool")
    .upsert(rows as any[], {
      onConflict: "external_id",
      ignoreDuplicates: false,
    })
    .select(
      [
        "id",
        "external_id",
        "source_platform",
        "source_type",
        "source_url",
        "source_username",
        "source_author_url",
        "source_title",
        "source_channel",
        "source_text",
        "score",
        "temperature",
        "why_matched",
        "suggested_opener",
        "tags",
        "niche",
        "intent_group",
        "raw",
        "pool_status",
        "expires_at",
        "claimed_by_user_id",
        "claimed_at",
        "created_at",
        "updated_at",
      ].join(", ")
    );

  if (error) {
    throw new Error(`Failed to upsert global lead pool: ${error.message}`);
  }

  return {
    upserted: rows.length,
    rows: (data ?? []) as unknown as GlobalPoolLeadRow[],
  };
}

async function getAvailablePoolLeadsForSource(params: {
  source: GlobalSocialLeadSource;
  limit: number;
}) {
  const { source, limit } = params;

  let query = supabaseAdmin
    .from("global_social_lead_pool")
    .select(
      [
        "id",
        "external_id",
        "source_platform",
        "source_type",
        "source_url",
        "source_username",
        "source_author_url",
        "source_title",
        "source_channel",
        "source_text",
        "score",
        "temperature",
        "why_matched",
        "suggested_opener",
        "tags",
        "niche",
        "intent_group",
        "raw",
        "pool_status",
        "expires_at",
        "claimed_by_user_id",
        "claimed_at",
        "created_at",
        "updated_at",
      ].join(", ")
    )
    .eq("pool_status", "available")
    .eq("source_platform", source.platform)
    .gt("expires_at", new Date().toISOString())
    .order("score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (source.niche) {
    query = query.eq("niche", source.niche);
  }

  if (source.intent_group) {
    query = query.in("intent_group", [
      source.intent_group,
      "make_money_online",
    ]);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch available pool leads: ${error.message}`);
  }

  return (data ?? []) as unknown as GlobalPoolLeadRow[];
}

async function getBestAvailablePoolLeadsForDistribution(params: {
  limit: number;
}) {
  const { limit } = params;

  const { data, error } = await supabaseAdmin
    .from("global_social_lead_pool")
    .select(
      [
        "id",
        "external_id",
        "source_platform",
        "source_type",
        "source_url",
        "source_username",
        "source_author_url",
        "source_title",
        "source_channel",
        "source_text",
        "score",
        "temperature",
        "why_matched",
        "suggested_opener",
        "tags",
        "niche",
        "intent_group",
        "raw",
        "pool_status",
        "expires_at",
        "claimed_by_user_id",
        "claimed_at",
        "created_at",
        "updated_at",
      ].join(", ")
    )
    .eq("pool_status", "available")
    .gt("expires_at", new Date().toISOString())
    .order("score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(
      `Failed to fetch best available pool leads: ${error.message}`
    );
  }

  const rows = (data ?? []) as unknown as GlobalPoolLeadRow[];

  return rows.sort((a, b) => {
    const tempRank = (lead: GlobalPoolLeadRow) => {
      if (lead.temperature === "HOT") return 3;
      if (lead.temperature === "WARM") return 2;
      return 1;
    };

    const platformRank = (lead: GlobalPoolLeadRow) => {
      if (lead.source_platform === "youtube") return 5;
      if (lead.source_platform === "reddit") return 4;
      if (lead.source_platform === "bluesky") return 3;
      if (lead.source_platform === "telegram") return 2;
      if (lead.source_platform === "mlgs") return 1;
      return 0;
    };

    const aTemp = tempRank(a);
    const bTemp = tempRank(b);

    if (aTemp !== bTemp) return bTemp - aTemp;

    const aScore = Number(a.score || 0);
    const bScore = Number(b.score || 0);

    if (aScore !== bScore) return bScore - aScore;

    const aPlatform = platformRank(a);
    const bPlatform = platformRank(b);

    if (aPlatform !== bPlatform) return bPlatform - aPlatform;

    const aCreated = new Date(a.created_at || 0).getTime();
    const bCreated = new Date(b.created_at || 0).getTime();

    return bCreated - aCreated;
  });
}

function findSourceForPoolLead(params: {
  poolLead: GlobalPoolLeadRow;
  sources: GlobalSocialLeadSource[];
}) {
  const { poolLead, sources } = params;

  const platform = lowerPlatform(poolLead.source_platform);

  const exactSource = sources.find(
    (source) =>
      source.platform === platform && source.source_type === poolLead.source_type
  );

  if (exactSource) return exactSource;

  const platformSource = sources.find((source) => source.platform === platform);

  if (platformSource) return platformSource;

  return (
    sources[0] || {
      id: "global_best_of_day",
      platform: platform || "youtube",
      source_type: poolLead.source_type,
      source_url: poolLead.source_url || "global://best-of-day",
      source_external_id: null,
      title: "Global best-of-day distribution",
      enabled: true,
      niche: poolLead.niche || "make_money_online",
      intent_group: poolLead.intent_group || "make_money_online",
      priority: 0,
      scan_frequency: "daily",
      max_results: null,
      config: null,
    }
  );
}

async function expireOldPoolLeads() {
  const { error } = await supabaseAdmin
    .from("global_social_lead_pool")
    .update({
      pool_status: "expired",
      updated_at: new Date().toISOString(),
    })
    .eq("pool_status", "available")
    .lte("expires_at", new Date().toISOString());

  if (error) {
    throw new Error(`Failed to expire old pool leads: ${error.message}`);
  }
}

async function claimPoolLeadForUser(params: {
  userId: string;
  source: GlobalSocialLeadSource;
  poolLead: GlobalPoolLeadRow;
  identity: AutoaffiIdentity;
}) {
  const { source, poolLead, userId, identity } = params;

  const trackingContext = buildTrackingContext({
    source,
    poolLead,
    identity,
  });

  const now = new Date().toISOString();

  const { error } = await supabaseAdmin.from("lead_signal_claims").insert({
    external_id: poolLead.external_id,
    source_platform: poolLead.source_platform,
    source_type: poolLead.source_type,
    source_url: poolLead.source_url,
    source_username: poolLead.source_username,

    claimed_by_user_id: userId,
    claim_status: "claimed",
    claimed_at: now,

    autoaffi_user_code: identity.autoaffiUserCode,
    autoaffi_identity_status: identity.status,
    tracking_context: trackingContext,
    global_pool_id: poolLead.id,

    updated_at: now,
  });

  if (!error) {
    const { error: poolError } = await supabaseAdmin
      .from("global_social_lead_pool")
      .update({
        pool_status: "claimed",
        claimed_by_user_id: userId,
        claimed_at: now,
        updated_at: now,
      })
      .eq("id", poolLead.id)
      .eq("pool_status", "available");

    if (poolError) {
      throw new Error(`Failed to mark pool lead claimed: ${poolError.message}`);
    }

    return {
      claimed: true,
      reason: null as string | null,
    };
  }

  const message = error.message || "";

  if (
    error.code === "23505" ||
    message.includes("lead_signal_claims_external_active_unique") ||
    message.includes("duplicate key")
  ) {
    const { data: existingClaim, error: lookupError } = await supabaseAdmin
      .from("lead_signal_claims")
      .select("id, claimed_by_user_id, claim_status")
      .eq("external_id", poolLead.external_id)
      .eq("claim_status", "claimed")
      .maybeSingle();

    if (lookupError) {
      throw new Error(`Failed to inspect existing claim: ${lookupError.message}`);
    }

    if (existingClaim?.claimed_by_user_id === userId) {
      await supabaseAdmin
        .from("lead_signal_claims")
        .update({
          autoaffi_user_code: identity.autoaffiUserCode,
          autoaffi_identity_status: identity.status,
          tracking_context: trackingContext,
          global_pool_id: poolLead.id,
          updated_at: now,
        })
        .eq("id", existingClaim.id);

      const { error: poolError } = await supabaseAdmin
        .from("global_social_lead_pool")
        .update({
          pool_status: "claimed",
          claimed_by_user_id: userId,
          claimed_at: now,
          updated_at: now,
        })
        .eq("id", poolLead.id)
        .eq("pool_status", "available");

      if (poolError) {
        throw new Error(
          `Failed to mark existing pool lead claimed: ${poolError.message}`
        );
      }

      return {
        claimed: true,
        reason: "already_claimed_by_same_user",
      };
    }

    return {
      claimed: false,
      reason: "already_claimed",
    };
  }

  throw new Error(`Lead claim failed: ${error.message}`);
}

async function savePoolLeadToUser(params: {
  userId: string;
  source: GlobalSocialLeadSource;
  poolLead: GlobalPoolLeadRow;
  identity: AutoaffiIdentity;
}) {
  const { userId, source, poolLead, identity } = params;

  const trackingContext = buildTrackingContext({
    source,
    poolLead,
    identity,
  });

  const row = {
    user_id: userId,

    source: poolLead.source_platform,
    source_url: poolLead.source_url,
    snippet: poolLead.source_text,
    author_hint: poolLead.source_username,
    why: poolLead.why_matched || [],

    source_platform: poolLead.source_platform,
    source_type: poolLead.source_type,
    external_id: poolLead.external_id,
    source_username: poolLead.source_username,
    source_author_url: poolLead.source_author_url,
    source_title: poolLead.source_title,
    source_channel: poolLead.source_channel,
    source_text: poolLead.source_text,
    score: poolLead.score,
    temperature: poolLead.temperature,
    why_matched: poolLead.why_matched || [],
    suggested_opener: poolLead.suggested_opener,
    tags: poolLead.tags || [],
    status: "new",
    raw: poolLead.raw || {},

    autoaffi_user_code: identity.autoaffiUserCode,
    autoaffi_identity_status: identity.status,
    tracking_context: trackingContext,
    global_pool_id: poolLead.id,

    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from("lead_signals")
    .upsert(row as any, {
      onConflict: "user_id,external_id",
      ignoreDuplicates: false,
    });

  if (error) {
    throw new Error(`Supabase save failed: ${error.message}`);
  }
}

async function updateUserDistributionCount(params: {
  user: SocialLeadUserSetting;
  dayKey: string;
  added: number;
}) {
  const { user, dayKey, added } = params;

  if (added <= 0) return;

  const previous =
    user.last_distribution_day_key === dayKey
      ? Number(user.leads_distributed_today || 0)
      : 0;

  const nextTotal = previous + added;

  await supabaseAdmin
    .from("social_lead_user_settings")
    .update({
      last_distribution_day_key: dayKey,
      leads_distributed_today: nextTotal,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.user_id);

  user.last_distribution_day_key = dayKey;
  user.leads_distributed_today = nextTotal;
}

async function distributePoolLeadsToUsers(params: {
  source: GlobalSocialLeadSource;
  users: SocialLeadUserSetting[];
  dayKey: string;
  poolLeads: GlobalPoolLeadRow[];
}) {
  const { source, users, dayKey, poolLeads } = params;

  let claimed = 0;
  let saved = 0;
  let alreadyClaimed = 0;
  let capSkipped = 0;
  let identityFound = 0;
  let identityMissing = 0;

  const identityCache = new Map<string, AutoaffiIdentity>();

  async function getIdentity(userId: string) {
    const cached = identityCache.get(userId);
    if (cached) return cached;

    const identity = await getExistingAutoaffiIdentity(userId);
    identityCache.set(userId, identity);

    return identity;
  }

  for (const user of users) {
    let remainingCap = getUserRemainingCap(user, dayKey);

    if (remainingCap <= 0) {
      capSkipped += 1;
      continue;
    }

    let userAdded = 0;

    const identity = await getIdentity(user.user_id);

    if (identity.status === "found") {
      identityFound += 1;
    } else {
      identityMissing += 1;
    }

    for (const poolLead of poolLeads) {
      if (remainingCap <= 0) break;
      if (poolLead.pool_status !== "available") continue;
      if (!poolLeadMatchesUser(poolLead, user)) continue;

      const claim = await claimPoolLeadForUser({
        userId: user.user_id,
        source,
        poolLead,
        identity,
      });

      if (!claim.claimed) {
        alreadyClaimed += 1;
        continue;
      }

      await savePoolLeadToUser({
        userId: user.user_id,
        source,
        poolLead,
        identity,
      });

      poolLead.pool_status = "claimed";
      poolLead.claimed_by_user_id = user.user_id;
      poolLead.claimed_at = new Date().toISOString();

      userAdded += 1;
      remainingCap -= 1;
      claimed += 1;
      saved += 1;
    }

    await updateUserDistributionCount({
      user,
      dayKey,
      added: userAdded,
    });
  }

  return {
    claimed,
    saved,
    alreadyClaimed,
    capSkipped,
    identityFound,
    identityMissing,
  };
}

async function distributeBestPoolLeadsToUsers(params: {
  users: SocialLeadUserSetting[];
  sources: GlobalSocialLeadSource[];
  dayKey: string;
  poolLeads: GlobalPoolLeadRow[];
}) {
  const { users, sources, dayKey, poolLeads } = params;

  let claimed = 0;
  let saved = 0;
  let alreadyClaimed = 0;
  let capSkipped = 0;
  let identityFound = 0;
  let identityMissing = 0;

  const userResults: Array<{
    userId: string;
    remainingCapAtStart: number;
    claimed: number;
    saved: number;
    capSkipped: boolean;
    identityStatus: "found" | "missing";
    selectedLeadIds: string[];
    selectedPlatforms: string[];
  }> = [];

  const identityCache = new Map<string, AutoaffiIdentity>();

  async function getIdentity(userId: string) {
    const cached = identityCache.get(userId);
    if (cached) return cached;

    const identity = await getExistingAutoaffiIdentity(userId);
    identityCache.set(userId, identity);

    return identity;
  }

  for (const user of users) {
    let remainingCap = getUserRemainingCap(user, dayKey);
    const remainingCapAtStart = remainingCap;

    if (remainingCap <= 0) {
      capSkipped += 1;

      userResults.push({
        userId: user.user_id,
        remainingCapAtStart,
        claimed: 0,
        saved: 0,
        capSkipped: true,
        identityStatus: "missing",
        selectedLeadIds: [],
        selectedPlatforms: [],
      });

      continue;
    }

    const identity = await getIdentity(user.user_id);

    if (identity.status === "found") {
      identityFound += 1;
    } else {
      identityMissing += 1;
    }

    let userAdded = 0;
    const selectedLeadIds: string[] = [];
    const selectedPlatforms: string[] = [];

    for (const poolLead of poolLeads) {
      if (remainingCap <= 0) break;
      if (poolLead.pool_status !== "available") continue;
      if (!poolLeadMatchesUser(poolLead, user)) continue;

      const source = findSourceForPoolLead({
        poolLead,
        sources,
      });

      const claim = await claimPoolLeadForUser({
        userId: user.user_id,
        source,
        poolLead,
        identity,
      });

      if (!claim.claimed) {
        alreadyClaimed += 1;
        continue;
      }

      await savePoolLeadToUser({
        userId: user.user_id,
        source,
        poolLead,
        identity,
      });

      poolLead.pool_status = "claimed";
      poolLead.claimed_by_user_id = user.user_id;
      poolLead.claimed_at = new Date().toISOString();

      userAdded += 1;
      remainingCap -= 1;
      claimed += 1;
      saved += 1;

      selectedLeadIds.push(poolLead.id);
      selectedPlatforms.push(String(poolLead.source_platform));
    }

    await updateUserDistributionCount({
      user,
      dayKey,
      added: userAdded,
    });

    userResults.push({
      userId: user.user_id,
      remainingCapAtStart,
      claimed: userAdded,
      saved: userAdded,
      capSkipped: false,
      identityStatus: identity.status,
      selectedLeadIds,
      selectedPlatforms,
    });
  }

  return {
    claimed,
    saved,
    alreadyClaimed,
    capSkipped,
    identityFound,
    identityMissing,
    userResults,
  };
}

export async function GET(req: Request) {
  try {
    if (!checkCronAuth(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "true";
    const dayKey = getStockholmDayKey();

    await expireOldPoolLeads();

    const users = await getActiveUsers();
    const sources = await getDueGlobalSources(force);

    const results: any[] = [];
    const errors: any[] = [];

    let totalScannedComments = 0;
    let totalScannedPosts = 0;
    let totalMatchedSignals = 0;

    let totalPoolUpserted = 0;
    let totalPoolAvailableCandidates = 0;

    let totalClaimed = 0;
    let totalSaved = 0;
    let totalAlreadyClaimed = 0;
    let totalCapSkipped = 0;
    let totalNoUserMatchSkipped = 0;

    let totalIdentityFound = 0;
    let totalIdentityMissing = 0;

    for (const source of sources) {
      try {
        const matchingUsers = users.filter((user) =>
          sourceMatchesUser(source, user)
        );

        if (!matchingUsers.length) {
          totalNoUserMatchSkipped += 1;

          results.push({
            sourceId: source.id,
            platform: source.platform,
            sourceType: source.source_type,
            sourceUrl: source.source_url,
            matchedUsers: 0,
            scannedComments: 0,
            scannedPosts: 0,
            matchedSignals: 0,
            poolUpserted: 0,
            poolAvailableCandidates: 0,
            claimed: 0,
            saved: 0,
            distributionMode: "deferred_global_best_of_day",
            skipped: "no_matching_users",
          });

          await updateGlobalSourceScanTime(source);
          continue;
        }

        if (
          source.platform === "youtube" &&
          source.source_type === "youtube_video"
        ) {
          const scan = await scanYouTubeGlobalSource(source);

          totalScannedComments += scan.scannedComments;
          totalMatchedSignals += scan.signals.length;

          const pool = await upsertSignalsToGlobalPool({
            source,
            signals: scan.signals,
          });

          totalPoolUpserted += pool.upserted;

          const poolCandidates = await getAvailablePoolLeadsForSource({
            source,
            limit: 100,
          });

          await updateGlobalSourceScanTime(source);

          results.push({
            sourceId: source.id,
            platform: source.platform,
            sourceType: source.source_type,
            sourceUrl: source.source_url,
            matchedUsers: matchingUsers.length,
            scannedComments: scan.scannedComments,
            scannedPosts: 0,
            matchedSignals: scan.signals.length,

            discoveryEnabled: scan.discoveryEnabled,
            searchQueriesChecked: scan.searchQueriesChecked,
            discoveryQueryResults: scan.discoveryQueryResults,
            discoveryQueryErrors: scan.discoveryQueryErrors,
            discoveredVideos: scan.discoveredVideos,

            videoIds: scan.videoIds,
            videosChecked: scan.videosChecked,
            videoResults: scan.videoResults,
            orderResults: scan.orderResults,

            poolUpserted: pool.upserted,
            poolAvailableCandidates: poolCandidates.length,

            claimed: 0,
            saved: 0,
            alreadyClaimed: 0,
            capSkipped: 0,
            identityFound: 0,
            identityMissing: 0,
            distributionMode: "deferred_global_best_of_day",
          });

          continue;
        }

        if (
          source.platform === "bluesky" &&
          source.source_type === "bluesky_search"
        ) {
          const scan = await scanBlueskyGlobalSource(source);

          totalScannedPosts += scan.scannedPosts;
          totalMatchedSignals += scan.signals.length;

          const pool = await upsertSignalsToGlobalPool({
            source,
            signals: scan.signals,
          });

          totalPoolUpserted += pool.upserted;

          const poolCandidates = await getAvailablePoolLeadsForSource({
            source,
            limit: 100,
          });

          await updateGlobalSourceScanTime(source);

          results.push({
            sourceId: source.id,
            platform: source.platform,
            sourceType: source.source_type,
            sourceUrl: source.source_url,
            matchedUsers: matchingUsers.length,
            queriesChecked: scan.queriesChecked,
            queryErrors: scan.queryErrors,
            rawItemsFound: scan.rawItemsFound,
            scannedComments: 0,
            scannedPosts: scan.scannedPosts,
            matchedSignals: scan.signals.length,
            poolUpserted: pool.upserted,
            poolAvailableCandidates: poolCandidates.length,

            claimed: 0,
            saved: 0,
            alreadyClaimed: 0,
            capSkipped: 0,
            identityFound: 0,
            identityMissing: 0,
            distributionMode: "deferred_global_best_of_day",
          });

          continue;
        }

        if (source.platform === "reddit" && source.source_type === "reddit_rss") {
          const scan = await scanRedditGlobalSource(source);

          totalScannedPosts += scan.scannedPosts;
          totalMatchedSignals += scan.signals.length;

          const pool = await upsertSignalsToGlobalPool({
            source,
            signals: scan.signals,
          });

          totalPoolUpserted += pool.upserted;

          const poolCandidates = await getAvailablePoolLeadsForSource({
            source,
            limit: 100,
          });

          await updateRedditSourceCursor({
            source,
            nextRedditCursorIndex: scan.nextRedditCursorIndex,
          });

          await updateGlobalSourceScanTime(source);

          results.push({
            sourceId: source.id,
            platform: source.platform,
            sourceType: source.source_type,
            sourceUrl: source.source_url,
            matchedUsers: matchingUsers.length,
            feedsConfigured: scan.feedsConfigured,
            feedsChecked: scan.feedsChecked,
            feedsSkippedThisRun: scan.feedsSkippedThisRun,
            scannedFeeds: scan.scannedFeeds,
            skippedFeeds: scan.skippedFeeds,
            redditCursorIndex: scan.redditCursorIndex,
            nextRedditCursorIndex: scan.nextRedditCursorIndex,
            feedErrors: scan.feedErrors,
            feedResults: scan.feedResults,
            feedErrorDetails: scan.feedErrorDetails,
            rawItemsFound: scan.rawItemsFound,
            scannedComments: 0,
            scannedPosts: scan.scannedPosts,
            matchedSignals: scan.signals.length,
            poolUpserted: pool.upserted,
            poolAvailableCandidates: poolCandidates.length,

            claimed: 0,
            saved: 0,
            alreadyClaimed: 0,
            capSkipped: 0,
            identityFound: 0,
            identityMissing: 0,
            distributionMode: "deferred_global_best_of_day",
          });

          continue;
        }

        errors.push({
          sourceId: source.id,
          platform: source.platform,
          sourceType: source.source_type,
          error:
            "Unsupported source type. Telegram/MLGS are prepared but not connected in this cron handler yet.",
        });
      } catch (error) {
        errors.push({
          sourceId: source.id,
          platform: source.platform,
          sourceType: source.source_type,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const globalPoolCandidates = await getBestAvailablePoolLeadsForDistribution({
      limit: 500,
    });

    totalPoolAvailableCandidates = globalPoolCandidates.length;

    const globalDistribution = await distributeBestPoolLeadsToUsers({
      users,
      sources,
      dayKey,
      poolLeads: globalPoolCandidates,
    });

    totalClaimed = globalDistribution.claimed;
    totalSaved = globalDistribution.saved;
    totalAlreadyClaimed = globalDistribution.alreadyClaimed;
    totalCapSkipped = globalDistribution.capSkipped;
    totalIdentityFound = globalDistribution.identityFound;
    totalIdentityMissing = globalDistribution.identityMissing;

    return NextResponse.json({
      ok: true,
      route: "/api/cron/social-lead-refresh",
      engine: "global_distribution_v5_best_of_day",
      force,
      dayKey,
      usersFound: users.length,
      sourcesFound: sources.length,
      processed: results.length,
      failed: errors.length,
      distributionMode: "global_best_of_day_after_scan",
      summary: {
        totalScannedComments,
        totalScannedPosts,
        totalMatchedSignals,

        totalPoolUpserted,
        totalPoolAvailableCandidates,

        totalClaimed,
        totalSaved,
        totalAlreadyClaimed,
        totalCapSkipped,
        totalNoUserMatchSkipped,

        totalIdentityFound,
        totalIdentityMissing,
      },
      globalDistribution: {
        availableCandidates: globalPoolCandidates.length,
        claimed: globalDistribution.claimed,
        saved: globalDistribution.saved,
        alreadyClaimed: globalDistribution.alreadyClaimed,
        capSkipped: globalDistribution.capSkipped,
        identityFound: globalDistribution.identityFound,
        identityMissing: globalDistribution.identityMissing,
        userResults: globalDistribution.userResults,
      },
      results,
      errors,
    });
  } catch (error) {
    console.error("[social-lead-refresh]", error);

    return jsonError(
      "Social lead refresh failed",
      500,
      error instanceof Error ? error.message : String(error)
    );
  }
}