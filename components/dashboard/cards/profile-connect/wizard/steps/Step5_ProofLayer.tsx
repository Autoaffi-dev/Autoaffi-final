"use client";

import { useState } from "react";
import type { PlatformKey, StepPayload } from "@/lib/profile-connect/engine/types";

type Props = {
  platform: PlatformKey;
  payload: StepPayload;
  stepState: any;
  onSave: (patch: Record<string, any>) => Promise<void> | void;
  onSaveAndContinue: (patch: Record<string, any>) => Promise<void> | void;
  saving: boolean;
};

type TrustMode = "simple" | "authority" | "soft";

const TRUST_OPTIONS: Record<
  TrustMode,
  {
    title: string;
    description: string;
    highlightTitles: string;
    highlightText1: string;
    highlightText2: string;
    highlightText3: string;
  }
> = {
  simple: {
    title: "Simple trust setup",
    description:
      "Best if you want the easiest version. Clear, beginner-friendly and easy to use.",
    highlightTitles: "START, TOOLS, PROOF, FAQ",
    highlightText1:
      "New here? Start with this. This page is built to make the next step feel simpler and clearer.",
    highlightText2:
      "These are the tools, systems or products I use to keep things simple and effective.",
    highlightText3:
      "Questions? Start here. This is the easiest way to understand how everything works.",
  },
  authority: {
    title: "Authority trust setup",
    description:
      "Best if you want your profile to feel more expert, structured and premium.",
    highlightTitles: "START, METHOD, RESULTS, FAQ",
    highlightText1:
      "This is how the system works. Clear setup, better positioning and a stronger path forward.",
    highlightText2:
      "This is the method behind the page: simpler decisions, stronger direction and better execution.",
    highlightText3:
      "Common questions answered clearly so the profile feels more trustworthy and easy to follow.",
  },
  soft: {
    title: "Soft beginner-friendly setup",
    description:
      "Best if you want the profile to feel more welcoming, friendly and low-pressure.",
    highlightTitles: "START, HELP, TOOLS, FAQ",
    highlightText1:
      "If you’re new, start here. This page is made to feel easier, calmer and more beginner-friendly.",
    highlightText2:
      "This is how I help people choose better tools, simpler systems and clearer next steps.",
    highlightText3:
      "If anything feels confusing, start here. This makes the page feel safer and easier to understand.",
  },
};

