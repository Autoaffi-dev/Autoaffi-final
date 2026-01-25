"use client";

import React, { useState } from "react";

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------
import AdvancedAIBreakdown from "@/components/reels/AdvancedAIBreakdown";
import GenerateControls from "@/components/reels/GenerateControls";
import GuidedPanel from "@/components/reels/GuidedPanel";
import ManualPremiumPanel from "@/components/reels/ManualPremiumPanel";
import MediaTypeSelector from "@/components/reels/MediaTypeSelector";
import ModeSelector from "@/components/reels/ModeSelector";
import OfferPanels from "@/components/reels/OfferPanels";
import OfferTypeSelector from "@/components/reels/OfferTypeSelector";
import RenderVX from "@/components/reels/RenderVX";
import SocialHintsPanel from "@/components/reels/SocialHintsPanel";
import StoryAndLengthSelector from "@/components/reels/StoryAndLengthSelector";
import SubtitlesPanel from "@/components/reels/SubtitlesPanel";
import ThumbnailIntelligencePanel from "@/components/reels/ThumbnailIntelligencePanel";
import TimelinePreview from "@/components/reels/TimelinePreview";
import OfferMetaPanel from "@/components/reels/OfferMetaPanel";
import ScriptPanel from "@/components/reels/ScriptPanel";

