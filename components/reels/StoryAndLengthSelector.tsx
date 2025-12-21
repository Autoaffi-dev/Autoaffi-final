"use client";
import React from "react";

interface Props {
  storyFormat: string;
  setStoryFormat: (v: string) => void;

  videoLength: number;
  setVideoLength: (v: number) => void;
}

export default function StoryAndLengthSelector({
  storyFormat,
  setStoryFormat,
  videoLength,
  setVideoLength,
}: Props) {
  return (
    <section className="mb-6 rounded-2xl border border-slate-700/70 bg-slate-900/70 p-5">
      {/* TITLE */}
      <h2 className="text-sm font-semibold text-emerald-200 mb-3">
        Story Format & Video Length
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* STORY FORMAT */}
        <div>
          <label className="text-xs font-semibold text-slate-300 mb-1 block">
            Story Format
          </label>
          <select
            value={storyFormat}
            onChange={(e) => setStoryFormat(e.target.value)}
            className="w-full rounded-lg bg-slate-800 border border-slate-700 text-xs px-3 py-2 text-slate-200"
          >
            <option>Hook → Value → CTA</option>
            <option>Problem → Solution</option>
            <option>3 Rapid Tips</option>

            {/* NEW PREMIUM FORMATS */}
            <option>Hook → Value → Value → CTA</option>
            <option>5 Mistakes Format</option>
            <option>Before / After Transformation</option>
            <option>Hard Truth Format</option>
            <option>Mini Vlog + CTA</option>
            <option>Tutorial (3 steps)</option>
            <option>Listicle (Top 3)</option>
            <option>Motivation Quote + CTA</option>
            <option>High-ticket persuasion arc</option>
            <option>Funnel-focused storytelling</option>
          </select>
        </div>

        {/* VIDEO LENGTH */}
        <div>
          <label className="text-xs font-semibold text-slate-300 mb-1 block">
            Video Length (seconds)
          </label>

          <select
            value={videoLength}
            onChange={(e) => setVideoLength(Number(e.target.value))}
            className="w-full rounded-lg bg-slate-800 border border-slate-700 text-xs px-3 py-2 text-slate-200"
          >
            {/* REMOVED: 15 seconds */}
            <option value={30}>30 seconds</option>
            <option value={45}>45 seconds</option>
            <option value={60}>60 seconds</option>
          </select>
        </div>
      </div>
    </section>
  );
}