"use client";

import React from "react";

interface Props {
  hashtags: string[];
  titleIdeas: string[];
  captionIdeas: string[];
  bestPostingTimes: string[];

  recommendedTitle: string | null;
  recommendedCaption: string | null;
  recommendedHashtags: string[];

  setRecommendedTitle: (v: string | null) => void;
  setRecommendedCaption: (v: string | null) => void;
  setRecommendedHashtags: (v: string[]) => void;

  thumbnailIntelligence: any;
  socialHints: any;
}

export default function SocialHintsPanel({
  hashtags,
  titleIdeas,
  captionIdeas,
  bestPostingTimes,
  recommendedTitle,
  recommendedCaption,
  recommendedHashtags,
  setRecommendedTitle,
  setRecommendedCaption,
  setRecommendedHashtags,
  thumbnailIntelligence,
  socialHints,
}: Props) {
  const hasAny =
    hashtags.length > 0 ||
    titleIdeas.length > 0 ||
    captionIdeas.length > 0 ||
    bestPostingTimes.length > 0 ||
    thumbnailIntelligence;

  if (!hasAny) return null;

  return (
    <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/5 p-3 space-y-4">
      <h3 className="text-xs font-semibold text-emerald-200 mb-2">
        Smart social hints
      </h3>

      {/* ⭐ Autoaffi Recommended Social Setup */}
      <div className="rounded-xl bg-slate-900/70 border border-emerald-400/40 px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold text-emerald-300">
            ⭐ Autoaffi Recommended Social Setup
          </p>

          <button
            type="button"
            onClick={() => {
              const t = socialHints?.titleIdeas?.[0] ?? null;
              const c = socialHints?.captionIdeas?.[0] ?? null;
              const h = socialHints?.hashtags?.slice(0, 5) ?? [];

              setRecommendedTitle(t);
              setRecommendedCaption(c);
              setRecommendedHashtags(h);
            }}
            className="rounded-full bg-emerald-600/20 px-3 py-1 text-[10px] text-emerald-200 hover:bg-emerald-600/30 transition"
          >
            Apply All
          </button>
        </div>

        <p className="text-[10px] text-emerald-200/80 mt-1">
          Autoaffi picks the strongest title, caption and hashtags based on
          retention & reach.
        </p>
      </div>

      {/* 📌 Hashtags */}
      {hashtags.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-emerald-200 mb-1">
            Hashtags
          </p>

          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {hashtags.map((tag, idx) => (
              <span
                key={idx}
                className={`rounded-full px-2 py-0.5 border ${
                  recommendedHashtags.includes(tag)
                    ? "bg-emerald-500/20 border-emerald-400 text-emerald-200"
                    : "bg-slate-950/80 border-emerald-400/40 text-emerald-100"
                }`}
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 📌 Title Ideas */}
      {titleIdeas.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-emerald-200 mb-1">
            Title Ideas
          </p>

          <div className="flex flex-col gap-1.5 text-[11px]">
            {titleIdeas.map((title, idx) => (
              <div
                key={idx}
                className={`rounded-lg px-2 py-1 border transition ${
                  recommendedTitle === title
                    ? "bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-[0_0_6px_rgba(16,185,129,0.5)]"
                    : "bg-slate-950/70 border-emerald-400/40 text-slate-200"
                }`}
              >
                {title}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 📌 Captions */}
      {captionIdeas.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-emerald-200 mb-1">
            Captions
          </p>

          <div className="flex flex-col gap-1.5 text-[11px]">
            {captionIdeas.map((caption, idx) => (
              <div
                key={idx}
                className={`rounded-lg px-2 py-1 border transition ${
                  recommendedCaption === caption
                    ? "bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-[0_0_6px_rgba(16,185,129,0.5)]"
                    : "bg-slate-950/70 border-emerald-400/40 text-slate-200"
                }`}
              >
                {caption}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 📌 Posting Times */}
      {bestPostingTimes.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-emerald-200 mb-1">
            Suggested posting times
          </p>
          <p className="text-[11px] text-emerald-50">
            {bestPostingTimes.join(" · ")}
          </p>
        </div>
      )}
    </div>
  );
}