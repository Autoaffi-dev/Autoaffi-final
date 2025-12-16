"use client";

import React, { useMemo } from "react";

interface SEOEngineProps {
  content: string;
  manualLink?: string;

  /** OPTIONAL – om ExactFixEngine ger ett eget score (1–10) */
  exactScoreOverride?: number;

  /** OPTIONAL – om ExactFixEngine ger egna “how to reach 10/10”-tips */
  exactSuggestionsOverride?: string[];
}

interface ScoreStats {
  postScore: number;
  hookScore: number;
  seoScore: number;
  engagementScore: number;
  clarityScore: number;
  suggestedKeywords: string[];
  highVolumeTags: string[];
  mediumVolumeTags: string[];
  lowVolumeTags: string[];
  improvementTips: string[];
}

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "to",
  "for",
  "of",
  "in",
  "on",
  "with",
  "this",
  "that",
  "is",
  "are",
  "am",
  "i",
  "you",
  "we",
  "they",
  "it",
  "at",
  "as",
  "be",
  "by",
  "from",
]);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// ---------- SMALL UI HELPERS ----------

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[11px]">
      <span className="text-slate-300">{label}</span>
      <div className="flex items-center gap-2 flex-1">
        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800/80">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500"
            style={{ width: `${clamp(value, 0, 100)}%` }}
          />
        </div>
        <span className="w-8 text-right text-slate-400">{value}</span>
      </div>
    </div>
  );
}

interface VolumeSectionProps {
  title: string;
  description: string;
  tags: string[];
}

