import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Temperature = "hot" | "warm" | "cold";
type SignalBucket = "save_candidate" | "review" | "weak" | "blocked";
type PublicFeedSource = "hacker_news" | "devto";

type PublicFeedItem = {
  provider: PublicFeedSource;
  sourceName: string;
  sourceType: string;
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

type PublicPreviewSignal = PublicFeedItem & {
  externalId: string;
  platform: "public_feed";
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

const USER_AGENT =
  "AutoaffiLeadEngine/1.0 public-feed-preview; contact=https://autoaffi-final.vercel.app";

const SAVE_THRESHOLD_STRICT = 78;
const SAVE_THRESHOLD_LOOSE = 74;
const REVIEW_THRESHOLD = 42;

const HACKER_NEWS_QUERIES = [
  "affiliate marketing",
  "passive income",
  "side hustle",
  "make money online",
  "creator economy",
  "marketing automation",
  "ai tools",
  "SaaS founder",
];

const DEVTO_FEEDS = [
  "https://dev.to/feed/tag/sideproject",
  "https://dev.to/feed/tag/ai",
  "https://dev.to/feed/tag/startup",
  "https://dev.to/feed/tag/marketing",
  "https://dev.to/feed/tag/productivity",
  "https://dev.to/feed/tag/automation",
];

function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    {
      ok: false,
      route: "/api/social/public-feeds/preview",
      source: "public_feeds",
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
    .replace(/&nbsp;/g, " ")
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

function splitRssItems(xml: string) {
  const rssItems = xml.match(/<item[\s\S]*?<\/item>/gi);
  if (rssItems?.length) return rssItems;

  const atomEntries = xml.match(/<entry[\s\S]*?<\/entry>/gi);
  return atomEntries || [];
}

function getLinkFromXmlItem(itemXml: string) {
  const hrefMatch = itemXml.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);
  if (hrefMatch?.[1]) return cleanText(hrefMatch[1]);

  return getTagValue(itemXml, "link") || getTagValue(itemXml, "guid");
}

function getAuthorFromXmlItem(itemXml: string) {
  const authorBlock = itemXml.match(/<author[\s\S]*?<\/author>/i)?.[0] || "";
  const authorName = getTagValue(authorBlock, "name");

  return (
    authorName ||
    getTagValue(itemXml, "dc:creator") ||
    getTagValue(itemXml, "creator") ||
    getTagValue(itemXml, "author") ||
    null
  );
}

function parseGenericRssFeed(params: {
  xml: string;
  provider: PublicFeedSource;
  sourceName: string;
  sourceType: string;
}): PublicFeedItem[] {
  const { xml, provider, sourceName, sourceType } = params;
  const items = splitRssItems(xml);

  return items
    .map((itemXml) => {
      const title = getTagValue(itemXml, "title");
      const link = getLinkFromXmlItem(itemXml);
      const id = getTagValue(itemXml, "guid") || getTagValue(itemXml, "id") || link;
      const author = getAuthorFromXmlItem(itemXml);
      const summary =
        getTagValue(itemXml, "description") ||
        getTagValue(itemXml, "summary") ||
        getTagValue(itemXml, "content") ||
        getTagValue(itemXml, "content:encoded");
      const publishedAt =
        getTagValue(itemXml, "pubDate") ||
        getTagValue(itemXml, "published") ||
        getTagValue(itemXml, "updated") ||
        null;

      return {
        provider,
        sourceName,
        sourceType,
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
    /^(ask hn:|how|what|which|where|when|why|can|should|would|do|does|is|are)\b/i.test(
      cleaned
    ) ||
    /\b(how do i|how can i|what should i|which platform|what platform|any advice|need advice|looking for advice|recommend|recommendation|can someone explain|does anyone know|ask hn)\b/i.test(
      cleaned
    )
  );
}

function hasDirectHelpIntent(text: string) {
  const cleaned = cleanText(text);

  return /\b(need help|need advice|any advice|please help|looking for advice|could use some help|really use some help|how do i|how can i|what should i|which platform|what platform|best platform|best affiliate program|recommend a|recommend an|recommend.*tool|where can i|need a good|not sure what to do|stuck|confused|struggling|ask hn:)\b/i.test(
    cleaned
  );
}

function hasPersonalLeadIntent(text: string) {
  const cleaned = cleanText(text);

  return /\b(i need|i'm trying|i am trying|i'm looking|i am looking|i'm stuck|i am stuck|i struggle|i'm struggling|i am struggling|my site|my website|my blog|my channel|my content|my startup|my side project|my product|we need|we're trying|we are trying|we're looking|we are looking)\b/i.test(
    cleaned
  );
}

function hasMonetizationLeadIntent(text: string) {
  const cleaned = cleanText(text);

  return /\b(how do i monetize|how can i monetize|monetize my|monetise my|make money from my|earn from my|affiliate program for|promoting .* affiliate|getting clicks|getting sales|no sales|no clicks|no leads|affiliate links not working|links dying|tracking clicks|track clicks)\b/i.test(
    cleaned
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
  if (urlCount >= 4) {
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
        /\bstop building prospect lists by hand\b/i,
        /\b100 local business leads in 60 seconds\b/i,
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
        /\buhrs\b/i,
        /\bcrowdgen\b/i,
        /\boneforma\b/i,
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

function isHackerNewsShowOrLaunch(title: string) {
  return /^(show hn:|launch hn:|tell hn:)/i.test(cleanText(title));
}

function isHackerNewsAsk(title: string) {
  return /^ask hn:/i.test(cleanText(title));
}

function isDevToArticleLikeTitle(title: string) {
  const cleaned = cleanText(title).toLowerCase();

  return /\b(how to|how does|why|best .*tools?|top \d+|review|guide|tutorial|introduction|learn|course|roadmap|cheatsheet|ultimate guide|beginner guide|complete .*guide|i built|i tried|i jumped|i stitched|i was tired|we built|building a|unlocking|enhancing|local seo|vs|alternatives to|what happened|what i learned)\b/i.test(
    cleaned
  );
}

function getContentPostRiskReason(item: PublicFeedItem) {
  const title = cleanText(item.title).toLowerCase();
  const fullText = cleanText(`${item.title} ${item.summary}`).toLowerCase();

  if (item.provider === "hacker_news" && isHackerNewsShowOrLaunch(title)) {
    return "hn_show_or_launch_not_direct_lead";
  }

  if (item.provider === "hacker_news" && !isHackerNewsAsk(title)) {
    return "hn_article_or_story_not_direct_lead";
  }

  if (item.provider === "devto" && isDevToArticleLikeTitle(title)) {
    return "devto_article_or_tutorial_not_direct_lead";
  }

  if (
    item.provider === "devto" &&
    !hasPersonalLeadIntent(fullText) &&
    !hasMonetizationLeadIntent(fullText) &&
    !/\b(need help|need advice|any advice|please help|stuck|struggling|not sure what to do)\b/i.test(
      fullText
    )
  ) {
    return "devto_content_not_personal_lead";
  }

  if (
    /\b(the cost of|is not money|does not exist|still worth it|too saturated|why your|musings of|successful entrepreneurs|what was the biggest impact|what's a business process|redefining interaction)\b/i.test(
      title
    )
  ) {
    return "thought_leadership_or_discussion_not_direct_lead";
  }

  if (
    /\b(guide to improve chances|updated guide|complete guide|guide for beginners|a guide to)\b/i.test(
      title
    ) &&
    /\b(accepted|earnings|exam|job|task|audio|transcription)\b/i.test(fullText)
  ) {
    return "guide_or_task_platform_post_not_direct_lead";
  }

  return null;
}

function scorePublicFeedIntent(item: PublicFeedItem): ScoringResult {
  const fullText = cleanText(`${item.title} ${item.summary}`);
  const title = cleanText(item.title);
  const lower = fullText.toLowerCase();

  let score = 0;
  const whyMatched: string[] = [];
  const tags = new Set<string>();

  const hasQuestion = hasQuestionIntent(fullText);
  const directHelp = hasDirectHelpIntent(fullText);
  const personalLead = hasPersonalLeadIntent(fullText);
  const monetizationLead = hasMonetizationLeadIntent(fullText);

  const hasHelpIntent =
    /\b(need help|need advice|any advice|please help|looking for advice|could use some help|really use some help|how do i start|how can i start|get started|beginner|newbie|new to this|zero skills|no skills|zero experience|no experience|need a good)\b/i.test(
      fullText
    );

  const hasIncomeIntent =
    /\b(extra income|side hustle|passive income|make money online|earn money|earning money|online income|income stream|work online|work from home|build income|monetize|monetise|monetization|monetisation)\b/i.test(
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
    /\b(which platform|best platform|what platform|recommend.*platform|tool|software|system|tracking|automation|landing page builder|link checker|link management|analytics|dashboard|crm|workflow)\b/i.test(
      fullText
    );

  const hasTrustConcern =
    /\b(scam|legit|fake guru|pyramid|mlm|spam|safe|tos|terms of service|policy|allowed)\b/i.test(
      fullText
    );

  const hasCreatorIntent =
    /\b(content|creator|publish|posting|youtube|tiktok|instagram|blog|newsletter|audience|traffic|copywriting|social media)\b/i.test(
      fullText
    );

  const hasBusinessIntent =
    /\b(startup|founder|entrepreneur|build something|business idea|validate|validation|product idea|digital product|saas|side project|micro-saas|solopreneur)\b/i.test(
      fullText
    );

  const hasAIAutomationIntent =
    /\b(ai tool|ai tools|automation|automate|agent|ai agent|workflow automation|marketing automation|content automation|lead generation|lead gen)\b/i.test(
      fullText
    );

  const lowAction =
    /\b(thanks|thank you|great post|nice|cool|interesting|love this|wins and fails|slowchat)\b/i.test(
      fullText
    ) && !hasQuestion;

  const isTitleDirect =
    hasDirectHelpIntent(title) ||
    title.includes("?") ||
    hasPain ||
    isHackerNewsAsk(title);

  if (hasQuestion) {
    score += 12;
    whyMatched.push("Asks a question");
    tags.add("question");
  }

  if (directHelp) {
    score += 12;
    whyMatched.push("Direct help/request intent");
    tags.add("direct-help");
  }

  if (personalLead) {
    score += 18;
    whyMatched.push("Personal lead intent");
    tags.add("personal-lead");
  }

  if (monetizationLead) {
    score += 22;
    whyMatched.push("Monetization or tracking help intent");
    tags.add("monetization-lead");
  }

  if (hasHelpIntent) {
    score += 22;
    whyMatched.push("Asks for help, beginner advice or low-skill path");
    tags.add("needs-help");
  }

  if (hasIncomeIntent) {
    score += 18;
    whyMatched.push("Mentions extra income, side hustle or online income");
    tags.add("income");
  }

  if (hasAffiliateIntent) {
    score += 20;
    whyMatched.push("Mentions affiliate marketing, offers, commissions or links");
    tags.add("affiliate");
  }

  if (hasPain) {
    score += 22;
    whyMatched.push("Shows pain, confusion or lack of results");
    tags.add("pain-point");
  }

  if (hasPlatformIntent) {
    score += 18;
    whyMatched.push("Looks open to a platform, tool or system");
    tags.add("tool-interest");
  }

  if (hasTrustConcern) {
    score += 8;
    whyMatched.push("Mentions trust, policy or scam concern");
    tags.add("trust-concern");
  }

  if (hasCreatorIntent) {
    score += 8;
    whyMatched.push("Mentions content, traffic or audience");
    tags.add("creator-intent");
  }

  if (hasBusinessIntent) {
    score += 8;
    whyMatched.push("Mentions business, startup or product building");
    tags.add("business-intent");
  }

  if (hasAIAutomationIntent) {
    score += 10;
    whyMatched.push("Mentions AI, automation or lead generation");
    tags.add("ai-automation-intent");
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

  if (!isTitleDirect && !hasPain && !personalLead && !monetizationLead) {
    score -= 26;
    tags.add("not-direct-title");
    whyMatched.push("Title is not a direct lead request");
  }

  if (
    (hasHelpIntent || hasPain || hasPlatformIntent || directHelp || personalLead || monetizationLead) &&
    (hasIncomeIntent || hasAffiliateIntent || hasCreatorIntent || hasAIAutomationIntent)
  ) {
    score += 18;
    whyMatched.push("Strong Autoaffi fit");
    tags.add("autoaffi-fit");
  }

  if (
    hasAffiliateIntent &&
    (hasPlatformIntent || hasPain || hasTrustConcern || monetizationLead) &&
    (hasQuestion || directHelp || hasPain || personalLead)
  ) {
    score += 16;
    whyMatched.push("Strong affiliate-tool fit");
    tags.add("affiliate-tool-fit");
  }

  if (
    hasIncomeIntent &&
    (hasHelpIntent || directHelp || personalLead || monetizationLead) &&
    (hasQuestion || lower.includes("zero skills") || lower.includes("no skills"))
  ) {
    score += 16;
    whyMatched.push("Strong beginner-income fit");
    tags.add("beginner-income-fit");
  }

  if (
    hasAIAutomationIntent &&
    (hasPlatformIntent || hasPain || directHelp || personalLead) &&
    (hasBusinessIntent || hasCreatorIntent)
  ) {
    score += 12;
    whyMatched.push("Strong AI/automation founder fit");
    tags.add("ai-founder-fit");
  }

  if (
    lower.includes("hire") ||
    lower.includes("hiring") ||
    lower.includes("job opening")
  ) {
    score -= 25;
    tags.add("job-ad-risk");
  }

  if (item.provider === "hacker_news" && !isHackerNewsAsk(title)) {
    score -= 35;
    tags.add("hn-not-ask");
  }

  if (item.provider === "hacker_news" && isHackerNewsShowOrLaunch(title)) {
    score -= 45;
    tags.add("hn-show-launch");
  }

  if (item.provider === "devto" && isDevToArticleLikeTitle(title)) {
    score -= 35;
    tags.add("devto-article");
  }

  if (item.provider === "devto" && !personalLead && !monetizationLead && !hasPain) {
    score -= 25;
    tags.add("devto-not-personal");
  }

  score = Math.min(100, Math.max(0, score));

  const temperature: Temperature =
    score >= 72 ? "hot" : score >= 45 ? "warm" : "cold";

  return {
    score,
    temperature,
    whyMatched:
      whyMatched.length > 0
        ? Array.from(new Set(whyMatched)).slice(0, 11)
        : ["Matches public discussion signal language"],
    tags: Array.from(tags).slice(0, 18),
  };
}

function buildSuggestedOpener(item: PublicFeedItem) {
  const text = cleanText(`${item.title} ${item.summary}`);

  if (
    /\b(no clicks|no sales|no leads|no traffic|links dying|dead links|not working|failed|struggling|stuck|confused|overwhelmed|get clicks|getting clicks|getting sales)\b/i.test(
      text
    )
  ) {
    return "I saw your post about struggling to get results. The first thing I’d check is whether you are tracking each offer and each content post separately, because without that it is almost impossible to know what is actually working.";
  }

  if (
    /\b(which platform|best platform|what platform|recommend.*platform|tool|software|system|tracking|automation|landing page builder|link checker|analytics|dashboard|workflow)\b/i.test(
      text
    )
  ) {
    return "I saw your question about choosing a platform or system. I’d focus on three things first: finding a clear offer, creating consistent content around the problem it solves, and tracking every click so you can improve based on real data.";
  }

  if (
    /\b(ai tool|ai tools|automation|ai agent|workflow automation|marketing automation|lead generation|lead gen)\b/i.test(
      text
    )
  ) {
    return "I saw your post about automation and tools. I’d keep it simple: identify the workflow that saves the most time, connect it to one clear business outcome, and track whether it creates leads or revenue.";
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

  return "I saw your post and thought it was relevant. If you are trying to build online income, I’d focus on one clear offer, useful content, and proper tracking before adding more platforms.";
}

function getProviderSaveBlockReason(params: {
  item: PublicFeedItem;
  scoring: ScoringResult;
}) {
  const { item, scoring } = params;
  const tags = new Set(scoring.tags);
  const title = cleanText(item.title);
  const fullText = cleanText(`${item.title} ${item.summary}`);

  if (item.provider === "hacker_news") {
    if (!isHackerNewsAsk(title)) {
      return "hn_only_ask_hn_can_auto_save";
    }

    if (!hasDirectHelpIntent(fullText) && !hasPersonalLeadIntent(fullText) && !hasMonetizationLeadIntent(fullText)) {
      return "hn_ask_not_direct_enough";
    }

    if (
      !tags.has("income") &&
      !tags.has("affiliate") &&
      !tags.has("creator-intent") &&
      !tags.has("ai-founder-fit") &&
      !tags.has("monetization-lead")
    ) {
      return "hn_missing_autoaffi_commercial_fit";
    }

    return null;
  }

  if (item.provider === "devto") {
    if (isDevToArticleLikeTitle(title)) {
      return "devto_article_not_auto_save";
    }

    if (!hasPersonalLeadIntent(fullText) && !hasMonetizationLeadIntent(fullText) && !tags.has("pain-point")) {
      return "devto_missing_personal_lead_intent";
    }

    if (
      !tags.has("income") &&
      !tags.has("affiliate") &&
      !tags.has("monetization-lead") &&
      !tags.has("affiliate-tool-fit")
    ) {
      return "devto_missing_income_or_affiliate_fit";
    }

    return null;
  }

  return null;
}

function shouldSaveCandidate(params: {
  item: PublicFeedItem;
  scoring: ScoringResult;
  strict: boolean;
}) {
  const { item, scoring, strict } = params;
  const tags = new Set(scoring.tags);
  const title = cleanText(item.title);
  const fullText = cleanText(`${item.title} ${item.summary}`);
  const threshold = strict ? SAVE_THRESHOLD_STRICT : SAVE_THRESHOLD_LOOSE;

  const providerBlockReason = getProviderSaveBlockReason({ item, scoring });
  if (providerBlockReason) {
    return {
      save: false,
      reason: providerBlockReason,
    };
  }

  const directHelp =
    hasDirectHelpIntent(fullText) ||
    hasDirectHelpIntent(title) ||
    hasPersonalLeadIntent(fullText) ||
    hasMonetizationLeadIntent(fullText) ||
    tags.has("pain-point");

  if (!directHelp) {
    return {
      save: false,
      reason: "not_direct_enough_for_auto_save",
    };
  }

  if (tags.has("not-direct-title") && !tags.has("pain-point") && !tags.has("personal-lead") && !tags.has("monetization-lead")) {
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
      tags.has("beginner-income-fit") ||
      tags.has("ai-founder-fit") ||
      tags.has("monetization-lead"))
  ) {
    return {
      save: true,
      reason: "score_threshold_plus_autoaffi_fit",
    };
  }

  if (
    scoring.score >= 78 &&
    tags.has("affiliate") &&
    (tags.has("tool-interest") ||
      tags.has("pain-point") ||
      tags.has("trust-concern") ||
      tags.has("monetization-lead"))
  ) {
    return {
      save: true,
      reason: "affiliate_tool_or_pain_fit",
    };
  }

  if (
    scoring.score >= 78 &&
    tags.has("income") &&
    (tags.has("needs-help") ||
      tags.has("beginner-income-fit") ||
      tags.has("monetization-lead"))
  ) {
    return {
      save: true,
      reason: "beginner_income_fit",
    };
  }

  return {
    save: false,
    reason: "score_or_fit_below_save_gate",
  };
}

function classifyItem(params: {
  item: PublicFeedItem;
  strict: boolean;
  maxAgeDays: number;
}) {
  const { item, strict, maxAgeDays } = params;

  const fullText = cleanText(`${item.title} ${item.summary}`);
  const ageDays = getAgeDays(item.publishedAt);

  const externalId = `${item.provider}_${String(item.id || item.link)
    .replace(/^https?:\/\//i, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .slice(0, 180)}`;

  const base = {
    ...item,
    externalId,
    platform: "public_feed" as const,
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

  const scoring = scorePublicFeedIntent(item);
  const saveCheck = shouldSaveCandidate({ item, scoring, strict });
  const contentPostRiskReason = getContentPostRiskReason(item);

  if (saveCheck.save && !contentPostRiskReason) {
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

  if (scoring.score >= REVIEW_THRESHOLD || contentPostRiskReason) {
    return {
      ...base,
      score: scoring.score,
      temperature: scoring.temperature,
      bucket: "review" as SignalBucket,
      whyMatched: scoring.whyMatched,
      tags: contentPostRiskReason
        ? Array.from(new Set([...scoring.tags, contentPostRiskReason])).slice(0, 18)
        : scoring.tags,
      suggestedOpener: buildSuggestedOpener(item),
      saveReason: null,
      reviewReason:
        contentPostRiskReason ||
        saveCheck.reason ||
        "interesting_but_not_strong_enough_to_auto_save",
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

async function fetchDevToFeeds(limitPerSource: number) {
  const feedResults: any[] = [];
  const items: PublicFeedItem[] = [];
  const errors: any[] = [];

  for (const feedUrl of DEVTO_FEEDS) {
    try {
      const res = await fetch(feedUrl, {
        method: "GET",
        cache: "no-store",
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/rss+xml, application/xml, text/xml",
        },
      });

      const text = await res.text().catch(() => "");

      if (!res.ok) {
        throw new Error(`Dev.to feed failed ${res.status}: ${text.slice(0, 250)}`);
      }

      const tag = feedUrl.split("/tag/")[1]?.replace(/\/?$/, "") || "unknown";
      const parsed = parseGenericRssFeed({
        xml: text,
        provider: "devto",
        sourceName: `dev.to/${tag}`,
        sourceType: "devto_rss_tag",
      });

      const limited = parsed.slice(0, limitPerSource);
      items.push(...limited);

      feedResults.push({
        provider: "devto",
        sourceName: `dev.to/${tag}`,
        feedUrl,
        found: parsed.length,
        used: limited.length,
      });
    } catch (error) {
      errors.push({
        provider: "devto",
        feedUrl,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { items, feedResults, errors };
}

async function fetchHackerNews(limitPerSource: number) {
  const feedResults: any[] = [];
  const items: PublicFeedItem[] = [];
  const errors: any[] = [];

  for (const query of HACKER_NEWS_QUERIES) {
    const url = `https://hn.algolia.com/api/v1/search_by_date?tags=story&query=${encodeURIComponent(
      query
    )}&hitsPerPage=${limitPerSource}`;

    try {
      const res = await fetch(url, {
        method: "GET",
        cache: "no-store",
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
        },
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data) {
        throw new Error(`HN failed ${res.status}: ${JSON.stringify(data)?.slice(0, 250)}`);
      }

      const hits = Array.isArray(data.hits) ? data.hits : [];

      const mapped: PublicFeedItem[] = hits
        .map((hit: any) => {
          const objectID = String(hit.objectID || hit.story_id || hit.id || "");
          const title = cleanText(hit.title || hit.story_title || "");
          const hnUrl = objectID
            ? `https://news.ycombinator.com/item?id=${objectID}`
            : "";
          const link = cleanText(hit.url || hnUrl);
          const summary = cleanText(hit.story_text || hit.comment_text || "");

          return {
            provider: "hacker_news" as const,
            sourceName: `hn:${query}`,
            sourceType: "hacker_news_algolia_story",
            title,
            link: link || hnUrl,
            id: objectID || link || title,
            author: hit.author ? String(hit.author) : null,
            summary,
            publishedAt: hit.created_at || null,
          };
        })
        .filter((item: PublicFeedItem) => item.title && item.link);

      items.push(...mapped);

      feedResults.push({
        provider: "hacker_news",
        sourceName: `hn:${query}`,
        query,
        found: hits.length,
        used: mapped.length,
      });
    } catch (error) {
      errors.push({
        provider: "hacker_news",
        query,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { items, feedResults, errors };
}

function compactSignal(signal: PublicPreviewSignal) {
  return {
    externalId: signal.externalId,
    provider: signal.provider,
    platform: signal.platform,
    sourceName: signal.sourceName,
    sourceType: signal.sourceType,
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

function summarizeByProvider(signals: PublicPreviewSignal[]) {
  const providers: PublicFeedSource[] = ["hacker_news", "devto"];

  return providers.map((provider) => {
    const filtered = signals.filter((signal) => signal.provider === provider);

    return {
      provider,
      total: filtered.length,
      saveCandidates: filtered.filter((signal) => signal.bucket === "save_candidate")
        .length,
      reviewSignals: filtered.filter((signal) => signal.bucket === "review")
        .length,
      weakSignals: filtered.filter((signal) => signal.bucket === "weak").length,
      blockedSignals: filtered.filter((signal) => signal.bucket === "blocked")
        .length,
    };
  });
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const limitPerSource = clampNumber(
      url.searchParams.get("limitPerSource"),
      1,
      25,
      15
    );

    const maxAgeDays = clampNumber(
      url.searchParams.get("maxAgeDays"),
      1,
      90,
      7
    );

    const strict = boolParam(url.searchParams.get("strict"), true);
    const includeWeak = boolParam(url.searchParams.get("includeWeak"), true);
    const includeBlocked = boolParam(
      url.searchParams.get("includeBlocked"),
      true
    );

    const sourcesParam = url.searchParams.get("sources");
    const enabledSources = sourcesParam
      ? sourcesParam
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      : ["hacker_news", "devto"];

    const allItems: PublicFeedItem[] = [];
    const feedResults: any[] = [];
    const errors: any[] = [];

    if (enabledSources.includes("hacker_news") || enabledSources.includes("hn")) {
      const hn = await fetchHackerNews(limitPerSource);
      allItems.push(...hn.items);
      feedResults.push(...hn.feedResults);
      errors.push(...hn.errors);
    }

    if (enabledSources.includes("devto") || enabledSources.includes("dev.to")) {
      const devto = await fetchDevToFeeds(limitPerSource);
      allItems.push(...devto.items);
      feedResults.push(...devto.feedResults);
      errors.push(...devto.errors);
    }

    const dedupedMap = new Map<string, PublicFeedItem>();

    for (const item of allItems) {
      const key = `${item.provider}:${item.id || item.link}`;
      dedupedMap.set(key, item);
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
      .sort((a, b) => b.score - a.score) as PublicPreviewSignal[];

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
      route: "/api/social/public-feeds/preview",
      mode: "preview_only_no_save",
      source: "public_feeds",
      engine: "public_feed_preview_v2_harder_save_gate",
      config: {
        enabledSources,
        limitPerSource,
        maxAgeDays,
        strict,
        saveThreshold: strict ? SAVE_THRESHOLD_STRICT : SAVE_THRESHOLD_LOOSE,
        reviewThreshold: REVIEW_THRESHOLD,
        includeWeak,
        includeBlocked,
        note: "This route does not save to Supabase. Reddit RSS is intentionally not included here because it has its own specialist preview route. HN/Dev.to are treated mostly as review/trend sources unless they show direct personal lead intent.",
      },
      summary: {
        sourcesChecked: enabledSources.length,
        feedErrors: errors.length,
        rawItemsFound: allItems.length,
        itemsAfterDedupe: dedupedItems.length,
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
      byProvider: summarizeByProvider(classified),
      feedResults,
      saveCandidates: saveCandidates.slice(0, 20).map(compactSignal),
      reviewSignals: reviewSignals.slice(0, 30).map(compactSignal),
      weakExamples: includeWeak
        ? weakSignals.slice(0, 20).map(compactSignal)
        : [],
      blockedExamples: includeBlocked
        ? blockedSignals.slice(0, 20).map(compactSignal)
        : [],
      errors,
      nextStep:
        saveCandidates.length > 0
          ? "Preview found a small number of strong public feed save candidates. Review them carefully before cron/save."
          : "No strong public feed save candidates found. This is OK: Hacker News and Dev.to are mainly review/trend sources unless they contain direct personal lead intent.",
    });
  } catch (error) {
    console.error("[public-feeds-preview]", error);

    return jsonError(
      "Public feeds preview failed",
      500,
      error instanceof Error ? error.message : String(error)
    );
  }
}