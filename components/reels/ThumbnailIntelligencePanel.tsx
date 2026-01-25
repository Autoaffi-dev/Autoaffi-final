"use client";

import React, { useState } from "react";

interface ThumbnailIntelligence {
  finalPrompt?: string;
  emotion?: string;
  focalPoint?: string;
  colorPalette?: string[];
  ctaStyle?: string;
  hookPower?: string;
}

interface Props {
  result: any;
}

export default function ThumbnailIntelligencePanel({ result }: Props) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  const raw = result?.thumbnailIntelligence ?? {};

  // 🧠 Beast mode defaults + API-data om den finns
  const t: ThumbnailIntelligence = {
    finalPrompt:
      raw.finalPrompt ??
      [
        "insane high-CTR vertical thumbnail, 9:16, ultra sharp cinematic portrait,",
        "dramatic lighting, bold 3–5 word headline in upper third,",
        "clean dark background with subtle bokeh, rich emerald + deep navy color palette,",
        "powerful facial emotion, clear whitespace for text, no UI chrome, no watermarks,",
        "optimized for Instagram Reels & TikTok virality",
      ].join(" "),
    emotion: raw.emotion ?? "Amazement / curiosity",
    focalPoint:
      raw.focalPoint ??
      "Single main character centered with strong eye-contact and clear silhouette",
    colorPalette: Array.isArray(raw.colorPalette)
      ? raw.colorPalette
      : ["#10b981", "#0f172a", "#1e293b"],
    ctaStyle:
      raw.ctaStyle ??
      "Bold emerald rounded button bottom-right with white text, strong contrast",
    hookPower:
      raw.hookPower ??
      "High-contrast 3–5 word hook combining curiosity + clear benefit",
  };

  const palette = Array.isArray(t.colorPalette) ? t.colorPalette : [];

  const handleCopy = async () => {
    const text = t.finalPrompt || "";
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error("Copy failed", e);
    }
  };

  return (
    <section className="rounded-2xl border border-emerald-400/40 bg-slate-900/70 p-5 space-y-4">
      {/* HEADER */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-emerald-200 text-sm font-semibold"
      >
        <span>Thumbnail Intelligence</span>
        <span className="text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {!open ? null : (
        <div className="space-y-5">
          {/* Prompt Box */}
          <div className="rounded-xl bg-slate-950/80 border border-emerald-400/40 p-3 text-[11px] text-emerald-200 whitespace-pre-line">
            {t.finalPrompt}
          </div>

          {/* Copy Button – med feedback */}
          <button
            onClick={handleCopy}
            className="w-full py-2.5 rounded-xl bg-emerald-600 text-slate-950 font-semibold text-xs hover:bg-emerald-500 transition"
          >
            {copied ? "✔ Copied!" : "Copy Thumbnail Prompt"}
          </button>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-700">
              <p className="text-emerald-300 font-semibold">Emotion</p>
              <p className="text-slate-400">{t.emotion}</p>
            </div>

            <div className="p-2 rounded-lg bg-slate-900 border border-slate-700">
              <p className="text-emerald-300 font-semibold">Focal Point</p>
              <p className="text-slate-400">{t.focalPoint}</p>
            </div>

            <div className="p-2 rounded-lg bg-slate-900 border border-slate-700">
              <p className="text-emerald-300 font-semibold">CTA Style</p>
              <p className="text-slate-400">{t.ctaStyle}</p>
            </div>

            <div className="p-2 rounded-lg bg-slate-900 border border-slate-700">
              <p className="text-emerald-300 font-semibold">Hook Power</p>
              <p className="text-slate-400">{t.hookPower}</p>
            </div>
          </div>

          {/* Color Palette */}
          <div>
            <p className="text-[10px] text-slate-400 mb-1">
              Suggested color palette:
            </p>
            <div className="flex gap-2">
              {palette.map((col, i) => (
                <div
                  key={i}
                  className="h-5 w-5 rounded-full border border-slate-700"
                  style={{ backgroundColor: col }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}