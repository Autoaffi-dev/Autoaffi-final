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

type ImageStyle = "personal" | "faceless" | "ready_made";

const DEFAULT_KEYWORDS = ["freedom", "clarity", "premium"];

const READY_IMAGES = [
  {
    id: "ready_1",
    title: "Faceless Countryside Walk",
    url: "https://images.pexels.com/photos/5205370/pexels-photo-5205370.jpeg",
    vibe: "Best if you want a calm faceless road-and-freedom feeling with a more natural premium tone.",
  },
  {
    id: "ready_2",
    title: "Winter Back-View Path",
    url: "https://images.pexels.com/photos/11210900/pexels-photo-11210900.jpeg",
    vibe: "Best if you want a clean back-view image with distance, direction and quiet confidence.",
  },
  {
    id: "ready_3",
    title: "Highlands Path Identity",
    url: "https://images.pexels.com/photos/6416198/pexels-photo-6416198.jpeg",
    vibe: "Best if you want a more elevated faceless identity with journey, ambition and premium depth.",
  },
  {
    id: "ready_4",
    title: "Night City Silhouette",
    url: "https://images.pexels.com/photos/9195089/pexels-photo-9195089.jpeg",
    vibe: "Best if you want a stronger city-night silhouette with more mystery and wow effect.",
  },
  {
    id: "ready_5",
    title: "Twilight Road Momentum",
    url: "https://images.pexels.com/photos/19642016/pexels-photo-19642016.jpeg",
    vibe: "Best if you want movement, back-view energy and a stronger feeling of forward motion.",
  },
  {
    id: "ready_6",
    title: "Mountain Freedom Back-View",
    url: "https://images.pexels.com/photos/4842144/pexels-photo-4842144.jpeg",
    vibe: "Best if you want a softer premium freedom image with a more scenic faceless direction.",
  },
];

function cleanKeyword(value: string) {
  return value.trim().toLowerCase();
}

