"use client";

export default function FacebookStats() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 shadow-lg text-slate-200">
      <h3 className="text-sm font-semibold mb-3 text-yellow-300 tracking-wide">
        Facebook Overview
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800">
          <p className="text-xs text-slate-400">Page Reach</p>
          <p className="text-xl font-bold text-yellow-300">—</p>
        </div>

        <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800">
          <p className="text-xs text-slate-400">Engagement</p>
          <p className="text-xl font-bold text-yellow-300">—</p>
        </div>

        <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800">
          <p className="text-xs text-slate-400">New Followers</p>
          <p className="text-xl font-bold text-yellow-300">—</p>
        </div>

        <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800">
          <p className="text-xs text-slate-400">Video Views</p>
          <p className="text-xl font-bold text-yellow-300">—</p>
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Autoaffi will fill this data instantly after your Facebook account is connected.
      </p>
    </div>
  );
}