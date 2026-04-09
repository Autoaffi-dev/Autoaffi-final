"use client";

import {
  copyDayHashtags,
  copyDayPostOnly,
  copyImagePrompt,
  copySinglePushDay,
  copyVideoScript,
} from "@/lib/autoaffi-pushes/copyPush";
import type { PushDay } from "../types";

type PushDayCardProps = {
  day: PushDay;
  onRegenerateDay: (dayNumber: number) => void;
};

export default function PushDayCard({
  day,
  onRegenerateDay,
}: PushDayCardProps) {
  async function handleCopyDay() {
    try {
      await copySinglePushDay(day);
    } catch (err) {
      console.error("[AUTOAFFI_PUSHES] copy day failed", err);
    }
  }

  async function handleCopyPostOnly() {
    try {
      await copyDayPostOnly(day);
    } catch (err) {
      console.error("[AUTOAFFI_PUSHES] copy post failed", err);
    }
  }

  async function handleCopyHashtags() {
    try {
      await copyDayHashtags(day);
    } catch (err) {
      console.error("[AUTOAFFI_PUSHES] copy hashtags failed", err);
    }
  }

  async function handleCopyImagePrompt() {
    try {
      await copyImagePrompt(day);
    } catch (err) {
      console.error("[AUTOAFFI_PUSHES] copy image prompt failed", err);
    }
  }

  async function handleCopyVideoScript() {
    try {
      await copyVideoScript(day);
    } catch (err) {
      console.error("[AUTOAFFI_PUSHES] copy video script failed", err);
    }
  }

  async function handleCopyReply() {
    try {
      if (!day.commentReply) return;
      await navigator.clipboard.writeText(day.commentReply);
    } catch (err) {
      console.error("[AUTOAFFI_PUSHES] copy reply failed", err);
    }
  }

  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6 shadow-[0_0_24px_rgba(0,0,0,0.22)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-yellow-300/80 font-semibold">
            Day {day.dayNumber}
          </p>

          <h3 className="mt-2 text-xl font-bold text-white">
            {day.dayTitle}
          </h3>

          <p className="mt-2 text-sm text-white/50">
            {day.dayRole}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onRegenerateDay(day.dayNumber)}
            className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-400/15"
          >
            Regenerate day
          </button>

          <button
            type="button"
            onClick={handleCopyDay}
            className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-xs font-semibold text-yellow-300 transition hover:bg-yellow-400/15"
          >
            Copy day
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
            Why this day matters
          </p>
          <p className="mt-2 text-sm leading-6 text-white/70">
            {day.whyThisDayMatters}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
            Optimizing for
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {day.optimizingFor.map((item) => (
              <span
                key={item}
                className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300"
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
            Hook
          </p>
          <p className="mt-2 text-sm md:text-base font-semibold leading-7 text-white">
            {day.hook}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
              Copy-paste post
            </p>
            <button
              type="button"
              onClick={handleCopyPostOnly}
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/80 transition hover:border-yellow-500/30"
            >
              Copy post only
            </button>
          </div>

          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-white/70">
            {day.body}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
              Suggested CTA
            </p>
            <p className="mt-2 text-sm leading-6 text-yellow-300">
              {day.cta}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
              Algorithm note
            </p>
            <p className="mt-2 text-sm leading-6 text-emerald-300">
              {day.algorithmNote}
            </p>
          </div>
        </div>

        {day.commentReply && (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                Comment reply you can paste
              </p>
              <button
                type="button"
                onClick={handleCopyReply}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/80 transition hover:border-yellow-500/30"
              >
                Copy reply
              </button>
            </div>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-white/70">
              {day.commentReply}
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
            Keyword focus
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {day.keywordFocus.map((item) => (
              <span
                key={item}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/70"
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
              Hashtags
            </p>
            <button
              type="button"
              onClick={handleCopyHashtags}
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/80 transition hover:border-yellow-500/30"
            >
              Copy hashtags
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {day.hashtags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-yellow-400/20 bg-yellow-400/5 px-3 py-1 text-xs text-yellow-200/85"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
              Image prompt
            </p>
            <button
              type="button"
              onClick={handleCopyImagePrompt}
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/80 transition hover:border-yellow-500/30"
            >
              Copy prompt
            </button>
          </div>

          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-white/70">
            {day.imagePrompt}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
              Short video / CapCut script
            </p>
            <button
              type="button"
              onClick={handleCopyVideoScript}
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/80 transition hover:border-yellow-500/30"
            >
              Copy script
            </button>
          </div>

          <div className="mt-2 space-y-2">
            {day.videoScript.map((line, index) => (
              <p
                key={`${day.dayNumber}-video-${index}`}
                className="text-sm leading-7 text-white/70"
              >
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}