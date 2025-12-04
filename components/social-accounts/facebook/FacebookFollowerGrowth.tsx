"use client";

export default function FacebookFollowerGrowth() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 shadow-lg text-slate-200">
      <h3 className="text-sm font-semibold mb-3 text-yellow-300 tracking-wide">
        Follower Growth (30 days)
      </h3>

      {/* Placeholder chart area */}
      <div className="h-40 rounded-xl border border-slate-800 bg-slate-900/70 flex items-center justify-center text-slate-500 text-xs">
        Growth Chart Loads After Connection
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-800">
          <p className="text-[11px] text-slate-400">Total Followers</p>
          <p className="text-lg font-bold text-yellow-300">—</p>
        </div>

        <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-800">
          <p className="text-[11px] text-slate-400">Growth</p>
          <p className="text-lg font-bold text-yellow-300">—</p>
        </div>

        <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-800">
          <p className="text-[11px] text-slate-400">Avg. Daily Change</p>
          <p className="text-lg font-bold text-yellow-300">—</p>
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Once connected, this module tracks followers across Pages & Profiles and
        updates daily.
      </p>
    </div>
  );
}