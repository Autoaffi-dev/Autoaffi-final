"use client";

import LinkedInOverview from "./LinkedInOverview";
import LinkedInGrowth from "./LinkedInGrowth";
import LinkedInBestTimes from "./LinkedInBestTimes";
import LinkedInSEOHighlights from "./LinkedInSEOHighlights";
import LinkedInIndustryInsights from "./LinkedInIndustryInsights";

export default function LinkedInModuleWrapper() {
  return (
    <div className="space-y-6">
      <Section title="Account Overview">
        <LinkedInOverview />
      </Section>

      <Section title="Growth Insights">
        <LinkedInGrowth />
      </Section>

      <Section title="Best Times To Post">
        <LinkedInBestTimes />
      </Section>

      <Section title="SEO Highlights">
        <LinkedInSEOHighlights />
      </Section>

      <Section title="Industry Insights (AI-Fetched)">
        <LinkedInIndustryInsights />
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