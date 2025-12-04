"use client";

export default function LinkedInIndustryInsights() {
  const insights = [
    "AI Automation trending +62% in engagement.",
    "Side Hustle & Remote Work up +41%.",
    "Video posts outperform text by +72%.",
  ];

  return (
    <div className="text-sm text-slate-300">
      <p className="text-[11px] text-slate-500 mb-3">Industry trends (sample)</p>

      <div className="flex flex-wrap gap-2">
        {insights.map((t) => (
          <span
            key={t}
            className="rounded-lg bg-yellow-400/10 border border-yellow-400/40 text-yellow-300 px-3 py-1 text-xs"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}