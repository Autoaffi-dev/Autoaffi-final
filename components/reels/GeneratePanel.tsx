"use client";

import React from "react";

interface GeneratePanelProps {
  // GLOBAL STATE
  mode: "auto" | "guided" | "manual";
  setMode: (v: "auto" | "guided" | "manual") => void;

  mediaType: "mixed" | "video" | "stills";
  setMediaType: (v: "mixed" | "video" | "stills") => void;

  videoLength: number;
  setVideoLength: (v: number) => void;

  storyFormat: string;
  setStoryFormat: (v: string) => void;

  genre: string;
  setGenre: (v: string) => void;

  tone: string;
  setTone: (v: string) => void;

  offerMode: "product" | "recurring" | "funnel";
  // Panels handled in C5

  // GENERATION
  isGenerating: boolean;
  error: string | null;
  handleGenerate: () => void;
}

export default function GeneratePanel({
  mode,
  setMode,
  mediaType,
  setMediaType,
  videoLength,
  setVideoLength,
  storyFormat,
  setStoryFormat,
  genre,
  setGenre,
  tone,
  setTone,
  offerMode,
  isGenerating,
  error,
  handleGenerate,
}: GeneratePanelProps) {
  return (
    <section className="mb-8 rounded-2xl border border-emerald-400/40 bg-emerald-500/5 p-5 text-sm space-y-8">
      {/* TITLE */}
      <h2 className="text-sm font-semibold text-emerald-200">
        Create your Reel Blueprint
      </h2>

      {/* LENGTH SELECT */}
      <div>
        <label className="text-xs font-semibold text-slate-300 mb-2 block">
          Video Length
        </label>

        <div className="flex gap-2">
          {[30, 45, 60].map((len) => (
            <button
              key={len}
              onClick={() => setVideoLength(len)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition ${
                videoLength === len
                  ? "bg-emerald-600 border-emerald-400 text-slate-900 shadow-[0_0_10px_rgba(16,185,129,0.45)]"
                  : "bg-slate-950 border-slate-700 text-slate-300 hover:bg-slate-900"
              }`}
            >
              {len}s
            </button>
          ))}
        </div>
      </div>

      {/* MODE SELECT (Manual / Guided / Auto) */}
      <div>
        <label className="text-xs font-semibold text-slate-300 mb-2 block">
          Creation Mode
        </label>

        <div className="flex gap-2">
          {[
            {
              id: "manual",
              label: "Manual",
              desc: "You control uploads, pacing & storyboard",
            },
            {
              id: "guided",
              label: "Guided",
              desc: "Describe your niche — Autoaffi builds hooks & pacing",
            },
            {
              id: "auto",
              label: "Auto",
              desc: "Hands-free: Autoaffi picks everything",
            },
          ].map((opt) => (
            <div key={opt.id} className="flex flex-col items-start">
              <button
                title={opt.desc}
                onClick={() => setMode(opt.id as any)}
                className={`px-4 py-1.5 rounded-lg text-xs border transition ${
                  mode === opt.id
                    ? "bg-emerald-600 border-emerald-400 text-slate-900 shadow-[0_0_12px_rgba(16,185,129,0.55)]"
                    : "bg-slate-950 border-slate-700 text-slate-300 hover:bg-slate-900"
                }`}
              >
                {opt.label}
              </button>
              <p className="text-[10px] text-slate-400 mt-1 w-28">{opt.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* MEDIA TYPE SELECT */}
      <div>
        <label className="text-xs font-semibold text-slate-300 mb-2 block">
          Media Type
        </label>

        <div className="flex gap-2">
          {[
            {
              id: "mixed",
              label: "Mixed",
              desc: "Images + video blended",
            },
            {
              id: "video",
              label: "Only Video",
              desc: "Pure B-roll reel",
            },
            {
              id: "stills",
              label: "Only Stills",
              desc: "Cinematic images with movement",
            },
          ].map((opt) => (
            <div key={opt.id} className="flex flex-col items-start">
              <button
                title={opt.desc}
                onClick={() => setMediaType(opt.id as any)}
                className={`px-4 py-1.5 rounded-lg text-xs border transition ${
                  mediaType === opt.id
                    ? "bg-emerald-600 border-emerald-400 text-slate-900 shadow-[0_0_10px_rgba(16,185,129,0.45)]"
                    : "bg-slate-950 border-slate-700 text-slate-300 hover:bg-slate-900"
                }`}
              >
                {opt.label}
              </button>
              <p className="text-[10px] text-slate-400 mt-1 w-24">{opt.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* STORY FORMAT */}
      <div>
        <label className="text-xs font-semibold text-slate-300 mb-2 block">
          Story Format
        </label>

        <select
          value={storyFormat}
          onChange={(e) => setStoryFormat(e.target.value)}
          className="w-full rounded-lg bg-slate-900 border border-slate-700 text-xs px-3 py-2 text-slate-200"
        >
          <option>Hook → Value → CTA</option>
          <option>Problem → Solution</option>
          <option>3 Rapid Tips</option>
          <option>Hook → Value → Value → CTA</option>
          <option>5 Mistakes Format</option>
          <option>Before/After Transformation</option>
          <option>Hard Truth Format</option>
          <option>Mini Vlog + CTA</option>
          <option>Tutorial (3 steps)</option>
          <option>Listicle (Top 3)</option>
          <option>Motivation Quote + CTA</option>
          <option>High-ticket persuasion arc</option>
          <option>Funnel-focused storytelling</option>
        </select>
      </div>

      {/* GENRE */}
      <div>
        <label className="text-xs font-semibold text-slate-300 mb-2 block">
          Genre
        </label>
        <select
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          className="w-full rounded-lg bg-slate-900 border border-slate-700 text-xs px-3 py-2 text-slate-200"
        >
          <option>Cinematic</option>
          <option>Lifestyle</option>
          <option>Hustle</option>
          <option>Anime</option>
          <option>Tech</option>
          <option>Luxury</option>
          <option>Dark</option>
          <option>Minimal</option>
          <option>TikTok</option>
        </select>
      </div>

      {/* TONE */}
      <div>
        <label className="text-xs font-semibold text-slate-300 mb-2 block">
          Tone
        </label>
        <select
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          className="w-full rounded-lg bg-slate-900 border border-slate-700 text-xs px-3 py-2 text-slate-200"
        >
          <option>Friendly</option>
          <option>Bold</option>
          <option>Motivational</option>
          <option>Calm</option>
          <option>Direct</option>
        </select>
      </div>

      {/* ERROR MESSAGE */}
      {error && (
        <div className="rounded-xl border border-red-500/60 bg-red-500/10 px-4 py-3 text-xs text-red-100">
          {error}
        </div>
      )}

      {/* GENERATE BUTTON */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
          className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_12px_40px_rgba(16,185,129,0.45)] hover:bg-emerald-400 disabled:opacity-60"
        >
          {isGenerating ? "Generating Reel Timeline…" : "Generate reel blueprint"}
        </button>

        <p className="text-[11px] text-slate-500 max-w-xs md:text-right">
          You’ll get script, storyboard, subtitles, CTA, hashtags,
          caption, title, posting-time suggestions and a universal timeline.
        </p>
      </div>
    </section>
  );
}