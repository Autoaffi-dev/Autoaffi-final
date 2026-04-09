"use client";

import {
  PUSH_GOAL_OPTIONS,
  PUSH_TARGET_MARKET_OPTIONS,
} from "@/lib/autoaffi-pushes/constants";
import type { GeneratedPush } from "../types";

type PushSummaryPanelProps = {
  push: GeneratedPush;
};

export default function PushSummaryPanel({ push }: PushSummaryPanelProps) {
  const goalLabel =
    PUSH_GOAL_OPTIONS.find((item) => item.value === push.goal)?.label ?? push.goal;

  const marketLabel =
    PUSH_TARGET_MARKET_OPTIONS.find((item) => item.value === push.targetMarket)
      ?.label ?? push.targetMarket;

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-white/[0.03] p-6 md:p-7 shadow-[0_0_30px_rgba(0,0,0,0.28)]">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl">
          <p className="text-[11px] uppercase tracking-[0.22em] text-yellow-300/80 font-semibold">
            Push Summary
          </p>

          <h2 className="mt-2 text-2xl md:text-3xl font-bold text-white">
            {push.title}
          </h2>

          <p className="mt-4 text-sm md:text-base text-white/65 leading-7">
            {push.whyThisPushWorks}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:min-w-[300px]">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
              Platform
            </p>
            <p className="mt-2 text-sm font-semibold text-white">
              {push.platform}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
              Duration
            </p>
            <p className="mt-2 text-sm font-semibold text-white">
              {push.durationDays} days
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
              Goal
            </p>
            <p className="mt-2 text-sm font-semibold text-white">
              {goalLabel}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
              CTA intensity
            </p>
            <p className="mt-2 text-sm font-semibold text-white">
              {push.ctaIntensity}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 col-span-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
              Target market
            </p>
            <p className="mt-2 text-sm font-semibold text-white">
              {marketLabel}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}