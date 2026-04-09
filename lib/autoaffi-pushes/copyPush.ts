import type { GeneratedPush, PushDay } from "@/app/login/dashboard/autoaffi-pushes/types";
import { formatPushForExport } from "@/lib/autoaffi-pushes/formatPushForExport";

function formatSingleDay(day: PushDay) {
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

export async function copyFullPush(push: GeneratedPush) {
  const text = formatPushForExport(push);
  await navigator.clipboard.writeText(text);
}

export async function copySinglePushDay(day: PushDay) {
  const text = formatSingleDay(day);
  await navigator.clipboard.writeText(text);
}

export async function copyDayPostOnly(day: PushDay) {
  const text = [day.hook, "", day.body, "", `CTA: ${day.cta}`].join("\n");
  await navigator.clipboard.writeText(text);
}

export async function copyDayHashtags(day: PushDay) {
  const text = (day.hashtags || []).join(" ");
  await navigator.clipboard.writeText(text);
}

export async function copyImagePrompt(day: PushDay) {
  await navigator.clipboard.writeText(day.imagePrompt || "");
}

export async function copyVideoScript(day: PushDay) {
  await navigator.clipboard.writeText((day.videoScript || []).join("\n"));
}