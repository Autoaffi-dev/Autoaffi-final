import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/authOptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Temperature = "hot" | "warm" | "cold";

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

type RequestBody = {
  videoUrl?: string;
  videoId?: string;
  maxResults?: number;
  order?: "time" | "relevance";
  save?: boolean;
};

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// Fresh lead rule: only comments from the last 90 days become lead signals.
const MAX_COMMENT_AGE_DAYS = 90;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null;

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

function extractYouTubeVideoId(input?: string | null): string | null {
  if (!input) return null;

  const raw = input.trim();

  // Direct videoId
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;

  try {
    const url = new URL(raw);

    // youtube.com/watch?v=
    const v = url.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

    // youtu.be/{id}
    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.split("/").filter(Boolean)[0];
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }

    // youtube.com/shorts/{id}
    if (url.pathname.includes("/shorts/")) {
      const id = url.pathname.split("/shorts/")[1]?.split("/")[0];
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }

    // youtube.com/embed/{id}
    if (url.pathname.includes("/embed/")) {
      const id = url.pathname.split("/embed/")[1]?.split("/")[0];
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }

    return null;
  } catch {
    return null;
  }
}

function cleanText(text: string | null | undefined) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
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

  const hasAffiliate =
    /(affiliate|affiliate marketing|commission)/i.test(cleaned);

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

  // Penalize comments that are praise only, success stories or likely promo.
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

  // Strong Autoaffi lead boost: beginner/help + affiliate/income.
  // Do not boost praise-only or pure success-story comments.
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
    return "I saw your comment about choosing the right platform or system. I’d look for something that helps with three things: choosing the right offer, creating consistent content, and tracking results properly. Without those three pieces, it is hard to know what is actually creating income.";
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

async function getUserId(req: NextRequest) {
  const devHeaderUserId = req.headers.get("x-autoaffi-user-id");

  if (
    process.env.NODE_ENV !== "production" &&
    devHeaderUserId &&
    devHeaderUserId.length > 10
  ) {
    return devHeaderUserId;
  }

  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id;

  return sessionUserId || null;
}

