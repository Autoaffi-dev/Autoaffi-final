"use client";

import React from "react";
import type { TourStage } from "../page";

interface SpotlightHighlightProps {
  stage: TourStage;
  spotlightIndex: number;
  spotlightTargets: string[];
  aiMessage: string; // ✅ från page: overlayMessage (tomt när hon är klar)
  onNext: () => void;
}

export default function SpotlightHighlight({
  stage,
  aiMessage,
}: SpotlightHighlightProps) {
  // Visa bara under spotlight / final-steps
  if (stage !== "spotlight" && stage !== "final-steps") return null;

  // ✅ Om text är tom (Samantha klar) -> visa inget
  if (!aiMessage) return null;

  return (
    <div className="pointer-events-none fixed top-4 left-0 right-0 z-[998] flex justify-center">
      <div className="inline-flex max-w-2xl items-center gap-3 rounded-full bg-slate-950/85 border border-emerald-400/30 px-5 py-2 shadow-lg">
        <span className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">
          Autoaffi Guide
        </span>

        <p className="text-xs text-slate-100 leading-relaxed line-clamp-2">
          {aiMessage}
        </p>
      </div>
    </div>
  );
}