export default function Step5_ProofLayer({
  platform,
  stepState,
  onSaveAndContinue,
  saving,
}: Props) {
  const existing = stepState?.proof || {};
  const [trustMode, setTrustMode] = useState<TrustMode>(existing.trust_mode || "simple");

  const active = TRUST_OPTIONS[trustMode];

  const [highlightTitles, setHighlightTitles] = useState<string>(
    existing.highlight_titles || active.highlightTitles
  );
  const [highlightText1, setHighlightText1] = useState<string>(
    existing.highlight_text_1 || active.highlightText1
  );
  const [highlightText2, setHighlightText2] = useState<string>(
    existing.highlight_text_2 || active.highlightText2
  );
  const [highlightText3, setHighlightText3] = useState<string>(
    existing.highlight_text_3 || active.highlightText3
  );

  function chooseMode(mode: TrustMode) {
    setTrustMode(mode);
    const next = TRUST_OPTIONS[mode];
    setHighlightTitles(next.highlightTitles);
    setHighlightText1(next.highlightText1);
    setHighlightText2(next.highlightText2);
    setHighlightText3(next.highlightText3);
  }

  async function handleContinue() {
    await onSaveAndContinue({
      proof: {
        done: true,
        completed: true,
        trust_mode: trustMode,
        summary: active.description,
        highlight_titles: highlightTitles,
        highlight_text_1: highlightText1,
        highlight_text_2: highlightText2,
        highlight_text_3: highlightText3,
      },
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
        <p className="text-xs uppercase tracking-[0.16em] text-white/40">Step 5</p>
        <h4 className="mt-2 text-2xl font-extrabold text-white">
          Make your profile look more trustworthy
        </h4>
        <p className="mt-2 text-sm text-white/65">
          This step gives you ready-made trust elements so your profile feels more real, more useful
          and easier to trust.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-5">
          <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
            <p className="text-sm font-semibold text-white">Choose your trust style</p>

            <div className="mt-4 grid gap-3">
              {(["simple", "authority", "soft"] as const).map((mode) => {
                const option = TRUST_OPTIONS[mode];
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => chooseMode(mode)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      trustMode === mode
                        ? "border-yellow-400/30 bg-yellow-500/10"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                    }`}
                  >
                    <p className="text-sm font-semibold text-white">{option.title}</p>
                    <p className="mt-2 text-sm text-white/70">{option.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[24px] border border-emerald-400/15 bg-emerald-500/5 p-5">
            <p className="text-sm font-semibold text-emerald-200">Where this goes</p>
            <div className="mt-3 space-y-2 text-sm text-emerald-100/85">
              <p>• Copy these as your highlight / featured titles</p>
              <p>• Use the text below in your highlight stories, featured notes or trust posts</p>
              <p>• This makes the profile feel clearer and more trustworthy</p>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
            <p className="text-sm font-semibold text-white">Why this is easier</p>
            <div className="mt-3 space-y-2 text-sm text-white/75">
              <p>• You do not need to invent a trust system yourself</p>
              <p>• Autoaffi already prepared the titles and text</p>
              <p>• You just copy what fits your profile best</p>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[24px] border border-yellow-400/15 bg-yellow-500/5 p-5">
            <p className="text-sm font-semibold text-yellow-200">
              Copy these highlight / featured titles
            </p>
            <p className="mt-1 text-xs text-yellow-100/75">
              Paste these into your {platform} trust elements.
            </p>

            <input
              value={highlightTitles}
              onChange={(e) => setHighlightTitles(e.target.value)}
              className="mt-4 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-yellow-400/30"
            />
          </div>

          <div className="rounded-[24px] border border-yellow-400/15 bg-yellow-500/5 p-5">
            <p className="text-sm font-semibold text-yellow-200">Trust text 1</p>
            <p className="mt-1 text-xs text-yellow-100/75">
              Paste this into your first trust story / first featured text block.
            </p>
            <textarea
              value={highlightText1}
              onChange={(e) => setHighlightText1(e.target.value)}
              rows={4}
              className="mt-4 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-yellow-400/30"
            />
          </div>

          <div className="rounded-[24px] border border-yellow-400/15 bg-yellow-500/5 p-5">
            <p className="text-sm font-semibold text-yellow-200">Trust text 2</p>
            <p className="mt-1 text-xs text-yellow-100/75">
              Paste this into your second trust story / second featured text block.
            </p>
            <textarea
              value={highlightText2}
              onChange={(e) => setHighlightText2(e.target.value)}
              rows={4}
              className="mt-4 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-yellow-400/30"
            />
          </div>

          <div className="rounded-[24px] border border-yellow-400/15 bg-yellow-500/5 p-5">
            <p className="text-sm font-semibold text-yellow-200">Trust text 3</p>
            <p className="mt-1 text-xs text-yellow-100/75">
              Paste this into your FAQ / proof / final trust story block.
            </p>
            <textarea
              value={highlightText3}
              onChange={(e) => setHighlightText3(e.target.value)}
              rows={4}
              className="mt-4 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-yellow-400/30"
            />
          </div>

          <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
            <p className="text-sm font-semibold text-white">Copy-paste result</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white">
                <p className="text-xs uppercase tracking-[0.16em] text-white/40">
                  Highlight / featured titles
                </p>
                <p className="mt-2">{highlightTitles}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white">
                <p className="text-xs uppercase tracking-[0.16em] text-white/40">Trust setup style</p>
                <p className="mt-2">{active.title}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-emerald-400/15 bg-emerald-500/5 p-5">
            <button
              type="button"
              onClick={handleContinue}
              disabled={saving}
              className="rounded-2xl bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 px-5 py-3 text-sm font-bold text-black transition hover:scale-[1.01] disabled:opacity-60"
            >
              {saving ? "Saving..." : "Use This & Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}