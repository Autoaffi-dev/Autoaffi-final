"use client";

export default function XTrendingTopics() {
  const trends = ["AI Tools", "Side Hustles", "Content Automation", "YouTube Shorts"];

  return (
    <div className="text-sm text-slate-300">
      <p className="text-[11px] text-slate-500 mb-3">Hot now (sample)</p>

      <div className="flex flex-wrap gap-2">
        {trends.map((t) => (
          <span
            key={t}
            className="rounded-full bg-yellow-400/10 border border-yellow-400/40 text-yellow-300 px-3 py-1 text-xs"
          >
            #{t}
          </span>
        ))}
      </div>
    </div>
  );
}