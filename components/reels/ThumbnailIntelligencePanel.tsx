"use client";

import React, { useMemo, useState } from "react";

interface ThumbnailIntelligence {
  finalPrompt?: string;
  emotion?: string;
  focalPoint?: string;
  colorPalette?: string[];
  ctaStyle?: string;
  hookPower?: string;
}

interface Props {
  result: any;
}

function formatLabel(value?: string, fallback?: string) {
  if (!value || !value.trim()) return fallback || "Not specified";
  return value.trim();
}

function getOfferModeLabel(result: any) {
  const mode =
    result?.offerMeta?.mode ||
    result?.selectedOffer?.mode ||
    result?.mode ||
    "";

  if (mode === "recurring") return "Recurring Platform";
  if (mode === "product") return "Product Offer";
  if (mode === "funnel") return "Funnel / Landing Flow";
  return "General Reel";
}

function getOfferName(result: any) {
  return (
    result?.offerMeta?.name ||
    result?.selectedOffer?.name ||
    result?.selectedOffer?.platform ||
    "Main Offer"
  );
}

function buildSmartDefaults(result: any): ThumbnailIntelligence {
  const offerMode =
    result?.offerMeta?.mode ||
    result?.selectedOffer?.mode ||
    "general";

  const offerName = getOfferName(result);
  const genre = result?.genre || "cinematic";
  const isRecurring = offerMode === "recurring";
  const isProduct = offerMode === "product";
  const isFunnel = offerMode === "funnel";

  const defaultPrompt = isRecurring
    ? [
        "high-CTR vertical thumbnail, 9:16, premium SaaS growth visual, ultra sharp cinematic lighting,",
        `confident creator or entrepreneur with intense focus, subtle dashboard or tech interface atmosphere,`,
        `offer-driven composition inspired by "${offerName}", dark luxury background,`,
        "bold 3–5 word hook in upper third, strong contrast, clean depth, no clutter, no watermark,",
        "optimized for Instagram Reels and TikTok, premium conversion-focused thumbnail",
      ].join(" ")
    : isProduct
    ? [
        "high-CTR vertical thumbnail, 9:16, premium product-focused composition, ultra sharp subject,",
        `hero framing around "${offerName}", emotional reaction or desire-driven visual,`,
        "dark luxury background with strong contrast and subtle glow,",
        "bold 3–5 word hook in upper third, visual clarity, no clutter, no watermark,",
        "optimized for Instagram Reels and TikTok virality and click-through",
      ].join(" ")
    : isFunnel
    ? [
        "high-CTR vertical thumbnail, 9:16, premium conversion-focused funnel visual,",
        "dramatic cinematic lighting, persuasive digital-business atmosphere,",
        "clear central subject with strong emotional tension and curiosity,",
        "bold 3–5 word hook in upper third, dark premium background, no clutter, no watermark,",
        "optimized for Instagram Reels and TikTok to maximize clicks and curiosity",
      ].join(" ")
    : [
        `insane high-CTR vertical thumbnail, 9:16, ultra sharp ${genre} portrait,`,
        "dramatic lighting, bold 3–5 word headline in upper third,",
        "clean dark background with subtle bokeh, premium emerald + deep navy color palette,",
        "powerful facial emotion, clear whitespace for text, no UI chrome, no watermarks,",
        "optimized for Instagram Reels & TikTok virality",
      ].join(" ");

  return {
    finalPrompt: defaultPrompt,
    emotion: isRecurring
      ? "Confidence / ambition / curiosity"
      : isProduct
      ? "Desire / amazement / urgency"
      : isFunnel
      ? "Curiosity / tension / trust"
      : "Amazement / curiosity",
    focalPoint: isRecurring
      ? "Confident creator or founder with strong eye-contact and premium tech atmosphere"
      : isProduct
      ? "Hero product or product reaction with one crystal-clear subject focus"
      : isFunnel
      ? "Single main subject with persuasive visual tension and clean composition"
      : "Single main character centered with strong eye-contact and clear silhouette",
    colorPalette: isRecurring
      ? ["#f59e0b", "#0f172a", "#111827"]
      : isProduct
      ? ["#10b981", "#0f172a", "#1e293b"]
      : isFunnel
      ? ["#38bdf8", "#0f172a", "#111827"]
      : ["#10b981", "#0f172a", "#1e293b"],
    ctaStyle: isRecurring
      ? "Premium gold-accent CTA feel with strong contrast and luxury energy"
      : isProduct
      ? "Bold high-contrast CTA that feels instant and exciting"
      : isFunnel
      ? "Clean persuasive CTA style that feels trustworthy and conversion-focused"
      : "Bold emerald rounded button bottom-right with white text, strong contrast",
    hookPower: isRecurring
      ? "Strong business-growth hook combining status, curiosity and clear upside"
      : isProduct
      ? "Strong benefit-first hook combining desire and instant curiosity"
      : isFunnel
      ? "Conversion-driven hook built around curiosity and transformation"
      : "High-contrast 3–5 word hook combining curiosity + clear benefit",
  };
}

