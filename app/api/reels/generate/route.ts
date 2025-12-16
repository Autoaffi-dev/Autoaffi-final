import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// --------------------------------------
// INPUT TYPES
// --------------------------------------
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
  category?: string;
  commissionRate?: string;
  epc?: number;
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

  // gamla vägen (om du någonsin använt offerMeta direkt från fronten)
  offerMeta?: OfferMetaInput;

  // nuvarande front – det du skickar från ReelsPage
  selectedOffer?: SelectedOfferInput | null;
};

// --------------------------------------
// RESPONSE TYPES (VX 4.1 / 4.2 ULTRA)
// --------------------------------------
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
  clarityScore?: number; // 1–10 skala
  powerWords?: string[];
  frictionPhrases?: string[];
  finalCtaLine?: string;
}

// 🔥 NYTT – HOOK INTELLIGENCE v2.0
interface HookIntelligence {
  angle: string; // ex. “pain-to-dream”, “status shift”, “time freedom”
  promise: string; // tydlig outcome
  patternBreak: string; // vad som gör öppningen annorlunda i feeden
  tension: string; // risk, förlust, FOMO
  curiosity: string; // fråga / konflikt som drar vidare
}

interface OfferMeta {
  name: string;
  rating?: number;
  mode?: string;
  commissionRate?: string;
  epc?: number;
  category?: string;
  affiliateUrl?: string;
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

interface GenerateReelResponse {
  script: string;
  storyboard: StoryboardFrame[];
  subtitles: string[];
  cta: string;
  socialHints: SocialHints;
  thumbnailIntelligence: ThumbnailIntelligence;
  ctaIntelligence?: CtaIntelligence;
  offerMeta: OfferMeta;

  // VX 4.1 – ligger "i bakgrunden"
  beatMap: BeatMark[];
  voiceTimeline: VoiceTimelineEntry[];
  exportTimeline: ExportTimeline;

  // VX 4.2 – extra hjärna (frivillig, bryter inget)
  hookIntelligence?: HookIntelligence;
}

// --------------------------------------
// ROUTE HANDLER
// --------------------------------------
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

    // 🔗 Slå ihop offerMeta + selectedOffer → ett gemensamt offerMetaInput
    const rawOfferMeta: OfferMetaInput | SelectedOfferInput | undefined =
      body.offerMeta || body.selectedOffer || undefined;

