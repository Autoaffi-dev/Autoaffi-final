"use client";

import YoutubeSearchInsights from "./YoutubeSearchInsights";
import YoutubeGrowthLevers from "./YoutubeGrowthLevers";
import YoutubeChannelOverview from "./YoutubeOverview";
import YoutubeBestTimes from "./YoutubeBestTimes";

export default function YoutubeModuleWrapper() {
  return (
    <div className="mt-4 space-y-6">

      {/* CHANNEL OVERVIEW */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-red-400 mb-3">
          Channel Overview
        </h3>
        <YoutubeChannelOverview />
      </div>

      {/* SEARCH INSIGHTS */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-red-400 mb-3">
          Search Insights
        </h3>
        <YoutubeSearchInsights />
      </div>

      {/* GROWTH LEVERS */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-red-400 mb-3">
          Growth Levers
        </h3>
        <YoutubeGrowthLevers />
      </div>

      {/* BEST TIMES */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-red-400 mb-3">
          Best Times to Publish
        </h3>
        <YoutubeBestTimes />
      </div>

    </div>
  );
}