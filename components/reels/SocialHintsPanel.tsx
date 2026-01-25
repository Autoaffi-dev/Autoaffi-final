"use client";

import React from "react";

interface SocialHintsPanelProps {
  titleIdeas: string[];
  captionIdeas: string[];
  hashtags: string[];
  bestPostingTimes: string[];

  recommendedTitle: string | null;
  setRecommendedTitle: (v: string | null) => void;

  recommendedCaption: string | null;
  setRecommendedCaption: (v: string | null) => void;

  recommendedHashtags: string[];
  setRecommendedHashtags: (v: string[]) => void;

  recommendedCTA: string | null;
  setRecommendedCTA: (v: string | null) => void;

  ctaIdeas: string[];

  // sparas för framtiden / ev. intern logik
  thumbnailIntelligence?: any;
  socialHints?: any;
}

const FALLBACK_CTA = [
  "Tap the link to unlock it now ✅",
  "Start today — your future self will thank you 🚀",
  "Want results fast? Click and try it now 👇",
];

export default function SocialHintsPanel({
  titleIdeas,
  captionIdeas,
  hashtags,
  bestPostingTimes,
  recommendedTitle,
  setRecommendedTitle,
  recommendedCaption,
  setRecommendedCaption,
  recommendedHashtags,
  setRecommendedHashtags,
  recommendedCTA,
  setRecommendedCTA,
  ctaIdeas,
}: SocialHintsPanelProps) {
  const ctas =
    (ctaIdeas && ctaIdeas.length > 0 ? ctaIdeas : FALLBACK_CTA).slice(0, 3);

  const handleApplyAll = () => {
    const title = titleIdeas?.[0] ?? null;
    const caption = captionIdeas?.[0] ?? null;
    const cta = ctas?.[0] ?? null;

    setRecommendedTitle(title);
    setRecommendedCaption(caption);
    setRecommendedCTA(cta);
    setRecommendedHashtags(hashtags ?? []);
  };

  const handleSelectTitle = (t: string) => {
    setRecommendedTitle(t);
  };

  const handleSelectCaption = (c: string) => {
    setRecommendedCaption(c);
  };

  const toggleHashtag = (tag: string) => {
    if (!tag) return;
    if (recommendedHashtags.includes(tag)) {
      setRecommendedHashtags(
        recommendedHashtags.filter((h) => h !== tag)
      );
    } else {
      setRecommendedHashtags([...recommendedHashtags, tag]);
    }
  };

  return (
    <section className="rounded-2xl border border-emerald-400/30 bg-black/40 p-6 space-y-5">
      {/* HEADER + APPLY ALL */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold text-emerald-300">
          Smart social hints + CTA
        </h2>
        <button
          onClick={handleApplyAll}
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold"
        >
          Apply All
        </button>
      </div>

      {/* TITLES */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
          Title ideas
        </p>
        <div className="space-y-2">
          {titleIdeas?.map((t, idx) => {
            const active = recommendedTitle === t;
            return (
              <button
                key={`${t}-${idx}`}
                type="button"
                onClick={() => handleSelectTitle(t)}
                className={`w-full text-left text-xs px-3 py-2 rounded-lg border transition ${
                  active
                    ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-100"
                    : "border-white/10 bg-black/30 text-slate-200 hover:border-emerald-400/40"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {/* CAPTIONS */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
          Captions
        </p>
        <div className="space-y-2">
          {captionIdeas?.map((c, idx) => {
            const active = recommendedCaption === c;
            return (
              <button
                key={`${c}-${idx}`}
                type="button"
                onClick={() => handleSelectCaption(c)}
                className={`w-full text-left text-xs px-3 py-2 rounded-lg border transition ${
                  active
                    ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-100"
                    : "border-white/10 bg-black/30 text-slate-200 hover:border-emerald-400/40"
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {/* CTA RAD – 3 ALTERNATIV UNDER CAPTIONS */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
          Call To Action (CTA)
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {ctas.map((cta, idx) => {
            const active = recommendedCTA === cta;
            return (
              <button
                key={`${cta}-${idx}`}
                type="button"
                onClick={() => setRecommendedCTA(cta)}
                className={`text-left text-xs px-3 py-3 rounded-lg border transition ${
                  active
                    ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100"
                    : "border-white/10 bg-black/30 text-slate-200 hover:border-emerald-400/40"
                }`}
              >
                {cta}
              </button>
            );
          })}
        </div>

        {recommendedCTA && (
          <p className="text-[11px] text-emerald-200">
            <span className="font-semibold">Selected CTA:</span>{" "}
            {recommendedCTA}
          </p>
        )}
      </div>

      {/* HASHTAGS */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
          Hashtags
        </p>
        <div className="flex flex-wrap gap-2">
          {hashtags?.map((tag) => {
            const active = recommendedHashtags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleHashtag(tag)}
                className={`px-3 py-1 rounded-full text-[11px] border transition ${
                  active
                    ? "bg-emerald-500/20 border-emerald-400/60 text-emerald-100"
                    : "bg-black/30 border-white/10 text-slate-200 hover:border-emerald-400/40"
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {/* BEST POSTING TIMES */}
      {bestPostingTimes && bestPostingTimes.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
            Best posting times
          </p>
          <ul className="list-disc list-inside text-[11px] text-slate-300 space-y-0.5">
            {bestPostingTimes.map((t, idx) => (
              <li key={idx}>{t}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}