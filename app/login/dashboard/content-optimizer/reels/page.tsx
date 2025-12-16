"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { toast } from "react-hot-toast";
import { MegaEngine1 } from "@/lib/engines/mega-engine-1";

// -----------------------------
// TYPES
// -----------------------------
interface StoryboardFrame {
  time: number;
  description: string;
  visualCue?: string;
}

interface SocialHints {
  hashtags?: string[];
  titleIdeas?: string[];
  captionIdeas?: string[];
  postingTimes?: string[];
}

interface ThumbnailIntelligence {
  finalPrompt?: string;
  emotion?: string;
  focalPoint?: string;
  colorPalette?: string[];
  layoutNotes?: string;
  faceEmotion?: string;
  hookAngle?: string;
}

interface CtaIntelligence {
  hookType?: string;
  urgencyLevel?: string;
  clarityScore?: number;
  powerWords?: string[];
  frictionPhrases?: string[];
  finalCtaLine?: string;
}

interface OfferMeta {
  name: string;
  rating?: number;
  mode?: string; // "recurring" | "product" | "high-ticket" | "one-time"
  commissionRate?: string;
  epc?: number;
  category?: string;
  affiliateUrl?: string;
}

interface GeneratedReel {
  script: string;
  storyboard: StoryboardFrame[];
  subtitles?: string[];
  cta: string;
  socialHints?: SocialHints;
  thumbnailIntelligence?: ThumbnailIntelligence;
  ctaIntelligence?: CtaIntelligence;
  offerMeta?: OfferMeta;
  beatMap?: any[];
    voiceTimeline?: any[];
    exportTimeline?: any[];
}

interface RecurringPlatformRow {
  id: string;
  user_id: string;
  platform: string;
  autoaffi_user_code: string;
  created_at?: string;
  updated_at?: string;
}

export default function ReelsPage() {
  // -----------------------------
  // CORE INPUT STATES
  // -----------------------------
  const [mode, setMode] = useState<"manual" | "guided" | "auto">("manual");
  const [mediaType, setMediaType] = useState<"mixed" | "video" | "stills">(
    "mixed"
  );

  const [genre, setGenre] = useState("motivation");
  const [tone, setTone] = useState("energetic");
  const [storyFormat, setStoryFormat] = useState("hook-story-cta");
  const [videoLength, setVideoLength] = useState(30);

  // OFFER-STATE
  const [selectedOffer, setSelectedOffer] = useState<any | null>(null);
  const [offerMeta, setOfferMeta] = useState<any | null>(null);
const [loadingGenerate, setLoadingGenerate] = useState(false);

// --- ADD THESE NEW STATES RIGHT HERE ---
const [activeRecurring, setActiveRecurring] = useState<RecurringPlatformRow[]>([]);
const [loadingRecurring, setLoadingRecurring] = useState(true);

const [affiliateIds, setAffiliateIds] = useState<any>(null);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    };
    getUser();
  }, [supabase]);

// Load funnel settings when user is ready
useEffect(() => {
  if (user) {
    loadFunnelSettings();
  }
}, [user]);

// 🔹 DEL 2: Ladda recurring-plattformar för denna user
  useEffect(() => {
    async function loadRecurringPlatforms() {
      setLoadingRecurring(true);

      const { data, error } = await supabase
        .from("user_recurring_platforms")
        .select("*")
        .eq("user_id", user?.id);

      if (!error && data) {
        setActiveRecurring(data);
      }

      setLoadingRecurring(false);
    }

    if (user?.id) {
      loadRecurringPlatforms();
    }
  }, [user?.id, supabase]);

const [offerType, setOfferType] =
  useState<"recurring" | "product" | "funnel">("recurring");
  const [productPlatform, setProductPlatform] = useState<string>("");
  const [productSearch, setProductSearch] = useState<string>("");
  const [offerWarning, setOfferWarning] = useState<string | null>(null);

  // Recurring AI platforms (8 st) – alla 80/20 utom Autoaffi (50/50)
  const offerList = [
    {
      name: "Autoaffi Recurring",
      mode: "recurring",
      type: "recurring",
      description: "Lifetime recurring commissions powered by Autoaffi.",
      commissionRate: "50% you · 50% Autoaffi",
      category: "Affiliate Marketing",
      epc: 4.2,
      affiliateUrl: "",
      icon: "💛",
    },
    {
      name: "TubeMagic AI",
      mode: "recurring",
      type: "recurring",
      description: "YouTube automation & analytics for creators.",
      commissionRate: "80% you · 20% Autoaffi",
      category: "Creator Tools",
      epc: 3.4,
      affiliateUrl: "",
      icon: "📺",
    },
    {
      name: "Systeme.io",
      mode: "recurring",
      type: "recurring",
      description: "Funnels, email & automations in one.",
      commissionRate: "80% you · 20% Autoaffi",
      category: "Funnels",
      epc: 2.9,
      affiliateUrl: "",
      icon: "🧱",
    },
    {
      name: "GetResponse",
      mode: "recurring",
      type: "recurring",
      description: "Email & marketing automation.",
      commissionRate: "80% you · 20% Autoaffi",
      category: "Email",
      epc: 2.1,
      affiliateUrl: "",
      icon: "✉️",
    },
    {
      name: "Metricool",
      mode: "recurring",
      type: "recurring",
      description: "Social media & ads analytics.",
      commissionRate: "80% you · 20% Autoaffi",
      category: "Analytics",
      epc: 1.9,
      affiliateUrl: "",
      icon: "📊",
    },
    {
      name: "vidIQ",
      mode: "recurring",
      type: "recurring",
      description: "YouTube SEO & growth toolkit.",
      commissionRate: "80% you · 20% Autoaffi",
      category: "YouTube SEO",
      epc: 2.3,
      affiliateUrl: "",
      icon: "🚀",
    },
    {
      name: "Jasper AI",
      mode: "recurring",
      type: "recurring",
      description: "AI copy & content assistant.",
      commissionRate: "80% you · 20% Autoaffi",
      category: "AI Writing",
      epc: 2.7,
      affiliateUrl: "",
      icon: "✨",
    },
    {
      name: "ClickFunnels 2.0",
      mode: "recurring",
      type: "recurring",
      description: "High-converting funnels & memberships.",
      commissionRate: "80% you · 20% Autoaffi",
      category: "Funnels",
      epc: 3.1,
      affiliateUrl: "",
      icon: "🏗️",
    },
  ];

  const productPlatforms = [
    "Digistore24",
    "ClickBank",
    "Amazon Associates",
    "Tradedoubler",
    "Awin",
    "Partnerize",
    "CJ Affiliate",
    "MyLead (product mode)",
  ];

  
  // -----------------------------
  // FILES (IMAGES / VIDEO)
  // -----------------------------
  const [uploadImages, setUploadImages] = useState<FileList | null>(null);
  const [uploadVideo, setUploadVideo] = useState<File | null>(null);

  const [videoResolution, setVideoResolution] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [videoOrientationWarning, setVideoOrientationWarning] = useState("");

  // -----------------------------
  // RENDER SETTINGS (VX v3.5 / 4.1 BACKEND)
