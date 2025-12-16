"use client";

import {
  useMemo,
  useState,
  useEffect,
  type ChangeEvent,
} from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { MegaEngine1 } from "@/lib/engines/mega-engine-1";
import { runExactFixEngine } from "@/components/content-optimizer/ExactFixEngine";
import SEOEngine from "@/components/content-optimizer/SEOEngine";



type Mode = "content_only" | "content_and_offer" | "offer_only";
type InputStyle = "manual" | "scan_link";
type PlatformKey = "tiktok" | "instagram" | "facebook" | "youtube";

type ProductResult = {
  id: string;
  name: string;
  epc: number;
  category: string;
  platform: string;
  productUrl: string;
};

// Recurring row from user_recurring_platforms
type RecurringPlatformRow = {
  id: string;
  user_id: string;
  platform: string;
  autoaffi_user_code: string | null;
  created_at: string;
};

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

  const supabase = useMemo(
    () =>
      createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    }
    loadUser();
  }, [supabase]);

  // -----------------------------
  // AFFILIATE IDS (Mega Engine 1)
  // -----------------------------
  const [affiliateIds, setAffiliateIds] = useState<any>(null);

  const hasAffiliateIds = useMemo(() => {
    if (!affiliateIds) return false;
    return (
      affiliateIds.digistoreId ||
      affiliateIds.myleadId ||
      affiliateIds.cpaleadId ||
      affiliateIds.amazonTag ||
      affiliateIds.impactId
    );
  }, [affiliateIds]);

  useEffect(() => {
    if (!user?.id) return;

    async function loadAffiliateIds() {
      const ids = await MegaEngine1.getAffiliateIdsForUser(user.id);
      setAffiliateIds(ids);
    }

    loadAffiliateIds();
  }, [user]);

  // -----------------------------
  // RECURRING STACK (for hooks)
  // -----------------------------
  const [activeRecurring, setActiveRecurring] = useState<
    RecurringPlatformRow[]
  >([]);
  const [loadingRecurring, setLoadingRecurring] = useState(false);
  const [selectedRecurringId, setSelectedRecurringId] = useState<string | null>(
    null
  );

  // -----------------------------
// FUNNELS (AUTO SOURCE FROM USER DASHBOARD)
// -----------------------------
type FunnelRow = {
  id: string;
  user_id: string;
  name: string;
  funnel_url: string;
  created_at: string;
};

const [userFunnels, setUserFunnels] = useState<FunnelRow[]>([]);
const [selectedFunnelId, setSelectedFunnelId] = useState<string | null>(null);

const hasFunnels = useMemo(() => {
  return Array.isArray(userFunnels) && userFunnels.length > 0;
}, [userFunnels]);

useEffect(() => {
  if (!user?.id) return;

  async function loadFunnels() {
    const { data, error } = await supabase
      .from("user_funnels")
      .select("*")
      .eq("user_id", user.id);

    if (!error && data) {
      setUserFunnels(data as FunnelRow[]);

      // Auto-select first funnel if none selected
      if (!selectedFunnelId && data.length > 0) {
        setSelectedFunnelId(data[0].id);
      }
    }
  }

  loadFunnels();
}, [user, supabase, selectedFunnelId]);

  useEffect(() => {
    if (!user?.id) return;

    async function loadRecurringPlatforms() {
      setLoadingRecurring(true);
      const { data, error } = await supabase
        .from("user_recurring_platforms")
        .select("*")
        .eq("user_id", user.id);

      if (!error && data) {
        setActiveRecurring(data as RecurringPlatformRow[]);
        // Auto-select first platform as default if nothing chosen
        if (!selectedRecurringId && data.length > 0) {
          setSelectedRecurringId(data[0].id);
        }
      }
      setLoadingRecurring(false);
    }

    loadRecurringPlatforms();
  }, [user, supabase, selectedRecurringId]);

  const hasRecurringStack =
    Array.isArray(activeRecurring) && activeRecurring.length > 0;

  const selectedRecurringPlatform = useMemo(() => {
    if (!selectedRecurringId) return null;
    return activeRecurring.find((r) => r.id === selectedRecurringId) || null;
  }, [activeRecurring, selectedRecurringId]);

  // -----------------------------
  // FUNNEL MODE (v1 – manual link)
  // -----------------------------
  const [useFunnelMode, setUseFunnelMode] = useState(false);
  const [funnelLink, setFunnelLink] = useState("");

  const hasFunnel = useMemo(() => {
    return useFunnelMode && funnelLink.trim().length > 0;
  }, [useFunnelMode, funnelLink]);

  // -----------------------------
  // PRODUCT DISCOVERY RESULTS
  // -----------------------------
  const [productResults, setProductResults] = useState<ProductResult[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null
  );

  const [keywords, setKeywords] = useState("");
  const [offerIdea, setOfferIdea] = useState("");
  const [manualLink, setManualLink] = useState("");

  async function loadProductsForOffer() {
    if (!offerIdea || !affiliateIds) {
      setProductResults([]);
      setSelectedProductId(null);
      return;
    }

    setLoadingProducts(true);

    try {
      const res = await fetch(
        "/api/products/search?q=" + encodeURIComponent(offerIdea)
      );
      const data = await res.json();
      const results = (data.results || []) as ProductResult[];
      setProductResults(results);
      if (results.length > 0 && !selectedProductId) {
        setSelectedProductId(results[0].id);
      }
    } catch (err) {
      console.error("Product search error:", err);
      setProductResults([]);
      setSelectedProductId(null);
    }

    setLoadingProducts(false);
  }

  useEffect(() => {
    // Autoload products whenever offerIdea + affiliate IDs exist
    loadProductsForOffer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerIdea, affiliateIds]);

  const hasProducts = productResults.length > 0;

  const selectedProduct = useMemo(() => {
    if (!selectedProductId) return null;
    return productResults.find((p) => p.id === selectedProductId) || null;
  }, [productResults, selectedProductId]);

  // -----------------------------
  // CORE CONTENT STATE
  // -----------------------------
  const [selectedHookIndex, setSelectedHookIndex] = useState<number>(0);
  const [customHook, setCustomHook] = useState("");
  const [caption, setCaption] = useState("");
  const [body, setBody] = useState("");
  const [selectedCTA, setSelectedCTA] = useState<string | null>(null);

  const [hasGenerated, setHasGenerated] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string>("");

  // -----------------------------
