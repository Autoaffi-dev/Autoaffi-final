"use client";

export default function FacebookTrendScore() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 shadow-lg text-slate-200">
      <h3 className="text-sm font-semibold mb-3 text-yellow-300 tracking-wide">
        Trend Score (Facebook)
      </h3>

      <div className="flex items-center gap-4">
        {/* Score Circle */}
        <div className="h-20 w-20 rounded-full bg-slate-900 border border-yellow-500/40 flex items-center justify-center text-yellow-300 text-lg font-bold">
          82
        </div>

        <div className="text-xs text-slate-400 space-y-1">
          <p>• Based on your last 10 posts</p>
          <p>• Measures format, engagement & topic resonance</p>
          <p>• Helps you repeat what works — instantly</p>
        </div>
      </div>
    </div>
  );
}