// -----------------------------
  const [voiceStyle, setVoiceStyle] = useState("natural");
  const [voiceMode, setVoiceMode] = useState<"auto" | "custom" | "none">(
    "auto"
  );
  const [renderStatus, setRenderStatus] = useState<string | null>(null);

  // REALISM ENGINE v4.1
  const [realism, setRealism] = useState(60);

  // MUSIC ENGINE v4.1
  const [musicMode, setMusicMode] = useState<"auto" | "upload" | "library">(
    "auto"
  );
  const [musicStyle, setMusicStyle] = useState("cinematic");
  const [uploadedMusic, setUploadedMusic] = useState<File | null>(null);

  const [soundTransitions, setSoundTransitions] = useState(true);
  const [soundImpacts, setSoundImpacts] = useState(true);
  const [soundAmbience, setSoundAmbience] = useState(true);

  // 4.1 NEW — AUTO PACING / EMOTION / OVERLAYS (backend only)
  const [autoPacing, setAutoPacing] = useState(true);
  const [emotionBoost, setEmotionBoost] = useState(true);
  const [autoOverlays, setAutoOverlays] = useState(true);

  // -----------------------------
  // GUIDED CONTEXT
  // -----------------------------
  const [nicheDescription, setNicheDescription] = useState("");
  const handleAutoContextFill = () => {
    setNicheDescription(
      "I help beginners make their first $100 online with simple Reels about affiliate offers, daily actions and mindset. Audience: 20–40, busy, wants online income but feels overwhelmed."
    );
  };

  // -----------------------------
  // MASTER RESULT
  // -----------------------------
  const [result, setResult] = useState<GeneratedReel | null>(null);
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderedVideo, setRenderedVideo] = useState<string | null>(null);

  // Script collapse
  const [showScript, setShowScript] = useState(true);

  // -------------------------------
  // PRODUCT ENGINE — STATES
  // -------------------------------
  const [selectedProductPlatform, setSelectedProductPlatform] =
    useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [recommendedProducts, setRecommendedProducts] = useState<any[]>([]);

  // Kopplade plattformar (du hämtar dessa från supabase senare)
  const platformConnections: Record<string, boolean> = {
    digistore: true, // kund kopplad?
    amazon: true,
    cpalead: true,
    mylead: true,
    impact: true,
  };

  // 🔥 Funnel states go HERE
// Funnel toggle (UI)
const [useFunnel, setUseFunnel] = useState(false);

// Funnel state from Supabase
const [funnelSettings, setFunnelSettings] = useState<{
  url: string | null;
  platform: string | null;
} | null>(null);

const [isLoadingFunnel, setIsLoadingFunnel] = useState(true);

// ------------------------------------------------------
// LOAD FUNNEL SETTINGS FROM SUPABASE
// ------------------------------------------------------
async function loadFunnelSettings() {
  if (!user?.id) return;

  setIsLoadingFunnel(true);

  const { data, error } = await supabase
    .from("funnels")
    .select("url, platform")
    .eq("user_id", user.id)
    .single();

  if (!error && data) {
    setFunnelSettings({
      url: data.url,
      platform: data.platform
    });
  }

  setIsLoadingFunnel(false);
}

  // Produktdatabas (du byter ut mot riktiga API-kopplingar)
  const allProducts = [
    {
      name: "Keto Meal Plan",
      description: "High converting keto plan.",
      epc: 3.2,
      platform: "digistore",
      category: "Health",
      affiliateUrl: "",
    },
    {
      name: "Skin Glow Serum",
      description: "Amazon trending beauty product.",
      epc: 2.1,
      platform: "amazon",
      category: "Beauty",
      affiliateUrl: "",
    },
    {
      name: "Lose Weight Quiz",
      description: "CPAlead top offer.",
      epc: 1.6,
      platform: "cpalead",
      category: "Health",
      affiliateUrl: "",
    },
    {
      name: "Crypto Starter Pack",
      description: "MyLead smart picks.",
      epc: 2.9,
      platform: "mylead",
      category: "Finance",
      affiliateUrl: "",
    },
    {
      name: "Fitness Meal App",
      description: "Impact health app.",
      epc: 1.8,
      platform: "impact",
      category: "Fitness",
      affiliateUrl: "",
    },
  ];

  // --------------------------------------
  // HANDLER: select platform
  // --------------------------------------
  const handlePlatformSelect = (platform: string) => {
    setSelectedProductPlatform(platform);
    setSearchQuery("");

    // 3 rekommenderade per plattform
    const rec = allProducts.filter((p) => p.platform === platform).slice(0, 3);

    setRecommendedProducts(rec);
  };

  // --------------------------------------
  // HANDLER: search product
  // --------------------------------------
  const handleProductSearch = (query: string) => {
    setSearchQuery(query);

    if (!query.trim()) {
      setFilteredProducts([]);
      return;
    }

    const results = allProducts.filter((p) =>
      p.name.toLowerCase().includes(query.toLowerCase())
    );

    setFilteredProducts(results);
  };

  // --------------------------------------
  // HANDLER: när man klickar på en produkt
  // --------------------------------------
  const generateAffiliateLinkForProduct = (product: any) => {
    const base: Record<string, string> = {
      digistore: "https://www.digistore24.com/redir/",
      amazon: "https://www.amazon.com/dp/",
      cpalead: "https://cpalead.com/click/",
      mylead: "https://mylead.global/click/",
      impact: "https://app.impact.com/campaign-promo/",
    };

    const affiliateId = user?.id ?? "missing";

    return `${base[product.platform]}${encodeURIComponent(
      product.name
    )}?aff=${affiliateId}`;
  };

  const allowedPlatforms = activeRecurring.map((r) => r.platform);

const recurringCodeMap = Object.fromEntries(
  activeRecurring.map((r) => [r.platform, r.autoaffi_user_code])
);

  const selectProduct = (product: any) => {

  

    // skapa affiliate-länk
    const url = generateAffiliateLinkForProduct(product);

    const final = {
      ...product,
      affiliateUrl: url,
      offerType: "product",
    };

    setSelectedOffer(final);

    // uppdatera offer meta
    setOfferMeta({
      type: "product",
      platform: product.platform,
      name: product.name,
      epc: product.epc,
      affiliateUrl: url,
    });
  };

  
