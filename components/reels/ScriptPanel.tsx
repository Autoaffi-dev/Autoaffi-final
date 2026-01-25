"use client";

import React, { useState } from "react";

type ScriptPanelProps = {
  script: string | string[] | null | undefined;
};

function safeCopy(text: string, onDone: () => void) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onDone).catch(onDone);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      onDone();
    }
  } catch {
    onDone();
  }
}

export default function ScriptPanel({ script }: ScriptPanelProps) {
  const [copied, setCopied] = useState(false);

  const lines = Array.isArray(script)
    ? script
    : typeof script === "string" && script.trim().length > 0
    ? [script]
    : [];

  const hasScript = lines.length > 0;
  const joined = lines.join("\n");

  const handleCopy = () => {
    if (!joined) return;
    safeCopy(joined, () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <section className="rounded-2xl border border-emerald-400/40 bg-slate-950/70 p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-emerald-300">
            AI Script
          </h3>
          <p className="text-xs text-slate-400">
            Full VX 4.4 BEAST-script för din reel.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          disabled={!hasScript}
          className="inline-flex items-center gap-2 rounded-full border border-emerald-400/60 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3">
        {hasScript ? (
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-100 font-mono">
            {joined}
          </p>
        ) : (
          <p className="text-xs text-slate-500">
            Generate a reel first – your AI script will appear here.
          </p>
        )}
      </div>
    </section>
  );
}