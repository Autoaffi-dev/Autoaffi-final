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
// HELPERS
// ============================================================================
function mapProductCategoryToSearchQuery(category: string) {
  const c = String(category || "").trim().toLowerCase();

  switch (c) {
    case "ai":
    case "ai_tools":
    case "aitools":
      return "ai tools";

    case "business":
    case "business_software":
    case "crm":
      return "business software";

    case "productivity":
      return "productivity tools";

    case "phone":
    case "phone_accessories":
    case "iphone":
      return "phone accessories";

    case "fitness":
      return "fitness";

    case "beauty":
      return "beauty";

    case "home":
    case "home_kitchen":
    case "kitchen":
      return "home kitchen";

    case "fashion":
      return "fashion";

    case "education":
      return "education";

    case "pets":
    case "pet":
      return "pets";

    case "gaming":
      return "gaming";

    case "travel":
      return "travel";

    case "crypto":
    case "finance_crypto":
      return "crypto trading tools";

    default:
      return c || "ai tools";
  }
}

function normalizeProductForReels(p: any) {
  const qualityScore =
    typeof p?.qualityScore === "number"
      ? p.qualityScore
      : typeof p?.score === "number"
      ? p.score
      : 80;

  const stars = Math.max(4, Math.min(5, Math.round(qualityScore / 20)));

  return {
    id: String(p?.id || ""),
    name: String(p?.name || p?.title || "").trim(),
    description: String(p?.description || "").trim(),
    category: String(p?.category || "").trim(),

    source: String(p?.source || p?.platform || "").trim(),
    platform: String(p?.platform || p?.source || "").trim(),
    external_id: p?.external_id ?? p?.externalId ?? null,

    imageUrl: p?.imageUrl ?? p?.image_url ?? null,

    productUrl: p?.productUrl ?? p?.product_url ?? p?.url ?? null,
    affiliate: p?.affiliate ?? p?.productUrl ?? p?.product_url ?? p?.url ?? null,

    commission:
      typeof p?.commission === "number"
        ? p.commission
        : Number.isFinite(Number(p?.commission))
        ? Number(p.commission)
        : 0,

    epc:
      typeof p?.epc === "number"
        ? p.epc
        : Number.isFinite(Number(p?.epc))
        ? Number(p.epc)
        : 0,

    stars,

    price:
      typeof p?.price === "number"
        ? p.price
        : Number.isFinite(Number(p?.price))
        ? Number(p.price)
        : null,

    currency: p?.currency ?? null,
    productKind: p?.productKind ?? "unknown",

    qualityScore: p?.qualityScore ?? null,
    relevanceScore: p?.relevanceScore ?? null,
    winnerTier: p?.winnerTier ?? null,
    geoScope: p?.geoScope ?? null,
    approved: p?.approved ?? false,
  };
}

function pickPreferredTrackingLink(data: any) {
  return (
    data?.saved?.affiliate_link ||
    data?.savedOffer?.affiliate_link ||
    data?.affiliate_link ||
    data?.builder_meta?.affiliateLink ||
    data?.builder_meta?.affiliate_link ||
    ""
  );
}

function pickPreferredSubId(data: any) {
  return (
    data?.saved?.subid ||
    data?.savedOffer?.subid ||
    data?.subid ||
    data?.builder_meta?.subid ||
    ""
  );
}

function buildDisplayAffiliateLink(params: {
  activeVaultOffer?: any | null;
  selectedSearchSavedOffer?: any | null;
}) {
  const savedId =
    params.selectedSearchSavedOffer?.id || params.activeVaultOffer?.id;
  if (!savedId) return "";
  return `/go/offer/${savedId}`;
}

function normalizeBooleanLike(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true") return true;
    if (v === "false") return false;
  }
  return fallback;
}

function detectFreedomRecurringFromText(parts: Array<unknown>) {
  const blob = parts
    .filter(Boolean)
    .map((v) => String(v))
    .join(" ")
    .toLowerCase();

  return (
    /freedom|financial freedom|passive income|digital nomad|remote work|work from anywhere|travel|lifestyle|leave your job|online business/.test(
      blob
    )
  );
}

