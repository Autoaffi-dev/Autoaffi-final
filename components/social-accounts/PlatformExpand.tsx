"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";

import TikTokStats from "@/components/social-accounts/tiktok/TikTokStats";
import TikTokHeatmap from "@/components/social-accounts/tiktok/Heatmap";
import BestTimeToPost from "@/components/social-accounts/tiktok/BestTimesGraph";
import TrendScore from "@/components/social-accounts/tiktok/TrendScore";
import FollowersInsight from "@/components/social-accounts/tiktok/FollowerGrowth";
import TopPosts from "@/components/social-accounts/tiktok/TopPostsList";

// Future modules → automatically added
// import InstagramStats ...
// import YouTubeStats ...
// import FacebookStats ...

type Platform =
  | "tiktok"
  | "instagram"
  | "facebook"
  | "youtube"
  | "x"
  | "linkedin";

export default function PlatformExpand({
  platform,
  onBack,
}: {
  platform: Platform;
  onBack: () => void;
}) {
  const [activeTab, setActiveTab] = useState("overview");

  // PLATFORM LABELS
  const LABELS: Record<Platform, string> = {
    tiktok: "TikTok",
    instagram: "Instagram",
    facebook: "Facebook",
    youtube: "YouTube",
    x: "X (Twitter)",
    linkedin: "LinkedIn",
  };

  // MODULES PER PLATFORM
  const MODULES: Record<string, any[]> = {
    tiktok: [
      { label: "Account Stats", component: <TikTokStats /> },
      { label: "Best Times", component: <BestTimeToPost /> },
      { label: "Heatmap", component: <TikTokHeatmap /> },
      { label: "Growth", component: <FollowersInsight /> },
      { label: "Top Posts", component: <TopPosts /> },
      { label: "Trend Score", component: <TrendScore /> },
    ],

    instagram: [
      { label: "Coming soon", component: <div>Instagram analytics coming soon…</div> },
    ],

    facebook: [
      { label: "Coming soon", component: <div>Facebook analytics coming soon…</div> },
    ],

    youtube: [
      { label: "Coming soon", component: <div>YouTube analytics coming soon…</div> },
    ],

    x: [
      { label: "Coming soon", component: <div>X analytics coming soon…</div> },
    ],

    linkedin: [
      { label: "Coming soon", component: <div>LinkedIn analytics coming soon…</div> },
    ],
  };

  const modulesToRender = MODULES[platform];

  return (
    <section className="rounded-2xl border border-yellow-500/30 bg-slate-900/80 p-5 shadow-2xl">

      {/* HEADER */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-yellow-300 mb-5"
      >
        <ChevronLeft size={16} />
        Back to platforms
      </button>

      <h2 className="text-2xl font-extrabold mb-2 bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">
        {LABELS[platform]} Insights
      </h2>

      <p className="text-slate-400 text-sm mb-6">
        Autoaffi analyzes your content performance and helps you post smarter.
      </p>

      {/* TABS */}
      <div className="flex gap-3 overflow-x-auto pb-2 mb-6">
        {modulesToRender.map((m, index) => (
          <button
            key={index}
            onClick={() => setActiveTab(m.label)}
            className={`px-4 py-2 rounded-full text-xs font-semibold border transition whitespace-nowrap ${
              activeTab === m.label
                ? "bg-yellow-500 text-slate-900 border-yellow-500"
                : "border-slate-700 text-slate-300 hover:border-yellow-400 hover:text-yellow-300"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 shadow-inner">
        {modulesToRender.find((m) => m.label === activeTab)?.component}
      </div>
    </section>
  );
}