"use client";

type Plan = "basic" | "pro" | "elite";

export type SEOScoreProps = {
  content: string;
  manualLink?: string;
  plan: Plan;
};

export default function SEOScore({ content, manualLink, plan }: SEOScoreProps) {
  const length = content.length;
  const hasLink = !!manualLink && manualLink.trim().length > 0;
  const hasLineBreaks = content.split("\n").length > 2;
  const hasEmojis = /[\u{1F300}-\u{1FAFF}]/u.test(content);

  let score = 40;

  if (length > 80) score += 10;
  if (length > 180) score += 10;
  if (length > 280) score -= 5; // too long for many platforms

  if (hasLink) score += 10;
  if (hasLineBreaks) score += 10;
  if (hasEmojis) score += 5;

  if (plan === "pro") score += 5;
  if (plan === "elite") score += 10;

  if (score > 100) score = 100;
  if (score < 0) score = 0;

  const label =
    score >= 80 ? "Strong" : score >= 60 ? "Good" : score >= 40 ? "Okay" : "Needs work";

  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-[11px] text-slate-400 mb-1">Estimated social SEO score</p>
        <p className="text-lg font-semibold text-yellow-300">
          {score}/100{" "}
          <span className="text-[11px] text-slate-400 font-normal ml-1">
            {label}
          </span>
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          Based on length, structure, link usage and basic engagement signals.
        </p>
      </div>

      <div className="relative h-12 w-12">
        <div className="h-12 w-12 rounded-full border border-slate-700 flex items-center justify-center">
          <span className="text-xs font-semibold text-yellow-300">
            {Math.round(score)}
          </span>
        </div>
      </div>
    </div>
  );
}