function cleanSeed(value: string) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function hashString(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickBySeed<T>(items: readonly T[], seed: string, fallback: T): T {
  if (!items.length) return fallback;
  const index = hashString(seed || "autoaffi-ready-image") % items.length;
  return items[index] ?? fallback;
}

function deriveReadyImageDefault(stepState: any, creatorName: string) {
  const candidates = [
    stepState?.user_id,
    stepState?.profile?.id,
    stepState?.user?.id,
    stepState?.session?.user?.id,
    stepState?.autoaffi_user_code,
    stepState?.slug,
    stepState?.token,
    stepState?.profile?.email,
    stepState?.user?.email,
    stepState?.session?.user?.email,
    stepState?.email,
    creatorName,
  ]
    .map((v) => cleanSeed(v))
    .filter(Boolean);

  const seed = candidates[0] || "autoaffi-ready-image-default";
  return pickBySeed(READY_IMAGES, `${seed}-ready-image`, READY_IMAGES[0]).url;
}

function buildFacelessPrompt({
  platform,
  creatorName,
  keyword1,
  keyword2,
  keyword3,
}: {
  platform: PlatformKey;
  creatorName?: string;
  keyword1?: string;
  keyword2?: string;
  keyword3?: string;
}) {
  const keywords = [keyword1, keyword2, keyword3]
    .map((item) => cleanKeyword(item || ""))
    .filter(Boolean);

  const keywordLine = keywords.length
    ? `Primary mood keywords: ${keywords.join(", ")}.`
    : "Primary mood keywords: freedom, clarity, premium.";

  const creatorContext = creatorName?.trim()
    ? `The image should feel like a premium faceless identity for a creator brand connected to ${creatorName}.`
    : "The image should feel like a premium faceless identity for a modern creator or online brand.";

  return `Create a premium faceless profile image for ${platform}. ${creatorContext} ${keywordLine} The image must feel personal, trustworthy, intriguing and click-worthy without clearly showing the person's face. Focus on one strong subject only. Use premium lighting, elegant composition, cinematic mood, subtle emotion, black / gold / warm neutral tones or natural luxury tones when suitable. Prefer themes like freedom, nature, ambition, calm confidence, creator lifestyle, movement, possibility, depth, identity and premium simplicity. Avoid generic corporate office scenes, cheesy stock-photo smiles, text overlays, clutter, collage, crowds, fake marketing visuals or obvious AI weirdness. The final image must work well in a small circular profile crop and still feel strong, memorable and premium.`;
}

export default function Step2_ProfilePhoto({
  platform,
  stepState,
  onSaveAndContinue,
  saving,
}: Props) {
  const existing = stepState?.photo || {};

  const [imageStyle, setImageStyle] = useState<ImageStyle>(
    existing.image_style || "faceless"
  );

  const creatorName =
    stepState?.positioning?.display_name ||
    stepState?.positioning?.own_name ||
    stepState?.positioning?.brand_name ||
    "";

  const [keyword1, setKeyword1] = useState<string>(
    existing.keyword_1 || DEFAULT_KEYWORDS[0]
  );
  const [keyword2, setKeyword2] = useState<string>(
    existing.keyword_2 || DEFAULT_KEYWORDS[1]
  );
  const [keyword3, setKeyword3] = useState<string>(
    existing.keyword_3 || DEFAULT_KEYWORDS[2]
  );

  const generatedPrompt = useMemo(() => {
    return buildFacelessPrompt({
      platform,
      creatorName,
      keyword1,
      keyword2,
      keyword3,
    });
  }, [platform, creatorName, keyword1, keyword2, keyword3]);

  const [manualPrompt, setManualPrompt] = useState<string>(
    existing.prompt || generatedPrompt
  );

  const [readyImageChoice, setReadyImageChoice] = useState<string>(
    deriveReadyImageDefault(stepState, creatorName)
  );

  const selectedReadyImage = useMemo(
    () => READY_IMAGES.find((img) => img.url === readyImageChoice) || READY_IMAGES[0],
    [readyImageChoice]
  );

  const activePrompt = imageStyle === "faceless" ? generatedPrompt : manualPrompt;

  async function handleContinue() {
    await onSaveAndContinue({
      photo: {
        done: true,
        completed: true,
        image_style: imageStyle,
        prompt: activePrompt,
        keyword_1: keyword1,
        keyword_2: keyword2,
        keyword_3: keyword3,
        ready_image_choice: readyImageChoice,
        ready_image_title: selectedReadyImage.title,
      },
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
        <p className="text-xs uppercase tracking-[0.16em] text-white/40">Step 2</p>
        <h4 className="mt-2 text-2xl font-extrabold text-white">
          Choose a profile image that feels premium, personal and worth clicking
        </h4>
        <p className="mt-2 text-sm text-white/65">
          This image should make your profile feel stronger instantly. Autoaffi is moving more
          toward faceless premium identity, freedom, lifestyle, nature and curiosity — not generic
          business stock.
        </p>
      </div>

      <div className="grid gap-5">
        <div className="grid gap-5 xl:grid-cols-3">
          <button
            type="button"
            onClick={() => setImageStyle("personal")}
            className={`rounded-[24px] border p-5 text-left transition ${
              imageStyle === "personal"
                ? "border-yellow-400/30 bg-yellow-500/10"
                : "border-white/10 bg-black/20 hover:bg-white/[0.04]"
            }`}
          >
            <p className="text-xs uppercase tracking-[0.16em] text-white/40">Option A</p>
            <p className="mt-2 text-lg font-bold text-white">Use your own photo</p>
            <p className="mt-2 text-sm text-white/70">
              Best if you want the strongest trust and a direct personal identity.
            </p>
            <div className="mt-4 space-y-2 text-sm text-white/75">
              <p>• Clear face</p>
              <p>• Premium lighting</p>
              <p>• Clean background</p>
              <p>• Strong even in small circle crop</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setImageStyle("faceless")}
            className={`rounded-[24px] border p-5 text-left transition ${
              imageStyle === "faceless"
                ? "border-yellow-400/30 bg-yellow-500/10"
                : "border-white/10 bg-black/20 hover:bg-white/[0.04]"
            }`}
          >
            <p className="text-xs uppercase tracking-[0.16em] text-white/40">Option B</p>
            <p className="mt-2 text-lg font-bold text-white">Use a faceless premium prompt</p>
            <p className="mt-2 text-sm text-white/70">
              Best if you want a stronger identity without showing your face. This is the main
              Autoaffi direction.
            </p>
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white/85">
              Add 1–3 keywords and Autoaffi builds a stronger prompt for you.
            </div>
          </button>

          <button
            type="button"
            onClick={() => setImageStyle("ready_made")}
            className={`rounded-[24px] border p-5 text-left transition ${
              imageStyle === "ready_made"
                ? "border-yellow-400/30 bg-yellow-500/10"
                : "border-white/10 bg-black/20 hover:bg-white/[0.04]"
            }`}
          >
            <p className="text-xs uppercase tracking-[0.16em] text-white/40">Option C</p>
            <p className="mt-2 text-lg font-bold text-white">Use a beast faceless visual</p>
            <p className="mt-2 text-sm text-white/70">
              Best if you want the fastest premium option. These visuals are more aligned with the
              stronger Autoaffi beast direction and a more memorable faceless identity.
            </p>
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white/85">
              Pick one beast-style image and use it directly.
            </div>
          </button>
        </div>

        {imageStyle === "personal" && (
          <div className="rounded-[24px] border border-emerald-400/15 bg-emerald-500/5 p-5">
            <p className="text-sm font-semibold text-emerald-200">What to use</p>
            <div className="mt-3 space-y-2 text-sm text-emerald-100/85">
              <p>• Use a photo where your face is easy to see</p>
              <p>• Avoid messy background and low light</p>
              <p>• Make sure it still looks strong when cropped small</p>
              <p>• Upload this as your {platform} profile image</p>
            </div>
          </div>
        )}

        {imageStyle === "faceless" && (
          <div className="rounded-[24px] border border-yellow-400/15 bg-yellow-500/5 p-5">
            <p className="text-sm font-semibold text-yellow-200">
              Build your faceless premium image prompt
            </p>
            <p className="mt-1 text-xs text-yellow-100/75">
              Add 1–3 keywords and Autoaffi generates a more unique prompt. Good keyword examples:
              freedom, luxury, nature, calm, ambition, feminine, masculine, premium, travel,
              clarity, mystery.
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <input
                value={keyword1}
                onChange={(e) => setKeyword1(e.target.value)}
                placeholder="Keyword 1"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-yellow-400/30"
              />
              <input
                value={keyword2}
                onChange={(e) => setKeyword2(e.target.value)}
                placeholder="Keyword 2"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-yellow-400/30"
              />
              <input
                value={keyword3}
                onChange={(e) => setKeyword3(e.target.value)}
                placeholder="Keyword 3"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-yellow-400/30"
              />
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-white/40">
                Auto-generated prompt
              </p>
              <textarea
                value={generatedPrompt}
                readOnly
                rows={10}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none"
              />
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/75">
              Paste this into ChatGPT image generation, create your image, then upload it as your{" "}
              {platform} profile image.
            </div>
          </div>
        )}

        {imageStyle === "ready_made" && (
          <div className="rounded-[24px] border border-yellow-400/15 bg-yellow-500/5 p-5">
            <p className="text-sm font-semibold text-yellow-200">
              Choose your beast faceless profile visual
            </p>
            <p className="mt-1 text-xs text-yellow-100/75">
              These are stronger faceless visuals chosen to feel more premium, more intriguing and
              more memorable than generic stock imagery.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {READY_IMAGES.map((image) => {
                const active = readyImageChoice === image.url;

                return (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => setReadyImageChoice(image.url)}
                    className={`overflow-hidden rounded-2xl border text-left transition ${
                      active
                        ? "border-yellow-400/30 bg-yellow-500/10"
                        : "border-white/10 bg-black/20 hover:bg-white/[0.04]"
                    }`}
                  >
                    <img
                      src={image.url}
                      alt={image.title}
                      className="h-44 w-full object-cover"
                    />
                    <div className="p-3">
                      <p className="text-sm font-medium text-white">{image.title}</p>
                      <p className="mt-1 text-xs text-white/55">{image.vibe}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/75">
              Selected image:{" "}
              <span className="font-semibold text-white">{selectedReadyImage.title}</span>
            </div>
          </div>
        )}

        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-5">
            <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
              <p className="text-sm font-semibold text-white">Why this matters</p>
              <div className="mt-3 space-y-2 text-sm text-white/75">
                <p>• A stronger profile image makes more people curious</p>
                <p>• It helps the page feel more real and memorable</p>
                <p>• It improves the first impression instantly</p>
                <p>• A better image makes the account feel more worth clicking</p>
              </div>
            </div>

            <div className="rounded-[24px] border border-emerald-400/15 bg-emerald-500/5 p-5">
              <p className="text-sm font-semibold text-emerald-200">Where this goes</p>
              <div className="mt-3 space-y-2 text-sm text-emerald-100/85">
                <p>• Upload this as your visible profile image on {platform}</p>
                <p>• Keep it simple and easy to read in small size</p>
                <p>• Use one image only, not a collage</p>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
            <p className="text-sm font-semibold text-white">Your chosen direction</p>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/80">
              {imageStyle === "personal" && (
                <>
                  <p className="font-semibold text-white">Use your own photo</p>
                  <p className="mt-2">
                    Upload a clean, trustworthy and easy-to-see photo as your profile image.
                  </p>
                </>
              )}

              {imageStyle === "faceless" && (
                <>
                  <p className="font-semibold text-white">Use a faceless premium image</p>
                  <p className="mt-2">
                    Autoaffi generated a more unique faceless prompt using your chosen keywords.
                  </p>
                  <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-white/75">
                    Keywords: {[keyword1, keyword2, keyword3].filter(Boolean).join(", ") || "None"}
                  </div>
                </>
              )}

              {imageStyle === "ready_made" && (
                <>
                  <p className="font-semibold text-white">Use a beast faceless visual</p>
                  <p className="mt-2">
                    Chosen visual:{" "}
                    <span className="font-semibold text-white">{selectedReadyImage.title}</span>
                  </p>
                  <p className="mt-2 text-white/65">{selectedReadyImage.vibe}</p>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={handleContinue}
              disabled={saving}
              className="mt-5 rounded-2xl bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 px-5 py-3 text-sm font-bold text-black transition hover:scale-[1.01] disabled:opacity-60"
            >
              {saving ? "Saving..." : "Use This & Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}