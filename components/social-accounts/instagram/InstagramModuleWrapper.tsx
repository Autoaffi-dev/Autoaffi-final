"use client";

// --- IMPORTS MATCHING YOUR EXACT FILE NAMES ---

import InstagramStats from "./InstagramStats";
import FollowerGrowthIG from "./FollowerGrowthIG";
import HashtagInsights from "./HashtagInsights";
import IGHeatmap from "./IGHeatmap";
import ReelsPerformance from "./ReelsPerformance";
import TopIGPosts from "./TopIGPosts";

export default function InstagramModuleWrapper() {
  return (
    <div className="space-y-6">

      {/* Overview / Stats */}
      <InstagramStats />

      {/* Growth tracking */}
      <FollowerGrowthIG />

      {/* Hashtag Strategy */}
      <HashtagInsights />

      {/* Heatmap (best times / engagement) */}
      <IGHeatmap />

      {/* Reels analytics */}
      <ReelsPerformance />

      {/* Top posts */}
      <TopIGPosts />

    </div>
  );
}