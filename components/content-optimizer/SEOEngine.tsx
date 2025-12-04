"use client";

import { useMemo } from "react";
import SEOScore from "./SEOScore";
import SEOKeywordBox from "./SEOKeywordBox";
import SEOHashtagBox from "./SEOHashtagBox";
import SEOSections from "./SEOSections";
import SEOModalUpgrade from "./SEOModalUpgrade";

type Plan = "basic" | "pro" | "elite";

export type SEOEngineProps = {
  content: string;
  manualLink?: string;
  plan?: Plan;
};

export default function SEOEngine({ content, manualLink, plan = "basic" }: SEOEngineProps) {
  const trimmed = (content || "").trim();

  const keywordSuggestions = useMemo(() => {
    if (!trimmed) return [] as string[];

    const lower = trimmed.toLowerCase();
    const suggestions: string[] = [];

    if (lower.includes("ai")) suggestions.push("AI tools", "AI side hustles");
    if (lower.includes("income") || lower.includes("money")) {
      suggestions.push("affiliate income", "online income");
    }
    if (lower.includes("tiktok")) suggestions.push("TikTok growth", "short-form content");
    if (lower.includes("fitness")) suggestions.push("fitness beginners", "home workouts");

    if (suggestions.length === 0) {
      suggestions.push("affiliate marketing", "content creation", "side hustle");
    }

    return Array.from(new Set(suggestions));
  }, [trimmed]);

  const hashtagSuggestions = useMemo(() => {
    if (!trimmed) return [] as string[];

    const tags: string[] = [];

    if (trimmed.toLowerCase().includes("ai")) tags.push("#aitools", "#aicontent");
    if (trimmed.toLowerCase().includes("tiktok")) tags.push("#tiktokgrowth", "#shortform");
    if (trimmed.toLowerCase().includes("fitness")) tags.push("#fitness", "#homeworkout");
    if (trimmed.toLowerCase().includes("affiliate")) tags.push("#affiliatemarketing", "#makemoneyonline");

    if (tags.length === 0) {
      tags.push("#contentcreator", "#affiliatemarketing", "#sidehustle");
    }

    return Array.from(new Set(tags));
  }, [trimmed]);

  const hasLink = !!manualLink && manualLink.trim().length > 0;

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      {/* LEFT – SCORE + SUGGESTIONS */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 mb-2">
            SEO & social reach
          </h3>
          <p className="text-[11px] text-slate-400 mb-3">
            This doesn&apos;t replace real testing – it gives you a{" "}
            <span className="text-yellow-300 font-semibold">quick health check</span> for social platforms
            like TikTok, Instagram and YouTube.
          </p>
          <SEOScore content={trimmed} manualLink={manualLink} plan={plan} />
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-4 space-y-4">
          <SEOKeywordBox baseContent={trimmed} suggestions={keywordSuggestions} />
          <SEOHashtagBox baseContent={trimmed} suggestions={hashtagSuggestions} />
        </div>
      </div>

      {/* RIGHT – EXPLANATION + UPGRADE */}
      <div className="space-y-4">
        <SEOSections plan={plan} hasLink={hasLink} />

        {plan !== "elite" && (
          <SEOModalUpgrade currentPlan={plan} targetPlan="elite" />
        )}
      </div>
    </div>
  );
}