export default function ThumbnailIntelligencePanel({ result }: Props) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  const raw = result?.thumbnailIntelligence ?? {};
  const offerModeLabel = getOfferModeLabel(result);
  const offerName = getOfferName(result);

  const t: ThumbnailIntelligence = useMemo(() => {
    const smartDefaults = buildSmartDefaults(result);

    return {
      finalPrompt: formatLabel(raw.finalPrompt, smartDefaults.finalPrompt),
      emotion: formatLabel(raw.emotion, smartDefaults.emotion),
      focalPoint: formatLabel(raw.focalPoint, smartDefaults.focalPoint),
      colorPalette:
        Array.isArray(raw.colorPalette) && raw.colorPalette.length > 0
          ? raw.colorPalette
          : smartDefaults.colorPalette,
      ctaStyle: formatLabel(raw.ctaStyle, smartDefaults.ctaStyle),
      hookPower: formatLabel(raw.hookPower, smartDefaults.hookPower),
    };
  }, [raw, result]);

  const palette = Array.isArray(t.colorPalette) ? t.colorPalette : [];

  const handleCopy = async () => {
    const text = t.finalPrompt || "";
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error("Copy failed", e);
    }
  };

  return (
    <section className="rounded-2xl border border-emerald-400/40 bg-slate-900/70 p-5 space-y-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-emerald-200 text-sm font-semibold"
      >
        <div className="flex items-center gap-3 text-left">
          <div>
            <p className="text-emerald-200 font-semibold">
              Thumbnail Intelligence
            </p>
            <p className="text-[10px] text-slate-400 font-normal mt-0.5">
              Premium thumbnail direction for stronger clicks and better first
              impressions
            </p>
          </div>
        </div>
        <span className="text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {!open ? null : (
        <div className="space-y-5">
          <div className="rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 via-slate-950/80 to-slate-900/90 p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-400/20">
                {offerModeLabel}
              </span>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                {offerName}
              </span>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                Final prompt
              </p>
              <div className="rounded-xl bg-slate-950/90 border border-emerald-400/30 p-4 text-[11px] leading-5 text-emerald-100 whitespace-pre-line">
                {t.finalPrompt}
              </div>
            </div>

            <button
              onClick={handleCopy}
              className="w-full py-2.5 rounded-xl bg-emerald-600 text-slate-950 font-semibold text-xs hover:bg-emerald-500 transition"
            >
              {copied ? "✔ Copied!" : "Copy Thumbnail Prompt"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 space-y-1">
              <p className="text-emerald-300 font-semibold">Emotion</p>
              <p className="text-slate-300 leading-5">{t.emotion}</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 space-y-1">
              <p className="text-emerald-300 font-semibold">Focal Point</p>
              <p className="text-slate-300 leading-5">{t.focalPoint}</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 space-y-1">
              <p className="text-emerald-300 font-semibold">CTA Style</p>
              <p className="text-slate-300 leading-5">{t.ctaStyle}</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 space-y-1">
              <p className="text-emerald-300 font-semibold">Hook Power</p>
              <p className="text-slate-300 leading-5">{t.hookPower}</p>
            </div>
          </div>

          <div className="rounded-xl bg-slate-900 border border-slate-700 p-3 space-y-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
              Suggested color palette
            </p>

            <div className="flex flex-wrap gap-3">
              {palette.map((col, i) => (
                <div key={`${col}-${i}`} className="flex items-center gap-2">
                  <div
                    className="h-6 w-6 rounded-full border border-slate-600 shadow-sm"
                    style={{ backgroundColor: col }}
                  />
                  <span className="text-[10px] text-slate-400">{col}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}