import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_MODEL = process.env.OPENAI_REELS_MODEL || "gpt-5.4";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/* -------------------------------------------------
  TYPES
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
  guidedText?: string;
  prompt?: string;
  description?: string;
  hook?: string;
  idea?: string;
  topic?: string;
  offerMeta?: OfferMetaInput;
  selectedOffer?: SelectedOfferInput | null;
  generationId?: string;
};

type ScriptAngle =
  | "pain_driven"
  | "curiosity_driven"
  | "proof_driven"
  | "status_driven"
  | "freedom_driven"
  | "logic_driven"
  | "contrarian";

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
  ctaStyle?: string;
  hookPower?: string;
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
  sceneHint?: "hook" | "problem" | "solution" | "proof" | "payoff" | "cta";
}

interface ExportTimeline {
  totalDuration: number;
  scenes: ExportTimelineScene[];
}

interface MusicPlanMarker {
  time: number;
  action: "hit" | "lift" | "transition" | "drop" | "resolve";
  intensity: "low" | "medium" | "high";
}

interface MusicPlan {
  mode: "auto";
  musicPrompt: string;
  trackType: "cinematic" | "trap" | "ambient" | "corporate" | "hybrid";
  mood: string;
  energyStart: number;
  energyPeak: number;
  bpmHint: number;
  useBeatMarkers: boolean;
  beatMarkers: MusicPlanMarker[];
  fadeOutStart: number;
  shouldDuckUnderVoice: boolean;
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
    score: number;
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
  selectedOffer?: OfferMeta;
  beatMap: BeatMark[];
  voiceTimeline: VoiceTimelineEntry[];
  exportTimeline: ExportTimeline;
  musicPlan?: MusicPlan;
  hookIntelligence?: HookIntelligence;
  mediaFiles?: any[];
  timelinePreview?: string[];
  aiBreakdown?: AIBreakdown;
  freedomRecurring?: boolean;
  mediaQuery?: string;
  renderHints?: Record<string, unknown>;
}

/* -------------------------------------------------
  HELPERS
--------------------------------------------------- */

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function safeString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function safeNumber(value: unknown, fallback?: number): number | undefined {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function getSafeOfferMode(mode?: string): "product" | "recurring" | "funnel" {
  const m = safeString(mode, "recurring").toLowerCase();
  if (m === "product" || m === "funnel") return m;
  return "recurring";
}

function normalizeOfferModeLabel(mode?: string): string {
  const safeMode = getSafeOfferMode(mode);
  if (safeMode === "product") return "product";
  if (safeMode === "funnel") return "funnel";
  return "recurring";
}

function normalizeTextForComparison(text: string) {
  return safeString(text)
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clampScore(value: unknown, fallback = 80): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}

function getRequestBaseUrl(req: Request): string {
  const explicitBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    "";

  if (explicitBaseUrl) {
    const normalizedExplicit = /^https?:\/\//i.test(explicitBaseUrl)
      ? explicitBaseUrl
      : `https://${explicitBaseUrl}`;

    if (!/localhost/i.test(normalizedExplicit)) {
      return normalizedExplicit.replace(/\/+$/, "");
    }
  }

  const proto =
    req.headers.get("x-forwarded-proto") ||
    (req.url.startsWith("https://") ? "https" : "http");

  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host");

  if (host && !/localhost/i.test(host)) {
    return `${proto}://${host}`.replace(/\/+$/, "");
  }

  const originHeader = req.headers.get("origin");
  if (originHeader && !/localhost/i.test(originHeader)) {
    return originHeader.replace(/\/+$/, "");
  }

  return "https://www.autoaffi.com";
}

function createTimeoutSignal(ms: number): AbortSignal | undefined {
  const abortSignalWithTimeout = AbortSignal as typeof AbortSignal & {
    timeout?: (milliseconds: number) => AbortSignal;
  };

  return typeof abortSignalWithTimeout.timeout === "function"
    ? abortSignalWithTimeout.timeout(ms)
    : undefined;
}

function getDeterministicIndex(seed: string, mod: number) {
  if (!mod || mod <= 0) return 0;
  const safeSeed = safeString(seed, "autoaffi_seed");
  const sum = safeSeed.split("").reduce((acc, ch, idx) => {
    return acc + ch.charCodeAt(0) * (idx + 1);
  }, 0);
  return Math.abs(sum) % mod;
}

function resolveScriptAngle(params: {
  generationId: string;
  offerMetaInput: OfferMetaInput;
  freedomRecurring: boolean;
}) {
  const { generationId, offerMetaInput, freedomRecurring } = params;
  const offerMode = getSafeOfferMode(offerMetaInput?.mode);
  const seed = [
    generationId,
    offerMetaInput?.name || "",
    offerMetaInput?.category || "",
    offerMode,
    freedomRecurring ? "freedom" : "standard",
  ].join("|");

  const pool: ScriptAngle[] =
    offerMode === "product"
      ? [
          "pain_driven",
          "curiosity_driven",
          "proof_driven",
          "logic_driven",
          "contrarian",
          "status_driven",
        ]
      : offerMode === "funnel"
      ? [
          "pain_driven",
          "logic_driven",
          "contrarian",
          "proof_driven",
          "curiosity_driven",
          "status_driven",
        ]
      : freedomRecurring
      ? [
          "freedom_driven",
          "pain_driven",
          "status_driven",
          "curiosity_driven",
          "logic_driven",
          "proof_driven",
        ]
      : [
          "pain_driven",
          "logic_driven",
          "status_driven",
          "curiosity_driven",
          "proof_driven",
          "contrarian",
        ];

  return pool[getDeterministicIndex(seed, pool.length)];
}

function getScriptAngleInstructions(
  angle: ScriptAngle,
  offerMode?: string,
  freedomRecurring = false
) {
  const mode = getSafeOfferMode(offerMode);

  const modeTail =
    mode === "product"
      ? "Keep the benefit tangible and product-relevant."
      : mode === "funnel"
      ? "Keep the problem tied to conversion, flow or drop-off."
      : freedomRecurring
      ? "Keep the message tied to leverage, recurring upside and freedom."
      : "Keep the message tied to leverage, systems and long-term upside.";

  const map: Record<ScriptAngle, string> = {
    pain_driven: `
SCRIPT ANGLE = PAIN-DRIVEN
- Open with friction, waste, stagnation or a frustrating truth.
- Make the old way feel expensive, slow or exhausting.
- The hook should create immediate discomfort or recognition.
- The reveal should feel like relief and a smarter escape route.
- Keep it sharp, commercial and emotionally clean.
- ${modeTail}
`.trim(),

    curiosity_driven: `
SCRIPT ANGLE = CURIOSITY-DRIVEN
- Open with a thought that creates an open loop or "wait, what?" feeling.
- The first line should make the viewer want the next line.
- Use tension and withheld clarity before the reveal.
- Do NOT become vague or fluffy — curiosity must still lead to a strong payoff.
- Keep the CTA natural and curiosity-led.
- ${modeTail}
`.trim(),

    proof_driven: `
SCRIPT ANGLE = PROOF-DRIVEN
- Open with a believable result, visible shift or strong observation.
- Make the story feel grounded, specific and commercially credible.
- The middle should show why the result happens, not just claim it.
- The reel should feel convincing without sounding like a testimonial ad.
- ${modeTail}
`.trim(),

    status_driven: `
SCRIPT ANGLE = STATUS-DRIVEN
- Open with a smarter-person / smarter-business contrast.
- Make the old way feel amateur, messy or behind.
- Make the better path feel premium, sharp, calm and in-control.
- Use status and confidence, but avoid fake guru language.
- ${modeTail}
`.trim(),

    freedom_driven: `
SCRIPT ANGLE = FREEDOM-DRIVEN
- Open with freedom, leverage, independence or escape from instability.
- Make the wrong path feel like a trap that keeps people stuck.
- The reveal should feel like a smarter model with more control and upside.
- Keep it aspirational, but still credible and commercial.
- ${modeTail}
`.trim(),

    logic_driven: `
SCRIPT ANGLE = LOGIC-DRIVEN
- Open with a sharp business truth or logic flip.
- Make the hook feel intelligent, clear and hard to ignore.
- The story should progress through cause-and-effect, not pure emotion.
- Keep the lines tight, strong and high-conviction.
- ${modeTail}
`.trim(),

    contrarian: `
SCRIPT ANGLE = CONTRARIAN
- Open by challenging what most people think is normal.
- Make the viewer feel that the common approach is flawed or backwards.
- The reveal should feel like the smarter hidden truth.
- Do NOT be edgy just to be edgy — keep it useful and commercially relevant.
- ${modeTail}
`.trim(),
  };

  return map[angle];
}

function getHookExamples(offerMode?: string, scriptAngle?: ScriptAngle) {
  const mode = getSafeOfferMode(offerMode);
  const angle = scriptAngle || "pain_driven";

  if (mode === "product") {
    const byAngle: Record<ScriptAngle, string[]> = {
      pain_driven: [
        "Why are people still doing this the slow way?",
        "This is exactly why your workflow feels harder than it should.",
        "Most people waste time here without realizing it.",
        "The old method is draining more momentum than you think.",
      ],
      curiosity_driven: [
        "The weird part is… this feels normal until you see the better version.",
        "Most people do not notice the problem until this part happens.",
        "There is a reason this workflow keeps feeling heavier than it should.",
        "The smarter version is obvious once you see this.",
      ],
      proof_driven: [
        "The difference shows up faster than most people expect.",
        "You can literally see where the old workflow falls apart.",
        "This is what a cleaner result actually looks like.",
        "The result changes once the setup stops fighting you.",
      ],
      status_driven: [
        "Smart creators do not keep forcing bad workflows.",
        "The old setup looks normal until you compare it to a sharper one.",
        "There is a cleaner way to do this if you care about results.",
        "Messy workflows usually show up in messy outputs.",
      ],
      freedom_driven: [
        "The faster path is usually the one that gives you more room to move.",
        "If the workflow keeps draining energy, the system is wrong.",
        "More freedom usually starts with less friction.",
        "The better tool is usually what gives you more breathing room.",
      ],
      logic_driven: [
        "More effort is usually not the real fix here.",
        "If the workflow keeps slowing down, the method is the problem.",
        "The old way feels harder because it is built worse.",
        "A better system beats more effort almost every time.",
      ],
      contrarian: [
        "The problem is not that you need to work harder.",
        "Most people keep defending a workflow that clearly wastes time.",
        "The old way is not normal — it is just familiar.",
        "People do not need more effort here. They need a better setup.",
      ],
    };

    return byAngle[angle];
  }

  if (mode === "funnel") {
    const byAngle: Record<ScriptAngle, string[]> = {
      pain_driven: [
        "Most funnels do not fail at traffic. They fail right here.",
        "You do not have a traffic problem. You have a flow problem.",
        "Clicks are easy. Conversion is where people lose money.",
        "If people click but do not move, your funnel is leaking.",
      ],
      curiosity_driven: [
        "The strange part is… the leak usually is not where people think.",
        "Most people blame traffic when the real issue is hiding after the click.",
        "There is a reason clicks happen but results still stall.",
        "The smartest funnel fix is usually not what people change first.",
      ],
      proof_driven: [
        "You can almost always see where conversion starts collapsing.",
        "The drop-off is usually obvious once you know where to look.",
        "A weak path shows up long before the numbers fully crash.",
        "The funnel tells you what is broken if you read it right.",
      ],
      status_driven: [
        "Good marketers do not just buy clicks and hope.",
        "A premium business does not let traffic die in a messy funnel.",
        "Weak conversion usually looks like weak structure.",
        "Serious operators fix flow, not just traffic.",
      ],
      freedom_driven: [
        "The wrong funnel keeps you working harder for weaker returns.",
        "A leaky path quietly steals leverage from the whole business.",
        "More freedom usually starts with cleaner conversion.",
        "If the flow is broken, the business feels heavier than it should.",
      ],
      logic_driven: [
        "Traffic is not the bottleneck if the path itself is weak.",
        "If the click happens but the movement stops, the structure is wrong.",
        "More traffic cannot fix a bad journey.",
        "The logic is simple: weak flow kills strong traffic.",
      ],
      contrarian: [
        "The biggest funnel problem usually is not traffic.",
        "Most people try to solve a conversion problem with more clicks.",
        "Buying more traffic into a weak funnel just scales the leak.",
        "The path matters more than the click.",
      ],
    };

    return byAngle[angle];
  }

  const recurringStandardByAngle: Record<ScriptAngle, string[]> = {
    pain_driven: [
      "Most people are still building income the hard way.",
      "Working more is not the same as building smarter.",
      "One-off wins feel good until you have to restart again.",
      "The real flex is building something that keeps moving after today.",
    ],
    curiosity_driven: [
      "The strange part is… most people build income backwards without noticing.",
      "There is a reason progress keeps resetting for so many people.",
      "The smarter model usually looks boring until you understand the leverage.",
      "Most people miss the real shift because they only watch the short-term result.",
    ],
    proof_driven: [
      "You can usually tell which model scales just by looking at the reset pattern.",
      "One system creates effort. The other creates momentum.",
      "The real proof is whether progress survives after the first win.",
      "What matters is not the spike. It is what keeps moving after it.",
    ],
    status_driven: [
      "Smart builders do not keep resetting from zero.",
      "The sharper model is usually quieter, but much stronger.",
      "Serious operators build for leverage, not just quick wins.",
      "The premium move is not more hustle. It is better structure.",
    ],
    freedom_driven: [
      "Most people want freedom but keep building the opposite.",
      "The wrong model can make progress feel like a cage.",
      "Freedom usually starts when the system stops resetting.",
      "Leverage is what turns effort into room to breathe.",
    ],
    logic_driven: [
      "If the result disappears after one win, the model is weak.",
      "A system that keeps resetting is not a stable growth model.",
      "More effort does not fix a bad structure.",
      "The smarter path is usually the one with better leverage.",
    ],
    contrarian: [
      "More hustle is not always the smarter move.",
      "The problem is not that people work too little. It is what they are building on.",
      "One-off wins are overrated if the model keeps resetting.",
      "A lot of people call it growth when it is really just repetition.",
    ],
  };

  if (mode === "recurring") {
    return recurringStandardByAngle[angle];
  }

  return recurringStandardByAngle[angle];
}

function countOccurrences(text: string, value: string) {
  const hay = normalizeTextForComparison(text);
  const needle = normalizeTextForComparison(value);
  if (!hay || !needle) return 0;
  return hay.split(needle).length - 1;
}

function hasStrongRevealSignal(script: string) {
  const normalized = normalizeTextForComparison(script);

  return [
    "that is why",
    "the real shift",
    "the smarter move",
    "the smarter model",
    "here is the cleaner move",
    "here is the smarter move",
    "this is where it changes",
    "that is where it changes",
    "that is the shift",
    "the better version",
    "the smarter path",
    "the smarter setup",
    "the fix is",
    "the answer is",
    "what changes is",
    "that is the part most people miss",
    "the part most people miss",
    "the difference is",
    "the real reason is",
  ].some((x) => normalized.includes(x));
}

function hasNaturalCta(script: string) {
  const normalized = normalizeTextForComparison(script);

  return [
    "tap the link",
    "check the link",
    "see how it works",
    "see the smarter version",
    "start building",
    "get started",
    "see how to fix it",
    "see the better workflow",
    "see the smarter path",
    "see what it looks like",
    "see the difference",
    "see the better version",
  ].some((x) => normalized.includes(x));
}

function isWeakOrGenericScript(script: string, offerMode?: string, offerName?: string) {
  const normalized = normalizeTextForComparison(script);

  if (!normalized) return true;

  const weakPhrases = [
    "game changer",
    "this changes everything",
    "take it to the next level",
    "unlock your potential",
    "make money online",
    "build your dream life",
    "success starts now",
    "more than ever",
    "the future is here",
    "this helps you grow",
    "smarter setup",
    "smarter system",
    "tap the link and see",
    "check it out now",
  ];

  const weakHits = weakPhrases.filter((p) => normalized.includes(p)).length;

  const lines = safeString(script)
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

  const uniqueLineCount = new Set(lines.map((l) => normalizeTextForComparison(l))).size;
  const repetitionRatio = lines.length > 0 ? uniqueLineCount / lines.length : 0;

  const mode = getSafeOfferMode(offerMode);

  const missingModeSignals =
    mode === "product"
      ? !/(tool|workflow|result|faster|simpler|problem|solution|use|way|benefit|shift)/i.test(
          script
        )
      : mode === "funnel"
      ? !/(funnel|click|conversion|traffic|lead|landing|flow|page|drop off|journey)/i.test(
          script
        )
      : !/(recurring|monthly|system|leverage|build|restart|momentum|income|model|upside)/i.test(
          script
        );

  const firstLine = lines[0] || "";
  const firstLineWeak =
    firstLine.length < 10 ||
    /(make money online|check this out|listen up|here s the thing|game changer)/i.test(firstLine);

  const tooShort = wordCount(script) < 18;
  const tooFlat = weakHits >= 2;
  const tooRepetitive = repetitionRatio < 0.72;
  const revealMissing = !hasStrongRevealSignal(script);
  const ctaMissing = !hasNaturalCta(script);
  const offerOveruse =
    offerName && safeString(offerName)
      ? countOccurrences(script, offerName) >= 3
      : false;

  return (
    tooShort ||
    tooFlat ||
    tooRepetitive ||
    missingModeSignals ||
    firstLineWeak ||
    revealMissing ||
    ctaMissing ||
    offerOveruse
  );
}

function normalizeOfferMetaInput(
  rawOfferMeta?: OfferMetaInput | SelectedOfferInput | null
): OfferMetaInput {
  const raw = rawOfferMeta ?? {};

  const name =
    safeString((raw as any)?.name) ||
    safeString((raw as any)?.title) ||
    safeString((raw as any)?.offerName) ||
    "Main offer";

  const mode = getSafeOfferMode(
    safeString((raw as any)?.mode) ||
      safeString((raw as any)?.offerMode) ||
      "recurring"
  );

  const category =
    safeString((raw as any)?.category) ||
    safeString((raw as any)?.productCategory) ||
    (mode === "product"
      ? "digital product"
      : mode === "funnel"
      ? "funnel"
      : "Affiliate marketing");

  const affiliateUrl =
    safeString((raw as any)?.affiliateUrl) ||
    safeString((raw as any)?.affiliate_link) ||
    safeString((raw as any)?.resolvedAffiliateLink) ||
    safeString((raw as any)?.url) ||
    "";

  const commissionRate =
    safeString((raw as any)?.commissionRate) ||
    safeString((raw as any)?.commission) ||
    (mode === "recurring" ? "30% recurring" : "");

  const epc = safeNumber((raw as any)?.epc, undefined);

  return {
    name,
    mode,
    commissionRate,
    epc,
    category,
    affiliateUrl,
  };
}

function offerMetaToResolvedOffer(offerMetaInput: OfferMetaInput): OfferMeta {
  return {
    name: safeString(offerMetaInput.name, "Main offer"),
    mode: getSafeOfferMode(offerMetaInput.mode),
    commissionRate: safeString(
      offerMetaInput.commissionRate,
      getSafeOfferMode(offerMetaInput.mode) === "recurring" ? "30% recurring" : ""
    ),
    epc: typeof offerMetaInput.epc === "number" ? offerMetaInput.epc : 1.5,
    category: safeString(
      offerMetaInput.category,
      getSafeOfferMode(offerMetaInput.mode) === "product"
        ? "digital product"
        : getSafeOfferMode(offerMetaInput.mode) === "funnel"
        ? "funnel"
        : "Affiliate marketing"
    ),
    affiliateUrl: safeString(offerMetaInput.affiliateUrl, ""),
    rating: 4.7,
  };
}

function getTargetSceneCount(totalDuration: number) {
  return totalDuration >= 19 ? 7 : 6;
}

function resolveSmartRenderMaxSegments(params: {
  offerMode?: string;
  freedomRecurring: boolean;
  videoLength: number;
  mediaType?: "mixed" | "video" | "stills";
  storyFormat?: string;
  genre?: string;
}) {
  const mode = getSafeOfferMode(params.offerMode);
  const length = clampNumber(params.videoLength, 15, 15, 25);
  const mediaType = params.mediaType || "mixed";
  const storyBlob = normalizeTextForComparison(
    `${safeString(params.storyFormat)} ${safeString(params.genre)}`
  );

  const storyHeavy =
    /(story|journey|proof|cinematic|mini launch|authority|freedom|status|emotion|reveal)/i.test(
      storyBlob
    );

  if (mode === "product" || mode === "funnel") {
    return 5;
  }

  if (params.freedomRecurring) {
    if (length >= 19) return 5;
    if (mediaType === "video" || mediaType === "mixed") return 5;
    return 4;
  }

  if (length >= 20) return 5;
  if (length >= 18 && (storyHeavy || mediaType === "video")) return 5;
  if (mediaType === "stills" && length <= 16) return 4;

  return 4;
}

function getMaxWordsForDuration(totalDuration: number) {
  if (totalDuration <= 16) return 42;
  if (totalDuration <= 20) return 55;
  return 68;
}

function wordCount(text: string) {
  return safeString(text)
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean).length;
}

