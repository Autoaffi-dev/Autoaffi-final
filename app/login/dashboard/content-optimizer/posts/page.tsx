"use client";

import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import Link from "next/link";
import SEOEngine from "@/components/content-optimizer/SEOEngine";

type Mode = "content_only" | "content_and_offer" | "offer_only";
type InputStyle = "manual" | "scan_link";
type PlatformKey = "tiktok" | "instagram" | "facebook" | "youtube";

// Simple clipboard helper
async function copyToClipboard(text: string) {
  try {
    if (!text) return;
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.error("Clipboard error", err);
  }
}

const platformImageGuidelines: Record<
  PlatformKey,
  {
    name: string;
    ratio: string;
    resolution: string;
    min: string;
    maxFileSizeMB: number;
  }
> = {
  tiktok: {
    name: "TikTok",
    ratio: "9:16",
    resolution: "1080×1920",
    min: "600×1067",
    maxFileSizeMB: 5,
  },
  instagram: {
    name: "Instagram Reels",
    ratio: "9:16",
    resolution: "1080×1920",
    min: "600×1067",
    maxFileSizeMB: 5,
  },
  facebook: {
    name: "Facebook Feed",
    ratio: "4:5",
    resolution: "1080×1350",
    min: "600×750",
    maxFileSizeMB: 5,
  },
  youtube: {
    name: "YouTube Shorts",
    ratio: "9:16",
    resolution: "1080×1920",
    min: "600×1067",
    maxFileSizeMB: 5,
  },
};

