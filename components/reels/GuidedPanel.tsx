"use client";

import React from "react";
import { Sparkles, Pencil } from "lucide-react";

interface Props {
  guidedText: string;
  setGuidedText: (v: string) => void;
}

export default function GuidedPanel({ guidedText, setGuidedText }: Props) {
  return (
    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-6">

      {/* HEADER */}
      <h2 className="text-lg font-semibold text-emerald-300 text-center">
        Guided Mode — Describe Your Niche
      </h2>

      {/* SUBTEXT */}
      <p className="text-gray-300 text-sm text-center max-w-md mx-auto">
        Describe your niche or what this reel should be about. Autoaffi will
        generate hooks, pacing, storyline, SEO keywords & CTA based on your description.
      </p>

      {/* TEXTAREA */}
      <div className="space-y-2">
        <label className="text-sm text-gray-300 flex items-center gap-2">
          <Pencil className="w-4 h-4 text-emerald-300" />
          Your Reel Description
        </label>

        <textarea
          value={guidedText}
          onChange={(e) => setGuidedText(e.target.value)}
          className="
            w-full h-32 p-3 rounded-xl bg-black/30 border border-white/10
            text-gray-200 text-sm focus:outline-none focus:border-emerald-400/40
          "
          placeholder="Example: Fitness for beginners — motivational tone, fast pacing, use statistics and strong hooks about fat loss."
        />
      </div>

      {/* TIPS BOX */}
      <div className="p-4 rounded-xl bg-white/5 border border-white/10">
        <p className="text-gray-300 text-sm font-semibold mb-2 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-300" />
          Tips for best AI results:
        </p>

        <ul className="text-gray-400 text-xs space-y-1">
          <li>• Mention your audience (beginners, entrepreneurs, parents etc.).</li>
          <li>• Include tone: motivational, luxury, emotional, aggressive, calm.</li>
          <li>• Add desired style: facts, storytelling, shocking hooks, CTA-heavy.</li>
          <li>• Add niche keywords for better SEO mapping.</li>
        </ul>
      </div>
    </div>
  );
}