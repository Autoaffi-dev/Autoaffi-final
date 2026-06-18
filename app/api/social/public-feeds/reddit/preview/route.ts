import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Temperature = "hot" | "warm" | "cold";
type SignalBucket = "save_candidate" | "review" | "weak" | "blocked";

type RedditRssItem = {
  feedUrl: string;
  subreddit: string;
  title: string;
  link: string;
  id: string;
  author: string | null;
  summary: string;
  publishedAt: string | null;
};

type ScoringResult = {
  score: number;
  temperature: Temperature;
  whyMatched: string[];
  tags: string[];
};

type RedditPreviewSignal = RedditRssItem & {
  externalId: string;
  platform: "reddit";
  sourceType: "reddit_rss_post";
  score: number;
  temperature: Temperature;
  bucket: SignalBucket;
  whyMatched: string[];
  tags: string[];
  suggestedOpener: string;
  saveReason: string | null;
  reviewReason: string | null;
  blockedReason: string | null;
  ageDays: number | null;
};

const DEFAULT_FEEDS = [
  "https://www.reddit.com/r/sidehustle/new/.rss",
  "https://www.reddit.com/r/passive_income/new/.rss",
  "https://www.reddit.com/r/Affiliatemarketing/new/.rss",
  "https://www.reddit.com/r/WorkOnline/new/.rss",
  "https://www.reddit.com/r/Entrepreneur/new/.rss",
];

const USER_AGENT =
  "AutoaffiLeadEngine/1.0 public-feed-preview; contact=https://autoaffi-final.vercel.app";

const SAVE_THRESHOLD_STRICT = 72;
const SAVE_THRESHOLD_LOOSE = 68;
const REVIEW_THRESHOLD = 40;

function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    {
      ok: false,
      route: "/api/social/public-feeds/reddit/preview",
      source: "reddit_rss",
      error: message,
      details,
    },
    { status }
  );
}

function cleanText(text: string | null | undefined) {
  return String(text || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/\s+/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
}

function safeNumber(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const n = Math.floor(safeNumber(value, fallback));
  return Math.min(max, Math.max(min, n));
}

function boolParam(value: string | null, fallback = false) {
  if (value === null) return fallback;
  return value === "true" || value === "1" || value === "yes";
}

function getTagValue(xml: string, tag: string) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = xml.match(regex);
  return match?.[1] ? cleanText(match[1]) : "";
}

function getSubredditFromFeed(feedUrl: string) {
  const match = feedUrl.match(/reddit\.com\/r\/([^/]+)/i);
  return match?.[1] || "unknown";
}

function splitEntries(xml: string) {
  const entries = xml.match(/<entry[\s\S]*?<\/entry>/gi);
  return entries || [];
}

function getLinkFromEntry(entryXml: string) {
  const hrefMatch = entryXml.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);
  return hrefMatch?.[1] ? cleanText(hrefMatch[1]) : getTagValue(entryXml, "link");
}

function getAuthorFromEntry(entryXml: string) {
  const authorBlock = entryXml.match(/<author[\s\S]*?<\/author>/i)?.[0] || "";
  const name = getTagValue(authorBlock, "name");
  return name || null;
}

function parseRedditRss(xml: string, feedUrl: string): RedditRssItem[] {
  const subreddit = getSubredditFromFeed(feedUrl);
  const entries = splitEntries(xml);

  return entries
    .map((entry) => {
      const title = getTagValue(entry, "title");
      const id = getTagValue(entry, "id") || getLinkFromEntry(entry);
      const link = getLinkFromEntry(entry);
      const author = getAuthorFromEntry(entry);
      const summary =
        getTagValue(entry, "content") ||
        getTagValue(entry, "summary") ||
        getTagValue(entry, "description");
      const publishedAt =
        getTagValue(entry, "updated") || getTagValue(entry, "published") || null;

      return {
        feedUrl,
        subreddit,
        title,
        link,
        id,
        author,
        summary,
        publishedAt,
      };
    })
    .filter((item) => item.title && item.link);
}

function getAgeDays(publishedAt: string | null) {
  if (!publishedAt) return null;

  const time = new Date(publishedAt).getTime();
  if (!Number.isFinite(time)) return null;

  const diff = Date.now() - time;
  return Math.max(0, diff / (24 * 60 * 60 * 1000));
}

