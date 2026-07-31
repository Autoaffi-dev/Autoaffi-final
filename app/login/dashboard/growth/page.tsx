"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

type PlatformName =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "facebook"
  | "linkedin"
  | "other";

type ConnectionStatus =
  | "connected"
  | "needs_reconnect"
  | "pending"
  | "not_connected";

type ContentMode = "VALUE" | "PROOF" | "OFFER";

type ConfidenceLevel = "high" | "medium" | "low";

type PlatformInsight = {
  platform: PlatformName;
  displayName: string;
  status: ConnectionStatus;
  username?: string | null;
  profileUrl?: string | null;
  postsLast7Days: number;
  postsLast30Days: number;
  viewsLast7Days?: number | null;
  impressionsLast7Days?: number | null;
  reachLast7Days?: number | null;
  engagementsLast7Days?: number | null;
  profileVisitsLast7Days?: number | null;
  consistencyScore?: number | null;
  visibilityScore?: number | null;
  lastPublishedAt?: string | null;
  note?: string | null;
};

type ActivityDay = {
  date: string;
  label: string;
  posts: number;
  status: "good" | "ok" | "bad" | "unknown";
  reason: string;
};

type TopContentItem = {
  id: string;
  platform: PlatformName;
  platformLabel: string;
  title: string;
  contentType:
    | "post"
    | "reel"
    | "short"
    | "video"
    | "carousel"
    | "other";
  metricLabel: string;
  metricValue: number;
  metricFormatted: string;
  publishedAt?: string | null;
  sourceUrl?: string | null;
  recommendation?: string | null;
};

type GrowthRecommendation = {
  id: string;
  priority: "high" | "medium" | "low";
  title: string;
  explanation: string;
  action: string;
  platform?: string | null;
  format?: "post" | "reel" | "short" | "carousel" | "video" | null;
  mode?: "value" | "proof" | "offer" | null;
  topic?: string | null;
  goal?: string | null;
  cta?: string | null;
};

type MomentumBreakdownItem = {
  key: string;
  label: string;
  score: number | null;
  explanation?: string | null;
};

type PublishingWindow = {
  platform?: string | null;
  recommendedStart?: string | null;
  recommendedEnd?: string | null;
  expectedPeak?: string | null;
  confidenceLevel?: ConfidenceLevel | null;
  explanation?: string | null;
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
  offerMeta?: {
    offerId?: string | null;
    source?: string | null;
    externalId?: string | null;
    affiliateUrl?: string | null;
    stableSubId?: string | null;
    recurring?: boolean | null;
  } | null;
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
  offerMeta?: {
    offerId?: string | null;
    source?: string | null;
    externalId?: string | null;
    affiliateUrl?: string | null;
    stableSubId?: string | null;
    recurring?: boolean | null;
  } | null;
};

type DailyGrowthContent = {
  contentDate: string;
  generationVersion: string;
  sourceType?:
    | "real_social_data"
    | "settings_fallback"
    | "onboarding_fallback"
    | null;
  confidenceLevel?: ConfidenceLevel | null;
  publishingWindow?: PublishingWindow | null;
  post: DailyGrowthPost;
  reel: DailyGrowthReel;
};

type GrowthHubOverview = {
  generatedAt: string;
  hasConnectedAccounts: boolean;
  connectedAccountCount: number;
  momentumScore: number | null;
  momentumLabel: string | null;
  momentumBreakdown: MomentumBreakdownItem[];
  platforms: PlatformInsight[];
  weeklyActivity: ActivityDay[];
  topContent: TopContentItem[];
  recommendations: GrowthRecommendation[];
  primaryRecommendation: GrowthRecommendation | null;
  dailyContent?: DailyGrowthContent | null;
  dataStatus: {
    isLive: boolean;
    lastSyncedAt?: string | null;
    message?: string | null;
  };
};

type ApiResponse =
  | {
      ok: true;
      overview: GrowthHubOverview;
    }
  | {
      ok: false;
      error: string;
    };

type CopyTarget =
  | "post"
  | "image"
  | "post-chatgpt"
  | "reel"
  | "reel-chatgpt";

type FallbackVariant = {
  hook: string;
  alternativeHooks: string[];
  caption: string;
  cta: string;
  commentQuestion: string;
  visualIdea: string;
  imagePrompt: string;
  hashtags: string[];
  coverText: string;
  voiceover: string;
  scenes: DailyGrowthReelScene[];
};

const SOCIAL_ACCOUNTS_PATH = "/login/dashboard/social-accounts";
const GROWTH_HUB_HERO_IMAGE = "/images/growth-hub/growth-hub-hero.png";

function createEmptyWeek(): ActivityDay[] {
  const today = new Date();
  const result: ActivityDay[] = [];

  for (let index = 6; index >= 0; index -= 1) {
    const day = new Date(today);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - index);

    result.push({
      date: day.toISOString(),
      label: new Intl.DateTimeFormat("en", {
        weekday: "short",
      }).format(day),
      posts: 0,
      status: "unknown",
      reason: "Connect a supported social account to activate this day.",
    });
  }

  return result;
}

const EMPTY_MOMENTUM_BREAKDOWN: MomentumBreakdownItem[] = [
  {
    key: "posting-consistency",
    label: "Posting consistency",
    score: null,
    explanation:
      "Will be calculated from your real publishing days and post volume.",
  },
  {
    key: "engagement-trend",
    label: "Engagement trend",
    score: null,
    explanation: "Will compare recent interaction with the preceding period.",
  },
  {
    key: "platform-activity",
    label: "Connected platform activity",
    score: null,
    explanation:
      "Will show which connected platforms receive regular content.",
  },
];

const EMPTY_OVERVIEW: GrowthHubOverview = {
  generatedAt: new Date(0).toISOString(),
  hasConnectedAccounts: false,
  connectedAccountCount: 0,
  momentumScore: null,
  momentumLabel: null,
  momentumBreakdown: EMPTY_MOMENTUM_BREAKDOWN,
  platforms: [],
  weeklyActivity: createEmptyWeek(),
  topContent: [],
  recommendations: [],
  primaryRecommendation: null,
  dailyContent: null,
  dataStatus: {
    isLive: false,
    lastSyncedAt: null,
    message: "Connect a social account to activate Growth Hub.",
  },
};

