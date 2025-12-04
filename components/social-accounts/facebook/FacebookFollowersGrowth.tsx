"use client";

export default function FacebookFollowersGrowth() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 shadow-lg text-slate-200">
      <h3 className="text-sm font-semibold mb-3 text-yellow-300 tracking-wide">
        Follower Growth (Facebook)
      </h3>

      {/* Placeholder graph */}
      <div className="h-40 rounded-xl border border-slate-800 bg-slate-900/70 flex items-center justify-center text-slate-500 text-xs">
        Growth Graph Loads After Connection
      </div>

      <div className="mt-4 text-[11px] text-slate-400 space-y-1">
        <p>• 7, 14 & 30-day follower trend overview</p>
        <p>• Detect surges from viral posts</p>
        <p>• See when your growth stalled — and why</p>
      </div>
    </div>
  );
}