function trimSentenceSoft(text: string, maxWords: number) {
  const words = safeString(text)
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);

  if (words.length <= maxWords) return safeString(text);

  return `${words.slice(0, maxWords).join(" ").replace(/[,:;.-]+$/, "")}.`;
}

function compressScriptToDuration(script: string, totalDuration: number) {
  const clean = safeString(script)
    .replace(/\r/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();

  const lines = clean
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const maxWords = getMaxWordsForDuration(totalDuration);

  if (lines.length === 0) {
    return "";
  }

  let normalizedLines = lines;

  if (lines.length > 7) {
    normalizedLines = lines.slice(0, 7);
  }

  let joined = normalizedLines.join(" ");
  if (wordCount(joined) <= maxWords) {
    return normalizedLines.join("\n");
  }

  const preferredLineCount = totalDuration >= 19 ? 7 : 6;
  const sliceCount = Math.min(preferredLineCount, Math.max(4, normalizedLines.length));
  normalizedLines = normalizedLines.slice(0, sliceCount);

  let currentWords = wordCount(normalizedLines.join(" "));
  if (currentWords <= maxWords) {
    return normalizedLines.join("\n");
  }

  const perLineCap = Math.max(6, Math.floor(maxWords / normalizedLines.length));

  normalizedLines = normalizedLines.map((line, idx) => {
    const lineCap =
      idx === 0
        ? Math.max(5, perLineCap - 1)
        : idx === normalizedLines.length - 1
        ? Math.max(6, perLineCap)
        : perLineCap;

    return trimSentenceSoft(line, lineCap);
  });

  joined = normalizedLines.join(" ");
  if (wordCount(joined) <= maxWords) {
    return normalizedLines.join("\n");
  }

  const allWords = joined
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean)
    .slice(0, maxWords);

  const chunkSize = Math.max(5, Math.floor(allWords.length / normalizedLines.length));
  const rebuilt: string[] = [];
  for (let i = 0; i < normalizedLines.length; i++) {
    const start = i * chunkSize;
    const end = i === normalizedLines.length - 1 ? allWords.length : (i + 1) * chunkSize;
    const part = allWords.slice(start, end).join(" ").trim();
    if (part) rebuilt.push(part.replace(/[,:;.-]+$/, "") + ".");
  }

  return rebuilt.join("\n");
}

function buildFreedomSignalBlob(
  body: GenerateBody,
  offerMetaInput: OfferMetaInput,
  extras?: string[]
) {
  return [
    safeString(body.genre),
    safeString(body.tone),
    safeString(body.storyFormat),
    safeString(body.nicheDescription),
    safeString(body.guidedText),
    safeString(body.prompt),
    safeString(body.description),
    safeString(body.hook),
    safeString(body.idea),
    safeString(body.topic),
    safeString(body.offerMeta?.name),
    safeString(body.offerMeta?.category),
    safeString(body.selectedOffer?.name),
    safeString(body.selectedOffer?.category),
    safeString(offerMetaInput?.name),
    safeString(offerMetaInput?.category),
    ...(Array.isArray(extras) ? extras : []),
  ]
    .join(" ")
    .toLowerCase();
}

function looksLikeFreedomRecurring(body: GenerateBody, offerMetaInput: OfferMetaInput) {
  if (getSafeOfferMode(offerMetaInput?.mode) !== "recurring") return false;

  const blob = buildFreedomSignalBlob(body, offerMetaInput);

  const strongSignals = [
    "freedom",
    "financial freedom",
    "recurring income",
    "digital nomad",
    "work from anywhere",
    "remote work",
    "passive income",
    "leave your job",
    "online business",
    "travel lifestyle",
    "travel entrepreneur",
    "remote entrepreneur",
    "laptop lifestyle",
    "escape 9 5",
    "escape the 9 5",
    "quit job",
    "beach",
    "ocean",
    "sunset",
    "sunrise",
    "mountain",
    "nature",
    "luxury lifestyle",
    "freedom lifestyle",
  ];

  const mediumSignals = [
    "travel",
    "lifestyle",
    "luxury",
    "creator freedom",
    "remote entrepreneur",
    "coworking",
    "bansko",
    "digital business freedom",
    "build from anywhere",
    "location freedom",
  ];

  const strongHits = strongSignals.filter((term) => blob.includes(term)).length;
  const mediumHits = mediumSignals.filter((term) => blob.includes(term)).length;

  if (strongHits >= 1) return true;
  if (mediumHits >= 2) return true;

  return false;
}

function resolveMediaUrl(item: any): string | null {
  if (!item || typeof item !== "object") return null;

  const candidates = [
    item.url,
    item.src,
    item.link,
    item.videoUrl,
    item.video_url,
    item.fileUrl,
    item.file_url,
    item.directUrl,
    item.direct_url,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && /^https?:\/\//i.test(candidate)) {
      return candidate;
    }
  }

  return null;
}

function mediaBlob(item: any): string {
  const title = safeString(item?.title).toLowerCase();
  const description = safeString(item?.description).toLowerCase();
  const source = safeString(item?.source).toLowerCase();
  const type = safeString(item?.type).toLowerCase();
  const tags = Array.isArray(item?.tags)
    ? item.tags.map((x: any) => safeString(x).toLowerCase()).join(" ")
    : "";
  const url = safeString(resolveMediaUrl(item)).toLowerCase();

  return [title, description, source, type, tags, url].filter(Boolean).join(" ");
}

function mediaTypeOf(item: any): "video" | "image" | "unknown" {
  const explicit = safeString(item?.type).toLowerCase();
  const url = safeString(resolveMediaUrl(item)).toLowerCase();

  if (explicit === "video" || /\.(mp4|mov|webm|mkv)(\?.*)?$/i.test(url)) return "video";
  if (explicit === "image" || /\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(url)) return "image";
  return "unknown";
}

function blobHasAny(blob: string, terms: string[]) {
  return terms.some((term) => blob.includes(term));
}

function hasStrongNatureScene(blob: string) {
  return blobHasAny(blob, [
    "beach",
    "ocean",
    "sea",
    "sunrise",
    "sunset",
    "mountain",
    "forest",
    "nature",
    "cliff",
    "shore",
    "travel",
    "island",
    "coast",
    "waves",
    "river",
    "lake",
    "tropical",
    "horizon",
    "outdoor",
    "scenic",
    "van life",
    "cabin",
    "trail",
    "camping",
  ]);
}

function hasFreedomSignal(blob: string) {
  return blobHasAny(blob, [
    "digital nomad",
    "remote work",
    "work from anywhere",
    "freedom",
    "financial freedom",
    "passive income",
    "travel entrepreneur",
    "remote entrepreneur",
    "laptop lifestyle",
    "travel lifestyle",
    "luxury",
    "independence",
    "escape 9 5",
    "escape the 9 5",
    "quit job",
    "entrepreneur",
    "creator lifestyle",
  ]);
}

function hasBusinessBridge(blob: string) {
  return blobHasAny(blob, [
    "laptop",
    "creator",
    "startup",
    "online business",
    "freelancer",
    "remote entrepreneur",
    "digital",
    "work from anywhere",
    "digital nomad",
    "coffee shop",
  ]);
}

function hasHardBusinessOfficeSignal(blob: string) {
  return blobHasAny(blob, [
    "office",
    "meeting",
    "team",
    "teamwork",
    "corporate",
    "analytics",
    "dashboard",
    "payment",
    "banking",
    "transaction",
    "retail",
    "ecommerce",
    "online shopping",
    "workplace",
    "interactive data analysis",
    "modern office",
    "student",
    "students",
    "class",
    "course",
    "teacher",
    "teaching",
    "dj software",
    "software on laptop",
    "monitor",
    "keyboard",
    "typing",
    "desktop",
    "office space",
    "web",
    "pc",
    "internet open",
    "marketing project business",
  ]);
}

function isStrictFreedomMedia(item: any) {
  const blob = mediaBlob(item);

  if (hasHardBusinessOfficeSignal(blob)) return false;

  const nature = hasStrongNatureScene(blob);
  const freedom = hasFreedomSignal(blob);
  const businessBridge = hasBusinessBridge(blob);

  if (nature && freedom) return true;
  if (nature && businessBridge && freedom) return true;

  return false;
}

function isFreedomHybridMedia(item: any) {
  const blob = mediaBlob(item);

  if (hasHardBusinessOfficeSignal(blob)) return false;

  return hasStrongNatureScene(blob) && hasBusinessBridge(blob);
}

function isFreedomLifestyleMedia(item: any) {
  const blob = mediaBlob(item);

  if (hasHardBusinessOfficeSignal(blob)) return false;

  return hasStrongNatureScene(blob) || hasFreedomSignal(blob);
}

function dedupeMedia(items: any[]) {
  const seen = new Set<string>();
  const out: any[] = [];

  for (const item of items) {
    const url = resolveMediaUrl(item);
    if (!url) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(item);
  }

  return out;
}

function prioritizeFreedomMedia(items: any[], target = 24) {
  const unique = dedupeMedia(items);

  const strict = unique.filter(isStrictFreedomMedia);
  const hybrid = unique.filter(
    (item) => !strict.includes(item) && isFreedomHybridMedia(item)
  );
  const lifestyle = unique.filter(
    (item) =>
      !strict.includes(item) && !hybrid.includes(item) && isFreedomLifestyleMedia(item)
  );
  const rest = unique.filter(
    (item) =>
      !strict.includes(item) && !hybrid.includes(item) && !lifestyle.includes(item)
  );

  const ordered = [...strict, ...hybrid, ...lifestyle, ...rest];

  return ordered.slice(0, target);
}

