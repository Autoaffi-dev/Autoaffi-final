"use client";

import React from "react";

interface GrowthPlanProps {
  creatorMode: "beginner" | "consistent" | "growth" | null;
  startStepsCompleted: number;
  markStepCompleted: (step: number) => void;

  // ✅ Tour 2 (Advanced)
  showContinueTour?: boolean;
  onContinueTour?: () => void;

  // ✅ Link steps to the right cards
  onStepNavigate?: (step: 1 | 2 | 3) => void;
}

export default function GrowthPlan({
  creatorMode,
  startStepsCompleted,
  markStepCompleted,
  showContinueTour = false,
  onContinueTour,
  onStepNavigate,
}: GrowthPlanProps) {
  if (!creatorMode) return null;

  const steps = [
    {
      id: 1 as const,
      label: "Step 1",
      title: "Connect your social accounts",
      text: "TikTok, Instagram, YouTube & Facebook – this helps Autoaffi understand your content and performance.",
    },
    {
      id: 2 as const,
      label: "Step 2",
      title: "Add your affiliate offers",
      text: "Save your key links and recurring programs so AI can optimize your content and suggestions.",
    },
    {
      id: 3 as const,
      label: "Step 3",
      title: "Generate your first content",
      text: "Use Posts Generator to create your first optimized post and unlock smart guidance.",
    },
  ];

  function handleStepClick(stepId: 1 | 2 | 3) {
    markStepCompleted(stepId);

    if (onStepNavigate) onStepNavigate(stepId);
  }

  return (
    <div id="start-steps-anchor">
      <section className="mb-8 rounded-2xl border border-emerald-400/30 bg-slate-900/70 p-5 shadow-[0_20px_40px_rgba(0,0,0,0.6)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
              Your Personalized Growth Plan
            </h2>

            <p className="mb-4 text-sm text-slate-200">
              Based on your creator type:{" "}
              <span className="font-semibold text-emerald-300">
                {creatorMode === "beginner"
                  ? "Beginner"
                  : creatorMode === "consistent"
                  ? "Consistent Creator"
                  : "Growth Mode"}
              </span>
            </p>
          </div>

          {showContinueTour && (
            <button
              onClick={() => onContinueTour?.()}
              className="whitespace-nowrap rounded-full border border-emerald-400/50 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-300 transition hover:border-emerald-300 hover:bg-emerald-500/15"
            >
              Continue Tour
            </button>
          )}
        </div>

        <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-slate-400">
          Start Here — Your First 3 Steps (Click to do it now)
        </p>

        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {steps.map((step) => {
            const completed = startStepsCompleted >= step.id;

            return (
              <button
                key={step.id}
                onClick={() => handleStepClick(step.id)}
                className={`text-left p-4 rounded-xl border transition-all ${
                  completed
                    ? "border-emerald-400/60 bg-emerald-600/10"
                    : "border-slate-700/70 bg-slate-900/60 hover:border-emerald-400/60 hover:bg-slate-900"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                      completed
                        ? "bg-emerald-400 text-slate-900"
                        : "bg-slate-800 text-slate-200"
                    }`}
                  >
                    {step.id}
                  </span>

                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {step.label}
                  </span>
                </div>

                <p
                  className={`text-[14px] font-semibold ${
                    completed ? "text-emerald-300" : "text-slate-100"
                  }`}
                >
                  {step.title}
                </p>

                <p className="mt-1 text-[12px] text-slate-400">{step.text}</p>

                {completed && (
                  <p className="mt-1 text-[11px] font-medium text-emerald-400">
                    ✓ Completed
                  </p>
                )}
              </button>
            );
          })}
        </div>

        <div className="mb-1">
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-emerald-400 transition-all duration-700"
              style={{
                width:
                  startStepsCompleted === 0
                    ? "0%"
                    : startStepsCompleted === 1
                    ? "33%"
                    : startStepsCompleted === 2
                    ? "66%"
                    : "100%",
              }}
            />
          </div>

          <p className="mt-2 text-[11px] text-slate-400">
            {startStepsCompleted}/3 steps completed
          </p>
        </div>
      </section>
    </div>
  );
}