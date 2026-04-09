"use client";

import { useMemo, useState } from "react";
import type { PlatformKey, StepPayload } from "@/lib/profile-connect/engine/types";

type Props = {
  platform: PlatformKey;
  payload: StepPayload;
  stepState: any;
  onSave: (patch: Record<string, any>) => Promise<void> | void;
  onSaveAndContinue: (patch: Record<string, any>) => Promise<void> | void;
  saving: boolean;
};

function buildDefaultPins(platform: PlatformKey) {
  return {
    pin1Text:
      `START HERE\n` +
      `If you’re new, this is the easiest place to begin.\n` +
      `This profile is built to make the next step feel simpler, clearer and easier to follow.\n` +
      `CTA: Start here first.`,

    pin2Text:
      `WHY THIS WORKS\n` +
      `Most people struggle because everything feels messy and hard to follow.\n` +
      `This page is built to make the process feel more clear, calm and structured.\n` +
      `CTA: This is why the system is worth following.`,

    pin3Text:
      `YOUR NEXT STEP\n` +
      `Want the exact setup or next move?\n` +
      `Use the link or DM "START" and take the easiest next step.\n` +
      `CTA: Start here now ✅`,

    pin1Prompt:
      `Create a premium social media post visual for a "${platform}" profile. The purpose is to make a new visitor feel welcomed and curious. The design should feel clear, modern, premium and beginner-friendly. Use elegant composition, a single strong focus point, subtle black / gold / neutral tones, soft contrast and a simple motivational growth feeling. No clutter. No collage. No text inside the image.`,

    pin2Prompt:
      `Create a premium trust-building social media visual for a "${platform}" profile. The purpose is to make the profile feel more trustworthy, structured and worth following. The image should feel premium, calm, high-trust and professional. Use black / gold / neutral tones, a modern elegant composition, a sense of clarity and proof, and a strong visual identity. No clutter. No collage. No text inside the image.`,

    pin3Prompt:
      `Create a premium conversion-focused social media visual for a "${platform}" profile. The purpose is to make the viewer feel ready to take the next step. The image should feel action-oriented, premium, clean and compelling. Use elegant black / gold / neutral tones, a strong focal point, a sense of momentum and curiosity, and a simple high-end visual direction. No clutter. No collage. No text inside the image.`,
  };
}

