"use client";

import React, { useState } from "react";

// --------------- COMPONENTS (ALL 15 / INGENTING EXTRA) --------------------
import GenerateControls from "@/components/reels/GenerateControls";
import GeneratePanel from "@/components/reels/GeneratePanel";
import ManualPremiumPanel from "@/components/reels/ManualPremiumPanel";
import MediaTypeSelector from "@/components/reels/MediaTypeSelector";
import GuidedPanel from "@/components/reels/GuidedPanel";
import MetaDataPanel from "@/components/reels/MetaDataPanel";
import ModeSelector from "@/components/reels/ModeSelector";
import OfferMetaPanel from "@/components/reels/OfferMetaPanel";
import OfferPanels from "@/components/reels/OfferPanels";
import OfferTypeSelector from "@/components/reels/OfferTypeSelector";
import RenderVX from "@/components/reels/RenderVX";
import ResultPreview from "@/components/reels/ResultPreview";
import SocialHintsPanel from "@/components/reels/SocialHintsPanel";
import StoryAndLengthSelector from "@/components/reels/StoryAndLengthSelector";
import ThumbnailIntelligencePanel from "@/components/reels/ThumbnailIntelligencePanel";
import TimelinePreview from "@/components/reels/TimelinePreview";

// ---------------------------------------------------------------------------
//                                PAGE COMPONENT
// ---------------------------------------------------------------------------
export default function Page() {

  // ============================
  // GLOBAL CREATION STATE
  // ============================
  const [mode, setMode] = useState<"auto" | "guided" | "manual">("auto");
  const [guidedText, setGuidedText] = useState("");
  const [mediaType, setMediaType] = useState<"mixed" | "video" | "stills">("mixed");

  const [videoLength, setVideoLength] = useState<number>(30);
  const [storyFormat, setStoryFormat] = useState<string>("Hook → Value → CTA");

  const [genre, setGenre] = useState("Cinematic");
  const [tone, setTone] = useState("Friendly");


  // ============================
  // OFFER STATE
  // ============================
  const [offerMode, setOfferMode] = useState<"product" | "recurring" | "funnel">("product");

  const [productCategory, setProductCategory] = useState("ai");
  const [manualProductSearch, setManualProductSearch] = useState("");
  const [currentProducts, setCurrentProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const [affiliateLink, setAffiliateLink] = useState<string | null>(null);
  const [missingAffiliateWarning, setMissingAffiliateWarning] = useState(false);

  // recurring
  const [recurringPlatform, setRecurringPlatform] = useState("");
  const [recurringSubID, setRecurringSubID] = useState("");
  const [recurringPlatforms, setRecurringPlatforms] = useState<any[]>([]);

  // funnel
  const [funnelUrl, setFunnelUrl] = useState("");

  // ============================
  // MANUAL MODE UPLOADS
  // ============================
const [imageFiles, setImageFiles] = useState<File[]>([]);
const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [letAutoPickImages, setLetAutoPickImages] = useState(false);

  const handleAutoContextFill = () => {
    console.log("Auto context filler triggered");
  };

  // ============================
  // RESULT & SOCIAL HINTS
  // ============================
  const [result, setResult] = useState<any>(null);

  const [recommendedTitle, setRecommendedTitle] = useState<string | null>(null);
  const [recommendedCaption, setRecommendedCaption] = useState<string | null>(null);
  const [recommendedHashtags, setRecommendedHashtags] = useState<string[]>([]);

  // ============================
  // GENERATION HANDLER
  // ============================
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      setError("");

      const payload = {
        genre,
        tone,
        storyFormat,
        videoLength,
        mode,
        mediaType,
        selectedOffer:
          offerMode === "product"
            ? {
                name: selectedProduct?.name ?? "",
                mode: "product",
                category: productCategory,
              }
            : offerMode === "recurring"
            ? {
                name: recurringPlatform,
                mode: "recurring",
                category: "saas",
              }
            : {
                name: funnelUrl,
                mode: "funnel",
              },
      };

      const res = await fetch("/api/reels/generate", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Generation failed.");
        return;
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || "Unknown generation error.");
    } finally {
      setIsGenerating(false);
    }
  };

  // ============================
  // RENDER HANDLER (VX PIPELINE)
  // ============================
