"use client";

import React, { useState } from "react";

interface SubtitlesPanelProps {
  subtitles?: string[];
}

function safeCopy(text: string) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
  } catch {
    // ignore – fallback below
  }

  return new Promise<void>((resolve) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch {
      // ignore
    }
    document.body.removeChild(ta);
    resolve();
  });
}

export default function SubtitlesPanel({ subtitles }: SubtitlesPanelProps) {
  const [copied, setCopied] = useState(false);

  const lines =
    Array.isArray(subtitles) && subtitles.length > 0
      ? subtitles
      : [
          "Generated subtitles will appear here once you create a reel.",
          "Each line is ready for CapCut / Premiere / Shorts editors.",
        ];

  const handleCopy = async () => {
    const text = lines.join("\n");
    await safeCopy(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section className="mt-6 rounded-2xl border border-emerald-400/40 bg-slate-950/80 p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-emerald-300">
            Subtitles
          </h3>
          <p className="text-xs text-slate-400">
            Clean, line-by-line subtitles ready to paste into your editor or
            caption tool.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-medium transition
            ${
              copied
                ? "border-emerald-400 bg-emerald-500/90 text-slate-900"
                : "border-emerald-400/70 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-400/25"
            }`}
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>

      {/* Subtitle list */}
      <div className="max-h-60 overflow-y-auto space-y-1.5">
        {lines.map((line, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-100"
          >
            {line}
          </div>
        ))}
      </div>
    </section>
  );
}