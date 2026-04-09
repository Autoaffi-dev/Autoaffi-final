"use client";

import {
  getGoalRecommendationReason,
  getTargetMarketHelperText,
  PUSH_CTA_INTENSITY_OPTIONS,
  PUSH_DURATION_OPTIONS,
  PUSH_GOAL_OPTIONS,
  PUSH_LANGUAGE_OPTIONS,
  PUSH_PLATFORM_OPTIONS,
  PUSH_TARGET_MARKET_OPTIONS,
  SUGGESTED_TOPICS,
} from "@/lib/autoaffi-pushes/constants";
import type {
  PushCTAIntensity,
  PushGoal,
  PushLanguage,
  PushPlatform,
  PushTargetMarket,
  PushType,
  TopicInputMode,
} from "../types";

type PushInputPanelProps = {
  pushType: PushType;
  platform: PushPlatform;
  onPlatformChange: (value: PushPlatform) => void;
  topic: string;
  onTopicChange: (value: string) => void;
  topicInputMode: TopicInputMode;
  onTopicInputModeChange: (value: TopicInputMode) => void;
  offerFocus: string;
  onOfferFocusChange: (value: string) => void;
  goal: PushGoal;
  onGoalChange: (value: PushGoal) => void;
  recommendedGoal: PushGoal;
  durationDays: 5 | 7;
  onDurationChange: (value: 5 | 7) => void;
  ctaIntensity: PushCTAIntensity;
  onCTAIntensityChange: (value: PushCTAIntensity) => void;
  targetMarket: PushTargetMarket;
  onTargetMarketChange: (value: PushTargetMarket) => void;
  language: PushLanguage;
  onLanguageChange: (value: PushLanguage) => void;
  onGenerate: () => void;
};

