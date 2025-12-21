"use client";

import React from "react";

interface Props {
  result: any; // exakt vad page.tsx ger
}

export default function ThumbnailIntelligencePanel({ result }: Props) {
  if (!result?.thumbnailIntelligence) return null;

  const t = result.thumbnailIntelligence;

  return (
    <section className="rounded-2xl border border-emerald-400/40 bg-emerald-500/5 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-emerald-200">
        Thumbnail Intelligence
      </h3>

      <p className="text-[11px] text-slate-400">
        Copy this prompt into ChatGPT or your AI generator to produce a high-CTR thumbnail.
      </p>

      {/* PROMPT */}
      <div className="rounded-xl bg-slate-950/60 border border-emerald-400/40 p-3 text-[11px] whitespace-pre-line text-emerald-200">
        {t.finalPrompt}
      </div>

      {/* META */}
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
          <p className="text-emerald-300 font-semibold">Emotion</p>
          <p className="text-slate-400">{t.emotion}</p>
        </div>
        <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
          <p className="text-emerald-300 font-semibold">Focal Point</p>
          <p className="text-slate-400">{t.focalPoint}</p>
        </div>
      </div>

      {t.colorPalette && (
        <div>
          <p className="text-[10px] text-slate-400 mb-1">
            Suggested color palette:
          </p>
          <div className="flex gap-2">
            {t.colorPalette.map((col: string, i: number) => (
              <div
                key={i}
                className="h-5 w-5 rounded-full border border-slate-700"
                style={{ backgroundColor: col }}
              />
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => navigator.clipboard.writeText(t.finalPrompt || "")}
        className="w-full py-2.5 rounded-xl bg-emerald-600 text-slate-950 font-semibold text-xs hover:bg-emerald-500 transition"
      >
        Copy Prompt
      </button>
    </section>
  );
}