    const offerMetaInput: OfferMetaInput = {
      name: rawOfferMeta?.name,
      mode: rawOfferMeta?.mode,
      commissionRate: rawOfferMeta?.commissionRate,
      epc: rawOfferMeta?.epc,
      category: rawOfferMeta?.category,
      affiliateUrl: rawOfferMeta?.affiliateUrl,
    };

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY in environment." },
        { status: 500 }
      );
    }

    // --------------------------------------------------------------------
    // 🔥 AUTOAFFI VX 4.2 ULTRA — bygger vidare på din VX 3.5 / 4.1
    // --------------------------------------------------------------------
    //
    //  - Extreme Hook Engine (2–3 sek, alltid)
    //  - Thumbnail Intelligence v3.5
    //  - Social Hints SEO Engine
    //  - OfferMeta Awareness (recurring, product, high-ticket, osv.)
    //  - Media-adaption (mixed / video / stills)
    //
    //  - VX 4.1 tillägg:
    //       • beatMap        → musik & impact-karta
    //       • voiceTimeline  → ord-för-ord med timestamps
    //       • exportTimeline → universell scen-timeline (CapCut / Canva / egna exports)
    //
    //  - VX 4.2 ULTRA tillägg:
    //       • hookIntelligence → ren breakdown av hookens psykologi
    //       • ctaIntelligence v3 → klarhet 1–10, power words, friktion
    //
    //  Allt detta ligger som extra fält i JSON:en och stör inte din nuvarande front.
    // --------------------------------------------------------------------

    const systemPrompt = `
You are Autoaffi VX v4.2 ULTRA — a Reels/Shorts generator focused on conversions for affiliate offers.

You output ONLY valid JSON.
NO explanations.
NO markdown.
NO extra text.

You MUST follow this EXACT interface:

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
  clarityScore?: number; // 1–10
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
  rating?: number;
  mode?: string;
  commissionRate?: string;
  epc?: number;
  category?: string;
  affiliateUrl?: string;
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

interface GenerateReelResponse {
  script: string;
  storyboard: StoryboardFrame[];
  subtitles: string[];
  cta: string;
  socialHints: SocialHints;
  thumbnailIntelligence: ThumbnailIntelligence;
  ctaIntelligence?: CtaIntelligence;
  offerMeta: OfferMeta;
  beatMap: BeatMark[];
  voiceTimeline: VoiceTimelineEntry[];
  exportTimeline: ExportTimeline;
  hookIntelligence?: HookIntelligence;
}

---------------------------------
RULES FOR VX 4.2 ULTRA
---------------------------------

1) HOOK ENGINE (2–3 seconds, EXTREME & OFFER-AWARE)
   - MUST start the video.
   - Based on offerMeta.mode when available:

     recurring    → "monthly income", "while you sleep", "stack up"
     one-time     → "warning", "don’t miss this drop"
     high-ticket  → "one client changed everything", "4-figure commissions"
     lead-magnet  → "I'll give you this for free"

   - If no offerMeta.mode → create a brutal, genre-based hook.

   - hookIntelligence must:
     - angle: short description of angle (e.g. "time freedom for busy parents")
     - promise: clear outcome in normal language
     - patternBreak: what visually or verbally breaks the scroll
     - tension: what is at stake if viewer ignores this
     - curiosity: what question / conflict keeps them watching

2) SCRIPT
   - Short, punchy, 100% social-first.
   - Sections: Hook → Story → CTA.
   - Optimized for a total of ${videoLength} seconds.

3) STORYBOARD
   - MUST cover 0 → videoLength (± 2 seconds).
   - Adapt to mediaType:
       mediaType="video"   → dynamic b-roll usage.
       mediaType="stills"  → strong overlays & clear still changes.
       mediaType="mixed"   → a combination.

   - Each frame:
       time: in seconds, ascending
       description: what happens
       visualCue: how editor should think about visuals

4) SUBTITLES
   - Max 10–12 words per line.
   - Follows the script exactly.
   - Should feel natural when spoken.

5) CTA (conversion-optimized) + CTA INTELLIGENCE v3
   - Must match offerMeta.mode when available.
   - Examples:
       recurring    → "Hit the link & start building your monthly income."
       one-time     → "Tap the link before it’s gone."
       lead-magnet  → "Comment 'guide' & I’ll DM it to you."

   - ctaIntelligence:
       - hookType: e.g. "direct", "pattern interrupt", "proof", "secret"
       - urgencyLevel: "low" | "medium" | "high"
       - clarityScore: integer 1–10 (NOT 100-scale)
       - powerWords: list of high-impact words actually used or suggested
       - frictionPhrases: phrases that remove doubt ("no experience needed", "works worldwide")
       - finalCtaLine: the exact line that should appear as last CTA.

6) SOCIAL HINTS V3 – SEO ENGINE
   MUST include:
   - hashtags:     up to 15 (mix broad + niche).
   - titleIdeas:   always click-through optimized.
   - captionIdeas: every caption must end with a CTA.
   - postingTimes: 3–6 entries like "Mon 19:00", "Fri 18:30".

7) THUMBNAIL INTELLIGENCE v3.5
   finalPrompt MUST include:
   - emotion
   - subject (face or faceless)
   - background / environment
   - lighting
   - big text overlay (2–5 words)
   - camera angle & style
   - color accents
   All of this MUST reflect offerMeta.mode + genre.

8) OFFER AWARENESS
   OfferMeta should clearly influence:
   - Hook
   - Story
   - CTA
   - Title ideas
   - Thumbnail
   - Captions

9) VX 4.1 – BEATMAP
   - beatMap is an array of BeatMark.
   - Mark impacts during the hook, scene transitions and the main CTA.
   - At least 5 beat marks for a 30s video, more for longer.

10) VX 4.1 – VOICE TIMELINE
   - voiceTimeline is an array of VoiceTimelineEntry.
   - Each entry:
       start/end in seconds.
       text = segment of the script.
   - Entries MUST cover the full spoken script from 0 to videoLength.

11) VX 4.1 – EXPORT TIMELINE
   - exportTimeline.totalDuration MUST equal videoLength (± 0.5s).
   - exportTimeline.scenes:
       - index: 0-based order.
       - start/end in seconds.
       - label: short description (e.g. "Hook face close-up", "CTA overlay").
       - mediaHint: "image" | "video" | "mixed".
       - overlayText: optional on-screen text.

---------------------------------

Now create ONE valid GenerateReelResponse JSON object ONLY.

Context:
genre = ${genre}
tone = ${tone}
storyFormat = ${storyFormat}
videoLength = ${videoLength}
mode = ${mode}
mediaType = ${mediaType}
nicheDescription = "${nicheDescription}"

offerMeta provided by user (after merge of offerMeta + selectedOffer):
${JSON.stringify(offerMetaInput, null, 2)}
`.trim();

    const userPrompt = `
Generate ONE valid JSON object ONLY.

NO text before.
NO text after.
NO markdown.
`.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.9,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content || "";

    let parsed: any;

    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      const first = raw.indexOf("{");
      const last = raw.lastIndexOf("}");
      if (first !== -1 && last !== -1) {
        parsed = JSON.parse(raw.slice(first, last + 1));
      } else {
        return NextResponse.json(
          { error: "Failed to parse AI JSON." },
          { status: 500 }
        );
      }
    }

    // --------------------------------------
    // SAFETY DEFAULTS – SÅ FRONTEN INTE KRASHAR
    // --------------------------------------

    // subtitles
    parsed.subtitles = Array.isArray(parsed.subtitles)
      ? parsed.subtitles
      : [];

    // socialHints
    parsed.socialHints = parsed.socialHints || {
      hashtags: [],
      titleIdeas: [],
      captionIdeas: [],
      postingTimes: [],
    };

    // thumbnailIntelligence
    parsed.thumbnailIntelligence = parsed.thumbnailIntelligence || {
      finalPrompt: "",
      emotion: "",
      focalPoint: "",
      colorPalette: [],
    };

    // ctaIntelligence optional – se till att det är objekt eller undefined
    if (parsed.ctaIntelligence && typeof parsed.ctaIntelligence !== "object") {
      parsed.ctaIntelligence = undefined;
    }

    // ✅ CTA clarityScore – normalisera till 1–10 om modellen råkar köra 0–100
    if (parsed.ctaIntelligence) {
      const clarity = parsed.ctaIntelligence.clarityScore;
      if (typeof clarity === "number") {
        // om modellen råkar göra t.ex. 90 → gör om till 9
        if (clarity > 10) {
          parsed.ctaIntelligence.clarityScore = Math.round(clarity / 10);
        }
        if (parsed.ctaIntelligence.clarityScore > 10) {
          parsed.ctaIntelligence.clarityScore = 10;
        }
        if (parsed.ctaIntelligence.clarityScore < 1) {
          parsed.ctaIntelligence.clarityScore = 1;
        }
      } else {
        // default om den missar helt
        parsed.ctaIntelligence.clarityScore = 9;
      }
    }

    // hookIntelligence – om modellen missar, skapa enkel default
    if (parsed.hookIntelligence && typeof parsed.hookIntelligence !== "object") {
      parsed.hookIntelligence = undefined;
    }
    if (!parsed.hookIntelligence) {
      parsed.hookIntelligence = {
        angle: "direct benefit",
        promise: "clear income or time freedom benefit",
        patternBreak: "unexpected opening line in first 2 seconds",
        tension: "what the viewer loses if they ignore this",
        curiosity: "reason to keep watching past 3 seconds",
      };
    }

    // offerMeta
    parsed.offerMeta = parsed.offerMeta || {
      name: offerMetaInput.name || "Your main offer",
      mode: offerMetaInput.mode || "recurring",
      commissionRate: offerMetaInput.commissionRate || "30% recurring",
      category: offerMetaInput.category || "Affiliate marketing",
      affiliateUrl: offerMetaInput.affiliateUrl || "https://your-link.com",
      rating: 4.7,
      epc: offerMetaInput.epc ?? 1.5,
    };

    // VX 4.1 – defaults för nya fält (om modellen skulle missa något)
    if (!Array.isArray(parsed.beatMap)) {
      parsed.beatMap = [];
    }
    if (!Array.isArray(parsed.voiceTimeline)) {
      parsed.voiceTimeline = [];
    }
    if (!parsed.exportTimeline) {
      parsed.exportTimeline = {
        totalDuration: videoLength,
        scenes: [],
      };
    } else {
      // säkerställ duration finns
      if (typeof parsed.exportTimeline.totalDuration !== "number") {
        parsed.exportTimeline.totalDuration = videoLength;
      }
      if (!Array.isArray(parsed.exportTimeline.scenes)) {
        parsed.exportTimeline.scenes = [];
      }
    }

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