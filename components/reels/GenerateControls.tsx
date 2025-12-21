"use client";

import React from "react";

interface Props {
  handleGenerate: () => void;
  isGenerating: boolean;
  error: string;

  genre: string;
  setGenre: (v: string) => void;

  tone: string;
  setTone: (v: string) => void;

  storyFormat: string;
  setStoryFormat: (v: string) => void;

  videoLength: number;
  setVideoLength: (v: number) => void;

  mode: "auto" | "manual" | "guided";
  mediaType: "mixed" | "video" | "stills";
}

export default function GenerateControls({
  genre,
  setGenre,
  tone,
  setTone,
  isGenerating,
  handleGenerate,
  error,
}: Props) {
  return (
    <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      {/* HEADER */}
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400 mb-4">
        Generation settings
      </p>

      {/* GENRE + TONE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-xs">

        {/* GENRE */}
        <div>
          <label className="block mb-1 text-[11px] text-slate-300">
            Genre
          </label>
          <select
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="w-full rounded-xl bg-slate-950/70 border border-slate-700 px-3 py-2 text-xs text-slate-200"
          >
            <option value="Motivation">Motivation</option>
            <option value="Education">Education</option>
            <option value="Lifestyle">Lifestyle</option>
            <option value="Business">Business</option>
            <option value="Review">Review</option>
            <option value="Tutorial">Tutorial</option>
          </select>
        </div>

        {/* TONE */}
        <div>
          <label className="block mb-1 text-[11px] text-slate-300">
            Tone
          </label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="w-full rounded-xl bg-slate-950/70 border border-slate-700 px-3 py-2 text-xs text-slate-200"
          >
            <option value="Cinematic">Cinematic</option>
            <option value="Casual">Casual</option>
            <option value="High-energy">High-energy</option>
            <option value="Soft">Soft</option>
            <option value="Professional">Professional</option>
          </select>
        </div>

      </div>

      {/* GENERATE BUTTON */}
      <div className="flex justify-start">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
          className={`rounded-xl px-5 py-2 text-xs font-semibold transition
            ${
              isGenerating
                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-500 text-white"
            }
          `}
        >
          {isGenerating ? "Generating…" : "Generate Reel Structure"}
        </button>
      </div>

      {/* ERROR DISPLAY */}
      {error && (
        <div className="mt-4 rounded-xl border border-red-500/60 bg-red-500/10 px-4 py-3 text-[11px] text-red-200">
          {error}
        </div>
      )}
    </section>
  );
}