// ============================================================================
// PAGE COMPONENT
// ============================================================================
export default function Page() {
  // ============================
  // GLOBAL REEL CREATION STATE
  // ============================
  const [mode, setMode] = useState<"auto" | "guided" | "manual">("auto");
  const [guidedText, setGuidedText] = useState("");

  const [mediaType, setMediaType] = useState<"mixed" | "video" | "stills">(
    "mixed"
  );

  const [videoLength, setVideoLength] = useState<number>(20);
  const [storyFormat, setStoryFormat] =
    useState<string>("Hook → Value → CTA");

  const [genre, setGenre] = useState("Cinematic");
  const [tone, setTone] = useState("Friendly");

  // ============================
  // OFFER STATE
  // ============================
  const [offerMode, setOfferMode] = useState<
    "product" | "recurring" | "funnel"
  >("product");

  const [productCategory, setProductCategory] = useState("ai");
  const [manualProductSearch, setManualProductSearch] = useState("");
  const [currentProducts, setCurrentProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const [affiliateLink, setAffiliateLink] = useState<string | null>(null);

  const [missingAffiliateWarning, setMissingAffiliateWarning] =
    useState(false);

  const [recurringPlatform, setRecurringPlatform] = useState("");
  const [recurringSubID, setRecurringSubID] = useState("");
  const [recurringPlatforms, setRecurringPlatforms] = useState<any[]>([]);

  const [funnelUrl, setFunnelUrl] = useState("");

  const [offerMeta, setOfferMeta] = useState<any | null>(null);

  // TEMP – här kan vi senare koppla in riktig produkt-affiliate-logik
  const generateAffiliateLinkForProduct = React.useCallback(
    (productId: string) => {
      console.log("[REELS] generateAffiliateLinkForProduct called", { productId });
      // När du har en riktig generator kan du göra t.ex:
      // setAffiliateLink(generatedUrl);
    },
    []
  );

  const handleSelectRecurringPlatform = React.useCallback(
  (platformId: string) => {
    // 1) markera vald plattform
    setRecurringPlatform(platformId);

    // 2) hitta plattformen i listan vi laddat från /api/recurring/platforms
    const platform = recurringPlatforms.find((p: any) => p.id === platformId);
    if (!platform) return;

    // 3) sätt SubID (autoaffi_user_code) om den finns
    if (platform.subId) {
      setRecurringSubID(platform.subId);
    } else {
      setRecurringSubID("");
    }

    // 4) sätt affiliate-länken + varning
    if (platform.affiliateUrl) {
      setAffiliateLink(platform.affiliateUrl);
      setMissingAffiliateWarning(false);
    } else {
      setAffiliateLink(null);
      setMissingAffiliateWarning(true); // “lägg in din länk”-varning i UI
    }
  },
  [recurringPlatforms]
);

  React.useEffect(() => {
    let meta: any | null = null;

    

    // PRODUCT META
    if (offerMode === "product" && selectedProduct) {
      meta = {
        name: selectedProduct.name,
        rating: selectedProduct.stars ?? null,
        category: productCategory,
        commissionRate: (selectedProduct.commission ?? "") + "%",
        epc: selectedProduct.epc ?? null,
        affiliateUrl: affiliateLink ?? "",
        mode: "product",
      };
    }

    // RECURRING META
    if (offerMode === "recurring" && recurringPlatform) {
      const p = recurringPlatforms.find((x) => x.id === recurringPlatform);
      if (p) {
        meta = {
          name: p.name,
          rating: 5.0,
          commissionRate: (p.commission ?? "") + "% recurring",
          affiliateUrl: affiliateLink ?? "",
          mode: "recurring",
          category: "saas",
        };
      }
    }

    // FUNNEL META
    if (offerMode === "funnel" && funnelUrl) {
      meta = {
        name: "User Funnel",
        rating: null,
        category: "funnel",
        commissionRate: "",
        affiliateUrl: funnelUrl,
        mode: "funnel",
      };
    }

    setOfferMeta(meta);
  }, [
    offerMode,
    selectedProduct,
    productCategory,
    affiliateLink,
    recurringPlatform,
    recurringPlatforms,
    funnelUrl,
  ]);


  // ============================
  // LADDA RECURRING-PLATTFORMAR
  // ============================
  React.useEffect(() => {
    let isMounted = true;

    const loadRecurringPlatforms = async () => {
      try {
        const res = await fetch("/api/recurring/platforms", {
          method: "GET",
        });

        if (!res.ok) {
          console.error(
            "[REELS] /api/recurring/platforms failed",
            res.status
          );
          return;
        }

        const data = await res.json();

        // Antag att API:t returnerar { ok: true, platforms: [...] }
        const platforms = Array.isArray(data.platforms) ? data.platforms : [];

        if (!isMounted) return;

        setRecurringPlatforms(platforms);
      } catch (err) {
        console.error("[REELS] loadRecurringPlatforms crash", err);
      }
    };

    loadRecurringPlatforms();

    return () => {
      isMounted = false;
    };
  }, []);

  // ============================
  // MANUAL UPLOADS
  // ============================
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [letAutoPickImages, setLetAutoPickImages] = useState(false);

  // ============================
  // RESULT STATE
  // ============================
  const [result, setResult] = useState<any>(null);

  const [recommendedTitle, setRecommendedTitle] =
    useState<string | null>(null);
  const [recommendedCaption, setRecommendedCaption] =
    useState<string | null>(null);
  const [recommendedHashtags, setRecommendedHashtags] = useState<string[]>(
    []
  );

  // CTA state (for SocialHintsPanel)
  const [recommendedCTA, setRecommendedCTA] = useState<string | null>(null);

  // CTA suggestions per generation (3 st som byts vid varje Generate)
const [ctaIdeas, setCtaIdeas] = useState<string[]>([]);

  // ============================
  // PREVIEW / AUDIO STATE
  // ============================
  const [voiceStyle, setVoiceStyle] = useState("default");
  const [realism, setRealism] = useState(50);

  const [musicMode, setMusicMode] = useState<"auto" | "upload" | "library">(
    "auto"
  );
  const [musicStyle, setMusicStyle] = useState("cinematic");

  const [soundTransitions, setSoundTransitions] = useState(true);
  const [soundImpacts, setSoundImpacts] = useState(true);
  const [soundAmbience, setSoundAmbience] = useState(true);

  const handleMusicUpload = (e: any) => {
    console.log("Music uploaded", e.target.files?.[0]);
  };

  const applyAutoaffiMode = () => {
    setRealism(80);
    setSoundTransitions(true);
    setSoundImpacts(true);
    setSoundAmbience(true);
  };

  // ============================
  // RENDER STATE
  // ============================
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderMessage, setRenderMessage] = useState("");
  const [renderedVideo, setRenderedVideo] = useState<string | null>(null);

  const downloadRenderedVideo = () => {
    if (!renderedVideo) return;
    const a = document.createElement("a");
    a.href = renderedVideo;
    a.download = "autoaffi-reel.mp4";
    a.click();
  };

  // ============================
  // GENERATE HANDLER
  // ============================
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      setError("");

      // 2s delay BEFORE generating new content (cost-control + anti spam)
      await sleep(2000);

      // OFFER SELECTION (SYNCED WITH YOUR CARDS)
      const selectedOffer =
        offerMode === "product"
          ? {
              mode: "product" as const,
              name: selectedProduct?.name ?? "",
              productRawId: selectedProduct?.id ?? "",
              category: productCategory,
              affiliateLink: affiliateLink ?? "",
            }
          : offerMode === "recurring"
          ? {
              mode: "recurring" as const,
              platform: recurringPlatform,
              recurringRawId: recurringPlatform,
              subId: recurringSubID,
              affiliateLink: affiliateLink ?? "",
              category: "saas",
            }
          : {
              mode: "funnel" as const,
              funnelRawId: funnelUrl,
              url: funnelUrl,
              affiliateLink: affiliateLink ?? "",
            };

      const payload = {
        mode,
        mediaType,
        guidedText,
        storyFormat,
        videoLength,
        genre,
        tone,
        selectedOffer,
        // Force new output each click (prevents accidental reuse/caching)
        generationId: `${Date.now()}_${Math.random()
          .toString(16)
          .slice(2)}`,
      };

      const res = await fetch("/api/reels/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to generate.");
        return;
      }

