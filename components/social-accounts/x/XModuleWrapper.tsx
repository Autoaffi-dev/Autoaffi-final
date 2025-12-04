"use client";

import XOverview from "./XOverview";
import XGrowth from "./XGrowth";
import XBestTimes from "./XBestTimes";
import XSEOHighlights from "./XSEOHighlights";
import XTrendingTopics from "./XTrendingTopics";

export default function XModuleWrapper() {
  return (
    <div className="space-y-6">
      <Section title="Account Overview">
        <XOverview />
      </Section>

      <Section title="Growth Insights">
        <XGrowth />
      </Section>

      <Section title="Best Times To Tweet">
        <XBestTimes />
      </Section>

      <Section title="SEO Highlights">
        <XSEOHighlights />
      </Section>

      <Section title="Trending Topics (AI-Fetched)">
        <XTrendingTopics />
      </Section>
    </div>
  );
}

function Section({ title, children }: any) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl">
      <h2 className="text-sm font-semibold text-slate-200 mb-3">{title}</h2>
      {children}
    </div>
  );
}