async function fetchYouTubeVideoMeta(videoId: string) {
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("key", YOUTUBE_API_KEY || "");
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
  const url = new URL("https://www.googleapis.com/youtube/v3/commentThreads");
  url.searchParams.set("key", YOUTUBE_API_KEY || "");
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

  // Freshness guard: do not create leads from old comments.
  if (!isCommentFreshEnough(publishedAt)) return null;

  const likeCount = Number(snippet?.likeCount || 0);
  const scoring = scoreCommentIntent(sourceText, likeCount);

  if (scoring.score < 30) return null;

  const authorName = snippet?.authorDisplayName
    ? cleanText(snippet.authorDisplayName)
    : null;

  const authorChannelUrl = snippet?.authorChannelUrl || null;

  const videoUrl = `https://www.youtube.com/watch?v=${args.videoId}&lc=${commentId}`;

  const signal: YouTubeCommentSignal = {
    externalId: `youtube_${args.videoId}_${commentId}`,
    sourcePlatform: "youtube",
    sourceType: "youtube_comment",
    sourceUrl: videoUrl,
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

  return signal;
}

function dedupeSignals(signals: YouTubeCommentSignal[]) {
  const seen = new Set<string>();
  const result: YouTubeCommentSignal[] = [];

  for (const signal of signals) {
    const key = signal.externalId;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(signal);
  }

  return result;
}

async function saveSignalsToSupabase(params: {
  userId: string;
  signals: YouTubeCommentSignal[];
}) {
  if (!supabaseAdmin) {
    return {
      saved: 0,
      skipped: params.signals.length,
      reason: "Supabase admin client not configured",
    };
  }

  if (params.signals.length === 0) {
    return {
      saved: 0,
      skipped: 0,
      reason: null,
    };
  }

  const rows = params.signals.map((signal) => ({
    user_id: params.userId,

    // Legacy fields used by existing Daily Lead Engine/mock data
    source: signal.sourcePlatform,
    source_url: signal.sourceUrl,
    snippet: signal.sourceText,
    author_hint: signal.sourceUsername,
    why: signal.whyMatched,

    // New richer YouTube/Social Lead fields
    source_platform: signal.sourcePlatform,
    source_type: signal.sourceType,
    external_id: signal.externalId,
    source_username: signal.sourceUsername,
    source_author_url: signal.sourceAuthorChannelUrl,
    source_title: signal.sourceVideoTitle,
    source_channel: signal.sourceChannelTitle,
    source_text: signal.sourceText,
    score: signal.score,
    temperature: signal.temperature.toUpperCase(),
    why_matched: signal.whyMatched,
    suggested_opener: signal.suggestedOpener,
    tags: signal.tags,
    status: "new",
    raw: signal,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabaseAdmin
    .from("lead_signals")
    .upsert(rows, {
      onConflict: "user_id,external_id",
      ignoreDuplicates: false,
    });

  if (error) {
    throw new Error(`Supabase save failed: ${error.message}`);
  }

  return {
    saved: rows.length,
    skipped: 0,
    reason: null,
  };
}

export async function POST(req: NextRequest) {
  try {
    if (!YOUTUBE_API_KEY) {
      return jsonError("Missing YOUTUBE_API_KEY in .env.local", 500);
    }

    const body = (await req.json().catch(() => null)) as RequestBody | null;

    if (!body) {
      return jsonError("Invalid JSON body", 400);
    }

    const videoId =
      extractYouTubeVideoId(body.videoId) ||
      extractYouTubeVideoId(body.videoUrl);

    if (!videoId) {
      return jsonError(
        "Missing or invalid YouTube videoUrl/videoId. Send a normal YouTube URL, Shorts URL, youtu.be URL or 11-character videoId.",
        400
      );
    }

    const maxResults = clampNumber(body.maxResults, 10, 100, 50);
    const order = body.order === "time" ? "time" : "relevance";
    const shouldSave = body.save === true;

    const userId = shouldSave ? await getUserId(req) : null;

    if (shouldSave && !userId) {
      return jsonError("Unauthorized. Could not resolve user_id.", 401);
    }

    const videoMeta = await fetchYouTubeVideoMeta(videoId);

    const items = await fetchYouTubeComments({
      videoId,
      maxResults,
      order,
    });

    const signals = dedupeSignals(
      items
        .map((item: any) =>
          normalizeCommentToSignal({
            item,
            videoId,
            videoTitle: videoMeta.title,
            channelTitle: videoMeta.channelTitle,
          })
        )
        .filter(Boolean) as YouTubeCommentSignal[]
    ).sort((a, b) => b.score - a.score);

    const hot = signals.filter((s) => s.temperature === "hot").length;
    const warm = signals.filter((s) => s.temperature === "warm").length;
    const cold = signals.filter((s) => s.temperature === "cold").length;

    let saveResult:
      | {
          saved: number;
          skipped: number;
          reason: string | null;
        }
      | null = null;

    if (shouldSave && userId) {
      saveResult = await saveSignalsToSupabase({
        userId,
        signals,
      });
    }

    return NextResponse.json({
      ok: true,
      source: "youtube",
      mode: shouldSave ? "scan_and_save" : "scan_only",
      video: {
        videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title: videoMeta.title,
        channelTitle: videoMeta.channelTitle,
      },
      summary: {
        scannedComments: items.length,
        matchedSignals: signals.length,
        hot,
        warm,
        cold,
        maxResults,
        order,
        maxCommentAgeDays: MAX_COMMENT_AGE_DAYS,
      },
      saveResult,
      signals,
    });
  } catch (error) {
    console.error("[youtube-comments-route]", error);

    return jsonError(
      "YouTube comment scan failed",
      500,
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/social/youtube/comments",
    method: "POST",
    maxCommentAgeDays: MAX_COMMENT_AGE_DAYS,
    bodyExample: {
      videoUrl: "https://www.youtube.com/watch?v=VIDEO_ID",
      maxResults: 50,
      order: "relevance",
      save: false,
    },
  });
}