"use client";

export default function FacebookHeatmap() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 shadow-lg text-slate-200">
      <h3 className="text-sm font-semibold mb-3 text-yellow-300 tracking-wide">
        Engagement Heatmap (Facebook)
      </h3>

      {/* Heatmap placeholder */}
      <div className="h-48 rounded-xl border border-slate-800 bg-slate-900/70 flex items-center justify-center text-slate-500 text-xs">
        Heatmap Loads After Connection
      </div>

      {/* Highlights */}
      <div className="mt-5">
        <p className="text-xs font-semibold text-yellow-300 mb-2">
          What this reveals
        </p>

        <ul className="text-[11px] text-slate-400 space-y-1 leading-relaxed">
          <li>• Hours when your followers interact the most</li>
          <li>• How engagement shifts weekday vs weekend</li>
          <li>• Posting windows that attract new Page followers</li>
        </ul>
      </div>

      {/* Tip Box */}
      <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/80 p-3">
        <p className="text-xs text-slate-400">
          After connecting your Facebook Page, Autoaffi analyzes your{" "}
          <span className="text-yellow-300 font-semibold">average hourly reach</span>
          so you know exactly when posts get the highest chance of spreading.
        </p>
      </div>
    </div>
  );
}