import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/* -------------------------------------------------
   🔥  ALL TYPE DEFINITIONS – VX 4.4 BEAST MODE
--------------------------------------------------- */

type OfferMetaInput = {
  name?: string;
  mode?: string;
  commissionRate?: string;
  epc?: number;
  category?: string;
  affiliateUrl?: string;
};

type SelectedOfferInput = {
  name?: string;
  mode?: string;
  commissionRate?: string;
  epc?: number;
  category?: string;
  affiliateUrl?: string;
};

type GenerateBody = {
  genre?: string;
  tone?: string;
  storyFormat?: string;
  videoLength?: number;
  mode?: "manual" | "guided" | "auto";
  mediaType?: "mixed" | "video" | "stills";
  nicheDescription?: string;
  offerMeta?: OfferMetaInput;
  selectedOffer?: SelectedOfferInput | null;
  generationId?: string; // 👈 NY
};

interface StoryboardFrame {
  time: number;
  description: string;
  visualCue: string;
}

interface SocialHints {
  hashtags: string[];
  titleIdeas: string[];
  captionIdeas: string[];
  postingTimes: string[];
  ctaIdeas?: string[];
}

interface ThumbnailIntelligence {
  finalPrompt: string;
  emotion: string;
  focalPoint: string;
  colorPalette: string[];
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

interface HookIntelligence {
  angle: string;
  promise: string;
  patternBreak: string;
  tension: string;
  curiosity: string;
}

interface OfferMeta {
  name: string;
  mode?: string;
  commissionRate?: string;
  epc?: number;
  category?: string;
  affiliateUrl?: string;
  rating?: number;
}

interface BeatMark {
  time: number;
  type: "impact" | "transition" | "drop" | "soft";
  intensity: "low" | "medium" | "high";
}

interface VoiceTimelineEntry {
  start: number;
  end: number;
  text: string;
  emphasis?: "normal" | "strong" | "whisper";
}

interface ExportTimelineScene {
  index: number;
  start: number;
  end: number;
  label: string;
  mediaHint: "image" | "video" | "mixed";
  overlayText?: string;
}

interface ExportTimeline {
  totalDuration: number;
  scenes: ExportTimelineScene[];
}

interface AIBreakdown {
  scriptSummary: string;
  hooks: string[];
  pacing: {
    time: number;
    label: string;
    intensity: "low" | "medium" | "high";
  }[];
  cta: string;
  emotionalDrivers: string[];
  recommendations: string[];
  heatValues: {
    label: string;
    score: number; // 1–100
  }[];
}

interface GenerateReelResponse {
  script: string;
  storyboard: StoryboardFrame[];
  subtitles: string[];
  cta: string;
  socialHints: SocialHints & {
    ctaIdeas?: string[];
  };
  thumbnailIntelligence: ThumbnailIntelligence;
  ctaIntelligence?: CtaIntelligence;
  offerMeta: OfferMeta;
  beatMap: BeatMark[];
  voiceTimeline: VoiceTimelineEntry[];
  exportTimeline: ExportTimeline;
  hookIntelligence?: HookIntelligence;
  mediaFiles?: any[];
  timelinePreview?: string[];
  aiBreakdown?: AIBreakdown; // 🔥 används av AdvancedAIBreakdown
}

/* -------------------------------------------------
   🔥  ROUTE HANDLER – START
--------------------------------------------------- */

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GenerateBody;

    const genre = body.genre || "motivation";
    const tone = body.tone || "energetic";
    const storyFormat = body.storyFormat || "hook-story-cta";
    const videoLength = body.videoLength || 30;
    const mode = body.mode || "manual";
    const mediaType = body.mediaType || "mixed";
    const nicheDescription = body.nicheDescription || "";

    const rawOfferMeta: OfferMetaInput | SelectedOfferInput | undefined | null =
      body.offerMeta ?? body.selectedOffer ?? null;

    const offerMetaInput: OfferMetaInput = {
      name: rawOfferMeta?.name,
      mode: rawOfferMeta?.mode,
      commissionRate: rawOfferMeta?.commissionRate,
      epc: rawOfferMeta?.epc,
      category: rawOfferMeta?.category,
      affiliateUrl: rawOfferMeta?.affiliateUrl,
    };

