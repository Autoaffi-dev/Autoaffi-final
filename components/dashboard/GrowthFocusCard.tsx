"use client";

import { useState, useEffect } from "react";
import { ArrowUpRight, ArrowDownRight, Sparkles, RefreshCcw } from "lucide-react";

export default function GrowthFocusCard() {
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState("Just now");

  // Fake growth data (blir riktig när vi kopplar API)
  const [growth, setGrowth] = useState({
    tiktok: { change: +12, trend: "up" },
    instagram: { change: -3, trend: "down" },
    facebook: { change: +5, trend: "up" },
    youtube: { change: +1, trend: "up" },
  });

  const totalChange = Object.values(growth).reduce((acc, v) => acc + v.change, 0);

  function handleSync() {
    setSyncing(true);

    setTimeout(() => {
      setLastSynced("Just now");
      setSyncing(false);
    }, 1200);
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-[0_18px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
            Today’s Growth Focus
          </p>
          <h2 className="text-xl font-extrabold mt-1">
            <span className="bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">
              Your daily signals
            </span>
          </h2>
        </div>

        <button
          onClick={handleSync}
          disabled={syncing}
          className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
            syncing
              ? "border-slate-700 text-slate-600 cursor-not-allowed"
              : "border-yellow-500/50 text-yellow-300 hover:border-yellow-400 hover:text-yellow-200"
          }`}
        >
          <RefreshCcw size={14} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Syncing…" : "Sync Analytics"}
        </button>
      </div>

      {/* TOTAL */}
      <div className="mb-6">
        <p className="text-xs text-slate-400 mb-1">Total engagement shift</p>
        <div className="flex items-end gap-2">
          <p
            className={`text-3xl font-bold ${
              totalChange >= 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            {totalChange >= 0 ? "+" : ""}
            {totalChange}%
          </p>
          {totalChange >= 0 ? (
            <ArrowUpRight className="text-green-400" size={18} />
          ) : (
            <ArrowDownRight className="text-red-400" size={18} />
          )}
        </div>
        <p className="text-[11px] text-slate-500">Since yesterday</p>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {Object.entries(growth).map(([platform, data]) => (
          <div
            key={platform}
            className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"
          >
            <p className="text-xs mb-1 capitalize text-slate-400">{platform}</p>

            <div className="flex items-center gap-2">
              <span
                className={`text-lg font-bold ${
                  data.trend === "up" ? "text-green-400" : "text-red-400"
                }`}
              >
                {data.change >= 0 ? "+" : ""}
                {data.change}%
              </span>

              {data.trend === "up" ? (
                <ArrowUpRight className="text-green-400" size={16} />
              ) : (
                <ArrowDownRight className="text-red-400" size={16} />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* DAILY TASK */}
      <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 flex gap-3">
        <Sparkles className="text-yellow-400 mt-0.5" size={18} />
        <div>
          <p className="text-xs font-semibold text-yellow-300 mb-1 uppercase tracking-[0.18em]">
            Today’s recommended action
          </p>
          <p className="text-sm text-slate-200">
            Strongest momentum on{" "}
            <span className="text-yellow-300 font-semibold">TikTok</span>. 
            Post 1 new video today to maximize visibility.
          </p>
        </div>
      </div>

      {/* FOOTER */}
      <p className="text-[11px] text-slate-600 mt-4">
        Last synced: {lastSynced}
      </p>
    </div>
  );
}