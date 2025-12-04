"use client";

import React from "react";

interface GrowthPlanProps {
  creatorMode: "beginner" | "consistent" | "growth" | null;
  startStepsCompleted: number;
  markStepCompleted: (step: number) => void;
}

export default function GrowthPlan({
  creatorMode,
  startStepsCompleted,
  markStepCompleted,
}: GrowthPlanProps) {
  if (!creatorMode) return null;

  // 3 STEP DATA
  const steps = [
    {
      id: 1,
      label: "Step 1",
      title: "Connect your social accounts",
      text: "TikTok, Instagram, YouTube & Facebook – this helps Autoaffi understand your content and performance.",
    },
    {
      id: 2,
      label: "Step 2",
      title: "Add your affiliate offers",
      text: "Save your key links and recurring programs so AI can optimize your content and suggestions.",
    },
    {
      id: 3,
      label: "Step 3",
      title: "Generate your first content",
      text: "Use Posts Generator to create your first optimized post and unlock smart guidance.",
    },
  ];

  return (
    <div id="start-steps-anchor">
      <section className="mb-8 rounded-2xl border border-emerald-400/30 bg-slate-900/70 p-5 shadow-[0_20px_40px_rgba(0,0,0,0.6)]">
        {/* Title */}
        <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300 mb-3">
          Your Personalized Growth Plan
        </h2>

        {/* Creator label */}
        <p className="text-sm text-slate-200 mb-4">
          Based on your creator type:{" "}
          <span className="font-semibold text-emerald-300">
            {creatorMode === "beginner"
              ? "Beginner"
              : creatorMode === "consistent"
              ? "Consistent Creator"
              : "Growth Mode"}
          </span>
        </p>

        {/* Start Steps Title */}
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-3">
          Start Here — Your First 3 Steps
        </p>

        {/* THREE CLICKABLE STEP CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {steps.map((step) => {
            const completed = startStepsCompleted >= step.id;
            return (
              <button
                key={step.id}
                onClick={() => markStepCompleted(step.id)}
                className={`text-left p-4 rounded-xl border transition-all
                  ${
                    completed
                      ? "border-emerald-400/60 bg-emerald-600/10"
                      : "border-slate-700/70 bg-slate-900/60 hover:border-emerald-400/60 hover:bg-slate-900"
                  }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold
                      ${
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

                <p className="mt-1 text-[12px] text-slate-400">
                  {step.text}
                </p>

                {completed && (
                  <p className="mt-1 text-[11px] font-medium text-emerald-400">
                    ✓ Completed
                  </p>
                )}
              </button>
            );
          })}
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
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

          <p className="text-[11px] text-slate-400 mt-2">
            {startStepsCompleted}/3 steps completed
          </p>
        </div>

        {/* Today's Key Actions */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-100 mb-1">
            Today's Key Actions
          </h3>

          <ul className="space-y-2 text-[13px] text-slate-300">
            {creatorMode === "beginner" && (
              <>
                <li>• Connect 1–2 socials (TikTok or Instagram first)</li>
                <li>• Add 1 recurring affiliate offer</li>
                <li>• Generate 1 post today (keep it simple)</li>
              </>
            )}

            {creatorMode === "consistent" && (
              <>
                <li>• Connect all your active socials</li>
                <li>• Add best-performing offers</li>
                <li>• Create 2–3 optimized posts today</li>
              </>
            )}

            {creatorMode === "growth" && (
              <>
                <li>• Build a 7-day content campaign</li>
                <li>• Choose 1 recurring offer to push harder</li>
                <li>• Analyze niche trends for new angles</li>
              </>
            )}
          </ul>
        </div>

        {/* Improvements */}
        <div>
          <h3 className="text-sm font-semibold text-slate-100 mb-2">
            Improvements to boost revenue
          </h3>

          <ul className="space-y-2 text-[13px] text-slate-300">
            {creatorMode === "beginner" && (
              <>
                <li>• Add a recurring SaaS offer</li>
                <li>• Post daily small wins</li>
                <li>• Follow 5 creators in your niche</li>
              </>
            )}

            {creatorMode === "consistent" && (
              <>
                <li>• Start posting 2× per day for 7 days</li>
                <li>• Build a lead magnet funnel</li>
                <li>• Track hooks generating most comments</li>
              </>
            )}

            {creatorMode === "growth" && (
              <>
                <li>• Test 2–3 backend offers for higher EPC</li>
                <li>• Build a 3-email mini funnel</li>
                <li>• Increase posting frequency by 20%</li>
              </>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}