// --------------------------------------
// HANDLER: select recurring offer
// --------------------------------------
const handleSelectRecurringOffer = (offer: any) => {
  const platformKey = offer.name.toLowerCase().replace(/\s+/g, "");

  const affiliateCode = recurringCodeMap[platformKey];

  if (!affiliateCode) {
    toast.error("Missing Autoaffi affiliate code for this platform.");
    return;
  }

  const affiliateUrl = `https://autoaffi.com/r/${platformKey}?u=${affiliateCode}`;

  setSelectedOffer({
    ...offer,
    type: "recurring",
    platform: platformKey,
    affiliateUrl,
  });

  setOfferMeta({
    type: "recurring",
    platform: platformKey,
    affiliateId: affiliateCode,
    name: offer.name,
    epc: offer.epc,
    affiliateUrl,
  });
};

  // -----------------------------
  // VIDEO UPLOAD READER
  // -----------------------------
  function handleUploadVideoChange(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploadVideo(file);

    const video = document.createElement("video");
    video.preload = "metadata";

    video.onloadedmetadata = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      setVideoResolution({ width, height });

      if (width > height) {
        setVideoOrientationWarning(
          "⚠️ Landscape detected – vertical clips perform better for Reels / Shorts."
        );
      } else {
        setVideoOrientationWarning("");
      }
    };

    video.src = URL.createObjectURL(file);
  }

  // -----------------------------
  // MUSIC UPLOAD
  // -----------------------------
  const handleMusicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setUploadedMusic(file);
  };

  // -----------------------------
  // AUTOAFFI MODE (VX v3.5 + 4.1 backend flags)
  // -----------------------------
  const applyAutoaffiMode = () => {
    setVoiceMode("auto");
    setVoiceStyle("natural");
    setRealism(65);
    setMusicMode("auto");
    setSoundTransitions(true);
    setSoundImpacts(true);
    setSoundAmbience(true);
    // 4.1 backend-only toggles
    setAutoPacing(true);
    setEmotionBoost(true);
    setAutoOverlays(true);
  };

  // -----------------------------
  // GENERATE (VX v3.5 – AI STRUCTURE)
  // -----------------------------
  async function handleGenerate() {
    try {
      setIsGenerating(true);
      setError("");
      setOfferWarning(null);

      const response = await fetch("/api/reels/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genre,
          tone,
          storyFormat,
          videoLength,
          mode,
          mediaType,
          nicheDescription,
          // vi skickar med offertypen – backend kan använda detta
          selectedOffer: selectedOffer
            ? {
                name: selectedOffer.name,
                mode: selectedOffer.mode,
                category: selectedOffer.category,
              }
            : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Generation failed");

      setResult(data);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setIsGenerating(false);
    }
  }

  // -----------------------------
  // RENDER VIDEO (VX v3.5 BACKEND + 4.1 FIELDS)
  // -----------------------------
  async function startRenderVX() {
    console.log("🔥 startRenderVX triggered");
    if (!result) return;

    // Säkerställ att de valt en offer innan vi renderar
    if (!selectedOffer) {
      setOfferWarning(
        "Choose at least one offer (recurring or product) so Autoaffi can attach the right affiliate link, voice profile & CTA."
      );
      return;
    }

    try {
      setIsRendering(true);
      setOfferWarning(null);
      setRenderStatus("processing");

      const fd = new FormData();
      fd.append("script", result.script);
      fd.append("duration", String(videoLength));
      fd.append("mediaType", mediaType);

      // VOICE
      fd.append("voiceStyle", voiceStyle || "alloy");
      fd.append("voiceMode", voiceMode);
fd.append("beatMap", JSON.stringify(result?.beatMap || []));
fd.append("voiceTimeline", JSON.stringify(result?.voiceTimeline || []));
fd.append("exportTimeline", JSON.stringify(result?.exportTimeline || []));



      // MUSIC ENGINE v4.1
      fd.append("musicMode", musicMode);
      fd.append("musicStyle", musicStyle);
      fd.append("soundTransitions", String(soundTransitions));
      fd.append("soundImpacts", String(soundImpacts));
      fd.append("soundAmbience", String(soundAmbience));
      if (uploadedMusic && musicMode === "upload") {
        fd.append("musicFile", uploadedMusic);
      }

      // REALISM ENGINE v4.1
      fd.append("realism", String(realism));

      // 4.1 NEW – BACKEND FLAGS
      fd.append("autoPacing", String(autoPacing));
      fd.append("emotionBoost", String(emotionBoost));
      fd.append("autoOverlays", String(autoOverlays));

// MEDIA FILES
if (uploadImages && mediaType !== "video") {
  Array.from(uploadImages).forEach((img, i) => {
    fd.append(`image_${i}`, img);
  });
}

if (uploadVideo && mediaType !== "stills") {
  fd.append("videoFile", uploadVideo);
}

console.log("🚀 SENDING REQUEST TO WORKER");

// 🟢 FETCH — 100% ren
const response = await fetch("/api/reels/render-vx", {
  method: "POST",
  body: fd,
});

console.log("📩 WORKER RESPONSE RECEIVED", response);

const data = await response.json();

if (!response.ok) throw new Error(data.error || "Render failed");

setRenderedVideo(data.videoUrl);
setRenderStatus("done");
    } catch (err: any) {
      setError(err.message);
      setRenderStatus("error");
    } finally {
      setIsRendering(false);
    }
  }

  // -----------------------------
  // DOWNLOAD
  // -----------------------------
  function downloadRenderedVideo() {
    if (renderedVideo) window.open(renderedVideo, "_blank");
  }

  // -----------------------------
  // DERIVED OFFER META FOR UI
  // -----------------------------
  const effectiveOfferMeta: OfferMeta | undefined =
    selectedOffer || result?.offerMeta
      ? {
          ...(result?.offerMeta || {}),
          ...(selectedOffer || {}),
        }
      : undefined;

  // Commission text baserat på mode & namn
  function getPayoutText(meta?: OfferMeta): string {
    if (!meta) return "";
    if (meta.name === "Autoaffi Recurring") {
      return "Payout model: 50% you · 50% Autoaffi (lifetime recurring).";
    }
    if (meta.mode === "recurring") {
      return "Payout model: 80% you · 20% Autoaffi (all recurring AI platforms).";
    }
    // product / one-time / high-ticket
    return "Payout model: 100% to you. Autoaffi only helps with content & link setup.";
  }

  return (
    <main className="p-4 md:p-8 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* HEADER */}
        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold tracking-wide text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.4)]">
            Autoaffi VX · World-Class Reel Engine v3.5
          </h1>
          <p className="text-slate-400 text-[12px]">
            Uses Pexels · Pixabay · Videezy + AI pacing, CTA Intelligence v3 &
            Thumbnail Intelligence v3.
          </p>
        </div>

        {/* WORLD-CLASS HOOKS + SEO — GOLD PREMIUM */}
<div className="rounded-2xl border border-amber-500/70 bg-amber-500/10 p-6 text-center text-xs text-amber-300 shadow-[0_0_25px_rgba(245,158,11,0.45)] space-y-2">
  <h2 className="text-sm font-semibold text-amber-300 tracking-wide uppercase text-center">
    ✨🚀 World-Class Hooks + SEO Engine Activated
  </h2>

  <p className="text-[11px] max-w-2xl mx-auto text-amber-200/90 leading-relaxed">
    Every reel Autoaffi generates starts with{" "}
    <span className="font-semibold text-amber-200">
      high-impact hooks (2–3 seconds)
    </span>{" "}
    crafted for maximum retention. 
    Autoaffi’s{" "}
    <span className="font-semibold text-amber-200">
      SEO Engine v3
    </span>{" "}
    boosts discovery, reach & viral potential across 
    TikTok · IG Reels · YouTube Shorts.
  </p>
</div>

        {/* SMART SOCIAL HINTS */}
        <div className="rounded-2xl border border-emerald-400/50 bg-emerald-500/10 p-4 text-center text-xs text-emerald-200">
          <h2 className="text-sm font-semibold text-emerald-200 mb-1">
            💡 Smart Social Hints v3
          </h2>
          <p className="text-[11px] max-w-2xl mx-auto text-emerald-100/90">
            When you post your reel, Smart Social Hints v3 gives you perfectly
            optimized <span className="font-semibold">titles, hashtags and
            captions</span> you can copy &amp; paste directly. These are based on
            psychology, platform patterns and your unique script &amp; offer.
          </p>
        </div>

        {/* MODE SELECTOR */}
        <div className="mt-6">
          <p className="text-[11px] text-slate-400 mb-2">
            <span className="font-semibold text-slate-200">Select mode</span> ·
            Manual = full control · Guided = AI assistant · Auto = hands-free
            creation.
          </p>

          <div className="grid grid-cols-3 gap-3">
            <button
              className={`py-2 rounded-xl border text-xs ${
                mode === "manual"
                  ? "border-emerald-400 bg-emerald-500/20"
                  : "border-slate-700 bg-slate-900"
              }`}
              onClick={() => setMode("manual")}
            >
              Manual
            </button>

            <button
              className={`py-2 rounded-xl border text-xs ${
                mode === "guided"
                  ? "border-emerald-400 bg-emerald-500/20"
                  : "border-slate-700 bg-slate-900"
              }`}
              onClick={() => setMode("guided")}
            >
              Guided
            </button>

            <button
              className={`py-2 rounded-xl border text-xs ${
                mode === "auto"
                  ? "border-emerald-400 bg-emerald-500/20"
                  : "border-slate-700 bg-slate-900"
              }`}
              onClick={() => setMode("auto")}
            >
              Auto
            </button>
          </div>
        </div>

        {/* MEDIA TYPE SELECTOR */}
        <div className="mt-6">
          <p className="text-[11px] text-slate-400 mb-2">
            <span className="font-semibold text-slate-200">Media type</span> ·
            Mixed = images + clips · Video = only clips · Stills = image-based
            reels.
          </p>

          <div className="grid grid-cols-3 gap-3">
            <button
              className={`py-2 rounded-xl border text-xs ${
                mediaType === "mixed"
                  ? "border-emerald-400 bg-emerald-500/20"
                  : "border-slate-700 bg-slate-900"
              }`}
              onClick={() => setMediaType("mixed")}
            >
              Mixed
            </button>

            <button
              className={`py-2 rounded-xl border text-xs ${
                mediaType === "video"
                  ? "border-emerald-400 bg-emerald-500/20"
                  : "border-slate-700 bg-slate-900"
              }`}
              onClick={() => setMediaType("video")}
            >
              Only video clips
            </button>

            <button
              className={`py-2 rounded-xl border text-xs ${
                mediaType === "stills"
                  ? "border-emerald-400 bg-emerald-500/20"
                  : "border-slate-700 bg-slate-900"
              }`}
              onClick={() => setMediaType("stills")}
            >
              Only still images
            </button>
          </div>
        </div>

        {/* GENRE */}
        <div>
          <label className="text-xs text-slate-400">Genre</label>
          <select
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="w-full mt-1 rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs"
          >
            <option value="motivation">Motivation</option>
            <option value="money">Make Money Online</option>
            <option value="fitness">Fitness</option>
            <option value="tech">Tech / AI</option>
            <option value="business">Business</option>
          </select>
        </div>

        {/* TONE */}
        <div>
          <label className="text-xs text-slate-400">Tone</label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="w-full mt-1 rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs"
          >
            <option value="energetic">Energetic</option>
            <option value="calm">Calm</option>
            <option value="serious">Serious</option>
            <option value="funny">Funny</option>
          </select>
        </div>

        {/* STORY FORMAT */}
        <div>
          <label className="text-xs text-slate-400">Story format</label>
          <select
            value={storyFormat}
            onChange={(e) => setStoryFormat(e.target.value)}
            className="w-full mt-1 rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs"
          >
            <option value="hook-story-cta">Hook • Story • CTA</option>
            <option value="problem-solution">Problem → Solution</option>
            <option value="3-tips">Three rapid tips</option>
          </select>
        </div>

        {/* LENGTH */}
        <div>
          <label className="text-xs text-slate-400">Length (seconds)</label>
          <select
            value={videoLength}
            onChange={(e) => setVideoLength(Number(e.target.value))}
            className="w-full mt-1 rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs"
          >
            <option value={15}>15 seconds</option>
            <option value={30}>30 seconds</option>
            <option value={60}>60 seconds</option>
          </select>
        </div>

        {/* MEDIA RULE EXPLANATION */}
        <div className="rounded-xl bg-slate-950/70 border border-slate-800 px-3 py-2 text-[11px] text-slate-300">
          Mixed: both allowed. Only video → image upload disabled. Only stills →
          video upload disabled.
        </div>

        {/* UPLOADS BLOCK — LOCKED BY MEDIA TYPE */}
        <div className="space-y-4">

