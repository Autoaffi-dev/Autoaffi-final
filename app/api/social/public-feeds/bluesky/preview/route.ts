import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Temperature = "hot" | "warm" | "cold";

type SignalBucket =
  | "save_candidate"
  | "contextual_lead"
  | "review"
  | "weak"
  | "blocked";

type QueryIntent =
  | "affiliate"
  | "newsletter"
  | "website"
  | "traffic"
  | "tool"
  | "income";

type QueryContext = {
  key: string;
  label: string;
  intent: QueryIntent;
  commercialFit: boolean;
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

type BlueskyItem = {
  provider: "bluesky";
  sourceName: string;
  sourceType: "bluesky_search_post";
  query: string;
  queryContext: QueryContext;
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

type ScoringResult = {
  score: number;
  temperature: Temperature;
  whyMatched: string[];
  tags: string[];
};

type BlueskyPreviewSignal = BlueskyItem & {
  externalId: string;
  platform: "bluesky";
  score: number;
  temperature: Temperature;
  bucket: SignalBucket;
  whyMatched: string[];
  tags: string[];
  suggestedOpener: string;
  saveReason: string | null;
  contextualReason: string | null;
  reviewReason: string | null;
  blockedReason: string | null;
  ageDays: number | null;
};

const BSKY_SEARCH_BASES = [
  "https://api.bsky.app/xrpc/app.bsky.feed.searchPosts",
  "https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts",
];

const SAVE_THRESHOLD_STRICT = 84;
const SAVE_THRESHOLD_LOOSE = 80;
const CONTEXTUAL_THRESHOLD = 58;
const REVIEW_THRESHOLD = 42;

const DEFAULT_QUERIES = [
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

function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    {
      ok: false,
      route: "/api/social/public-feeds/bluesky/preview",
      source: "bluesky",
      error: message,
      details,
    },
    { status }
  );
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

function getAgeDays(dateValue: string | null) {
  if (!dateValue) return null;

  const time = new Date(dateValue).getTime();
  if (!Number.isFinite(time)) return null;

  const diff = Date.now() - time;
  return Math.max(0, diff / (24 * 60 * 60 * 1000));
}

function getRkeyFromUri(uri: string) {
  const parts = String(uri || "").split("/");
  return parts[parts.length - 1] || "";
}

function buildBskyPostUrl(post: BlueskyRawPost) {
  const handle = post.author?.handle;
  const rkey = getRkeyFromUri(post.uri);

  if (!handle || !rkey) return "";

  return `https://bsky.app/profile/${handle}/post/${rkey}`;
}

function getQueriesFromRequest(req: NextRequest) {
  const url = new URL(req.url);
  const customQueries = url.searchParams.get("queries");

  if (!customQueries) return DEFAULT_QUERIES;

  return customQueries
    .split(",")
    .map((q) => q.trim())
    .filter(Boolean)
    .slice(0, 30);
}

function getQueryContext(query: string): QueryContext {
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

function hasQuestionIntent(text: string) {
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

function hasDirectHelpIntent(text: string) {
  const cleaned = cleanText(text);

  return /\b(need help|need advice|any advice|please help|looking for advice|could use some help|really use some help|how do i|how can i|what should i|which platform|what platform|best platform|best affiliate program|recommend a|recommend an|recommend.*tool|where can i|need a good|not sure what to do|stuck|confused|struggling|looking for a tool|looking for an app|looking for software|anyone know a good|any recommendations|better alternative|alternative to)\b/i.test(
    cleaned
  );
}

function hasPersonalLeadIntent(text: string) {
  const cleaned = cleanText(text);

  return /\b(i need|i'm trying|i am trying|i'm looking|i am looking|i'm stuck|i am stuck|i struggle|i'm struggling|i am struggling|my site|my website|my blog|my channel|my content|my startup|my side project|my product|my landing page|my funnel|my newsletter|my store|my audience|we need|we're trying|we are trying|we're looking|we are looking|we have been looking|we operate|we run|we publish|we had the revenue|our site|our audience)\b/i.test(
    cleaned
  );
}

function hasMonetizationLeadIntent(text: string) {
  const cleaned = cleanText(text);

  return /\b(how do i monetize|how can i monetize|monetize my|monetise my|make money from my|earn from my|affiliate program for|affiliate programs for|promoting .* affiliate|getting clicks|getting sales|no sales|no clicks|no leads|no traffic|affiliate links not working|links dying|tracking clicks|track clicks|how do i get traffic|how can i get traffic|how to get traffic to my|how do i grow my newsletter|how can i grow my newsletter|financially viable alternative|if we had the revenue|shoestring budget|budget)\b/i.test(
    cleaned
  );
}

function hasContextualInterest(text: string) {
  const cleaned = cleanText(text);

  return /\b(interested|following|bookmarking|saving this|this is useful|this helps|i need this|i could use this|i want to try|want to try|how did you|how does this|does this work|can beginners|for beginners|what did you use|which one did you use|what platform|what tool|what stack|would this work for|is this better than|has anyone tried|anyone tried|curious about|tell me more|where do i start|considering to start|considering using|prefer a platform|looking for an alternative|looking for alternative)\b/i.test(
    cleaned
  );
}

function isMostlyJunk(text: string) {
  const cleaned = cleanText(text);

  if (cleaned.length < 18) {
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

  const mentionCount = (cleaned.match(/@[a-z0-9_.-]+/gi) || []).length;
  if (mentionCount >= 8) {
    return {
      blocked: true,
      reason: "too_many_mentions",
    };
  }

  const hashtagCount = (cleaned.match(/#[a-z0-9_]+/gi) || []).length;
  if (hashtagCount >= 8) {
    return {
      blocked: true,
      reason: "hashtag_spam",
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
        /🔞/i,
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

function isAccountLikelyPromoOrPublisher(item: BlueskyItem) {
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
    !hasQuestionIntent(text)
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

function isObservationalOrAdvisoryOnly(text: string) {
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

function getContentPostRiskReason(item: BlueskyItem) {
  const text = cleanText(`${item.title} ${item.text}`).toLowerCase();

  if (isAccountLikelyPromoOrPublisher(item)) {
    return "publisher_or_promo_account_not_direct_lead";
  }

  if (isObservationalOrAdvisoryOnly(text)) {
    return "observational_or_advisory_only_not_auto_save";
  }

  if (
    !hasDirectHelpIntent(text) &&
    !hasPersonalLeadIntent(text) &&
    !hasMonetizationLeadIntent(text) &&
    !hasContextualInterest(text) &&
    /\b(i built|we built|launching|launched|check out|new tool|new app|showing off|my new|our new|just shipped|just launched|spotlight:|review 2026|best .* ideas|complete guide)\b/i.test(
      text
    )
  ) {
    return "build_launch_or_article_not_direct_lead";
  }

  if (
    !hasDirectHelpIntent(text) &&
    !hasContextualInterest(text) &&
    /\b(article|newsletter|blog post|thread|guide|tutorial|review|top \d+|best practices|here are|i wrote|continue reading|medium)\b/i.test(
      text
    )
  ) {
    return "content_or_article_not_direct_lead";
  }

  if (
    !hasDirectHelpIntent(text) &&
    !hasPersonalLeadIntent(text) &&
    !hasMonetizationLeadIntent(text) &&
    !hasContextualInterest(text) &&
    /\b(ai tools are|affiliate marketing is|passive income is|side hustles are|thoughts on|hot take|unpopular opinion|you're right|you are right)\b/i.test(
      text
    )
  ) {
    return "opinion_post_not_direct_lead";
  }

  return null;
}

function scoreBlueskyIntent(item: BlueskyItem): ScoringResult {
  const fullText = cleanText(`${item.title} ${item.text}`);
  const lower = fullText.toLowerCase();

  let score = 0;
  const whyMatched: string[] = [];
  const tags = new Set<string>();

  const hasQuestion = hasQuestionIntent(fullText);
  const directHelp = hasDirectHelpIntent(fullText);
  const personalLead = hasPersonalLeadIntent(fullText);
  const monetizationLead = hasMonetizationLeadIntent(fullText);
  const contextualInterest = hasContextualInterest(fullText);
  const observationalOnly = isObservationalOrAdvisoryOnly(fullText);

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

  const hasTrustConcern =
    /\b(scam|legit|fake guru|pyramid|mlm|spam|safe|tos|terms of service|policy|allowed|privacy policy)\b/i.test(
      fullText
    );

  const hasCreatorIntent =
    /\b(content|creator|publish|posting|youtube|tiktok|instagram|blog|blogger|newsletter|audience|traffic|copywriting|social media|travel blogger|travel bloggers|writer|writers)\b/i.test(
      fullText
    );

  const hasBusinessIntent =
    /\b(startup|founder|entrepreneur|build something|business idea|validate|validation|product idea|digital product|saas|side project|micro-saas|solopreneur)\b/i.test(
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

  if (hasTrustConcern) {
    score += 8;
    whyMatched.push("Mentions trust, policy or scam concern");
    tags.add("trust-concern");
  }

  if (hasCreatorIntent) {
    score += 12;
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
    hasAffiliateIntent &&
    (hasPlatformIntent ||
      hasPain ||
      hasTrustConcern ||
      monetizationLead ||
      contextualInterest) &&
    (hasQuestion || directHelp || hasPain || personalLead || contextualInterest)
  ) {
    score += 18;
    whyMatched.push("Strong affiliate-tool fit");
    tags.add("affiliate-tool-fit");
  }

  if (
    hasIncomeIntent &&
    (hasHelpIntent ||
      directHelp ||
      personalLead ||
      monetizationLead ||
      contextualInterest) &&
    (hasQuestion ||
      lower.includes("zero skills") ||
      lower.includes("no skills") ||
      item.queryContext.commercialFit)
  ) {
    score += 16;
    whyMatched.push("Strong beginner-income fit");
    tags.add("beginner-income-fit");
  }

  if (
    hasAIAutomationIntent &&
    (hasPlatformIntent ||
      hasPain ||
      directHelp ||
      personalLead ||
      contextualInterest) &&
    (hasBusinessIntent || hasCreatorIntent || item.queryContext.commercialFit)
  ) {
    score += 10;
    whyMatched.push("Strong AI/automation fit");
    tags.add("ai-automation-fit");
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

function buildSuggestedOpener(item: BlueskyItem) {
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
    /\b(which platform|best platform|what platform|recommend.*platform|tool|software|system|tracking|automation|landing page builder|link checker|analytics|dashboard|workflow|website builder)\b/i.test(
      text
    )
  ) {
    return "I saw your question about choosing a platform or system. I’d focus on three things first: finding a clear offer, creating consistent content around the problem it solves, and tracking every click so you can improve based on real data.";
  }

  if (
    /\b(affiliate|affiliate marketing|amazon associates|commission|commissions|affiliate links?|offers?|affiliate program)\b/i.test(
      text
    )
  ) {
    return "I saw your post about affiliate marketing. A simple way to improve is to choose one clear offer, create helpful content around one problem, and track each post separately instead of jumping between random products.";
  }

  return "I saw your post and thought it was relevant. If you are trying to grow online, I’d focus on one clear offer, useful content, and proper tracking before adding more platforms.";
}

function shouldSaveCandidate(params: {
  item: BlueskyItem;
  scoring: ScoringResult;
  strict: boolean;
}) {
  const { item, scoring, strict } = params;
  const tags = new Set(scoring.tags);
  const fullText = cleanText(`${item.title} ${item.text}`);
  const threshold = strict ? SAVE_THRESHOLD_STRICT : SAVE_THRESHOLD_LOOSE;

  const directEnough =
    hasDirectHelpIntent(fullText) ||
    hasPersonalLeadIntent(fullText) ||
    hasMonetizationLeadIntent(fullText) ||
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

  if (!directEnough) {
    return {
      save: false,
      reason: "not_direct_enough_for_auto_save",
    };
  }

  if (!precisionEnough) {
    return {
      save: false,
      reason: "not_precise_enough_for_auto_save",
    };
  }

  if (tags.has("observational-only")) {
    return {
      save: false,
      reason: "observational_or_advisory_only_not_auto_save",
    };
  }

  if (
    !tags.has("affiliate") &&
    !tags.has("creator-intent") &&
    !tags.has("ai-automation-fit") &&
    !tags.has("monetization-lead") &&
    !tags.has("affiliate-tool-fit") &&
    !tags.has("tool-interest") &&
    !tags.has("autoaffi-fit")
  ) {
    return {
      save: false,
      reason: "missing_autoaffi_commercial_fit",
    };
  }

  if (tags.has("generic-income-no-lead")) {
    return {
      save: false,
      reason: "generic_income_without_direct_lead_intent",
    };
  }

  if (isAccountLikelyPromoOrPublisher(item)) {
    return {
      save: false,
      reason: "publisher_or_promo_account_not_auto_save",
    };
  }

  if (
    scoring.score >= threshold &&
    tags.has("autoaffi-fit") &&
    (tags.has("personal-lead") ||
      tags.has("monetization-lead") ||
      tags.has("direct-help") ||
      tags.has("pain-point")) &&
    (tags.has("affiliate") ||
      tags.has("affiliate-tool-fit") ||
      tags.has("beginner-income-fit") ||
      tags.has("ai-automation-fit") ||
      tags.has("creator-intent") ||
      tags.has("tool-interest"))
  ) {
    return {
      save: true,
      reason: "v5_precision_direct_autoaffi_fit",
    };
  }

  return {
    save: false,
    reason: "score_or_fit_below_save_gate",
  };
}

function shouldContextualLead(params: {
  item: BlueskyItem;
  scoring: ScoringResult;
  contentPostRiskReason: string | null;
}) {
  const { item, scoring, contentPostRiskReason } = params;
  const tags = new Set(scoring.tags);
  const text = cleanText(`${item.title} ${item.text}`);

  if (contentPostRiskReason === "publisher_or_promo_account_not_direct_lead") {
    return {
      contextual: false,
      reason: contentPostRiskReason,
    };
  }

  if (isAccountLikelyPromoOrPublisher(item)) {
    return {
      contextual: false,
      reason: "publisher_or_promo_account_not_contextual_lead",
    };
  }

  if (!item.queryContext.commercialFit) {
    return {
      contextual: false,
      reason: "query_context_not_commercial",
    };
  }

  const contextualEnough =
    hasContextualInterest(text) ||
    hasQuestionIntent(text) ||
    item.isReply ||
    tags.has("tool-interest") ||
    tags.has("creator-intent") ||
    tags.has("affiliate") ||
    tags.has("personal-lead") ||
    tags.has("pain-point") ||
    tags.has("observational-only");

  if (!contextualEnough) {
    return {
      contextual: false,
      reason: "not_enough_contextual_interest",
    };
  }

  if (
    !tags.has("autoaffi-fit") &&
    !tags.has("tool-interest") &&
    !tags.has("creator-intent") &&
    !tags.has("affiliate") &&
    !tags.has("contextual-interest") &&
    !tags.has("context-newsletter_platform") &&
    !tags.has("context-website_builder")
  ) {
    return {
      contextual: false,
      reason: "missing_contextual_autoaffi_fit",
    };
  }

  if (scoring.score >= CONTEXTUAL_THRESHOLD) {
    return {
      contextual: true,
      reason:
        contentPostRiskReason === "observational_or_advisory_only_not_auto_save"
          ? "contextual_but_observational_not_auto_save"
          : "contextual_interest_in_relevant_niche",
    };
  }

  return {
    contextual: false,
    reason: "contextual_score_too_low",
  };
}

function mapBlueskyPost(post: BlueskyRawPost, query: string): BlueskyItem | null {
  const text = cleanText(post.record?.text || "");
  const uri = String(post.uri || "");
  const link = buildBskyPostUrl(post);
  const publishedAt = post.record?.createdAt || post.indexedAt || null;

  if (!text || !uri || !link) return null;

  return {
    provider: "bluesky",
    sourceName: `bluesky:${query}`,
    sourceType: "bluesky_search_post",
    query,
    queryContext: getQueryContext(query),
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

function classifyItem(params: {
  item: BlueskyItem;
  strict: boolean;
  maxAgeDays: number;
}) {
  const { item, strict, maxAgeDays } = params;

  const fullText = cleanText(`${item.title} ${item.text}`);
  const ageDays = getAgeDays(item.publishedAt);

  const externalId = `bluesky_${String(item.uri || item.id)
    .replace(/^at:\/\//i, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .slice(0, 180)}`;

  const base = {
    ...item,
    externalId,
    platform: "bluesky" as const,
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
      contextualReason: null,
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
      contextualReason: null,
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
      contextualReason: null,
      reviewReason: null,
      blockedReason: hardBlockReason,
    };
  }

  const scoring = scoreBlueskyIntent(item);
  const contentPostRiskReason = getContentPostRiskReason(item);
  const saveCheck = shouldSaveCandidate({ item, scoring, strict });
  const contextualCheck = shouldContextualLead({
    item,
    scoring,
    contentPostRiskReason,
  });

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
      contextualReason: null,
      reviewReason: null,
      blockedReason: null,
    };
  }

  if (contextualCheck.contextual) {
    return {
      ...base,
      score: scoring.score,
      temperature: scoring.temperature,
      bucket: "contextual_lead" as SignalBucket,
      whyMatched: scoring.whyMatched,
      tags: Array.from(new Set([...scoring.tags, "contextual-lead"])).slice(
        0,
        24
      ),
      suggestedOpener: buildSuggestedOpener(item),
      saveReason: null,
      contextualReason: contextualCheck.reason,
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
        ? Array.from(new Set([...scoring.tags, contentPostRiskReason])).slice(
            0,
            24
          )
        : scoring.tags,
      suggestedOpener: buildSuggestedOpener(item),
      saveReason: null,
      contextualReason: null,
      reviewReason:
        contentPostRiskReason ||
        contextualCheck.reason ||
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
    contextualReason: null,
    reviewReason: null,
    blockedReason: null,
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

function compactSignal(signal: BlueskyPreviewSignal) {
  return {
    externalId: signal.externalId,
    provider: signal.provider,
    platform: signal.platform,
    sourceName: signal.sourceName,
    sourceType: signal.sourceType,
    query: signal.query,
    queryContext: signal.queryContext,
    title: signal.title,
    text: signal.text,
    authorHandle: signal.authorHandle,
    authorDisplayName: signal.authorDisplayName,
    link: signal.link,
    publishedAt: signal.publishedAt,
    ageDays:
      signal.ageDays === null ? null : Number(signal.ageDays.toFixed(2)),
    isReply: signal.isReply,
    engagement: signal.engagement,
    score: signal.score,
    temperature: signal.temperature,
    bucket: signal.bucket,
    whyMatched: signal.whyMatched,
    tags: signal.tags,
    suggestedOpener: signal.suggestedOpener,
    saveReason: signal.saveReason,
    contextualReason: signal.contextualReason,
    reviewReason: signal.reviewReason,
    blockedReason: signal.blockedReason,
  };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const limitPerQuery = clampNumber(
      url.searchParams.get("limitPerQuery"),
      1,
      50,
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

    const queries = getQueriesFromRequest(req);

    const allItems: BlueskyItem[] = [];
    const queryResults: any[] = [];
    const errors: any[] = [];

    for (const query of queries) {
      try {
        const items = await fetchBlueskySearch({
          query,
          limit: limitPerQuery,
        });

        allItems.push(...items);

        queryResults.push({
          provider: "bluesky",
          query,
          context: getQueryContext(query),
          found: items.length,
          used: items.length,
        });
      } catch (error) {
        errors.push({
          provider: "bluesky",
          query,
          context: getQueryContext(query),
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

    const classified = dedupedItems
      .map((item) =>
        classifyItem({
          item,
          strict,
          maxAgeDays,
        })
      )
      .sort((a, b) => b.score - a.score) as BlueskyPreviewSignal[];

    const saveCandidates = classified.filter(
      (item) => item.bucket === "save_candidate"
    );

    const contextualLeads = classified.filter(
      (item) => item.bucket === "contextual_lead"
    );

    const reviewSignals = classified.filter((item) => item.bucket === "review");
    const weakSignals = classified.filter((item) => item.bucket === "weak");
    const blockedSignals = classified.filter(
      (item) => item.bucket === "blocked"
    );

    return NextResponse.json({
      ok: true,
      route: "/api/social/public-feeds/bluesky/preview",
      mode: "preview_only_no_save",
      source: "bluesky",
      engine: "bluesky_search_preview_v5_precision_contextual_gate",
      config: {
        queries,
        limitPerQuery,
        maxAgeDays,
        strict,
        saveThreshold: strict ? SAVE_THRESHOLD_STRICT : SAVE_THRESHOLD_LOOSE,
        contextualThreshold: CONTEXTUAL_THRESHOLD,
        reviewThreshold: REVIEW_THRESHOLD,
        includeWeak,
        includeBlocked,
        searchBases: BSKY_SEARCH_BASES,
        note: "v5 keeps HOT saveCandidates strict and moves advisory/observational signals into contextualLeads or review. Auto-save only saveCandidates. Contextual leads are for manual/possible lead review.",
      },
      summary: {
        queriesChecked: queries.length,
        queryErrors: errors.length,
        rawItemsFound: allItems.length,
        itemsAfterDedupe: dedupedItems.length,
        saveCandidates: saveCandidates.length,
        contextualLeads: contextualLeads.length,
        reviewSignals: reviewSignals.length,
        weakSignals: weakSignals.length,
        blockedSignals: blockedSignals.length,
        hotSaveCandidates: saveCandidates.filter(
          (s) => s.temperature === "hot"
        ).length,
        warmSaveCandidates: saveCandidates.filter(
          (s) => s.temperature === "warm"
        ).length,
        hotContextualLeads: contextualLeads.filter(
          (s) => s.temperature === "hot"
        ).length,
        warmContextualLeads: contextualLeads.filter(
          (s) => s.temperature === "warm"
        ).length,
      },
      queryResults,
      saveCandidates: saveCandidates.slice(0, 25).map(compactSignal),
      contextualLeads: contextualLeads.slice(0, 35).map(compactSignal),
      reviewSignals: reviewSignals.slice(0, 30).map(compactSignal),
      weakExamples: includeWeak
        ? weakSignals.slice(0, 20).map(compactSignal)
        : [],
      blockedExamples: includeBlocked
        ? blockedSignals.slice(0, 20).map(compactSignal)
        : [],
      errors,
      nextStep:
        errors.length === queries.length && allItems.length === 0
          ? "All Bluesky search requests failed. If both search endpoints return 403, park search-based Bluesky and test Jetstream/Firehose later."
          : saveCandidates.length > 0 || contextualLeads.length > 0
          ? "Preview found Bluesky leads. Auto-save only saveCandidates. Show contextualLeads as possible/manual leads."
          : "No strong Bluesky leads found. Try broader queries or Jetstream/Firehose later.",
    });
  } catch (error) {
    console.error("[bluesky-preview]", error);

    return jsonError(
      "Bluesky preview failed",
      500,
      error instanceof Error ? error.message : String(error)
    );
  }
}