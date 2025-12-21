"use client";

import React from "react";

type ReelMode = "auto" | "guided" | "manual";

interface Props {
  mode: ReelMode;
  setMode: (v: ReelMode) => void;
}

export default function ModeSelector({ mode, setMode }: Props) {
  const modes: { key: ReelMode; label: string; desc: string }[] = [
    {
      key: "manual",
      label: "Manual",
      desc: "You control uploads, pacing & storyboard.",
    },
    {
      key: "guided",
      label: "Guided",
      desc: "Describe your niche — Autoaffi builds hooks & pacing.",
    },
    {
      key: "auto",
      label: "Auto",
      desc: "Hands-free: Autoaffi picks everything.",
    },
  ];

  return (
    <div className="w-full">
      <h3 className="text-sm font-semibold text-slate-300 mb-2">
        Creation Mode
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {modes.map((m) => {
          const active = mode === m.key;

          return (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`
                rounded-xl p-4 text-left transition-all border
                ${
                  active
                    ? "border-emerald-400 bg-emerald-500/10 shadow-md"
                    : "border-slate-700 hover:border-slate-500 hover:bg-slate-700/30"
                }
              `}
            >
              <div className="text-base font-semibold text-slate-200">
                {m.label}
              </div>
              <div className="text-xs text-slate-400 mt-1">{m.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}