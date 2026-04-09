import type { PushInput } from "@/app/login/dashboard/autoaffi-pushes/types";

export type PushValidationResult = {
  ok: boolean;
  errors: string[];
};

export function validatePushInput(input: PushInput): PushValidationResult {
  const errors: string[] = [];

  if (!input.topic || input.topic.trim().length < 2) {
    errors.push("Push topic must be at least 2 characters.");
  }

  if (input.offerFocus && input.offerFocus.trim().length > 140) {
    errors.push("Offer focus is too long.");
  }

  if (![5, 7].includes(input.durationDays)) {
    errors.push("Duration must be 5 or 7 days.");
  }

  if (
    ![
      "authority",
      "offer_warmup",
      "lead_magnet",
      "recurring",
      "mini_launch",
      "objection_breaker",
    ].includes(input.pushType)
  ) {
    errors.push("Invalid push type.");
  }

  if (!["tiktok", "instagram", "facebook", "youtube"].includes(input.platform)) {
    errors.push("Invalid platform.");
  }

  if (
    !["engagement", "followers", "warm_offer", "leads", "balanced_growth"].includes(
      input.goal
    )
  ) {
    errors.push("Invalid goal.");
  }

  if (!["low", "medium", "high"].includes(input.ctaIntensity)) {
    errors.push("Invalid CTA intensity.");
  }

  if (
    !["international_english", "usa", "canada", "uk", "australia", "new_zealand"].includes(
      input.targetMarket
    )
  ) {
    errors.push("Invalid target market.");
  }

  if (!["english", "swedish", "auto"].includes(input.language)) {
    errors.push("Invalid language.");
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}