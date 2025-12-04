"use client";

export default function FacebookBestTimesGraph() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 shadow-lg text-slate-200">
      <h3 className="text-sm font-semibold mb-3 text-yellow-300 tracking-wide">
        Best Times to Post (Facebook)
      </h3>

      {/* Graph placeholder */}
      <div className="h-48 rounded-xl border border-slate-800 bg-slate-900/70 flex items-center justify-center text-slate-500 text-xs">
        Engagement Graph Loads After Connection
      </div>

      {/* Peak Hours */}
      <div className="mt-5">
        <p className="text-xs font-semibold text-yellow-300 mb-2">
          Peak Engagement Hours
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-center">
            <p className="text-[11px] text-slate-400">Weekdays</p>
            <p className="font-bold text-yellow-300">—</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-center">
            <p className="text-[11px] text-slate-400">Weekends</p>
            <p className="font-bold text-yellow-300">—</p>
          </div>
        </div>
      </div>

      {/* Tip Box */}
      <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/80 p-3">
        <p className="text-xs text-slate-400 leading-relaxed">
          Once connected, Autoaffi analyzes your last <span className="text-yellow-300 font-semibold">60 days</span>
          of content and identifies posting windows where your Page receives the highest interaction.
        </p>
      </div>
    </div>
  );
}