function hasQuestionIntent(text: string) {
  const cleaned = cleanText(text).toLowerCase();

  if (cleaned.includes("?")) return true;

  return (
    /^(how|what|which|where|when|why|can|should|would|do|does|is|are)\b/i.test(
      cleaned
    ) ||
    /\b(how do i|how can i|what should i|which platform|what platform|any advice|need advice|looking for advice|recommend|recommendation|can someone explain|does anyone know)\b/i.test(
      cleaned
    )
  );
}

function hasDirectHelpIntent(text: string) {
  return /\b(need help|need advice|any advice|please help|looking for advice|could use some help|really use some help|how do i|how can i|what should i|which|best|recommend|where can i|need a good|not sure what to do|stuck|confused|struggling)\b/i.test(
    cleanText(text)
  );
}

function isMostlyJunk(text: string) {
  const cleaned = cleanText(text);

  if (cleaned.length < 15) {
    return {
      blocked: true,
      reason: "too_short",
    };
  }

  const urlCount = (cleaned.match(/https?:\/\//gi) || []).length;
  if (urlCount >= 3) {
    return {
      blocked: true,
      reason: "too_many_links",
    };
  }

  const repeatedChars = /(.)\1{8,}/.test(cleaned);
  if (repeatedChars) {
    return {
      blocked: true,
      reason: "repeated_characters",
    };
  }

  return {
    blocked: false,
    reason: null,
  };
}

function getHardBlockReason(text: string) {
  const cleaned = cleanText(text).toLowerCase();

  const blocks: Array<{ reason: string; patterns: RegExp[] }> = [
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
        /\b100 local business leads in 60 seconds\b/i,
        /\bstop building prospect lists by hand\b/i,
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
        /\bbabel audio\b/i,
        /\btelus\b/i,
        /\btranscribeme\b/i,
        /\bdata annotation\b/i,
        /\bdataannotation\b/i,
        /\boutlier\b/i,
        /\bappen\b/i,
        /\bremotasks\b/i,
        /\buhRS\b/i,
        /\bcrowdgen\b/i,
        /\boneforma\b/i,
        /\binvisible technologies\b/i,
        /\bmicrotask\b/i,
        /\bmicro-task\b/i,
      ],
    },
    {
      reason: "local_or_physical_business_noise",
      patterns: [
        /\bmeal prep\b/i,
        /\bcatering\b/i,
        /\bretail store\b/i,
        /\bbeauty brand into retail\b/i,
        /\bbounce houses?\b/i,
        /\brent(ing)? out totes\b/i,
        /\bturo\b/i,
        /\brenting my car\b/i,
        /\blawn care\b/i,
        /\bpressure washing\b/i,
        /\bcleaning business\b/i,
        /\bairbnb\b/i,
        /\bcash-out refi\b/i,
        /\bcash out refi\b/i,
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

function getContentPostRiskReason(item: RedditRssItem) {
  const title = cleanText(item.title).toLowerCase();
  const fullText = cleanText(`${item.title} ${item.summary}`).toLowerCase();

  const directHelp = hasDirectHelpIntent(`${item.title} ${item.summary}`);

  if (
    !directHelp &&
    /\b(the cost of|is not money|does not exist|still worth it|too saturated|why your|how i'm projecting|how im projecting|musings of|successful entrepreneurs|what was the biggest impact|what's a business process|overlook b2b|redefining interaction)\b/i.test(
      title
    )
  ) {
    return "thought_leadership_or_discussion_not_direct_lead";
  }

  if (
    /\bguide to improve chances|updated guide|complete guide|guide for beginners|a guide to\b/i.test(
      title
    ) &&
    /\b(accepted|earnings|exam|job|task|audio|transcription)\b/i.test(fullText)
  ) {
    return "guide_or_task_platform_post_not_direct_lead";
  }

  if (
    !directHelp &&
    /\b(tell me if i am overthinking|figured something out|discovered|unexpected source|wins and fails|slowchat)\b/i.test(
      title
    )
  ) {
    return "general_discussion_not_direct_lead";
  }

  return null;
}

function scoreRedditIntent(item: RedditRssItem): ScoringResult {
  const fullText = cleanText(`${item.title} ${item.summary}`);
  const title = cleanText(item.title);
  const lower = fullText.toLowerCase();

  let score = 0;
  const whyMatched: string[] = [];
  const tags = new Set<string>();

  const hasQuestion = hasQuestionIntent(fullText);
  const directHelp = hasDirectHelpIntent(fullText);

  const hasHelpIntent =
    /\b(need help|need advice|any advice|please help|looking for advice|could use some help|really use some help|how do i start|how can i start|get started|beginner|newbie|new to this|zero skills|no skills|zero experience|no experience|need a good)\b/i.test(
      fullText
    );

  const hasIncomeIntent =
    /\b(extra income|side hustle|passive income|make money online|earn money|earning money|online income|income stream|work online|work from home|paid time off|use it wisely|build income)\b/i.test(
      fullText
    );

  const hasAffiliateIntent =
    /\b(affiliate|affiliate marketing|amazon associates|commission|commissions|referral income|recurring commission|affiliate links?|landing page|offers?|validating offers?|publish content|old links|clicks\/sales|clicks and sales)\b/i.test(
      fullText
    );

  const hasPain =
    /\b(no clicks|no sales|no leads|no traffic|links dying|dead links|not working|failed|struggling|stuck|confused|overwhelmed|quietly dying|can't figure out|not sure what to do|get clicks|getting clicks|getting sales)\b/i.test(
      fullText
    );

  const hasPlatformIntent =
    /\b(which platform|best platform|what platform|recommend.*platform|tool|software|system|tracking|automation|landing page builder|link checker|link management|analytics|dashboard)\b/i.test(
      fullText
    );

  const hasTrustConcern =
    /\b(scam|legit|fake guru|pyramid|mlm|spam|safe|tos|terms of service|policy|allowed)\b/i.test(
      fullText
    );

  const hasCreatorIntent =
    /\b(content|creator|publish|posting|youtube|tiktok|instagram|blog|newsletter|audience|traffic)\b/i.test(
      fullText
    );

  const hasBusinessIntent =
    /\b(startup|founder|entrepreneur|build something|business idea|validate|validation|product idea|digital product|saas)\b/i.test(
      fullText
    );

  const lowAction =
    /\b(thanks|thank you|great post|nice|cool|interesting|love this|wins and fails|slowchat)\b/i.test(
      fullText
    ) && !hasQuestion;

  const isTitleDirect =
    hasDirectHelpIntent(title) || title.includes("?") || hasPain;

  if (hasQuestion) {
    score += 14;
    whyMatched.push("Asks a question");
    tags.add("question");
  }

  if (directHelp) {
    score += 12;
    whyMatched.push("Direct help/request intent");
    tags.add("direct-help");
  }

  if (hasHelpIntent) {
    score += 26;
    whyMatched.push("Asks for help, beginner advice or low-skill path");
    tags.add("needs-help");
  }

  if (hasIncomeIntent) {
    score += 20;
    whyMatched.push("Mentions extra income, side hustle or online income");
    tags.add("income");
  }

  if (hasAffiliateIntent) {
    score += 22;
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

  if (hasTrustConcern) {
    score += 8;
    whyMatched.push("Mentions trust, policy or scam concern");
    tags.add("trust-concern");
  }

  if (hasCreatorIntent) {
    score += 10;
    whyMatched.push("Mentions content, traffic or audience");
    tags.add("creator-intent");
  }

  if (hasBusinessIntent) {
    score += 6;
    whyMatched.push("Mentions business, startup or product building");
    tags.add("business-intent");
  }

  if (fullText.length > 120) {
    score += 4;
    whyMatched.push("Detailed post");
  }

  if (lowAction) {
    score -= 30;
    whyMatched.push("Mostly low-action discussion");
    tags.add("low-action");
  }

  if (!isTitleDirect && !hasPain) {
    score -= 18;
    tags.add("not-direct-title");
    whyMatched.push("Title is not a direct lead request");
  }

  if (
    (hasHelpIntent || hasPain || hasPlatformIntent || directHelp) &&
    (hasIncomeIntent || hasAffiliateIntent || hasCreatorIntent)
  ) {
    score += 20;
    whyMatched.push("Strong Autoaffi fit");
    tags.add("autoaffi-fit");
  }

  if (
    hasAffiliateIntent &&
    (hasPlatformIntent || hasPain || hasTrustConcern) &&
    (hasQuestion || directHelp || hasPain)
  ) {
    score += 16;
    whyMatched.push("Strong affiliate-tool fit");
    tags.add("affiliate-tool-fit");
  }

  if (
    hasIncomeIntent &&
    (hasHelpIntent || directHelp) &&
    (hasQuestion || lower.includes("zero skills") || lower.includes("no skills"))
  ) {
    score += 16;
    whyMatched.push("Strong beginner-income fit");
    tags.add("beginner-income-fit");
  }

  if (
    lower.includes("hire") ||
    lower.includes("hiring") ||
    lower.includes("job opening")
  ) {
    score -= 25;
    tags.add("job-ad-risk");
  }

  score = Math.min(100, Math.max(0, score));

  const temperature: Temperature =
    score >= 72 ? "hot" : score >= 45 ? "warm" : "cold";

  return {
    score,
    temperature,
    whyMatched:
      whyMatched.length > 0
        ? Array.from(new Set(whyMatched)).slice(0, 9)
        : ["Matches public discussion signal language"],
    tags: Array.from(tags).slice(0, 14),
  };
}

function buildSuggestedOpener(item: RedditRssItem) {
  const text = cleanText(`${item.title} ${item.summary}`);

  if (
    /\b(no clicks|no sales|no leads|no traffic|links dying|dead links|not working|failed|struggling|stuck|confused|overwhelmed|get clicks|getting clicks|getting sales)\b/i.test(
      text
    )
  ) {
    return "I saw your post about struggling to get results. The first thing I’d check is whether you are tracking each offer and each content post separately, because without that it is almost impossible to know what is actually working.";
  }

  if (
    /\b(which platform|best platform|what platform|recommend.*platform|tool|software|system|tracking|automation|landing page builder|link checker|analytics)\b/i.test(
      text
    )
  ) {
    return "I saw your question about choosing a platform or system. I’d focus on three things first: finding a clear offer, creating consistent content around the problem it solves, and tracking every click so you can improve based on real data.";
  }

  if (
    /\b(affiliate|affiliate marketing|amazon associates|commission|commissions|affiliate links?|offers?)\b/i.test(
      text
    )
  ) {
    return "I saw your post about affiliate marketing. A simple way to improve is to choose one clear offer, create helpful content around one problem, and track each post separately instead of jumping between random products.";
  }

  if (
    /\b(extra income|side hustle|passive income|make money online|earn money|work online|work from home|zero skills|no skills)\b/i.test(
      text
    )
  ) {
    return "I saw your post about building extra income online. I’d avoid random methods and start with a simple workflow: one offer, useful daily content, and tracking so you know what actually creates clicks.";
  }

  return "I saw your post and thought it was relevant. If you are trying to build online income, I’d focus on one clear offer, simple content, and proper tracking before adding more platforms.";
}

function shouldSaveCandidate(params: {
  item: RedditRssItem;
  scoring: ScoringResult;
  strict: boolean;
}) {
  const { item, scoring, strict } = params;
  const tags = new Set(scoring.tags);
  const title = cleanText(item.title);
  const fullText = cleanText(`${item.title} ${item.summary}`);
  const threshold = strict ? SAVE_THRESHOLD_STRICT : SAVE_THRESHOLD_LOOSE;

  const directHelp =
    hasDirectHelpIntent(fullText) || hasDirectHelpIntent(title) || tags.has("pain-point");

  if (!directHelp) {
    return {
      save: false,
      reason: "not_direct_enough_for_auto_save",
    };
  }

  if (tags.has("not-direct-title") && !tags.has("pain-point")) {
    return {
      save: false,
      reason: "title_not_direct_enough_for_auto_save",
    };
  }

  if (
    scoring.score >= threshold &&
    tags.has("autoaffi-fit") &&
    (tags.has("income") ||
      tags.has("affiliate") ||
      tags.has("affiliate-tool-fit") ||
      tags.has("beginner-income-fit"))
  ) {
    return {
      save: true,
      reason: "score_threshold_plus_autoaffi_fit",
    };
  }

  if (
    scoring.score >= 72 &&
    tags.has("affiliate") &&
    (tags.has("tool-interest") ||
      tags.has("pain-point") ||
      tags.has("trust-concern"))
  ) {
    return {
      save: true,
      reason: "affiliate_tool_or_pain_fit",
    };
  }

  if (
    scoring.score >= 72 &&
    tags.has("income") &&
    (tags.has("needs-help") || tags.has("beginner-income-fit"))
  ) {
    return {
      save: true,
      reason: "beginner_income_fit",
    };
  }

  if (
    scoring.score >= 76 &&
    tags.has("question") &&
    (tags.has("affiliate-tool-fit") || tags.has("beginner-income-fit"))
  ) {
    return {
      save: true,
      reason: "strong_question_fit",
    };
  }

  return {
    save: false,
    reason: "score_or_fit_below_save_gate",
  };
}

function classifyItem(params: {
  item: RedditRssItem;
  strict: boolean;
  maxAgeDays: number;
}) {
  const { item, strict, maxAgeDays } = params;

  const fullText = cleanText(`${item.title} ${item.summary}`);
  const ageDays = getAgeDays(item.publishedAt);

  const externalId = `reddit_rss_${String(item.id || item.link)
    .replace(/^https?:\/\//i, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .slice(0, 180)}`;

  const base = {
    ...item,
    externalId,
    platform: "reddit" as const,
    sourceType: "reddit_rss_post" as const,
    ageDays,
  };

  const junk = isMostlyJunk(fullText);

  if (junk.blocked) {
    return {
      ...base,
      score: 0,
      temperature: "cold" as Temperature,
      bucket: "blocked" as SignalBucket,
      whyMatched: [],
      tags: ["blocked", junk.reason || "junk"],
      suggestedOpener: "",
      saveReason: null,
      reviewReason: null,
      blockedReason: junk.reason || "junk",
    };
  }

  if (ageDays !== null && ageDays > maxAgeDays) {
    return {
      ...base,
      score: 0,
      temperature: "cold" as Temperature,
      bucket: "blocked" as SignalBucket,
      whyMatched: [],
      tags: ["blocked", "too_old"],
      suggestedOpener: "",
      saveReason: null,
      reviewReason: null,
      blockedReason: "too_old",
    };
  }

  const hardBlockReason = getHardBlockReason(fullText);

  if (hardBlockReason) {
    return {
      ...base,
      score: 0,
      temperature: "cold" as Temperature,
      bucket: "blocked" as SignalBucket,
      whyMatched: [],
      tags: ["blocked", hardBlockReason],
      suggestedOpener: "",
      saveReason: null,
      reviewReason: null,
      blockedReason: hardBlockReason,
    };
  }

  const contentPostRiskReason = getContentPostRiskReason(item);

  if (contentPostRiskReason) {
    return {
      ...base,
      score: 0,
      temperature: "cold" as Temperature,
      bucket: "blocked" as SignalBucket,
      whyMatched: [],
      tags: ["blocked", contentPostRiskReason],
      suggestedOpener: "",
      saveReason: null,
      reviewReason: null,
      blockedReason: contentPostRiskReason,
    };
  }

  const scoring = scoreRedditIntent(item);
  const saveCheck = shouldSaveCandidate({ item, scoring, strict });

  if (saveCheck.save) {
    return {
      ...base,
      score: scoring.score,
      temperature: scoring.temperature,
      bucket: "save_candidate" as SignalBucket,
      whyMatched: scoring.whyMatched,
      tags: scoring.tags,
      suggestedOpener: buildSuggestedOpener(item),
      saveReason: saveCheck.reason,
      reviewReason: null,
      blockedReason: null,
    };
  }

  if (scoring.score >= REVIEW_THRESHOLD) {
    return {
      ...base,
      score: scoring.score,
      temperature: scoring.temperature,
      bucket: "review" as SignalBucket,
      whyMatched: scoring.whyMatched,
      tags: scoring.tags,
      suggestedOpener: buildSuggestedOpener(item),
      saveReason: null,
      reviewReason: saveCheck.reason || "interesting_but_not_strong_enough_to_auto_save",
      blockedReason: null,
    };
  }

  return {
    ...base,
    score: scoring.score,
    temperature: scoring.temperature,
    bucket: "weak" as SignalBucket,
    whyMatched: scoring.whyMatched,
    tags: scoring.tags,
    suggestedOpener: buildSuggestedOpener(item),
    saveReason: null,
    reviewReason: null,
    blockedReason: null,
  };
}

async function fetchFeed(feedUrl: string) {
  const res = await fetch(feedUrl, {
    method: "GET",
    cache: "no-store",
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/atom+xml, application/rss+xml, text/xml",
    },
  });

  const text = await res.text().catch(() => "");

  if (!res.ok) {
    throw new Error(`Feed failed ${res.status}: ${text.slice(0, 300)}`);
  }

  return parseRedditRss(text, feedUrl);
}

function getFeedsFromRequest(req: NextRequest) {
  const url = new URL(req.url);
  const customFeeds = url.searchParams.get("feeds");

  if (!customFeeds) return DEFAULT_FEEDS;

  return customFeeds
    .split(",")
    .map((feed) => feed.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function compactSignal(signal: RedditPreviewSignal) {
  return {
    externalId: signal.externalId,
    platform: signal.platform,
    sourceType: signal.sourceType,
    subreddit: signal.subreddit,
    title: signal.title,
    author: signal.author,
    link: signal.link,
    publishedAt: signal.publishedAt,
    ageDays:
      signal.ageDays === null ? null : Number(signal.ageDays.toFixed(2)),
    score: signal.score,
    temperature: signal.temperature,
    bucket: signal.bucket,
    whyMatched: signal.whyMatched,
    tags: signal.tags,
    suggestedOpener: signal.suggestedOpener,
    saveReason: signal.saveReason,
    reviewReason: signal.reviewReason,
    blockedReason: signal.blockedReason,
  };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const limitPerFeed = clampNumber(
      url.searchParams.get("limitPerFeed"),
      1,
      25,
      20
    );

    const maxAgeDays = clampNumber(
      url.searchParams.get("maxAgeDays"),
      1,
      90,
      30
    );

    const strict = boolParam(url.searchParams.get("strict"), true);
    const includeWeak = boolParam(url.searchParams.get("includeWeak"), true);
    const includeBlocked = boolParam(
      url.searchParams.get("includeBlocked"),
      true
    );

    const feeds = getFeedsFromRequest(req);

    const feedResults: any[] = [];
    const allItems: RedditRssItem[] = [];
    const errors: any[] = [];

    for (const feedUrl of feeds) {
      try {
        const items = await fetchFeed(feedUrl);
        const limited = items.slice(0, limitPerFeed);

        allItems.push(...limited);

        feedResults.push({
          feedUrl,
          subreddit: getSubredditFromFeed(feedUrl),
          found: items.length,
          used: limited.length,
        });
      } catch (error) {
        errors.push({
          feedUrl,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const dedupedMap = new Map<string, RedditRssItem>();

    for (const item of allItems) {
      dedupedMap.set(item.id || item.link, item);
    }

    const dedupedItems = Array.from(dedupedMap.values());

    const classified = dedupedItems
      .map((item) =>
        classifyItem({
          item,
          strict,
          maxAgeDays,
        })
      )
      .sort((a, b) => b.score - a.score) as RedditPreviewSignal[];

    const saveCandidates = classified.filter(
      (item) => item.bucket === "save_candidate"
    );

    const reviewSignals = classified.filter((item) => item.bucket === "review");
    const weakSignals = classified.filter((item) => item.bucket === "weak");
    const blockedSignals = classified.filter(
      (item) => item.bucket === "blocked"
    );

    return NextResponse.json({
      ok: true,
      route: "/api/social/public-feeds/reddit/preview",
      mode: "preview_only_no_save",
      source: "reddit_rss",
      engine: "public_feed_reddit_preview_v3_beast",
      config: {
        feeds,
        limitPerFeed,
        maxAgeDays,
        strict,
        saveThreshold: strict ? SAVE_THRESHOLD_STRICT : SAVE_THRESHOLD_LOOSE,
        reviewThreshold: REVIEW_THRESHOLD,
        includeWeak,
        includeBlocked,
        note: "This route does not save to Supabase. It shows what would become save candidates before cron/claim/save is built.",
      },
      summary: {
        feedsChecked: feeds.length,
        feedErrors: errors.length,
        postsFound: allItems.length,
        postsAfterDedupe: dedupedItems.length,
        saveCandidates: saveCandidates.length,
        reviewSignals: reviewSignals.length,
        weakSignals: weakSignals.length,
        blockedSignals: blockedSignals.length,
        hotSaveCandidates: saveCandidates.filter(
          (s) => s.temperature === "hot"
        ).length,
        warmSaveCandidates: saveCandidates.filter(
          (s) => s.temperature === "warm"
        ).length,
      },
      feedResults,
      saveCandidates: saveCandidates.slice(0, 20).map(compactSignal),
      reviewSignals: reviewSignals.slice(0, 20).map(compactSignal),
      weakExamples: includeWeak
        ? weakSignals.slice(0, 15).map(compactSignal)
        : [],
      blockedExamples: includeBlocked
        ? blockedSignals.slice(0, 15).map(compactSignal)
        : [],
      errors,
      nextStep:
        saveCandidates.length > 0
          ? "Preview found strong Reddit RSS save candidates. Next step: build reddit-rss-refresh cron that claims and saves only saveCandidates."
          : "No strong save candidates found. Try strict=false, different feeds, higher limitPerFeed, or broader subreddit selection.",
    });
  } catch (error) {
    console.error("[public-feeds-reddit-preview]", error);

    return jsonError(
      "Reddit public feed preview failed",
      500,
      error instanceof Error ? error.message : String(error)
    );
  }
}