export default function Step6_PinnedTrio({
  platform,
  stepState,
  onSaveAndContinue,
  saving,
}: Props) {
  const existing = stepState?.pinned || {};
  const defaults = useMemo(() => buildDefaultPins(platform), [platform]);

  const [pin1Text, setPin1Text] = useState<string>(existing.pin1_text || defaults.pin1Text);
  const [pin2Text, setPin2Text] = useState<string>(existing.pin2_text || defaults.pin2Text);
  const [pin3Text, setPin3Text] = useState<string>(existing.pin3_text || defaults.pin3Text);

  const [pin1Prompt, setPin1Prompt] = useState<string>(
    existing.pin1_prompt || defaults.pin1Prompt
  );
  const [pin2Prompt, setPin2Prompt] = useState<string>(
    existing.pin2_prompt || defaults.pin2Prompt
  );
  const [pin3Prompt, setPin3Prompt] = useState<string>(
    existing.pin3_prompt || defaults.pin3Prompt
  );

  async function handleContinue() {
    await onSaveAndContinue({
      pinned: {
        done: true,
        completed: true,
        pin1_text: pin1Text,
        pin2_text: pin2Text,
        pin3_text: pin3Text,
        pin1_prompt: pin1Prompt,
        pin2_prompt: pin2Prompt,
        pin3_prompt: pin3Prompt,
        notes: [pin1Text, pin2Text, pin3Text].join("\n\n"),
      },
    });
  }

  const cards = [
    {
      title: "Pin 1 — START",
      helper:
        "This is the first pinned post / featured asset. It should explain the page and welcome new visitors.",
      text: pin1Text,
      setText: setPin1Text,
      prompt: pin1Prompt,
      setPrompt: setPin1Prompt,
      pasteTextWhere: `Use this as your first pinned post / featured asset on ${platform}`,
      promptWhere: "Paste this prompt into ChatGPT to generate the visual for Pin 1",
    },
    {
      title: "Pin 2 — PROOF",
      helper:
        "This builds trust. It should make the profile feel more real, more useful and more structured.",
      text: pin2Text,
      setText: setPin2Text,
      prompt: pin2Prompt,
      setPrompt: setPin2Prompt,
      pasteTextWhere: `Use this as your second pinned post / featured asset on ${platform}`,
      promptWhere: "Paste this prompt into ChatGPT to generate the visual for Pin 2",
    },
    {
      title: "Pin 3 — OFFER",
      helper:
        "This is the conversion asset. It should tell people what the next step is and make action feel easy.",
      text: pin3Text,
      setText: setPin3Text,
      prompt: pin3Prompt,
      setPrompt: setPin3Prompt,
      pasteTextWhere: `Use this as your third pinned post / featured asset on ${platform}`,
      promptWhere: "Paste this prompt into ChatGPT to generate the visual for Pin 3",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
        <p className="text-xs uppercase tracking-[0.16em] text-white/40">Step 6</p>
        <h4 className="mt-2 text-2xl font-extrabold text-white">
          Choose your 3 pinned assets
        </h4>
        <p className="mt-2 text-sm text-white/65">
          Autoaffi gives you the text and the image prompt for each pinned asset. This makes it much
          easier to build a profile that explains, proves and converts.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-5">
          <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
            <p className="text-sm font-semibold text-white">What these 3 pins do</p>
            <div className="mt-3 space-y-2 text-sm text-white/75">
              <p>• Pin 1 explains the page</p>
              <p>• Pin 2 makes the profile feel more trustworthy</p>
              <p>• Pin 3 tells people what to do next</p>
              <p>• Together they make the profile feel more intentional and easier to understand</p>
            </div>
          </div>

          <div className="rounded-[24px] border border-emerald-400/15 bg-emerald-500/5 p-5">
            <p className="text-sm font-semibold text-emerald-200">Where this goes</p>
            <div className="mt-3 space-y-2 text-sm text-emerald-100/85">
              <p>• Use these as your 3 pinned posts / featured assets</p>
              <p>• Use the text as the post direction / main copy</p>
              <p>• Use the prompt in ChatGPT to create the matching image</p>
              <p>• Keep the order: START → PROOF → OFFER</p>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
            <p className="text-sm font-semibold text-white">Why this is strong</p>
            <div className="mt-3 space-y-2 text-sm text-white/75">
              <p>• You do not need to invent the content idea yourself</p>
              <p>• You do not need to invent the visual direction yourself</p>
              <p>• Autoaffi gives you both the post text and the visual prompt</p>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {cards.map((card) => (
            <div
              key={card.title}
              className="rounded-[24px] border border-yellow-400/15 bg-yellow-500/5 p-5"
            >
              <p className="text-sm font-semibold text-yellow-200">{card.title}</p>
              <p className="mt-1 text-xs text-yellow-100/75">{card.helper}</p>

              <div className="mt-4">
                <label className="text-xs uppercase tracking-[0.16em] text-white/40">
                  Post text
                </label>
                <textarea
                  value={card.text}
                  onChange={(e) => card.setText(e.target.value)}
                  rows={7}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-yellow-400/30"
                />
                <p className="mt-2 text-xs text-emerald-300">{card.pasteTextWhere}</p>
              </div>

              <div className="mt-5">
                <label className="text-xs uppercase tracking-[0.16em] text-white/40">
                  ChatGPT image prompt
                </label>
                <textarea
                  value={card.prompt}
                  onChange={(e) => card.setPrompt(e.target.value)}
                  rows={7}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-yellow-400/30"
                />
                <p className="mt-2 text-xs text-emerald-300">{card.promptWhere}</p>
              </div>
            </div>
          ))}

          <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
            <p className="text-sm font-semibold text-white">Simple rule</p>
            <div className="mt-3 space-y-2 text-sm text-white/75">
              <p>• Pin 1 = make people understand</p>
              <p>• Pin 2 = make people trust</p>
              <p>• Pin 3 = make people act</p>
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