const startRenderVX = async (fd: FormData) => {
  if (!result) return;

  // Append the VX core data from generation
  fd.append("script", JSON.stringify(result.script));
  fd.append("guidedText", guidedText);
  fd.append("duration", String(videoLength));
  fd.append("mediaType", mediaType);

  fd.append("beatMap", JSON.stringify(result.beatMap || []));
  fd.append("voiceTimeline", JSON.stringify(result.voiceTimeline || []));
  fd.append("exportTimeline", JSON.stringify(result.exportTimeline || []));

  // Manual uploads (if any)


  // IMAGES
imageFiles.forEach((f, i) => fd.append(`image_${i}`, f));

// VIDEOS
videoFiles.forEach((f, i) => fd.append(`video_${i}`, f));

  // Send to worker
  await fetch("/api/reels/render-vx", {
    method: "POST",
    body: fd,
  });
};

  // ============================
  // PAGE UI LAYOUT
  // ============================
  return (
    <div className="p-10 space-y-16">

      {/* ----------------------------------------------------- */}
      {/* 1. HEADER: WORLD CLASS HOOKS + SOCIAL HINTS */}
      {/* ----------------------------------------------------- */}
      <section className="text-center space-y-6">
        <h1 className="text-4xl font-bold text-emerald-300">
          Autoaffi VX — World Class Reel Engine
        </h1>
        <p className="text-gray-300">
          Powered by AI-script, pacing engine, CTA intelligence & Thumbnail V3.
        </p>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-400/20">
            <h3 className="font-semibold text-emerald-300 mb-2">WORLD-CLASS HOOKS + SEO</h3>
            <p className="text-gray-300 text-sm">
              Every reel is optimized with retention-boosted hooks, pacing markers and
              keyword-driven SEO mapping.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-blue-500/5 border border-blue-400/20">
            <h3 className="font-semibold text-blue-300 mb-2">SMART SOCIAL HINTS</h3>
            <p className="text-gray-300 text-sm">
              Autoaffi predicts titles, captions & hashtags based on reach, psychology and platform trends.
            </p>
          </div>
        </div>
      </section>


      {/* ----------------------------------------------------- */}
      {/* 2. CREATION MODE + MEDIA TYPE */}
      {/* ----------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">

        <ModeSelector mode={mode} setMode={setMode} />

       <MediaTypeSelector mediaType={mediaType} setMediaType={setMediaType} />
      </div>

      {mode === "guided" && (
  <GuidedPanel guidedText={guidedText} setGuidedText={setGuidedText} />
)}

      {/* MANUAL MODE PANEL */}
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


      {/* ----------------------------------------------------- */}
      {/* 3. STORY FORMAT + VIDEO LENGTH */}
      {/* ----------------------------------------------------- */}
      <StoryAndLengthSelector
        storyFormat={storyFormat}
        setStoryFormat={setStoryFormat}
        videoLength={videoLength}
        setVideoLength={setVideoLength}
      />


      {/* ----------------------------------------------------- */}
      {/* 4. MONETIZATION PATH (Product / Recurring / Funnel) */}
      {/* ----------------------------------------------------- */}
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
        generateAffiliateLinkForProduct={() => {}}
        affiliateLink={affiliateLink}
        missingAffiliateWarning={missingAffiliateWarning}
        recurringPlatform={recurringPlatform}
        setRecurringPlatform={setRecurringPlatform}
        recurringSubID={recurringSubID}
        setRecurringSubID={setRecurringSubID}
        recurringPlatforms={recurringPlatforms}
        generateAffiliateLinkForRecurring={() => {}}
        funnelUrl={funnelUrl}
        setFunnelUrl={setFunnelUrl}
      />


      {/* ----------------------------------------------------- */}
      {/* 5. GENERATE → SHOW TIMELINE PREVIEW */}
      {/* ----------------------------------------------------- */}
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

      {result && <TimelinePreview result={result} videoLength={videoLength} />}


      {/* ----------------------------------------------------- */}
      {/* 6. SOCIAL HINTS (RIGHT COLUMN) */}
      {/* ----------------------------------------------------- */}
      {result && (
        <SocialHintsPanel
          hashtags={result.socialHints?.hashtags || []}
          titleIdeas={result.socialHints?.titleIdeas || []}
          captionIdeas={result.socialHints?.captionIdeas || []}
          bestPostingTimes={result.socialHints?.postingTimes || []}
          recommendedTitle={recommendedTitle}
          recommendedCaption={recommendedCaption}
          recommendedHashtags={recommendedHashtags}
          setRecommendedTitle={setRecommendedTitle}
          setRecommendedCaption={setRecommendedCaption}
          setRecommendedHashtags={setRecommendedHashtags}
          thumbnailIntelligence={result.thumbnailIntelligence}
          socialHints={result.socialHints}
        />
      )}


      {/* ----------------------------------------------------- */}
      {/* 7. THUMBNAIL INTELLIGENCE (FLYTTAD UPP) */}
      {/* ----------------------------------------------------- */}
      {result && <ThumbnailIntelligencePanel result={result} />}


      {/* ----------------------------------------------------- */}
      {/* 8. AUTOAFFI VX — ULTRA HD RENDER ENGINE */}
      {/* ----------------------------------------------------- */}
      {result && (
        <RenderVX
    startRenderVX={startRenderVX}
    mode={mode}
    videoLength={videoLength}
    affiliateLink={affiliateLink}
/>
      )}

    </div>
  );
}