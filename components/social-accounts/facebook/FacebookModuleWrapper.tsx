"use client";

import FacebookStats from "@/components/social-accounts/facebook/FacebookStats";
import FacebookHeatmap from "@/components/social-accounts/facebook/FacebookHeatmap";
import FacebookBestTimes from "@/components/social-accounts/facebook/FacebookBestTimes";
import FacebookTopPosts from "@/components/social-accounts/facebook/FacebookTopPosts";

export default function FacebookModuleWrapper() {
  return (
    <div className="space-y-8 mt-8">
      <FacebookStats />

      <div className="grid md:grid-cols-2 gap-6">
        <FacebookHeatmap />
        <FacebookBestTimes />
      </div>

      <FacebookTopPosts />
    </div>
  );
}