function stableRotateMedia<T>(items: T[], seedKey: string): T[] {
  if (!Array.isArray(items) || items.length <= 1) return items;
  const seed = seedKey
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

  const offset = seed % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

function buildDefaultScenePlan(
  totalDuration: number,
  mediaType: "mixed" | "video" | "stills",
  offerMode?: string
): ExportTimelineScene[] {
  const d = clampNumber(totalDuration, 15, 15, 25);
  const mode = getSafeOfferMode(offerMode);

  const mediaHint: ExportTimelineScene["mediaHint"] =
    mediaType === "stills" ? "image" : mediaType === "video" ? "video" : "mixed";

  const shortScenesProduct: ExportTimelineScene[] = [
    { index: 0, start: 0, end: 2.1, label: "Hook / old way feels dumb", mediaHint, overlayText: "Why do people still do this?", sceneHint: "hook" },
    { index: 1, start: 2.1, end: 4.5, label: "Problem / wasted effort", mediaHint, overlayText: "Too much effort. Too little payoff.", sceneHint: "problem" },
    { index: 2, start: 4.5, end: 6.9, label: "Problem / hidden cost", mediaHint, overlayText: "That is where momentum dies", sceneHint: "problem" },
    { index: 3, start: 6.9, end: 9.8, label: "Solution / smart tool reveal", mediaHint, overlayText: "Here is the cleaner move", sceneHint: "solution" },
    { index: 4, start: 9.8, end: 12.7, label: "Payoff / easier result", mediaHint, overlayText: "Cleaner workflow. Better result.", sceneHint: "payoff" },
    { index: 5, start: 12.7, end: d, label: "CTA / act now", mediaHint, overlayText: "Tap to see how it works", sceneHint: "cta" },
  ];

  const shortScenesRecurring: ExportTimelineScene[] = [
    { index: 0, start: 0, end: 2.1, label: "Hook / one-off trap", mediaHint, overlayText: "Still restarting from zero?", sceneHint: "hook" },
    { index: 1, start: 2.1, end: 4.5, label: "Problem / paid once", mediaHint, overlayText: "Work hard. Get paid once.", sceneHint: "problem" },
    { index: 2, start: 4.5, end: 6.9, label: "Problem / unstable cycle", mediaHint, overlayText: "Then repeat the whole grind", sceneHint: "problem" },
    { index: 3, start: 6.9, end: 9.8, label: "Solution / recurring shift", mediaHint, overlayText: "There is a smarter model", sceneHint: "solution" },
    { index: 4, start: 9.8, end: 12.7, label: "Payoff / leverage", mediaHint, overlayText: "More leverage. Less reset.", sceneHint: "payoff" },
    { index: 5, start: 12.7, end: d, label: "CTA / long-term move", mediaHint, overlayText: "Start building the smart way", sceneHint: "cta" },
  ];

  const shortScenesFunnel: ExportTimelineScene[] = [
    { index: 0, start: 0, end: 2.1, label: "Hook / leak warning", mediaHint, overlayText: "Your funnel may be leaking", sceneHint: "hook" },
    { index: 1, start: 2.1, end: 4.5, label: "Problem / clicks wasted", mediaHint, overlayText: "Clicks do not equal conversions", sceneHint: "problem" },
    { index: 2, start: 4.5, end: 6.9, label: "Problem / lost leads", mediaHint, overlayText: "People drop before the result", sceneHint: "problem" },
    { index: 3, start: 6.9, end: 9.8, label: "Solution / flow fix", mediaHint, overlayText: "Fix the path, not just traffic", sceneHint: "solution" },
    { index: 4, start: 9.8, end: 12.7, label: "Payoff / stronger conversion", mediaHint, overlayText: "Better flow = better results", sceneHint: "payoff" },
    { index: 5, start: 12.7, end: d, label: "CTA / click through", mediaHint, overlayText: "See the smarter funnel", sceneHint: "cta" },
  ];

  const longScenesProduct: ExportTimelineScene[] = [
    { index: 0, start: 0, end: 2.2, label: "Hook / pattern break", mediaHint, overlayText: "Why are people still doing this?", sceneHint: "hook" },
    { index: 1, start: 2.2, end: 4.9, label: "Problem / friction", mediaHint, overlayText: "The old way wastes too much time", sceneHint: "problem" },
    { index: 2, start: 4.9, end: 7.7, label: "Problem / consequence", mediaHint, overlayText: "That is where progress slows down", sceneHint: "problem" },
    { index: 3, start: 7.7, end: 10.9, label: "Solution / reveal", mediaHint, overlayText: "This is the cleaner move", sceneHint: "solution" },
    { index: 4, start: 10.9, end: 14.1, label: "Proof / visible shift", mediaHint, overlayText: "You can see the difference fast", sceneHint: "proof" },
    { index: 5, start: 14.1, end: 17.5, label: "Payoff / easier result", mediaHint, overlayText: "Less mess. Better outcome.", sceneHint: "payoff" },
    { index: 6, start: 17.5, end: d, label: "CTA / direct action", mediaHint, overlayText: "Tap and see it for yourself", sceneHint: "cta" },
  ];

  const longScenesRecurring: ExportTimelineScene[] = [
    { index: 0, start: 0, end: 2.2, label: "Hook / leverage contrast", mediaHint, overlayText: "Most people build income backwards", sceneHint: "hook" },
    { index: 1, start: 2.2, end: 4.9, label: "Problem / one-off trap", mediaHint, overlayText: "Effort up. Income resets.", sceneHint: "problem" },
    { index: 2, start: 4.9, end: 7.7, label: "Problem / unstable cycle", mediaHint, overlayText: "That loop kills momentum fast", sceneHint: "problem" },
    { index: 3, start: 7.7, end: 10.9, label: "Solution / recurring model", mediaHint, overlayText: "Use systems that keep building", sceneHint: "solution" },
    { index: 4, start: 10.9, end: 14.1, label: "Proof / leverage logic", mediaHint, overlayText: "More leverage. Less chaos.", sceneHint: "proof" },
    { index: 5, start: 14.1, end: 17.5, label: "Payoff / future upside", mediaHint, overlayText: "Momentum starts stacking", sceneHint: "payoff" },
    { index: 6, start: 17.5, end: d, label: "CTA / long-term action", mediaHint, overlayText: "Start building smarter now", sceneHint: "cta" },
  ];

  const longScenesFunnel: ExportTimelineScene[] = [
    { index: 0, start: 0, end: 2.2, label: "Hook / hard truth", mediaHint, overlayText: "Traffic alone means nothing", sceneHint: "hook" },
    { index: 1, start: 2.2, end: 4.9, label: "Problem / broken path", mediaHint, overlayText: "Most funnels lose people here", sceneHint: "problem" },
    { index: 2, start: 4.9, end: 7.7, label: "Problem / missed conversion", mediaHint, overlayText: "Clicks vanish before conversion", sceneHint: "problem" },
    { index: 3, start: 7.7, end: 10.9, label: "Solution / smarter structure", mediaHint, overlayText: "Fix the flow itself", sceneHint: "solution" },
    { index: 4, start: 10.9, end: 14.1, label: "Proof / stronger setup", mediaHint, overlayText: "Cleaner path. Better conversion.", sceneHint: "proof" },
    { index: 5, start: 14.1, end: 17.5, label: "Payoff / business lift", mediaHint, overlayText: "Now the traffic can work", sceneHint: "payoff" },
    { index: 6, start: 17.5, end: d, label: "CTA / action close", mediaHint, overlayText: "See the smarter funnel", sceneHint: "cta" },
  ];

  if (d <= 16) {
    if (mode === "product") return shortScenesProduct;
    if (mode === "funnel") return shortScenesFunnel;
    return shortScenesRecurring;
  }

  if (mode === "product") return longScenesProduct;
  if (mode === "funnel") return longScenesFunnel;
  return longScenesRecurring;
}

function getOfferModeInstructions(offerMode?: string) {
  const mode = safeString(offerMode, "recurring").toLowerCase();

  if (mode === "product") {
    return `
PRODUCT MODE RULES:
- Focus on a concrete benefit, real use-case or visible before/after shift.
- The hook must sound like something a real creator would actually say on social media.
- The viewer should quickly understand what feels broken in the old way.
- Show a clear contrast between friction and the easier result.
- CTA should sound direct, natural and curiosity-driven.
- Visuals should feel product-relevant, modern, practical and outcome-focused.
- Thumbnail must look tied to a real benefit or result, not generic business inspiration.
- Avoid generic claims like "this changes everything" unless made specific.
`.trim();
  }

  if (mode === "funnel") {
    return `
FUNNEL MODE RULES:
- Focus on conversion, drop-off, weak flow, landing pages, follow-up and sales logic.
- Hook should create immediate tension around lost results, wasted traffic or hidden leaks.
- The middle of the story must reveal a process mistake or smarter conversion mechanism.
- CTA should push the viewer toward clicking, learning more or improving the flow.
- Visuals should feel digital, performance-marketing, strategic and conversion-driven.
- Thumbnail must feel premium, sharp and performance-focused.
- Avoid generic broad business advice. Make the story feel about an actual funnel problem.
`.trim();
  }

  return `
RECURRING MODE RULES:
- Focus on leverage, recurring income, systems, momentum and long-term upside.
- Hook should feel like a smarter business insight, not hype.
- The script should make one-off effort feel unstable and recurring systems feel more intelligent.
- CTA should connect to starting, joining, trying or building with the system.
- Visuals should feel premium, digital, founder-style and automation-driven.
- Thumbnail must feel premium, ambitious, tech-business and status-driven.
- Avoid fake-guru energy. Make the script sound sharp, calm and credible.
`.trim();
}

function getStoryArcInstructions(params: {
  offerMode?: string;
  genre: string;
  tone: string;
  nicheDescription: string;
  offerName: string;
  category: string;
  videoLength: number;
}) {
  const mode = getSafeOfferMode(params.offerMode);
  const niche = safeString(params.nicheDescription, "online business");
  const offerName = safeString(params.offerName, "Main offer");
  const category = safeString(params.category, "digital business");
  const genre = safeString(params.genre, "business");
  const tone = safeString(params.tone, "energetic");
  const videoLength = clampNumber(params.videoLength, 15, 15, 25);

  if (mode === "product") {
    return `
STORY ARC RULES FOR PRODUCT MODE:
- Write the reel like a mini transformation story, not a bland promo.
- The first line must feel native and instantly spoken.
- Scene 1 must interrupt attention and create curiosity around a real frustration.
- Scene 2 must show what feels annoying, inefficient or unnecessarily difficult.
- Scene 3 must deepen the cost of staying with the old method and MUST NOT repeat Scene 2.
- Scene 4 must reveal ${offerName} as the smarter mechanism or shift.
- Scene 5 must show proof, visible improvement or real-world effect.
- Scene 6 must show payoff / emotional relief / confidence.
- Final scene must land the CTA naturally.
- Progression should feel like: confusion -> frustration -> realization -> visible shift -> payoff.
- The product benefit must feel tangible, visual and easy to imagine.
- Use a ${tone} tone with a ${genre} feel for an audience interested in ${niche}.
- Category context: ${category}.
- Total length target: ${videoLength}s.
`.trim();
  }

  if (mode === "funnel") {
    return `
STORY ARC RULES FOR FUNNEL MODE:
- Write the reel like a mini business-reveal story.
- The first line must create tension around lost conversion, weak pages or wasted traffic.
- Scene 1 must feel sharp and surprising.
- Scene 2 must amplify the cost of the problem.
- Scene 3 must deepen the consequence and MUST NOT repeat Scene 2.
- Scene 4 must reveal the smarter flow, system or fix.
- Scene 5 must show why that fix is stronger in practice.
- Scene 6 must show payoff / better performance / more controlled outcome.
- Final scene must land the CTA naturally.
- Progression should feel like: leak -> frustration -> realization -> smarter flow -> better result.
- The middle must feel like a reveal, not generic advice.
- Use a ${tone} tone with a ${genre} feel for people in ${niche}.
- Category context: ${category}.
- Total length target: ${videoLength}s.
`.trim();
  }

  return `
STORY ARC RULES FOR RECURRING MODE:
- Write the reel like a mini leverage story.
- The first line must sound like a strong creator/business insight about smarter income or systems.
- Scene 1 must interrupt attention with a strong contrast between hustle and leverage.
- Scene 2 must intensify the frustration of one-off effort, resets or unstable progress.
- Scene 3 must deepen the pain and MUST NOT repeat Scene 2.
- Scene 4 must reveal ${offerName} as the smarter recurring mechanism or model.
- Scene 5 must show proof or a visible signal of leverage.
- Scene 6 must show payoff: momentum, calmer growth, recurring upside or scale.
- Final scene must land a natural CTA.
- Progression should feel like: effort trap -> repeated reset -> realization -> smarter model -> future upside.
- The middle must feel like a turning point.
- Use a ${tone} tone with a ${genre} feel for creators/builders in ${niche}.
- Category context: ${category}.
- Total length target: ${videoLength}s.
`.trim();
}

function buildThumbnailFallback(params: {
  genre: string;
  tone: string;
  offerMeta: OfferMetaInput;
  nicheDescription: string;
  freedomRecurring: boolean;
}) {
  const offerMode = getSafeOfferMode(params.offerMeta?.mode);
  const offerName = safeString(params.offerMeta?.name, "main offer");
  const category = safeString(params.offerMeta?.category, "digital business");
  const niche = safeString(params.nicheDescription, "online growth");
  const genre = safeString(params.genre, "business");
  const tone = safeString(params.tone, "energetic");

  if (offerMode === "product") {
    return {
      finalPrompt: [
        "high-CTR vertical thumbnail, 9:16, premium product-led composition, ultra sharp subject,",
        `cinematic lighting, ${tone} energy, ${genre} atmosphere,`,
        `clear visual tied to ${offerName} in ${category}, show transformation / result / use-case,`,
        "bold 3-5 word hook in upper third, strong contrast, clean dark background,",
        "modern commercial look, scroll-stopping, outcome-focused, no watermark, no UI chrome",
      ].join(" "),
      emotion: "Curiosity / desire / fast-result energy",
      focalPoint:
        "Main subject or product result centered with obvious transformation and strong visual clarity",
      colorPalette: ["#f59e0b", "#0f172a", "#111827"],
      ctaStyle: "Bold gold-accent CTA feel with strong contrast and product-result energy",
      hookPower: `Specific benefit-driven hook for ${offerName} that feels practical, tangible and clickable`,
      layoutNotes:
        "Use strong subject isolation, large readable headline and clear result-oriented composition",
      faceEmotion: "Confident, impressed or pleasantly surprised",
      hookAngle: `Show why ${offerName} makes ${niche} easier, faster or better`,
    };
  }

  if (offerMode === "funnel") {
    return {
      finalPrompt: [
        "high-CTR vertical thumbnail, 9:16, premium funnel-marketing visual, ultra sharp,",
        `cinematic contrast, ${tone} energy, dark luxury tech background,`,
        `show landing page / dashboard / sales flow energy connected to ${offerName},`,
        "bold 3-5 word conversion hook in upper third, dramatic lighting, clean composition,",
        "premium performance-marketing feel, strategic, polished, scroll-stopping, no watermark",
      ].join(" "),
      emotion: "Control / curiosity / conversion ambition",
      focalPoint:
        "Confident creator or strategist with premium dashboard or landing-page style visual environment",
      colorPalette: ["#10b981", "#0f172a", "#1e293b"],
      ctaStyle: "Premium emerald CTA feel with sharp contrast and luxury conversion energy",
      hookPower:
        "Strong conversion-growth hook combining curiosity, status and clear business upside",
      layoutNotes:
        "Lean into premium SaaS / dashboard / funnel visuals with space for a short hard-hitting headline",
      faceEmotion: "Focused, ambitious, in-control",
      hookAngle: `Reveal why smarter funnels create better conversion and business leverage in ${niche}`,
    };
  }

  if (params.freedomRecurring) {
    return {
      finalPrompt: [
        "high-CTR vertical thumbnail, 9:16, premium freedom-lifestyle recurring-income composition, ultra sharp,",
        `cinematic sunset lighting, ${tone} energy, ${genre} atmosphere,`,
        `show digital-nomad / remote-work / mountain or beach lifestyle tied to ${offerName},`,
        "luxury contrast, premium creator-business feeling, bold 3-5 word hook in upper third,",
        "nature + laptop + ambition blend, scroll-stopping, aspirational but credible, no watermark",
      ].join(" "),
      emotion: "Freedom / ambition / curiosity",
      focalPoint:
        "Confident creator or entrepreneur in a premium remote-work nature setting with clear freedom signal",
      colorPalette: ["#f59e0b", "#0f172a", "#1e293b"],
      ctaStyle: "Premium gold CTA feel with freedom-lifestyle contrast",
      hookPower:
        "Strong freedom-plus-leverage hook that feels aspirational, specific and premium",
      layoutNotes:
        "Use clear outdoor freedom scene with strong business bridge, large readable hook and premium contrast",
      faceEmotion: "Calm, confident, future-focused",
      hookAngle: `Frame ${offerName} as a smarter path toward freedom, leverage and long-term upside`,
    };
  }

  return {
    finalPrompt: [
      "high-CTR vertical thumbnail, 9:16, premium SaaS-founder style composition, ultra sharp portrait,",
      `dramatic lighting, ${tone} energy, ${genre} atmosphere,`,
      `show premium automation / recurring-income / dashboard feel connected to ${offerName},`,
      "bold 3-5 word business-growth hook in upper third, rich dark background, luxury contrast,",
      "status-driven, tech-commercial, cinematic and optimized for Reels virality, no watermark",
    ].join(" "),
    emotion: "Confidence / ambition / curiosity",
    focalPoint:
      "Confident creator or founder with strong eye-contact and premium tech-business atmosphere",
    colorPalette: ["#f59e0b", "#0f172a", "#111827"],
    ctaStyle: "Premium gold-accent CTA feel with strong contrast and luxury energy",
    hookPower:
      "Strong business-growth hook combining status, curiosity and recurring-income upside",
    layoutNotes:
      "Use premium founder composition, dramatic portrait lighting and a bold high-contrast hook",
    faceEmotion: "Confident, motivated, slightly intense",
    hookAngle: `Frame ${offerName} as a smarter long-term system for ${niche}`,
  };
}

function isGenericThumbnailPrompt(prompt: string, offerMode?: string, freedomRecurring = false) {
  const normalized = normalizeTextForComparison(prompt);
  if (!normalized || normalized.length < 30) return true;

  const genericSignals = [
    "high ctr thumbnail",
    "bold hook",
    "strong emotion",
    "centered subject",
    "premium thumbnail",
    "cinematic thumbnail",
  ];

  const genericHits = genericSignals.filter((x) => normalized.includes(x)).length;

  const mode = getSafeOfferMode(offerMode);

  const modeMissing =
    mode === "product"
      ? !/(product|result|use case|transformation|workflow|tool)/i.test(prompt)
      : mode === "funnel"
      ? !/(funnel|conversion|landing page|dashboard|lead|sales flow)/i.test(prompt)
      : freedomRecurring
      ? !/(digital nomad|beach|mountain|remote work|freedom|laptop lifestyle|travel)/i.test(prompt)
      : !/(dashboard|automation|founder|recurring|system|business growth|saas)/i.test(prompt);

  return genericHits >= 2 || modeMissing;
}

function buildFallbackScript(params: {
  offerMeta: OfferMetaInput;
  videoLength: number;
  nicheDescription: string;
  freedomRecurring: boolean;
  scriptAngle: ScriptAngle;
}) {
  const mode = getSafeOfferMode(params.offerMeta?.mode);
  const offerName = safeString(params.offerMeta?.name, "this offer");
  const category = safeString(params.offerMeta?.category, "digital business");
  const niche = safeString(params.nicheDescription, "online business");
  const length = clampNumber(params.videoLength, 15, 15, 25);
  const angle = params.scriptAngle;

  if (mode === "product") {
    if (length <= 16) {
      const shortByAngle: Record<ScriptAngle, string[]> = {
        pain_driven: [
          "Why are people still doing this the hard way?",
          "That is exactly why the workflow feels slower than it should.",
          `${offerName} makes ${category} feel cleaner, faster and easier to act on.`,
          "Tap the link and see what the smarter version looks like.",
        ],
        curiosity_driven: [
          "The weird part is… most people do not notice this until it slows them down.",
          "The old workflow feels normal right up until the friction starts stacking.",
          `${offerName} is the cleaner shift that makes ${category} feel easier fast.`,
          "Tap the link and see the better version for yourself.",
        ],
        proof_driven: [
          "You can usually see the difference faster than people expect.",
          "The old workflow creates friction that shows up in the result.",
          `${offerName} makes ${category} cleaner, sharper and easier to repeat.`,
          "Tap the link and see how the better setup works.",
        ],
        status_driven: [
          "Smart creators do not keep forcing weak workflows.",
          "The old setup only feels acceptable because people are used to seeing it.",
          `${offerName} gives ${category} a cleaner, smarter and more premium feel.`,
          "Tap the link and see the better setup.",
        ],
        freedom_driven: [
          "More freedom usually starts with less friction.",
          "If the workflow keeps draining energy, the setup is wrong.",
          `${offerName} makes ${category} lighter, faster and easier to move with.`,
          "Tap the link and see the smarter version.",
        ],
        logic_driven: [
          "More effort is not the real fix here.",
          "If the workflow feels heavier than it should, the method is the problem.",
          `${offerName} makes ${category} cleaner because the system itself is better.`,
          "Tap the link and see how it works.",
        ],
        contrarian: [
          "The problem is not that people need to work harder here.",
          "Most people are trying to force results out of a workflow that is badly built from the start.",
          `${offerName} is the cleaner shift that makes ${category} easier to run.`,
          "Tap the link and see the smarter version.",
        ],
      };

      return shortByAngle[angle].join("\n");
    }

    const longByAngle: Record<ScriptAngle, string[]> = {
      pain_driven: [
        "Why are people still doing this the hard way?",
        "Most people keep using the old method because it feels normal.",
        `The problem is that it wastes time, creates friction and makes ${category} feel heavier than it should.`,
        `${offerName} is the shift that makes the whole process cleaner, faster and easier to follow.`,
        "You feel the difference because the result starts looking obvious instead of messy.",
        "If you want the smarter setup, tap the link and see how it works.",
      ],
      curiosity_driven: [
        "The strange part is… this feels normal until you see what is actually slowing it down.",
        "Most people do not notice the friction because the old workflow is so familiar.",
        `But that is exactly why ${category} keeps feeling heavier, slower and less clean than it should.`,
        `${offerName} is the point where that whole pattern starts changing.`,
        "Once you see the cleaner version, it gets hard to go back to the old one.",
        "Tap the link and see what the smarter setup looks like.",
      ],
      proof_driven: [
        "You can usually spot the weak workflow before people even say it out loud.",
        "The old method creates friction that shows up in the speed, the feel and the final result.",
        `That is why ${category} often looks harder than it should, even when people try to push through it.`,
        `${offerName} creates a cleaner path that makes the whole process feel sharper and easier to repeat.`,
        "The difference is not hype. It is how obvious the better result starts feeling.",
        "Tap the link and see how the smarter version works.",
      ],
      status_driven: [
        "Smart creators do not keep forcing weak workflows.",
        "The old setup only feels acceptable because people are used to seeing it.",
        `But in reality it makes ${category} look more cluttered, slower and less in-control than it should.`,
        `${offerName} is the sharper move because it makes the whole process cleaner and more premium.`,
        "You feel it fast because the result starts looking more intentional instead of patched together.",
        "Tap the link and see the better setup for yourself.",
      ],
      freedom_driven: [
        "More freedom usually starts with less friction.",
        "A workflow that keeps dragging on will quietly eat energy, speed and momentum.",
        `That is why ${category} can feel heavier than it should, even when the goal itself is right.`,
        `${offerName} is the cleaner shift that gives the process more flow and less resistance.`,
        "The payoff is not just speed. It is how much easier the whole result becomes to move with.",
        "Tap the link and see the smarter version now.",
      ],
      logic_driven: [
        "More effort is not the real fix here.",
        "If a workflow keeps feeling slower than it should, the method itself is usually the problem.",
        `That is why ${category} often stays harder, messier and less repeatable than necessary.`,
        `${offerName} changes that by making the structure cleaner and the process easier to follow.`,
        "The result improves because the system improves first.",
        "Tap the link and see how the better setup works.",
      ],
      contrarian: [
        "The problem is not that people need to work harder here.",
        "Most people are trying to force results out of a workflow that is badly built from the start.",
        `That is why ${category} keeps feeling heavier, slower and more frustrating than it should.`,
        `${offerName} is the smarter move because it fixes the setup instead of demanding more effort.`,
        "Once the workflow gets cleaner, the difference starts looking obvious fast.",
        "Tap the link and see the smarter version for yourself.",
      ],
    };

    return longByAngle[angle].join("\n");
  }

  if (mode === "funnel") {
    if (length <= 16) {
      const shortByAngle: Record<ScriptAngle, string[]> = {
        pain_driven: [
          "You do not have a traffic problem. You have a flow problem.",
          "That is why clicks happen but results do not.",
          `${offerName} helps turn weak funnel logic into a cleaner conversion path.`,
          "Tap the link and see how to fix the flow.",
        ],
        curiosity_driven: [
          "The strange part is… most funnels leak where people least expect it.",
          "That is why traffic can look active while results stay weak.",
          `${offerName} helps turn that hidden weakness into a cleaner conversion path.`,
          "Tap the link and see the smarter flow.",
        ],
        proof_driven: [
          "You can usually see where a funnel starts losing money.",
          "The path looks busy, but the movement dies before conversion.",
          `${offerName} helps turn that weak journey into a cleaner path.`,
          "Tap the link and see how it works.",
        ],
        status_driven: [
          "Good marketers do not just buy clicks and hope.",
          "Weak flow makes the whole funnel feel amateur fast.",
          `${offerName} helps turn that into a sharper conversion path.`,
          "Tap the link and see the better funnel logic.",
        ],
        freedom_driven: [
          "A weak funnel makes the whole business heavier than it should be.",
          "That is why more effort still leads to weaker results.",
          `${offerName} helps create a cleaner flow with stronger conversion movement.`,
          "Tap the link and see the smarter path.",
        ],
        logic_driven: [
          "More traffic cannot fix a weak path.",
          "If people click but do not move, the structure is wrong.",
          `${offerName} helps turn that broken flow into a cleaner conversion system.`,
          "Tap the link and see how to fix it.",
        ],
        contrarian: [
          "The biggest funnel problem usually is not traffic.",
          "Most people try to solve a weak path with more clicks.",
          `${offerName} helps turn that messy logic into a cleaner system.`,
          "Tap the link and see the smarter funnel.",
        ],
      };

      return shortByAngle[angle].join("\n");
    }

    const longByAngle: Record<ScriptAngle, string[]> = {
      pain_driven: [
        "You do not have a traffic problem. You have a flow problem.",
        "A lot of people drive clicks just to lose them before the real conversion moment.",
        "That means traffic looks busy while the funnel quietly wastes leads, attention and momentum.",
        `${offerName} helps turn that messy path into a cleaner system with stronger conversion logic.`,
        "When the flow gets smarter, the whole journey starts making more sense.",
        "If you want the better conversion path, tap the link and see how it works.",
      ],
      curiosity_driven: [
        "The strange part is… the real leak usually is not where people think.",
        "A lot of funnels look active on the surface while the real movement dies after the click.",
        "That is why traffic can feel expensive even when the numbers look busy at first.",
        `${offerName} helps expose that weak point and turn the path into a cleaner conversion flow.`,
        "Once the journey gets sharper, the whole funnel starts feeling more intentional.",
        "Tap the link and see the smarter path for yourself.",
      ],
      proof_driven: [
        "You can almost always see where a funnel starts losing money.",
        "The pattern is simple: the click happens, but the movement fades before the real conversion moment.",
        "That is where attention, leads and momentum quietly start leaking out of the journey.",
        `${offerName} helps turn that weak sequence into a cleaner path with stronger conversion logic.`,
        "The improvement shows up because the structure starts doing more of the work.",
        "Tap the link and see how the better flow works.",
      ],

      freedom_driven: [
        "A weak funnel makes the whole business heavier than it should be.",
        "You keep pushing for results, but the journey keeps bleeding leverage after the click.",
        "That is why more effort does not always produce the cleaner upside people expect.",
        `${offerName} helps turn that weak flow into a stronger conversion path with more control.`,
        "The real payoff is not just more movement. It is a business that feels lighter and smarter.",
        "Tap the link and see the better flow now.",
      ],

      status_driven: [
        "Good marketers do not just buy clicks and hope the path makes sense.",
        "A messy funnel usually feels amateur long before the numbers fully expose it.",
        "That is why weak structure keeps making solid traffic perform below its real potential.",
        `${offerName} helps turn that weak path into a sharper, more premium conversion system.`,
        "Once the flow gets cleaner, the whole business starts looking more in-control.",
        "Tap the link and see the smarter funnel path.",
      ],
      logic_driven: [
        "More traffic cannot fix a weak path.",
        "If people click but do not move, the structure is the real bottleneck.",
        "That is why more spending can make the numbers louder without making the funnel stronger.",
        `${offerName} helps turn that weak sequence into a cleaner conversion system.`,
        "The result improves because the journey improves first.",
        "Tap the link and see how to fix the path.",
      ],
      contrarian: [
        "The biggest funnel problem usually is not traffic.",
        "Most people try to solve weak conversion by buying more clicks into the same broken flow.",
        "That only makes the leak bigger while the journey stays just as weak underneath.",
        `${offerName} helps turn that messy setup into a cleaner conversion path that actually moves people.`,
        "The smarter move is fixing the structure before trying to scale the noise.",
        "Tap the link and see the better funnel logic.",
      ],
    };

    return longByAngle[angle].join("\n");
  }

  if (params.freedomRecurring) {
    if (length <= 16) {
      const shortByAngle: Record<ScriptAngle, string[]> = {
        pain_driven: [
          "Most people want freedom but keep building the wrong model.",
          "They work hard, get paid once, then reset again.",
          `${offerName} is the smarter recurring path if you want leverage and more freedom over time.`,
          "Tap the link and start building the long-term version.",
        ],
        curiosity_driven: [
          "The strange part is… most people build freedom backwards.",
          "They chase progress, then quietly reset the whole thing again.",
          `${offerName} is the smarter recurring path if you want real leverage over time.`,
          "Tap the link and see the long-term version.",
        ],
        proof_driven: [
          "You can usually tell the weak model by how often it resets.",
          "Work goes in, one result happens, then momentum disappears again.",
          `${offerName} is the smarter recurring path if you want leverage that stacks.`,
          "Tap the link and start building smarter.",
        ],
        status_driven: [
          "Smart builders do not keep resetting from zero.",
          "The wrong model looks active but still leaves people stuck.",
          `${offerName} is the sharper recurring path if you want real leverage over time.`,
          "Tap the link and see the better model.",
        ],
        freedom_driven: [
          "If the model keeps resetting, it is not really freedom.",
          "That is why so many people stay busy but still feel stuck.",
          `${offerName} is the smarter recurring path if you want leverage and more room to move.`,
          "Tap the link and start building the better version.",
        ],
        logic_driven: [
          "If the result disappears after one win, the model is weak.",
          "That is why working harder still keeps leading back to zero.",
          `${offerName} is the smarter recurring path if you want leverage that lasts.`,
          "Tap the link and see the long-term version.",
        ],
        contrarian: [
          "More hustle is not always the smarter move.",
          "A lot of people call it growth when they are really just resetting again.",
          `${offerName} is the smarter recurring path if you want leverage over repetition.`,
          "Tap the link and start building the better model.",
        ],
      };

      return shortByAngle[angle].join("\n");
    }

    const longByAngle: Record<ScriptAngle, string[]> = {
      pain_driven: [
        "Most people want freedom but keep building the wrong model.",
        "They work hard, get one result, then reset the whole thing again.",
        "That is why the lifestyle looks good from the outside but still feels unstable underneath.",
        `${offerName} is the smarter recurring model if you want leverage, momentum and more freedom over time.`,
        "The real payoff is building something that keeps moving even when you are not starting from zero again.",
        "If you want the smarter long-term version, tap the link and get started now.",
      ],
      curiosity_driven: [
        "The strange part is… most people build freedom backwards without noticing it.",
        "They chase progress, get one short-term result, then quietly end up resetting the whole cycle again.",
        "That is why the outside can look exciting while the model underneath still feels unstable.",
        `${offerName} is the smarter recurring path because it shifts the model toward leverage instead of repetition.`,
        "Once that clicks, the whole idea of long-term freedom starts making more sense.",
        "Tap the link and see the smarter version now.",
      ],
      proof_driven: [
        "You can usually spot the weak model by what happens after the first result.",
        "If the progress disappears and the whole system needs another full reset, the structure is weak.",
        "That is why a lot of people stay active without ever really building stable momentum underneath.",
        `${offerName} is the smarter recurring model because it is built for leverage that can actually stack over time.`,
        "The proof is not the first win. It is what keeps moving after it.",
        "Tap the link and see how the better model works.",
      ],
      status_driven: [
        "Smart builders do not keep resetting from zero.",
        "A lot of people stay busy because the model looks active, even while it keeps forcing them back into the same cycle.",
        "That is why the wrong structure can feel ambitious on the surface and still be weak underneath.",
        `${offerName} is the sharper recurring model because it is built around leverage, momentum and long-term upside.`,
        "The premium move is not more chaos. It is a model that keeps more of what it builds.",
        "Tap the link and see the smarter version for yourself.",
      ],
      freedom_driven: [
        "If the model keeps resetting, it is not really freedom.",
        "A lot of people work hard enough to look like they are progressing, but still stay trapped in the same unstable loop.",
        "That is why the goal can feel close while the actual lifestyle still feels more fragile than it should.",
        `${offerName} is the smarter recurring model if you want leverage, stability and more room to move over time.`,
        "The real payoff is not just income. It is building a structure that gives you more control and less reset.",
        "Tap the link and start building the better version now.",
      ],
      logic_driven: [
        "If the result disappears after one win, the model is weak.",
        "A system that keeps forcing a full reset is not a strong long-term growth structure.",
        "That is why more effort does not always create more stability, even when people stay consistent.",
        `${offerName} is the smarter recurring model because it is built around leverage instead of repeated restart cycles.`,
        "The result is a path that keeps more momentum instead of burning it off after each win.",
        "Tap the link and see the smarter long-term version.",
      ],
      contrarian: [
        "More hustle is not always the smarter move.",
        "A lot of people call it growth when they are really just repeating the same reset cycle with better branding.",
        "That is why the model can look exciting on the outside while still staying weak underneath.",
        `${offerName} is the smarter recurring path because it builds leverage instead of glorifying repetition.`,
        "The real shift happens when the system keeps more of what the effort creates.",
        "Tap the link and see the better long-term model.",
      ],
    };

    return longByAngle[angle].join("\n");
  }

  if (length <= 16) {
    const shortByAngle: Record<ScriptAngle, string[]> = {
      pain_driven: [
        "Most people are still building income the hard way.",
        "They work, get paid once, then restart from zero.",
        `${offerName} gives you a smarter recurring model with more leverage in ${niche}.`,
        "Tap the link and start building the long-term version.",
      ],
      curiosity_driven: [
        "The strange part is… most people build income backwards without noticing it.",
        "They push for progress, then quietly reset the cycle again.",
        `${offerName} gives you a smarter recurring model with more leverage in ${niche}.`,
        "Tap the link and see the long-term version.",
      ],
      proof_driven: [
        "You can usually tell the weak model by what happens after the first win.",
        "If everything resets, the structure itself is the problem.",
        `${offerName} gives you a smarter recurring model with more leverage in ${niche}.`,
        "Tap the link and see how it works.",
      ],
      status_driven: [
        "Smart builders do not keep resetting from zero.",
        "The wrong model looks active while still staying weak underneath.",
        `${offerName} gives you a sharper recurring model with more leverage in ${niche}.`,
        "Tap the link and see the better version.",
      ],
      freedom_driven: [
        "If the model keeps resetting, it is not real freedom.",
        "That is why so many people stay busy without feeling stable.",
        `${offerName} gives you a smarter recurring model with more leverage in ${niche}.`,
        "Tap the link and start building the better path.",
      ],
      logic_driven: [
        "If the result disappears after one win, the model is weak.",
        "More effort does not fix a structure that keeps resetting.",
        `${offerName} gives you a smarter recurring model with more leverage in ${niche}.`,
        "Tap the link and see the long-term version.",
      ],
      contrarian: [
        "More hustle is not always the smarter move.",
        "A lot of people call it growth when they are really just resetting again.",
        `${offerName} gives you a smarter recurring model with more leverage in ${niche}.`,
        "Tap the link and start building the better model.",
      ],
    };

    return shortByAngle[angle].join("\n");
  }

  const longByAngle: Record<ScriptAngle, string[]> = {
    pain_driven: [
      "Most people are still building income the hard way.",
      "They work hard, get one result, then have to restart the whole cycle again.",
      "That pattern makes growth feel unstable and more chaotic than it needs to be.",
      `${offerName} is a smarter recurring model for ${niche} that gives you more leverage over time.`,
      "The payoff is momentum that keeps building instead of disappearing after one win.",
      "If you want the smarter long-term path, tap the link and get started now.",
    ],
    curiosity_driven: [
      "The strange part is… most people build income backwards without realizing it.",
      "They chase the short-term result, then quietly end up resetting the whole cycle again.",
      "That is why growth can look active on the surface while still feeling unstable underneath.",
      `${offerName} is a smarter recurring model for ${niche} because it shifts the path toward leverage instead of repetition.`,
      "Once that clicks, the whole long-term picture starts making a lot more sense.",
      "Tap the link and see the smarter version now.",
    ],
    proof_driven: [
      "You can usually tell the weak model by what happens after the first win.",
      "If the momentum disappears and the whole system needs another reset, the structure is weak.",
      "That is why so many people stay active without building something that actually keeps moving.",
      `${offerName} is a smarter recurring model for ${niche} because it is built for leverage that can stack over time.`,
      "The proof is not the spike. It is what survives after it.",
      "Tap the link and see how the better model works.",
    ],
    status_driven: [
      "Smart builders do not keep resetting from zero.",
      "A lot of people stay busy because the model looks active, even while it keeps pushing them back into the same loop.",
      "That is why the wrong structure can look ambitious and still stay weak underneath.",
      `${offerName} is a sharper recurring model for ${niche} because it is built around leverage and long-term upside.`,
      "The premium move is not more chaos. It is a model that keeps more of what it builds.",
      "Tap the link and see the smarter version for yourself.",
    ],
    freedom_driven: [
      "If the model keeps resetting, it is not really freedom.",
      "A lot of people work hard enough to look like they are progressing, but still stay stuck in a fragile cycle.",
      "That is why the upside can feel close while the structure underneath still keeps pulling them back.",
      `${offerName} is a smarter recurring model for ${niche} if you want leverage, stability and more room to move over time.`,
      "The real payoff is not just income. It is building something that feels lighter and stronger underneath.",
      "Tap the link and start building the better path now.",
    ],
    logic_driven: [
      "If the result disappears after one win, the model is weak.",
      "A system that forces repeated reset is not a strong long-term growth structure.",
      "That is why more effort does not automatically create more stability, even when people stay consistent.",
      `${offerName} is a smarter recurring model for ${niche} because it is built around leverage instead of restart cycles.`,
      "The result is momentum that has a better chance of staying alive after each win.",
      "Tap the link and see the smarter long-term version.",
    ],
    contrarian: [
      "More hustle is not always the smarter move.",
      "A lot of people call it growth when they are really just repeating the same reset cycle in a different form.",
      "That is why the model can look exciting on the outside while still staying weak underneath.",
      `${offerName} is a smarter recurring model for ${niche} because it builds leverage instead of glorifying repetition.`,
      "The real shift happens when the system keeps more of what the effort creates.",
      "Tap the link and see the better long-term model.",
    ],
  };

  return longByAngle[angle].join("\n");
}
function buildFallbackStoryboard(params: {
  offerMeta: OfferMetaInput;
  videoLength: number;
  freedomRecurring: boolean;
}) {
  const mode = getSafeOfferMode(params.offerMeta?.mode);
  const offerName = safeString(params.offerMeta?.name, "Main offer");
  const length = clampNumber(params.videoLength, 15, 15, 25);

  const t1 = 0;
  const t2 = Math.max(2, Math.floor(length * 0.18));
  const t3 = Math.max(4, Math.floor(length * 0.34));
  const t4 = Math.max(7, Math.floor(length * 0.5));
  const t5 = Math.max(10, Math.floor(length * 0.68));
  const t6 = Math.max(length - 3, 1);

  if (length >= 19) {
    if (mode === "product") {
      return [
        { time: t1, description: "Hook showing why the old way feels outdated or inefficient", visualCue: "fast cut, visual friction, bold overlay" },
        { time: t2, description: "Problem moment showing wasted effort or inconvenience", visualCue: "pain-point shot with contrast and urgency" },
        { time: t3, description: "Deeper consequence showing why staying with the old way slows results", visualCue: "tension build, slowdown visual, frustration energy" },
        { time: t4, description: `Reveal ${offerName} as the cleaner smarter product shift`, visualCue: "sharp transformation reveal, cleaner modern look" },
        { time: t5, description: "Proof or visible improvement moment", visualCue: "clear workflow/result upgrade with momentum" },
        { time: t6, description: "Final payoff and CTA moment", visualCue: "confident result-focused close with action CTA" },
      ];
    }

    if (mode === "funnel") {
      return [
        { time: t1, description: "Hook revealing hidden funnel leak or conversion loss", visualCue: "sharp marketing pattern break and hard-hitting overlay" },
        { time: t2, description: "Problem moment showing wasted traffic or weak flow", visualCue: "dashboard stress, click loss, conversion pain" },
        { time: t3, description: "Deeper consequence showing leads slipping out of the journey", visualCue: "drop-off tension, leak visualization" },
        { time: t4, description: `Reveal ${offerName} as the smarter funnel system or flow fix`, visualCue: "strategic clean funnel reveal" },
        { time: t5, description: "Proof of stronger conversion structure", visualCue: "improved dashboard, clearer steps, stronger movement" },
        { time: t6, description: "Final CTA tied to fixing the path and improving performance", visualCue: "premium end card with conversion CTA" },
      ];
    }

    if (params.freedomRecurring) {
      return [
        { time: t1, description: "Hook contrasting hustle with freedom and leverage", visualCue: "fast cut, premium freedom-business overlay and pattern break" },
        { time: t2, description: "Problem moment showing unstable one-off effort", visualCue: "tension text, hustle visual, low-stability feeling" },
        { time: t3, description: "Deeper pain showing repeated reset cycle", visualCue: "reset, fatigue, chaos and stalled momentum" },
        { time: t4, description: `Reveal ${offerName} as the smarter recurring system`, visualCue: "clean recurring-system reveal in remote-work or premium freedom setting" },
        { time: t5, description: "Proof showing leverage and smarter long-term logic", visualCue: "nature plus business bridge, freedom payoff, premium system feel" },
        { time: t6, description: "Final future-upside CTA moment", visualCue: "gold-accent close with confident CTA and freedom lifestyle undertone" },
      ];
    }

    return [
      { time: t1, description: "Hook contrasting hustle with smarter leverage", visualCue: "fast cut, premium business overlay and pattern break" },
      { time: t2, description: "Problem moment showing unstable one-off effort", visualCue: "tension text, hustle visual, low-stability feeling" },
      { time: t3, description: "Deeper pain showing repeated reset cycle", visualCue: "reset, fatigue, chaos and stalled momentum" },
      { time: t4, description: `Reveal ${offerName} as the smarter recurring system`, visualCue: "clean automation or dashboard reveal" },
      { time: t5, description: "Proof showing leverage and smarter business logic", visualCue: "upside, control, premium system feel" },
      { time: t6, description: "Final future-upside CTA moment", visualCue: "gold-accent close with confident CTA" },
    ];
  }

  if (mode === "product") {
    return [
      { time: t1, description: "Hook showing why the old way feels outdated or inefficient", visualCue: "fast cut, visual friction, bold overlay" },
      { time: t2, description: "Problem moment showing wasted effort or inconvenience", visualCue: "pain-point shot with contrast and urgency" },
      { time: t4, description: `Reveal ${offerName} as the cleaner smarter product shift`, visualCue: "sharp transformation reveal, cleaner modern look" },
      { time: t6, description: "Final payoff and CTA moment", visualCue: "confident result-focused close with action CTA" },
    ];
  }

  if (mode === "funnel") {
    return [
      { time: t1, description: "Hook revealing hidden funnel leak or conversion loss", visualCue: "sharp marketing pattern break and hard-hitting overlay" },
      { time: t2, description: "Problem moment showing wasted traffic or weak flow", visualCue: "dashboard stress, click loss, conversion pain" },
      { time: t4, description: `Reveal ${offerName} as the smarter funnel system or flow fix`, visualCue: "strategic clean funnel reveal" },
      { time: t6, description: "Final CTA tied to fixing the path and improving performance", visualCue: "premium end card with conversion CTA" },
    ];
  }

  if (params.freedomRecurring) {
    return [
      { time: t1, description: "Hook contrasting hustle with real freedom", visualCue: "fast cut, freedom-business pattern break, premium lifestyle tension" },
      { time: t2, description: "Problem moment showing unstable one-off effort", visualCue: "tension text, hustle visual, unstable progress" },
      { time: t4, description: `Reveal ${offerName} as the smarter recurring path`, visualCue: "remote-work freedom reveal with leverage undertone" },
      { time: t6, description: "Final future-upside CTA moment", visualCue: "gold-accent freedom close with confident CTA" },
    ];
  }

  return [
    { time: t1, description: "Hook contrasting hustle with smarter leverage", visualCue: "fast cut, premium business overlay and pattern break" },
    { time: t2, description: "Problem moment showing unstable one-off effort", visualCue: "tension text, hustle visual, low-stability feeling" },
    { time: t4, description: `Reveal ${offerName} as the smarter recurring system`, visualCue: "clean automation or dashboard reveal" },
    { time: t6, description: "Final future-upside CTA moment", visualCue: "gold-accent close with confident CTA" },
  ];
}

function buildFallbackCta(params: { offerMeta: OfferMetaInput; freedomRecurring: boolean }) {
  const mode = getSafeOfferMode(params.offerMeta?.mode);

  if (mode === "product") {
    return "Tap the link and see what the better version looks like.";
  }

  if (mode === "funnel") {
    return "Tap the link and see how to fix the flow.";
  }

  if (params.freedomRecurring) {
    return "Tap the link and start building the smarter freedom-first model.";
  }

  return "Tap the link and start building the smarter long-term model.";
}

function buildGuaranteedBeatMap(totalDuration: number): BeatMark[] {
  const d = clampNumber(totalDuration, 15, 15, 25);

  const storyAnchors = [
    { time: 0.45, type: "impact", intensity: "high" },
    { time: d * 0.12, type: "transition", intensity: "medium" },
    { time: d * 0.24, type: "impact", intensity: "high" },
    { time: d * 0.38, type: "transition", intensity: "medium" },
    { time: d * 0.53, type: "drop", intensity: "high" },
    { time: d * 0.68, type: "impact", intensity: "medium" },
    { time: d * 0.83, type: "impact", intensity: "high" },
    { time: Math.max(d - 0.45, 0.8), type: "transition", intensity: "medium" },
  ] as const;

  const normalized = storyAnchors
    .map((b) => ({
      time: Number(Math.min(d - 0.1, Math.max(0, b.time)).toFixed(2)),
      type: b.type as BeatMark["type"],
      intensity: b.intensity as BeatMark["intensity"],
    }))
    .filter((b, idx, arr) => {
      const firstIdx = arr.findIndex(
        (x) => x.time === b.time && x.type === b.type && x.intensity === b.intensity
      );
      return idx === firstIdx;
    })
    .sort((a, b) => a.time - b.time);

  return normalized.length >= 6 ? normalized : normalized.slice(0, 6);
}

function buildStoryDrivenBeatMap(
  totalDuration: number,
  scenes: ExportTimelineScene[]
): BeatMark[] {
  const d = clampNumber(totalDuration, 15, 15, 25);

  if (!Array.isArray(scenes) || scenes.length === 0) {
    return buildGuaranteedBeatMap(d);
  }

  const beats: BeatMark[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const start = Number.isFinite(Number(scene?.start)) ? Number(scene.start) : 0;
    const end = Number.isFinite(Number(scene?.end)) ? Number(scene.end) : start + 2;
    const safeStart = Math.max(0, Math.min(d - 0.1, start));
    const safeEnd = Math.max(safeStart + 0.2, Math.min(d, end));
    const duration = Math.max(0.3, safeEnd - safeStart);
    const sceneHint = safeString(scene?.sceneHint, "").toLowerCase();

    beats.push({
      time: Number(safeStart.toFixed(2)),
      type:
        sceneHint === "hook"
          ? "impact"
          : sceneHint === "problem"
          ? "transition"
          : sceneHint === "solution"
          ? "drop"
          : sceneHint === "cta"
          ? "impact"
          : sceneHint === "payoff"
          ? "impact"
          : "transition",
      intensity:
        sceneHint === "hook" || sceneHint === "solution" || sceneHint === "cta"
          ? "high"
          : "medium",
    });

    const quarter = safeStart + duration * 0.28;
    const mid = safeStart + duration * 0.54;

    beats.push({
      time: Number(Math.min(d - 0.1, quarter).toFixed(2)),
      type: sceneHint === "problem" ? "soft" : "transition",
      intensity: "medium",
    });

    beats.push({
      time: Number(Math.min(d - 0.1, mid).toFixed(2)),
      type:
        sceneHint === "problem"
          ? "transition"
          : sceneHint === "solution"
          ? "impact"
          : sceneHint === "proof"
          ? "impact"
          : sceneHint === "cta"
          ? "impact"
          : "soft",
      intensity:
        sceneHint === "solution" || sceneHint === "proof" || sceneHint === "cta"
          ? "high"
          : "medium",
    });
  }

  beats.push({
    time: Number(Math.max(0.8, d - 0.38).toFixed(2)),
    type: "impact",
    intensity: "high",
  });

  const normalized = beats
    .map((b) => ({
      time: Number(Math.max(0, Math.min(d - 0.1, b.time)).toFixed(2)),
      type: b.type,
      intensity: b.intensity,
    }))
    .sort((a, b) => a.time - b.time)
    .filter((b, idx, arr) => {
      if (idx === 0) return true;
      const prev = arr[idx - 1];
      return Math.abs(prev.time - b.time) > 0.15 || prev.type !== b.type;
    });

  if (normalized.length >= 6) {
    return normalized;
  }

  return buildGuaranteedBeatMap(d);
}

function normalizeBeatMap(
  beatMap: any,
  totalDuration: number,
  scenes?: ExportTimelineScene[]
): BeatMark[] {
  if (!Array.isArray(beatMap)) {
    return buildStoryDrivenBeatMap(totalDuration, scenes || []);
  }

  const valid = beatMap
    .map((b: any) => {
      const time = Number(b?.time);
      const type =
        b?.type === "impact" ||
        b?.type === "transition" ||
        b?.type === "drop" ||
        b?.type === "soft"
          ? b.type
          : "impact";
      const intensity =
        b?.intensity === "low" ||
        b?.intensity === "medium" ||
        b?.intensity === "high"
          ? b.intensity
          : "medium";

      if (!Number.isFinite(time)) return null;

      return {
        time: Number(Math.min(totalDuration - 0.1, Math.max(0, time)).toFixed(2)),
        type,
        intensity,
      } as BeatMark;
    })
    .filter(Boolean) as BeatMark[];

  if (valid.length >= 6) {
    return valid.sort((a, b) => a.time - b.time);
  }

  return buildStoryDrivenBeatMap(totalDuration, scenes || []);
}

function buildVoiceTimelineFromLines(
  lines: string[],
  totalDuration: number
): VoiceTimelineEntry[] {
  if (!lines.length) {
    return [
      {
        start: 0,
        end: totalDuration,
        text: "Let's build something amazing — starting now.",
        emphasis: "normal",
      },
    ];
  }

  const segment = totalDuration / lines.length;

  return lines.map((line, idx) => {
    const start = Number((idx * segment).toFixed(2));
    const rawEnd =
      idx === lines.length - 1
        ? totalDuration
        : Number(Math.min(totalDuration, (idx + 1) * segment).toFixed(2));

    const end = Number(Math.max(start + 0.35, rawEnd).toFixed(2));

    return {
      start,
      end,
      text: line,
      emphasis: idx === 0 || idx === lines.length - 1 ? "strong" : "normal",
    };
  });
}

function normalizeVoiceTimeline(
  voiceTimeline: any,
  script: string,
  totalDuration: number
): VoiceTimelineEntry[] {
  const safeScript = compressScriptToDuration(script, totalDuration);

  const lines = safeString(safeScript)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (Array.isArray(voiceTimeline) && voiceTimeline.length > 0) {
    const cleaned = voiceTimeline
      .map((entry: any) => {
        const start = Number(entry?.start);
        const end = Number(entry?.end);
        const text = safeString(entry?.text);

        if (!Number.isFinite(start) || !Number.isFinite(end) || !text) return null;

        return {
          start: Number(Math.max(0, Math.min(totalDuration - 0.1, start)).toFixed(2)),
          end: Number(Math.max(0.1, Math.min(totalDuration, end)).toFixed(2)),
          text,
          emphasis:
            entry?.emphasis === "normal" ||
            entry?.emphasis === "strong" ||
            entry?.emphasis === "whisper"
              ? entry.emphasis
              : "normal",
        } as VoiceTimelineEntry;
      })
      .filter(Boolean) as VoiceTimelineEntry[];

    if (cleaned.length > 0) {
      const normalized = cleaned.map((entry, idx) => {
        const next = cleaned[idx + 1];
        const safeEnd =
          next && entry.end > next.start
            ? Number(Math.max(entry.start + 0.2, next.start - 0.05).toFixed(2))
            : entry.end;

        return {
          ...entry,
          end: Number(Math.min(totalDuration, Math.max(entry.start + 0.2, safeEnd)).toFixed(2)),
        };
      });

      const totalVoiceWords = wordCount(normalized.map((x) => x.text).join(" "));
      if (totalVoiceWords <= getMaxWordsForDuration(totalDuration)) {
        return normalized;
      }
    }
  }

  return buildVoiceTimelineFromLines(lines, totalDuration);
}

function buildMusicPlanFallback(params: {
  offerMeta: OfferMetaInput;
  genre: string;
  tone: string;
  nicheDescription: string;
  videoLength: number;
  beatMap: BeatMark[];
  freedomRecurring: boolean;
}) {
  const mode = getSafeOfferMode(params.offerMeta?.mode);
  const offerName = safeString(params.offerMeta?.name, "Main offer");
  const category = safeString(params.offerMeta?.category, "digital business");
  const niche = safeString(params.nicheDescription, "online business");
  const genre = safeString(params.genre, "business");
  const tone = safeString(params.tone, "energetic");
  const videoLength = clampNumber(params.videoLength, 15, 15, 25);

  const trackType: MusicPlan["trackType"] =
    mode === "product"
      ? "hybrid"
      : mode === "funnel"
      ? "cinematic"
      : params.freedomRecurring
      ? "cinematic"
      : "corporate";

  const mood =
    mode === "product"
      ? "confident, sleek, modern, forward-moving"
      : mode === "funnel"
      ? "tense, strategic, premium, high-conversion"
      : params.freedomRecurring
      ? "aspirational, cinematic, premium, freedom-driven"
      : "ambitious, premium, motivational, tech-founder";

  const bpmHint =
    mode === "product" ? 112 : mode === "funnel" ? 118 : params.freedomRecurring ? 104 : 108;

  const beatMarkers: MusicPlanMarker[] = params.beatMap.map((b) => ({
    time: Number(b.time.toFixed(2)),
    action:
      b.type === "drop"
        ? "drop"
        : b.type === "transition"
        ? "transition"
        : b.type === "soft"
        ? "lift"
        : "hit",
    intensity: b.intensity,
  }));

  return {
    mode: "auto" as const,
    musicPrompt: [
      `${trackType} soundtrack for a ${videoLength}s vertical short-form reel.`,
      `Genre feel: ${genre}. Tone: ${tone}.`,
      `Offer mode: ${mode}. Offer: ${offerName}. Category: ${category}. Audience: ${niche}.`,
      `Mood: ${mood}.`,
      params.freedomRecurring
        ? "Blend ambition, freedom, momentum and premium lifestyle energy without sounding cheesy."
        : "Must start fast, support hook immediately, build through tension,",
      "lift at the reveal, stay clean under voiceover, and end with a satisfying CTA resolve.",
      "No dead intro. No long ambient drift. Keep it premium and edit-friendly.",
    ].join(" "),
    trackType,
    mood,
    energyStart: mode === "funnel" ? 72 : params.freedomRecurring ? 64 : 68,
    energyPeak: mode === "product" ? 90 : mode === "funnel" ? 94 : params.freedomRecurring ? 89 : 88,
    bpmHint,
    useBeatMarkers: true,
    beatMarkers,
    fadeOutStart: Number(Math.max(videoLength - 1.2, 0.8).toFixed(2)),
    shouldDuckUnderVoice: true,
  };
}

function normalizeMusicPlan(
  musicPlan: any,
  fallback: MusicPlan,
  beatMap: BeatMark[],
  totalDuration: number
): MusicPlan {
  const safeTrackType: MusicPlan["trackType"] =
    musicPlan?.trackType === "cinematic" ||
    musicPlan?.trackType === "trap" ||
    musicPlan?.trackType === "ambient" ||
    musicPlan?.trackType === "corporate" ||
    musicPlan?.trackType === "hybrid"
      ? musicPlan.trackType
      : fallback.trackType;

  const safeBeatMarkers: MusicPlanMarker[] = Array.isArray(musicPlan?.beatMarkers)
    ? musicPlan.beatMarkers
        .map((m: any) => {
          const time = Number(m?.time);
          if (!Number.isFinite(time)) return null;

          return {
            time: Number(Math.max(0, Math.min(totalDuration - 0.1, time)).toFixed(2)),
            action:
              m?.action === "hit" ||
              m?.action === "lift" ||
              m?.action === "transition" ||
              m?.action === "drop" ||
              m?.action === "resolve"
                ? m.action
                : "hit",
            intensity:
              m?.intensity === "low" ||
              m?.intensity === "medium" ||
              m?.intensity === "high"
                ? m.intensity
                : "medium",
          } as MusicPlanMarker;
        })
        .filter(Boolean)
    : [];

  const syncedBeatMarkers =
    safeBeatMarkers.length >= 4
      ? safeBeatMarkers
      : beatMap.map((b, idx, arr) => ({
          time: Number(b.time.toFixed(2)),
          action:
            idx === arr.length - 1
              ? "resolve"
              : b.type === "drop"
              ? "drop"
              : b.type === "transition"
              ? "transition"
              : b.type === "soft"
              ? "lift"
              : "hit",
          intensity: b.intensity,
        }));

  return {
    mode: "auto",
    musicPrompt: safeString(musicPlan?.musicPrompt, fallback.musicPrompt),
    trackType: safeTrackType,
    mood: safeString(musicPlan?.mood, fallback.mood),
    energyStart: clampNumber(musicPlan?.energyStart, fallback.energyStart, 20, 100),
    energyPeak: clampNumber(musicPlan?.energyPeak, fallback.energyPeak, 30, 100),
    bpmHint: clampNumber(musicPlan?.bpmHint, fallback.bpmHint, 70, 160),
    useBeatMarkers:
      typeof musicPlan?.useBeatMarkers === "boolean"
        ? musicPlan.useBeatMarkers
        : fallback.useBeatMarkers,
    beatMarkers: (syncedBeatMarkers || []).map((marker) => ({
      time: Number(marker?.time || 0),
      action: (
        marker?.action === "transition" ||
        marker?.action === "drop" ||
        marker?.action === "hit" ||
        marker?.action === "lift" ||
        marker?.action === "resolve"
          ? marker.action
          : "transition"
      ) as "transition" | "drop" | "hit" | "lift" | "resolve",
      intensity: (
        marker?.intensity === "low" ||
        marker?.intensity === "medium" ||
        marker?.intensity === "high"
          ? marker.intensity
          : "medium"
      ) as "low" | "medium" | "high",
    })),
    fadeOutStart: clampNumber(
      musicPlan?.fadeOutStart,
      fallback.fadeOutStart,
      Math.max(totalDuration - 3, 0.5),
      totalDuration
    ),
    shouldDuckUnderVoice:
      typeof musicPlan?.shouldDuckUnderVoice === "boolean"
        ? musicPlan.shouldDuckUnderVoice
        : true,
  };
}

function ensureMinSocialHints(parsed: any, offerMode?: string) {
  parsed.socialHints = parsed.socialHints || {};

  parsed.socialHints.hashtags = Array.isArray(parsed.socialHints.hashtags)
    ? parsed.socialHints.hashtags.filter(Boolean)
    : [];
  parsed.socialHints.titleIdeas = Array.isArray(parsed.socialHints.titleIdeas)
    ? parsed.socialHints.titleIdeas.filter(Boolean)
    : [];
  parsed.socialHints.captionIdeas = Array.isArray(parsed.socialHints.captionIdeas)
    ? parsed.socialHints.captionIdeas.filter(Boolean)
    : [];
  parsed.socialHints.postingTimes = Array.isArray(parsed.socialHints.postingTimes)
    ? parsed.socialHints.postingTimes.filter(Boolean)
    : [];
  parsed.socialHints.ctaIdeas =
    Array.isArray(parsed.socialHints.ctaIdeas) && parsed.socialHints.ctaIdeas.length > 0
      ? parsed.socialHints.ctaIdeas.filter(Boolean)
      : [];

  const mode = getSafeOfferMode(offerMode);

  const hashtagPool =
    mode === "product"
      ? [
          "#productivity",
          "#digitaltools",
          "#workflow",
          "#contentcreator",
          "#businesstools",
          "#creatorbusiness",
          "#onlinebusiness",
          "#automation",
          "#smarttools",
          "#growthtools",
        ]
      : mode === "funnel"
      ? [
          "#salesfunnel",
          "#conversion",
          "#landingpage",
          "#leadgeneration",
          "#digitalmarketing",
          "#marketingstrategy",
          "#onlinebusiness",
          "#growthmarketing",
          "#salessystem",
          "#automation",
        ]
      : [
          "#recurringincome",
          "#onlinebusiness",
          "#affiliatemarketing",
          "#digitalincome",
          "#creatorbusiness",
          "#automation",
          "#businesssystems",
          "#makemoneyonline",
          "#growthmindset",
          "#entrepreneurship",
        ];

  while (parsed.socialHints.hashtags.length < 10) {
    parsed.socialHints.hashtags.push(
      hashtagPool[parsed.socialHints.hashtags.length % hashtagPool.length]
    );
  }

  const titlePool =
    mode === "product"
      ? [
          "Why the old way feels slower",
          "The smarter tool shift",
          "What makes this workflow easier",
        ]
      : mode === "funnel"
      ? [
          "Your funnel may be leaking here",
          "Traffic is not the real issue",
          "The smarter conversion path",
        ]
      : [
          "Most people build income backwards",
          "The smarter way to build leverage",
          "Why recurring changes the game",
        ];

  while (parsed.socialHints.titleIdeas.length < 3) {
    parsed.socialHints.titleIdeas.push(
      titlePool[parsed.socialHints.titleIdeas.length % titlePool.length]
    );
  }

  const captionPool =
    mode === "product"
      ? [
          "A lot of people keep using the old way because it feels normal. The smarter move is usually cleaner, faster and easier to repeat.",
          "When a workflow feels heavier than it should, the real answer is not always more effort. Sometimes it is a better tool.",
          "The biggest difference is usually not hype. It is how much easier the right setup makes the result feel.",
        ]
      : mode === "funnel"
      ? [
          "A weak funnel can waste great traffic without making it obvious. The path matters more than people think.",
          "If people click but do not move, the issue is often not attention. It is the structure after the click.",
          "Better conversion usually starts with a cleaner journey, better flow and fewer leaks.",
        ]
      : [
          "Too many people build around one-off wins and wonder why everything keeps resetting. The smarter path is leverage.",
          "When momentum disappears after every result, the model is usually the problem, not your effort.",
          "The goal is not just working harder. It is building something that can keep moving after today.",
        ];

  while (parsed.socialHints.captionIdeas.length < 3) {
    parsed.socialHints.captionIdeas.push(
      captionPool[parsed.socialHints.captionIdeas.length % captionPool.length]
    );
  }

  while (parsed.socialHints.postingTimes.length < 3) {
    parsed.socialHints.postingTimes.push(
      ["08:00", "12:30", "19:00"][parsed.socialHints.postingTimes.length % 3]
    );
  }

  const ctaPool =
    mode === "product"
      ? [
          "Tap the link and see the better workflow.",
          "Check the link and see how the smarter setup works.",
          "Tap through and see what makes this easier.",
        ]
      : mode === "funnel"
      ? [
          "Tap the link and see how to fix the flow.",
          "Check the link and see the smarter conversion path.",
          "Tap through and see where the results improve.",
        ]
      : [
          "Tap the link and start building the smarter model.",
          "Check the link and see the long-term version.",
          "Tap through and start building with more leverage.",
        ];

  while (parsed.socialHints.ctaIdeas.length < 3) {
    parsed.socialHints.ctaIdeas.push(
      ctaPool[parsed.socialHints.ctaIdeas.length % ctaPool.length]
    );
  }
}

function normalizeStoryboard(
  storyboard: any,
  fallbackStoryboard: StoryboardFrame[],
  totalDuration: number,
  scenes?: ExportTimelineScene[]
): StoryboardFrame[] {
  const cleaned: StoryboardFrame[] = Array.isArray(storyboard)
    ? storyboard
        .map((item: any, idx: number): StoryboardFrame | null => {
          const time = Number(item?.time);
          const description = safeString(item?.description);
          const visualCue = safeString(item?.visualCue);

          if (!description) return null;

          const scene = Array.isArray(scenes) ? scenes[idx] : null;

          return {
            time: Number.isFinite(time)
              ? Math.max(0, Math.min(totalDuration, time))
              : scene?.start ?? fallbackStoryboard[idx]?.time ?? 0,
            description:
              description ||
              scene?.label ||
              fallbackStoryboard[idx]?.description ||
              "Story progression beat",
            visualCue:
              visualCue ||
              scene?.overlayText ||
              fallbackStoryboard[idx]?.visualCue ||
              "clean visual shift",
          };
        })
        .filter((item): item is StoryboardFrame => item !== null)
    : [];

  const base = cleaned.length ? cleaned.slice(0, 7) : fallbackStoryboard.slice(0, 7);

  if (!Array.isArray(scenes) || scenes.length === 0) {
    return base;
  }

  return scenes.slice(0, 7).map((scene, idx) => ({
    time: Number((scene.start ?? base[idx]?.time ?? 0).toFixed(2)),
    description:
      base[idx]?.description ||
      fallbackStoryboard[idx]?.description ||
      scene.label ||
      `Scene ${idx + 1}`,
    visualCue:
      base[idx]?.visualCue ||
      scene.overlayText ||
      fallbackStoryboard[idx]?.visualCue ||
      "clean visual shift",
  }));
}

function ensureSceneCountAndStructure(params: {
  scenes: any[];
  fallbackScenes: ExportTimelineScene[];
  totalDuration: number;
  mediaType: "mixed" | "video" | "stills";
}) {
  const { scenes, fallbackScenes, totalDuration } = params;
  const targetCount = getTargetSceneCount(totalDuration);

  const cleaned: ExportTimelineScene[] = Array.isArray(scenes)
    ? scenes
        .map((scene: any, idx: number) => {
          const fb = fallbackScenes[idx] || fallbackScenes[fallbackScenes.length - 1];

          const start = Number.isFinite(Number(scene?.start)) ? Number(scene.start) : fb.start;
          const end = Number.isFinite(Number(scene?.end)) ? Number(scene.end) : fb.end;
          const label = safeString(scene?.label, fb.label);
          const overlayText = safeString(scene?.overlayText, fb.overlayText || "");
          const mediaHint =
            scene?.mediaHint === "image" ||
            scene?.mediaHint === "video" ||
            scene?.mediaHint === "mixed"
              ? scene.mediaHint
              : fb.mediaHint;
          const sceneHint =
            scene?.sceneHint === "hook" ||
            scene?.sceneHint === "problem" ||
            scene?.sceneHint === "solution" ||
            scene?.sceneHint === "proof" ||
            scene?.sceneHint === "payoff" ||
            scene?.sceneHint === "cta"
              ? scene.sceneHint
              : fb.sceneHint;

          return {
            index: idx,
            start,
            end,
            label,
            mediaHint,
            overlayText,
            sceneHint,
          } as ExportTimelineScene;
        })
        .filter(Boolean)
    : [];

  let baseScenes = cleaned;

  const hasMinimum = baseScenes.length >= targetCount;
  const sceneHints = baseScenes.map((s) => s.sceneHint);
  const hasHook = sceneHints.includes("hook");
  const hasSolution = sceneHints.includes("solution");
  const hasCta = sceneHints.includes("cta");

  if (!hasMinimum || !hasHook || !hasSolution || !hasCta) {
    baseScenes = fallbackScenes.slice(0, targetCount);
  } else {
    baseScenes = baseScenes.slice(0, targetCount);

    while (baseScenes.length < targetCount) {
      const fb = fallbackScenes[baseScenes.length] || fallbackScenes[fallbackScenes.length - 1];
      baseScenes.push({
        ...fb,
        index: baseScenes.length,
      });
    }
  }

  const durationPerScene = totalDuration / targetCount;

  const rebuilt = baseScenes.map((scene, idx) => {
    const fb = fallbackScenes[idx] || fallbackScenes[fallbackScenes.length - 1];

    const start = Number((idx * durationPerScene).toFixed(2));
    const rawEnd =
      idx === targetCount - 1
        ? totalDuration
        : Number(((idx + 1) * durationPerScene).toFixed(2));
    const end = Number(Math.max(start + 0.35, rawEnd).toFixed(2));

    return {
      index: idx,
      start,
      end,
      label: safeString(scene.label, fb.label),
      mediaHint: scene.mediaHint || fb.mediaHint,
      overlayText: safeString(scene.overlayText, fb.overlayText || ""),
      sceneHint: scene.sceneHint || fb.sceneHint,
    } as ExportTimelineScene;
  });

  return rebuilt;
}

function buildMediaQuery(params: {
  offerMeta: OfferMetaInput;
  genre: string;
  tone: string;
  nicheDescription: string;
  freedomRecurring: boolean;
}) {
  const mode = getSafeOfferMode(params.offerMeta?.mode);
  const name = safeString(params.offerMeta?.name, "");
  const category = safeString(params.offerMeta?.category, "");
  const genre = safeString(params.genre, "business");
  const tone = safeString(params.tone, "energetic");
  const niche = safeString(params.nicheDescription, "online business");

  const baseContext = `${genre} ${tone} ${niche}`.trim();

  if (mode === "product") {
    return [
      name,
      category,
      "modern workflow",
      "digital tool",
      "creator setup",
      "product demo",
      "hands using tool",
      "before after improvement",
      "clean result",
      baseContext,
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (mode === "funnel") {
    return [
      name,
      category,
      "landing page",
      "conversion dashboard",
      "marketing analytics",
      "sales funnel",
      "website clicks",
      "lead generation",
      "performance marketing",
      baseContext,
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (params.freedomRecurring) {
    return [
      name,
      category,
      "digital nomad",
      "remote work mountains",
      "laptop beach lifestyle",
      "travel entrepreneur",
      "work from anywhere nature",
      "freedom lifestyle",
      "online business travel",
      "premium creator freedom",
      "sunset laptop",
      "mountain remote work",
      "beach laptop entrepreneur",
      "ocean sunrise remote work",
      "luxury freedom nature creator",
      baseContext,
    ]
      .filter(Boolean)
      .join(" ");
  }

  return [
    name,
    category,
    "saas dashboard",
    "startup workspace",
    "automation",
    "online business",
    "creator at laptop",
    "growth analytics",
    "recurring revenue",
    baseContext,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildTimelinePreview(scenes: ExportTimelineScene[]) {
  return (Array.isArray(scenes) ? scenes : []).map((s: any) => {
    const hint = typeof s.sceneHint === "string" ? ` / ${s.sceneHint}` : "";
    return `Scene ${s.index + 1}: ${s.label}${hint} (${s.start}–${s.end}s)`;
  });
}

function buildDefaultAIBreakdown(params: {
  parsed: any;
  videoLength: number;
  genre: string;
  storyFormat: string;
  offerMetaInput: OfferMetaInput;
  fallbackCta: string;
  freedomRecurring: boolean;
}) {
  const { parsed, videoLength, genre, storyFormat, offerMetaInput, fallbackCta, freedomRecurring } = params;

  const scriptLines = safeString(parsed?.script)
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

  const primaryHookLine =
    scriptLines[0] ||
    parsed?.hookIntelligence?.angle ||
    "Pattern-break hook in the first 3 seconds.";

  const secondaryHookLine =
    scriptLines[1] ||
    parsed?.hookIntelligence?.promise ||
    "Clear promise of what the viewer will get.";

  const defaultEmotionalDrivers = freedomRecurring
    ? [
        "Curiosity about a smarter freedom-first model",
        "Tension around working hard but restarting again",
        "Desire for leverage, momentum and location freedom",
        "Relief from unstable one-off effort",
      ]
    : [
        "Curiosity about the better method",
        "Tension around wasting time or results",
        "Desire for a cleaner smarter setup",
        "Relief from friction, confusion or instability",
      ];

  const defaultRecommendations = [
    "Make the first line hit even harder in the first 1-2 seconds.",
    "Use a clear visual switch when the reveal happens.",
    "Make Scene 2 and Scene 3 visually different, not just different text.",
    "Show payoff before the CTA so the final action feels earned.",
    "Match the spoken CTA with the on-screen CTA for a stronger finish.",
  ];

  const fallbackHeatValues: { label: string; score: number }[] = [
    { label: "Hook moment", score: 92 },
    { label: "Problem tension", score: 81 },
    { label: "Reveal shift", score: 88 },
    { label: "Final CTA punch", score: 86 },
  ];

  const rawHeat = Array.isArray(parsed?.aiBreakdown?.heatValues)
    ? parsed.aiBreakdown.heatValues
    : [];

  const normalizedHeatValues: { label: string; score: number }[] =
    rawHeat.length > 0
      ? rawHeat.map((h: any, idx: number) => ({
          label:
            typeof h?.label === "string" && h.label.trim()
              ? h.label
              : `Key moment ${idx + 1}`,
          score: clampScore(h?.score ?? h?.value, 70),
        }))
      : fallbackHeatValues;

  const pacing =
    Array.isArray(parsed?.aiBreakdown?.pacing) && parsed.aiBreakdown.pacing.length > 0
      ? parsed.aiBreakdown.pacing
      : Array.isArray(parsed?.exportTimeline?.scenes)
      ? parsed.exportTimeline.scenes.map((s: any) => ({
          time: s.start ?? 0,
          label: s.label ?? `Scene ${s.index}`,
          intensity:
            s.sceneHint === "hook" || s.sceneHint === "solution" || s.sceneHint === "cta"
              ? "high"
              : "medium",
        }))
      : [];

  return {
    scriptSummary:
      parsed?.aiBreakdown?.scriptSummary ||
      `AI analyzed your ${videoLength}s ${genre} reel in "${storyFormat}" format with ${
        Array.isArray(parsed?.exportTimeline?.scenes)
          ? parsed.exportTimeline.scenes.length
          : 0
      } scenes and ${(parsed?.subtitles || []).length} subtitle lines.`,
    hooks:
      Array.isArray(parsed?.aiBreakdown?.hooks) && parsed.aiBreakdown.hooks.length > 0
        ? parsed.aiBreakdown.hooks
        : [primaryHookLine, secondaryHookLine].filter(Boolean),
    pacing,
    cta: parsed?.aiBreakdown?.cta || parsed?.cta || fallbackCta,
    emotionalDrivers:
      Array.isArray(parsed?.aiBreakdown?.emotionalDrivers) &&
      parsed.aiBreakdown.emotionalDrivers.length > 0
        ? parsed.aiBreakdown.emotionalDrivers
        : defaultEmotionalDrivers,
    recommendations:
      Array.isArray(parsed?.aiBreakdown?.recommendations) &&
      parsed.aiBreakdown.recommendations.length > 0
        ? parsed.aiBreakdown.recommendations
        : defaultRecommendations,
    heatValues: normalizedHeatValues,
  } as AIBreakdown;
}

function hardenParsedResponse(params: {
  parsed: any;
  body: GenerateBody;
  genre: string;
  tone: string;
  storyFormat: string;
  videoLength: number;
  mediaType: "mixed" | "video" | "stills";
  nicheDescription: string;
  offerMetaInput: OfferMetaInput;
  selectedOfferResolved: OfferMeta;
  mediaFiles: any[];
  freedomRecurring: boolean;
  mediaQuery: string;
  generationId: string;
  scriptAngle: ScriptAngle;
  smartRenderMaxSegments: number;
}) {
  const {
    parsed,
    body,
    genre,
    tone,
    storyFormat,
    videoLength,
    mediaType,
    nicheDescription,
    offerMetaInput,
    selectedOfferResolved,
    mediaFiles,
    freedomRecurring,
    mediaQuery,
    generationId,
    scriptAngle,
    smartRenderMaxSegments,
  } = params;

  const fallbackScript = buildFallbackScript({
    offerMeta: offerMetaInput,
    videoLength,
    nicheDescription,
    freedomRecurring,
    scriptAngle,
  });

  const fallbackStoryboard = buildFallbackStoryboard({
    offerMeta: offerMetaInput,
    videoLength,
    freedomRecurring,
  });

  const fallbackCta = buildFallbackCta({
    offerMeta: offerMetaInput,
    freedomRecurring,
  });

  const fallbackScenes = buildDefaultScenePlan(videoLength, mediaType, offerMetaInput?.mode);
  const thumbnailFallback = buildThumbnailFallback({
    genre,
    tone,
    offerMeta: offerMetaInput,
    nicheDescription,
    freedomRecurring,
  });

  ensureMinSocialHints(parsed, offerMetaInput?.mode);

  parsed.offerMeta = offerMetaToResolvedOffer({
    name: safeString(parsed.offerMeta?.name, selectedOfferResolved.name),
    mode: safeString(parsed.offerMeta?.mode, selectedOfferResolved.mode),
    commissionRate: safeString(parsed.offerMeta?.commissionRate, selectedOfferResolved.commissionRate),
    epc: typeof parsed.offerMeta?.epc === "number" ? parsed.offerMeta.epc : selectedOfferResolved.epc,
    category: safeString(parsed.offerMeta?.category, selectedOfferResolved.category),
    affiliateUrl: safeString(parsed.offerMeta?.affiliateUrl, selectedOfferResolved.affiliateUrl),
  });

  parsed.selectedOffer = { ...parsed.offerMeta };

  if (!parsed.exportTimeline) {
    parsed.exportTimeline = {
      totalDuration: videoLength,
      scenes: fallbackScenes,
    };
  } else {
    parsed.exportTimeline.totalDuration = videoLength;
    parsed.exportTimeline.scenes = Array.isArray(parsed.exportTimeline.scenes)
      ? parsed.exportTimeline.scenes
      : [];
  }

  parsed.exportTimeline.scenes = ensureSceneCountAndStructure({
    scenes: parsed.exportTimeline.scenes,
    fallbackScenes,
    totalDuration: videoLength,
    mediaType,
  });

  parsed.beatMap = normalizeBeatMap(
    parsed.beatMap,
    videoLength,
    Array.isArray(parsed.exportTimeline?.scenes) ? parsed.exportTimeline.scenes : []
  );

  const fallbackMusicPlan = buildMusicPlanFallback({
    offerMeta: offerMetaInput,
    genre,
    tone,
    nicheDescription,
    videoLength,
    beatMap: parsed.beatMap,
    freedomRecurring,
  });

  parsed.musicPlan = normalizeMusicPlan(
    parsed.musicPlan,
    fallbackMusicPlan,
    parsed.beatMap,
    videoLength
  );

  parsed.mediaFiles = Array.isArray(mediaFiles) ? mediaFiles : [];
  parsed.freedomRecurring = freedomRecurring;
  parsed.mediaQuery = mediaQuery;

  if (!parsed.script || typeof parsed.script !== "string" || !parsed.script.trim()) {
    parsed.script = fallbackScript;
  }

  parsed.script = compressScriptToDuration(parsed.script, videoLength);

  if (isWeakOrGenericScript(parsed.script, offerMetaInput?.mode, offerMetaInput?.name)) {
    parsed.script = compressScriptToDuration(fallbackScript, videoLength);
  }

  if (!parsed.script.trim()) {
    parsed.script = compressScriptToDuration(fallbackScript, videoLength);
  }

  const scriptLines = parsed.script
    .split("\n")
    .map((l: string) => l.trim())
    .filter(Boolean);

  parsed.subtitles = scriptLines.length
    ? scriptLines
    : compressScriptToDuration(fallbackScript, videoLength)
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

  parsed.voiceTimeline = normalizeVoiceTimeline(parsed.voiceTimeline, parsed.script, videoLength);

  parsed.storyboard = normalizeStoryboard(
    parsed.storyboard,
    fallbackStoryboard,
    videoLength,
    parsed.exportTimeline?.scenes
  );

  if (!Array.isArray(parsed.storyboard) || parsed.storyboard.length === 0) {
    parsed.storyboard = normalizeStoryboard(
      fallbackStoryboard,
      fallbackStoryboard,
      videoLength,
      parsed.exportTimeline?.scenes
    );
  }

  parsed.thumbnailIntelligence = parsed.thumbnailIntelligence || {
    finalPrompt: "",
    emotion: "",
    focalPoint: "",
    colorPalette: [],
    ctaStyle: "",
    hookPower: "",
  };

  if (
    !parsed.thumbnailIntelligence.finalPrompt ||
    typeof parsed.thumbnailIntelligence.finalPrompt !== "string" ||
    parsed.thumbnailIntelligence.finalPrompt.trim().length < 20 ||
    isGenericThumbnailPrompt(
      parsed.thumbnailIntelligence.finalPrompt,
      offerMetaInput?.mode,
      freedomRecurring
    )
  ) {
    parsed.thumbnailIntelligence.finalPrompt = thumbnailFallback.finalPrompt;
  }

  if (
    !parsed.thumbnailIntelligence.emotion ||
    typeof parsed.thumbnailIntelligence.emotion !== "string"
  ) {
    parsed.thumbnailIntelligence.emotion = thumbnailFallback.emotion;
  }

  if (
    !parsed.thumbnailIntelligence.focalPoint ||
    typeof parsed.thumbnailIntelligence.focalPoint !== "string"
  ) {
    parsed.thumbnailIntelligence.focalPoint = thumbnailFallback.focalPoint;
  }

  if (
    !Array.isArray(parsed.thumbnailIntelligence.colorPalette) ||
    parsed.thumbnailIntelligence.colorPalette.length < 2
  ) {
    parsed.thumbnailIntelligence.colorPalette = thumbnailFallback.colorPalette;
  }

  if (
    !parsed.thumbnailIntelligence.ctaStyle ||
    typeof parsed.thumbnailIntelligence.ctaStyle !== "string"
  ) {
    parsed.thumbnailIntelligence.ctaStyle = thumbnailFallback.ctaStyle;
  }

  if (
    !parsed.thumbnailIntelligence.hookPower ||
    typeof parsed.thumbnailIntelligence.hookPower !== "string"
  ) {
    parsed.thumbnailIntelligence.hookPower = thumbnailFallback.hookPower;
  }

  if (
    !parsed.thumbnailIntelligence.layoutNotes ||
    typeof parsed.thumbnailIntelligence.layoutNotes !== "string"
  ) {
    parsed.thumbnailIntelligence.layoutNotes = thumbnailFallback.layoutNotes;
  }

  if (
    !parsed.thumbnailIntelligence.faceEmotion ||
    typeof parsed.thumbnailIntelligence.faceEmotion !== "string"
  ) {
    parsed.thumbnailIntelligence.faceEmotion = thumbnailFallback.faceEmotion;
  }

  if (
    !parsed.thumbnailIntelligence.hookAngle ||
    typeof parsed.thumbnailIntelligence.hookAngle !== "string"
  ) {
    parsed.thumbnailIntelligence.hookAngle = thumbnailFallback.hookAngle;
  }

  if (!parsed.cta || typeof parsed.cta !== "string" || !parsed.cta.trim()) {
    parsed.cta = fallbackCta;
  }

  if (parsed.ctaIntelligence && typeof parsed.ctaIntelligence !== "object") {
    parsed.ctaIntelligence = {};
  }

  if (!parsed.ctaIntelligence || typeof parsed.ctaIntelligence !== "object") {
    parsed.ctaIntelligence = {};
  }

  const clarity = parsed.ctaIntelligence.clarityScore;
  if (typeof clarity === "number") {
    if (clarity > 10) parsed.ctaIntelligence.clarityScore = Math.round(clarity / 10);
    if ((parsed.ctaIntelligence.clarityScore || 0) > 10) parsed.ctaIntelligence.clarityScore = 10;
    if ((parsed.ctaIntelligence.clarityScore || 0) < 1) parsed.ctaIntelligence.clarityScore = 1;
  } else {
    parsed.ctaIntelligence.clarityScore = 9;
  }

  if (
    !parsed.ctaIntelligence.finalCtaLine ||
    typeof parsed.ctaIntelligence.finalCtaLine !== "string"
  ) {
    parsed.ctaIntelligence.finalCtaLine = parsed.cta;
  }

  if (!parsed.hookIntelligence || typeof parsed.hookIntelligence !== "object") {
    parsed.hookIntelligence = {
      angle: "direct benefit",
      promise: "clear result",
      patternBreak: "unexpected opener",
      tension: "what viewer loses if ignored",
      curiosity: "question that forces attention",
    };
  }

  parsed.aiBreakdown = buildDefaultAIBreakdown({
    parsed,
    videoLength,
    genre,
    storyFormat,
    offerMetaInput,
    fallbackCta,
    freedomRecurring,
  });

  parsed.timelinePreview = buildTimelinePreview(parsed.exportTimeline.scenes || []);

  parsed.renderHints = {
    ...(typeof parsed.renderHints === "object" && parsed.renderHints ? parsed.renderHints : {}),
    offerMode: parsed.offerMeta?.mode || selectedOfferResolved.mode,
    offerName: parsed.offerMeta?.name || selectedOfferResolved.name,
    offerCategory: parsed.offerMeta?.category || selectedOfferResolved.category,
    freedomRecurring,
    forceNatureFreedomClip: freedomRecurring,
    maxSegments: smartRenderMaxSegments,
    mediaQuery,
    generationId,
    scriptAngle,
    clipStrategy: freedomRecurring
      ? "freedom-journey-problem-solution-payoff"
      : parsed.offerMeta?.mode === "product"
      ? "product-demo-proof-payoff"
      : parsed.offerMeta?.mode === "funnel"
      ? "problem-funnel-conversion-payoff"
      : "problem-solution-payoff",
    preferNatureFreedomFirst: freedomRecurring,
    avoidOfficeBusinessVisuals: freedomRecurring,
    selectedOffer: {
      name: parsed.offerMeta?.name || selectedOfferResolved.name,
      mode: parsed.offerMeta?.mode || selectedOfferResolved.mode,
      category: parsed.offerMeta?.category || selectedOfferResolved.category,
      commissionRate:
        parsed.offerMeta?.commissionRate || selectedOfferResolved.commissionRate,
      affiliateUrl: parsed.offerMeta?.affiliateUrl || selectedOfferResolved.affiliateUrl,
      epc:
        typeof parsed.offerMeta?.epc === "number"
          ? parsed.offerMeta.epc
          : selectedOfferResolved.epc,
    },
  };

  return parsed;
}

/* -------------------------------------------------
  ROUTE
--------------------------------------------------- */

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GenerateBody;

    const genre = safeString(body.genre, "motivation");
    const tone = safeString(body.tone, "energetic");
    const storyFormat = safeString(body.storyFormat, "hook-story-cta");
    const videoLength = clampNumber(body.videoLength ?? 15, 15, 15, 25);
    const mode = body.mode || "manual";
    const mediaType = body.mediaType || "mixed";
    const nicheDescription = safeString(body.nicheDescription, "");

    const rawOfferMeta: OfferMetaInput | SelectedOfferInput | undefined | null =
      body.offerMeta ?? body.selectedOffer ?? null;

    const offerMetaInput = normalizeOfferMetaInput(rawOfferMeta);
    const selectedOfferResolved = offerMetaToResolvedOffer(offerMetaInput);
    const freedomRecurring = looksLikeFreedomRecurring(body, offerMetaInput);

    const generationId =
      body.generationId || `${Date.now()}_${Math.random().toString(16).slice(2)}`;

    const scriptAngle = resolveScriptAngle({
      generationId,
      offerMetaInput,
      freedomRecurring,
    });

    const smartRenderMaxSegments = resolveSmartRenderMaxSegments({
      offerMode: offerMetaInput?.mode,
      freedomRecurring,
      videoLength,
      mediaType,
      storyFormat,
      genre,
    });

    console.log("[REELS GENERATE] Incoming request", {
      model: OPENAI_MODEL,
      genre,
      tone,
      storyFormat,
      videoLength,
      mode,
      mediaType,
      generationId,
      offerName: offerMetaInput?.name || null,
      offerMode: offerMetaInput?.mode || null,
      offerCategory: offerMetaInput?.category || null,
      freedomRecurring,
      scriptAngle,
      smartRenderMaxSegments,
    });

    const fallbackScript = buildFallbackScript({
      offerMeta: offerMetaInput,
      videoLength,
      nicheDescription,
      freedomRecurring,
      scriptAngle,
    });

    const fallbackStoryboard = buildFallbackStoryboard({
      offerMeta: offerMetaInput,
      videoLength,
      freedomRecurring,
    });

    const fallbackCta = buildFallbackCta({
      offerMeta: offerMetaInput,
      freedomRecurring,
    });

    const mediaQuery = buildMediaQuery({
      offerMeta: offerMetaInput,
      genre,
      tone,
      nicheDescription,
      freedomRecurring,
    });

    const baseUrl = getRequestBaseUrl(req);

    console.log("[REELS GENERATE] Media fetch start", {
      baseUrl,
      mediaQuery,
      mediaType,
      generationId,
      freedomRecurring,
      scriptAngle,
      smartRenderMaxSegments,
    });

    const mediaRes = await fetch(`${baseUrl}/api/media/fetch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: mediaQuery,
        type: mediaType,
        seed: generationId,
        freedomRecurring,
        forceNatureFreedomClip: freedomRecurring,
        offerMode: selectedOfferResolved.mode,
        offerMeta: selectedOfferResolved,
        selectedOffer: selectedOfferResolved,
        renderHints: {
          offerMode: selectedOfferResolved.mode,
          offerName: selectedOfferResolved.name,
          offerCategory: selectedOfferResolved.category,
          freedomRecurring,
          forceNatureFreedomClip: freedomRecurring,
          scriptAngle,
          maxSegments: smartRenderMaxSegments,
          clipStrategy: freedomRecurring
            ? "freedom-journey-problem-solution-payoff"
            : selectedOfferResolved.mode === "product"
            ? "product-demo-proof-payoff"
            : selectedOfferResolved.mode === "funnel"
            ? "problem-funnel-conversion-payoff"
            : "problem-solution-payoff",
          preferNatureFreedomFirst: freedomRecurring,
          avoidOfficeBusinessVisuals: freedomRecurring,
        },
      }),
      signal: createTimeoutSignal(45_000),
      cache: "no-store",
    });

    let mediaFiles: any[] = [];

    if (mediaRes.ok) {
      const mediaJson = await mediaRes.json().catch(() => null);

      console.log("[REELS GENERATE] Media fetch response", {
        ok: mediaRes.ok,
        status: mediaRes.status,
        hasJson: !!mediaJson,
      });

      if (mediaJson) {
        mediaFiles =
          (mediaJson?.results as any[]) ||
          (mediaJson?.combined as any[]) ||
          (mediaJson?.items as any[]) ||
          [];

        if (Array.isArray(mediaFiles)) {
          mediaFiles = mediaFiles.filter((m) => {
            if (!m || typeof m !== "object") return false;
            const url = resolveMediaUrl(m);
            return typeof url === "string" && /^https?:\/\//i.test(url);
          });

          mediaFiles = dedupeMedia(mediaFiles);

          if (freedomRecurring) {
            const strict = mediaFiles.filter(isStrictFreedomMedia);
            const hybrid = mediaFiles.filter(isFreedomHybridMedia);
            const lifestyle = mediaFiles.filter(isFreedomLifestyleMedia);

            console.log("[REELS GENERATE] Freedom media analysis", {
              total: mediaFiles.length,
              strict: strict.length,
              hybrid: hybrid.length,
              lifestyle: lifestyle.length,
              strictSample: strict.slice(0, 5).map((m) => ({
                title: m?.title || null,
                url: resolveMediaUrl(m),
                type: mediaTypeOf(m),
              })),
            });

            mediaFiles = prioritizeFreedomMedia(mediaFiles, 24);
          } else {
            mediaFiles = stableRotateMedia(
              mediaFiles.slice(0, 24),
              `${generationId}_${selectedOfferResolved.name}_${selectedOfferResolved.mode}_${scriptAngle}`
            );
          }
        }
      }
    } else {
      console.warn("[REELS GENERATE] Media fetch failed", {
        status: mediaRes.status,
        statusText: mediaRes.statusText,
      });
    }

    console.log("[REELS GENERATE] Media files after filtering", {
      count: Array.isArray(mediaFiles) ? mediaFiles.length : 0,
      freedomRecurring,
      scriptAngle,
      sample:
        Array.isArray(mediaFiles) && mediaFiles.length > 0
          ? mediaFiles.slice(0, 6).map((m) => ({
              source: m?.source || null,
              type: mediaTypeOf(m),
              title: m?.title || null,
              url: resolveMediaUrl(m),
            }))
          : [],
    });

    if (!mediaFiles.length) {
      console.warn("[REELS GENERATE] Using fallback media", {
        fallbackUrl: "https://public.autoaffi.com/fallback/fallback1.mp4",
      });

      mediaFiles = [
        {
          source: "fallback",
          url: "https://public.autoaffi.com/fallback/fallback1.mp4",
          thumb: "https://public.autoaffi.com/fallback/thumb1.jpg",
          duration: videoLength || 15,
          type: "video",
        },
      ];
    }

    const offerModeInstructions = getOfferModeInstructions(offerMetaInput?.mode);

    const storyArcInstructions = getStoryArcInstructions({
      offerMode: offerMetaInput?.mode,
      genre,
      tone,
      nicheDescription,
      offerName: offerMetaInput?.name || "Main offer",
      category: offerMetaInput?.category || "digital business",
      videoLength,
    });

    const hookExamples = getHookExamples(offerMetaInput?.mode, scriptAngle);
    const angleInstructions = getScriptAngleInstructions(
      scriptAngle,
      offerMetaInput?.mode,
      freedomRecurring
    );
    const targetSceneCount = getTargetSceneCount(videoLength);
    const maxWords = getMaxWordsForDuration(videoLength);

    const systemPrompt = `
You are Autoaffi VX 4.6 PRODUCTION LOCK — an elite Reels/Shorts generation engine.

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
- musicPlan
- hookIntelligence
- timelinePreview[]
- mediaFiles[]
- aiBreakdown {
   hooks[]
   pacing[]
   cta
   emotionalDrivers[]
   recommendations[]
   heatValues[]
 }

CORE RULES:
- Output ONLY valid JSON.
- Script must feel like native short-form spoken English.
- The first 1-2 seconds must hit immediately.
- The reel must follow a strong emotional-commercial arc: HOOK -> TENSION -> REVEAL -> PROOF -> PAYOFF -> CTA.
- The script must feel like ONE story with progression, not disconnected promo lines.
- The middle of the reel MUST introduce a shift, realization, reveal or breakthrough.
- Scene 2 and Scene 3 must NOT feel like the same point repeated.
- Scene 4 and Scene 5 must NOT feel like the same point repeated.
- Each scene must move the viewer forward emotionally and visually.
- The first line must sound like something a real creator would say, not a brand manager.
- Avoid vague lines like "this changes everything", "game changer", "take it to the next level", "unlock your potential", unless made highly specific.
- Avoid generic filler, fake-guru language and bland business clichés.
- CTA must feel earned and natural, not pasted on.
- The final line should feel like a real spoken CTA in a reel.
- Thumbnail must be cinematic and include subject emotion + text.
- finalPrompt MUST be mode-specific and feel different for product, recurring and funnel.
- finalPrompt should reflect the emotional hook of the reel, not only the offer category.
- Avoid repeated generic thumbnail prompts.
- BeatMap min 6 items.
- VoiceTimeline must span full script.
- ExportTimeline totalDuration MUST be exactly ${videoLength}.
- Storyboard must go from 0 to ${videoLength}.
- SocialHints must contain at least 10 hashtags, 3 titleIdeas, 3 captionIdeas, 3 postingTimes, 3 ctaIdeas.
- mediaFiles[] should be preserved as the fetched media input.
- timelinePreview[] should summarize each scene simply.
- aiBreakdown must be human-readable and useful in UI.
- musicPlan must be synced to the story arc and beatMap.
- musicPlan should describe a premium non-lyrical background track that supports voiceover.
- musicPlan.beatMarkers should line up with important beatMap moments, reveal points and CTA finish.
- The reel must feel visually active with frequent switch moments.
- Avoid building the reel around only 2-3 media assets.
- Use multiple visual beats across the full video.
- Each scene should imply a fresh visual angle, cut or asset change.
- The result should feel like a premium short-form reel, not a static slideshow.

SCRIPT QUALITY RULES:
- Write in short-form spoken English.
- Make the hook sharp, human and scroll-stopping.
- Make the problem feel real.
- Make the reveal feel like an actual shift.
- Make the CTA feel aligned with the story.
- Every line should feel like it belongs in the same story.
- MAX WORDS for full spoken script: ${maxWords}
- Keep sentences short enough to be spoken comfortably inside ${videoLength} seconds.
- Do NOT make the voiceover too dense.
- Prefer tension, contrast and clarity over hype.
- Avoid repeating the offer name more than necessary.
- Do NOT write like a sales page.
- Do NOT make all lines the same length or same emotional weight.
- Make the script commercially strong, curiosity-inducing and compelling to cold viewers.
- The script should still feel sellable and click-worthy, not softer.
- The script angle must strongly influence the wording, progression and emotional framing.
- Do NOT produce the same generic script structure every time.

SCENE RULES:
- Use EXACTLY ${targetSceneCount} scenes.
- Every scene should have a short label, overlayText and mediaHint.
- sceneHint should be one of: hook, problem, solution, proof, payoff, cta
- Use this structure:
  ${
    targetSceneCount === 7
      ? "1) hook, 2) problem, 3) problem, 4) solution, 5) proof, 6) payoff, 7) cta"
      : "1) hook, 2) problem, 3) problem, 4) solution, 5) payoff, 6) cta"
  }
- Scene 2 and Scene 3 must feel different.
- Overlay text should be punchy and readable.
- Each scene should imply a new visual angle, not just a caption update.

HOOK STYLE EXAMPLES:
- ${hookExamples.join("\n- ")}

${offerModeInstructions}

${storyArcInstructions}

${angleInstructions}

Context:
Genre=${genre}
Tone=${tone}
StoryFormat=${storyFormat}
VideoLength=${videoLength}
Mode=${mode}
MediaType=${mediaType}
FreedomRecurring=${freedomRecurring}
ScriptAngle=${scriptAngle}
OfferMeta=${JSON.stringify(offerMetaInput, null, 2)}
Niche="${nicheDescription}"
MediaCount=${mediaFiles.length}
`.trim();

    const userPrompt = `
Generate ONE valid JSON object ONLY.

NO text before.
NO text after.
NO markdown.
NO comments.
`.trim();

    console.log("[REELS GENERATE] OpenAI request start", {
      model: OPENAI_MODEL,
      targetSceneCount,
      maxWords,
      mediaCount: mediaFiles.length,
      scriptAngle,
      smartRenderMaxSegments,
    });

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.95,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    let raw = completion.choices?.[0]?.message?.content || "";
    let parsed: any = null;

    console.log("[REELS GENERATE] OpenAI raw response", {
      hasContent: !!raw,
      rawLength: raw.length,
      preview: raw.slice(0, 300),
    });

    const tryParse = (txt: string) => {
      try {
        return JSON.parse(txt);
      } catch {
        return null;
      }
    };

    parsed = tryParse(raw);

    console.log("[REELS GENERATE] Direct JSON parse", {
      success: !!parsed,
    });

    if (!parsed) {
      const first = raw.indexOf("{");
      const last = raw.lastIndexOf("}");
      if (first !== -1 && last !== -1) {
        parsed = tryParse(raw.slice(first, last + 1));
      }

      console.log("[REELS GENERATE] JSON slice repair attempt", {
        success: !!parsed,
      });
    }

    if (!parsed) {
      console.warn("[REELS GENERATE] Running JSON repair via second OpenAI call");

      const repair = await openai.chat.completions.create({
        model: OPENAI_MODEL,
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

      console.log("[REELS GENERATE] JSON repair result", {
        success: !!parsed,
        fixedLength: fixed.length,
        fixedPreview: fixed.slice(0, 300),
      });
    }

    if (!parsed) {
      console.error("[REELS GENERATE] Falling back to hardcoded response object");

      const fallbackScenesForHardcoded = buildDefaultScenePlan(
        videoLength,
        mediaType,
        offerMetaInput?.mode
      );
      const fallbackBeatMapForHardcoded = normalizeBeatMap(
        [],
        videoLength,
        fallbackScenesForHardcoded
      );
      const fallbackMusicPlanForHardcoded = buildMusicPlanFallback({
        offerMeta: offerMetaInput,
        genre,
        tone,
        nicheDescription,
        videoLength,
        beatMap: fallbackBeatMapForHardcoded,
        freedomRecurring,
      });

      parsed = {
        script: fallbackScript,
        storyboard: fallbackStoryboard,
        subtitles: fallbackScript
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        cta: fallbackCta,
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
          ctaStyle: "",
          hookPower: "",
        },
        ctaIntelligence: {},
        offerMeta: selectedOfferResolved,
        selectedOffer: selectedOfferResolved,
        beatMap: fallbackBeatMapForHardcoded,
        voiceTimeline: [],
        exportTimeline: {
          totalDuration: videoLength,
          scenes: fallbackScenesForHardcoded,
        },
        musicPlan: fallbackMusicPlanForHardcoded,
        hookIntelligence: {
          angle: "direct benefit",
          promise: "clear result",
          patternBreak: "unexpected opener",
          tension: "what viewer loses if ignored",
          curiosity: "strong open loop",
        },
        mediaFiles: [],
        timelinePreview: [],
        freedomRecurring,
        mediaQuery,
        renderHints: {
          offerMode: selectedOfferResolved.mode,
          offerName: selectedOfferResolved.name,
          offerCategory: selectedOfferResolved.category,
          freedomRecurring,
          maxSegments: smartRenderMaxSegments,
          mediaQuery,
          scriptAngle,
        },
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

    parsed = hardenParsedResponse({
      parsed,
      body,
      genre,
      tone,
      storyFormat,
      videoLength,
      mediaType,
      nicheDescription,
      offerMetaInput,
      selectedOfferResolved,
      mediaFiles,
      freedomRecurring,
      mediaQuery,
      generationId,
      scriptAngle,
      smartRenderMaxSegments,
    });

    console.log("[REELS GENERATE] Final payload ready", {
      scriptLines: parsed.subtitles?.length || 0,
      storyboardCount: parsed.storyboard?.length || 0,
      beatMapCount: parsed.beatMap?.length || 0,
      sceneCount: parsed.exportTimeline?.scenes?.length || 0,
      musicMarkerCount: parsed.musicPlan?.beatMarkers?.length || 0,
      timelinePreviewCount: parsed.timelinePreview?.length || 0,
      mediaCount: parsed.mediaFiles?.length || 0,
      freedomRecurring,
      scriptAngle,
      offerName: parsed.offerMeta?.name || null,
      offerMode: parsed.offerMeta?.mode || null,
      offerCategory: parsed.offerMeta?.category || null,
      mediaQuery,
      smartRenderMaxSegments,
      hasAiBreakdown: !!parsed.aiBreakdown,
      hasThumbnailPrompt: !!parsed.thumbnailIntelligence?.finalPrompt,
      hasMusicPlan: !!parsed.musicPlan,
    });

    return NextResponse.json(parsed as GenerateReelResponse, {
      status: 200,
    });
  } catch (err: any) {
    console.error("[REELS GENERATE] Fatal error", {
      message: err?.message || "Unexpected error",
      stack: err?.stack || null,
    });

    return NextResponse.json(
      { error: err?.message || "Unexpected error." },
      { status: 500 }
    );
  }
}