// GENERATE BUTTON LOCK STATE
// -----------------------------
const [isGenerating, setIsGenerating] = useState(false);

// -----------------------------
// EXACT FIX ENGINE STATE
// -----------------------------
const [exactFixResult, setExactFixResult] = useState<any>(null);
const [exactFixStatus, setExactFixStatus] =
  useState<"idle" | "running" | "ready" | "error">("idle");

  // -----------------------------
// SEO ENGINE STATE
// -----------------------------
const [seoResult, setSeoResult] = useState<any | null>(null);
const [isSEOLoading, setIsSEOLoading] = useState(false);
const [seoError, setSeoError] = useState<string | null>(null);

  // IMAGE STATE
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string>("");

  // AI IMAGE PROMPT STATE (for external ChatGPT / DALL·E / Midjourney)
  const [aiImagePrompt, setAiImagePrompt] = useState<string>("");
  const [aiPromptHistory, setAiPromptHistory] = useState<string[]>([]);

  const baseTopic = useMemo(() => {
    if (offerIdea.trim()) return offerIdea.trim();
    if (keywords.trim()) return keywords.trim();
    return "your niche";
  }, [offerIdea, keywords]);

  // -----------------------------
  // SMART HOOK ENGINE
  // -----------------------------
  const hookOptions = useMemo(() => {
    const topic = baseTopic || "this offer";
    const linkHint = manualLink ? " (link in bio)" : "";

    const recurringLabel = selectedRecurringPlatform
      ? selectedRecurringPlatform.platform
      : "your recurring offer";

    const funnelLabel = hasFunnel ? "your funnel" : "your offer";

    const productName = selectedProduct?.name || "this offer";

    // 1. Base hooks
    const base = [
      `No one is talking about ${topic} like this${linkHint}…`,
      `If I had to start from 0 with ${topic}, I’d do THIS first.`,
      `You’re sleeping on ${topic} – here’s why that’s costing you.`,
      `I tested ${topic} for 30 days – here’s what actually worked.`,
      `Stop scrolling if you want ${topic} to pay your bills.`,
      `Most people fail with ${topic} because they ignore THIS.`,
    ];

    // Funnel hooks
    const funnelHooks = hasFunnel
      ? [
          `Your funnel is not broken — your offer is. Fix this first.`,
          `Want a funnel that doesn’t leak? Start with ONE strong offer.`,
          `The fastest way to fix a dead funnel is to replace the backend offer.`,
          `I plugged ${topic} into ${funnelLabel} and watched the numbers change.`,
        ]
      : [];

    // Recurring hooks
    const recurringHooks = hasRecurringStack
      ? [
          `If I had to start over, I'd ONLY promote recurring offers like ${recurringLabel}.`,
          `Do this once → get paid every month. The recurring method.`,
          `Stop promoting one-time payouts — recurring is where freedom is built.`,
          `Want stable income? Stack 3 recurring offers around ${topic}.`,
        ]
      : [];

    // Product discovery hooks
    const productHooks = hasProducts
      ? [
          `I tested dozens of offers — THIS (${productName}) paid the highest.`,
          `If you're in the ${topic} niche, promote this ONE offer.`,
          `${productName} is going viral — here’s how to ride the wave.`,
          `If you're doing ${topic}, skip the rest — use this offer instead.`,
        ]
      : [];

    // Hybrid (funnels + recurring)
    const hybrid =
      hasFunnel && hasRecurringStack
        ? [
            `The machine: funnel + recurring + one killer offer.`,
            `Stop trading time for views — build a funnel that feeds recurring income.`,
            `Most funnels die because they promote weak offers — recurring fixes that.`,
          ]
        : [];

    return [
      ...base,
      ...funnelHooks,
      ...recurringHooks,
      ...productHooks,
      ...hybrid,
    ];
  }, [
    baseTopic,
    manualLink,
    hasFunnel,
    hasRecurringStack,
    hasProducts,
    selectedProduct,
    selectedRecurringPlatform,
  ]);

  // -----------------------------
  // SMART CTA ENGINE (Rule-based)
  // -----------------------------
  const recommendedCTA = useMemo(() => {
    // Funnel + Recurring
    if (hasFunnel && hasRecurringStack) {
      const options = [
        "Unlock my free training — the funnel does the heavy lifting",
        "Start the 3-step system: funnel + recurring = freedom",
        "Tap the link and begin the funnel — it runs 24/7",
      ];
      return options[Math.floor(Math.random() * options.length)];
    }

    // Funnel only
    if (hasFunnel) {
      const options = [
        "Enter my funnel — takes 30 seconds",
        "Want the blueprint? Tap my funnel link",
        "Unlock the first step — free training inside",
      ];
      return options[Math.floor(Math.random() * options.length)];
    }

    // Recurring only
    if (hasRecurringStack) {
      const recurringLabel =
        selectedRecurringPlatform?.platform || "your recurring stack";
      const options = [
        `Do this once → earn monthly with ${recurringLabel}`,
        "Tap to start your recurring income today",
        "Stack 3 recurring offers for stable income",
      ];
      return options[Math.floor(Math.random() * options.length)];
    }

    // Offer-focused
    if (offerIdea) {
      const options = [
        "Try this tool — link in bio",
        "This is the shortcut you need",
        "Get instant access to the offer",
      ];
      return options[Math.floor(Math.random() * options.length)];
    }

    // Pure content / fallback
    const options = [
      "Save this so you don’t lose it",
      "Comment YES for part 2",
      "DM me 'start' for more",
    ];
    return options[Math.floor(Math.random() * options.length)];
  }, [hasFunnel, hasRecurringStack, selectedRecurringPlatform, offerIdea]);

  // -----------------------------
  // CTA ENGINE
  // -----------------------------
  const ctaOptions = [
    "Link in bio",
    "Link in first comment",
    "DM me “start”",
    "Save this & come back",
    "Comment YES and I’ll send details",
    "Share this with a friend",
  ];