    /* -------------------------------------------------
       🔥 4.4 MULTISOURCE MEDIA FETCH (PEXELS + PIXABAY + VIDEZZY)
    --------------------------------------------------- */

// 0) Säkra generationId (för seed / variation)
    const generationId =
      body.generationId ||
      `${Date.now()}_${Math.random().toString(16).slice(2)}`;

    // 1) Bygg mediaQuery som matchar offer-typen
    let mediaQuery = genre || "motivation";

    if (offerMetaInput?.mode === "product") {
      const name = offerMetaInput.name || "";
      const category = offerMetaInput.category || "";
      const base = `${name} ${category}`.trim();
      mediaQuery = base || mediaQuery;
    } else if (offerMetaInput?.mode === "recurring") {
      const name = offerMetaInput.name || "";
      const base = `${name} SaaS dashboard marketing`.trim();
      mediaQuery = base || mediaQuery;
    } else if (offerMetaInput?.mode === "funnel") {
      mediaQuery = "high-converting sales funnel landing page marketing";
    }

    const baseUrl =
      req.headers.get("origin") ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");

    const mediaRes = await fetch(`${baseUrl}/api/media/fetch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: mediaQuery,    // 👈 nu produkt-/funnel-styrd
        type: mediaType,
        seed: generationId,   // 👈 kan användas i /api/media/fetch om du vill
      }),
    });

    let mediaFiles: any[] = [];

    if (mediaRes.ok) {
      const mediaJson = await mediaRes.json().catch(() => null);

      if (mediaJson) {
        mediaFiles =
          (mediaJson?.results as any[]) ||
          (mediaJson?.combined as any[]) ||
          [];

        if (Array.isArray(mediaFiles)) {
          // rensa och shuffla → varje generation känns unik
          mediaFiles = mediaFiles
            .filter((m) => m && m.url)
            .sort(() => Math.random() - 0.5)
            .slice(0, 12);
        }
      }
    }

    // 4) Hård fallback om inget media hittas
    if (!mediaFiles.length) {
      mediaFiles = [
        {
          source: "fallback",
          url: "https://public.autoaffi.com/fallback/fallback1.mp4",
          thumb: "https://public.autoaffi.com/fallback/thumb1.jpg",
          duration: videoLength || 15,
        },
      ];
    }

    /* -------------------------------------------------
       🔥 VX 4.4 SYSTEM PROMPT — THE HEART OF THE BEAST
    --------------------------------------------------- */

    const systemPrompt = `
You are Autoaffi VX 4.4 BEAST MODE — the world's most advanced Reels/Shorts engine.

You ALWAYS return perfect JSON (GenerateReelResponse).
You NEVER output markdown.
You NEVER output explanations.
You NEVER output text outside JSON.

MANDATORY FIELDS:
- script
- storyboard[]
- subtitles[]
- cta
- socialHints { hashtags[], titleIdeas[], captionIdeas[], postingTimes[], ctaIdeas[] }
- thumbnailIntelligence
- ctaIntelligence
- offerMeta
- beatMap[]
- voiceTimeline[]
- exportTimeline { totalDuration, scenes[] }
- hookIntelligence
- timelinePreview[]  // short strings summarizing each scene
- mediaFiles[]       // from fetch pipeline
- aiBreakdown {      // for AdvancedAIBreakdown UI
    hooks[]
    pacing[]
    cta
    emotionalDrivers[]
    recommendations[]
    heatValues[]
  }

RULES:
- Hook must be extreme & match offerMeta.mode.
- Thumbnail must be cinematic and include facial/subject emotion + text.
- BeatMap min 5 items.
- VoiceTimeline must span full script.
- ExportTimeline must match videoLength.
- Storyboard must go from 0–videoLength.
- SocialHints must contain at least 10 hashtags, 3 titles, 3 captions.
- aiBreakdown must be a human-readable analysis of what you generated:
  * hooks: list of strongest hook lines or angles
  * pacing: short comments per scene or time segment
  * cta: the main CTA line you want the viewer to hear
  * emotionalDrivers: bullets like "curiosity", "fear of missing out"
  * recommendations: 3–5 concrete tips to improve the reel
  * heatValues: peak moments in the video with short reasons
- JSON must be VALID. If not valid → self-repair.

Context:
Genre=${genre}
Tone=${tone}
StoryFormat=${storyFormat}
VideoLength=${videoLength}
Mode=${mode}
MediaType=${mediaType}
OfferMeta=${JSON.stringify(offerMetaInput, null, 2)}
Niche="${nicheDescription}"
MediaCount=${mediaFiles.length}
`.trim();

    /* -------------------------------------------------
       🔥 OPENAI CALL – VX 4.4 GENERATION
    --------------------------------------------------- */

    const userPrompt = `
Generate ONE valid JSON object ONLY.

NO text before.
NO text after.
NO markdown.
NO comments.
`.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      temperature: 0.9,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    /* -------------------------------------------------
       RAW RESPONSE
    --------------------------------------------------- */
    let raw = completion.choices?.[0]?.message?.content || "";
    let parsed: any = null;

    /* -------------------------------------------------
       🔥 JSON REPAIR LAYER — NEVER BREAK AGAIN
    --------------------------------------------------- */
    const tryParse = (txt: string) => {
      try {
        return JSON.parse(txt);
      } catch {
        return null;
      }
    };

    // 1) Try parse directly
    parsed = tryParse(raw);

    // 2) If fail → extract first { ... } block
    if (!parsed) {
      const first = raw.indexOf("{");
      const last = raw.lastIndexOf("}");
      if (first !== -1 && last !== -1) {
        parsed = tryParse(raw.slice(first, last + 1));
      }
    }

    // 3) If still fail → AI self-repair (mini-fix)
    if (!parsed) {
      const repair = await openai.chat.completions.create({
        model: "gpt-4.1",
        messages: [
          {
            role: "system",
            content: "Fix the JSON. Output ONLY valid JSON. No text.",
          },
          { role: "user", content: raw },
        ],
      });
      const fixed = repair.choices?.[0]?.message?.content || "";
      parsed = tryParse(fixed);
    }

    // 4) If STILL no success → full fallback object
if (!parsed) {
  parsed = {
    script: "",
    storyboard: [],
    subtitles: [],
    cta: "",
    socialHints: {
      hashtags: [],
      titleIdeas: [],
      captionIdeas: [],
      postingTimes: [],
      ctaIdeas: [],
    },
    thumbnailIntelligence: {
      finalPrompt: "",
      emotion: "",
      focalPoint: "",
      colorPalette: [],
    },
    ctaIntelligence: {},
    offerMeta: offerMetaInput,
    beatMap: [],
    voiceTimeline: [],
    exportTimeline: { totalDuration: videoLength, scenes: [] },
    hookIntelligence: {
      angle: "direct benefit",
      promise: "clear result",
      patternBreak: "unexpected opener",
      tension: "what viewer loses if ignored",
      curiosity: "strong open loop",
    },
    mediaFiles: [],
    timelinePreview: [],
    aiBreakdown: {
      scriptSummary: "Short-form reel generated as fallback.",
      hooks: [],
      pacing: [],
      cta: "",
      emotionalDrivers: [],
      recommendations: [],
      heatValues: [],
    },
  } as GenerateReelResponse;
}

    /* -------------------------------------------------
       🔥 BEAST MODE FALLBACKS — GUARANTEED STRUCTURE
    --------------------------------------------------- */

    // subtitles
    parsed.subtitles = Array.isArray(parsed.subtitles) ? parsed.subtitles : [];

    // socialHints
    parsed.socialHints = parsed.socialHints || {};
    parsed.socialHints.hashtags = parsed.socialHints.hashtags || [];
    parsed.socialHints.titleIdeas = parsed.socialHints.titleIdeas || [];
    parsed.socialHints.captionIdeas = parsed.socialHints.captionIdeas || [];
    parsed.socialHints.postingTimes = parsed.socialHints.postingTimes || [];

    // CTA suggestions
    parsed.socialHints.ctaIdeas =
      Array.isArray(parsed.socialHints.ctaIdeas) &&
      parsed.socialHints.ctaIdeas.length > 0
        ? parsed.socialHints.ctaIdeas
        : [];

    // Thumbnail Intelligence
    parsed.thumbnailIntelligence = parsed.thumbnailIntelligence || {
      finalPrompt: "",
      emotion: "",
      focalPoint: "",
      colorPalette: [],
    };

    // CTA Intelligence
    if (parsed.ctaIntelligence && typeof parsed.ctaIntelligence !== "object") {
      parsed.ctaIntelligence = {};
    }

    // normalize clarityScore
    if (parsed.ctaIntelligence) {
      const clarity = parsed.ctaIntelligence.clarityScore;
      if (typeof clarity === "number") {
        if (clarity > 10)
          parsed.ctaIntelligence.clarityScore = Math.round(clarity / 10);
        if (parsed.ctaIntelligence.clarityScore > 10)
          parsed.ctaIntelligence.clarityScore = 10;
        if (parsed.ctaIntelligence.clarityScore < 1)
          parsed.ctaIntelligence.clarityScore = 1;
      } else {
        parsed.ctaIntelligence.clarityScore = 9;
      }
    }

    // Hook Intelligence
    if (
      !parsed.hookIntelligence ||
      typeof parsed.hookIntelligence !== "object"
    ) {
      parsed.hookIntelligence = {
        angle: "direct benefit",
        promise: "clear result",
        patternBreak: "unexpected opener",
        tension: "what viewer loses if ignored",
        curiosity: "question that forces attention",
      };
    }

    // --- AI BREAKDOWN (AdvancedAIBreakdown 2.0) – BEAST MODE ---
if (!parsed.aiBreakdown || typeof parsed.aiBreakdown !== "object") {
  const hookTitle = parsed.socialHints.titleIdeas?.[0] || "High-impact hook for your audience";
  const mainCaption = parsed.socialHints.captionIdeas?.[0] || "Short-form video optimized for attention and clicks.";
  const ctaLine =
    parsed.ctaIntelligence?.finalCtaLine ||
    parsed.cta ||
    "Tap the link to start now.";

  // konvertera beatMap -> pacing heat
  const pacing =
    Array.isArray(parsed.beatMap) && parsed.beatMap.length > 0
      ? parsed.beatMap.map((b: BeatMark) => ({
          time: b.time,
          label:
            b.type === "drop"
              ? "Main impact"
              : b.type === "transition"
              ? "Transition"
              : b.type === "soft"
              ? "Subtle movement"
              : "Beat",
          intensity: b.intensity,
        }))
      : [
          {
            time: 0,
            label: "Intro",
            intensity: "medium" as const,
          },
          {
            time: Math.max(1, videoLength - 4),
            label: "CTA push",
            intensity: "high" as const,
          },
        ];

  const clarity = parsed.ctaIntelligence?.clarityScore ?? 9;

  parsed.aiBreakdown = {
    scriptSummary: `AI analyzed the script, hooks and CTA for a ${videoLength}s ${genre} reel promoting "${offerMetaInput.name ?? "your main offer"}".`,
    hooks: [
      hookTitle,
      `Hook angle: ${parsed.hookIntelligence.angle}`,
      `Promise: ${parsed.hookIntelligence.promise}`,
    ],
    pacing,
    cta: ctaLine,
    emotionalDrivers: [
      "Desire for faster results",
      "Fear of missing out on new AI tools",
      "Curiosity about automation and shortcuts",
    ],
    recommendations: [
      "Highlight the main benefit in the first 2 seconds of the video.",
      "Show a clear before/after transformation visually in the middle of the reel.",
      "End with a strong, spoken CTA that matches the on-screen text.",
    ],
    heatValues: [
      { label: "Hook Strength", score: 90 },
      { label: "CTA Clarity", score: clarity * 10 },
      { label: "Pacing", score: 80 },
      { label: "Value Density", score: 85 },
    ],
  };
}

    // OfferMeta
    parsed.offerMeta = parsed.offerMeta || {
      name: offerMetaInput.name || "Main offer",
      mode: offerMetaInput.mode || "recurring",
      commissionRate: offerMetaInput.commissionRate || "30% recurring",
      category: offerMetaInput.category || "Affiliate marketing",
      affiliateUrl: offerMetaInput.affiliateUrl || "",
      rating: 4.7,
      epc: offerMetaInput.epc ?? 1.5,
    };

    // Beatmap
    if (!Array.isArray(parsed.beatMap)) parsed.beatMap = [];

    // Voice Timeline
    if (!Array.isArray(parsed.voiceTimeline)) parsed.voiceTimeline = [];

    // Export Timeline
    if (!parsed.exportTimeline) {
      parsed.exportTimeline = {
        totalDuration: videoLength,
        scenes: [],
      };
    } else {
      parsed.exportTimeline.totalDuration =
        parsed.exportTimeline.totalDuration || videoLength;
      parsed.exportTimeline.scenes = parsed.exportTimeline.scenes || [];
    }

    // Media files (from fetch route)
    parsed.mediaFiles = mediaFiles;

    // Timeline preview (textual form for UI)
    parsed.timelinePreview = (parsed.exportTimeline.scenes || []).map(
      (s: any) => `Scene ${s.index}: ${s.label} (${s.start}–${s.end}s)`
    );

    /* -------------------------------------------------
       🔥 AI BREAKDOWN OBJECT – FOR AdvancedAIBreakdown
    --------------------------------------------------- */

 const scriptLines =
      typeof parsed.script === "string"
        ? parsed.script
            .split("\n")
            .map((l: string) => l.trim())
            .filter(Boolean)
        : [];

    const primaryHookLine =
      scriptLines[0] ||
      parsed.hookIntelligence?.angle ||
      "Pattern-break hook in the first 3 seconds.";

    const secondaryHookLine =
      scriptLines[1] ||
      parsed.hookIntelligence?.promise ||
      "Clear promise of what the viewer will get.";

    const defaultEmotionalDrivers = [
      "Curiosity about how the system works",
      "Desire for more time or freedom",
      "Fear of missing out on new AI tools",
      "Relief from overwhelm or confusion",
    ];

    const defaultRecommendations = [
      "State the main benefit in under 3 seconds in your hook.",
      "Use a visual pattern-break (zoom, quick cut or bold text) when the hook lands.",
      "Show a clear before/after transformation in the middle of the reel.",
      "Repeat the main benefit once more right before the CTA.",
      "End with a strong spoken CTA that matches the on-screen text.",
    ];

    // --- 1) Grund-heatmap om modellen inte ger något vettigt ---
    const fallbackHeatValues: { label: string; score: number }[] = [
      { label: "Hook moment", score: 90 },
      { label: "Story/value peak", score: 82 },
      { label: "Social proof moment", score: 78 },
      { label: "Final CTA punch", score: 85 },
    ];

    // --- 2) Normalisera heatValues från modellen (om de finns) ---
    const normalizedHeatValues: { label: string; score: number }[] =
      Array.isArray(parsed.aiBreakdown?.heatValues) &&
      parsed.aiBreakdown.heatValues.length > 0
        ? parsed.aiBreakdown.heatValues.map((h: any, idx: number) => {
            const rawScore =
              typeof h.score === "number"
                ? h.score
                : typeof h.score === "string"
                ? parseFloat(h.score)
                : 0;

            const safeScore = Number.isFinite(rawScore) ? rawScore : 0;
            const clamped = Math.max(0, Math.min(100, safeScore));

            return {
              label: h.label || `Key moment ${idx + 1}`,
              score: clamped,
            };
          })
        : fallbackHeatValues;

    // --- 3) Bygg vårt slutliga BEAST-objekt för UI:t ---
    const aiBreakdown: AIBreakdown = {
      scriptSummary:
        parsed.aiBreakdown?.scriptSummary ||
        `AI analyzed your ${videoLength}s ${genre} reel in "${storyFormat}" format with ${
          Array.isArray(parsed.exportTimeline?.scenes)
            ? parsed.exportTimeline.scenes.length
            : 0
        } scenes and ${(parsed.subtitles || []).length} subtitle lines.`,

      hooks:
        Array.isArray(parsed.aiBreakdown?.hooks) &&
        parsed.aiBreakdown.hooks.length > 0
          ? parsed.aiBreakdown.hooks
          : [primaryHookLine, secondaryHookLine].filter(Boolean),

      pacing:
        Array.isArray(parsed.aiBreakdown?.pacing) &&
        parsed.aiBreakdown.pacing.length > 0
          ? parsed.aiBreakdown.pacing
          : Array.isArray(parsed.exportTimeline?.scenes)
          ? parsed.exportTimeline.scenes.map((s: any) => ({
              time: s.start ?? 0,
              label: s.label ?? `Scene ${s.index}`,
              intensity: "medium" as const,
            }))
          : [],

      cta:
        parsed.aiBreakdown?.cta ||
        parsed.cta ||
        "Tap the link to get started now.",

      emotionalDrivers:
        Array.isArray(parsed.aiBreakdown?.emotionalDrivers) &&
        parsed.aiBreakdown.emotionalDrivers.length > 0
          ? parsed.aiBreakdown.emotionalDrivers
          : defaultEmotionalDrivers,

      recommendations:
        Array.isArray(parsed.aiBreakdown?.recommendations) &&
        parsed.aiBreakdown.recommendations.length > 0
          ? parsed.aiBreakdown.recommendations
          : defaultRecommendations,

      heatValues: normalizedHeatValues,
    };

// Normalize heatValues for AdvancedAIBreakdown – avoid NaN/100
if (parsed.aiBreakdown) {
  const rawHeat = Array.isArray(parsed.aiBreakdown.heatValues)
    ? parsed.aiBreakdown.heatValues
    : [];

  const normalized = rawHeat.map((h: any, idx: number) => {
    const rawScore = Number(
      h?.score ??
        h?.value ??   // om modellen råkar kalla det "value"
        0
    );

    const score = Number.isFinite(rawScore)
      ? Math.min(100, Math.max(0, rawScore))
      : 70; // rimlig default om något är knas

    return {
      label:
        typeof h?.label === "string" && h.label.trim()
          ? h.label
          : `Key moment ${idx + 1}`,
      score,
    };
  });

  parsed.aiBreakdown.heatValues =
    normalized.length > 0
      ? normalized
      : [
          { label: "Hook impact", score: 90 },
          { label: "Mid-video value", score: 80 },
          { label: "CTA moment", score: 95 },
        ];
}

    /* -------------------------------------------------
       🔥 FINAL SAFETY: ENSURE NON-EMPTY CORE FIELDS
    --------------------------------------------------- */

    if (!parsed.script || typeof parsed.script !== "string") {
      parsed.script = "Let's build something amazing — starting now.";
    }

    if (!Array.isArray(parsed.storyboard) || parsed.storyboard.length === 0) {
      parsed.storyboard = [
        {
          time: 0,
          description: "Dynamic intro placeholder",
          visualCue: "fast cut, bold overlay",
        },
        {
          time: videoLength - 2,
          description: "CTA moment placeholder",
          visualCue: "punch-in text",
        },
      ];
    }

    if (!parsed.cta || typeof parsed.cta !== "string") {
      parsed.cta = "Hit the link and start your journey today.";
    }

    // Guarantee export timeline is never empty
    if (
      !parsed.exportTimeline ||
      !Array.isArray(parsed.exportTimeline.scenes) ||
      parsed.exportTimeline.scenes.length === 0
    ) {
      parsed.exportTimeline = {
        totalDuration: videoLength,
        scenes: [
          {
            index: 0,
            start: 0,
            end: videoLength,
            label: "Full auto fallback scene",
            mediaHint: mediaType === "video" ? "video" : "image",
            overlayText: "Start Now",
          },
        ],
      };
    }

    // Ensure thumbnail intelligence has a valid prompt
    if (
      !parsed.thumbnailIntelligence.finalPrompt ||
      parsed.thumbnailIntelligence.finalPrompt.length < 10
    ) {
      parsed.thumbnailIntelligence.finalPrompt = `
epic cinematic portrait, sharp contrast, dramatic lighting,
bold headline text, powerful emotion, ${genre} atmosphere,
optimized for social media virality
`.trim();
    }

    /* -------------------------------------------------
       😈 BEAST MODE COMPLETE — RETURN RESPONSE
    --------------------------------------------------- */

    return NextResponse.json(parsed as GenerateReelResponse, {
      status: 200,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Unexpected error." },
      { status: 500 }
    );
  }
}