setResult({
  script: data.script || [],
  scenes: data.scenes || data.exportTimeline?.scenes || [],
  beatMap: data.beatMap || [],
  voiceTimeline: data.voiceTimeline || [],
  exportTimeline:
    data.exportTimeline || {
      totalDuration: videoLength,
      scenes: [],
    },
  subtitles: data.subtitles || [],
  pacing: data.pacing || [],
  socialHints:
    data.socialHints || {
      hashtags: [],
      titleIdeas: [],
      captionIdeas: [],
      postingTimes: [],
      ctaIdeas: [],
    },
  thumbnailIntelligence:
    data.thumbnailIntelligence || {
      finalPrompt:
        "High-CTR thumbnail with bold hook, strong emotion, centered subject.",
      emotion: "High Energy",
      focalPoint: "Centered Subject",
      ctaStyle: "Bold Emerald CTA",
      hookPower: "Strong Curiosity",
      colorPalette: ["#10b981", "#0f172a", "#1e293b"],
    },
  aiBreakdown: data.aiBreakdown || null,

  // 🔥 VIKTIGT: mediaFiles från generate → worker
  mediaFiles: data.mediaFiles || [],
});

      // --- CTA suggestions per generation ---
      const apiCtasRaw = data?.socialHints?.ctaIdeas as
        | string[]
        | undefined;
      let nextCtas: string[] = [];

      if (Array.isArray(apiCtasRaw)) {
        nextCtas = apiCtasRaw.filter(Boolean).slice(0, 3);
      }

      if (nextCtas.length === 0) {
        // fallback men "shuffle" lite så det känns nytt varje gång
        const defaults = [
          "Tap the link to unlock it now ✅",
          "Start today — your future self will thank you 🚀",
          "Want results fast? Click and try it now 👇",
          "Ready to see it in action? Click now 🎬",
          "Claim your spot before it’s gone ⏳",
        ];

        const seed = Date.now();
        nextCtas = defaults
          .map(
            (txt, idx) =>
              [txt, (seed + idx * 9973) % 100000] as const
          )
          .sort((a, b) => a[1] - b[1])
          .map(([txt]) => txt)
          .slice(0, 3);
      }

      // spara CTA-förslagen i state (används av SocialHintsPanel)
      setCtaIdeas(nextCtas);

      // Reset valda rekommendationer så det känns nytt varje klick
      setRecommendedCTA(null);
      setRecommendedTitle(null);
      setRecommendedCaption(null);
      setRecommendedHashtags([]);
    } catch (err: any) {
      setError(err.message || "Unknown error.");
    } finally {
      setIsGenerating(false);
    }
  };

  // ============================
  // START RENDER (VX WORKER)
  // ============================
