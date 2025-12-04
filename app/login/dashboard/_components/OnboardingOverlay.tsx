"use client";

import React from "react";

export default function OnboardingOverlay({
  stage,
  aiMessage,
  handleWelcomeContinue,
  handlePersonaSelect,
  handlePathSelect,
  onSkip,
}: {
  stage: string;
  aiMessage: string;
  handleWelcomeContinue: () => void;
  handlePersonaSelect: (mode: "beginner" | "consistent" | "growth") => void;
  handlePathSelect: (path: "beginner" | "pro" | "elite") => void;
  onSkip: () => void;
}) {
  const showWelcome = stage === "welcome";
  const showPersona = stage === "persona";
  const showPath = stage === "path";

  // No overlay during spotlight or 3-step intro
  if (!showWelcome && !showPersona && !showPath) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/45 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-950/90 border border-emerald-400/40 rounded-2xl shadow-2xl px-7 py-7">

        {/* WELCOME */}
        {showWelcome && (
          <>
            <h2 className="text-lg font-semibold text-emerald-300 mb-2 text-center">
              Welcome to Autoaffi 🚀
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed mb-6 text-center">
              {aiMessage}
            </p>

            <button
              onClick={handleWelcomeContinue}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-semibold"
            >
              Continue
            </button>

<button
  onClick={() => onSkip()}
  className="mt-3 w-full text-xs text-slate-400 hover:text-slate-200 text-center"
>
  Skip tour
</button>
          </>
        )}

        {/* PERSONA */}
        {showPersona && (
          <>
            <h2 className="text-lg font-semibold text-emerald-300 mb-3 text-center">
              Choose your creator style
            </h2>

            <div className="space-y-3 text-sm">
              <button
                onClick={() => handlePersonaSelect("beginner")}
                className="block w-full p-3 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-emerald-300/40"
              >
                <p className="text-emerald-300 font-semibold mb-1">Beginner</p>
                <p className="text-slate-400 text-xs">
                  Perfect if you’re just starting or coming back after a break.
  I’ll keep things simple, remove overwhelm and focus on quick,
  clear wins. You’ll get extra guidance and a softer learning
  curve — with your first 3 steps always in focus.
                </p>
              </button>

              <button
                onClick={() => handlePersonaSelect("consistent")}
                className="block w-full p-3 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-emerald-300/40"
              >
                <p className="text-emerald-300 font-semibold mb-1">Consistent</p>
                <p className="text-slate-400 text-xs">
                    Great if you already post but want more structure and smarter
  guidance. I’ll help you tighten your routine, identify what works,
  and turn “showing up” into steady growth and compounding results.
                </p>
              </button>

              <button
                onClick={() => handlePersonaSelect("growth")}
                className="block w-full p-3 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-emerald-300/40"
              >
                <p className="text-emerald-300 font-semibold mb-1">Growth</p>
                <p className="text-slate-400 text-xs">
                  Choose this if you’re ready to scale. We’ll focus on recurring
  income, funnels, optimization and higher EPC — so your content
  behaves more like a business, not just posts.
                </p>
              </button>
            </div>
          </>
        )}

        {/* PATH SELECT */}
        {showPath && (
          <>
            <h2 className="text-lg font-semibold text-emerald-300 mb-3 text-center">
              Choose your starting path
            </h2>

            <div className="space-y-3 text-sm">
              <button
                onClick={() => handlePathSelect("beginner")}
                className="block w-full p-3 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-emerald-300/40"
              >
                <p className="text-emerald-300 font-semibold mb-1">Beginner Setup</p>
                <p className="text-slate-400 text-xs">
                    A clean, focused layout that hides distractions and highlights
  only what moves you forward now: your core setup, your first
  offers and your first pieces of content.
                </p>
              </button>

              <button
                onClick={() => handlePathSelect("pro")}
                className="block w-full p-3 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-emerald-300/40"
              >
                <p className="text-emerald-300 font-semibold mb-1">Pro Creator</p>
                <p className="text-slate-400 text-xs">
                   Ideal if you already create regularly and want better
  organization, smarter planning and smoother workflows. You’ll
  see campaigns, content and offers come together clearly.
                </p>
              </button>

              <button
                onClick={() => handlePathSelect("elite")}
                className="block w-full p-3 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-emerald-300/40"
              >
                <p className="text-emerald-300 font-semibold mb-1">Elite Growth</p>
                <p className="text-slate-400 text-xs">
                  For creators who want to scale hard. Funnels, recurring
  programs, tracking and optimization take center stage so you
  can grow like a serious business — with clarity on every move.
                </p>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}