// ==================================================
// STEP C — FINAL LINK DEPENDENCIES (FIXED & TYPESAFE)
// ==================================================

// ----------------------------------
// POST MODE
// ----------------------------------
const postMode: "content_only" | "content_and_offer" =
  selectedProduct || selectedRecurringPlatform || selectedFunnelId
    ? "content_and_offer"
    : "content_only";

// ----------------------------------
// OFFER TYPE (undefined instead of null)
// ----------------------------------
const selectedOfferType:
  | "product"
  | "recurring"
  | "funnel"
  | undefined =
  selectedProduct
    ? "product"
    : selectedRecurringPlatform
    ? "recurring"
    : selectedFunnelId
    ? "funnel"
    : undefined;

// ----------------------------------
// PRODUCT AFFILIATE URL
// (ProductResult has NO typed affiliate fields)
// ----------------------------------
const productAffiliateUrl: string | undefined =
  selectedProduct && "affiliate" in selectedProduct
    ? (selectedProduct as any).affiliate
    : undefined;

// ----------------------------------
// RECURRING PLATFORM + USER CODE
// ----------------------------------
const recurringPlatform: string | undefined =
  selectedRecurringPlatform?.platform ?? undefined;

const autoaffiUserCode: string | undefined =
  selectedRecurringPlatform?.autoaffi_user_code ?? undefined;

// ----------------------------------
// FUNNEL SLUG (resolved from ID)
// ----------------------------------
const funnelSlug: string | undefined =
  selectedFunnelId ?? undefined;

const finalCTA = selectedCTA || recommendedCTA;

// ---------------------------------------------
// C.1 – DERIVE OFFER MODE (content / offer logic)
// ---------------------------------------------
const offerMode: "content_only" | "content_and_offer" | "offer_only" =
  mode === "content_only"
    ? "content_only"
    : selectedOfferType
    ? "content_and_offer"
    : "content_only";

    // C.2 – normalize offerType (never null)
const normalizedOfferType:
  | "product"
  | "recurring"
  | "funnel"
  | undefined =
  selectedOfferType ?? undefined;

const finalLink = buildFinalLink({
  mode: postMode,
offerType: normalizedOfferType,
  productAffiliateUrl,
  recurringPlatform,
  recurringUserCode: autoaffiUserCode,
  funnelSlug,
});

const linkHint = resolveLinkHint(finalCTA, finalLink);

  // -----------------------------
  // HANDLE GENERATE (A+ mode)
  // -----------------------------
function handleGenerate() {
  if (isGenerating) return; // extra skydd

  setIsGenerating(true);
  setCopyMessage("");

  // Nollställ ExactFix varje gång vi gör en ny generation
  setExactFixResult(null);
  setExactFixStatus("idle");

  try {
    const topic = baseTopic || "this offer";

    const linkPhrase =
      finalCTA === "Link in first comment"
        ? "Check the first comment for the link."
        : finalCTA === "Link in bio"
        ? "Hit the link in my bio."
        : finalCTA === "DM me “start”"
        ? 'DM me the word “start” and I’ll send everything.'
        : finalCTA === "Comment YES and I’ll send details"
        ? 'Comment “YES” and I’ll send all the details.'
        : finalCTA === "Share this with a friend"
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
              : hasFunnel && funnelLink
              ? `Go through my funnel: ${funnelLink}`
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

    // Ny AI-image prompt varje gång
    const recurringLabel = selectedRecurringPlatform
      ? selectedRecurringPlatform.platform
      : "recurring income";

    const productName = selectedProduct?.name || "your main offer";

    const prompt = [
      `Ultra-detailed vertical social media image (9:16) for a post about ${topic}.`,
      `Platform focus: ${
        platform === "instagram" ? "Instagram Reels" : platform
      }.`,
      mode !== "content_only"
        ? `Highlight the idea of "${productName}" as a powerful solution.`
        : "Focus on value and education, not a specific product.",
      hasRecurringStack
        ? `Subtle reference to recurring income / subscriptions (${recurringLabel}).`
        : "",
      hasFunnel
        ? "Visual hint of a simple 3-step funnel (no text, just flow feeling)."
        : "",
      "High contrast, clear subject, large readable composition, no tiny text.",
      "Style: clean, modern, premium, fits a money/online business niche.",
    ]
      .filter(Boolean)
      .join(" ");

    setAiImagePrompt(prompt);
    setAiPromptHistory((prev) => [prompt, ...prev].slice(0, 10));
  } finally {
    // Viktigt: knappen får aldrig fastna
    setIsGenerating(false);
  }
}

  const fullContentForSEO = useMemo(() => {
    const parts = [customHook || hookOptions[selectedHookIndex], caption, body];
    return parts.filter(Boolean).join("\n\n");
  }, [customHook, hookOptions, selectedHookIndex, caption, body]);

  // -----------------------------
  // EXACT FIX ENGINE STATE + HANDLERS
  // -----------------------------
  type ExactFixResult = {
    hook?: string;
    caption?: string;
    body?: string;
    score?: number;
    howToReach10?: string[];
  };

  const [isExactFixLoading, setIsExactFixLoading] = useState(false);
  const [exactFixError, setExactFixError] = useState<string | null>(null);
  const [isSEOFixing, setIsSEOFixing] = useState(false);

  async function handleRunExactFix() {
    try {
      setIsExactFixLoading(true);
      setExactFixError(null);

      const result = await runExactFixEngine({
        hook: (customHook || hookOptions[selectedHookIndex] || "").trim(),
        caption: caption.trim(),
        body: body.trim(),
        niche: baseTopic,
      });

      if (result) {
        setExactFixResult(result);
      } else {
        setExactFixError("Could not analyze this post. Try again in a moment.");
      }
    } catch (err) {
      console.error("ExactFixEngine error", err);
      setExactFixError("Something went wrong. Please try again.");
    } finally {
      setIsExactFixLoading(false);
    }
  }

  function handleApplyExactFix() {
    if (!exactFixResult) return;

    if (exactFixResult.hook) {
      setCustomHook(exactFixResult.hook);
    }
    if (exactFixResult.caption) {
      setCaption(exactFixResult.caption);
    }
    if (exactFixResult.body) {
      setBody(exactFixResult.body);
    }
  }

  function handleApplySEOFix() {
  setIsSEOFixing(true);

  // Light SEO optimization — no rewrite, only enhancement
  setCaption((prev) =>
    prev
      ? `${prev}\n\n#growth #onlinebusiness #marketing #sidehustle`
      : prev
  );

  setBody((prev) =>
    prev
      ? `${prev}\n\n👉 Save this post so you don’t forget it.`
      : prev
  );

  setIsSEOFixing(false);
}

  // -----------------------------