export default function PostOptimizerPage() {
  const [mode, setMode] = useState<Mode>("content_and_offer");
  const [inputStyle, setInputStyle] = useState<InputStyle>("manual");
  const [platform, setPlatform] = useState<PlatformKey>("tiktok");

  const [keywords, setKeywords] = useState("");
  const [offerIdea, setOfferIdea] = useState("");
  const [manualLink, setManualLink] = useState("");

  const [selectedHookIndex, setSelectedHookIndex] = useState<number>(0);
  const [customHook, setCustomHook] = useState("");
  const [caption, setCaption] = useState("");
  const [body, setBody] = useState("");
  const [selectedCTA, setSelectedCTA] = useState<string>("Link in bio");

  const [hasGenerated, setHasGenerated] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string>("");

  // IMAGE STATE
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string>("");

  const baseTopic = useMemo(() => {
    if (offerIdea.trim()) return offerIdea.trim();
    if (keywords.trim()) return keywords.trim();
    return "your niche";
  }, [offerIdea, keywords]);

  const suggestedOffers = useMemo(() => {
    if (!baseTopic) return [];
    const short =
      baseTopic.length > 24 ? baseTopic.slice(0, 24) + "…" : baseTopic;
    return [
      {
        name: `${short} – Starter`,
        network: "Digistore24",
        tag: "Recurring",
      },
      {
        name: `${short} – Accelerator`,
        network: "MyLead",
        tag: "Fast approvals",
      },
      {
        name: `${short} – Evergreen Program`,
        network: "CPAlead",
        tag: "High EPC",
      },
    ];
  }, [baseTopic]);

  const hookOptions = useMemo(() => {
    const topic = baseTopic || "this offer";
    const linkHint = manualLink ? " (link in bio)" : "";
    return [
      `No one is talking about ${topic} like this${linkHint}…`,
      `If I had to start from 0 with ${topic}, I’d do THIS first.`,
      `You’re sleeping on ${topic} – here’s why that’s costing you.`,
      `I tested ${topic} for 30 days – here’s what actually worked.`,
      `Stop scrolling if you want ${topic} to pay your bills.`,
      `Most people fail with ${topic} because they ignore THIS.`,
    ];
  }, [baseTopic, manualLink]);

  const ctaOptions = [
    "Link in bio",
    "Link in first comment",
    "DM me “start”",
    "Save this & come back",
    "Comment YES and I’ll send details",
    "Share this with a friend",
  ];

  function handleGenerate() {
    const topic = baseTopic || "this offer";
    const linkPhrase =
      selectedCTA === "Link in first comment"
        ? "Check the first comment for the link."
        : selectedCTA === "Link in bio"
        ? "Hit the link in my bio."
        : selectedCTA === "DM me “start”"
        ? 'DM me the word “start” and I’ll send everything.'
        : selectedCTA === "Comment YES and I’ll send details"
        ? 'Comment “YES” and I’ll send all the details.'
        : selectedCTA === "Share this with a friend"
        ? "Share this with a friend who needs to see this."
        : "Save this so you don’t lose it.";

    const hookFromSelection =
      customHook || hookOptions[selectedHookIndex] || hookOptions[0];

    const autoCaption =
      caption ||
      `Here’s what nobody tells you about ${topic} 👇\n\nI’ve tried a lot of things and this is the simplest way I’ve found.`;

    const offerLine =
      mode === "content_only"
        ? ""
        : `\n\nIf you want a shortcut, I’ve found an offer that fits perfectly for ${topic}.`;

    const linkLine =
      mode === "content_only"
        ? ""
        : `\n\n${
            manualLink
              ? `Use this link: ${manualLink}`
              : "Use my link in bio so you get the right page."
          }`;

    const autoBody =
      body ||
      `If you’re serious about ${topic}, start simple:\n` +
        `1️⃣ Pick ONE main platform (TikTok / IG / YT Shorts)\n` +
        `2️⃣ Post daily for the next 30 days\n` +
        `3️⃣ Focus on solving one clear problem in each post\n` +
        offerLine +
        linkLine +
        `\n\n${linkPhrase}`;

    setHasGenerated(true);
    setCaption(autoCaption);
    setBody(autoBody);
    setCustomHook(hookFromSelection);
  }

  const fullContentForSEO = useMemo(() => {
    const parts = [customHook || hookOptions[selectedHookIndex], caption, body];
    return parts.filter(Boolean).join("\n\n");
  }, [customHook, hookOptions, selectedHookIndex, caption, body]);

  const tiktokPreview = useMemo(() => {
    const user = "@autoaffi.creator";
    const firstLine = (customHook || hookOptions[selectedHookIndex] || "").trim();
    const combinedCaption = [firstLine, caption].filter(Boolean).join("\n\n");
    return {
      user,
      caption: combinedCaption,
      linkHint:
        mode === "content_only"
          ? ""
          : selectedCTA === "Link in first comment"
          ? "🔗 Link in first comment"
          : selectedCTA === "Link in bio"
          ? "🔗 Link in bio"
          : "",
    };
  }, [customHook, hookOptions, selectedHookIndex, caption, selectedCTA, mode]);

  function showCopyMessage(msg: string) {
    setCopyMessage(msg);
    setTimeout(() => setCopyMessage(""), 2000);
  }

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      setImageError("Max file size is 5MB.");
      setImageFile(null);
      setImagePreviewUrl(null);
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setImageError("Allowed formats: JPG, PNG, WEBP.");
      setImageFile(null);
      setImagePreviewUrl(null);
      return;
    }

    setImageError("");
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreviewUrl(url);
  }

  const currentGuidelines = platformImageGuidelines[platform];

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50 px-4 py-8 md:py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 lg:flex-row">
        {/* LEFT COLUMN – MAIN FLOW */}
        <div className="flex-1">
          {/* HEADER */}
          <header className="mb-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Content Optimizer
            </p>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
                Posts – Hooks, captions & CTA
              </span>
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-400">
              Turn your ideas or affiliate offers into scroll-stopping posts. Auto-optimized for
              TikTok, Instagram, Facebook & YouTube – with SEO guidance built in.
            </p>
          </header>

          {/* MODE SELECTOR */}
          <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-xs shadow-[0_18px_50px_rgba(0,0,0,0.6)]">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              What do you want to do?
            </p>
            <div className="mb-3 grid gap-2 md:grid-cols-3">
              <ModeButton
                label="Create content only"
                description="Just value posts, no specific offer."
                active={mode === "content_only"}
                onClick={() => setMode("content_only")}
              />
              <ModeButton
                label="Content + sell a product"
                description="Posts built around an offer."
                active={mode === "content_and_offer"}
                onClick={() => setMode("content_and_offer")}
              />
              <ModeButton
                label="Offer script only"
                description="Short promo text for DMs/email."
                active={mode === "offer_only"}
                onClick={() => setMode("offer_only")}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              <span className="font-semibold text-yellow-300">Platform focus:</span>
              <PlatformPill
                platform={platform}
                setPlatform={setPlatform}
                value="tiktok"
                label="TikTok"
              />
              <PlatformPill
                platform={platform}
                setPlatform={setPlatform}
                value="instagram"
                label="Instagram"
              />
              <PlatformPill
                platform={platform}
                setPlatform={setPlatform}
                value="facebook"
                label="Facebook"
              />
              <PlatformPill
                platform={platform}
                setPlatform={setPlatform}
                value="youtube"
                label="YouTube Shorts"
              />
            </div>
          </section>

          {/* STEP 1 – INPUT */}
          <section className="mb-8 rounded-2xl border border-yellow-500/40 bg-slate-900/70 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.7)]">
            <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-baseline md:justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-yellow-300">
                Step 1 — Tell Autoaffi what you’re doing
              </h2>
              <p className="text-[11px] text-slate-400">
                Start here. Steps 2–3 will adapt based on what you enter.
              </p>
            </div>

            {/* INPUT STYLE TOGGLE */}
            <div className="mb-4 inline-flex rounded-full bg-slate-900 border border-slate-700 p-1 text-[11px]">
              <button
                type="button"
                onClick={() => setInputStyle("manual")}
                className={`rounded-full px-3 py-1 font-semibold ${
                  inputStyle === "manual"
                    ? "bg-yellow-400 text-slate-900"
                    : "text-slate-400 hover:text-slate-100"
                }`}
              >
                Manual idea / keywords
              </button>
              <button
                type="button"
                onClick={() => setInputStyle("scan_link")}
                className={`rounded-full px-3 py-1 font-semibold ${
                  inputStyle === "scan_link"
                    ? "bg-yellow-400 text-slate-900"
                    : "text-slate-400 hover:text-slate-100"
                }`}
              >
                Scan my affiliate link
              </button>
            </div>

            {inputStyle === "manual" && (
              <>
                <label className="mb-1 block text-xs font-semibold text-slate-300">
                  What do you want this post to be about?
                </label>
                <input
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="ex: AI side hustles, fitness for beginners, YouTube automation…"
                  className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500"
                />

                {mode !== "content_only" && (
                  <>
                    <label className="mb-1 block text-xs font-semibold text-slate-300">
                      What kind of product/offer do you want to promote?
                    </label>
                    <input
                      type="text"
                      value={offerIdea}
                      onChange={(e) => setOfferIdea(e.target.value)}
                      placeholder="ex: AI video tool, email marketing course, side hustles membership…"
                      className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500"
                    />
                  </>
                )}

                <p className="text-[11px] text-slate-500 mb-1">
                  Autoaffi will generate hooks & captions based on this. SEO Engine will then
                  suggest stronger keywords, hashtags and angles.
                </p>
              </>
            )}

            {inputStyle === "scan_link" && (
              <>
                <label className="mb-1 block text-xs font-semibold text-slate-300">
                  Paste your affiliate link
                </label>
                <input
                  type="text"
                  value={manualLink}
                  onChange={(e) => setManualLink(e.target.value)}
                  placeholder="https://your-affiliate-link.com/..."
                  className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500"
                />
                <p className="mb-4 text-[11px] text-slate-500">
                  Autoaffi will analyze the offer title, angle and audience. Hooks, captions and CTA
                  will be built directly around this link. SEO Engine will instantly optimize based
                  on the scanned content.
                </p>
              </>
            )}
            {/* SUGGESTED OFFERS (UI-ONLY MOCK) */}
            {mode !== "content_only" && baseTopic && (
              <div className="mb-4 rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Suggested offers (based on your niche) 
                </p>
                <div className="grid gap-2 md:grid-cols-3 text-[11px]">
                  {suggestedOffers.map((offer, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2"
                    >
                      <p className="font-semibold text-slate-100 mb-1">{offer.name}</p>
                      <p className="text-slate-400">{offer.network}</p>
                      <p className="mt-1 text-[10px] text-yellow-300">{offer.tag}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-slate-500">
                  When you connect your affiliate accounts, real products matching your
                  niche will appear here. These are preview examples. 
                </p>
              </div>
            )}

            {/* CTA SELECTION */}
            {mode !== "content_only" && (
              <div className="mt-1">
                <p className="mb-1 text-[11px] font-semibold text-slate-300">
                  Choose your main call-to-action
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {ctaOptions.map((cta) => (
                    <button
                      key={cta}
                      type="button"
                      onClick={() => setSelectedCTA(cta)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] ${
                        selectedCTA === cta
                          ? "border-yellow-400 bg-yellow-400 text-slate-900"
                          : "border-slate-700 text-slate-300 hover:border-yellow-400/70 hover:text-yellow-300"
                      }`}
                    >
                      {cta}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* GENERATE BUTTON */}
            <button
              type="button"
              onClick={handleGenerate}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-600 py-3 text-sm font-semibold text-slate-900 shadow-lg hover:brightness-110 transition"
            >
              Generate hooks, caption & body
            </button>

            <p className="mt-2 text-[11px] text-slate-500">
              Step 2 will let you tweak the hook, caption and body. Step 3 shows a TikTok-style
              preview and SEO Engine suggestions.
            </p>
          </section>
          {/* STEP 2 – HOOK + TEXT */}
          {hasGenerated && (
            <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-[0_18px_40px_rgba(0,0,0,0.6)]">
              <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-baseline md:justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                  Step 2 — Choose & refine your post
                </h2>
                <p className="text-[11px] text-slate-500">
                  Pick a hook style, refine caption & body — or upload an image for platform preview.
                </p>
              </div>

              {/* HOOK OPTIONS */}
              <div className="mb-4">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-yellow-300">Hook styles</p>
                  <button
                    type="button"
                    onClick={async () => {
                      const hookText = customHook || hookOptions[selectedHookIndex] || "";
                      await copyToClipboard(hookText);
                      showCopyMessage("Hook copied");
                    }}
                    className="text-[10px] text-yellow-300 hover:text-yellow-200"
                  >
                    Copy hook
                  </button>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  {hookOptions.map((hook, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSelectedHookIndex(idx);
                        setCustomHook(hook);
                      }}
                      className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
                        selectedHookIndex === idx && !customHook
                          ? "border-yellow-400 bg-slate-900 text-slate-50"
                          : "border-slate-700 bg-slate-950 text-slate-300 hover:border-yellow-400/70"
                      }`}
                    >
                      {hook}
                    </button>
                  ))}
                </div>

                <p className="mt-2 text-[11px] text-slate-500">
                  You can also write your own hook below. SEO Engine will help you make it stronger.
                </p>
              </div>

              {/* CUSTOM HOOK */}
              <div className="mb-4">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-yellow-300">Final hook</p>
                </div>
                <textarea
                  rows={2}
                  value={customHook || hookOptions[selectedHookIndex] || ""}
                  onChange={(e) => setCustomHook(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                />
              </div>

              {/* CAPTION */}
              <div className="mb-4">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-yellow-300">Caption</p>
                  <button
                    type="button"
                    onClick={async () => {
                      await copyToClipboard(caption);
                      showCopyMessage("Caption copied");
                    }}
                    className="text-[10px] text-yellow-300 hover:text-yellow-200"
                  >
                    Copy caption
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                />
              </div>

              {/* BODY */}
              <div className="mb-6">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-yellow-300">
                    Body text / micro-story
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      await copyToClipboard(body);
                      showCopyMessage("Body copied");
                    }}
                    className="text-[10px] text-yellow-300 hover:text-yellow-200"
                  >
                    Copy body
                  </button>
                </div>
                <textarea
                  rows={5}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                />
              </div>

              {/* COPY MESSAGE */}
              {copyMessage && (
                <p className="mt-1 text-[11px] text-emerald-400">✓ {copyMessage}</p>
              )}

              {/* IMAGE UPLOAD — This continues in the next block */}
               {/* IMAGE UPLOAD */}
              <div className="mb-6 rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-yellow-300 mb-2">
                  Optional — Add an image for platform preview
                </h3>

                {/* Guidelines */}
                <div className="mb-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-[11px]">
                  <p className="font-semibold mb-1 text-slate-200">
                    {currentGuidelines.name} recommended image specs
                  </p>
                  <ul className="space-y-1 text-slate-400">
                    <li>• Ratio: <span className="text-yellow-300">{currentGuidelines.ratio}</span></li>
                    <li>• Ideal: <span className="text-yellow-300">{currentGuidelines.resolution}</span></li>
                    <li>• Minimum: <span className="text-yellow-300">{currentGuidelines.min}</span></li>
                    <li>• Max file size: <span className="text-yellow-300">{currentGuidelines.maxFileSizeMB}MB</span></li>
                    <li>• Formats: JPG, PNG, WEBP</li>
                  </ul>
                </div>

                {/* Upload Field */}
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Upload image
                </label>

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageChange}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300"
                />

                {imageError && (
                  <p className="mt-2 text-[11px] text-red-400">{imageError}</p>
                )}

                {/* Image Preview */}
                {imagePreviewUrl && (
                  <div className="mt-4">
                    <p className="text-[11px] text-slate-400 mb-1">Preview:</p>
                    <img
                      src={imagePreviewUrl}
                      alt="Uploaded preview"
                      className="w-full max-w-xs rounded-xl border border-slate-700 shadow-lg"
                    />
                  </div>
                )}
              </div>
            </section>
          )}
          {/* STEP 3 – PREVIEW + COPY ALL */}
          {hasGenerated && (
            <section className="mb-10 rounded-2xl border border-yellow-500/40 bg-slate-900/80 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.7)]">
             
              <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-baseline md:justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-yellow-300">
                  Step 3 — Preview
                </h2>
                <p className="text-[11px] text-slate-500">
                  TikTok-style feed preview + a real post thumbnail preview with your uploaded image.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
               
                {/* TikTok-style feed preview */}
                <div className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-950 to-slate-900 p-4 text-xs">
                 
                  {/* Top bar */}
                  <div className="mb-3 flex items-center justify-between text-[11px] text-slate-500">
                    <div className="flex gap-2">
                      <span className="font-semibold text-slate-300">Following</span>
                      <span className="text-slate-500">For You</span>
                    </div>
                    <span className="text-slate-500">•••</span>
                  </div>

                  {/* User row */}
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-yellow-400/80 text-[11px] font-bold text-slate-900">
                      A
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-100">
                        {tiktokPreview.user}
                      </p>
                      <p className="text-[10px] text-slate-500">Autoaffi Creator • Sponsor</p>
                    </div>
                  </div>

                  {/* Caption */}
                  <div className="mb-3 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-100">
                    {tiktokPreview.caption}
                    {tiktokPreview.linkHint && (
                      <p className="mt-2 font-semibold text-yellow-300">
                        {tiktokPreview.linkHint}
                      </p>
                    )}
                  </div>

                  {/* Body text */}
                  <div className="mb-3 whitespace-pre-wrap text-[11px] text-slate-300">
                    {body}
                  </div>

                  {/* Bottom row mock */}
                  <div className="mt-4 flex items-center justify-between text-[10px] text-slate-500">
                    <span>❤️ 12.3K</span>
                    <span>💬 483</span>
                    <span>↪ 129</span>
                    <span>⋯</span>
                  </div>
                </div>

                {/* Visual post image / thumbnail */}
                <div className="flex flex-col gap-3">
                  <div className="relative mx-auto w-full max-w-[260px] overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900 via-slate-950 to-black shadow-[0_18px_40px_rgba(0,0,0,0.8)] aspect-[9/16]">

                    {/* Background gradients */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.25),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(96,165,250,0.25),_transparent_55%)]" />

                    {/* Actual image if user uploaded */}
                    {imagePreviewUrl && (
                      <img
                        src={imagePreviewUrl}
                        alt="Uploaded visual preview"
                        className="absolute inset-0 h-full w-full object-cover opacity-90"
                      />
                    )}

                    <div className="relative flex h-full flex-col justify-between p-4">
                      <div className="space-y-2">
                        <span className="inline-flex rounded-full bg-black/40 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-yellow-300">
                          {platform === "tiktok"
                            ? "TikTok"
                            : platform === "instagram"
                            ? "Reels"
                            : platform === "facebook"
                            ? "Facebook post"
                            : "Shorts"}
                        </span>

                        {/* Hook overlay */}
                        <p className="text-sm font-bold leading-snug text-slate-50 line-clamp-3 drop-shadow-xl">
                          {(customHook || hookOptions[selectedHookIndex] || "").replace(/\n/g, " ")}
                        </p>
                      </div>

                      {/* Caption and CTA overlay */}
                      <div className="space-y-2 text-[10px] text-slate-200 drop-shadow-xl">
                        <p className="line-clamp-2 opacity-90">
                          {caption || "Your caption preview will appear here once generated."}
                        </p>

                        {selectedCTA && (
                          <span className="text-yellow-300 font-semibold block">
                            {selectedCTA}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* COPY ALL BUTTON */}
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={async () => {
                    const everything = `${customHook}\n\n${caption}\n\n${body}`;
                    await copyToClipboard(everything);
                    showCopyMessage("All content copied!");
                  }}
                  className="rounded-xl bg-yellow-400 px-5 py-2 text-sm font-semibold text-slate-900 shadow-lg hover:brightness-110 transition"
                >
                  Copy entire post
                </button>
              </div>

              {copyMessage && (
                <p className="mt-2 text-[11px] text-emerald-400">✓ {copyMessage}</p>
              )}
            </section>
          )}

          {/* BACK LINK */}
          <div className="mb-8">
            <Link
              href="/login/dashboard"
              className="text-sm text-slate-400 hover:text-yellow-400 transition"
            >
              ← Back to dashboard
            </Link>
          </div>
        </div>

        {/* RIGHT COLUMN – SEO ENGINE */}
        <aside className="w-full lg:w-80 lg:flex-shrink-0">
          <div className="sticky top-6 space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-[11px] text-slate-300 shadow-[0_18px_50px_rgba(0,0,0,0.7)]">
              <p className="mb-1 font-semibold text-yellow-300">
                SEO Engine for social posts
              </p>
              <p className="text-slate-400">
                Always visible. When you write manually, SEO Engine suggests stronger keywords,
                hooks and hashtags. If you paste a link, it analyzes the offer.
              </p>
            </div>

            <SEOEngine content={fullContentForSEO} manualLink={manualLink} />
          </div>
        </aside>
      </div>
    </main>
  );
}

/* ----------------- UI HELPERS ----------------- */

function ModeButton({ label, description, active, onClick }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-3 py-2 text-left transition ${
        active
          ? "border-yellow-400 bg-slate-900 text-slate-50 shadow-[0_12px_35px_rgba(0,0,0,0.7)]"
          : "border-slate-700 bg-slate-950 text-slate-300 hover:border-yellow-400/70"
      }`}
    >
      <p className="text-[11px] font-semibold">{label}</p>
      <p className="mt-1 text-[11px] text-slate-400">{description}</p>
    </button>
  );
}

function PlatformPill({ platform, setPlatform, value, label }: any) {
  const active = platform === value;
  return (
    <button
      type="button"
      onClick={() => setPlatform(value)}
      className={`rounded-full border px-2.5 py-0.5 ${
        active
          ? "border-yellow-400 bg-yellow-400 text-[10px] font-semibold text-slate-900"
          : "border-slate-700 text-[10px] text-slate-300 hover:border-yellow-400/60 hover:text-yellow-300"
      }`}
    >
      {label}
    </button>
  );
}