"use client";

import { useState, useEffect } from "react";

export type SEOHashtagBoxProps = {
  baseContent: string;
  suggestions: string[];
  defaultValue?: string;
  onChange?: (tags: string[]) => void;
};

export default function SEOHashtagBox({
  baseContent,
  suggestions,
  defaultValue,
  onChange,
}: SEOHashtagBoxProps) {
  const [value, setValue] = useState(defaultValue ?? "");

  useEffect(() => {
    if (onChange) {
      const tags = value
        .split("#")
        .map((v) => v.trim())
        .filter(Boolean)
        .map((v) => (v.startsWith("#") ? v : "#" + v));
      onChange(tags);
    }
  }, [value, onChange]);

  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-300 mb-1">
        Suggested hashtags
      </p>
      <p className="text-[11px] text-slate-500 mb-2">
        Quick suggestions based on your text – tweak them to match your niche and platform.
      </p>

      <div className="flex flex-wrap gap-2 mb-2">
        {suggestions.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => {
              const current = value ? value.split(" ").filter(Boolean) : [];
              if (!current.includes(tag)) {
                setValue((value ? value + " " : "") + tag);
              }
            }}
            className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-[10px] text-slate-200 hover:border-yellow-400 hover:text-yellow-200 transition"
          >
            {tag}
          </button>
        ))}
      </div>

      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={
          baseContent
            ? "#affiliatemarketing #contentcreator #sidehustle"
            : "Type or paste your hashtag set here…"
        }
        rows={2}
        className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-200 placeholder-slate-500"
      />
    </div>
  );
}