// HANDLE SEO ENGINE RUN
// -----------------------------
async function handleRunSEO() {
  try {
    setIsSEOLoading(true);
    setSeoError(null);

    // We reuse the already generated content
    if (!fullContentForSEO || fullContentForSEO.trim().length < 20) {
      setSeoError("Generate your post first before running SEO analysis.");
      return;
    }

    // Let SEOEngine handle analysis internally
    // (SEOEngine component already consumes `content`)
    setSeoResult({
      triggeredAt: Date.now(),
    });
  } catch (err: any) {
    setSeoError("Failed to analyze SEO for this post.");
  } finally {
    setIsSEOLoading(false);
  }
}

  const tiktokPreview = useMemo(() => {
    const userHandle = "@autoaffi.creator";
    const firstLine = (customHook || hookOptions[selectedHookIndex] || "").trim();
    const combinedCaption = [firstLine, caption].filter(Boolean).join("\n\n");

    const linkHint =
      mode === "content_only"
        ? ""
        : finalCTA === "Link in first comment"
        ? "🔗 Link in first comment"
        : finalCTA === "Link in bio"
        ? "🔗 Link in bio"
        : finalCTA === "DM me “start”"
        ? "💬 DM me “start”"
        : finalCTA === "Comment YES and I’ll send details"
        ? "💬 Comment YES for details"
        : finalCTA === "Share this with a friend"
        ? "🔁 Share this with a friend"
        : "";

    return {
      user: userHandle,
      caption: combinedCaption,
      linkHint,
    };
  }, [customHook, hookOptions, selectedHookIndex, caption, mode, finalCTA]);

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


  // -----------------------------
// FINAL LINK ENGINE – POST CARD
// -----------------------------

function buildFinalLink({
  mode,
  offerType,
  productAffiliateUrl,
  recurringPlatform,
  recurringUserCode,
  funnelSlug,
}: {
  mode: "content_only" | "content_and_offer" | "offer_only";
  offerType?: "product" | "recurring" | "funnel";
  productAffiliateUrl?: string;
  recurringPlatform?: string;
  recurringUserCode?: string;
  funnelSlug?: string;
}): string {
  if (mode === "content_only") return "";

  if (offerType === "product" && productAffiliateUrl) {
    return productAffiliateUrl;
  }

  if (offerType === "recurring" && recurringPlatform && recurringUserCode) {
    return `https://${recurringPlatform}.com/?ref=${recurringUserCode}`;
  }

  if (offerType === "funnel" && funnelSlug) {
    return `https://autoaffi.io/f/${funnelSlug}`;
  }

  return "";
}

function resolveLinkHint(finalCTA: string, finalLink: string) {
  if (!finalLink) return "";

  switch (finalCTA) {
    case "Link in first comment":
      return "🔗 Link in first comment";
    case "Link in bio":
      return "🔗 Link in bio";
    case "DM me “start”":
      return "💬 DM me “start”";
    case "Comment YES and I’ll send details":
      return "💬 Comment YES for details";
    case "Share this with a friend":
      return "🔁 Share this with a friend";
    default:
      return "";
  }
}

  // -----------------------------
  // (JSX STARTS IN DEL 2)
  // -----------------------------
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
              Turn your ideas or affiliate offers into scroll-stopping posts. Auto-optimized for TikTok, Instagram, Facebook & YouTube – with Smart SEO Engine built in.
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

            {/* PLATFORM SELECT */}
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              <span className="font-semibold text-yellow-300">Platform focus:</span>

              <PlatformPill platform={platform} setPlatform={setPlatform} value="tiktok" label="TikTok" />
              <PlatformPill platform={platform} setPlatform={setPlatform} value="instagram" label="Instagram" />
              <PlatformPill platform={platform} setPlatform={setPlatform} value="facebook" label="Facebook" />
              <PlatformPill platform={platform} setPlatform={setPlatform} value="youtube" label="YouTube Shorts" />
            </div>
          </section>


