import type { GeneratedPush, PushDay } from "@/app/login/dashboard/autoaffi-pushes/types";

function formatDay(day: PushDay) {
  return [
    `DAY ${day.dayNumber} — ${day.dayTitle}`,
    `Role: ${day.dayRole}`,
    `Why this day matters: ${day.whyThisDayMatters}`,
    `Optimizing for: ${(day.optimizingFor || []).join(", ")}`,
    ``,
    `Hook:`,
    `${day.hook}`,
    ``,
    `Post copy:`,
    `${day.body}`,
    ``,
    `Suggested CTA:`,
    `${day.cta}`,
    ``,
    `Algorithm note:`,
    `${day.algorithmNote}`,
    ``,
    `Keyword focus:`,
    ...(day.keywordFocus || []),
    ``,
    `Hashtags:`,
    ...(day.hashtags || []),
    ``,
    `Image prompt:`,
    `${day.imagePrompt || ""}`,
    ``,
    `Short video / CapCut script:`,
    ...((day.videoScript || []).map((line) => line)),
  ].join("\n");
}

export function formatPushForExport(push: GeneratedPush) {
  const header = [
    `AUTOAFFI PUSHES`,
    `${push.title}`,
    ``,
    `Platform: ${push.platform}`,
    `Goal: ${push.goal}`,
    `Duration: ${push.durationDays} days`,
    `CTA intensity: ${push.ctaIntensity}`,
    `Target market: ${push.targetMarket}`,
    `Language: ${push.language}`,
    push.offerFocus ? `Offer focus: ${push.offerFocus}` : null,
    ``,
    `Why this push works:`,
    `${push.whyThisPushWorks}`,
    ``,
    `==================================================`,
    ``,
  ]
    .filter(Boolean)
    .join("\n");

  const days = push.days
    .map((day) => formatDay(day))
    .join("\n\n--------------------------------------------------\n\n");

  return `${header}${days}\n`;
}