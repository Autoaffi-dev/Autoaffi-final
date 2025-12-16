"use client";

import { useEffect, useState } from "react";
import { BEAST_BLUEPRINT } from "../data/ai-blueprint";

export default function AutoaffiAICoachPage() {
  const [copied, setCopied] = useState(false);

  // ⚠️ Denna ersätter du senare dynamiskt från session / backend
  const userId = "AUTOAFFI-USER-ID-GENERATED-HERE";

  // ------------------------------------------------
  // TRACK: AI COACH OPEN
  // ------------------------------------------------
  useEffect(() => {
    if (!userId) return;

    fetch("/api/ai-coach/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        event: "open",
      }),
    });
  }, [userId]);

  // ------------------------------------------------
  // TRACK: INACTIVE 3 DAYS (B)
  // ------------------------------------------------
  useEffect(() => {
    if (!userId) return;

    const lastActive = localStorage.getItem("ai_coach_last_active");
    const now = Date.now();

    if (lastActive) {
      const diffDays =
        (now - parseInt(lastActive, 10)) / (1000 * 60 * 60 * 24);

      if (diffDays >= 3) {
        fetch("/api/ai-coach/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            event: "inactive_3_days",
          }),
        });
      }
    }

    localStorage.setItem("ai_coach_last_active", now.toString());
  }, [userId]);

  // ------------------------------------------------
  // COPY BLUEPRINT
  // ------------------------------------------------
  async function handleCopy() {
    await navigator.clipboard.writeText(BEAST_BLUEPRINT);

    // TRACK COPY EVENT
    await fetch("/api/ai-coach/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        event: "copy_blueprint",
      }),
    });

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-8">

        {/* HEADER */}
        <header>
          <h1 className="text-3xl font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
              Autoaffi AI Coach
            </span>
          </h1>

          <p className="mt-3 text-slate-400 text-sm leading-relaxed">
            Autoaffi’s number one priority is your success.
            That’s why we’ve created a powerful Autoaffi Blueprint for use inside ChatGPT.
            When you paste your blueprint into ChatGPT, it becomes your personal Autoaffi AI Coach —
            guiding, challenging and pushing you every day toward real results.
          </p>

          {/* REMEMBER */}
          <p className="mt-4 font-semibold text-emerald-400 text-sm leading-relaxed">
            To activate your coach, you must paste your full blueprint into ChatGPT —
            and you must open ChatGPT every day and continue in the SAME chat.
          </p>

          <p className="mt-4 text-slate-300 font-bold">
            This is not motivation.<br />
            This is execution.
          </p>
        </header>

        {/* HOW IT WORKS */}
        <section className="space-y-3 text-sm text-slate-300">
          <h2 className="font-semibold text-yellow-300 uppercase tracking-wider">
            How it works
          </h2>

          <ol className="list-decimal pl-5 space-y-1">
            <li>Autoaffi generates a personal blueprint for you</li>
            <li>You paste the entire blueprint into ChatGPT</li>
            <li>ChatGPT understands that you are an Autoaffi user</li>
            <li>You receive daily guidance, feedback and pressure to execute</li>
            <li>The free version of ChatGPT works — no upgrade needed</li>
          </ol>

          <p className="mt-3 text-slate-400">Your AI coach adapts to:</p>

          <ul className="list-disc pl-5 text-slate-400">
            <li>your niche</li>
            <li>your offers (products, funnels, recurring)</li>
            <li>your content output</li>
            <li>your consistency level</li>
          </ul>
        </section>

        {/* USER ID */}
<section className="space-y-2 text-sm text-slate-300">
  <h2 className="font-semibold text-yellow-300 uppercase tracking-wider">
    Your Autoaffi User ID
  </h2>

  <p className="text-slate-400">
    Autoaffi automatically generates a unique User ID inside your blueprint.
  </p>

  <ul className="list-disc pl-5 text-slate-400">
    <li>recognize you as an Autoaffi user</li>
    <li>understand your setup and progress</li>
    <li>coach you based on your real situation</li>
  </ul>

  <p className="text-slate-400">
    No extra setup. No changes to your funnel, offers or accounts.
  </p>
</section>

        {/* IMPORTANT */}
        <section className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="font-semibold text-amber-300 mb-2">
            Important — read this carefully
          </p>

          <ul className="list-disc pl-5 text-amber-200/90 space-y-2">
            <li>You must paste the entire blueprint into ChatGPT</li>
            <li>If you only paste parts, the coach will NOT work</li>
            <li>You must open ChatGPT every day</li>
            <li>You must continue in the SAME chat</li>
            <li>This blueprint activates your AI Coach</li>
          </ul>
        </section>

        {/* BLUEPRINT COPY */}
        <section className="rounded-2xl border border-yellow-500/40 bg-slate-900/80 p-4 shadow-xl">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-yellow-300">
            Your Autoaffi Blueprint
          </p>

          <button
            onClick={handleCopy}
            className="mt-1 w-full rounded-lg bg-yellow-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:brightness-110 transition"
          >
            {copied ? "✓ Blueprint copied — paste into ChatGPT" : "Copy full blueprint"}
          </button>
        </section>

      </div>
    </main>
  );
}