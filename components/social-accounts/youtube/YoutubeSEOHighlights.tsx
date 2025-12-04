import type { FC } from "react";

const mockSEO = {
  avgClickThrough: "5.8%",
  ctrChange: "+1.2%",
  avgWatchTime: "2:47",
  watchTimeChange: "+9%",
  bestKeyword: "ai side hustles",
  keywordDifficulty: "Low · High search volume",
  recommendedKeyword: "automation tools for beginners",
  thumbnailScore: 82,
};

const YouTubeSEOHighlights: FC = () => {
  const {
    avgClickThrough,
    ctrChange,
    avgWatchTime,
    watchTimeChange,
    bestKeyword,
    keywordDifficulty,
    recommendedKeyword,
    thumbnailScore,
  } = mockSEO;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 md:p-5 shadow-[0_18px_50px_rgba(0,0,0,0.7)]">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-red-300 mb-4">
        SEO & retention highlights
      </h2>

      {/* GRID */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* CTR */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-[11px] text-slate-500 mb-1">
            Avg. Click-Through Rate
          </p>
          <p className="text-xl font-semibold text-slate-50">
            {avgClickThrough}
          </p>
          <p className="text-[11px] text-emerald-400 mt-1">{ctrChange}</p>
          <p className="text-[10px] text-slate-500 mt-2">
            CTR improves with stronger thumbnails + optimized titles.
          </p>
        </div>

        {/* Watch time */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-[11px] text-slate-500 mb-1">Avg. Watch Time</p>
          <p className="text-xl font-semibold text-slate-50">
            {avgWatchTime}
          </p>
          <p className="text-[11px] text-emerald-400 mt-1">{watchTimeChange}</p>
          <p className="text-[10px] text-slate-500 mt-2">
            Longer retention boosts ranking more than anything else.
          </p>
        </div>

        {/* Keyword performance */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-[11px] text-slate-500 mb-1">Top keyword</p>
          <p className="text-sm font-semibold text-yellow-300">
            {bestKeyword}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {keywordDifficulty}
          </p>

          <div className="mt-3">
            <p className="text-[10px] text-slate-500">Suggested new target:</p>
            <p className="text-xs font-semibold text-emerald-300 mt-1">
              {recommendedKeyword}
            </p>
          </div>
        </div>

        {/* Thumbnail score */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-[11px] text-slate-500 mb-1">Thumbnail Score</p>
          <p className="text-xl font-semibold text-slate-50">
            {thumbnailScore}/100
          </p>
          <p className="text-[10px] text-slate-500 mt-2">
            Based on clarity, emotion, contrast & click-intent.
          </p>
        </div>
      </div>

      {/* FOOTER */}
      <div className="mt-4 text-[11px] text-slate-500">
        When connected, Autoaffi analyzes your real uploads to improve SEO
        recommendations inside Content Optimizer.
      </div>
    </section>
  );
};

export default YouTubeSEOHighlights;