{/* --------------------------------------------------------------- */}
          {/* STEP 1  — INPUT, PRODUCT, FUNNEL, RECURRING  */}
          {/* --------------------------------------------------------------- */}
          <section className="mb-8 rounded-2xl border border-yellow-500/40 bg-slate-900/70 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.7)]">
            <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-baseline md:justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-yellow-300">
                Step 1 — Tell Autoaffi what you’re doing
              </h2>
              <p className="text-[11px] text-slate-400">
                Start here. Steps 2–3 adapt to your input.
              </p>
            </div>

            {/* ---------------- INPUT STYLE (manual/scan) ---------------- */}
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

            {/* ---------------- MANUAL INPUT ---------------- */}
            {inputStyle === "manual" && (
              <>
                <label className="mb-1 block text-xs font-semibold text-slate-300">
                  What do you want this post to be about?
                </label>

                <input
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="ex: AI side hustles, fitness for beginners…"
                  className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500"
                />

                {/* OFFER IDEA */}
                {mode !== "content_only" && (
                  <>
                    <label className="mb-1 block text-xs font-semibold text-slate-300">
                      What product/offer do you want to promote?
                    </label>

                    <input
                      type="text"
                      value={offerIdea}
                      onChange={(e) => setOfferIdea(e.target.value)}
                      placeholder="ex: AI video tool, email course, membership…"
                      className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500"
                    />
                  </>
                )}

                <p className="text-[11px] text-slate-500 mb-1">
                  Autoaffi will generate hooks & captions based on this.
                </p>
              </>
            )}

            {/* ---------------- SCAN LINK ---------------- */}
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
                  Autoaffi analyzes the offer title, angle & audience.
                </p>
              </>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* BELOW: ONLY WHEN THERE IS AN OFFER (NOT PURE CONTENT MODE)      */}
            {/* ---------------------------------------------------------------- */}
            {mode !== "content_only" && (
              <>
                {/* ---------------- PRODUCT DISCOVERY ---------------- */}
                <div className="mb-5 rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Suggested offers (matching your niche)
                    </p>

                    {loadingProducts && (
                      <span className="text-[10px] text-yellow-300">
                        Searching…
                      </span>
                    )}
                  </div>

                  {hasAffiliateIds ? (
                    <>
                      {productResults.length > 0 ? (
                        <div className="grid gap-2 md:grid-cols-3 text-[11px]">
                          {productResults.slice(0, 3).map((product) => (
                            <button
                              key={product.id}
                              type="button"
                              onClick={() => setSelectedProductId(product.id)}
                              className={`group rounded-xl border px-3 py-2 transition ${
                                selectedProductId === product.id
                                  ? "border-yellow-400 bg-yellow-400/10"
                                  : "border-slate-800 bg-slate-900/80 hover:border-yellow-400/70"
                              }`}
                            >
                              <p className="font-semibold text-slate-100 mb-1 line-clamp-2">
                                {product.name}
                              </p>
                              <p className="text-slate-400">
                                {product.platform} • {product.category}
                              </p>
                              <p className="mt-1 text-[10px] text-emerald-300">
                                Est. EPC: {product.epc.toFixed(2)}$
                              </p>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-500">
                          Enter a product idea above to search offers.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      Connect affiliate IDs in{" "}
                      <Link
                        href="/login/dashboard/affiliate"
                        className="text-yellow-300 underline underline-offset-2"
                      >
                        Affiliate Links &amp; Offers
                      </Link>{" "}
                      to unlock suggestions.
                    </p>
                  )}
                </div>

                {/* ---------------- FUNNEL MODE (A2 – DIRECT SELECTION) -------- */}
                <div className="mb-5 rounded-2xl border border-purple-500/40 bg-purple-500/10 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-purple-300">
                      Funnel Mode (optional)
                    </p>

                    <Link
                      href="/login/dashboard/funnel-builders"
                      className="text-[10px] text-purple-300 underline underline-offset-2 hover:text-purple-200"
                    >
                      Manage funnels
                    </Link>
                  </div>

                  {userFunnels && userFunnels.length > 0 ? (
                    <>
                      <p className="mb-2 text-[11px] text-purple-200/80">
                        Choose which funnel this post should send traffic to:
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {userFunnels.map((funnel) => (
                          <button
                            key={funnel.id}
                            type="button"
                            onClick={() => {
                              setSelectedFunnelId(funnel.id);
                              setUseFunnelMode(true);
                              setFunnelLink(funnel.funnel_url || "");
                            }}
                            className={`rounded-full border px-3 py-1 text-[11px] transition ${
                              selectedFunnelId === funnel.id
                                ? "border-purple-300 bg-purple-300 text-slate-900"
                                : "border-purple-500/50 text-purple-100 hover:border-purple-300/80"
                            }`}
                          >
                            {funnel.funnel_url || "Unnamed funnel"}
                          </button>
                        ))}
                      </div>

                      <p className="mt-1 text-[10px] text-purple-200/70">
                        Autoaffi uses this funnel URL when generating copy & links.
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px] text-purple-200/80">
                      No funnels added yet. Create your first funnel in the{" "}
                      <span className="font-semibold">Funnels</span> card — then
                      they’ll show up here automatically.
                    </p>
                  )}
                </div>

                {/* ---------------- RECURRING MODE ---------------- */}
                <div className="mb-6 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300">
                      Recurring Income Platforms
                    </p>

                    <Link
                      href="/login/dashboard/recurring-income-platforms"
                      className="text-[10px] text-emerald-300 underline underline-offset-2 hover:text-emerald-200"
                    >
                      Manage
                    </Link>
                  </div>

                  {!hasRecurringStack && (
                    <p className="text-[11px] text-emerald-300/80">
                      Connect platforms like Systeme.io, TubeBuddy, Jasper…
                      Autoaffi will adapt hooks &amp; captions automatically.
                    </p>
                  )}

                  {hasRecurringStack && (
                    <>
                      <p className="mb-2 text-[11px] text-emerald-300/70">
                        Choose which recurring platform this post should promote:
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {activeRecurring.map((rec) => (
                          <button
                            key={rec.id}
                            type="button"
                            onClick={() => setSelectedRecurringId(rec.id)}
                            className={`rounded-full border px-3 py-1 text-[11px] transition ${
                              selectedRecurringId === rec.id
                                ? "border-emerald-400 bg-emerald-400 text-slate-900"
                                : "border-emerald-600/40 text-emerald-300 hover:border-emerald-400/70"
                            }`}
                          >
                            {rec.platform}
                          </button>
                        ))}
                      </div>

                      <p className="mt-1 text-[10px] text-emerald-300/60">
                        Autoaffi ensures correct affiliate link + tailored copy.
                      </p>
                    </>
                  )}
                </div>

                {/* ---------------- CTA SELECTION ---------------- */}
                <div className="mt-1 space-y-3">
                  {/* Recommended CTA */}
                  <div className="mb-4 rounded-2xl border border-yellow-500/40 bg-black/40 p-4 shadow-[0_0_25px_rgba(255,200,0,0.15)]">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-yellow-300">
                      Recommended CTA — Autoaffi AI
                    </p>

                    <div className="rounded-xl bg-gradient-to-r from-yellow-500/20 via-yellow-400/10 to-yellow-500/20 border border-yellow-500/30 p-3">
                      <p className="text-sm font-semibold text-yellow-300 drop-shadow">
                        {recommendedCTA}
                      </p>
                      <p className="mt-1 text-[10px] text-yellow-200/80 italic">
                        Auto-updates based on niche, offer, funnel &amp; recurring stack.
                      </p>
                    </div>
                  </div>

                  {/* Manual CTA */}
                  <div>
                    <p className="mb-1 text-[11px] font-semibold text-slate-300">
                      Or choose your own CTA
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
                </div>
              </>
            )}

            {/* GENERATE BUTTON */}
<button
  type="button"
  onClick={handleGenerate}
  disabled={isGenerating}
  className={`mt-5 w-full rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-600 py-3 text-sm font-semibold text-slate-900 shadow-lg transition
    ${isGenerating ? "opacity-70 cursor-not-allowed" : "hover:brightness-110"}`}
>
  {isGenerating ? "Generating…" : "Generate hooks, caption & body"}
</button>

            <p className="mt-2 text-[11px] text-slate-500">
              Step 2 lets you refine text. Step 3 gives visual preview &amp; SEO score.
            </p>
          </section>

{/* --------------------------------------------------------------- */}
{/* STEP 2 – CUSTOMIZE HOOK, CAPTION, BODY + IMAGE UPLOAD + AI PROMPT */}
{/* --------------------------------------------------------------- */}

{hasGenerated && (
  <div className="flex flex-col gap-6 lg:flex-row">

    {/* ===================== */}
    {/* LEFT COLUMN (Step 2 + Step 3) */}
    {/* ===================== */}
    <div className="min-w-0 flex-1">

      {/* --------------------------------------------------------------- */}
      {/* STEP 2 – CUSTOMIZE HOOK, CAPTION, BODY + IMAGE UPLOAD + AI PROMPT */}
      {/* --------------------------------------------------------------- */}
      {hasGenerated && (
        <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-[0_18px_40px_rgba(0,0,0,0.6)]">

          {/* HEADER */}
          <div className="mb-4 space-y-1">

            {/* What happens in Step 3 */}
            <p className="text-[11px] text-slate-400">
              Step 2 lets you refine text. Step 3 gives visual preview, SEO score &{" "}
              <span className="text-blue-300/90"> Conversion Power analysis</span>.
            </p>

            {/* Affiliate/Funnel/Recurring hint */}
            <p className="text-[11px] text-yellow-300/90 font-semibold">
              Your affiliate, funnel or recurring link is automatically added in{" "}
              <span className="underline underline-offset-2">Step 3</span>.
              When you copy your post, Autoaffi always inserts your correct link —{" "}
              <span className="text-yellow-200">based on Product, Funnel or Recurring platform.</span>
            </p>

          </div>

          {/* ---------------- HOOK OPTIONS ---------------- */}
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
              You can also write your own hook below.
            </p>
          </div>

          {/* CUSTOM HOOK */}
          <div className="mb-4">
            <p className="text-[11px] font-semibold text-yellow-300 mb-1">Final hook</p>

            <textarea
              rows={2}
              value={customHook || hookOptions[selectedHookIndex] || ""}
              onChange={(e) => setCustomHook(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </div>

          {/* ---------------- CAPTION ---------------- */}
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

          {/* ---------------- BODY ---------------- */}
          <div className="mb-6">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[11px] font-semibold text-yellow-300">Body text / micro-story</p>

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

          {copyMessage && (
            <p className="mt-1 text-[11px] text-emerald-400">✓ {copyMessage}</p>
          )}

          {/* ---------------- IMAGE UPLOAD ---------------- */}
          <div className="mb-6 rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-yellow-300 mb-2">
              Optional — Add an image for preview
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

            {/* Upload */}
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

            {/* Preview */}
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

          {/* ---------------- AI IMAGE PROMPT ---------------- */}
          <div className="rounded-2xl border border-blue-500/40 bg-blue-500/10 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-300 mb-2">
              AI Image Generator (ChatGPT / DALLE / Midjourney)
            </p>

            <p className="text-[11px] text-blue-200/80 mb-2">
              Copy this prompt into your AI image tool to generate the perfect visual:
            </p>

            <textarea
              rows={4}
              value={aiImagePrompt}
              readOnly
              className="w-full rounded-lg border border-blue-400/40 bg-blue-900/20 px-3 py-2 text-sm text-blue-100"
            />

            <button
              type="button"
              onClick={async () => {
                await copyToClipboard(aiImagePrompt);
                showCopyMessage("AI Prompt copied!");
              }}
              className="mt-2 rounded-lg bg-blue-400/20 border border-blue-400/40 px-3 py-1 text-[11px] text-blue-200 hover:bg-blue-400/30"
            >
              Copy Prompt
            </button>
          </div>

        </section>
      )}

      {/* --------------------------------------------------------------- */}
      {/* STEP 3 – PREVIEW (TikTok-style + image thumbnail) */}
      {/* --------------------------------------------------------------- */}
      {hasGenerated && (
        <section className="mb-10 rounded-2xl border border-yellow-500/40 bg-slate-900/80 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.7)]">
          <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-baseline md:justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-yellow-300">
              Step 3 — Preview
            </h2>
            <p className="text-[11px] text-slate-500">
              TikTok-style feed preview + thumbnail preview with your image. Copy Mode
              2.0 always includes your correct affiliate / funnel / recurring link.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            {/* ----------------- TikTok Feed Mock ----------------- */}
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
                  <p className="text-[10px] text-slate-500">
                    Autoaffi Creator • Sponsor
                  </p>
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

              {/* Body */}
              <div className="mb-3 whitespace-pre-wrap text-[11px] text-slate-300">
                {body}
              </div>

              {/* CTA */}
              {finalCTA && (
                <p className="mt-2 text-[12px] font-semibold text-yellow-300">
                  {finalCTA}
                </p>
              )}

              {/* Bottom row */}
              <div className="mt-4 flex items-center justify-between text-[10px] text-slate-500">
                <span>❤️ 12.3K</span>
                <span>💬 483</span>
                <span>↪ 129</span>
                <span>⋯</span>
              </div>
            </div>

            {/* ----------------- Right side: Image mock ----------------- */}
            <div className="flex flex-col gap-3">
              <div className="relative mx-auto w-full max-w-[260px] overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900 via-slate-950 to-black shadow-[0_18px_40px_rgba(0,0,0,0.8)] aspect-[9/16]">
                {/* Background gradient */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.2),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(96,165,250,0.2),_transparent_55%)]" />

                {/* Uploaded image */}
                {imagePreviewUrl && (
                  <img
                    src={imagePreviewUrl}
                    alt="Uploaded visual preview"
                    className="absolute inset-0 h-full w-full object-cover opacity-90"
                  />
                )}

                {/* Overlay */}
                <div className="relative flex h-full flex-col justify-between p-4">
                  {/* Platform tag + hook */}
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

                    {/* Hook */}
                    <p className="text-sm font-bold leading-snug text-slate-50 drop-shadow-xl line-clamp-3">
                      {(customHook || hookOptions[selectedHookIndex] || "").replace(/\n/g, " ")}
                    </p>
                  </div>

                  {/* Caption + CTA */}
                  <div className="space-y-2 text-[10px] text-slate-200 drop-shadow-xl">
                    <p className="line-clamp-2 opacity-90">
                      {caption || "Your caption preview will appear here once generated."}
                    </p>

                    {finalCTA && (
                      <p className="mt-2 text-[15px] font-semibold text-yellow-300">
                        {finalCTA}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* COPY ALL – MODE 2.0 */}
          <div className="mt-6 flex flex-col items-end gap-2 text-[11px] text-slate-500">
            <button
              type="button"
              onClick={async () => {
                const everything = `${customHook || hookOptions[selectedHookIndex] || ""}


${caption}

${body}

${finalLink ? `Link: ${finalLink}` : ""}

CTA: ${finalCTA || ""}`;

                await copyToClipboard(everything);
                showCopyMessage("Entire post copied with your current affiliate setup.");
              }}
              className="rounded-xl bg-yellow-400 px-5 py-2 text-sm font-semibold text-slate-900 shadow-lg hover:brightness-110 transition"
            >
              Copy entire post
            </button>

            {copyMessage && (
              <p className="text-[11px] text-emerald-400">✓ {copyMessage}</p>
            )}
          </div>
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

    {/* ===================== */}
    {/* RIGHT COLUMN (Sidebar) */}
    {/* ===================== */}
    <aside className="w-full lg:w-80 lg:flex-shrink-0">
      <div className="sticky top-6 space-y-4">

        {/* AUTOAFFI POST ENGINE – HEADER */}
        <section className="rounded-2xl border border-yellow-500/40 bg-slate-900/80 p-4 text-[11px] shadow-[0_18px_40px_rgba(0,0,0,0.8)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-yellow-300">
            Autoaffi Post Engine
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Two AI engines work together to improve conversions and reach before you publish.
          </p>
        </section>

        {/* ExactFix panel */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 text-[11px] text-slate-200 shadow-[0_18px_40px_rgba(0,0,0,0.8)]">
          <header className="mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-yellow-300">
              ExactFix Engine v3
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Analyzes your hook, caption and micro-story to find clarity and conversion gaps —
              then generates a stronger version using Autoaffi’s 10/10 playbook.
            </p>
          </header>

          {/* ============================= */}
          {/* 🔥 FLAMMA 2 — SCORING BARS 🔥 */}
          {/* ============================= */}
          <div className="mb-3 space-y-2">
            {[
              { label: "Hook strength", value: exactFixResult?.breakdown?.hook ?? 60 },
              { label: "SEO clarity", value: exactFixResult?.breakdown?.seo ?? 55 },
              { label: "Engagement", value: exactFixResult?.breakdown?.engagement ?? 65 },
              { label: "Overall clarity", value: exactFixResult?.breakdown?.clarity ?? 60 },
            ].map((item) => (
              <div key={item.label}>
                <div className="mb-0.5 flex justify-between text-[9px] uppercase tracking-widest text-slate-500">
                  <span>{item.label}</span>
                  <span>{item.value}/100</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-800">
                  <div
                    className="h-1.5 rounded-full bg-yellow-400 transition-all duration-700"
                    style={{ width: `${item.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mb-3 flex items-center justify-between">
            <div className="text-[10px] text-slate-500">
              <p className="font-semibold uppercase tracking-[0.18em]">
                Conversion Power
              </p>
              <p>How close this post is to a 10/10.</p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-extrabold text-yellow-300">
                {exactFixResult?.score ?? "–"}
              </span>
              <span className="text-[10px] text-slate-500">/10</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRunExactFix}
            disabled={isExactFixLoading}
            className="mb-3 w-full rounded-lg border border-yellow-400/70 bg-yellow-400/10 px-3 py-1.5 text-[11px] font-semibold text-yellow-200 hover:bg-yellow-400/20 disabled:opacity-60"
          >
            {isExactFixLoading ? "Analyzing post…" : "Run ExactFix on this post"}
          </button>

          {exactFixError && (
            <p className="mb-2 text-[10px] text-red-400">{exactFixError}</p>
          )}

          {exactFixResult && (
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Hook fix
                </p>
                <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-2">
                  <p className="whitespace-pre-wrap text-[11px] text-slate-100">
                    {exactFixResult.hook}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Caption fix
                </p>
                <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-2">
                  <p className="whitespace-pre-wrap text-[11px] text-slate-100">
                    {exactFixResult.caption}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Micro-story / body fix
                </p>
                <div className="max-h-32 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/80 p-2">
                  <p className="whitespace-pre-wrap text-[11px] text-slate-100">
                    {exactFixResult.body}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  How to reach 10/10
                </p>
                <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-slate-400">
                  {exactFixResult.howToReach10?.map((tip, idx) => (
                    <li key={idx}>{tip}</li>
                  )) ?? <li>Run ExactFix to see precise improvements.</li>}
                </ul>
              </div>

              <button
                type="button"
                onClick={handleApplyExactFix}
                className="w-full rounded-lg bg-yellow-400 px-3 py-1.5 text-[11px] font-semibold text-slate-900 shadow hover:brightness-110"
              >
                Apply fix to Step 2
              </button>
            </div>
          )}

          {!exactFixResult && !isExactFixLoading && !exactFixError && (
            <p className="mt-2 text-[10px] text-slate-500">
              Tip: Generate your post in Steps 1–2, then run ExactFix before publishing.
            </p>
          )}
        </section>

        {/* SEO Engine panel */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 text-[11px] text-slate-200 shadow-[0_18px_40px_rgba(0,0,0,0.8)]">
          <header className="mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-yellow-300">
              SEO &amp; Social Reach Engine
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              SEO Engine focuses on how easily your post can be discovered by new
              people. It analyzes keyword strength, hashtags, clarity and structure
              to improve reach on TikTok, Instagram and Facebook.
            </p>
          </header>

          {/* SEO Apply Button */}
          <button
            type="button"
            onClick={handleApplySEOFix}
            disabled={isSEOFixing}
            className="mb-3 w-full rounded-lg border border-yellow-400/60 bg-yellow-400/10 px-3 py-1.5 text-[11px] font-semibold text-yellow-300 hover:bg-yellow-400/20 disabled:opacity-60"
          >
            {isSEOFixing ? "Applying SEO optimization…" : "Apply SEO optimization"}
          </button>

          <p className="mb-3 text-[10px] text-slate-500">
            Improves discoverability and reach without changing your core message.
            Best used after ExactFix.
          </p>

          {/* SEO score + run */}
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[10px] text-slate-500">
              <p className="font-semibold uppercase tracking-[0.18em]">
                Discovery Power
              </p>
              <p>How discoverable this post is right now.</p>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-extrabold text-yellow-300">—</span>
              <span className="text-[10px] text-slate-500">/10</span>
            </div>
          </div>

          {seoError && (
            <p className="mb-2 text-[10px] text-red-400">{seoError}</p>
          )}

          {/* Core SEO engine (unchanged logic) */}
          <SEOEngine content={fullContentForSEO} manualLink={manualLink} />

          {/* Apply SEO improvements */}
          <p className="mt-2 text-[10px] text-slate-500">
            Use these insights to refine your post manually for better reach.
          </p>

          {!seoResult && !isSEOLoading && (
            <p className="mt-2 text-[10px] text-slate-500">
              Tip: Run SEO after generating your post to improve reach and discovery.
            </p>
          )}
        </section>

      </div>
    </aside>

  </div>
)}
</div>
      </div>
    </main>
  );
}

/* ---------------------------- */
/* UI HELPERS (NO CHANGES)      */
/* ---------------------------- */

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