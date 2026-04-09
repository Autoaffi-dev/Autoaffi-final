"use client";

import {
  getRecommendedPushType,
  PUSH_TYPE_OPTIONS,
} from "@/lib/autoaffi-pushes/constants";
import type { PushType } from "../types";

type PushTypeSelectorProps = {
  value: PushType;
  onChange: (value: PushType) => void;
};

export default function PushTypeSelector({
  value,
  onChange,
}: PushTypeSelectorProps) {
  const recommendedType = getRecommendedPushType();

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-7 shadow-[0_0_30px_rgba(0,0,0,0.28)]">
      <div className="mb-5">
        <p className="text-[11px] uppercase tracking-[0.22em] text-yellow-300/80 font-semibold">
          Step 1
        </p>
        <h2 className="mt-2 text-xl md:text-2xl font-bold text-white">
          Choose your push type
        </h2>
        <p className="mt-2 text-sm text-white/60 max-w-2xl leading-6">
          Autoaffi highlights the strongest default push first. Each push type
          also shows what it is best used for so the choice is easier.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {PUSH_TYPE_OPTIONS.map((option) => {
          const active = value === option.value;
          const recommended = option.value === recommendedType;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`relative rounded-2xl border p-4 text-left transition ${
                active
                  ? "border-yellow-400/70 bg-yellow-400/10 shadow-[0_0_18px_rgba(250,204,21,0.12)]"
                  : "border-white/10 bg-white/[0.02] hover:border-yellow-500/30 hover:bg-white/[0.03]"
              }`}
            >
              {recommended && (
                <span className="absolute right-3 top-3 rounded-full border border-yellow-400/40 bg-yellow-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-yellow-300">
                  Recommended
                </span>
              )}

              <p
                className={`text-sm font-semibold ${
                  active ? "text-yellow-300" : "text-white"
                }`}
              >
                {option.label}
              </p>

              <p className="mt-2 text-xs leading-5 text-white/60">
                {option.description}
              </p>

              <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                  Best use case
                </p>
                <p className="mt-1 text-xs leading-5 text-white/70">
                  {option.bestFor}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}