import type {
  PushCTAIntensity,
  PushGoal,
  PushType,
} from "@/app/login/dashboard/autoaffi-pushes/types";

export type PushGenerationRules = {
  maxDirectCTADays: number;
  avoidHardSellOnDayOne: boolean;
  avoidDirectCTAConsecutiveDays: boolean;
  preferCuriosityEarly: boolean;
  preferTrustBeforeConversion: boolean;
  preferEngagementSignals: Array<"comments" | "saves" | "shares" | "follows" | "clicks">;
};

export function getPushRules(args: {
  pushType: PushType;
  goal: PushGoal;
  ctaIntensity: PushCTAIntensity;
  durationDays: 5 | 7;
}): PushGenerationRules {
  const { pushType, goal, ctaIntensity, durationDays } = args;

  let maxDirectCTADays = 1;
  if (ctaIntensity === "medium") maxDirectCTADays = 2;
  if (ctaIntensity === "high") maxDirectCTADays = durationDays === 7 ? 3 : 2;

  if (goal === "engagement" || goal === "followers") {
    maxDirectCTADays = Math.min(maxDirectCTADays, 1);
  }

  if (pushType === "mini_launch" && ctaIntensity === "high") {
    maxDirectCTADays = durationDays === 7 ? 3 : 2;
  }

  const preferEngagementSignals: Array<"comments" | "saves" | "shares" | "follows" | "clicks"> = [];

  if (goal === "engagement") {
    preferEngagementSignals.push("comments", "saves", "shares");
  } else if (goal === "followers") {
    preferEngagementSignals.push("follows", "comments", "saves");
  } else if (goal === "leads") {
    preferEngagementSignals.push("saves", "clicks", "comments");
  } else if (goal === "warm_offer") {
    preferEngagementSignals.push("comments", "saves", "clicks");
  } else {
    preferEngagementSignals.push("comments", "saves", "follows");
  }

  if (pushType === "authority") {
    preferEngagementSignals.unshift("comments", "follows");
  }

  if (pushType === "lead_magnet") {
    preferEngagementSignals.unshift("saves");
  }

  if (pushType === "mini_launch") {
    preferEngagementSignals.unshift("comments", "clicks");
  }

  return {
    maxDirectCTADays,
    avoidHardSellOnDayOne: true,
    avoidDirectCTAConsecutiveDays: ctaIntensity !== "high",
    preferCuriosityEarly: true,
    preferTrustBeforeConversion: goal !== "leads",
    preferEngagementSignals: Array.from(new Set(preferEngagementSignals)),
  };
}

export function isDirectCTADay(args: {
  dayNumber: number;
  durationDays: 5 | 7;
  pushType: PushType;
}): boolean {
  const { dayNumber, durationDays, pushType } = args;

  if (pushType === "mini_launch") {
    if (durationDays === 5) return dayNumber >= 4;
    return dayNumber >= 6;
  }

  if (durationDays === 5) {
    return dayNumber === 5;
  }

  return dayNumber >= 6;
}

export function getCTAStyleForDay(args: {
  dayNumber: number;
  durationDays: 5 | 7;
  ctaIntensity: PushCTAIntensity;
  pushType: PushType;
}): "none" | "soft" | "medium" | "direct" {
  const { dayNumber, durationDays, ctaIntensity, pushType } = args;

  if (dayNumber === 1) return "none";

  const directDay = isDirectCTADay({ dayNumber, durationDays, pushType });

  if (!directDay) {
    if (dayNumber <= 2) return "soft";
    return ctaIntensity === "high" ? "medium" : "soft";
  }

  if (ctaIntensity === "low") return "soft";
  if (ctaIntensity === "medium") return "medium";
  return "direct";
}

export function shouldPushFollowers(args: {
  goal: PushGoal;
  pushType: PushType;
  dayNumber: number;
}): boolean {
  const { goal, pushType, dayNumber } = args;

  if (goal === "followers") return true;
  if (pushType === "authority" && dayNumber <= 4) return true;
  return false;
}

export function shouldPushClicks(args: {
  goal: PushGoal;
  dayNumber: number;
  durationDays: 5 | 7;
}): boolean {
  const { goal, dayNumber, durationDays } = args;

  if (goal !== "leads" && goal !== "warm_offer") return false;
  if (durationDays === 5) return dayNumber >= 4;
  return dayNumber >= 5;
}