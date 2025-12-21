"use client";

import React from "react";

export interface MetadataPanelProps {
  genre: string;
  setGenre: (v: string) => void;

  tone: string;
  setTone: (v: string) => void;

  storyFormat: string;
  setStoryFormat: (v: string) => void;

  offerType: "product" | "recurring" | "funnel";
  setOfferType: (v: "product" | "recurring" | "funnel") => void;

  selectedOffer: any;
  setSelectedOffer: (v: any) => void;
}

export default function MetadataPanel({
  genre,
  setGenre,
  tone,
  setTone,
  storyFormat,
  setStoryFormat,
  offerType,
  setOfferType,
  selectedOffer,
  setSelectedOffer,
}: MetadataPanelProps) {
  return (
    <section className="mb-6 rounded-2xl border border-slate-700/60 bg-slate-900/50 p-5 text-sm space-y-4">

      {/* GENRE */}
      <div>
        <label className="text-xs font-semibold text-slate-300 mb-1 block">
          Genre
        </label>
        <input
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          className="w-full rounded-lg bg-black/20 border border-white/10 p-2 text-sm text-slate-200"
        />
      </div>

      {/* TONE */}
      <div>
        <label className="text-xs font-semibold text-slate-300 mb-1 block">
          Tone
        </label>
        <input
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          className="w-full rounded-lg bg-black/20 border border-white/10 p-2 text-sm text-slate-200"
        />
      </div>

      {/* STORY FORMAT */}
      <div>
        <label className="text-xs font-semibold text-slate-300 mb-1 block">
          Story Format
        </label>

        <select
          value={storyFormat}
          onChange={(e) => setStoryFormat(e.target.value)}
          className="w-full rounded-lg bg-black/20 border border-white/10 p-2 text-sm text-slate-200"
        >
          {/* Original formats */}
          <option value="hook-story-cta">Hook → Story → CTA</option>
          <option value="problem-solution">Problem → Solution</option>
          <option value="rapid-tips">3 Rapid Tips</option>

          {/* New premium formats */}
          <option value="hook-value-cta">Hook → Value → CTA</option>
          <option value="hook-value-value-cta">Hook → Value → Value → CTA</option>
          <option value="5-mistakes">5 Mistakes Format</option>
          <option value="before-after">Before / After Transformation</option>
          <option value="hard-truth">Hard Truth Format</option>
          <option value="mini-vlog">Mini Vlog + CTA</option>
          <option value="tutorial-3-steps">Tutorial (3 steps)</option>
          <option value="listicle-top3">Listicle (Top 3)</option>
          <option value="motivation-cta">Motivation Quote + CTA</option>
          <option value="high-ticket-arc">High-ticket persuasion arc</option>
          <option value="funnel-story">Funnel-focused storytelling</option>
        </select>
      </div>

      {/* OFFER TYPE */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-300">Offer Type</label>
        <p className="text-[11px] text-slate-500 mb-1">
          Autoaffi adapts your reel blueprint depending on what type you choose.
        </p>

        <div className="flex gap-3">
          {["product", "recurring", "funnel"].map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setOfferType(o as any)}
              title={
                o === "product"
                  ? "Use any affiliate product. Autoaffi builds product-focused hooks."
                  : o === "recurring"
                  ? "Recurring SaaS offers. Autoaffi emphasizes long-term value."
                  : "Funnel storytelling with narrative sequencing."
              }
              className={`
                px-4 py-2 rounded-lg border text-xs transition
                ${
                  offerType === o
                    ? "border-emerald-400 bg-emerald-500/10 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                    : "border-white/10 bg-white/5 text-slate-300"
                }
              `}
            >
              {o.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}