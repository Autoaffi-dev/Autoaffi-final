import type { FC } from "react";

const mockStats = {
  channelName: "Your YouTube Channel",
  subscribers: 3240,
  subsChange: "+12% vs last 28 days",
  views28d: 48210,
  viewsChange: "+18% vs last 28 days",
  estRpmMin: 2.5,
  estRpmMax: 7.8,
  estEarningsRange: "$120 – $375",
  uploads28d: 16,
  bestVideoTitle: "How I Started With AI Side Hustles (Beginner Friendly)",
  bestVideoViews: 12450,
  bestVideoCta: "Perfect to drive traffic to your main offer or funnel.",
};

const YouTubeOverview: FC = () => {
  const {
    channelName,
    subscribers,
    subsChange,
    views28d,
    viewsChange,
    estRpmMin,
    estRpmMax,
    estEarningsRange,
    uploads28d,
    bestVideoTitle,
    bestVideoViews,
    bestVideoCta,
  } = mockStats;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 md:p-5 shadow-[0_18px_50px_rgba(0,0,0,0.7)]">
      {/* HEADER */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 mb-1">
            YouTube overview
          </p>
          <h2 className="text-sm font-semibold text-slate-50">
            {channelName || "Connect your YouTube channel"}
          </h2>
        </div>

        <span className="inline-flex items-center gap-1 rounded-full border border-red-500/70 bg-red-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-red-300">
          <span className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(248,113,113,0.9)]" />
          YouTube Creator View
        </span>
      </div>

      {/* KPI GRID */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        {/* Subscribers */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
          <p className="text-[11px] text-slate-500 mb-1">Subscribers</p>
          <p className="text-lg font-semibold text-slate-50">
            {subscribers.toLocaleString()}
          </p>
          <p className="text-[11px] text-emerald-400 mt-1">{subsChange}</p>
        </div>

        {/* Views 28d */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
          <p className="text-[11px] text-slate-500 mb-1">Views (last 28 days)</p>
          <p className="text-lg font-semibold text-slate-50">
            {views28d.toLocaleString()}
          </p>
          <p className="text-[11px] text-emerald-400 mt-1">{viewsChange}</p>
        </div>

        {/* RPM range */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
          <p className="text-[11px] text-slate-500 mb-1">Est. RPM range</p>
          <p className="text-lg font-semibold text-slate-50">
            ${estRpmMin.toFixed(1)} – ${estRpmMax.toFixed(1)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            For educational purposes – final RPM depends on your niche.
          </p>
        </div>

        {/* Earnings range */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
          <p className="text-[11px] text-slate-500 mb-1">
            Est. earnings from last 28 days
          </p>
          <p className="text-lg font-semibold text-yellow-300">
            {estEarningsRange}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Estimate only – your real revenue comes from offers & funnels.
          </p>
        </div>
      </div>

      {/* ACTIVITY + BEST CONTENT */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Activity */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
          <p className="text-[11px] text-slate-500 mb-2 uppercase tracking-[0.18em]">
            Activity & consistency
          </p>
          <p className="text-sm text-slate-200 mb-2">
            <span className="font-semibold text-yellow-300">
              {uploads28d} uploads
            </span>{" "}
            in the last 28 days.
          </p>
          <p className="text-[11px] text-slate-400">
            Autoaffi uses this to improve your{" "}
            <span className="font-semibold">My Progress</span>,{" "}
            <span className="font-semibold">Content Optimizer</span> and future{" "}
            <span className="font-semibold">Elite engines</span>.
          </p>
        </div>

        {/* Best video */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
          <p className="text-[11px] text-slate-500 mb-2 uppercase tracking-[0.18em]">
            Best performer (last 28 days)
          </p>
          <p className="text-xs font-semibold text-slate-100 mb-1">
            {bestVideoTitle}
          </p>
          <p className="text-[11px] text-slate-400 mb-2">
            {bestVideoViews.toLocaleString()} views · Strong hook & watch time
          </p>
          <p className="text-[11px] text-yellow-300">{bestVideoCta}</p>
        </div>
      </div>

      {/* FOOTER HINT */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] text-slate-500">
          These numbers are mock data for now. When you connect your channel,
          Autoaffi will use real analytics to guide your content & offers.
        </p>
        <span className="inline-flex items-center justify-end gap-1 text-[11px] text-slate-400">
          Next: use this with{" "}
          <span className="font-semibold text-yellow-300">
            Content Optimizer
          </span>
          .
        </span>
      </div>
    </section>
  );
};

export default YouTubeOverview;