function VolumeSection({ title, description, tags }: VolumeSectionProps) {
  return (
    <div className="rounded-2xl border border-slate-800/90 bg-slate-900/70 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-300 mb-1">
        {title}
      </p>
      <p className="text-[10px] text-slate-400 mb-2">{description}</p>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950 px-2.5 py-0.5 text-[10px] text-slate-100"
          >
            #{tag}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------- CORE ANALYSIS LOGIC ----------

function analyseContent(content: string, manualLink?: string): ScoreStats {
  const normalized = (content || "").toLowerCase();
  const words = normalized
    .replace(/[^a-z0-9\s]/gi, " ")
    .split(/\s+/)
    .filter(Boolean);

  const wordCount = words.length;
  const hasQuestion = normalized.includes("?");
  const hasYou = /\byou\b/.test(normalized);
  const hasHashtags = /#\w+/.test(normalized);
  const hasNumbers = /\d+/.test(normalized);
  const hasCTA = /(link in bio|dm me|comment|save this|share this)/i.test(
    content || ""
  );

  const hookScore = clamp(
    50 +
      (hasQuestion ? 15 : 0) +
      (hasYou ? 10 : 0) +
      (hasNumbers ? 10 : 0),
    40,
    95
  );
  const seoScore = clamp(
    45 +
      (hasHashtags ? 15 : 0) +
      (wordCount >= 60 ? 10 : 0) +
      (manualLink ? 10 : 0),
    40,
    90
  );
  const engagementScore = clamp(
    50 + (hasCTA ? 15 : 0) + (hasQuestion ? 10 : 0),
    45,
    95
  );
  const clarityScore = clamp(
    45 + (wordCount > 20 && wordCount < 260 ? 15 : 0),
    40,
    90
  );

  const rawPostScore =
    (hookScore + seoScore + engagementScore + clarityScore) / 4;
  const postScore = clamp(Math.round(rawPostScore / 10), 1, 10);

  // Extract simple keywords from content
  const keywordCandidates = Array.from(
    new Set(
      words.filter(
        (w) =>
          w.length > 3 &&
          !STOP_WORDS.has(w) &&
          !w.startsWith("http") &&
          !w.startsWith("www")
      )
    )
  );

  const suggestedKeywords =
    keywordCandidates.slice(0, 6).length > 0
      ? keywordCandidates.slice(0, 6)
      : ["content", "strategy", "audience", "growth"];

  const highVolumeTags =
    keywordCandidates.slice(0, 4).length > 0
      ? keywordCandidates.slice(0, 4)
      : ["content", "marketing", "socialmedia", "digitalmarketing"];

  const mediumVolumeTags =
    keywordCandidates.slice(4, 8).length > 0
      ? keywordCandidates.slice(4, 8)
      : [
          "nichemarketing",
          "audiencegrowth",
          "shortformvideo",
          "contentstrategy",
        ];

  const lowVolumeTags =
    keywordCandidates.slice(8, 12).length > 0
      ? keywordCandidates.slice(8, 12)
      : ["uniquevoice", "engagementtips", "trendanalyis", "contentniche"];

  const improvementTips: string[] = [];

  if (!hasQuestion) {
    improvementTips.push("Add a question in your hook to invite comments.");
  }
  if (!hasCTA) {
    improvementTips.push("Add a clear call-to-action at the end of the post.");
  }
  if (!hasHashtags) {
    improvementTips.push("Add at least 3–5 hashtags to help discovery.");
  }
  if (wordCount < 40) {
    improvementTips.push("Add 1–2 more sentences to give extra context.");
  }
  if (wordCount > 260) {
    improvementTips.push(
      "Shorten the body so the main idea is easier to scan."
    );
  }

  if (improvementTips.length === 0) {
    improvementTips.push(
      "You’re already close to 10/10 — keep this structure for future posts."
    );
  }

  return {
    postScore,
    hookScore,
    seoScore,
    engagementScore,
    clarityScore,
    suggestedKeywords,
    highVolumeTags,
    mediumVolumeTags,
    lowVolumeTags,
    improvementTips,
  };
}

// ---------- MAIN COMPONENT ----------

export default function SEOEngine({
  content,
  manualLink,
  exactScoreOverride,
  exactSuggestionsOverride,
}: SEOEngineProps) {
  const stats = useMemo(
    () => analyseContent(content || "", manualLink),
    [content, manualLink]
  );

  const {
    postScore,
    hookScore,
    seoScore,
    engagementScore,
    clarityScore,
    suggestedKeywords,
    highVolumeTags,
    mediumVolumeTags,
    lowVolumeTags,
    improvementTips,
  } = stats;

  // Om ExactFixEngine har gett ett eget score / egna tips → använd dem
  const finalPostScore =
    typeof exactScoreOverride === "number"
      ? clamp(Math.round(exactScoreOverride), 1, 10)
      : postScore;

  const finalImprovementTips =
    exactSuggestionsOverride && exactSuggestionsOverride.length > 0
      ? exactSuggestionsOverride
      : improvementTips;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 text-[11px] text-slate-200 shadow-[0_18px_40px_rgba(0,0,0,0.8)]">
      {/* HEADER */}
      <header className="mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          SEO &amp; Social Reach
        </p>
        <p className="mt-1 text-[11px] text-slate-400">
          Uses your current hook, caption &amp; body — no extra input needed.
        </p>
      </header>

      {/* POST SCORE */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Post score (0–10)
          </p>
          <p className="text-[10px] text-slate-500">
            Rough indicator of how strong this post looks right now.
          </p>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-extrabold text-yellow-300">
            {finalPostScore}
          </span>
          <span className="text-[10px] text-slate-500">/10</span>
        </div>
      </div>

      {/* BREAKDOWN */}
      <div className="mb-4 rounded-2xl border border-slate-800/70 bg-slate-900/70 p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Breakdown (0–100)
        </p>
        <div className="space-y-1.5">
          <ScoreBar label="Hook" value={hookScore} />
          <ScoreBar label="SEO" value={seoScore} />
          <ScoreBar label="Engagement" value={engagementScore} />
          <ScoreBar label="Clarity" value={clarityScore} />
        </div>
      </div>

      {/* SUGGESTED KEYWORDS */}
      <div className="mb-3">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Suggested keywords
        </p>
        <div className="flex flex-wrap gap-1.5">
          {suggestedKeywords.map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] text-slate-100 border border-slate-700"
            >
              {kw}
            </span>
          ))}
        </div>
      </div>

      {/* VOLUME SECTIONS */}
      <div className="space-y-2.5 mb-3">
        <VolumeSection
          title="High volume"
          description="Use 1–2 of these hashtags for maximum discovery. They reach broad audiences."
          tags={highVolumeTags}
        />
        <VolumeSection
          title="Medium volume"
          description="Blend a few of these in each post. Good for ranking in your specific niche."
          tags={mediumVolumeTags}
        />
        <VolumeSection
          title="Low volume"
          description="Low competition hashtags that help you show up on more For You pages."
          tags={lowVolumeTags}
        />
      </div>

      {/* QUICK TIPS + HOW TO REACH 10/10 */}
      <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Quick optimization tips
        </p>
        <ul className="mb-2 list-disc pl-4 space-y-0.5 text-[10px] text-slate-400">
          <li>Focus on one platform per post for better results.</li>
          <li>Post every day to build consistency.</li>
          <li>Let each post solve one clear problem.</li>
        </ul>

        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          How to get closer to 10/10
        </p>
        <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-slate-400">
          {finalImprovementTips.map((tip, idx) => (
            <li key={idx}>{tip}</li>
          ))}
        </ul>

        <p className="mt-2 text-[10px] text-slate-500">
          Over time, Autoaffi will learn from your best posts and suggest hooks,
          keywords and hashtags that match what already works in your niche.
        </p>
      </div>
    </section>
  );
}