function buildResolvedOfferMeta(params: {
  offerMode: "product" | "recurring" | "funnel";
  selectedProduct?: any | null;
  productCategory: string;
  selectedProductResolvedLink?: string;
  affiliateLink?: string | null;
  selectedProductSubId?: string;
  selectedSearchSavedOffer?: any | null;
  recurringPlatform?: string;
  recurringPlatforms?: any[];
  recurringSubID?: string;
  funnelUrl?: string;
}) {
  const {
    offerMode,
    selectedProduct,
    productCategory,
    selectedProductResolvedLink,
    affiliateLink,
    selectedProductSubId,
    selectedSearchSavedOffer,
    recurringPlatform,
    recurringPlatforms,
    recurringSubID,
    funnelUrl,
  } = params;

  if (offerMode === "product" && selectedProduct) {
    return {
      name: selectedProduct.name ?? "",
      rating: selectedProduct.stars ?? null,
      category: selectedProduct.category || productCategory,
      commissionRate:
        selectedProduct.commission != null ? `${selectedProduct.commission}%` : "",
      epc: selectedProduct.epc ?? null,
      affiliateUrl: selectedProductResolvedLink || affiliateLink || "",
      mode: "product" as const,
      source: selectedProduct.source ?? selectedProduct.platform ?? null,
      productKind: selectedProduct.productKind ?? null,
      description: selectedProduct.description ?? "",
      subId: selectedProductSubId || "",
      savedOfferId: selectedSearchSavedOffer?.id ?? null,
      sourceOfferId:
        selectedProduct.external_id ?? selectedProduct.externalId ?? "",
    };
  }

  if (offerMode === "recurring" && recurringPlatform) {
    const p = (recurringPlatforms || []).find((x: any) => x.id === recurringPlatform);
    if (p) {
      return {
        name: p.name,
        rating: 5.0,
        commissionRate:
          p.commission != null ? `${p.commission}% recurring` : "",
        affiliateUrl: affiliateLink ?? "",
        mode: "recurring" as const,
        category: "saas",
        subId: recurringSubID ?? "",
      };
    }

    return {
      name: recurringPlatform ?? "",
      rating: 5.0,
      commissionRate: "",
      affiliateUrl: affiliateLink ?? "",
      mode: "recurring" as const,
      category: "saas",
      subId: recurringSubID ?? "",
    };
  }

  if (offerMode === "funnel" && funnelUrl) {
    return {
      name: "User Funnel",
      rating: null,
      category: "funnel",
      commissionRate: "",
      affiliateUrl: funnelUrl,
      mode: "funnel" as const,
    };
  }

  return null;
}

