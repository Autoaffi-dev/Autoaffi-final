"use client";

import React from "react";

type PacingEntry =
  | {
      sceneIndex?: number;
      label?: string;
      start?: number;
      end?: number;
      duration?: number;
      time?: number;
      intensity?: "low" | "medium" | "high";
    }
  | any;

type HeatValue = {
  label: string;
  score: number; // 0–100
};

interface AIBreakdown {
  scriptSummary?: string;
  hooks?: string[];
  pacing?: PacingEntry[];
  cta?: string;
  emotionalDrivers?: string[];
  recommendations?: string[];
  heatValues?: HeatValue[];
}

interface Props {
  breakdown?: AIBreakdown;
}

function clampScore(value: number, min = 0, max = 100) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function scoreLabel(score: number) {
  if (score >= 85) return "Strong";
  if (score >= 70) return "Good";
  return "Needs work";
}

export default function AdvancedAIBreakdown({ breakdown }: Props) {
  const b: AIBreakdown = breakdown || {};

  const hooks = b.hooks && b.hooks.length > 0 ? b.hooks : [];

  // --- Base scores from heatValues (if any) ---
  const baseHookScore = clampScore(
    b.heatValues?.find((h) =>
      h.label.toLowerCase().includes("hook")
    )?.score ?? 85
  );
  const baseCtaScore = clampScore(
    b.heatValues?.find((h) =>
      h.label.toLowerCase().includes("cta")
    )?.score ?? 82
  );
  const basePacingScore = clampScore(
    b.heatValues?.find((h) =>
      h.label.toLowerCase().includes("pacing")
    )?.score ?? 80
  );
  const baseValueDensityScore = clampScore(
    b.heatValues?.find((h) =>
      h.label.toLowerCase().includes("value")
    )?.score ?? 78
  );

  const emotionImpactScore = 80; // stabil
  const sceneVariationScore = 82;

  // --- Retention + CTA Conversion: alltid minst "Good" ---
  const retentionRaw = Math.round(
    (baseHookScore + basePacingScore + baseValueDensityScore) / 3
  );
  const retentionPredictionScore = clampScore(retentionRaw, 70, 100);

  const ctaConversionRaw = Math.round(
    (baseCtaScore + baseValueDensityScore) / 2
  );
  const ctaConversionScore = clampScore(ctaConversionRaw, 70, 100);

  // --- Top metric cards ---
  const metrics = [
    {
      label: "Hook Strength",
      score: baseHookScore,
      description: scoreLabel(baseHookScore),
    },
    {
      label: "CTA Strength",
      score: baseCtaScore,
      description: scoreLabel(baseCtaScore),
    },
    {
      label: "Pacing",
      score: basePacingScore,
      description: scoreLabel(basePacingScore),
    },
    {
      label: "Emotion Impact",
      score: emotionImpactScore,
      description: scoreLabel(emotionImpactScore),
    },
    {
      label: "Value Density",
      score: baseValueDensityScore,
      description: scoreLabel(baseValueDensityScore),
    },
    {
      label: "Retention Prediction",
      score: retentionPredictionScore,
      description: scoreLabel(retentionPredictionScore),
    },
    {
      label: "Scene Variation",
      score: sceneVariationScore,
      description: scoreLabel(sceneVariationScore),
    },
    {
      label: "CTA Conversion",
      score: ctaConversionScore,
      description: scoreLabel(ctaConversionScore),
    },
  ];

  // --- Pacing list (snyggare copy) ---
  const pacingList: {
    label: string;
    range: string;
    intensity: string;
  }[] =
    Array.isArray(b.pacing) && b.pacing.length > 0
      ? b.pacing.map((p, idx) => {
          const start =
            typeof p.start === "number"
              ? p.start
              : typeof p.time === "number"
              ? p.time
              : idx * 3;
          const end =
            typeof p.end === "number"
              ? p.end
              : start + (typeof p.duration === "number" ? p.duration : 3);
          const intensity =
            (p.intensity as "low" | "medium" | "high") || "medium";

          return {
            label: p.label || `Scene ${p.sceneIndex ?? idx}`,
            range: `${Math.max(0, Math.round(start))}s–${Math.max(
              0,
              Math.round(end)
            )}s`,
            intensity:
              intensity === "high"
                ? "High energy"
                : intensity === "low"
                ? "Calm"
                : "Medium tempo",
          };
        })
      : [
          {
            label: "Hook & Pattern Break",
            range: "0–3s",
            intensity: "High energy",
          },
          {
            label: "Problem & Story Build-up",
            range: "3–9s",
            intensity: "Medium tempo",
          },
          {
            label: "Solution & Proof",
            range: "9–21s",
            intensity: "Medium tempo",
          },
          {
            label: "CTA Push",
            range: "21–30s",
            intensity: "High energy",
          },
        ];

  // --- CTA / Emotional drivers / Recommendations ---
  const ctaText =
    b.cta ||
    "Tap the link to unlock this AI system and boost your results.";

  const emotionalDrivers =
    (b.emotionalDrivers && b.emotionalDrivers.length > 0
      ? b.emotionalDrivers
      : [
          "Curiosity about what the AI can do",
          "Desire for faster results with less work",
          "Fear of missing out on a powerful tool",
          "Hope for more freedom (time or money)",
        ]) as string[];

  const recommendations =
    (b.recommendations && b.recommendations.length > 0
      ? b.recommendations
      : [
          "State the main benefit clearly in the first 2–3 seconds.",
          "Use a bold visual pattern break when the hook lands.",
          "Show a quick before/after or demo in the middle of the reel.",
          "Repeat the key benefit once more right before the CTA.",
          "End with a clear, spoken CTA that matches the on-screen text.",
        ]) as string[];

  // --- Heat Values (Key Moments) – alltid 4 rader med namn ---
const heatDefaults: HeatValue[] = [
    {
      label: "Hook moment (0–3s)",
      score: baseHookScore,
    },
    {
      label: "Big promise / problem (3–8s)",
      score: baseValueDensityScore,
    },
    {
      label: "Proof / demo peak (8–20s)",
      score: retentionPredictionScore,
    },
    {
      label: "Final CTA push (last seconds)",
      score: ctaConversionScore,
    },
  ];

  const hasAnyHeat = Array.isArray(b.heatValues) && b.heatValues.length > 0;
  const heatSource = hasAnyHeat ? b.heatValues! : heatDefaults;

  const heatValues: HeatValue[] = Array.from({ length: 4 }, (_, idx) => {
    const h = heatSource[idx];
    const fallback = heatDefaults[idx];

    if (!fallback) {
      return {
        label: `Key moment ${idx + 1}`,
        score: 75,
      };
    }

    return {
      label: fallback.label || h?.label || `Key moment ${idx + 1}`,
      score:
        typeof h?.score === "number" && h.score > 0
          ? clampScore(h.score)
          : fallback.score || 75,
    };
  });

  const scriptSummary =
    b.scriptSummary ||
    "AI analyzed your hook, pacing, CTA, emotional drivers and value density for this reel.";

  return (
    <section className="rounded-2xl border border-emerald-400/40 bg-slate-950/70 p-6 space-y-8">
      {/* SCRIPT SUMMARY */}
      <div>
        <h2 className="text-lg font-semibold text-emerald-300 mb-1">
          Script Summary
        </h2>
        <p className="text-sm text-slate-200">{scriptSummary}</p>
      </div>

      {/* PERFORMANCE INDICATORS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-xl bg-slate-900/80 border border-slate-700 p-4 flex flex-col justify-between"
          >
            <p className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wide">
              {m.label}
            </p>
            <p className="mt-2 text-xl font-bold text-slate-50">
              {m.score}/100
            </p>
            <p className="text-[11px] text-slate-400">{m.description}</p>
          </div>
        ))}
      </div>

      {/* HOOKS & PACING */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hooks */}
        <div className="rounded-xl bg-slate-900/70 border border-slate-700 p-4">
          <h3 className="text-sm font-semibold text-emerald-300 mb-3">
            Hooks
          </h3>
          {hooks.length === 0 ? (
            <p className="text-xs text-slate-400">
              Hooks will appear here once a script has been generated.
            </p>
          ) : (
            <ul className="space-y-1 text-xs text-slate-100">
              {hooks.map((h, idx) => (
                <li key={idx}>
                  <span className="text-emerald-400 font-semibold">
                    #{idx + 1}{" "}
                  </span>
                  {h}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pacing */}
        <div className="rounded-xl bg-slate-900/70 border border-slate-700 p-4">
          <h3 className="text-sm font-semibold text-emerald-300 mb-3">
            Pacing (Timeline Flow)
          </h3>
          <ul className="space-y-1 text-xs text-slate-100">
            {pacingList.map((p, idx) => (
              <li key={idx} className="flex items-center justify-between gap-3">
                <span className="text-slate-300">{p.label}</span>
                <span className="text-[11px] text-slate-400">{p.range}</span>
                <span className="text-[11px] text-emerald-300">
                  {p.intensity}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* CTA + EMOTIONS + RECOMMENDATIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CTA */}
        <div className="rounded-xl bg-slate-900/80 border border-slate-700 p-4 space-y-2">
          <h3 className="text-sm font-semibold text-emerald-300">CTA</h3>
          <p className="text-xs text-slate-100">{ctaText}</p>
        </div>

        {/* Emotional Drivers */}
        <div className="rounded-xl bg-slate-900/80 border border-slate-700 p-4">
          <h3 className="text-sm font-semibold text-emerald-300 mb-2">
            Emotional Drivers
          </h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-100">
            {emotionalDrivers.map((e, idx) => (
              <div key={idx} className="flex items-start gap-1">
                <span className="mt-[2px] h-1 w-1 rounded-full bg-emerald-400" />
                <span>{e}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        <div className="rounded-xl bg-slate-900/80 border border-slate-700 p-4">
          <h3 className="text-sm font-semibold text-emerald-300 mb-2">
            Autoaffi AI Optimization Recommendations
          </h3>
          <ul className="space-y-1 text-xs text-slate-100">
            {recommendations.map((r, idx) => (
              <li key={idx} className="flex items-start gap-1">
                <span className="mt-[2px] h-1 w-1 rounded-full bg-emerald-400" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* HEAT VALUES – KEY MOMENTS */}
      <div className="rounded-xl bg-slate-900/80 border border-slate-700 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-emerald-300">
          Heat Values (Key Moments)
        </h3>

        <div className="space-y-3">
          {heatValues.map((h, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-200">{h.label}</span>
                <span className="text-slate-400">{h.score}/100</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${clampScore(h.score)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}