"use client";

import { useState } from "react";

// 📌 Import all TikTok modules
import TikTokStats from "@/components/social-accounts/tiktok/TikTokStats";
import TikTokHeatmap from "@/components/social-accounts/tiktok/Heatmap";
import TikTokBestTimes from "@/components/social-accounts/tiktok/BestTimesGraph";
import TikTokTrendScore from "@/components/social-accounts/tiktok/TrendScore";
import TikTokFollowers from "@/components/social-accounts/tiktok/FollowerGrowth";
import TikTokTopPosts from "@/components/social-accounts/tiktok/TopPostsList";

type Props = {
  platform: "tiktok"; // 🔥 future ready, just add "instagram" etc later
  accounts: number;
};

export default function PlatformInsights({ platform, accounts }: Props) {
  const [open, setOpen] = useState(false);

  if (accounts === 0) return null;

  return (
    <section className="mt-8">
      {/* EXPAND BUTTON */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full rounded-xl border border-yellow-500/40 bg-slate-900/70 px-4 py-3 text-left shadow-lg hover:border-yellow-300 transition"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-yellow-300">
            View detailed insights
          </p>
          <span className="text-yellow-300 text-xs">
            {open ? "▲" : "▼"}
          </span>
        </div>

        <p className="text-[11px] text-slate-400 mt-1">
          Autoaffi analyzes your platform data to boost Smart Suggestions,
          Viral Alerts & Content Optimizer accuracy.
        </p>
      </button>

      {/* MODULES */}
      {open && (
        <div className="mt-6 space-y-6">
          {/* TikTok Stats */}
          <TikTokStats />

          {/* Heatmap */}
          <TikTokHeatmap />

          {/* Best Times to Post */}
          <TikTokBestTimes />

          {/* Trend Score */}
          <TikTokTrendScore />

          {/* Follower Growth */}
          <TikTokFollowers />

          {/* Top Performing Posts */}
          <TikTokTopPosts />
        </div>
      )}
    </section>
  );
}