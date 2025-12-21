"use client";

import React from "react";

type OfferMode = "product" | "recurring" | "funnel";

interface Props {
  offerMode: OfferMode;
  setOfferMode: (v: OfferMode) => void;
}

export default function OfferTypeSelector({ offerMode, setOfferMode }: Props) {
  const modes: { key: OfferMode; title: string; desc: string }[] = [
    { key: "product", title: "Product", desc: "Promote a single affiliate product" },
    { key: "recurring", title: "Recurring", desc: "Earn monthly commissions on autopilot" },
    { key: "funnel", title: "Funnel", desc: "Use a lead magnet or opt-in funnel" },
  ];

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-slate-300 mb-2">
        Monetization Path
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {modes.map((m) => {
          const active = offerMode === m.key;

          return (
            <button
              key={m.key}
              onClick={() => setOfferMode(m.key)}
              className={`
                p-4 rounded-2xl border text-left transition-all
                ${active
                  ? "border-emerald-400 bg-emerald-500/10 shadow-lg"
                  : "border-slate-700 hover:bg-slate-800/40 hover:border-slate-500"
                }
              `}
            >
              <h4 className="text-base font-semibold text-slate-200">
                {m.title}
              </h4>
              <p className="text-xs text-slate-400 mt-1">{m.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}