export default function PushInputPanel({
  pushType,
  platform,
  onPlatformChange,
  topic,
  onTopicChange,
  topicInputMode,
  onTopicInputModeChange,
  offerFocus,
  onOfferFocusChange,
  goal,
  onGoalChange,
  recommendedGoal,
  durationDays,
  onDurationChange,
  ctaIntensity,
  onCTAIntensityChange,
  targetMarket,
  onTargetMarketChange,
  language,
  onLanguageChange,
  onGenerate,
}: PushInputPanelProps) {
  const recommendationReason = getGoalRecommendationReason(
    pushType,
    recommendedGoal
  );

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-7 shadow-[0_0_30px_rgba(0,0,0,0.28)]">
      <div className="mb-5">
        <p className="text-[11px] uppercase tracking-[0.22em] text-yellow-300/80 font-semibold">
          Step 2
        </p>
        <h2 className="mt-2 text-xl md:text-2xl font-bold text-white">
          Set your push direction
        </h2>
        <p className="mt-2 text-sm text-white/60 max-w-2xl leading-6">
          Autoaffi should do most of the strategic thinking here. The goal is to
          make this easy for the user, not force them to guess.
        </p>
      </div>

      <div className="space-y-6">
        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-yellow-300/80 font-semibold">
            Recommended goal right now
          </p>
          <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p className="text-base font-semibold text-yellow-300">
              {
                PUSH_GOAL_OPTIONS.find((item) => item.value === recommendedGoal)
                  ?.label
              }
            </p>
            <button
              type="button"
              onClick={() => onGoalChange(recommendedGoal)}
              className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-xs font-semibold text-yellow-300 transition hover:bg-yellow-400/15"
            >
              Use recommended
            </button>
          </div>
          <p className="mt-3 text-sm leading-6 text-white/65">
            {recommendationReason}
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
              Platform
            </label>
            <select
              value={platform}
              onChange={(e) => onPlatformChange(e.target.value as PushPlatform)}
              className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none"
            >
              {PUSH_PLATFORM_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  className="bg-[#0b0b10]"
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
              Goal
            </label>
            <select
              value={goal}
              onChange={(e) => onGoalChange(e.target.value as PushGoal)}
              className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none"
            >
              {PUSH_GOAL_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  className="bg-[#0b0b10]"
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
              Target market
            </label>
            <select
              value={targetMarket}
              onChange={(e) =>
                onTargetMarketChange(e.target.value as PushTargetMarket)
              }
              className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none"
            >
              {PUSH_TARGET_MARKET_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  className="bg-[#0b0b10]"
                >
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-sm text-white/50 leading-6">
              {getTargetMarketHelperText()}
            </p>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
              Content language
            </label>
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value as PushLanguage)}
              className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none"
            >
              {PUSH_LANGUAGE_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  className="bg-[#0b0b10]"
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
            Push topic
          </label>

          <div className="mt-3 inline-flex rounded-full border border-white/10 bg-black/30 p-1">
            <button
              type="button"
              onClick={() => onTopicInputModeChange("suggested")}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                topicInputMode === "suggested"
                  ? "bg-yellow-400 text-black"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Autoaffi Suggested
            </button>
            <button
              type="button"
              onClick={() => onTopicInputModeChange("manual")}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                topicInputMode === "manual"
                  ? "bg-yellow-400 text-black"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Manual
            </button>
          </div>

          {topicInputMode === "suggested" ? (
            <>
              <p className="mt-3 text-sm text-white/55 leading-6">
                Autoaffi can suggest stronger default topics that are easier to
                turn into engagement-first pushes.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {SUGGESTED_TOPICS.map((word) => (
                  <button
                    key={word}
                    type="button"
                    onClick={() => onTopicChange(word)}
                    className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                      topic === word
                        ? "border-yellow-400/60 bg-yellow-400/10 text-yellow-300"
                        : "border-white/10 bg-white/[0.02] text-white/70 hover:border-yellow-500/30"
                    }`}
                  >
                    {word}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm text-white/55 leading-6">
                Manual mode gives full control. One strong keyword or short
                phrase is enough.
              </p>

              <input
                type="text"
                value={topic}
                onChange={(e) => onTopicChange(e.target.value)}
                placeholder="ex: affiliate marketing"
                className="mt-4 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none"
              />
            </>
          )}
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
            What should this push warm people up for?{" "}
            <span className="text-white/35 normal-case">(optional)</span>
          </label>
          <input
            type="text"
            value={offerFocus}
            onChange={(e) => onOfferFocusChange(e.target.value)}
            placeholder="ex: Systeme.io, your free guide, your main recurring tool..."
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none"
          />
          <p className="mt-2 text-sm text-white/50 leading-6">
            This helps Autoaffi understand what the audience should gradually be
            warmed up for. Leave it blank if you only want growth, trust and
            engagement first.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
              Duration
            </label>
            <div className="flex gap-2">
              {PUSH_DURATION_OPTIONS.map((days) => {
                const active = durationDays === days;
                return (
                  <button
                    key={days}
                    type="button"
                    onClick={() => onDurationChange(days)}
                    className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                      active
                        ? "border-yellow-400/70 bg-yellow-400/10 text-yellow-300"
                        : "border-white/10 bg-black/20 text-white/75 hover:border-yellow-500/30"
                    }`}
                  >
                    {days} days
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
            CTA intensity
          </label>
          <div className="grid gap-3 md:grid-cols-3">
            {PUSH_CTA_INTENSITY_OPTIONS.map((option) => {
              const active = ctaIntensity === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onCTAIntensityChange(option.value)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    active
                      ? "border-yellow-400/70 bg-yellow-400/10"
                      : "border-white/10 bg-black/20 hover:border-yellow-500/30"
                  }`}
                >
                  <p
                    className={`text-sm font-semibold ${
                      active ? "text-yellow-300" : "text-white"
                    }`}
                  >
                    {option.label}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-white/55">
                    {option.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onGenerate}
        className="mt-7 w-full rounded-2xl bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-600 px-5 py-4 text-sm font-bold text-black transition hover:brightness-110"
      >
        Generate My Autoaffi Push
      </button>
    </section>
  );
}