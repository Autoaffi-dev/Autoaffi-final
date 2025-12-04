"use client";

import TikTokStats from "./TikTokStats";
import TikTokHeatmap from "./Heatmap";
import BestTimesGraph from "./BestTimesGraph";
import TrendScore from "./TrendScore";
import FollowerGrowth from "./FollowerGrowth";
import TopPostsList from "./TopPostsList";

export default function TikTokModuleWrapper() {
  return (
    <div className="space-y-6">
      {/* Overview KPI */}
      <TikTokStats />

      {/* Best Times */}
      <BestTimesGraph />

      {/* Heatmap */}
      <TikTokHeatmap />

      {/* Trend Score */}
      <TrendScore />

      {/* Follower Growth */}
      <FollowerGrowth />

      {/* Top Posts */}
      <TopPostsList />
    </div>
  );
}