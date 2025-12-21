"use client";

import React from "react";

interface Props {
  result: any;
  videoLength: number;
}

export default function TimelinePreview({ result, videoLength }: Props) {
  if (!result?.storyboard || result.storyboard.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 mb-2">
        Timeline Preview
      </h3>

      <div className="space-y-3">
        {result.storyboard.map((frame: any, idx: number) => (
          <div
            key={idx}
            className="rounded-lg bg-slate-950/60 border border-slate-800 p-3 text-[11px]"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-300">Scene {idx + 1}</span>
              <span className="text-emerald-300">
                {frame.time}s / {videoLength}s
              </span>
            </div>

            <p className="text-slate-400 whitespace-pre-line leading-relaxed">
              {frame.description}
            </p>

            {frame.visualCue && (
              <p className="mt-1 text-[10px] text-amber-300">
                Visual cue: {frame.visualCue}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}