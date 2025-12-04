"use client";

import { useState, useEffect } from "react";

export type SEOKeywordBoxProps = {
  baseContent: string;
  suggestions: string[];
  defaultValue?: string;
  onChange?: (keywords: string[]) => void;
};

export default function SEOKeywordBox({
  baseContent,
  suggestions,
  defaultValue,
  onChange,
}: SEOKeywordBoxProps) {
  const [value, setValue] = useState(defaultValue ?? "");

  useEffect(() => {
    if (onChange) {
      const parts = value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      onChange(parts);
    }
  }, [value, onChange]);

  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-300 mb-1">
        Suggested keywords
      </p>
      <p className="text-[11px] text-slate-500 mb-2">
        Based on your current content. You can edit these keywords – they help with hooks, SEO and
        matching offers.
      </p>

      <div className="flex flex-wrap gap-2 mb-2">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              const current = value ? value.split(",").map((v) => v.trim()) : [];
              if (!current.includes(s)) {
                setValue(current.concat(s).join(", "));
              }
            }}
            className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-[10px] text-slate-200 hover:border-yellow-400 hover:text-yellow-200 transition"
          >
            {s}
          </button>
        ))}
      </div>

      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={
          baseContent
            ? "ai tools, affiliate marketing, content creators..."
            : "Start typing your main keywords here…"
        }
        rows={2}
        className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-200 placeholder-slate-500"
      />
    </div>
  );
}