function clampScore(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function platformBadgeClasses(platform: PlatformName) {
  switch (platform) {
    case "instagram":
      return "border-pink-400/30 bg-pink-500/10 text-pink-200";
    case "tiktok":
      return "border-cyan-400/30 bg-cyan-500/10 text-cyan-200";
    case "youtube":
      return "border-red-400/30 bg-red-500/10 text-red-200";
    case "facebook":
      return "border-blue-400/30 bg-blue-500/10 text-blue-200";
    case "linkedin":
      return "border-sky-400/30 bg-sky-500/10 text-sky-200";
    default:
      return "border-slate-600 bg-slate-800 text-slate-200";
  }
}

function connectionStatusLabel(status: ConnectionStatus) {
  switch (status) {
    case "connected":
      return "Connected";
    case "needs_reconnect":
      return "Reconnect needed";
    case "pending":
      return "Pending";
    case "not_connected":
      return "Not connected";
  }
}

function connectionStatusClasses(status: ConnectionStatus) {
  switch (status) {
    case "connected":
      return "text-emerald-300";
    case "needs_reconnect":
      return "text-amber-300";
    case "pending":
      return "text-sky-300";
    case "not_connected":
      return "text-sky-300";
  }
}

function statusDotClasses(status: ConnectionStatus) {
  switch (status) {
    case "connected":
      return "bg-emerald-400 shadow-emerald-400/40";
    case "needs_reconnect":
      return "bg-amber-400 shadow-amber-400/40";
    case "pending":
      return "bg-sky-400 shadow-sky-400/40";
    case "not_connected":
      return "bg-sky-400 shadow-sky-400/40";
  }
}

function weeklyBarClasses(status: ActivityDay["status"]) {
  switch (status) {
    case "good":
      return "from-emerald-400 to-emerald-500 shadow-emerald-400/20";
    case "ok":
      return "from-yellow-300 to-amber-400 shadow-yellow-400/20";
    case "bad":
      return "from-red-400 to-red-500 shadow-red-400/20";
    case "unknown":
      return "from-slate-700 to-slate-800 shadow-slate-900/20";
  }
}

function priorityClasses(priority: GrowthRecommendation["priority"]) {
  switch (priority) {
    case "high":
      return "border-red-400/25 bg-red-500/5 text-red-200";
    case "medium":
      return "border-yellow-400/25 bg-yellow-500/5 text-yellow-200";
    case "low":
      return "border-emerald-400/25 bg-emerald-500/5 text-emerald-200";
  }
}

function confidenceLabel(
  confidenceLevel?: ConfidenceLevel | null,
  isRealData = false
) {
  if (!isRealData) {
    return "Starter recommendation";
  }

  switch (confidenceLevel) {
    case "high":
      return "High confidence";
    case "medium":
      return "Medium confidence";
    case "low":
      return "Early signal";
    default:
      return "Learning from your data";
  }
}

function confidenceBadgeClasses(
  confidenceLevel?: ConfidenceLevel | null,
  isRealData = false
) {
  if (!isRealData) {
    return "border-slate-700 bg-slate-950/60 text-slate-400";
  }

  switch (confidenceLevel) {
    case "high":
      return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
    case "medium":
      return "border-yellow-400/30 bg-yellow-500/10 text-yellow-200";
    case "low":
      return "border-orange-400/30 bg-orange-500/10 text-orange-200";
    default:
      return "border-sky-400/30 bg-sky-500/10 text-sky-200";
  }
}

function normalizeMode(
  mode?: GrowthRecommendation["mode"] | ContentMode | null
): ContentMode {
  const normalized = String(mode || "").toUpperCase();

  if (normalized === "PROOF") return "PROOF";
  if (normalized === "OFFER") return "OFFER";

  return "VALUE";
}

function formatDate(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatContentDate(value?: string | null) {
  if (!value) {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date());
  }

  return formatDate(value) || value;
}

function formatLastSyncedAt(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const now = new Date();

  const currentDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const targetDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  const differenceInDays = Math.round(
    (currentDay.getTime() - targetDay.getTime()) / 86_400_000
  );

  const time = new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  if (differenceInDays === 0) {
    return `Today, ${time}`;
  }

  if (differenceInDays === 1) {
    return `Yesterday, ${time}`;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizePlatformLabel(value?: string | null) {
  const normalized = value?.trim();

  if (!normalized) {
    return "Instagram";
  }

  return normalized
    .split(/[_-]/g)
    .map(
      (part) =>
        `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`
    )
    .join(" ");
}

function cleanTopic(value?: string | null) {
  const normalized = value?.trim();

  if (!normalized) {
    return "One useful lesson your audience can apply today";
  }

  return normalized;
}

function createFallbackVariants(action: string): FallbackVariant[] {
  return [
    {
      hook: "Content gets easier when you stop trying to say everything at once.",
      alternativeHooks: [
        "One useful idea is enough for today’s post.",
        "Most content feels difficult because the message is trying to do too much.",
        "Stop searching for ten ideas and start with one clear problem.",
      ],
      caption: `Trying to include every idea in one post usually makes the message harder to understand.

A stronger approach is to choose one useful problem, explain one practical solution and finish with one clear next step.

Today’s focus:
${action}

Simple, specific and useful will usually beat complicated.`,
      cta: "Comment GUIDE if you want the simple content structure.",
      commentQuestion:
        "What makes creating content feel hardest for you right now?",
      visualIdea:
        "A creator desk scene where many scattered ideas become one focused post.",
      imagePrompt:
        "Create a premium vertical social media image of a creator at a modern desk simplifying many scattered content ideas into one clear focused idea. Dark charcoal and black environment, warm gold highlights, subtle social media interface elements, crisp realistic details, cinematic lighting, high contrast, premium SaaS aesthetic, no logos, no brand names, no unreadable text, 4:5 aspect ratio.",
      hashtags: ["contentstrategy", "socialmediagrowth", "contentplanning"],
      coverText: "One Clear Idea",
      voiceover:
        "Still making content harder than it needs to be? Pick one problem your audience already understands. Share one useful idea. Then finish with one clear next step. You do not need ten new ideas today. You need one focused piece of content your audience can actually use.",
      scenes: [
        {
          timing: "0–4 seconds",
          visual: "Creator looking overwhelmed by too many content ideas.",
          voiceover: "Still making content harder than it needs to be?",
          overlay: "Too many ideas?",
          transition: "Fast cut",
        },
        {
          timing: "4–9 seconds",
          visual: "The creator clears the desk until only one problem remains.",
          voiceover: "Pick one problem your audience already understands.",
          overlay: "Choose one problem",
          transition: "Swipe away",
        },
        {
          timing: "9–14 seconds",
          visual: "One practical tip is typed into a clean draft.",
          voiceover: "Share one useful idea.",
          overlay: "Share one useful idea",
          transition: "Quick zoom",
        },
        {
          timing: "14–20 seconds",
          visual: "One clear CTA is selected while other options disappear.",
          voiceover: "Then finish with one clear next step.",
          overlay: "One clear next step",
          transition: "Snap transition",
        },
        {
          timing: "20–28 seconds",
          visual: "The finished post appears ready to publish.",
          voiceover:
            "You do not need ten new ideas today. You need one focused piece of content your audience can actually use.",
          overlay: "Simple beats complicated",
          transition: "Smooth fade",
        },
      ],
    },
    {
      hook: "Your next post does not need to be bigger. It needs to be clearer.",
      alternativeHooks: [
        "Simple content often works because people understand it faster.",
        "Before you create more content, make the next message easier to act on.",
        "The best post today is probably simpler than the one you are trying to create.",
      ],
      caption: `A strong post does not need to cover everything.

It needs to make one clear point your audience can understand quickly.

Start with a problem.
Give one useful explanation.
End with one simple next step.

Today’s focus:
${action}

Clarity makes content easier to read, easier to save and easier to respond to.`,
      cta: "Save this if you want to make your next post easier to create.",
      commentQuestion: "Do you usually struggle more with the hook or the CTA?",
      visualIdea:
        "A premium split-screen showing a messy content plan on one side and one clear publish-ready idea on the other.",
      imagePrompt:
        "Create a premium vertical split-screen social media visual. Left side: messy notes, scattered content ideas and visual overload. Right side: one clean focused content idea ready to publish. Dark black and charcoal background, gold highlights, sharp details, modern creator workflow, high contrast, realistic lighting, professional SaaS feel, no logos, no brand names, no unreadable text, 4:5 aspect ratio.",
      hashtags: ["contenttips", "socialmediaideas", "creatorworkflow"],
      coverText: "Make It Clearer",
      voiceover:
        "Your next post probably does not need to be bigger. It needs to be clearer. Start with one problem, give one useful explanation and end with one simple next step. The easier your message is to understand, the easier it is for someone to save, comment or take action.",
      scenes: [
        {
          timing: "0–4 seconds",
          visual: "Messy content notes fill the screen.",
          voiceover: "Your next post probably does not need to be bigger.",
          overlay: "Bigger is not always better",
          transition: "Fast zoom",
        },
        {
          timing: "4–9 seconds",
          visual: "The messy notes collapse into one clear problem.",
          voiceover: "It needs to be clearer.",
          overlay: "Make it clearer",
          transition: "Clean wipe",
        },
        {
          timing: "9–14 seconds",
          visual: "A simple three-step structure appears.",
          voiceover:
            "Start with one problem, give one useful explanation and end with one simple next step.",
          overlay: "Problem · Lesson · Next step",
          transition: "Pop-in",
        },
        {
          timing: "14–21 seconds",
          visual: "A viewer saves the post on a phone screen.",
          voiceover:
            "The easier your message is to understand, the easier it is for someone to save or respond.",
          overlay: "Easy to understand",
          transition: "Soft push",
        },
        {
          timing: "21–28 seconds",
          visual: "The finished post is shown as clean and ready.",
          voiceover: "Keep today’s content simple, useful and direct.",
          overlay: "Simple. Useful. Direct.",
          transition: "Fade out",
        },
      ],
    },
    {
      hook: "A post gets stronger when it has one clear job.",
      alternativeHooks: [
        "If your content feels stuck, reduce the number of things it is trying to do.",
        "Content feels messy when every sentence is trying to do something different.",
        "Before you publish, ask what one action the post should create.",
      ],
      caption: `A post becomes stronger when it has one clear job.

It can teach.
It can build trust.
It can start a conversation.
It can invite someone to take the next step.

But when it tries to do all of that at once, the message becomes harder to follow.

Today’s focus:
${action}

Choose one job for today’s post and make every sentence support it.`,
      cta: "Comment ONE if you want the one-job content checklist.",
      commentQuestion:
        "What do you want your next post to do: teach, build trust or start a conversation?",
      visualIdea:
        "A clean content decision board showing three possible goals, with one selected and highlighted in gold.",
      imagePrompt:
        "Create a premium vertical social media visual showing a clean content decision board with three possible content goals: teach, build trust, start conversation. One goal is selected and highlighted with warm gold light. Dark charcoal background, sharp UI-style details, modern creator workspace, high contrast, cinematic lighting, professional SaaS aesthetic, no logos, no brand names, no unreadable text, 4:5 aspect ratio.",
      hashtags: ["contentcreation", "contentmarketing", "creatortips"],
      coverText: "One Job Per Post",
      voiceover:
        "If your content feels stuck, reduce the number of things it is trying to do. A post can teach, build trust or start a conversation. But it gets confusing when it tries to do everything at once. Choose one job for today’s post and make every sentence support it.",
      scenes: [
        {
          timing: "0–4 seconds",
          visual: "A content draft with too many arrows and notes.",
          voiceover:
            "If your content feels stuck, reduce the number of things it is trying to do.",
          overlay: "Content feels stuck?",
          transition: "Fast cut",
        },
        {
          timing: "4–9 seconds",
          visual: "Three content goals appear: teach, trust, conversation.",
          voiceover: "A post can teach, build trust or start a conversation.",
          overlay: "Choose one job",
          transition: "Slide up",
        },
        {
          timing: "9–15 seconds",
          visual: "All three goals overlap and become messy.",
          voiceover:
            "But it gets confusing when it tries to do everything at once.",
          overlay: "Do not do everything",
          transition: "Glitch cut",
        },
        {
          timing: "15–22 seconds",
          visual: "One goal is selected and highlighted.",
          voiceover: "Choose one job for today’s post.",
          overlay: "Pick one goal",
          transition: "Highlight flash",
        },
        {
          timing: "22–28 seconds",
          visual: "A clean post draft appears with one focused message.",
          voiceover: "Then make every sentence support it.",
          overlay: "Every line supports the goal",
          transition: "Smooth fade",
        },
      ],
    },
  ];
}

function buildFallbackDailyContent(
  recommendation: GrowthRecommendation | null,
  fallbackPlatform?: string | null,
  postVariantIndex = 0,
  reelVariantIndex = 0
): DailyGrowthContent {
  const requestedMode = normalizeMode(recommendation?.mode);
  const hasVerifiedOffer = false;

  const safeMode: ContentMode =
    requestedMode === "OFFER" && !hasVerifiedOffer ? "VALUE" : requestedMode;

  const platform = normalizePlatformLabel(
    recommendation?.platform || fallbackPlatform
  );

  const topic = cleanTopic(recommendation?.topic || recommendation?.title);

  const action =
    recommendation?.action?.trim() ||
    "Publish one useful piece of content today. Focus on one clear problem your audience wants solved.";

  const variants = createFallbackVariants(action);
  const postVariant = variants[postVariantIndex % variants.length];
  const reelVariant = variants[reelVariantIndex % variants.length];

  const reason =
    "This starter recommendation is based on your Growth Hub settings and today's focus. Connect a supported social account to unlock recommendations based on real publishing activity.";

  const algorithmNote =
    "Built with an algorithm-aware structure: clear hook, one focused topic, short readable sections and a low-friction next step. No reach, engagement or result is guaranteed.";

  return {
    contentDate: new Date().toISOString(),
    generationVersion: "frontend-fallback-v4",
    sourceType: "settings_fallback",
    confidenceLevel: "low",
    publishingWindow: null,
    post: {
      platform,
      mode: safeMode,
      topic,
      reason,
      algorithmNote,
      hook: postVariant.hook,
      alternativeHooks: postVariant.alternativeHooks,
      caption: postVariant.caption,
      cta: postVariant.cta,
      commentQuestion: postVariant.commentQuestion,
      hashtags: postVariant.hashtags,
      visualIdea: postVariant.visualIdea,
      imagePrompt: postVariant.imagePrompt,
      offerMeta: null,
    },
    reel: {
      platform,
      mode: safeMode,
      topic,
      reason,
      algorithmNote,
      durationSeconds: 28,
      hook: reelVariant.hook,
      alternativeHooks: reelVariant.alternativeHooks,
      voiceover: reelVariant.voiceover,
      scenes: reelVariant.scenes,
      caption: `${reelVariant.caption}\n\n${reelVariant.cta}`,
      cta: reelVariant.cta,
      coverText: reelVariant.coverText,
      offerMeta: null,
    },
  };
}

function buildPublishReadyPostCopy(post: DailyGrowthPost) {
  const hashtags =
    post.hashtags.length > 0
      ? post.hashtags
          .map((item) =>
            item.startsWith("#") ? item : `#${item.replace(/\s+/g, "")}`
          )
          .join(" ")
      : "";

  return `${post.hook}

${post.caption}

${post.cta}

${post.commentQuestion}

${hashtags}`.trim();
}

function buildCapCutPackageCopy(contentDate: string, reel: DailyGrowthReel) {
  const scenes = reel.scenes
    .map(
      (scene, index) => `Scene ${index + 1} – ${scene.timing}

Visual:
${scene.visual}

Voiceover:
${scene.voiceover}

Overlay:
${scene.overlay}

Transition:
${scene.transition}`
    )
    .join("\n\n");

  return `TODAY'S GROWTH REEL

Platform: ${reel.platform}
Format: Reel / Short
Duration: ${reel.durationSeconds} seconds
Topic: ${reel.topic}
Date: ${formatContentDate(contentDate)}

Hook:
${reel.hook}

Complete voiceover:
${reel.voiceover}

Scenes:

${scenes}

Caption:
${reel.caption}

Next step:
${reel.cta}

Cover text:
${reel.coverText}`;
}

function buildPostChatGptPrompt(contentDate: string, post: DailyGrowthPost) {
  return `Continue working with the social media post below.

Keep the current topic, platform and goal unless I ask you to change them.

Rules:
- Do not invent personal results.
- Do not invent statistics.
- Do not invent testimonials.
- Do not invent income.
- Do not add claims that are not included.
- Keep the post publish-ready.
- You can help me rewrite, improve, answer comments, create replies, or make follow-up ideas.
- Wait for my next instruction before changing the content.

Context:
Platform: ${post.platform}
Mode: ${post.mode}
Topic: ${post.topic}
Date: ${formatContentDate(contentDate)}

Post:

${buildPublishReadyPostCopy(post)}

Image prompt:
${post.imagePrompt}

Other opening ideas:
${post.alternativeHooks
  .map((hook, index) => `${index + 1}. ${hook}`)
  .join("\n")}`;
}

function buildReelChatGptPrompt(contentDate: string, reel: DailyGrowthReel) {
  return `Continue working with the Reel package below.

Keep the current topic, platform and goal unless I ask you to change them.

Rules:
- Do not invent personal results.
- Do not invent statistics.
- Do not invent testimonials.
- Do not invent income.
- Do not add claims that are not included.
- Keep scenes practical and easy to film.
- You can help me rewrite, simplify filming, create replies to comments, or make follow-up ideas.
- Wait for my next instruction before changing the content.

Context:
Platform: ${reel.platform}
Mode: ${reel.mode}
Topic: ${reel.topic}
Date: ${formatContentDate(contentDate)}

Reel package:

${buildCapCutPackageCopy(contentDate, reel)}

Other opening ideas:
${reel.alternativeHooks
  .map((hook, index) => `${index + 1}. ${hook}`)
  .join("\n")}`;
}

function SectionEmptyState({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/35 p-5 text-center">
      <p className="text-sm font-semibold text-slate-300">{title}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{text}</p>
    </div>
  );
}

function MiniContentBlock({
  label,
  children,
  accent = "yellow",
}: {
  label: string;
  children: ReactNode;
  accent?: "yellow" | "purple" | "sky";
}) {
  const labelClasses =
    accent === "purple"
      ? "text-purple-300"
      : accent === "sky"
        ? "text-sky-300"
        : "text-yellow-300";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-4">
      <p
        className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${labelClasses}`}
      >
        {label}
      </p>

      <div className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-200">
        {children}
      </div>
    </div>
  );
}

function MetadataPill({
  label,
  value,
  accent = "yellow",
}: {
  label: string;
  value: string;
  accent?: "yellow" | "purple";
}) {
  const accentClasses =
    accent === "purple" ? "text-purple-200" : "text-yellow-200";

  return (
    <div className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-2">
      <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>

      <span className={`text-xs font-bold ${accentClasses}`}>{value}</span>
    </div>
  );
}

function ContentConfidenceBadge({
  confidenceLevel,
  sourceType,
}: {
  confidenceLevel?: ConfidenceLevel | null;
  sourceType?: DailyGrowthContent["sourceType"];
}) {
  const isRealData = sourceType === "real_social_data";

  return (
    <span
      className={`w-fit rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${confidenceBadgeClasses(
        confidenceLevel,
        isRealData
      )}`}
    >
      {confidenceLabel(confidenceLevel, isRealData)}
    </span>
  );
}

function RecommendedPublishingWindow({
  publishingWindow,
  sourceType,
  accent = "yellow",
}: {
  publishingWindow?: PublishingWindow | null;
  sourceType?: DailyGrowthContent["sourceType"];
  accent?: "yellow" | "purple";
}) {
  const isRealData = sourceType === "real_social_data";

  const hasCompleteWindow = Boolean(
    publishingWindow?.recommendedStart &&
      publishingWindow?.recommendedEnd &&
      publishingWindow?.expectedPeak
  );

  if (!isRealData || !hasCompleteWindow || !publishingWindow) {
    return null;
  }

  const accentClasses =
    accent === "purple"
      ? "border-purple-400/20 bg-purple-500/[0.055] text-purple-200"
      : "border-yellow-400/20 bg-yellow-500/[0.055] text-yellow-200";

  const labelClasses =
    accent === "purple" ? "text-purple-300" : "text-yellow-300";

  return (
    <div className={`mt-3 rounded-xl border px-4 py-3 ${accentClasses}`}>
      <p
        className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${labelClasses}`}
      >
        Recommended publishing window
      </p>

      <p className="mt-1 text-sm font-bold">
        {publishingWindow.recommendedStart}–
        {publishingWindow.recommendedEnd}
      </p>

      <p className="mt-1 text-[11px] leading-5 opacity-75">
        Expected audience activity increases around{" "}
        {publishingWindow.expectedPeak}. Publishing shortly before the peak
        gives your content time to begin distributing.
      </p>

      {publishingWindow.explanation && (
        <p className="mt-2 text-[11px] leading-5 opacity-65">
          {publishingWindow.explanation}
        </p>
      )}
    </div>
  );
}

function RecommendationNote({
  reason,
  algorithmNote,
  accent = "yellow",
}: {
  reason: string;
  algorithmNote: string;
  accent?: "yellow" | "purple";
}) {
  const titleClasses =
    accent === "purple" ? "text-purple-300" : "text-yellow-300";

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
      <p
        className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${titleClasses}`}
      >
        Why Autoaffi picked this
      </p>

      <p className="mt-2 text-xs leading-5 text-slate-400">{reason}</p>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {algorithmNote}
      </p>
    </div>
  );
}

export default function GrowthHubPage() {
  const router = useRouter();

  const [overview, setOverview] =
    useState<GrowthHubOverview>(EMPTY_OVERVIEW);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [copiedTarget, setCopiedTarget] = useState<CopyTarget | null>(null);
  const [showPostDetails, setShowPostDetails] = useState(false);
  const [showReelDetails, setShowReelDetails] = useState(false);
  const [postVariantIndex, setPostVariantIndex] = useState(0);
  const [reelVariantIndex, setReelVariantIndex] = useState(0);

  const [completedContent, setCompletedContent] = useState({
    post: false,
    reel: false,
  });

  const loadOverview = useCallback(async (manualRefresh = false) => {
    if (manualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const response = await fetch("/api/growth-hub/overview", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      const result = (await response.json()) as ApiResponse;

      if (!response.ok || !result.ok) {
        throw new Error(
          result.ok
            ? "Growth Hub could not be loaded."
            : result.error || "Growth Hub could not be loaded."
        );
      }

      setOverview({
        ...result.overview,
        dailyContent: result.overview.dailyContent || null,
        momentumBreakdown:
          result.overview.momentumBreakdown?.length > 0
            ? result.overview.momentumBreakdown
            : EMPTY_MOMENTUM_BREAKDOWN,
        weeklyActivity:
          result.overview.weeklyActivity?.length > 0
            ? result.overview.weeklyActivity
            : createEmptyWeek(),
      });
    } catch (requestError) {
      setOverview(EMPTY_OVERVIEW);

      setError(
        requestError instanceof Error
          ? requestError.message
          : "Growth Hub could not be loaded."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview(false);
  }, [loadOverview]);

  const momentumScore = clampScore(overview.momentumScore);

  const primaryRecommendation =
    overview.primaryRecommendation || overview.recommendations[0] || null;

  const connectedPlatforms = useMemo(
    () =>
      overview.platforms.filter(
        (platform) => platform.status === "connected"
      ),
    [overview.platforms]
  );

  const fallbackPlatform =
    connectedPlatforms[0]?.displayName ||
    overview.platforms[0]?.displayName ||
    primaryRecommendation?.platform ||
    null;

  const dailyContent = useMemo(
    () =>
      overview.dailyContent ??
      buildFallbackDailyContent(
        primaryRecommendation,
        fallbackPlatform,
        postVariantIndex,
        reelVariantIndex
      ),
    [
      overview.dailyContent,
      primaryRecommendation,
      fallbackPlatform,
      postVariantIndex,
      reelVariantIndex,
    ]
  );

  const completePostCopy = useMemo(
    () => buildPublishReadyPostCopy(dailyContent.post),
    [dailyContent]
  );

  const imagePromptCopy = useMemo(
    () => dailyContent.post.imagePrompt,
    [dailyContent]
  );

  const postChatGptCopy = useMemo(
    () =>
      buildPostChatGptPrompt(
        dailyContent.contentDate,
        dailyContent.post
      ),
    [dailyContent]
  );

  const fullCapCutPackageCopy = useMemo(
    () =>
      buildCapCutPackageCopy(
        dailyContent.contentDate,
        dailyContent.reel
      ),
    [dailyContent]
  );

  const reelChatGptCopy = useMemo(
    () =>
      buildReelChatGptPrompt(
        dailyContent.contentDate,
        dailyContent.reel
      ),
    [dailyContent]
  );

  const greenDays = useMemo(
    () =>
      overview.weeklyActivity.filter((day) => day.status === "good")
        .length,
    [overview.weeklyActivity]
  );

  const mainConnectionStatus: ConnectionStatus = useMemo(() => {
    if (
      overview.platforms.some(
        (platform) => platform.status === "needs_reconnect"
      )
    ) {
      return "needs_reconnect";
    }

    if (
      overview.platforms.some(
        (platform) => platform.status === "connected"
      )
    ) {
      return "connected";
    }

    if (
      overview.platforms.some(
        (platform) => platform.status === "pending"
      )
    ) {
      return "pending";
    }

    return "not_connected";
  }, [overview.platforms]);

  const connectedPlatformLabels = connectedPlatforms.map((platform) =>
    platform.username
      ? `${platform.displayName} · @${platform.username}`
      : platform.displayName
  );

  const platformStatusText =
    connectedPlatformLabels.length > 0
      ? connectedPlatformLabels.join(" · ")
      : mainConnectionStatus === "pending"
        ? "Account connection is pending"
        : mainConnectionStatus === "needs_reconnect"
          ? "One or more accounts need attention"
          : "No platform connected yet";

  const lastSyncedText = formatLastSyncedAt(
    overview.dataStatus.lastSyncedAt
  );

  const socialAccountsButtonLabel =
    mainConnectionStatus === "needs_reconnect"
      ? "Manage social accounts"
      : overview.hasConnectedAccounts
        ? "Connect more accounts"
        : "Connect social accounts";

  async function copyContent(target: CopyTarget, text: string) {
    try {
      await navigator.clipboard.writeText(text);

      if (target === "post") {
        setCompletedContent((current) => ({
          ...current,
          post: true,
        }));
      }

      if (target === "reel") {
        setCompletedContent((current) => ({
          ...current,
          reel: true,
        }));
      }

      setCopiedTarget(target);

      window.setTimeout(() => {
        setCopiedTarget((current) =>
          current === target ? null : current
        );
      }, 2200);
    } catch {
      setError(
        "The content could not be copied. Please check your browser permissions."
      );
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black px-4 py-8 text-slate-50">
        <div className="mx-auto max-w-6xl animate-pulse space-y-6">
          <div className="h-80 rounded-3xl border border-slate-800 bg-slate-900/60" />

          <div className="grid gap-5 lg:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="h-72 rounded-2xl border border-slate-800 bg-slate-900/60"
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black px-4 py-8 text-slate-50">
      <div className="mx-auto max-w-6xl">
        <section className="relative mb-7 min-h-[430px] overflow-hidden rounded-3xl border border-yellow-500/15 bg-slate-950 shadow-2xl shadow-black/30 md:min-h-[455px]">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -inset-x-4 -top-4 bottom-0 md:-inset-y-6 md:left-[8%] md:right-[-3%]">
              <Image
                src={GROWTH_HUB_HERO_IMAGE}
                alt="Growth Hub social account analytics"
                fill
                priority
                quality={100}
                sizes="(max-width: 768px) 125vw, 1100px"
                className="object-contain object-[68%_8%] opacity-100 brightness-[1.19] contrast-[1.36] saturate-[1.58] md:object-right md:brightness-[1.21] md:contrast-[1.4] md:saturate-[1.64]"
              />
            </div>

            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/76 to-transparent" />

            <div className="absolute inset-y-0 left-0 w-[58%] bg-gradient-to-r from-slate-950 via-slate-950/88 to-transparent" />

            <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-slate-950 via-slate-950/54 to-transparent" />

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_46%,rgba(250,204,21,0.11),transparent_42%)]" />
          </div>

          <div className="pointer-events-none absolute -left-24 -top-24 h-56 w-56 rounded-full bg-yellow-400/10 blur-3xl" />

          <div className="pointer-events-none absolute -bottom-28 right-8 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />

          <div className="relative z-10 flex min-h-[430px] flex-col justify-between px-5 py-6 md:min-h-[455px] md:px-7 md:py-7">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-yellow-400/80">
                Audience &amp; Growth
              </p>

              <h1 className="mt-3 bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-500 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent drop-shadow md:text-5xl">
                Growth Hub
              </h1>

              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-200 drop-shadow">
                Connect at least one supported social account. Autoaffi
                can then analyse your posting frequency, consistency,
                content activity and available performance signals.
              </p>

              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 drop-shadow">
                Connect an account to replace the empty states below with
                your real publishing and performance data.
              </p>
            </div>

            <div className="mt-10 flex flex-col gap-3 px-1 py-1 md:mt-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full shadow-lg ${statusDotClasses(
                      mainConnectionStatus
                    )}`}
                  />

                  <span
                    className={`text-sm font-bold drop-shadow ${connectionStatusClasses(
                      mainConnectionStatus
                    )}`}
                  >
                    {connectionStatusLabel(mainConnectionStatus)}
                  </span>
                </div>

                <span className="hidden h-4 w-px bg-slate-500/70 sm:block" />

                <p className="min-w-0 text-xs font-medium leading-5 text-slate-200 drop-shadow">
                  {platformStatusText}
                </p>

                {lastSyncedText && (
                  <>
                    <span className="hidden h-4 w-px bg-slate-500/70 lg:block" />

                    <p className="text-xs text-slate-300 drop-shadow">
                      Last synced: {lastSyncedText}
                    </p>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => router.push(SOCIAL_ACCOUNTS_PATH)}
                className="w-fit shrink-0 rounded-full border border-yellow-300/35 bg-black/20 px-4 py-2 text-xs font-bold text-yellow-100 shadow-sm shadow-black/25 backdrop-blur-[2px] transition hover:border-yellow-300/70 hover:bg-yellow-400/12"
              >
                {socialAccountsButtonLabel}
              </button>
            </div>
          </div>
        </section>

        <div className="mb-6 flex justify-end">
          <button
            type="button"
            disabled={refreshing}
            onClick={() => void loadOverview(true)}
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-yellow-400/50 hover:text-yellow-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? "Refreshing…" : "Refresh insights"}
          </button>
        </div>

        {error && (
          <section className="mb-6 rounded-2xl border border-red-400/30 bg-red-500/10 p-4">
            <p className="text-sm font-semibold text-red-200">
              Growth Hub could not load
            </p>

            <p className="mt-1 text-sm text-red-200/80">{error}</p>
          </section>
        )}

        <section className="mb-6 grid gap-5 lg:grid-cols-[1.1fr_1.5fr_1.2fr]">
          <article className="rounded-2xl border border-yellow-500/25 bg-slate-900/70 p-5 shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-yellow-300">
              Growth momentum
            </p>

            {momentumScore === null ? (
              <>
                <p className="mt-4 text-2xl font-bold text-slate-200">
                  Awaiting real data
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Your score will activate when Autoaffi receives enough
                  publishing activity.
                </p>
              </>
            ) : (
              <>
                <p className="mt-4 bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-5xl font-extrabold text-transparent">
                  {momentumScore}
                  <span className="ml-2 text-sm text-slate-500">
                    /100
                  </span>
                </p>

                <p className="mt-2 text-sm text-slate-400">
                  {overview.momentumLabel ||
                    "Current visibility momentum"}
                </p>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-yellow-400 via-amber-300 to-orange-500"
                    style={{
                      width: `${momentumScore}%`,
                    }}
                  />
                </div>
              </>
            )}
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-yellow-300">
              Score breakdown
            </p>

            <div className="mt-4 space-y-3">
              {overview.momentumBreakdown.map((item) => {
                const score = clampScore(item.score);

                return (
                  <div
                    key={item.key}
                    className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-medium text-slate-300">
                        {item.label}
                      </span>

                      <span className="text-xs font-bold text-yellow-300">
                        {score === null ? "Pending" : `${score}/100`}
                      </span>
                    </div>

                    {score !== null && (
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full bg-gradient-to-r from-yellow-400 to-amber-500"
                          style={{
                            width: `${score}%`,
                          }}
                        />
                      </div>
                    )}

                    {item.explanation && (
                      <p className="mt-2 text-[11px] leading-5 text-slate-500">
                        {item.explanation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </article>

          <article className="rounded-2xl border border-emerald-500/25 bg-slate-900/70 p-5 shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
              Weekly activity
            </p>

            <p className="mt-2 text-xs text-slate-500">
              {overview.hasConnectedAccounts
                ? `${greenDays} strong publishing days`
                : "Preview of your seven-day activity chart"}
            </p>

            <div className="mt-5 flex h-44 items-end justify-between gap-2">
              {overview.weeklyActivity.map((day) => {
                const height =
                  day.posts === 0
                    ? 22
                    : Math.min(150, 34 + day.posts * 45);

                return (
                  <div
                    key={day.date}
                    className="group flex min-w-0 flex-1 flex-col items-center"
                  >
                    <div
                      className={`w-full max-w-7 rounded-t-md bg-gradient-to-b shadow-lg transition-all group-hover:brightness-125 ${weeklyBarClasses(
                        day.status
                      )}`}
                      style={{
                        height: `${height}px`,
                      }}
                      title={day.reason}
                    />

                    <span className="mt-2 text-[10px] text-slate-400">
                      {day.label}
                    </span>

                    <span className="text-[9px] text-slate-600">
                      {day.posts}x
                    </span>
                  </div>
                );
              })}
            </div>
          </article>
        </section>

        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-yellow-300">
                Platform overview
              </p>

              <h2 className="mt-2 text-xl font-bold text-white">
                Publishing and visibility by platform
              </h2>
            </div>

            <p className="text-xs text-slate-500">
              Only real synced activity is displayed
            </p>
          </div>

          {overview.platforms.length > 0 ? (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-3">Platform</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Posts 7d</th>
                    <th className="px-3 py-3">Posts 30d</th>
                    <th className="px-3 py-3">Views</th>
                    <th className="px-3 py-3">Reach</th>
                    <th className="px-3 py-3">Engagements</th>
                    <th className="px-3 py-3">Score</th>
                  </tr>
                </thead>

                <tbody>
                  {overview.platforms.map((platform) => {
                    const score = clampScore(
                      platform.visibilityScore
                    );

                    return (
                      <tr
                        key={`${platform.platform}-table-${
                          platform.username || "account"
                        }`}
                        className="border-b border-slate-800/70 text-sm"
                      >
                        <td className="px-3 py-4">
                          <span
                            className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${platformBadgeClasses(
                              platform.platform
                            )}`}
                          >
                            {platform.displayName}
                          </span>
                        </td>

                        <td
                          className={`px-3 py-4 text-xs font-medium ${connectionStatusClasses(
                            platform.status
                          )}`}
                        >
                          {connectionStatusLabel(platform.status)}
                        </td>

                        <td className="px-3 py-4 text-slate-300">
                          {platform.postsLast7Days}
                        </td>

                        <td className="px-3 py-4 text-slate-300">
                          {platform.postsLast30Days}
                        </td>

                        <td className="px-3 py-4 text-slate-300">
                          {platform.viewsLast7Days ?? "—"}
                        </td>

                        <td className="px-3 py-4 text-slate-300">
                          {platform.reachLast7Days ?? "—"}
                        </td>

                        <td className="px-3 py-4 text-slate-300">
                          {platform.engagementsLast7Days ?? "—"}
                        </td>

                        <td className="px-3 py-4 font-semibold text-yellow-300">
                          {score === null
                            ? "Pending"
                            : `${score}/100`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-5">
              <SectionEmptyState
                title="Platform data will appear here"
                text="Each connected account will receive its own row with publishing frequency, available visibility signals and Growth Hub score."
              />
            </div>
          )}
        </section>

        <section className="mb-6 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <article className="rounded-2xl border border-yellow-500/25 bg-slate-900/75 p-6 shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-yellow-300">
              Today&apos;s Growth Focus
            </p>

            {primaryRecommendation ? (
              <>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span
                    className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${priorityClasses(
                      primaryRecommendation.priority
                    )}`}
                  >
                    {primaryRecommendation.priority} priority
                  </span>

                  {primaryRecommendation.platform && (
                    <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-[10px] font-semibold text-slate-300">
                      {primaryRecommendation.platform}
                    </span>
                  )}

                  {primaryRecommendation.format && (
                    <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-[10px] font-semibold capitalize text-slate-300">
                      {primaryRecommendation.format}
                    </span>
                  )}
                </div>

                <h2 className="mt-4 text-2xl font-bold text-white">
                  {primaryRecommendation.title}
                </h2>

                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {primaryRecommendation.explanation}
                </p>

                <div className="mt-5 rounded-xl border border-yellow-400/20 bg-yellow-500/5 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-yellow-300">
                    Recommended action
                  </p>

                  <p className="mt-2 text-sm font-medium text-slate-100">
                    {primaryRecommendation.action}
                  </p>
                </div>
              </>
            ) : (
              <>
                <h2 className="mt-4 text-xl font-bold text-white">
                  Your first recommendation will appear here
                </h2>

                <p className="mt-3 text-sm leading-6 text-slate-400">
                  Growth Hub will identify consistency gaps, strong
                  content and the platform that needs your attention. It
                  will not invent results before real activity is
                  available.
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {[
                    "Visibility opportunity",
                    "Recommended content action",
                    "Platform and format",
                  ].map((item) => (
                    <div
                      key={item}
                      className="rounded-xl border border-dashed border-slate-700 bg-slate-950/35 p-3 text-center text-xs text-slate-500"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </>
            )}
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-yellow-300">
              Additional opportunities
            </p>

            {overview.recommendations.length > 1 ? (
              <div className="mt-4 space-y-3">
                {overview.recommendations
                  .filter(
                    (item) =>
                      item.id !== primaryRecommendation?.id
                  )
                  .slice(0, 4)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-slate-800 bg-slate-950/55 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-100">
                          {item.title}
                        </p>

                        <span
                          className={`rounded-full border px-2 py-1 text-[9px] font-semibold uppercase ${priorityClasses(
                            item.priority
                          )}`}
                        >
                          {item.priority}
                        </span>
                      </div>

                      <p className="mt-2 text-[11px] leading-5 text-slate-400">
                        {item.action}
                      </p>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="mt-4">
                <SectionEmptyState
                  title="More opportunities will appear here"
                  text="Growth Hub will add practical follow-up actions as it learns from your publishing activity."
                />
              </div>
            )}
          </article>
        </section>

        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-yellow-300">
            Top-performing content
          </p>

          <h2 className="mt-2 text-xl font-bold text-white">
            Content worth repeating or repurposing
          </h2>

          {overview.topContent.length > 0 ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {overview.topContent.map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/55 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${platformBadgeClasses(
                        item.platform
                      )}`}
                    >
                      {item.platformLabel}
                    </span>

                    <div className="text-right">
                      <p className="text-[9px] uppercase tracking-wider text-slate-600">
                        {item.metricLabel}
                      </p>

                      <p className="mt-1 text-sm font-bold text-yellow-300">
                        {item.metricFormatted}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-sm font-semibold leading-6 text-slate-100">
                    {item.title}
                  </p>

                  {item.recommendation && (
                    <p className="mt-3 text-[11px] leading-5 text-yellow-200/75">
                      {item.recommendation}
                    </p>
                  )}

                  {item.sourceUrl && (
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex text-[11px] font-semibold text-sky-300 hover:text-sky-200"
                    >
                      Open content →
                    </a>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5">
              <SectionEmptyState
                title="Your strongest content will appear here"
                text="Growth Hub will compare available views, plays, reach, impressions and engagements without inserting fake results."
              />
            </div>
          )}
        </section>

        <section className="mb-7 rounded-3xl border border-slate-800 bg-slate-900/55 p-5 shadow-xl shadow-black/20 md:p-6">
          <div className="flex flex-col gap-4 border-b border-slate-800 pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-yellow-300">
                Today&apos;s ready-to-use content
              </p>

              <h2 className="mt-2 text-2xl font-bold text-white">
                Create today without starting from an empty page
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Autoaffi turns today&apos;s Growth Focus into one post
                and one Reel package you can use, adjust or copy.
              </p>
            </div>

            <ContentConfidenceBadge
              confidenceLevel={dailyContent.confidenceLevel}
              sourceType={dailyContent.sourceType}
            />
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            <article className="rounded-2xl border border-yellow-500/25 bg-gradient-to-b from-yellow-500/[0.06] to-slate-950/70 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-yellow-300">
                    Today&apos;s Growth Post
                  </p>

                  <h3 className="mt-2 text-xl font-bold text-white">
                    Complete post package
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setPostVariantIndex((current) => current + 1)
                  }
                  className="rounded-full border border-yellow-400/30 bg-yellow-400/[0.06] px-3 py-1.5 text-[10px] font-bold text-yellow-200 transition hover:border-yellow-300/60 hover:bg-yellow-400/12"
                >
                  Refresh post idea
                </button>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <MetadataPill
                  label="Platform"
                  value={dailyContent.post.platform}
                />

                <MetadataPill
                  label="Mode"
                  value={dailyContent.post.mode}
                />

                <MetadataPill
                  label="Date"
                  value={formatContentDate(
                    dailyContent.contentDate
                  )}
                />
              </div>

              <RecommendedPublishingWindow
                publishingWindow={dailyContent.publishingWindow}
                sourceType={dailyContent.sourceType}
              />

              <div className="mt-3 rounded-2xl border border-yellow-500/15 bg-yellow-500/[0.035] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-yellow-300">
                  Topic
                </p>

                <p className="mt-1 text-sm font-semibold leading-6 text-slate-100">
                  {dailyContent.post.topic}
                </p>
              </div>

              <div className="mt-4 space-y-3">
                <MiniContentBlock label="Hook">
                  {dailyContent.post.hook}
                </MiniContentBlock>

                <MiniContentBlock label="Caption">
                  {dailyContent.post.caption}
                </MiniContentBlock>

                <div className="grid gap-3 sm:grid-cols-2">
                  <MiniContentBlock label="Next step">
                    {dailyContent.post.cta}
                  </MiniContentBlock>

                  <MiniContentBlock label="Conversation starter">
                    {dailyContent.post.commentQuestion}
                  </MiniContentBlock>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowPostDetails((current) => !current)
                }
                className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-950/45 px-4 py-2.5 text-xs font-bold text-slate-300 transition hover:border-yellow-400/40 hover:text-yellow-200"
              >
                {showPostDetails
                  ? "Hide extra options"
                  : "Show extra options"}
              </button>

              {showPostDetails && (
                <div className="mt-4 space-y-3">
                  <MiniContentBlock label="Other opening ideas">
                    {dailyContent.post.alternativeHooks
                      .map(
                        (hook, index) =>
                          `${index + 1}. ${hook}`
                      )
                      .join("\n")}
                  </MiniContentBlock>

                  <MiniContentBlock label="Visual idea">
                    {dailyContent.post.visualIdea}
                  </MiniContentBlock>

                  <MiniContentBlock label="Image prompt">
                    {dailyContent.post.imagePrompt}
                  </MiniContentBlock>

                  <MiniContentBlock label="Hashtags or search terms">
                    {dailyContent.post.hashtags.length > 0
                      ? dailyContent.post.hashtags.join(" · ")
                      : "No additional hashtags or search terms were added."}
                  </MiniContentBlock>
                </div>
              )}

              <div className="mt-5">
                <RecommendationNote
                  reason={dailyContent.post.reason}
                  algorithmNote={dailyContent.post.algorithmNote}
                />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() =>
                    void copyContent("post", completePostCopy)
                  }
                  className={`rounded-xl px-4 py-3 text-sm font-bold transition hover:brightness-110 ${
                    completedContent.post
                      ? "border border-emerald-400/35 bg-emerald-500/15 text-emerald-200"
                      : "bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-950"
                  }`}
                >
                  {completedContent.post
                    ? "Post completed ✓"
                    : copiedTarget === "post"
                      ? "Post completed ✓"
                      : "Copy publish-ready post"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void copyContent("image", imagePromptCopy)
                  }
                  className="rounded-xl border border-yellow-400/30 bg-yellow-400/[0.06] px-4 py-3 text-sm font-bold text-yellow-200 transition hover:border-yellow-300/60 hover:bg-yellow-400/10"
                >
                  {copiedTarget === "image"
                    ? "Copied: Image prompt ✓"
                    : "Copy image prompt"}
                </button>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                <p className="text-sm font-semibold text-slate-200">
                  Need help replying to your audience or improving this
                  post?
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Copy this to ChatGPT and ask for answers, rewrites,
                  comment replies, captions or follow-up ideas.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    void copyContent(
                      "post-chatgpt",
                      postChatGptCopy
                    )
                  }
                  className="mt-3 w-full rounded-xl border border-emerald-400/30 bg-emerald-500/[0.08] px-4 py-3 text-sm font-bold text-emerald-200 transition hover:border-emerald-300/60 hover:bg-emerald-500/15"
                >
                  {copiedTarget === "post-chatgpt"
                    ? "Copied for ChatGPT ✓"
                    : "Copy to ChatGPT"}
                </button>
              </div>
            </article>

            <article className="rounded-2xl border border-purple-500/25 bg-gradient-to-b from-purple-500/[0.06] to-slate-950/70 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-300">
                    Today&apos;s Growth Reel
                  </p>

                  <h3 className="mt-2 text-xl font-bold text-white">
                    Complete CapCut package
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setReelVariantIndex((current) => current + 1)
                  }
                  className="rounded-full border border-purple-400/30 bg-purple-400/[0.06] px-3 py-1.5 text-[10px] font-bold text-purple-200 transition hover:border-purple-300/60 hover:bg-purple-400/12"
                >
                  Refresh Reel idea
                </button>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <MetadataPill
                  label="Platform"
                  value={dailyContent.reel.platform}
                  accent="purple"
                />

                <MetadataPill
                  label="Mode"
                  value={dailyContent.reel.mode}
                  accent="purple"
                />

                <MetadataPill
                  label="Duration"
                  value={`${dailyContent.reel.durationSeconds} sec`}
                  accent="purple"
                />

                <MetadataPill
                  label="Date"
                  value={formatContentDate(
                    dailyContent.contentDate
                  )}
                  accent="purple"
                />
              </div>

              <RecommendedPublishingWindow
                publishingWindow={dailyContent.publishingWindow}
                sourceType={dailyContent.sourceType}
                accent="purple"
              />

              <div className="mt-3 rounded-2xl border border-purple-500/15 bg-purple-500/[0.035] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-purple-300">
                  Topic
                </p>

                <p className="mt-1 text-sm font-semibold leading-6 text-slate-100">
                  {dailyContent.reel.topic}
                </p>
              </div>

              <div className="mt-4 space-y-3">
                <MiniContentBlock label="Hook" accent="purple">
                  {dailyContent.reel.hook}
                </MiniContentBlock>

                <MiniContentBlock
                  label="Voiceover"
                  accent="purple"
                >
                  {dailyContent.reel.voiceover}
                </MiniContentBlock>

                <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-purple-300">
                    Scene overview
                  </p>

                  <div className="mt-3 space-y-2">
                    {dailyContent.reel.scenes
                      .slice(0, 3)
                      .map((scene, index) => (
                        <div
                          key={`${scene.timing}-${index}`}
                          className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
                        >
                          <p className="text-xs font-bold text-slate-200">
                            Scene {index + 1} · {scene.timing}
                          </p>

                          <p className="mt-1 text-xs leading-5 text-slate-400">
                            {scene.overlay}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowReelDetails((current) => !current)
                }
                className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-950/45 px-4 py-2.5 text-xs font-bold text-slate-300 transition hover:border-purple-400/40 hover:text-purple-200"
              >
                {showReelDetails
                  ? "Hide full CapCut package"
                  : "View full CapCut package"}
              </button>

              {showReelDetails && (
                <div className="mt-4 space-y-3">
                  <MiniContentBlock
                    label="Other Reel opening ideas"
                    accent="purple"
                  >
                    {dailyContent.reel.alternativeHooks
                      .map(
                        (hook, index) =>
                          `${index + 1}. ${hook}`
                      )
                      .join("\n")}
                  </MiniContentBlock>

                  <div className="space-y-3">
                    {dailyContent.reel.scenes.map(
                      (scene, index) => (
                        <div
                          key={`${scene.timing}-full-${index}`}
                          className="rounded-2xl border border-purple-500/15 bg-slate-950/55 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm font-bold text-white">
                              Scene {index + 1}
                            </p>

                            <span className="rounded-full border border-purple-400/20 bg-purple-500/10 px-2.5 py-1 text-[10px] font-semibold text-purple-200">
                              {scene.timing}
                            </span>
                          </div>

                          <div className="mt-3 grid gap-3 text-sm leading-6">
                            <p className="text-slate-300">
                              <span className="font-semibold text-slate-500">
                                Visual:
                              </span>{" "}
                              {scene.visual}
                            </p>

                            <p className="text-slate-200">
                              <span className="font-semibold text-slate-500">
                                Voiceover:
                              </span>{" "}
                              {scene.voiceover}
                            </p>

                            <p className="text-purple-200">
                              <span className="font-semibold text-slate-500">
                                Overlay:
                              </span>{" "}
                              {scene.overlay}
                            </p>

                            <p className="text-slate-300">
                              <span className="font-semibold text-slate-500">
                                Transition:
                              </span>{" "}
                              {scene.transition}
                            </p>
                          </div>
                        </div>
                      )
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <MiniContentBlock
                      label="Caption"
                      accent="purple"
                    >
                      {dailyContent.reel.caption}
                    </MiniContentBlock>

                    <MiniContentBlock
                      label="Cover text"
                      accent="purple"
                    >
                      {dailyContent.reel.coverText}
                    </MiniContentBlock>
                  </div>
                </div>
              )}

              <div className="mt-5">
                <RecommendationNote
                  reason={dailyContent.reel.reason}
                  algorithmNote={dailyContent.reel.algorithmNote}
                  accent="purple"
                />
              </div>

              <button
                type="button"
                onClick={() =>
                  void copyContent(
                    "reel",
                    fullCapCutPackageCopy
                  )
                }
                className={`mt-5 w-full rounded-xl px-4 py-3 text-sm font-bold transition hover:brightness-110 ${
                  completedContent.reel
                    ? "border border-emerald-400/35 bg-emerald-500/15 text-emerald-200"
                    : "bg-gradient-to-r from-purple-400 to-fuchsia-500 text-white"
                }`}
              >
                {completedContent.reel
                  ? "Reel completed ✓"
                  : copiedTarget === "reel"
                    ? "Reel completed ✓"
                    : "Copy full CapCut package"}
              </button>

              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                <p className="text-sm font-semibold text-slate-200">
                  Need help changing the Reel or answering comments?
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Copy the full Reel package to ChatGPT and ask for a new
                  version, simpler filming steps or audience replies.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    void copyContent(
                      "reel-chatgpt",
                      reelChatGptCopy
                    )
                  }
                  className="mt-3 w-full rounded-xl border border-emerald-400/30 bg-emerald-500/[0.08] px-4 py-3 text-sm font-bold text-emerald-200 transition hover:border-emerald-300/60 hover:bg-emerald-500/15"
                >
                  {copiedTarget === "reel-chatgpt"
                    ? "Copied for ChatGPT ✓"
                    : "Copy to ChatGPT"}
                </button>
              </div>
            </article>
          </div>
        </section>

        <footer className="border-t border-slate-800 pt-5">
          <p className="text-[11px] leading-5 text-slate-600">
            Growth Hub only displays metrics supplied by connected
            platforms or activity recorded inside Autoaffi.
            Availability differs by platform, API approval and
            connection type.
          </p>
        </footer>
      </div>
    </main>
  );
}