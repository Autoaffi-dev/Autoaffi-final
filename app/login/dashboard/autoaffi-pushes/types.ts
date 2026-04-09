export type PushType =
  | "authority"
  | "offer_warmup"
  | "lead_magnet"
  | "recurring"
  | "mini_launch"
  | "objection_breaker";

export type PushPlatform = "tiktok" | "instagram" | "facebook" | "youtube";

export type PushGoal =
  | "engagement"
  | "followers"
  | "warm_offer"
  | "leads"
  | "balanced_growth";

export type PushCTAIntensity = "low" | "medium" | "high";

export type TopicInputMode = "suggested" | "manual";

export type PushTargetMarket =
  | "international_english"
  | "usa"
  | "canada"
  | "uk"
  | "australia"
  | "new_zealand";

export type PushLanguage = "english" | "swedish" | "auto";

export type DayOptimizationFocus =
  | "reach"
  | "comments"
  | "saves"
  | "follows"
  | "warm_clicks"
  | "leads"
  | "trust";

export type PushInput = {
  pushType: PushType;
  platform: PushPlatform;
  topic: string;
  offerFocus?: string;
  goal: PushGoal;
  durationDays: 5 | 7;
  ctaIntensity: PushCTAIntensity;
  targetMarket: PushTargetMarket;
  language: PushLanguage;
};

export type PushDay = {
  dayNumber: number;
  dayTitle: string;
  dayRole: string;
  whyThisDayMatters: string;
  optimizingFor: DayOptimizationFocus[];
  hook: string;
  body: string;
  cta: string;
  commentReply?: string | null;
  algorithmNote: string;
  hashtags: string[];
  keywordFocus: string[];
  imagePrompt: string;
  videoScript: string[];
};

export type GeneratedPush = {
  title: string;
  pushType: PushType;
  platform: PushPlatform;
  topic: string;
  offerFocus?: string;
  goal: PushGoal;
  durationDays: 5 | 7;
  ctaIntensity: PushCTAIntensity;
  targetMarket: PushTargetMarket;
  language: PushLanguage;
  whyThisPushWorks: string;
  days: PushDay[];
};

export type SavedPush = {
  id: string;
  userId: string;
  push: GeneratedPush;
  createdAt: string;
};