function buildResolvedSelectedOffer(params: {
  offerMode: "product" | "recurring" | "funnel";
  selectedProduct?: any | null;
  productCategory: string;
  selectedProductResolvedLink?: string;
  affiliateLink?: string | null;
  selectedProductSubId?: string;
  selectedSearchSavedOffer?: any | null;
  recurringPlatform?: string;
  recurringPlatforms?: any[];
  recurringSubID?: string;
  funnelUrl?: string;
}) {
  const meta = buildResolvedOfferMeta(params);
  if (!meta) return null;

  return {
    name: meta.name ?? "",
    mode: meta.mode,
    commissionRate: meta.commissionRate ?? "",
    epc: meta.epc ?? null,
    category: meta.category ?? "",
    affiliateUrl: meta.affiliateUrl ?? "",
    ...(meta.source ? { source: meta.source } : {}),
    ...(meta.productKind ? { productKind: meta.productKind } : {}),
    ...(meta.description ? { description: meta.description } : {}),
    ...(meta.subId ? { subId: meta.subId } : {}),
    ...(meta.savedOfferId ? { savedOfferId: meta.savedOfferId } : {}),
    ...(meta.sourceOfferId ? { sourceOfferId: meta.sourceOfferId } : {}),
  };
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================
export default function Page() {
  const [mode, setMode] = useState<"auto" | "guided" | "manual">("auto");
  const [guidedText, setGuidedText] = useState("");

  const [mediaType, setMediaType] = useState<"mixed" | "video" | "stills">(
    "mixed"
  );

  const [videoLength, setVideoLength] = useState<number>(15);
  const [storyFormat, setStoryFormat] = useState<string>("Hook → Value → CTA");

  const [genre, setGenre] = useState("Cinematic");
  const [tone, setTone] = useState("Friendly");

  const [offerMode, setOfferMode] = useState<"product" | "recurring" | "funnel">(
    "product"
  );

  const [productCategory, setProductCategory] = useState("ai");
  const [manualProductSearch, setManualProductSearch] = useState("");
  const [currentProducts, setCurrentProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const [affiliateLink, setAffiliateLink] = useState<string | null>(null);
  const [missingAffiliateWarning, setMissingAffiliateWarning] = useState(false);

  const [recurringPlatform, setRecurringPlatform] = useState("");
  const [recurringSubID, setRecurringSubID] = useState("");
  const [recurringPlatforms, setRecurringPlatforms] = useState<any[]>([]);

  const [funnelUrl, setFunnelUrl] = useState("");
  const [offerMeta, setOfferMeta] = useState<any | null>(null);

  const [selectedProductResolvedLink, setSelectedProductResolvedLink] =
    useState<string>("");
  const [selectedProductSubId, setSelectedProductSubId] = useState<string>("");
  const [savingSelectedProduct, setSavingSelectedProduct] = useState(false);
  const [selectedSearchSavedOffer, setSelectedSearchSavedOffer] =
    useState<any | null>(null);
  const [lastSyncedProductKey, setLastSyncedProductKey] = useState("");

  const resolvedOfferMeta = React.useMemo(
    () =>
      buildResolvedOfferMeta({
        offerMode,
        selectedProduct,
        productCategory,
        selectedProductResolvedLink,
        affiliateLink,
        selectedProductSubId,
        selectedSearchSavedOffer,
        recurringPlatform,
        recurringPlatforms,
        recurringSubID,
        funnelUrl,
      }),
    [
      offerMode,
      selectedProduct,
      productCategory,
      selectedProductResolvedLink,
      affiliateLink,
      selectedProductSubId,
      selectedSearchSavedOffer,
      recurringPlatform,
      recurringPlatforms,
      recurringSubID,
      funnelUrl,
    ]
  );

  const resolvedSelectedOffer = React.useMemo(
    () =>
      buildResolvedSelectedOffer({
        offerMode,
        selectedProduct,
        productCategory,
        selectedProductResolvedLink,
        affiliateLink,
        selectedProductSubId,
        selectedSearchSavedOffer,
        recurringPlatform,
        recurringPlatforms,
        recurringSubID,
        funnelUrl,
      }),
    [
      offerMode,
      selectedProduct,
      productCategory,
      selectedProductResolvedLink,
      affiliateLink,
      selectedProductSubId,
      selectedSearchSavedOffer,
      recurringPlatform,
      recurringPlatforms,
      recurringSubID,
      funnelUrl,
    ]
  );

  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  const buildProductQuery = React.useCallback(() => {
    const manual = manualProductSearch.trim();
    if (manual.length > 0) return manual;
    return mapProductCategoryToSearchQuery(productCategory);
  }, [manualProductSearch, productCategory]);

  const resetSelectedProductTracking = React.useCallback(() => {
    setSelectedProduct(null);
    setSelectedProductResolvedLink("");
    setSelectedProductSubId("");
    setSelectedSearchSavedOffer(null);
    setLastSyncedProductKey("");
    setAffiliateLink(null);
    setMissingAffiliateWarning(false);
  }, []);

  const handleProductCategoryChange = React.useCallback(
    (nextCategory: string) => {
      setProductCategory(nextCategory);
      setManualProductSearch("");
      setCurrentProducts([]);
      resetSelectedProductTracking();
    },
    [resetSelectedProductTracking]
  );

  const handleManualProductSearchChange = React.useCallback(
    (nextSearch: string) => {
      setManualProductSearch(nextSearch);
      setCurrentProducts([]);
      resetSelectedProductTracking();
    },
    [resetSelectedProductTracking]
  );

  const syncSelectedProductForReels = React.useCallback(
    async (product: any) => {
      if (!product?.id) return;

      const syncKey = `${product.id}::${product.source ?? ""}::${
        product.external_id ?? product.externalId ?? ""
      }`;

      if (lastSyncedProductKey === syncKey && selectedProductResolvedLink) {
        return;
      }

      try {
        setSavingSelectedProduct(true);

        const res = await fetch("/api/offers/select", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            item: {
              id: product.id ?? undefined,
              source: product.source ?? product.platform ?? "",
              external_id: product.external_id ?? product.externalId ?? "",
              title: product.name ?? product.title ?? "",
              description: product.description ?? "",
              category: product.category ?? "",
              niche: product.niche ?? null,
              merchant_name: product.merchantName ?? product.merchant ?? null,
              merchant_id: product.merchantId ?? product.merchant_id ?? null,
              image_url: product.imageUrl ?? product.image_url ?? null,
              url: product.url ?? product.productUrl ?? product.product_url ?? null,
              product_url:
                product.productUrl ?? product.product_url ?? product.url ?? null,
              landing_url: product.landingUrl ?? product.landing_url ?? null,
              price: product.price ?? null,
              currency: product.currency ?? null,
              commission: product.commissionRate ?? product.commission ?? null,
              epc: product.epc ?? null,
              geo_scope: product.geoScope ?? product.geo_scope ?? null,
              canonical_url: product.canonicalUrl ?? product.canonical_url ?? null,
              canonical_hash:
                product.canonicalHash ?? product.canonical_hash ?? null,
            },
            from: "reels",
            query: buildProductQuery().trim(),
          }),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(data?.error || "Failed to sync selected product");
        }

        const preferredLink = pickPreferredTrackingLink(data);
        const preferredSubId = pickPreferredSubId(data);
        const savedOffer = data?.saved || data?.savedOffer || null;
        const displayLink = buildDisplayAffiliateLink({
          selectedSearchSavedOffer: savedOffer,
        });

        setSelectedSearchSavedOffer(savedOffer);
        setSelectedProductResolvedLink(displayLink || "");
        setSelectedProductSubId(preferredSubId || "");
        setLastSyncedProductKey(syncKey);

        if (displayLink) {
          setAffiliateLink(displayLink);
          setMissingAffiliateWarning(false);
        } else {
          setAffiliateLink(null);
          setMissingAffiliateWarning(true);
        }

        console.log("[REELS] synced product tracking", {
          productId: product.id,
          affiliate_link: preferredLink,
          display_link: displayLink,
          subid: preferredSubId,
          savedOffer,
        });
      } catch (error) {
        console.error("[REELS] syncSelectedProductForReels error:", error);
        setSelectedProductResolvedLink("");
        setSelectedProductSubId("");
        setAffiliateLink(null);
        setMissingAffiliateWarning(true);
      } finally {
        setSavingSelectedProduct(false);
      }
    },
    [buildProductQuery, lastSyncedProductKey, selectedProductResolvedLink]
  );

  React.useEffect(() => {
    let isMounted = true;

    const loadProducts = async () => {
      if (offerMode !== "product") return;

      const q = buildProductQuery().trim();
      if (!q) {
        if (!isMounted) return;
        setCurrentProducts([]);
        setSelectedProduct(null);
        setSelectedProductResolvedLink("");
        setSelectedProductSubId("");
        setAffiliateLink(null);
        return;
      }

      try {
        setIsLoadingProducts(true);

        const params = new URLSearchParams({
          q,
          limit: "12",
        });

        const res = await fetch(`/api/products/search?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          console.error("[REELS] /api/products/search failed", res.status, data);
          if (!isMounted) return;
          setCurrentProducts([]);
          return;
        }

        const results = Array.isArray(data?.results) ? data.results : [];

        const normalizedResults = results
          .map(normalizeProductForReels)
          .filter((p: any) => p.id && p.name);

        if (!isMounted) return;

        setCurrentProducts(normalizedResults);

        setSelectedProduct((prev: any) => {
          if (!prev) return normalizedResults[0] ?? null;

          const stillExists = normalizedResults.find((p: any) => p.id === prev.id);

          return stillExists ?? normalizedResults[0] ?? null;
        });
      } catch (err) {
        console.error("[REELS] loadProducts crash", err);
        if (!isMounted) return;
        setCurrentProducts([]);
      } finally {
        if (isMounted) {
          setIsLoadingProducts(false);
        }
      }
    };

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, [offerMode, buildProductQuery]);

  React.useEffect(() => {
    if (offerMode !== "product") return;
    if (!selectedProduct) return;

    syncSelectedProductForReels(selectedProduct);
  }, [offerMode, selectedProduct, syncSelectedProductForReels]);

  const generateAffiliateLinkForProduct = React.useCallback(
    async (productId: string) => {
      const product = currentProducts.find((p: any) => p.id === productId);

      if (!product) {
        setSelectedProduct(null);
        setSelectedProductResolvedLink("");
        setSelectedProductSubId("");
        setAffiliateLink(null);
        setMissingAffiliateWarning(true);
        return;
      }

      setSelectedProduct(product);
      await syncSelectedProductForReels(product);
    },
    [currentProducts, syncSelectedProductForReels]
  );

  const handleSelectRecurringPlatform = React.useCallback(
    (platformId: string) => {
      setRecurringPlatform(platformId);

      const platform = recurringPlatforms.find((p: any) => p.id === platformId);
      if (!platform) return;

      if (platform.subId) {
        setRecurringSubID(platform.subId);
      } else {
        setRecurringSubID("");
      }

      if (platform.affiliateUrl) {
        setAffiliateLink(platform.affiliateUrl);
        setMissingAffiliateWarning(false);
      } else {
        setAffiliateLink(null);
        setMissingAffiliateWarning(true);
      }
    },
    [recurringPlatforms]
  );

  React.useEffect(() => {
    setOfferMeta(resolvedOfferMeta);
  }, [resolvedOfferMeta]);

  React.useEffect(() => {
    let isMounted = true;

    const loadRecurringPlatforms = async () => {
      try {
        const res = await fetch("/api/recurring/platforms", {
          method: "GET",
        });

        if (!res.ok) {
          console.error("[REELS] /api/recurring/platforms failed", res.status);
          return;
        }

        const data = await res.json();
        const rawMap = data?.platforms ?? {};

        const all = Object.values(rawMap) as Array<{
          key: string;
          active: boolean;
          tracking_code: string | null;
          promo_link: string | null;
          updated_at?: string | null;
        }>;

        const mapped = all
          .filter((p) => p.key === "autoaffi" || p.active === true)
          .map((p) => ({
            id: p.key,
            name:
              p.key === "autoaffi"
                ? "Autoaffi Recurring"
                : p.key === "systeme"
                ? "Systeme.io"
                : p.key === "clickfunnels"
                ? "ClickFunnels"
                : p.key === "tubemagic"
                ? "TubeMagic"
                : p.key === "syllaby"
                ? "Syllaby"
                : p.key === "submagic"
                ? "Submagic"
                : p.key === "simplified"
                ? "Simplified"
                : p.key === "fliki"
                ? "Fliki"
                : p.key === "dfirst"
                ? "DFIRST"
                : p.key === "minea"
                ? "Minea"
                : p.key === "justcall"
                ? "JustCall"
                : p.key === "heygen"
                ? "HeyGen"
                : p.key.charAt(0).toUpperCase() + p.key.slice(1),
            commission:
              p.key === "autoaffi"
                ? 50
                : p.key === "systeme"
                ? 40
                : p.key === "clickfunnels"
                ? 30
                : 30,
            highlight:
              p.key === "autoaffi" ||
              p.key === "systeme" ||
              p.key === "clickfunnels",
            note:
              p.key === "autoaffi"
                ? "Autoaffi core recurring program."
                : "Activated in your Recurring card.",
            subId: p.tracking_code,
            affiliateUrl: p.promo_link,
          }));

        if (!isMounted) return;

        setRecurringPlatforms(mapped);
      } catch (err) {
        console.error("[REELS] loadRecurringPlatforms crash", err);
      }
    };

    loadRecurringPlatforms();

    return () => {
      isMounted = false;
    };
  }, []);

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [letAutoPickImages, setLetAutoPickImages] = useState(false);

  const [result, setResult] = useState<any>(null);

  const [recommendedTitle, setRecommendedTitle] = useState<string | null>(null);
  const [recommendedCaption, setRecommendedCaption] = useState<string | null>(
    null
  );
  const [recommendedHashtags, setRecommendedHashtags] = useState<string[]>([]);

  const [recommendedCTA, setRecommendedCTA] = useState<string | null>(null);
  const [ctaIdeas, setCtaIdeas] = useState<string[]>([]);

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

  const finalAffiliateLink =
    offerMode === "product"
      ? selectedProductResolvedLink || ""
      : offerMode === "recurring"
      ? affiliateLink || ""
      : funnelUrl || "";

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

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      setError("");

      if (offerMode === "product") {
        if (isLoadingProducts) {
          setError("Autoaffi is still loading products.");
          setIsGenerating(false);
          return;
        }

        if (!selectedProduct) {
          setError("Please select a product before generating.");
          setIsGenerating(false);
          return;
        }

        if (savingSelectedProduct) {
          setError("Autoaffi is still syncing your selected product.");
          setIsGenerating(false);
          return;
        }
      }

      await sleep(2000);

      const selectedOffer = resolvedSelectedOffer;
      const nextOfferMeta = resolvedOfferMeta ?? selectedOffer;

      if (!selectedOffer || !nextOfferMeta) {
        setError("Please complete your offer setup before generating.");
        setIsGenerating(false);
        return;
      }

      const payload = {
        mode,
        mediaType,
        guidedText,
        storyFormat,
        videoLength,
        genre,
        tone,
        selectedOffer,
        offerMeta: nextOfferMeta,
        generationId: `${Date.now()}_${Math.random()
          .toString(16)
          .slice(2)}`,
        manualMediaHints: {
          mode,
          imageCount: imageFiles.length,
          videoCount: videoFiles.length,
          letAutoPickImages,
          musicMode,
          musicStyle,
        },
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
        storyboard: data.storyboard || [],
        scenes: data.scenes || data.exportTimeline?.scenes || [],
        beatMap: data.beatMap || [],
        voiceTimeline: data.voiceTimeline || [],
        exportTimeline:
          data.exportTimeline || {
            totalDuration: videoLength,
            scenes: [],
          },
        subtitles: data.subtitles || [],
        pacing: data.pacing || data.aiBreakdown?.pacing || [],
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
        mediaFiles: data.mediaFiles || [],
        offerMeta: data.offerMeta || nextOfferMeta || selectedOffer,
        ctaIntelligence: data.ctaIntelligence || null,
        hookIntelligence: data.hookIntelligence || null,
        musicPlan: data.musicPlan || null,
        storyText: data.storyText || "",
        musicUrl: data.musicUrl || null,
        audioUrl: data.audioUrl || null,
        backgroundMusicUrl: data.backgroundMusicUrl || data.background_music_url || null,
        uploadedMusic: data.uploadedMusic || [],
        uploadedMusicUrl: data.uploadedMusicUrl || data.uploaded_music_url || null,
        uploaded_music_url: data.uploaded_music_url || data.uploadedMusicUrl || null,
        stockMusic: data.stockMusic || [],
        musicResults: data.musicResults || [],
        audioResults: data.audioResults || [],
        musicFiles: data.musicFiles || [],
        musicCandidates: data.musicCandidates || data.allMusicCandidates || [],
        musicTracks: data.musicTracks || data.allMusicCandidates || [],
        backgroundMusic: data.backgroundMusic || data.allMusicCandidates || [],
        allMusicCandidates: data.allMusicCandidates || [],
        freedomRecurring:
          typeof data.freedomRecurring === "boolean"
            ? data.freedomRecurring
            : false,
        renderHints: data.renderHints || null,
        manualMediaHints:
          data.manualMediaHints || {
            mode,
            imageCount: imageFiles.length,
            videoCount: videoFiles.length,
            letAutoPickImages,
            musicMode,
            musicStyle,
          },
      });

      const apiCtasRaw = data?.socialHints?.ctaIdeas as string[] | undefined;
      let nextCtas: string[] = [];

      if (Array.isArray(apiCtasRaw)) {
        nextCtas = apiCtasRaw.filter(Boolean).slice(0, 3);
      }

      if (nextCtas.length === 0) {
        const defaults = [
          "Tap the link to unlock it now ✅",
          "Start today — your future self will thank you ✅",
          "Want results fast? Click and try it now ✅",
          "Ready to see it in action? Click now ✅",
          "Claim your spot before it’s gone ⏳",
        ];

        const seed = Date.now();
        nextCtas = defaults
          .map((txt, idx) => [txt, (seed + idx * 9973) % 100000] as const)
          .sort((a, b) => a[1] - b[1])
          .map(([txt]) => txt)
          .slice(0, 3);
      }

      setCtaIdeas(nextCtas);
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

  const startRenderVX = async (fd: FormData) => {
    if (!result) {
      return {
        ok: false,
        videoUrl: null,
        error: "No generated reel found. Please click Generate first.",
      };
    }

    if (offerMode === "product") {
      if (isLoadingProducts) {
        return {
          ok: false,
          videoUrl: null,
          error: "Autoaffi is still loading products.",
        };
      }

      if (!selectedProduct) {
        return {
          ok: false,
          videoUrl: null,
          error: "Please select a product before rendering.",
        };
      }

      if (savingSelectedProduct) {
        return {
          ok: false,
          videoUrl: null,
          error: "Autoaffi is still syncing your selected product.",
        };
      }
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
      const targetDuration =
        result.exportTimeline?.totalDuration ?? videoLength ?? 15;

      const safeDuration = Math.min(25, Math.max(15, targetDuration));

      const fdRealismRaw = fd.get("realism");
      const fdVoiceStyleRaw = fd.get("voiceStyle");
      const fdMusicModeRaw = fd.get("musicMode");
      const fdTransitionsRaw = fd.get("musicTransitions");
      const fdImpactsRaw = fd.get("musicImpacts");
      const fdAmbienceRaw = fd.get("musicAmbience");

      const resolvedRealism = Number(fdRealismRaw ?? realism ?? 50);
      const resolvedVoiceStyle = String(fdVoiceStyleRaw ?? voiceStyle ?? "default");
      const resolvedMusicMode = String(fdMusicModeRaw ?? musicMode ?? "auto");

      const resolvedTransitions = normalizeBooleanLike(
        fdTransitionsRaw ?? soundTransitions,
        true
      );
      const resolvedImpacts = normalizeBooleanLike(
        fdImpactsRaw ?? soundImpacts,
        true
      );
      const resolvedAmbience = normalizeBooleanLike(
        fdAmbienceRaw ?? soundAmbience,
        true
      );

      const renderOfferMeta =
        result?.offerMeta || resolvedOfferMeta || resolvedSelectedOffer;

      if (!renderOfferMeta) {
        clearInterval(interval);
        setRenderProgress(0);
        setRenderMessage("✗ Missing offer data");
        setIsRendering(false);

        return {
          ok: false,
          videoUrl: null,
          error: "Missing offer data for render",
        };
      }

      const fallbackFreedomRecurring =
        renderOfferMeta?.mode === "recurring" &&
        detectFreedomRecurringFromText([
          genre,
          tone,
          storyFormat,
          guidedText,
          renderOfferMeta?.name,
          renderOfferMeta?.category,
          Array.isArray(result?.script) ? result.script.join("\n") : result?.script,
          result?.storyText,
        ]);

      const resolvedFreedomRecurring =
        typeof result?.freedomRecurring === "boolean"
          ? result.freedomRecurring
          : typeof result?.renderHints?.freedomRecurring === "boolean"
          ? result.renderHints.freedomRecurring
          : fallbackFreedomRecurring;

      const resolvedMusicFiles =
        result?.musicFiles ??
        result?.allMusicCandidates ??
        result?.musicResults ??
        result?.stockMusic ??
        [];

      const resolvedMusicResults =
        result?.musicResults ??
        result?.allMusicCandidates ??
        result?.stockMusic ??
        [];

      const resolvedMusicCandidates =
        result?.musicCandidates ??
        result?.allMusicCandidates ??
        result?.musicResults ??
        result?.stockMusic ??
        [];

      const resolvedMusicTracks =
        result?.musicTracks ??
        result?.allMusicCandidates ??
        result?.musicResults ??
        result?.stockMusic ??
        [];

      const resolvedBackgroundMusic =
        result?.backgroundMusic ??
        result?.allMusicCandidates ??
        result?.musicResults ??
        result?.stockMusic ??
        [];

      const resolvedBackgroundMusicUrl =
        result?.backgroundMusicUrl ??
        result?.background_music_url ??
        result?.musicUrl ??
        null;

      const renderPayload = {
        genre,
        mediaType,

        realism: Number.isFinite(resolvedRealism) ? resolvedRealism : 50,
        voiceStyle: resolvedVoiceStyle,
        musicMode: resolvedMusicMode,
        musicTransitions: resolvedTransitions,
        musicImpacts: resolvedImpacts,
        musicAmbience: resolvedAmbience,

        script: Array.isArray(result.script)
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

        mediaFiles: result.mediaFiles ?? [],

        selectedOffer: renderOfferMeta,
        offerMeta: renderOfferMeta,
        freedomRecurring: resolvedFreedomRecurring,

        storyText:
          result?.storyText ||
          [
            genre,
            tone,
            storyFormat,
            guidedText,
            Array.isArray(result.script)
              ? result.script.join("\n")
              : result.script ?? "",
            renderOfferMeta?.name ?? "",
            renderOfferMeta?.category ?? "",
          ]
            .filter(Boolean)
            .join("\n"),

        musicUrl: result?.musicUrl ?? null,
        music_url: result?.musicUrl ?? null,

        audioUrl: result?.audioUrl ?? null,
        audio_url: result?.audioUrl ?? null,

        backgroundMusicUrl: resolvedBackgroundMusicUrl,
        background_music_url: resolvedBackgroundMusicUrl,

        uploadedMusic: result?.uploadedMusic ?? [],
        uploadedMusicUrl: result?.uploadedMusicUrl ?? null,
        uploaded_music_url: result?.uploaded_music_url ?? null,

        stockMusic: result?.stockMusic ?? [],
        musicResults: resolvedMusicResults,
        audioResults: result?.audioResults ?? [],
        musicFiles: resolvedMusicFiles,
        musicCandidates: resolvedMusicCandidates,
        musicTracks: resolvedMusicTracks,
        backgroundMusic: resolvedBackgroundMusic,
        allMusicCandidates: result?.allMusicCandidates ?? [],

        manualMediaHints: result?.manualMediaHints || {
          mode,
          imageCount: imageFiles.length,
          videoCount: videoFiles.length,
          letAutoPickImages,
          musicMode,
          musicStyle,
        },

        renderHints: {
          ...(result?.renderHints ?? {}),
          offerMode: renderOfferMeta?.mode ?? offerMode,
          offerName: renderOfferMeta?.name ?? "",
          offerCategory: renderOfferMeta?.category ?? "",
          freedomRecurring: resolvedFreedomRecurring,
          maxSegments:
            result?.exportTimeline?.scenes?.length ||
            result?.scenes?.length ||
            (offerMode === "recurring" ? 6 : 5),

          musicUrl: result?.musicUrl ?? null,
          backgroundMusicUrl: resolvedBackgroundMusicUrl,
          musicFiles: resolvedMusicFiles,
          musicResults: resolvedMusicResults,
        },
      };

      const res = await fetch("/api/reels/render-vx", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(renderPayload),
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

      setRenderedVideo(videoUrl);
      setRenderProgress(100);
      setRenderMessage("✅ Render finished!");
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

  return (
    <div className="p-10 space-y-16">
      <section className="text-center space-y-6">
        <h1 className="text-4xl font-bold text-emerald-300">
          Autoaffi VX — World Class Reel Engine
        </h1>
        <p className="text-gray-300">
          Powered by AI-script, pacing engine, CTA intelligence & Thumbnail V3.
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
              Autoaffi predicts titles, captions, CTA & hashtags using platform
              psychology.
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <ModeSelector mode={mode} setMode={setMode} />
        <MediaTypeSelector mediaType={mediaType} setMediaType={setMediaType} />
      </div>

      {mode === "guided" && (
        <GuidedPanel guidedText={guidedText} setGuidedText={setGuidedText} />
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

      <StoryAndLengthSelector
        storyFormat={storyFormat}
        setStoryFormat={setStoryFormat}
        videoLength={videoLength}
        setVideoLength={setVideoLength}
      />

      <OfferTypeSelector offerMode={offerMode} setOfferMode={setOfferMode} />

      <OfferPanels
        offerMode={offerMode}
        setOfferMode={setOfferMode}
        productCategory={productCategory}
        setProductCategory={handleProductCategoryChange}
        manualProductSearch={manualProductSearch}
        setManualProductSearch={handleManualProductSearchChange}
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
        generateAffiliateLinkForRecurring={handleSelectRecurringPlatform}
        funnelUrl={funnelUrl}
        setFunnelUrl={setFunnelUrl}
      />

      {offerMode === "product" && savingSelectedProduct && (
        <div className="text-sm text-emerald-300">
          Syncing verified Autoaffi tracking...
        </div>
      )}

      {offerMode === "product" &&
        selectedProductResolvedLink &&
        !savingSelectedProduct && (
          <div className="text-sm text-emerald-300">
            Verified Autoaffi tracking active.
          </div>
        )}

      {offerMeta && (
        <OfferMetaPanel
          offerMeta={offerMeta}
          onCopyLink={() =>
            navigator.clipboard.writeText(offerMeta.affiliateUrl || "")
          }
        />
      )}

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

      {result &&
        (Array.isArray(result.scenes) || Array.isArray(result.pacing)) && (
          <TimelinePreview result={result} videoLength={videoLength} />
        )}

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

      {result && <ThumbnailIntelligencePanel result={result} />}

      {result && (
        <AdvancedAIBreakdown
          breakdown={{
            ...(result.aiBreakdown || {}),
            hooks: result.aiBreakdown?.hooks || [],
            pacing: result.aiBreakdown?.pacing || result?.pacing || [],
            cta: result.aiBreakdown?.cta || recommendedCTA || "",
            emotionalDrivers: result.aiBreakdown?.emotionalDrivers || [],
            recommendations: result.aiBreakdown?.recommendations || [],
            heatValues: result.aiBreakdown?.heatValues || [],
          }}
        />
      )}

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
                ✅ Render finished! Your video is ready.
              </p>

              <button
                onClick={downloadRenderedVideo}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
              >
                ⬇️ Download MP4
              </button>
            </div>
          )}

          {offerMode === "product" && selectedProductResolvedLink && (
            <div className="p-6 rounded-xl bg-emerald-900/20 border border-emerald-500/30">
              <h3 className="text-emerald-300 font-semibold mb-2">
                Autoaffi Tracking Enabled
              </h3>
              <p className="text-gray-200 text-sm break-all">
                {selectedProductResolvedLink}
              </p>
            </div>
          )}

          {offerMode === "recurring" && affiliateLink && (
            <div className="p-6 rounded-xl bg-emerald-900/20 border border-emerald-500/30">
              <h3 className="text-emerald-300 font-semibold mb-2">
                Recurring Tracking Enabled
              </h3>
              <p className="text-gray-200 text-sm break-all">{affiliateLink}</p>
            </div>
          )}

          {offerMode === "funnel" && funnelUrl && (
            <div className="p-6 rounded-xl bg-emerald-900/20 border border-emerald-500/30">
              <h3 className="text-emerald-300 font-semibold mb-2">
                Funnel Tracking Enabled
              </h3>
              <p className="text-gray-200 text-sm break-all">{funnelUrl}</p>
            </div>
          )}

          <RenderVX
            startRenderVX={startRenderVX}
            mode={mode}
            videoLength={videoLength}
            affiliateLink={finalAffiliateLink}
          />
        </div>
      )}
    </div>
  );
}