{/* PREMIUM INSTRUCTIONS – MANUAL IMAGE UPLOAD */}
  <div className="mt-2 rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-white/0 to-emerald-500/10 p-4 text-xs text-white/80 shadow-[0_0_40px_rgba(0,0,0,0.45)]">
    {/* Header row */}
    <div className="flex items-center justify-between gap-3 mb-2">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-sm">
          📸
        </span>
        <div>
          <p className="font-semibold text-white">
            Manual Image Upload — Premium Flow
          </p>
          <p className="text-[11px] text-emerald-200/80">
            Autoaffi prepares everything for a cinematic, 9:16 ready Reel.
          </p>
        </div>
      </div>

      <span className="inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-100">
        Auto-optimized
      </span>
    </div>

    {/* Key facts row */}
    <div className="mb-3 grid grid-cols-2 gap-2 text-[11px] text-slate-200/90">
      <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5">
        <p className="text-[10px] uppercase tracking-wide text-slate-400">
          Images
        </p>
        <p className="font-semibold">
          3–6 portrait photos
        </p>
      </div>
      <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5">
        <p className="text-[10px] uppercase tracking-wide text-slate-400">
          Max size
        </p>
        <p className="font-semibold">
          8 MB per image
        </p>
      </div>
    </div>

    {/* Steps */}
    <ul className="space-y-1.5 leading-relaxed text-[11px]">
      <li>
        • Select <strong>3–6 vertical images</strong> in your folder{' '}
        <span className="text-slate-300">before</span> you press <em>Open</em>.
      </li>
      <li>
        • Autoaffi automatically adds <strong>two matching video clips</strong>{' '}
        to boost engagement, pacing and retention.
      </li>
      <li>
        • All media (your images + added clips) are{' '}
        <strong>cropped, resized and optimized</strong> inside the Render Engine.
      </li>
      <li>
        • You <strong>don’t need to crop</strong> anything — output is always{' '}
        <span className="font-semibold text-emerald-200">9:16, Reel-ready.</span>
      </li>
      <li>
        • Final video includes <strong>pacing, overlays, transitions, music & voice</strong>{' '}
        fully handled by Autoaffi.
      </li>
    </ul>

    {/* Tip */}
    <p className="mt-3 text-[11px] text-slate-300/80">
      👉 <span className="font-semibold text-emerald-100">Pro tip:</span>{' '}
      Select all your images first, then click <strong>Open</strong> once —
      that gives Autoaffi the best flow to work with.
    </p>
  </div>

          {/* IMAGE UPLOAD */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Upload images (max 3)
            </label>

            <input
              type="file"
              accept="image/*"
              multiple
              disabled={mediaType === "video"}
              onChange={(e) => setUploadImages(e.target.files)}
              className={`block w-full text-xs ${
                mediaType === "video"
                  ? "opacity-50 cursor-not-allowed text-slate-500"
                  : "text-slate-200"
              }`}
            />

            <p className="text-[11px] text-slate-500 mt-1">
              Selected: {uploadImages?.length || 0} / 3
            </p>

            {mediaType === "video" && (
              <p className="text-[10px] text-amber-400 mt-1">
                Disabled when “Only video clips” is active.
              </p>
            )}
          </div>
          {/* VIDEO UPLOAD */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Upload base video (optional)
            </label>

            <input
              type="file"
              accept="video/*"
              disabled={mediaType === "stills"}
              onChange={(e) => handleUploadVideoChange(e.target.files)}
              className={`block w-full text-xs ${
                mediaType === "stills"
                  ? "opacity-50 cursor-not-allowed text-slate-500"
                  : "text-slate-200"
              }`}
            />

            {videoResolution && (
              <p className="text-[11px] text-slate-400 mt-1">
                {videoResolution.width}×{videoResolution.height}
              </p>
            )}

            {videoOrientationWarning && (
              <p className="text-[11px] text-amber-400 mt-1">
                {videoOrientationWarning}
              </p>
            )}

            {mediaType === "stills" && (
              <p className="text-[10px] text-amber-400 mt-1">
                Disabled when “Only still images” is active.
              </p>
            )}
          </div>
        </div>

        {/* GUIDED MODE */}
        {mode === "guided" && (
          <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm">
            <h2 className="text-sm font-semibold mb-1 text-slate-100">
              Guided mode · describe your niche
            </h2>

            <textarea
              rows={4}
              value={nicheDescription}
              onChange={(e) => setNicheDescription(e.target.value)}
              placeholder="Example: I help beginners make their first $100 online with simple Reels about affiliate offers, routines and mindset."
              className="w-full mt-2 rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500"
            />

            <button
              type="button"
              onClick={handleAutoContextFill}
              className="mt-2 rounded-full border border-emerald-400/60 text-emerald-200 text-[11px] px-3 py-1 bg-slate-950 hover:bg-emerald-500/10"
            >
              Auto-fill niche &amp; context
            </button>

            <p className="mt-2 text-[11px] text-slate-400">
              Autoaffi will use this to adapt hooks, examples and CTA so it
              matches your audience.
            </p>
          </section>
        )}

        {/* AUTO MODE */}
        {mode === "auto" && (
          <section className="mt-6 rounded-xl border border-emerald-400/40 bg-emerald-500/5 p-4 text-sm">
            <h2 className="text-sm font-semibold text-emerald-200 mb-1">
              Full Auto · Let Autoaffi handle everything
            </h2>
            <p className="text-[11px] text-emerald-200/80">
              Autoaffi uses your genre, tone, media type &amp; niche (if
              provided) to auto-build a full reel blueprint — scenes, pacing,
              subtitles, CTA, thumbnails &amp; export data.
            </p>
          </section>
        )}

        {/* GENERATE BUTTON */}
        <div className="mt-6 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_12px_40px_rgba(16,185,129,0.45)] hover:bg-emerald-400 disabled:opacity-60"
          >
            {isGenerating
              ? "Generating Reel Blueprint…"
              : "Generate Reel Blueprint"}
          </button>

          <p className="text-[11px] text-slate-500 max-w-xs md:text-right">
            Script · Storyboard · Subtitles · CTA · Smart Social Hints v3 · CTA
            Intelligence · Thumbnail Intelligence · Export timeline.
          </p>
        </div>

        {/* ERROR */}
        {error && (
          <div className="mt-4 rounded-xl border border-red-500/70 bg-red-600/10 px-4 py-3 text-xs text-red-200">
            {error}
          </div>
        )}
        {/* RESULT START */}
        {result && (
          <section className="mt-10 rounded-2xl border border-slate-700 bg-slate-950/90 p-5 text-sm">
            {/* HEADER */}
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-100 mb-1">
                  Reel blueprint ready
                </h2>
                <p className="text-[11px] text-slate-400 max-w-md">
                  This includes script, pacing, visual cues, CTA logic,
                  thumbnail blueprint v3 and universal export data — fully tuned
                  for your offer selection.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/60 bg-emerald-500/10 px-3 py-1 text-emerald-200">
                  {videoLength}s · 9:16 · {mediaType}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-900 px-3 py-1 text-slate-300">
                  {genre} · {tone}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-900 px-3 py-1 text-slate-300">
                  {storyFormat}
                </span>
              </div>
            </div>

            {/* GRID START */}
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)]">
              {/* LEFT SIDE — SCRIPT + STORYBOARD + SUBTITLES + OFFER + RENDER */}
              <div className="space-y-4">
                {/* SCRIPT — collapsible */}
                <div className="border border-slate-700 rounded-xl bg-slate-900/70">
                  <button
                    onClick={() => setShowScript(!showScript)}
                    className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800/40 transition"
                  >
                    <span>
                      📜 Script (click to {showScript ? "hide" : "show"})
                    </span>
                    <span className="text-emerald-300">
                      {showScript ? "▲" : "▼"}
                    </span>
                  </button>

                  {showScript && (
                    <div className="px-4 py-3 text-[11px] text-slate-300 whitespace-pre-line">
                      {result.script}
                    </div>
                  )}
                </div>

                {/* STORYBOARD */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
                    Timeline Preview
                  </h3>

                  <ul className="space-y-2 text-xs text-slate-300">
                    {result.storyboard.map((frame, idx) => (
                      <li
                        key={idx}
                        className="rounded-xl border border-slate-800 bg-slate-950/80 p-3"
                      >
                        <div className="flex gap-3">
                          {/* TIMESTAMP */}
                          <span className="mt-0.5 inline-flex h-6 min-w-[52px] items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-emerald-300 border border-slate-700">
                            {frame.time.toFixed(1)}s
                          </span>

                          {/* DESCRIPTION */}
                          <div className="space-y-1">
                            <p className="text-xs text-slate-100">
                              {frame.description}
                            </p>

                            <p className="text-[10px] text-emerald-300/85">
                              Visual cue:{" "}
                              {frame.visualCue ||
                                "auto-matched stock clip / still based on scene."}
                            </p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* SUBTITLES */}
                {result.subtitles && result.subtitles.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
                      Subtitles
                    </h3>

                    <ul className="max-h-40 overflow-auto space-y-1 text-xs rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-slate-200">
                      {result.subtitles.map((line, idx) => (
                        <li key={idx}>• {line}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {/* CHOOSE OFFER – AUTOAFFI PREMIUM BLOCK v3.7 */}
                {/* --------------------------------------------- */}

                <div className="mt-8 rounded-2xl border border-emerald-400/40 bg-emerald-500/5 p-6 space-y-7">

                  {/* HEADER */}
                  <h3 className="text-sm font-semibold text-emerald-300 uppercase tracking-wide text-center">
                    Choose Offer · Recurring or Product
                  </h3>

                  <p className="text-[11px] text-slate-400 -mt-1 text-center max-w-xl mx-auto">
                    Your offer selection controls hooks, CTA, Smart Social Hints, AI-voice and video content.
                    <br />
                    Product offers pay <span className="font-semibold text-emerald-200">100% to you</span>.
                    Recurring offers pay <span className="font-semibold text-emerald-200">80% you / 20% Autoaffi</span>,
                    except Autoaffi Recurring which pays <span className="font-semibold text-emerald-200">50% / 50%</span>.
                  </p>

                  {/* INFO BOX */}
                  <div className="rounded-xl border border-amber-400/40 bg-amber-500/5 p-3 text-[11px] text-amber-100">
                    ⚠️ Connect your Product & Recurring platforms first so affiliate IDs sync automatically into every video.
                  </div>

{/* FUNNEL OPTION */}
<div className="mt-3 rounded-xl border border-purple-500/30 bg-purple-500/5 p-4">
  <label className="flex items-start gap-3 cursor-pointer">

    <input
      type="checkbox"
      checked={offerType === "funnel"}
      onChange={(e) => {
        if (e.target.checked) {
          setOfferType("funnel");
          setSelectedOffer({
            name: "My Funnel Setup",
            mode: "funnel",
            affiliateUrl: "", // funnel link from Supabase later
          });
        } else {
          setOfferType("recurring");
          setSelectedOffer(null);
        }
      }}
      className="mt-1 h-4 w-4 rounded border-purple-400/50 bg-purple-700/20"
    />

    <div>
      <p className="font-semibold text-purple-200 text-sm">
        🔮 Use my Funnel setup
      </p>

      <p className="text-xs text-purple-300/80 leading-relaxed mt-1">
        Autoaffi automatically injects your Funnel ID from your Funnels Card.
        <br />
        Your Reels will seamlessly drive traffic into your funnel — no setup needed.
      </p>
    </div>

  </label>
</div>
                  

                  {/* TOGGLE RECURRING / PRODUCT */}
                  <div className="flex justify-center gap-3 text-[11px] mt-4">
                    <button
                      onClick={() => { setOfferType("recurring"); setSelectedOffer(null); }}
                      className={`px-4 py-1.5 rounded-full border ${
                        offerType === "recurring"
                          ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                          : "border-slate-700 bg-slate-900 text-slate-300"
                      }`}
                    >
                      Recurring
                    </button>

                    <button
                      onClick={() => { setOfferType("product"); setSelectedOffer(null); }}
                      className={`px-4 py-1.5 rounded-full border ${
                        offerType === "product"
                          ? "border-sky-400 bg-sky-500/20 text-sky-200"
                          : "border-slate-700 bg-slate-900 text-slate-300"
                      }`}
                    >
                      Product
                    </button>
                  </div>

                  {/* SELECTED OFFER PREVIEW */}
                  {selectedOffer && (
                    <div className="rounded-xl border border-emerald-400/40 bg-slate-950/60 p-4 mt-2">
                      <p className="text-xs text-emerald-300 font-semibold mb-1">Selected Offer</p>
                      <p className="text-sm text-slate-100 font-semibold">{selectedOffer.name}</p>
                      <p className="text-[11px] text-emerald-200 mt-1">
                        {selectedOffer.mode === "product"
                          ? "Payout: 100% to you."
                          : selectedOffer.name === "Autoaffi Recurring"
                          ? "Payout: 50% you · 50% Autoaffi."
                          : "Payout: 80% you · 20% Autoaffi."}
                      </p>
                    </div>
                  )}

                  {/* --------------------------------------------- */}
                  {/* RECURRING MODE */}
                  {/* --------------------------------------------- */}
                  {offerType === "recurring" && (
                    <>
                      <h4 className="text-xs text-emerald-300 font-semibold mt-4">
                        Recurring Platforms (Auto-sync via Recurring AI Stack)
                      </h4>

<div className="space-y-3 py-2">
      {offerList.map((offer) => {
        const platformKey = offer.name.toLowerCase().replace(/\s+/g, "");
        const isActive = allowedPlatforms.includes(platformKey);

        return (
          <button
            key={offer.name}
            disabled={!isActive}
            onClick={() => {
              if (!isActive) {
                toast.error("Activate this platform in Recurring Income first!");
                return;
              }
              handleSelectRecurringOffer(offer);
            }}
            className={`
              w-full text-left px-4 py-3 rounded-xl transition
              ${isActive
                ? "bg-emerald-600 hover:bg-emerald-500 cursor-pointer"
                : "bg-gray-700/40 opacity-40 cursor-not-allowed"
              }
            `}
          >
            <span className="text-lg">{offer.icon}</span> {offer.name}
          </button>
        );
      })}
    </div>
                    </>
                  )}

                  {/* --------------------------------------------- */}
                  {/* PRODUCT MODE */}
                  {/* --------------------------------------------- */}
                  {offerType === "product" && (
                    <div className="mt-8 space-y-6">

                      {/* GLOBAL TOP 3 PRODUCT PICKS */}
                      <div>
                        <h4 className="text-xs font-semibold text-blue-300 mb-2">
                          Recommended Top Products (Global)
                        </h4>

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {allProducts.slice(0, 3).map((prod, i) => (
                            <div
                              key={i}
                              onClick={() => selectProduct(prod)}
                              className="cursor-pointer rounded-xl border border-slate-700 bg-slate-900/70 p-4 hover:border-blue-400 transition"
                            >
                              <p className="text-sm font-semibold text-slate-100">{prod.name}</p>
                              <p className="text-[11px] text-slate-400 mt-1">{prod.description}</p>

                              <div className="mt-3 text-[10px] grid grid-cols-2 gap-2">
                                <div className="rounded-lg bg-slate-950/50 border border-slate-800 p-2">
                                  <p className="text-blue-300 font-semibold">EPC</p>
                                  <p className="text-slate-400">{prod.epc}</p>
                                </div>
                                <div className="rounded-lg bg-slate-950/50 border border-slate-800 p-2">
                                  <p className="text-blue-300 font-semibold">Category</p>
                                  <p className="text-slate-400">{prod.category}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* PLATFORM SELECT */}
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Select product platform</label>
                        <select
                          value={selectedProductPlatform || ""}
                          onChange={(e) => handlePlatformSelect(e.target.value)}
                          className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-200"
                        >
                          <option value="">Select platform</option>
                          <option value="digistore">Digistore24</option>
                          <option value="amazon">Amazon</option>
                          <option value="cpalead">CPAlead</option>
                          <option value="mylead">MyLead</option>
                          <option value="impact">Impact</option>
                        </select>

                        {selectedProductPlatform && !platformConnections[selectedProductPlatform] && (
                          <p className="text-[11px] text-red-300 mt-1">
                            ⚠️ You must connect this platform first in “Affiliate Platforms”.
                          </p>
                        )}
                      </div>

                      {/* SEARCH */}
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Search product</label>
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => handleProductSearch(e.target.value)}
                          placeholder="Search any product..."
                          className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-200"
                        />
                      </div>

                      {/* SEARCH RESULTS */}
                      {searchQuery && filteredProducts.length > 0 && (
                        <div className="space-y-2 max-h-56 overflow-auto">
                          {filteredProducts.map((prod, i) => (
                            <div
                              key={i}
                              onClick={() => selectProduct(prod)}
                              className="cursor-pointer rounded-xl border border-slate-700 bg-slate-900/70 p-4 hover:border-blue-400 transition"
                            >
                              <p className="text-sm text-slate-100 font-semibold">{prod.name}</p>
                              <p className="text-[11px] text-slate-400 mt-1">Platform: {prod.platform}</p>
                              <p className="text-[11px] text-blue-300 mt-1">EPC: {prod.epc}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* RECOMMENDED BASED ON PLATFORM */}
                      {!searchQuery && selectedProductPlatform && recommendedProducts.length > 0 && (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {recommendedProducts.map((prod, i) => (
                            <div
                              key={i}
                              onClick={() => selectProduct(prod)}
                              className="cursor-pointer rounded-xl border border-slate-700 bg-slate-900/70 p-4 hover:border-blue-400 transition"
                            >
                              <p className="text-sm font-semibold text-slate-100">{prod.name}</p>
                              <p className="text-[11px] text-slate-400 mt-1">{prod.description}</p>
                              <p className="text-[10px] text-blue-300 mt-2">EPC: {prod.epc}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* SELECTED PRODUCT SUMMARY */}
                      {selectedOffer && offerType === "product" && (
                        <div className="rounded-xl border border-blue-400/40 bg-slate-950/60 p-4">
                          <p className="text-xs text-blue-300 font-semibold mb-1">Selected Product</p>
                          <p className="text-sm text-slate-100 font-semibold">{selectedOffer.name}</p>
                          <p className="text-[11px] text-slate-400 mt-1">Platform: {selectedOffer.platform}</p>

                          <div className="mt-2">
                            <p className="text-[11px] text-slate-400 mb-1">Affiliate link:</p>

                            <div className="flex gap-2">
                              <p className="flex-1 break-all rounded-lg bg-slate-950/80 border border-slate-800 px-3 py-2 text-[11px] text-slate-100">
                                {selectedOffer.affiliateUrl}
                              </p>
                              <button
                                onClick={() => navigator.clipboard.writeText(selectedOffer?.affiliateUrl ?? "")}
                                className="rounded-full border border-blue-400/70 bg-slate-950 px-3 py-1.5 text-[11px] text-blue-200 hover:bg-blue-500/10"
                              >
                                Copy
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* WARNING */}
                  {offerWarning && (
                    <p className="text-[11px] text-red-400 text-center mt-2">{offerWarning}</p>
                  )}
                </div>
                {/* CTA (TEXT) */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
                    Call to Action
                  </h3>
                  <p className="text-xs text-emerald-200 bg-slate-950/80 border border-emerald-400/40 rounded-xl p-3">
                    {result.cta}
                  </p>
                </div>

                {/* AUTOAFFI VX v3.5 — PREMIUM RENDER ENGINE */}
                <div className="mt-10 space-y-8 p-6 rounded-2xl bg-slate-900/80 border border-amber-400/60 shadow-[0_0_40px_rgba(250,204,21,0.15)]">
                  <h3 className="text-center text-sm font-semibold uppercase tracking-[0.25em] text-amber-300">
                    Autoaffi VX · 2026 Premium Render
                  </h3>

                  <p className="text-[11px] text-center text-slate-300 -mt-2">
                    AI hooks · AI voice · AI pacing · synced music · export-ready
                    MP4. Autoaffi always chooses the strongest combo to maximise
                    retention &amp; clicks based on your offer.
                  </p>

                  {/* VOICE ENGINE MODE */}
                  <div className="rounded-xl border border-slate-700/80 bg-slate-950/70 p-4 space-y-3">
                    <p className="text-[11px] font-semibold text-slate-100">
                      🎙 Autoaffi Voice Engine
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Choose how the voice is handled. Auto mode uses your
                      offerMeta (recurring / product / high-ticket) to choose
                      tone and energy, especially in the hook.
                    </p>

                    <div className="flex flex-col gap-2 text-[11px]">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="voiceMode"
                          value="auto"
                          checked={voiceMode === "auto"}
                          onChange={() => setVoiceMode("auto")}
                          className="h-3 w-3"
                        />
                        <span className="text-emerald-200 font-medium">
                          Recommended AI voice (Auto)
                        </span>
                        <span className="ml-auto text-[10px] text-slate-400">
                          Best for 99% of all reels
                        </span>
                      </label>

                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="voiceMode"
                          value="custom"
                          checked={voiceMode === "custom"}
                          onChange={() => setVoiceMode("custom")}
                          className="h-3 w-3"
                        />
                        <span className="text-slate-200">
                          Custom voice (you choose style)
                        </span>
                      </label>

                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="voiceMode"
                          value="none"
                          checked={voiceMode === "none"}
                          onChange={() => setVoiceMode("none")}
                          className="h-3 w-3"
                        />
                        <span className="text-slate-200">
                          No voice – music only (B-roll / text only)
                        </span>
                      </label>
                    </div>

                    {voiceMode === "custom" && (
                      <div className="mt-3">
                        <label className="text-xs font-semibold text-slate-300 mb-1 block">
                          Voice style (custom)
                        </label>
                        <select
                          value={voiceStyle}
                          onChange={(e) => setVoiceStyle(e.target.value)}
                          className="w-full rounded-lg bg-slate-800 border border-slate-700 text-xs px-3 py-2 text-slate-200"
                        >
                          <option value="natural">Natural storyteller</option>
                          <option value="deep">Deep authority</option>
                          <option value="female-soft">
                            Female soft &amp; warm
                          </option>
                          <option value="male-energetic">
                            Male energetic
                          </option>
                          <option value="radio">Radio / trailer style</option>
                        </select>
                      </div>
                    )}

                    {voiceMode === "auto" && (
                      <p className="text-[10px] text-emerald-300 mt-1">
                        Auto mode uses offerMeta (recurring vs product vs
                        high-ticket) to choose voice profile, tempo and pressure
                        in the hook.
                      </p>
                    )}
                  </div>

                  {/* REALISM SLIDER */}
                  <div>
                    <label className="text-xs font-semibold text-slate-300 mb-1 block">
                      🎭 Visual realism
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={realism}
                      onChange={(e) => setRealism(Number(e.target.value))}
                      className="w-full accent-emerald-400"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      {realism < 30
                        ? "Stylized / graphic – more AI feel, strong overlays."
                        : realism < 70
                        ? "Semi-realistic – mix of cinematic & social media look."
                        : "Highly realistic – close to filmed footage with soft grading."}
                    </p>
                  </div>

                  {/* MUSIC + SOUND */}
                  <div className="space-y-4 rounded-2xl bg-slate-900/70 border border-slate-700/60 p-4">
                    <h3 className="text-sm font-semibold text-slate-200">
                      🎵 Music & Sound Design
                    </h3>
                    <p className="text-[11px] text-slate-400 -mt-1">
                      Autoaffi syncs beats, transitions and impacts with your
                      hook and scene timeline. Voice always has priority over
                      music.
                    </p>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 mb-1 block">
                        Music mode
                      </label>
                      <select
                        value={musicMode}
                        onChange={(e) =>
                          setMusicMode(
                            e.target.value as "auto" | "upload" | "library"
                          )
                        }
                        className="w-full rounded-lg bg-slate-800 border border-slate-700 text-xs px-3 py-2 text-slate-200"
                      >
                        <option value="auto">Auto (recommended)</option>
                        <option value="library">Pick a style</option>
                        <option value="upload">Upload your own</option>
                      </select>
                    </div>

                    {musicMode === "library" && (
                      <div>
                        <label className="text-xs font-semibold text-slate-300 mb-1 block">
                          Music style
                        </label>
                        <select
                          value={musicStyle}
                          onChange={(e) => setMusicStyle(e.target.value)}
                          className="w-full rounded-lg bg-slate-800 border border-slate-700 text-xs px-3 py-2 text-slate-200"
                        >
                          <option value="cinematic">Cinematic</option>
                          <option value="emotional">Emotional</option>
                          <option value="energetic">Energetic</option>
                          <option value="dark">Dark</option>
                          <option value="minimal">Minimal</option>
                          <option value="corporate">Corporate</option>
                        </select>
                      </div>
                    )}

                    {musicMode === "upload" && (
                      <div>
                        <label className="text-xs font-semibold text-slate-300 mb-1 block">
                          Upload audio file
                        </label>
                        <input
                          type="file"
                          accept="audio/*"
                          onChange={handleMusicUpload}
                          className="block w-full text-xs text-slate-300"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-3 mt-2 text-[11px] text-slate-300">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={soundTransitions}
                          onChange={(e) =>
                            setSoundTransitions(e.target.checked)
                          }
                          className="h-3 w-3"
                        />
                        <span>Transitions</span>
                      </label>

                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={soundImpacts}
                          onChange={(e) => setSoundImpacts(e.target.checked)}
                          className="h-3 w-3"
                        />
                        <span>Impacts</span>
                      </label>

                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={soundAmbience}
                          onChange={(e) => setSoundAmbience(e.target.checked)}
                          className="h-3 w-3"
                        />
                        <span>Ambience</span>
                      </label>
                    </div>
                  </div>

                  {/* AUTOAFFI ONE-CLICK */}
                  <button
                    type="button"
                    onClick={applyAutoaffiMode}
                    className="w-full py-2.5 rounded-xl bg-amber-400 text-slate-950 font-semibold text-sm hover:bg-amber-300 shadow-[0_0_25px_rgba(250,204,21,0.4)] transition"
                  >
                    ✨ Autoaffi Mode (Recommended setup)
                  </button>

                  {/* RENDER BUTTON */}
<button
  onClick={startRenderVX}
  disabled={isRendering}
  className="w-full py-3 rounded-xl mt-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.4)] transition disabled:opacity-60"
>
  {isRendering
    ? "Rendering video…"
    : "🎬 Create Video (Ultra HD MP4)"}
</button>

{/* RENDER INFO · VX 4.1 */}
<p className="mt-2 text-[11px] text-slate-400 text-center">
  Autoaffi VX 4.1 använder dina{" "}
  <span className="text-emerald-300 font-semibold">
    voice- &amp; music-inställningar
  </span>{" "}
  plus din{" "}
  <span className="text-amber-300 font-semibold">
    valda offer (recurring eller produkt)
  </span>{" "}
  för att skapa ett Ultra HD-MP4 med synkade hooks, beats och CTA-övergångar.
</p>


                  {/* RENDER STATUS */}
                  {renderStatus === "processing" && (
                    <p className="text-center text-[11px] text-emerald-300 mt-2">
                      Video is processing… Autoaffi syncs hook, voice, music and
                      transitions. 🔄
                    </p>
                  )}

                  {renderStatus === "error" && (
                    <p className="text-center text-[11px] text-red-300 mt-2">
                      Something went wrong while rendering. Try again or tweak
                      your settings.
                    </p>
                  )}

{renderedVideo && (
  <div className="mt-8 p-4 rounded-xl bg-black/30 border border-emerald-400/30">
    <h3 className="text-emerald-300 font-semibold text-sm mb-3 text-center">
      🎬 Your Ultra HD Reel Is Ready
    </h3>

    <video
      src={renderedVideo}
      controls
      playsInline
      className="w-full rounded-xl border border-emerald-400/20 shadow-lg"
    />

    <a
      href={renderedVideo}
      download
      className="block text-center mt-4 text-emerald-300 underline text-sm hover:text-emerald-200"
    >
      📥 Download MP4
    </a>

    <p className="mt-1 text-[10px] text-slate-400 text-center">
      Generated by Autoaffi VX 2026 using your script, voice, music & media.
    </p>
  </div>
)}
                </div>
              </div>



              {/* RIGHT SIDE — SOCIAL HINTS + INTELLIGENCE + OFFER META */}
              <div className="space-y-4">
                {/* SMART SOCIAL HINTS */}
                {result.socialHints && (
                  <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/5 p-3">
                    <h3 className="text-xs font-semibold text-emerald-200 mb-2">
                      Smart Social Hints v3
                    </h3>

                    {/* Hashtags */}
                    {result.socialHints.hashtags &&
                      result.socialHints.hashtags.length > 0 && (
                        <div className="mb-2">
                          <p className="text-[11px] font-semibold text-emerald-200 mb-1">
                            Hashtags
                          </p>
                          <div className="flex flex-wrap gap-1.5 text-[11px]">
                            {result.socialHints.hashtags.map((tag, idx) => (
                              <span
                                key={idx}
                                className="rounded-full px-2 py-0.5 bg-slate-950/80 border border-emerald-400/40 text-emerald-100"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Titles */}
                    {result.socialHints.titleIdeas &&
                      result.socialHints.titleIdeas.length > 0 && (
                        <div className="mb-3">
                          <p className="text-[11px] font-semibold text-emerald-200 mb-1">
                            Title Ideas
                          </p>
                          <div className="flex flex-col gap-1.5 text-[11px]">
                            {result.socialHints.titleIdeas.map((title, idx) => (
                              <div
                                key={idx}
                                className="rounded-lg px-2 py-1 bg-slate-950/70 border border-emerald-400/40 text-slate-200"
                              >
                                {title}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Captions */}
                    {result.socialHints.captionIdeas &&
                      result.socialHints.captionIdeas.length > 0 && (
                        <div className="mb-3">
                          <p className="text-[11px] font-semibold text-emerald-200 mb-1">
                            Captions
                          </p>
                          <div className="flex flex-col gap-1.5 text-[11px]">
                            {result.socialHints.captionIdeas.map(
                              (caption, idx) => (
                                <div
                                  key={idx}
                                  className="rounded-lg px-2 py-1 bg-slate-950/70 border border-emerald-400/40 text-slate-200"
                                >
                                  {caption}
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                    {/* Posting Times */}
                    {result.socialHints.postingTimes &&
                      result.socialHints.postingTimes.length > 0 && (
                        <div className="mb-1">
                          <p className="text-[11px] font-semibold text-emerald-200 mb-1">
                            Suggested Posting Times
                          </p>
                          <p className="text-[11px] text-emerald-50">
                            {result.socialHints.postingTimes.join(" · ")}
                          </p>
                        </div>
                      )}
                  </div>
                )}

                {/* CTA & THUMBNAIL INTELLIGENCE (v3) */}
                {(result.ctaIntelligence || result.thumbnailIntelligence) && (
                  <div className="rounded-2xl border border-emerald-400/50 bg-slate-950/80 p-4 space-y-4">
                    <h3 className="text-xs font-semibold text-emerald-200 mb-1">
                      Autoaffi Intelligence Suite v3
                    </h3>
                    <p className="text-[10px] text-slate-400 mb-2">
                      This block is built only for one thing:{" "}
                      <span className="text-emerald-300 font-semibold">
                        more clicks, more views, more sales.
                      </span>
                    </p>

                    {/* CTA Intelligence */}
                    {result.ctaIntelligence && (
                      <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/5 p-3 text-[11px] space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-emerald-200">
                            CTA Intelligence v3
                          </p>
                          {typeof result.ctaIntelligence.clarityScore ===
                            "number" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-950/80 border border-emerald-400/60 px-2.5 py-0.5 text-[10px] text-emerald-200">
                              Clarity:{" "}
                              {result.ctaIntelligence.clarityScore.toFixed(0)}
                              /10
                            </span>
                          )}
                        </div>

                        <p className="text-slate-300">
                          Final CTA suggestion:
                          <span className="block mt-1 text-emerald-200 font-medium">
                            {result.ctaIntelligence.finalCtaLine ||
                              result.cta}
                          </span>
                        </p>

                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {result.ctaIntelligence.hookType && (
                            <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-2">
                              <p className="text-[10px] text-slate-400">
                                Hook type
                              </p>
                              <p className="text-[11px] text-emerald-200">
                                {result.ctaIntelligence.hookType}
                              </p>
                            </div>
                          )}

                          {result.ctaIntelligence.urgencyLevel && (
                            <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-2">
                              <p className="text-[10px] text-slate-400">
                                Urgency
                              </p>
                              <p className="text-[11px] text-emerald-200">
                                {result.ctaIntelligence.urgencyLevel}
                              </p>
                            </div>
                          )}
                        </div>

                        {result.ctaIntelligence.powerWords &&
                          result.ctaIntelligence.powerWords.length > 0 && (
                            <div className="mt-2">
                              <p className="text-[10px] text-slate-400 mb-1">
                                Power words used:
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {result.ctaIntelligence.powerWords.map(
                                  (word, idx) => (
                                    <span
                                      key={idx}
                                      className="rounded-full bg-emerald-500/10 border border-emerald-400/40 px-2 py-0.5 text-[10px] text-emerald-200"
                                    >
                                      {word}
                                    </span>
                                  )
                                )}
                              </div>
                            </div>
                          )}

                        {result.ctaIntelligence.frictionPhrases &&
                          result.ctaIntelligence.frictionPhrases.length > 0 && (
                            <div className="mt-2">
                              <p className="text-[10px] text-slate-400 mb-1">
                                Avoid these friction phrases:
                              </p>
                              <ul className="list-disc list-inside text-[10px] text-amber-300">
                                {result.ctaIntelligence.frictionPhrases.map(
                                  (phrase, idx) => (
                                    <li key={idx}>{phrase}</li>
                                  )
                                )}
                              </ul>
                            </div>
                          )}
                      </div>
                    )}

                    {/* THUMBNAIL INTELLIGENCE v3 */}
                    {result.thumbnailIntelligence && (
                      <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/5 p-4">
                        <h4 className="text-[11px] font-semibold text-emerald-200 mb-2">
                          Thumbnail Intelligence v3
                        </h4>

                        <p className="text-[11px] text-slate-400 mb-3">
                          Copy this into ChatGPT (free) or any image AI to
                          create your thumbnail:
                        </p>

                        <div className="text-[11px] text-emerald-200 bg-slate-950/60 border border-emerald-400/40 rounded-xl p-3 whitespace-pre-line">
                          {result.thumbnailIntelligence.finalPrompt ?? ""}
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                          <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800">
                            <p className="text-emerald-300 font-semibold">
                              Emotion
                            </p>
                            <p className="text-slate-400">
                              {result.thumbnailIntelligence.emotion ??
                                "High contrast, curiosity-driven"}
                            </p>
                          </div>

                          <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800">
                            <p className="text-emerald-300 font-semibold">
                              Focal Point
                            </p>
                            <p className="text-slate-400">
                              {result.thumbnailIntelligence.focalPoint ??
                                "Main subject on one side, bold text on the other"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3">
                          <p className="text-[10px] text-slate-400 mb-1">
                            Suggested Colors:
                          </p>
                          <div className="flex gap-2">
                            {result.thumbnailIntelligence.colorPalette?.map(
                              (hex, idx) => (
                                <div
                                  key={idx}
                                  className="h-5 w-5 rounded-full border border-slate-700"
                                  style={{ backgroundColor: hex }}
                                />
                              )
                            )}
                          </div>
                        </div>

                        {result.thumbnailIntelligence.layoutNotes && (
                          <p className="mt-2 text-[10px] text-slate-400">
                            Layout: {result.thumbnailIntelligence.layoutNotes}
                          </p>
                        )}

                        <button
                          onClick={() =>
                            navigator.clipboard.writeText(
                              result.thumbnailIntelligence?.finalPrompt ?? ""
                            )
                          }
                          className="mt-4 w-full py-2.5 rounded-xl bg-emerald-600 text-slate-950 font-semibold text-xs hover:bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)] transition"
                        >
                          Copy Thumbnail Prompt
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* OFFER META */}
                {effectiveOfferMeta && (
                  <div className="rounded-2xl border border-slate-700 bg-slate-900/90 p-3">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <p className="text-[11px] font-semibold text-slate-100">
                          Offer attached to this reel
                        </p>
                        <p className="text-xs text-slate-300">
                          {effectiveOfferMeta.name}
                        </p>
                      </div>

                      {typeof effectiveOfferMeta.rating === "number" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-950/80 border border-emerald-400/50 px-3 py-1 text-[11px] text-emerald-200">
                          ⭐ {effectiveOfferMeta.rating.toFixed(1)}/5
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-emerald-200 mb-2">
                      {getPayoutText(effectiveOfferMeta)}
                    </p>

                    <div className="flex flex-wrap gap-2 text-[11px] text-slate-300 mb-2">
                      {effectiveOfferMeta.mode && (
                        <span className="rounded-full bg-slate-950/80 border border-slate-700 px-2 py-0.5">
                          Mode: {effectiveOfferMeta.mode}
                        </span>
                      )}
                      {effectiveOfferMeta.commissionRate && (
                        <span className="rounded-full bg-slate-950/80 border border-slate-700 px-2 py-0.5">
                          Commission: {effectiveOfferMeta.commissionRate}
                        </span>
                      )}
                      {typeof effectiveOfferMeta.epc === "number" && (
                        <span className="rounded-full bg-slate-950/80 border border-slate-700 px-2 py-0.5">
                          EPC: ${effectiveOfferMeta.epc}
                        </span>
                      )}
                      {effectiveOfferMeta.category && (
                        <span className="rounded-full bg-slate-950/80 border border-slate-700 px-2 py-0.5">
                          {effectiveOfferMeta.category}
                        </span>
                      )}
                    </div>

                    {effectiveOfferMeta.affiliateUrl && (
                      <div>
                        <p className="text-[11px] text-slate-400 mb-1">
                          Affiliate link Autoaffi suggests:
                        </p>

                        <div className="flex flex-col sm:flex-row gap-2">
                          <p className="flex-1 break-all rounded-lg bg-slate-950/80 border border-slate-800 px-3 py-2 text-[11px] text-slate-100">
                            {effectiveOfferMeta.affiliateUrl}
                          </p>
                          <button
                            onClick={() =>
                              navigator.clipboard.writeText(
                                effectiveOfferMeta?.affiliateUrl ?? ""
                              )
                            }
                            className="rounded-full border border-emerald-400/70 bg-slate-950 px-3 py-1.5 text-[11px] text-emerald-200 hover:bg-emerald-500/10"
                          >
                            Copy
                          </button>
                        </div>

                        <p className="mt-1 text-[10px] text-slate-500">
                          Use this in your description or first comment. Autoaffi
                          also weaves it into your CTA logic.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}