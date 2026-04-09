import type {
  PushCTAIntensity,
  PushGoal,
  PushLanguage,
  PushPlatform,
  PushTargetMarket,
  PushType,
} from "@/app/login/dashboard/autoaffi-pushes/types";

export const PUSH_TYPE_OPTIONS: Array<{
  value: PushType;
  label: string;
  description: string;
  bestFor: string;
}> = [
  {
    value: "authority",
    label: "Authority Push",
    description:
      "Build trust, engagement and follower growth through insight-first content.",
    bestFor: "Cold audiences, follower growth and stronger trust.",
  },
  {
    value: "offer_warmup",
    label: "Offer Warm-Up Push",
    description:
      "Warm people up over several days before asking for the click.",
    bestFor: "Softly preparing audiences for an offer or funnel.",
  },
  {
    value: "lead_magnet",
    label: "Lead Magnet Push",
    description:
      "Drive more opt-ins with value-first content that creates real interest.",
    bestFor: "Guides, free resources and email/lead capture.",
  },
  {
    value: "recurring",
    label: "Recurring Push",
    description:
      "Position recurring income in a natural, trust-building way.",
    bestFor: "Monthly tools, SaaS and longer-term monetization.",
  },
  {
    value: "mini_launch",
    label: "Mini Launch Push",
    description:
      "Run a focused short launch with teaser, reveal and CTA progression.",
    bestFor: "Short bursts of attention around a focused offer.",
  },
  {
    value: "objection_breaker",
    label: "Objection Breaker Push",
    description:
      "Break hesitation and move warmer audiences closer to action.",
    bestFor: "Handling hesitation before the final push.",
  },
];

export const PUSH_PLATFORM_OPTIONS: Array<{
  value: PushPlatform;
  label: string;
}> = [
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "youtube", label: "YouTube Shorts" },
];

export const PUSH_GOAL_OPTIONS: Array<{
  value: PushGoal;
  label: string;
  description: string;
}> = [
  {
    value: "engagement",
    label: "More engagement",
    description: "Prioritize comments, saves, shares and stronger signal quality.",
  },
  {
    value: "followers",
    label: "More followers",
    description: "Prioritize curiosity, trust and profile growth.",
  },
  {
    value: "warm_offer",
    label: "Warm audience for offer",
    description: "Build trust first, then move the right people closer to action.",
  },
  {
    value: "leads",
    label: "More leads",
    description: "Increase intent and move more people toward opt-in or next step.",
  },
  {
    value: "balanced_growth",
    label: "Balanced growth",
    description: "Blend reach, trust, followers and monetization naturally.",
  },
];

export const PUSH_CTA_INTENSITY_OPTIONS: Array<{
  value: PushCTAIntensity;
  label: string;
  description: string;
}> = [
  {
    value: "low",
    label: "Low CTA intensity",
    description: "Very soft asks. Best for trust, followers and colder audiences.",
  },
  {
    value: "medium",
    label: "Medium CTA intensity",
    description: "Balanced mix of engagement and soft conversion signals.",
  },
  {
    value: "high",
    label: "High CTA intensity",
    description: "More direct asks, but still controlled and not spammy.",
  },
];

export const PUSH_TARGET_MARKET_OPTIONS: Array<{
  value: PushTargetMarket;
  label: string;
}> = [
  { value: "international_english", label: "International English" },
  { value: "usa", label: "USA" },
  { value: "canada", label: "Canada" },
  { value: "uk", label: "UK" },
  { value: "australia", label: "Australia" },
  { value: "new_zealand", label: "New Zealand" },
];

export const PUSH_LANGUAGE_OPTIONS: Array<{
  value: PushLanguage;
  label: string;
}> = [
  { value: "english", label: "English" },
  { value: "swedish", label: "Swedish" },
  { value: "auto", label: "Auto" },
];

export const PUSH_DURATION_OPTIONS = [5, 7] as const;

export const SUGGESTED_TOPICS: string[] = [
  "affiliate marketing",
  "online income",
  "AI tools",
  "content growth",
  "digital products",
  "recurring income",
];

export function getRecommendedPushType(): PushType {
  return "authority";
}

export function getRecommendedGoal(pushType: PushType): PushGoal {
  switch (pushType) {
    case "authority":
      return "engagement";
    case "lead_magnet":
      return "leads";
    case "mini_launch":
      return "warm_offer";
    case "objection_breaker":
      return "warm_offer";
    case "offer_warmup":
      return "balanced_growth";
    case "recurring":
      return "balanced_growth";
    default:
      return "balanced_growth";
  }
}

export function getGoalRecommendationReason(pushType: PushType, goal: PushGoal): string {
  if (pushType === "authority" && goal === "engagement") {
    return "Autoaffi recommends engagement first here because stronger comments, saves and follows usually create better momentum before heavier monetization.";
  }

  if (pushType === "lead_magnet" && goal === "leads") {
    return "Autoaffi recommends a lead-focused push here because this structure is strongest when the content naturally leads into an opt-in.";
  }

  if (pushType === "mini_launch" && goal === "warm_offer") {
    return "Autoaffi recommends warming the audience first so the reveal and CTA land better instead of feeling too cold or too sales-heavy.";
  }

  if (pushType === "objection_breaker" && goal === "warm_offer") {
    return "Autoaffi recommends warming the audience here because this push is designed to reduce hesitation before the ask.";
  }

  return "Autoaffi recommends balanced growth here because it gives the best mix of engagement, trust, follower growth and softer conversion potential.";
}

export function getTargetMarketHelperText(): string {
  return "Autoaffi prioritizes these markets because affiliate adoption, buyer maturity and creator monetization are generally strongest there.";
}