const startRenderVX = async (fd: FormData) => {
  if (!result) {
    // ingen generation ännu
    return {
      ok: false,
      videoUrl: null,
      error: "No generated reel found. Please click Generate first.",
    };
  }

  setIsRendering(true);
  setRenderProgress(10);
  setRenderMessage("Starting render...");

  const interval = setInterval(() => {
    setRenderProgress((p) => {
      if (p >= 90) return 90;
      return p + 5;
    });
  }, 600);

  try {

// --- Clampad längd för snabbare, säkrare render ---
const targetDuration =
      result.exportTimeline?.totalDuration ??
      videoLength ??
      20;

    // Håll oss mellan 12–25 sek för att minska timeout-risk
    const safeDuration = Math.min(25, Math.max(12, targetDuration));


    const res = await fetch("/api/reels/render-vx", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // 🔑 Extra context till backend
        genre, // så backend kan hämta rätt media vid fallback
        mediaType,

        // 🎚 KONTROLLER – använder dina befintliga state-namn
        realism: realism ?? 50,
        voiceStyle: voiceStyle ?? "default",
        musicMode: musicMode ?? "auto",
        musicTransitions: soundTransitions ? "auto" : "none",
        musicImpacts: soundImpacts ? "auto" : "none",
        musicAmbience: soundAmbience ? "auto" : "none",

        // 🧠 DATA FRÅN /api/reels/generate – använder `result`
        script:
          Array.isArray(result.script)
            ? result.script.join("\n")
            : result.script ?? "",
        guidedText: guidedText ?? "",
      duration: safeDuration,
      beatMap: result.beatMap ?? [],
      voiceTimeline: result.voiceTimeline ?? [],
      exportTimeline: {
        ...(result.exportTimeline ?? {}),
        totalDuration: safeDuration,
      },
      subtitles: result.subtitles ?? [],
        scenes: result.scenes ?? [],
        recommendedCTA: recommendedCTA ?? "",

        // 🔥 MEDIAFILES TILL WORKERN
        mediaFiles: result.mediaFiles ?? [],
      }),
    });

    clearInterval(interval);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[RENDER-VX] API error", res.status, text);

      setRenderProgress(0);
      setRenderMessage("✗ Render failed");
      setIsRendering(false);

      return {
        ok: false,
        videoUrl: null,
        error: "Render worker returned an error",
      };
    }

    const data = await res.json();

    const videoUrl = data?.videoUrl ?? null;

    if (!videoUrl) {
      console.error("[RENDER-VX] Missing videoUrl in response", data);

      setRenderProgress(0);
      setRenderMessage("✗ Render failed (no videoUrl)");
      setIsRendering(false);

      return {
        ok: false,
        videoUrl: null,
        error: "Render completed but no videoUrl was returned",
      };
    }

    // ✅ spara URL i page-state OCH skicka tillbaka till RenderVX
    setRenderedVideo(videoUrl);

    setRenderProgress(100);
    setRenderMessage("🎉 Render finished!");
    setIsRendering(false);

    return {
      ok: true,
      videoUrl,
      error: undefined,
    };
  } catch (err: any) {
    clearInterval(interval);
    console.error("[RENDER-VX] Client error", err);
    setRenderProgress(0);
    setRenderMessage("✗ Render crashed");
    setIsRendering(false);

    return {
      ok: false,
      videoUrl: null,
      error: err?.message || "Client crash during render",
    };
  }
};

  // ============================================================================
  // UI RETURN
  // ============================================================================
  return (
    <div className="p-10 space-y-16">
      {/* 1. HEADER + SEO BOXES */}
      <section className="text-center space-y-6">
        <h1 className="text-4xl font-bold text-emerald-300">
          Autoaffi VX — World Class Reel Engine
        </h1>
        <p className="text-gray-300">
          Powered by AI-script, pacing engine, CTA intelligence & Thumbnail
          V3.
        </p>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-400/20">
            <h3 className="font-semibold text-emerald-300 mb-2">
              WORLD-CLASS HOOKS + SEO
            </h3>
            <p className="text-gray-300 text-sm">
              Every reel is optimized with retention-boosted hooks, pacing
              markers and keyword-driven SEO mapping.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-blue-500/5 border border-blue-400/20">
            <h3 className="font-semibold text-blue-300 mb-2">
              SMART SOCIAL HINTS
            </h3>
            <p className="text-gray-300 text-sm">
              Autoaffi predicts titles, captions, CTA & hashtags using
              platform psychology.
            </p>
          </div>
        </div>
      </section>

      {/* 2. MODE SELECTOR + MEDIA TYPE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <ModeSelector mode={mode} setMode={setMode} />
        <MediaTypeSelector
          mediaType={mediaType}
          setMediaType={setMediaType}
        />
      </div>

      {/* Guided or Manual */}
      {mode === "guided" && (
        <GuidedPanel
          guidedText={guidedText}
          setGuidedText={setGuidedText}
        />
      )}

      {mode === "manual" && (
        <ManualPremiumPanel
          imageFiles={imageFiles}
          setImageFiles={setImageFiles}
          videoFiles={videoFiles}
          setVideoFiles={setVideoFiles}
          letAutoPickImages={letAutoPickImages}
          setLetAutoPickImages={setLetAutoPickImages}
          videoLength={videoLength}
        />
      )}

      {/* 3. STORY FORMAT + LENGTH */}
      <StoryAndLengthSelector
        storyFormat={storyFormat}
        setStoryFormat={setStoryFormat}
        videoLength={videoLength}
        setVideoLength={setVideoLength}
      />

      {/* 4. OFFER SYSTEM — TYPE + PANELS + META */}
      <OfferTypeSelector offerMode={offerMode} setOfferMode={setOfferMode} />

<OfferPanels
  offerMode={offerMode}
  setOfferMode={setOfferMode}
  productCategory={productCategory}
  setProductCategory={setProductCategory}
  manualProductSearch={manualProductSearch}
  setManualProductSearch={setManualProductSearch}
  currentProducts={currentProducts}
  selectedProduct={selectedProduct}
  setSelectedProduct={setSelectedProduct}
  generateAffiliateLinkForProduct={generateAffiliateLinkForProduct}
  affiliateLink={affiliateLink}
  missingAffiliateWarning={missingAffiliateWarning}
  recurringPlatform={recurringPlatform}
  setRecurringPlatform={setRecurringPlatform}
  recurringSubID={recurringSubID}
  setRecurringSubID={setRecurringSubID}
  recurringPlatforms={recurringPlatforms}
  generateAffiliateLinkForRecurring={(platformId) => {
    // 1) spara vald plattform
    setRecurringPlatform(platformId);

    // 2) hitta plattformen i listan
    const p = recurringPlatforms.find((x) => x.id === platformId);

    // 3) sätt tracking-ID + affiliate-länk
    if (p) {
      setRecurringSubID(p.subId ?? "");
      setAffiliateLink(p.affiliateUrl ?? null);
    } else {
      setRecurringSubID("");
      setAffiliateLink(null);
    }
  }}
  funnelUrl={funnelUrl}
  setFunnelUrl={setFunnelUrl}
/>

      {offerMeta && (
        <OfferMetaPanel
          offerMeta={offerMeta}
          onCopyLink={() =>
            navigator.clipboard.writeText(offerMeta.affiliateUrl || "")
          }
        />
      )}

      {/* 5. GENERATE CONTROLS */}
      <GenerateControls
        handleGenerate={handleGenerate}
        isGenerating={isGenerating}
        error={error}
        genre={genre}
        setGenre={setGenre}
        tone={tone}
        setTone={setTone}
        storyFormat={storyFormat}
        setStoryFormat={setStoryFormat}
        videoLength={videoLength}
        setVideoLength={setVideoLength}
        mode={mode}
        mediaType={mediaType}
      />

      {/* 6. TIMELINE PREVIEW */}
      {result &&
        (Array.isArray(result.scenes) ||
          Array.isArray(result.pacing)) && (
          <TimelinePreview result={result} videoLength={videoLength} />
        )}

      {/* 7. SOCIAL HINTS (inkl. CTA under captions + Apply All inne i panelen) */}
      {result && (
        <SocialHintsPanel
          hashtags={result.socialHints?.hashtags || []}
          titleIdeas={result.socialHints?.titleIdeas || []}
          captionIdeas={result.socialHints?.captionIdeas || []}
          bestPostingTimes={result.socialHints?.postingTimes || []}
          recommendedTitle={recommendedTitle}
          setRecommendedTitle={setRecommendedTitle}
          recommendedCaption={recommendedCaption}
          setRecommendedCaption={setRecommendedCaption}
          recommendedHashtags={recommendedHashtags}
          setRecommendedHashtags={setRecommendedHashtags}
          recommendedCTA={recommendedCTA}
          setRecommendedCTA={setRecommendedCTA}
          ctaIdeas={ctaIdeas}
          thumbnailIntelligence={result.thumbnailIntelligence}
          socialHints={result.socialHints}
        />
      )}

      {/* 8. THUMBNAIL INTELLIGENCE */}
      {result && <ThumbnailIntelligencePanel result={result} />}

      {/* 9. ADVANCED AI BREAKDOWN */}
      {result && (
        <AdvancedAIBreakdown
          breakdown={{
            ...(result.aiBreakdown || {}),
            hooks: result.aiBreakdown?.hooks || [],
            pacing: result.aiBreakdown?.pacing || result?.pacing || [],
            cta: result.aiBreakdown?.cta || recommendedCTA || "",
            emotionalDrivers:
              result.aiBreakdown?.emotionalDrivers || [],
            recommendations:
              result.aiBreakdown?.recommendations || [],
            heatValues: result.aiBreakdown?.heatValues || [],
          }}
        />
      )}

      {/* 10. SCRIPT + SUBTITLES – OVANFÖR AUTOAFFI VX */}
 {result && (
        <div className="space-y-10">
          <ScriptPanel
            script={
              Array.isArray(result.script)
                ? result.script
                : typeof result.script === "string"
                ? [result.script]
                : []
            }
          />

          <SubtitlesPanel
            subtitles={(result.subtitles || []).map((s: any) =>
              typeof s === "string" ? s : s.text ?? ""
            )}
          />
        </div>
      )}

      {/* 11. RENDER ENGINE (AUTOAFFI VX) + STATUS */}
      {result && (
        <div className="space-y-8">
          {isRendering && (
            <div className="w-full space-y-3">
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${renderProgress}%` }}
                />
              </div>
              <p className="text-gray-300 text-sm">{renderMessage}</p>
            </div>
          )}

          {renderedVideo && !isRendering && (
            <div className="space-y-4">
              <p className="text-emerald-300 font-semibold text-center">
                🎉 Render finished! Your video is ready.
              </p>

              <button
                onClick={downloadRenderedVideo}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
              >
                ⬇️ Download MP4
              </button>
            </div>
          )}

          {affiliateLink && (
            <div className="p-6 rounded-xl bg-emerald-900/20 border border-emerald-500/30">
              <h3 className="text-emerald-300 font-semibold mb-2">
                Affiliate Tracking Enabled
              </h3>
              <p className="text-gray-200 text-sm break-all">
                {affiliateLink}
              </p>
            </div>
          )}

          <RenderVX
            startRenderVX={startRenderVX}
            mode={mode}
            videoLength={videoLength}
            affiliateLink={affiliateLink}
          />
        </div>
      )}
    </div>
  );
}