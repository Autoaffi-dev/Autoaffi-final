import { NextResponse } from "next/server";

export const runtime = "nodejs";

type MediaIntent =
  | "ai_saas"
  | "business_growth"
  | "marketing_funnel"
  | "ecommerce"
  | "product_generic"
  | "motivation"
  | "freedom_lifestyle"
  | "generic";

type MediaType = "mixed" | "video" | "stills";
type OfferMode = "product" | "recurring" | "funnel";

type MediaItem = {
  source: "pexels" | "pixabay" | "videezy" | "fallback";
  url: string;
  thumb: string;
  duration: number;
  width?: number;
  height?: number;
  tags?: string[];
  title?: string;
  type?: "video" | "image";
};

type ScoredMediaItem = MediaItem & {
  _score: number;
  _text: string;
};

const MAX_QUERY_VARIANTS = 6;
const MAX_RESULTS = 15;
const MIN_VIDEO_DURATION = 4;
const FETCH_TIMEOUT_MS = 9000;

function safeString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function safeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeText(value: unknown): string {
  return safeString(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => normalizeText(v)).filter(Boolean)));
}

function mergeUniqueTags(...groups: Array<string[] | undefined | null>): string[] {
  const flat = groups.flatMap((group) => (Array.isArray(group) ? group : []));
  return uniqueStrings(flat.map((v) => safeString(v)).filter(Boolean));
}

function hashSeed(seed: unknown): number {
  const seedStr =
    typeof seed === "string" ? seed : seed != null ? String(seed) : "default";

  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash * 31 + seedStr.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function containsAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(normalizeText(word)));
}

function countMatches(text: string, words: string[]): number {
  return words.reduce(
    (acc, word) => (text.includes(normalizeText(word)) ? acc + 1 : acc),
    0
  );
}

function normalizeMediaType(value: unknown): MediaType {
  const v = safeString(value, "mixed").toLowerCase();
  if (v === "video") return "video";
  if (v === "stills") return "stills";
  return "mixed";
}

function normalizeOfferMode(value: unknown): OfferMode {
  const v = safeString(value, "recurring").toLowerCase();
  if (v === "product" || v === "funnel") return v;
  return "recurring";
}

function isHttpUrl(value: unknown): boolean {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function isVerticalish(width?: number, height?: number): boolean {
  return (
    typeof width === "number" &&
    typeof height === "number" &&
    width > 0 &&
    height > 0 &&
    height >= width
  );
}

function getAspectRatio(width?: number, height?: number): number {
  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    width <= 0 ||
    height <= 0
  ) {
    return 1;
  }

  return width / height;
}

function isStrongVertical(width?: number, height?: number): boolean {
  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    width <= 0 ||
    height <= 0
  ) {
    return false;
  }

  return height / width >= 1.2;
}

function isSquareish(width?: number, height?: number): boolean {
  const ratio = getAspectRatio(width, height);
  return ratio >= 0.85 && ratio <= 1.15;
}

function isLandscapeish(width?: number, height?: number): boolean {
  const ratio = getAspectRatio(width, height);
  return ratio > 1.15;
}

function isUltraWide(width?: number, height?: number): boolean {
  const ratio = getAspectRatio(width, height);
  return ratio >= 1.6;
}

function hasCropSafeProductSignal(text: string): boolean {
  return containsAny(text, [
    "closeup",
    "close up",
    "macro",
    "hands",
    "holding",
    "hand",
    "product demo",
    "demo",
    "showcase",
    "review",
    "unboxing",
    "device",
    "use case",
    "customer use case",
    "commercial",
    "ugc",
    "portrait",
    "vertical",
    "centered",
    "center",
    "isolated",
    "product display",
    "product showcase",
  ]);
}

function hasCropSafeFunnelSignal(text: string): boolean {
  return containsAny(text, [
    "dashboard",
    "analytics",
    "laptop",
    "workspace",
    "founder",
    "computer screen",
    "screen",
    "strategy",
    "campaign",
    "conversion",
    "landing page",
    "sales funnel",
    "crm",
    "checkout",
  ]);
}

function hasCropRiskSignal(text: string): boolean {
  return containsAny(text, [
    "wide shot",
    "wide",
    "panorama",
    "panoramic",
    "landscape view",
    "aerial",
    "drone",
    "group",
    "crowd",
    "team meeting",
    "meeting room",
    "conference room",
    "office interior",
    "workspace only",
    "desk only",
    "room",
    "interior",
    "background",
    "scenic",
    "cityscape",
    "skyline",
    "large room",
    "open office",
  ]);
}

function extractUrlHints(url: unknown): string {
  if (!isHttpUrl(url)) return "";

  try {
    const parsed = new URL(String(url));
    return normalizeText(
      parsed.pathname
        .replace(/[_/.-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    );
  } catch {
    return "";
  }
}

function hasBusinessBridge(text: string): boolean {
  return containsAny(text, [
    "laptop",
    "computer",
    "workspace",
    "remote work",
    "business",
    "entrepreneur",
    "startup",
    "founder",
    "digital",
    "creator",
    "desk",
    "office",
    "analytics",
    "dashboard",
    "software",
    "marketing",
    "team",
    "workflow",
    "screen",
    "strategy",
    "campaign",
    "saas",
    "automation",
  ]);
}

function hasProductBridge(text: string): boolean {
  return containsAny(text, [
    "product",
    "demo",
    "hands",
    "holding",
    "device",
    "phone",
    "showcase",
    "closeup",
    "review",
    "unboxing",
    "use case",
    "customer",
    "lifestyle",
    "creator",
    "ugc",
    "commercial",
    "results",
    "transformation",
    "before after",
    "before and after",
  ]);
}

function hasFunnelBridge(text: string): boolean {
  return containsAny(text, [
    "landing page",
    "sales funnel",
    "sales page",
    "conversion",
    "lead generation",
    "lead magnet",
    "email marketing",
    "checkout",
    "campaign",
    "crm",
    "dashboard",
    "analytics",
    "workspace",
    "laptop",
    "founder",
    "strategy",
    "marketing",
    "performance marketing",
  ]);
}

function hasStrongNatureScene(text: string): boolean {
  return containsAny(text, [
    "beach",
    "ocean",
    "sea",
    "sunrise",
    "sunset",
    "mountain",
    "forest",
    "travel",
    "road trip",
    "outdoor",
    "scenic",
    "island",
    "coast",
    "waves",
    "skyline",
    "sky",
    "palm",
    "cliff",
    "lake",
    "river",
    "waterfall",
    "shore",
    "tropical",
    "horizon",
    "nature",
    "cabin",
    "van life",
    "camping",
    "trail",
  ]);
}

function hasFreedomLifestyleSignal(text: string): boolean {
  return containsAny(text, [
    "freedom",
    "financial freedom",
    "remote work",
    "work from anywhere",
    "travel",
    "lifestyle",
    "luxury",
    "entrepreneur",
    "success",
    "digital nomad",
    "creator",
    "premium",
    "passive income",
    "online income",
    "laptop lifestyle",
    "independence",
    "escape 9 5",
    "escape the 9 5",
    "quit job",
    "travel entrepreneur",
    "remote entrepreneur",
  ]);
}

function hasStrictFreedomRemoteBlend(text: string): boolean {
  return (
    containsAny(text, [
      "remote work",
      "work from anywhere",
      "digital nomad",
      "travel entrepreneur",
      "remote entrepreneur",
      "laptop lifestyle",
      "beach laptop",
      "mountain laptop",
      "ocean laptop",
      "sunset laptop",
      "travel lifestyle",
    ]) &&
    containsAny(text, [
      "travel",
      "lifestyle",
      "beach",
      "ocean",
      "sunset",
      "sunrise",
      "mountain",
      "forest",
      "freedom",
      "digital nomad",
      "remote work",
      "luxury",
    ])
  );
}

function isWeakNatureOnly(text: string): boolean {
  return containsAny(text, [
    "plant",
    "cactus",
    "pot plant",
    "flower pot",
    "desk plant",
    "table plant",
    "leaf",
    "indoor plant",
  ]);
}

function hasFreedomRecurringBusinessHardBlock(text: string): boolean {
  return containsAny(text, [
    "office",
    "meeting",
    "team",
    "teamwork",
    "network",
    "communication",
    "businesswoman",
    "job",
    "job seeker",
    "career",
    "course",
    "study",
    "student",
    "intern",
    "trainee",
    "employee",
    "teacher",
    "teaching",
    "teaching online",
    "online class",
    "online lesson",
    "dj software",
    "software on laptop",
    "keyboard",
    "typing",
    "notebook computer",
    "desktop",
    "workplace",
    "office interior",
    "interior",
    "computer",
    "internet",
    "social media",
    "marketing",
    "communication",
    "analytics",
    "dashboard",
    "programmer",
    "developer",
    "engineer",
    "monitor",
    "screen",
    "work",
    "business",
    "office space",
    "modern office",
    "interactive data analysis",
    "web",
    "pc",
    "connection",
    "using",
    "writing",
  ]);
}

function isNatureFreedomText(text: string): boolean {
  const negative = [
    "vaccine",
    "vaccination",
    "syringe",
    "needle",
    "injection",
    "hospital",
    "doctor",
    "medical",
    "surgery",
    "patient",
    "clinic",
    "operating room",
    "lab",
    "restaurant",
    "brunch",
    "cocktail",
    "bar",
    "meal",
    "plates",
    "waiter",
    "office space",
    "meeting",
    "team",
    "brainstorming",
    "corporate",
    "payment",
    "banking",
    "transaction",
    "analytics",
    "dashboard",
    "retail",
    "ecommerce",
    "online shopping",
    "desk only",
    "workspace only",
    "programmer",
    "developer",
    "monitor",
    "workplace",
    "interactive data analysis",
    "modern office",
    "teacher",
    "teaching",
    "online lesson",
    "online class",
    "keyboard",
    "typing",
  ];

  if (containsAny(text, negative)) return false;
  if (isWeakNatureOnly(text) && !hasStrongNatureScene(text)) return false;

  const strongNature = hasStrongNatureScene(text);
  const freedom = hasFreedomLifestyleSignal(text);

  return strongNature && freedom;
}

function isNatureFreedomMedia(item: Partial<MediaItem>): boolean {
  return isNatureFreedomText(extractTerms(item));
}

function hasRecurringFreedomHardNegative(text: string): boolean {
  return containsAny(text, [
    "office space",
    "meeting",
    "team",
    "brainstorming",
    "corporate",
    "payment",
    "banking",
    "transaction",
    "analytics",
    "dashboard",
    "retail",
    "ecommerce",
    "online shopping",
    "office",
    "workspace",
    "desk",
    "monitor",
    "screen",
    "programmer",
    "developer",
    "workplace",
    "interactive data analysis",
    "modern office",
    "internet",
    "engineer",
    "program",
    "job",
    "interior",
    "room",
    "people",
    "teaching",
    "teacher",
    "online class",
    "online lesson",
    "keyboard",
    "typing",
  ]);
}

function isStrictFreedomRecurringCandidate(item: Partial<MediaItem>): boolean {
  const text = extractTerms(item);

  if (isNatureFreedomText(text)) return true;
  if (hasStrictFreedomRemoteBlend(text)) return true;

  const strongNature = hasStrongNatureScene(text);
  const freedom = hasFreedomLifestyleSignal(text);

  if (strongNature && freedom) return true;

  if (
    strongNature &&
    containsAny(text, [
      "remote work",
      "digital nomad",
      "entrepreneur",
      "travel",
      "lifestyle",
      "work from anywhere",
      "premium",
      "luxury",
    ]) &&
    !hasFreedomRecurringBusinessHardBlock(text)
  ) {
    return true;
  }

  return false;
}

function isRelaxedFreedomRecurringCandidate(item: Partial<MediaItem>): boolean {
  const text = extractTerms(item);

  if (isStrictFreedomRecurringCandidate(item)) return true;
  if (hasFreedomRecurringBusinessHardBlock(text)) return false;
  if (hasRecurringFreedomHardNegative(text)) return false;
  if (isWeakNatureOnly(text) && !hasStrongNatureScene(text)) return false;

  const strongNature = hasStrongNatureScene(text);
  const freedom = hasFreedomLifestyleSignal(text);
  const businessBridge = hasBusinessBridge(text);

  if (strongNature && freedom) return true;
  if (strongNature && businessBridge) return true;

  if (
    strongNature &&
    containsAny(text, [
      "travel",
      "premium",
      "luxury",
      "entrepreneur",
      "creator",
      "remote",
      "laptop",
      "work from anywhere",
    ])
  ) {
    return true;
  }

  if (
    containsAny(text, [
      "digital nomad",
      "travel lifestyle",
      "remote lifestyle",
      "remote entrepreneur",
      "beach laptop",
      "mountain laptop",
      "ocean laptop",
      "sunset laptop",
    ])
  ) {
    return true;
  }

  return false;
}

function detectIntent(query: string): MediaIntent {
  const q = normalizeText(query);

  const freedomSignals = [
    "freedom",
    "economic freedom",
    "financial freedom",
    "laptop lifestyle",
    "remote work",
    "work from anywhere",
    "travel lifestyle",
    "luxury lifestyle",
    "passive income",
    "online income",
    "escape 9 5",
    "escape the 9 5",
    "leave 9 5",
    "quit job",
    "independence",
    "beach laptop",
    "entrepreneur lifestyle",
    "success lifestyle",
    "sunset work",
    "nature lifestyle",
    "digital nomad",
    "remote entrepreneur",
    "freedom business",
    "laptop beach",
    "mountain laptop",
    "forest walk",
  ];

  const aiSignals = [
    "ai",
    "artificial intelligence",
    "automation",
    "saas",
    "software",
    "dashboard",
    "crm",
    "tool",
    "app",
    "platform",
    "analytics",
    "productivity",
    "business software",
    "digital tool",
    "online business",
    "workflow",
    "team workspace",
    "startup",
    "founder",
    "laptop workspace",
    "data",
  ];

  const funnelSignals = [
    "funnel",
    "landing page",
    "conversion",
    "lead generation",
    "lead gen",
    "sales page",
    "optin",
    "email flow",
    "follow up",
    "checkout flow",
    "marketing dashboard",
    "performance marketing",
  ];

  const ecommerceSignals = [
    "ecommerce",
    "shopify",
    "dropshipping",
    "amazon product",
    "product page",
    "online store",
    "shopping",
    "sale",
    "retail",
    "store",
  ];

  const productSignals = [
    "product",
    "gadget",
    "device",
    "skincare",
    "fitness product",
    "phone case",
    "hoodie",
    "sticker",
    "beauty product",
    "pet product",
  ];

  const motivationSignals = [
    "motivation",
    "mindset",
    "success",
    "discipline",
    "focus",
    "hustle",
  ];

  if (funnelSignals.some((s) => q.includes(s))) return "marketing_funnel";
  if (aiSignals.some((s) => q.includes(s))) return "ai_saas";
  if (ecommerceSignals.some((s) => q.includes(s))) return "ecommerce";
  if (productSignals.some((s) => q.includes(s))) return "product_generic";
  if (freedomSignals.some((s) => q.includes(s))) return "freedom_lifestyle";
  if (motivationSignals.some((s) => q.includes(s))) return "motivation";

  if (
    q.includes("business") ||
    q.includes("marketing") ||
    q.includes("growth") ||
    q.includes("entrepreneur") ||
    q.includes("startup")
  ) {
    return "business_growth";
  }

  return "generic";
}

function buildSearchQueries(
  rawQuery: string,
  intent: MediaIntent,
  options?: {
    offerMode?: OfferMode;
    freedomRecurring?: boolean;
    forceNatureFreedomClip?: boolean;
  }
): string[] {
  const q = safeString(rawQuery, "business").trim();
  const offerMode = normalizeOfferMode(options?.offerMode);
  const freedomRecurring = !!options?.freedomRecurring;
  const forceNatureFreedomClip = !!options?.forceNatureFreedomClip;

  if (freedomRecurring || forceNatureFreedomClip) {
    return uniqueStrings([
      q,
      "financial freedom lifestyle beach sunset ocean entrepreneur",
      "remote work from anywhere beach laptop freedom lifestyle",
      "digital nomad travel freedom luxury lifestyle",
      "mountain sunrise entrepreneur freedom lifestyle",
      "forest scenic travel entrepreneur freedom",
      "tropical coast remote lifestyle freedom",
      "ocean sunset freedom travel lifestyle",
      "nature luxury lifestyle digital nomad",
      "travel lifestyle remote entrepreneur premium freedom",
      "beach sunrise work from anywhere lifestyle",
      "mountain forest freedom travel lifestyle",
    ]).slice(0, MAX_QUERY_VARIANTS);
  }

  if (offerMode === "product") {
    return uniqueStrings([
      q,
      "hands using product closeup premium vertical",
      "product demo commercial ugc lifestyle creator portrait",
      "modern lifestyle product showcase vertical centered",
      "clean product review customer experience closeup",
      "device use case creator lifestyle portrait",
      "premium commercial product transformation centered",
      "before after results creator product vertical",
      "isolated product showcase closeup",
    ]).slice(0, MAX_QUERY_VARIANTS);
  }

  if (offerMode === "funnel") {
    return uniqueStrings([
      q,
      "landing page sales funnel conversion dashboard",
      "lead generation marketing workspace laptop",
      "sales page campaign analytics founder desk",
      "email marketing crm checkout strategy",
      "marketing dashboard campaign manager workspace",
      "business growth funnel laptop office",
      "premium founder marketing strategy laptop",
    ]).slice(0, MAX_QUERY_VARIANTS);
  }

  switch (intent) {
    case "ai_saas":
      return uniqueStrings([
        q,
        "ai software dashboard laptop workspace",
        "saas dashboard analytics business software",
        "startup founder laptop office technology",
        "digital automation workflow computer screen",
        "remote entrepreneur laptop workspace",
        "modern business technology office vertical",
      ]);

    case "marketing_funnel":
      return uniqueStrings([
        q,
        "marketing dashboard analytics laptop office",
        "landing page marketing strategy business",
        "sales funnel digital marketing workspace",
        "lead generation startup computer desk",
        "marketing founder laptop workspace",
        "business analytics conversion office",
      ]);

    case "business_growth":
      return uniqueStrings([
        q,
        "business growth laptop office entrepreneur",
        "startup team strategy analytics workspace",
        "content creator laptop planning desk",
        "remote entrepreneur laptop workspace",
        "modern business office technology",
        "founder laptop analytics growth",
      ]);

    case "ecommerce":
      return uniqueStrings([
        q,
        "ecommerce online store laptop product packaging",
        "product packaging shipping ecommerce workspace",
        "online business inventory desk laptop",
        "small business product branding workspace",
        "warehouse packaging product vertical",
        "online store founder desk",
      ]);

    case "product_generic":
      return uniqueStrings([
        q,
        "product closeup commercial studio",
        "hands using product closeup",
        "modern lifestyle product vertical",
        "clean product showcase vertical",
        "premium product display",
      ]);

    case "motivation":
      return uniqueStrings([
        q,
        "motivated entrepreneur laptop city lifestyle",
        "focus work ambition office night",
        "success mindset business creator workspace",
        "financial freedom lifestyle laptop travel",
        "entrepreneur sunrise laptop",
        "discipline business workspace",
      ]);

    case "freedom_lifestyle":
      return uniqueStrings([
        q,
        "financial freedom lifestyle beach sunset ocean",
        "remote work from anywhere beach laptop",
        "luxury travel lifestyle digital nomad",
        "nature travel entrepreneur freedom lifestyle",
        "sunset ocean freedom lifestyle",
        "mountain sunrise freedom entrepreneur",
      ]);

    default:
      return uniqueStrings([
        q,
        "business laptop workspace",
        "modern office technology vertical",
        "creator workspace laptop desk",
        "remote work laptop business",
        "entrepreneur laptop office",
      ]);
  }
}

function buildStrictNatureFreedomQueries(rawQuery: string): string[] {
  const q = safeString(rawQuery, "").trim();

  return uniqueStrings([
    q,
    "financial freedom beach sunset ocean lifestyle",
    "remote work from anywhere beach laptop lifestyle",
    "digital nomad travel luxury lifestyle",
    "mountain sunrise freedom entrepreneur lifestyle",
    "forest scenic travel freedom lifestyle",
    "tropical coast freedom lifestyle",
    "ocean sunset luxury lifestyle",
    "beach sunrise remote lifestyle",
    "nature freedom travel lifestyle premium",
    "mountain forest travel lifestyle freedom",
    "island coast freedom entrepreneur lifestyle",
    "van life digital nomad freedom",
  ]).slice(0, MAX_QUERY_VARIANTS);
}

function buildStrictProductWowQueries(rawQuery: string): string[] {
  const q = safeString(rawQuery, "").trim();

  return uniqueStrings([
    q,
    "hands using product closeup premium vertical",
    "product demo lifestyle creator ugc portrait",
    "showcase product review customer use case centered",
    "premium product commercial results transformation vertical",
    "before after product creator vertical closeup",
    "isolated product showcase macro portrait",
  ]).slice(0, MAX_QUERY_VARIANTS);
}

function buildStrictFunnelWowQueries(rawQuery: string): string[] {
  const q = safeString(rawQuery, "").trim();

  return uniqueStrings([
    q,
    "landing page sales funnel conversion dashboard",
    "lead generation campaign analytics founder",
    "email marketing crm strategy laptop workspace",
    "sales page premium marketing dashboard",
    "performance marketing conversion laptop office",
  ]).slice(0, MAX_QUERY_VARIANTS);
}

function extractTerms(item: Partial<MediaItem>): string {
  const urlHints = extractUrlHints(item.url);
  const thumbHints = extractUrlHints(item.thumb);

  return normalizeText(
    [
      item.title || "",
      Array.isArray(item.tags) ? item.tags.join(" ") : "",
      item.source || "",
      item.type || "",
      urlHints,
      thumbHints,
    ].join(" ")
  );
}

function buildIntentBoostTags(params: {
  rawQuery: string;
  intent: MediaIntent;
  offerMode: OfferMode;
  freedomRecurring: boolean;
  forceNatureFreedomClip: boolean;
  item: MediaItem;
}): string[] {
  const { rawQuery, intent, offerMode, freedomRecurring, forceNatureFreedomClip, item } = params;

  const urlHints = extractUrlHints(item.url);
  const queryTokens = normalizeText(rawQuery).split(" ").filter(Boolean);

  const freedomTags = [
    "financial freedom",
    "freedom lifestyle",
    "remote work",
    "work from anywhere",
    "travel lifestyle",
    "digital nomad",
    "luxury lifestyle",
    "entrepreneur lifestyle",
    "premium",
    "sunset",
    "sunrise",
    "ocean",
    "beach",
    "mountain",
    "forest",
    "nature",
    "travel",
  ];

  const productTags = [
    "product",
    "product demo",
    "showcase",
    "hands using product",
    "premium",
    "creator",
    "ugc",
    "commercial",
    "customer use case",
    "results",
  ];

  const funnelTags = [
    "landing page",
    "sales funnel",
    "conversion",
    "lead generation",
    "marketing dashboard",
    "campaign",
    "workspace",
    "founder",
    "analytics",
    "premium",
  ];

  const aiTags = [
    "ai",
    "software",
    "dashboard",
    "analytics",
    "startup",
    "workspace",
    "automation",
    "business software",
    "remote entrepreneur",
    "digital",
  ];

  const businessTags = [
    "business growth",
    "entrepreneur",
    "creator",
    "laptop workspace",
    "startup",
    "remote work",
    "strategy",
    "marketing",
    "growth",
  ];

  const tags: string[] = [...queryTokens, urlHints];

  if (freedomRecurring || forceNatureFreedomClip || intent === "freedom_lifestyle") {
    tags.push(...freedomTags);
  } else if (offerMode === "product") {
    tags.push(...productTags);
  } else if (offerMode === "funnel") {
    tags.push(...funnelTags);
  } else if (intent === "ai_saas") {
    tags.push(...aiTags);
  } else if (intent === "business_growth" || intent === "motivation") {
    tags.push(...businessTags);
  }

  return uniqueStrings(tags);
}

function buildIntentTitle(params: {
  rawQuery: string;
  intent: MediaIntent;
  offerMode: OfferMode;
  freedomRecurring: boolean;
  forceNatureFreedomClip: boolean;
  item: MediaItem;
}): string {
  const { rawQuery, intent, offerMode, freedomRecurring, forceNatureFreedomClip, item } = params;

  const currentTitle = safeString(item.title, "");
  const currentTags = Array.isArray(item.tags) ? item.tags.join(" ") : "";
  const urlHints = extractUrlHints(item.url);
  const currentBlob = normalizeText(`${currentTitle} ${currentTags} ${urlHints}`);

  if (currentTitle && currentBlob.length >= 12) {
    return currentTitle;
  }

  if (freedomRecurring || forceNatureFreedomClip || intent === "freedom_lifestyle") {
    return safeString(rawQuery, "financial freedom remote work travel lifestyle");
  }

  if (offerMode === "product") {
    return safeString(rawQuery, "product demo premium creator lifestyle");
  }

  if (offerMode === "funnel") {
    return safeString(rawQuery, "landing page sales funnel conversion workspace");
  }

  if (intent === "ai_saas") {
    return safeString(rawQuery, "ai software dashboard business workspace");
  }

  if (intent === "business_growth") {
    return safeString(rawQuery, "business growth entrepreneur workspace");
  }

  if (intent === "motivation") {
    return safeString(rawQuery, "success motivation entrepreneur lifestyle");
  }

  return safeString(rawQuery, "business workspace");
}

function enrichMediaItemForIntent(
  item: MediaItem,
  params: {
    rawQuery: string;
    intent: MediaIntent;
    offerMode: OfferMode;
    freedomRecurring: boolean;
    forceNatureFreedomClip: boolean;
  }
): MediaItem {
  const boostTags = buildIntentBoostTags({
    ...params,
    item,
  });

  const enrichedTitle = buildIntentTitle({
    ...params,
    item,
  });

  return {
    ...item,
    title: enrichedTitle,
    tags: mergeUniqueTags(item.tags, boostTags),
  };
}

function scoreMediaItem(
  item: MediaItem,
  intent: MediaIntent,
  rawQuery: string,
  options?: {
    offerMode?: OfferMode;
    freedomRecurring?: boolean;
    forceNatureFreedomClip?: boolean;
  }
): number {
  const text = extractTerms(item);
  const q = normalizeText(rawQuery);
  const offerMode = normalizeOfferMode(options?.offerMode);
  const freedomRecurring = !!options?.freedomRecurring;
  const forceNatureFreedomClip = !!options?.forceNatureFreedomClip;

  let score = 0;

  if (item.type === "video") {
    if (item.source === "videezy") score += 14;
    if (item.source === "pixabay") score += 10;
    if (item.source === "pexels") score += 9;
  } else {
    if (item.source === "pexels") score += 8;
    if (item.source === "pixabay") score += 7;
  }

  if (item.type === "video") {
    score += 12;
    if (item.duration >= 5 && item.duration <= 12) score += 16;
    else if (item.duration >= 13 && item.duration <= 18) score += 12;
    else if (item.duration >= 19 && item.duration <= 25) score += 5;
    else if (item.duration > 25) score -= 4;
  } else {
    score += 5;
  }

  if (isVerticalish(item.width, item.height)) score += 16;
  if (q && text.includes(q)) score += 14;

  if (isStrongVertical(item.width, item.height)) score += 18;
  else if (isSquareish(item.width, item.height)) score += 8;
  else if (isLandscapeish(item.width, item.height)) score -= 8;

  if (isUltraWide(item.width, item.height)) score -= 18;

  if (hasCropRiskSignal(text)) score -= 12;

  const aiPositive = [
    "ai",
    "software",
    "dashboard",
    "analytics",
    "data",
    "laptop",
    "computer",
    "technology",
    "workspace",
    "startup",
    "office",
    "founder",
    "marketing",
    "automation",
    "crm",
    "app",
    "digital",
    "team",
    "workflow",
  ];

  const funnelPositive = [
    "marketing",
    "dashboard",
    "analytics",
    "laptop",
    "office",
    "digital",
    "strategy",
    "startup",
    "computer",
    "workspace",
    "team",
    "growth",
    "landing page",
    "sales funnel",
    "conversion",
    "checkout",
    "email marketing",
    "crm",
    "lead generation",
  ];

  const ecommercePositive = [
    "product",
    "packaging",
    "shipping",
    "warehouse",
    "store",
    "brand",
    "inventory",
    "small business",
    "desk",
    "retail",
    "commerce",
  ];

  const freedomPositive = [
    "freedom",
    "financial freedom",
    "remote work",
    "work from anywhere",
    "travel",
    "lifestyle",
    "luxury",
    "sunset",
    "sunrise",
    "ocean",
    "beach",
    "mountain",
    "nature",
    "forest",
    "scenic",
    "entrepreneur",
    "success",
    "laptop",
    "creator",
    "digital nomad",
    "premium",
  ];

  const businessLifestyleBridge = [
    "remote work",
    "laptop",
    "entrepreneur",
    "workspace",
    "travel",
    "creator",
    "startup",
    "freelance",
    "business",
    "digital",
    "office",
    "computer",
  ];

  const productPositive = [
    "product",
    "demo",
    "review",
    "showcase",
    "hands",
    "holding",
    "device",
    "phone",
    "closeup",
    "creator",
    "lifestyle",
    "ugc",
    "customer",
    "testimonial",
    "commercial",
    "results",
    "transformation",
    "before after",
    "before and after",
    "use case",
    "workflow",
    "setup",
    "premium",
  ];

  const productNegative = [
    "dashboard",
    "analytics",
    "crm",
    "landing page",
    "sales funnel",
    "checkout only",
    "office meeting",
    "team presentation",
    "spreadsheet",
    "hospital",
    "medical",
    "syringe",
    "vaccine",
  ];

  const funnelNegative = [
    "product closeup only",
    "unboxing only",
    "demo only",
    "shopping bag",
    "makeup",
    "lipstick",
    "beauty salon",
    "hospital",
    "medical",
    "syringe",
    "vaccine",
  ];

  const hardNegativeForAISaaS = [
    "shopping bag",
    "bags",
    "retail sale",
    "sale sign",
    "discount",
    "fashion model",
    "clothes rack",
    "makeup brush",
    "lipstick",
    "jewelry",
    "gift box",
    "mall",
    "runway",
    "high heels",
  ];

  const hardNegativeBusiness = [
    "wedding",
    "baby",
    "food closeup",
    "cooking pan",
    "flowers",
    "party",
    "surgery",
    "hospital",
    "funeral",
    "cemetery",
  ];

  const cafeNegative = [
    "cafe",
    "coffee shop",
    "restaurant",
    "terrace",
    "outdoor dining",
    "dining table",
    "brunch",
    "cocktail",
    "drinks",
    "bar",
    "waiter",
    "plates",
    "meal",
    "tourist",
    "vacation resort",
    "poolside drink",
  ];

  const addKeywordScore = (words: string[], plus = 5) => {
    for (const word of words) {
      if (text.includes(word)) score += plus;
    }
  };

  const subtractKeywordScore = (words: string[], minus = 16) => {
    for (const word of words) {
      if (text.includes(word)) score -= minus;
    }
  };

  if (intent === "ai_saas") {
    addKeywordScore(aiPositive, 5);
    addKeywordScore(businessLifestyleBridge, 3);
    addKeywordScore(freedomPositive, 1);
    subtractKeywordScore(hardNegativeForAISaaS, 20);
    subtractKeywordScore(hardNegativeBusiness, 14);
    subtractKeywordScore(cafeNegative, 18);

    if (hasStrongNatureScene(text) && hasBusinessBridge(text)) {
      score += 14;
    }
  }

  if (intent === "marketing_funnel") {
    addKeywordScore(funnelPositive, 5);
    addKeywordScore(businessLifestyleBridge, 3);
    addKeywordScore(freedomPositive, 1);
    subtractKeywordScore(hardNegativeForAISaaS, 18);
    subtractKeywordScore(hardNegativeBusiness, 14);
    subtractKeywordScore(cafeNegative, 18);

    if (hasStrongNatureScene(text) && hasBusinessBridge(text)) {
      score += 10;
    }
  }

  if (intent === "business_growth") {
    addKeywordScore(aiPositive, 3);
    addKeywordScore(funnelPositive, 3);
    addKeywordScore(businessLifestyleBridge, 4);
    addKeywordScore(freedomPositive, 3);
    subtractKeywordScore(hardNegativeForAISaaS, 14);
    subtractKeywordScore(hardNegativeBusiness, 12);
    subtractKeywordScore(cafeNegative, 16);

    if (hasStrongNatureScene(text) && hasBusinessBridge(text)) {
      score += 16;
    }
  }

  if (intent === "ecommerce") {
    addKeywordScore(ecommercePositive, 5);
    subtractKeywordScore(hardNegativeBusiness, 10);
    subtractKeywordScore(cafeNegative, 12);
  }

  if (intent === "motivation") {
    addKeywordScore(freedomPositive, 5);
    addKeywordScore(businessLifestyleBridge, 3);
    subtractKeywordScore(cafeNegative, 14);

    if (
      hasStrongNatureScene(text) &&
      containsAny(text, ["success", "entrepreneur", "laptop", "remote work", "lifestyle", "business"])
    ) {
      score += 18;
    }
  }

  if (intent === "freedom_lifestyle") {
    addKeywordScore(freedomPositive, 6);
    subtractKeywordScore(hardNegativeBusiness, 12);
    subtractKeywordScore(cafeNegative, 20);

    if (isNatureFreedomText(text)) score += 60;
    if (hasStrictFreedomRemoteBlend(text)) score += 34;
    if (isRelaxedFreedomRecurringCandidate(item)) score += 24;

    if (
      hasFreedomRecurringBusinessHardBlock(text) &&
      !isNatureFreedomText(text) &&
      !hasStrictFreedomRemoteBlend(text) &&
      !isRelaxedFreedomRecurringCandidate(item)
    ) {
      score -= 140;
    }

    if (
      containsAny(text, ["office", "meeting", "team", "teacher", "teaching", "keyboard", "typing"]) &&
      !isNatureFreedomText(text) &&
      !hasStrictFreedomRemoteBlend(text) &&
      !isRelaxedFreedomRecurringCandidate(item)
    ) {
      score -= 120;
    }
  }

  if (offerMode === "product") {
    addKeywordScore(productPositive, 6);
    subtractKeywordScore(productNegative, 16);

    if (hasProductBridge(text)) score += 24;
    if (item.type === "video" && hasProductBridge(text)) score += 12;

    if (hasCropSafeProductSignal(text)) score += 20;
    if (item.type === "video" && hasCropSafeProductSignal(text)) score += 10;

    if (
      hasProductBridge(text) &&
      (isStrongVertical(item.width, item.height) || isSquareish(item.width, item.height))
    ) {
      score += 14;
    }

    if (
      hasProductBridge(text) &&
      hasCropSafeProductSignal(text) &&
      !hasCropRiskSignal(text)
    ) {
      score += 18;
    }

    if (containsAny(text, ["dashboard", "landing page", "crm"]) && !hasProductBridge(text)) {
      score -= 18;
    }

    if (
      containsAny(text, ["lifestyle", "premium", "creator", "customer", "results", "transformation"]) &&
      hasProductBridge(text)
    ) {
      score += 14;
    }

    if (
      item.type === "video" &&
      hasCropRiskSignal(text) &&
      !hasCropSafeProductSignal(text)
    ) {
      score -= 22;
    }

    if (
      item.type === "video" &&
      isUltraWide(item.width, item.height) &&
      !hasCropSafeProductSignal(text)
    ) {
      score -= 26;
    }
  }

  if (offerMode === "funnel") {
    addKeywordScore(funnelPositive, 6);
    subtractKeywordScore(funnelNegative, 16);

    if (hasFunnelBridge(text)) score += 26;
    if (item.type === "video" && hasFunnelBridge(text)) score += 10;

    if (containsAny(text, ["unboxing", "closeup", "product"]) && !hasFunnelBridge(text)) {
      score -= 18;
    }

    if (
      containsAny(text, ["founder", "strategy", "workspace", "campaign", "analytics", "premium"]) &&
      hasFunnelBridge(text)
    ) {
      score += 14;
    }
  }

  if (offerMode === "recurring" && (freedomRecurring || forceNatureFreedomClip)) {
    if (isNatureFreedomText(text)) score += 80;
    if (hasStrictFreedomRemoteBlend(text)) score += 42;
    if (isRelaxedFreedomRecurringCandidate(item)) score += 30;

    if (
      containsAny(text, ["digital nomad", "work from anywhere", "remote work", "entrepreneur lifestyle"])
    ) {
      score += 18;
    }

    if (
      item.type === "video" &&
      (isNatureFreedomText(text) || hasStrictFreedomRemoteBlend(text) || isRelaxedFreedomRecurringCandidate(item))
    ) {
      score += 18;
    }

    if (
      containsAny(text, ["cafe", "restaurant", "terrace", "brunch", "bar"]) &&
      !isNatureFreedomText(text) &&
      !hasStrictFreedomRemoteBlend(text) &&
      !isRelaxedFreedomRecurringCandidate(item)
    ) {
      score -= 40;
    }

    if (
      hasRecurringFreedomHardNegative(text) &&
      !isNatureFreedomText(text) &&
      !hasStrictFreedomRemoteBlend(text) &&
      !isRelaxedFreedomRecurringCandidate(item)
    ) {
      score -= 140;
    }

    if (
      hasFreedomRecurringBusinessHardBlock(text) &&
      !isNatureFreedomText(text) &&
      !hasStrictFreedomRemoteBlend(text) &&
      !isRelaxedFreedomRecurringCandidate(item)
    ) {
      score -= 180;
    }

    if (!isRelaxedFreedomRecurringCandidate(item)) {
      score -= 120;
    }

    if (!isStrictFreedomRecurringCandidate(item)) {
      score -= 40;
    }
  }

  const rawMatchCount = countMatches(text, q.split(" ").filter(Boolean));
  score += Math.min(rawMatchCount, 6);

  return score;
}

function hardBlockItem(
  item: MediaItem,
  intent: MediaIntent,
  options?: {
    offerMode?: OfferMode;
    freedomRecurring?: boolean;
    forceNatureFreedomClip?: boolean;
  }
): boolean {
  const text = extractTerms(item);
  const offerMode = normalizeOfferMode(options?.offerMode);
  const freedomRecurring = !!options?.freedomRecurring;
  const forceNatureFreedomClip = !!options?.forceNatureFreedomClip;

  if (!isHttpUrl(item.url)) return true;
  if (item.type === "video" && item.duration < MIN_VIDEO_DURATION) return true;

  const blockedUniversal = [
    "wedding",
    "funeral",
    "cemetery",
    "surgery",
    "hospital",
    "lipstick",
    "makeup",
    "beauty salon",
    "shopping bag",
    "sale sign",
    "discount",
    "restaurant plate",
    "food closeup",
    "meal",
    "dining table",
    "cocktail",
    "bar",
    "brunch",
    "waiter",
    "coffee shop",
    "cafe",
    "terrace",
    "outdoor dining",
    "tourist restaurant",
    "resort buffet",
  ];

  if (blockedUniversal.some((b) => text.includes(b))) return true;

  if (intent === "ai_saas" || intent === "marketing_funnel" || intent === "business_growth") {
    const vacationOnlySignals = [
      "beach",
      "ocean",
      "vacation",
      "resort",
      "tropical",
      "sunset",
      "nature",
      "mountain",
      "forest",
      "travel",
    ];

    if (containsAny(text, vacationOnlySignals) && !hasBusinessBridge(text)) {
      return true;
    }
  }

  if (intent === "freedom_lifestyle" || intent === "motivation") {
    if (
      containsAny(text, ["cafe", "coffee shop", "terrace", "restaurant", "bar", "brunch"]) &&
      !containsAny(text, ["laptop", "remote work", "entrepreneur", "business"])
    ) {
      return true;
    }
  }

  if (offerMode === "product") {
    if (
      containsAny(text, ["landing page", "sales funnel", "checkout", "crm", "dashboard"]) &&
      !hasProductBridge(text)
    ) {
      return true;
    }

    if (
      item.type === "video" &&
      isUltraWide(item.width, item.height) &&
      !hasProductBridge(text) &&
      !hasCropSafeProductSignal(text)
    ) {
      return true;
    }

    if (
      item.type === "video" &&
      hasCropRiskSignal(text) &&
      !hasProductBridge(text)
    ) {
      return true;
    }
  }

  if (offerMode === "funnel") {
    if (
      containsAny(text, ["unboxing", "product closeup", "beauty product", "lipstick"]) &&
      !hasFunnelBridge(text)
    ) {
      return true;
    }
  }

  if (offerMode === "recurring" && (freedomRecurring || forceNatureFreedomClip)) {
    if (
      hasRecurringFreedomHardNegative(text) &&
      !isRelaxedFreedomRecurringCandidate(item)
    ) {
      return true;
    }

    if (
      containsAny(text, ["cafe", "restaurant", "terrace", "brunch", "bar"]) &&
      !isRelaxedFreedomRecurringCandidate(item)
    ) {
      return true;
    }

    if (isWeakNatureOnly(text) && !isRelaxedFreedomRecurringCandidate(item)) {
      return true;
    }

    if (
      hasFreedomRecurringBusinessHardBlock(text) &&
      !isRelaxedFreedomRecurringCandidate(item)
    ) {
      return true;
    }
  }

  return false;
}

function dedupeMedia(items: MediaItem[]): MediaItem[] {
  const seen = new Set<string>();
  const result: MediaItem[] = [];

  for (const item of items) {
    const key = `${item.type || "unknown"}__${item.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

function toScored(item: MediaItem, score: number): ScoredMediaItem {
  return {
    ...item,
    _score: score,
    _text: extractTerms(item),
  };
}

function ensureMinimumFreedomVideoSet(
  scored: ScoredMediaItem[],
  fallbackPool: ScoredMediaItem[],
  minVideos = 4,
  maxItems = MAX_RESULTS
): MediaItem[] {
  const strictVideos = scored.filter(
    (item) => item.type === "video" && isStrictFreedomRecurringCandidate(item)
  );

  const relaxedVideos = fallbackPool.filter(
    (item) =>
      item.type === "video" &&
      !strictVideos.some((x) => x.url === item.url) &&
      isRelaxedFreedomRecurringCandidate(item)
  );

  const scenicVideos = fallbackPool.filter(
    (item) =>
      item.type === "video" &&
      !strictVideos.some((x) => x.url === item.url) &&
      !relaxedVideos.some((x) => x.url === item.url) &&
      !hasFreedomRecurringBusinessHardBlock(item._text) &&
      !hasRecurringFreedomHardNegative(item._text) &&
      (hasStrongNatureScene(item._text) || hasFreedomLifestyleSignal(item._text))
  );

  const final: MediaItem[] = [];
  const seen = new Set<string>();

  const tryPush = (item?: ScoredMediaItem) => {
    if (!item?.url) return;
    if (seen.has(item.url)) return;
    seen.add(item.url);
    final.push({
      source: item.source,
      url: item.url,
      thumb: item.thumb,
      duration: item.duration,
      width: item.width,
      height: item.height,
      tags: item.tags,
      title: item.title,
      type: item.type,
    });
  };

  for (const item of strictVideos) {
    if (final.length >= maxItems) break;
    tryPush(item);
  }

  for (const item of relaxedVideos) {
    if (final.length >= maxItems) break;
    if (final.filter((x) => x.type === "video").length >= minVideos) break;
    tryPush(item);
  }

  for (const item of scenicVideos) {
    if (final.length >= maxItems) break;
    if (final.filter((x) => x.type === "video").length >= minVideos) break;
    tryPush(item);
  }

  for (const item of fallbackPool) {
    if (final.length >= maxItems) break;
    if (item.type !== "video") continue;
    if (hasFreedomRecurringBusinessHardBlock(item._text)) continue;
    if (hasRecurringFreedomHardNegative(item._text)) continue;
    tryPush(item);
  }

  return final.slice(0, maxItems);
}

function ensureVideoFirstFreedomRecurring(
  combined: MediaItem[],
  scored: ScoredMediaItem[],
  type: MediaType,
  active: boolean
): MediaItem[] {
  if (!active) return combined;
  if (type === "stills") return combined;

  const currentVideos = combined.filter((item) => item.type === "video");

  if (currentVideos.length >= 4) {
    return combined;
  }

  const rebuilt = ensureMinimumFreedomVideoSet(scored, scored, 4, MAX_RESULTS);

  if (rebuilt.filter((item) => item.type === "video").length >= currentVideos.length) {
    return rebuilt;
  }

  return combined;
}

function ensureFreedomRecurringGuarantees(
  items: ScoredMediaItem[],
  type: MediaType
): ScoredMediaItem[] {
  const working = [...items];
  const selected: ScoredMediaItem[] = [];
  const seen = new Set<string>();

  const tryAdd = (item?: ScoredMediaItem) => {
    if (!item) return;
    if (seen.has(item.url)) return;
    seen.add(item.url);
    selected.push(item);
  };

  const videoOnly = type !== "stills";

  const strictNature =
    working.find(
      (item) =>
        (!videoOnly || item.type === "video") &&
        isStrictFreedomRecurringCandidate(item)
    ) || undefined;

  const relaxedNature =
    working.find(
      (item) =>
        (!videoOnly || item.type === "video") &&
        !isStrictFreedomRecurringCandidate(item) &&
        isRelaxedFreedomRecurringCandidate(item)
    ) || undefined;

  const remoteLifestyle =
    working.find(
      (item) =>
        (!videoOnly || item.type === "video") &&
        hasStrictFreedomRemoteBlend(item._text)
    ) || undefined;

  const premiumLifestyle =
    working.find(
      (item) =>
        (!videoOnly || item.type === "video") &&
        containsAny(item._text, ["premium", "luxury", "travel", "remote work", "digital nomad"]) &&
        !hasFreedomRecurringBusinessHardBlock(item._text)
    ) || undefined;

  tryAdd(strictNature);
  tryAdd(relaxedNature);
  tryAdd(remoteLifestyle);
  tryAdd(premiumLifestyle);

  for (const item of working) {
    if (selected.length >= MAX_RESULTS) break;
    tryAdd(item);
  }

  return selected;
}

function ensureProductGuarantees(
  items: ScoredMediaItem[],
  type: MediaType
): ScoredMediaItem[] {
  const working = [...items];
  const selected: ScoredMediaItem[] = [];
  const seen = new Set<string>();
  const videoOnly = type !== "stills";

  const tryAdd = (item?: ScoredMediaItem) => {
    if (!item) return;
    if (seen.has(item.url)) return;
    seen.add(item.url);
    selected.push(item);
  };

  const cropSafeDemo =
    working.find(
      (item) =>
        (!videoOnly || item.type === "video") &&
        hasProductBridge(item._text) &&
        hasCropSafeProductSignal(item._text) &&
        (isStrongVertical(item.width, item.height) || isSquareish(item.width, item.height)) &&
        containsAny(item._text, ["demo", "hands", "holding", "showcase", "review", "use case"])
    ) || undefined;

  const cropSafeLifestyle =
    working.find(
      (item) =>
        (!videoOnly || item.type === "video") &&
        hasProductBridge(item._text) &&
        hasCropSafeProductSignal(item._text) &&
        containsAny(item._text, ["lifestyle", "creator", "ugc", "customer", "commercial", "premium"])
    ) || undefined;

  const cropSafePayoff =
    working.find(
      (item) =>
        (!videoOnly || item.type === "video") &&
        hasProductBridge(item._text) &&
        hasCropSafeProductSignal(item._text) &&
        containsAny(item._text, [
          "results",
          "transformation",
          "before after",
          "before and after",
          "testimonial",
        ])
    ) || undefined;

  const fallbackDemo =
    working.find(
      (item) =>
        (!videoOnly || item.type === "video") &&
        hasProductBridge(item._text) &&
        containsAny(item._text, ["demo", "hands", "holding", "showcase", "review", "use case"])
    ) || undefined;

  const fallbackLifestyle =
    working.find(
      (item) =>
        (!videoOnly || item.type === "video") &&
        hasProductBridge(item._text) &&
        containsAny(item._text, ["lifestyle", "creator", "ugc", "customer", "commercial", "premium"])
    ) || undefined;

  const fallbackPayoff =
    working.find(
      (item) =>
        (!videoOnly || item.type === "video") &&
        hasProductBridge(item._text) &&
        containsAny(item._text, [
          "results",
          "transformation",
          "before after",
          "before and after",
          "testimonial",
        ])
    ) || undefined;

  tryAdd(cropSafeDemo || fallbackDemo);
  tryAdd(cropSafeLifestyle || fallbackLifestyle);
  tryAdd(cropSafePayoff || fallbackPayoff);

  for (const item of working) {
    if (selected.length >= MAX_RESULTS) break;
    tryAdd(item);
  }

  return selected;
}

function ensureFunnelGuarantees(
  items: ScoredMediaItem[],
  type: MediaType
): ScoredMediaItem[] {
  const working = [...items];
  const selected: ScoredMediaItem[] = [];
  const seen = new Set<string>();
  const videoOnly = type !== "stills";

  const tryAdd = (item?: ScoredMediaItem) => {
    if (!item) return;
    if (seen.has(item.url)) return;
    seen.add(item.url);
    selected.push(item);
  };

  const funnelCore =
    working.find(
      (item) =>
        (!videoOnly || item.type === "video") &&
        hasFunnelBridge(item._text) &&
        containsAny(item._text, ["landing page", "sales funnel", "sales page", "conversion", "lead generation"])
    ) || undefined;

  const dashboardFounder =
    working.find(
      (item) =>
        (!videoOnly || item.type === "video") &&
        hasFunnelBridge(item._text) &&
        containsAny(item._text, ["dashboard", "analytics", "workspace", "laptop", "founder", "strategy"])
    ) || undefined;

  const premiumPayoff =
    working.find(
      (item) =>
        (!videoOnly || item.type === "video") &&
        hasFunnelBridge(item._text) &&
        containsAny(item._text, ["premium", "campaign", "marketing", "performance marketing", "business growth"])
    ) || undefined;

  tryAdd(funnelCore);
  tryAdd(dashboardFounder);
  tryAdd(premiumPayoff);

  for (const item of working) {
    if (selected.length >= MAX_RESULTS) break;
    tryAdd(item);
  }

  return selected;
}

function diversifyMedia(
  items: ScoredMediaItem[],
  intent: MediaIntent,
  type: MediaType,
  options?: {
    offerMode?: OfferMode;
    freedomRecurring?: boolean;
    forceNatureFreedomClip?: boolean;
  }
): ScoredMediaItem[] {
  const offerMode = normalizeOfferMode(options?.offerMode);
  const freedomRecurring = !!options?.freedomRecurring;
  const forceNatureFreedomClip = !!options?.forceNatureFreedomClip;

  const sourceCap: Record<string, number> = {
    videezy: 7,
    pixabay: 5,
    pexels: 5,
    fallback: 2,
  };

  const typeCap =
    type === "mixed"
      ? { video: 10, image: 6 }
      : type === "video"
      ? { video: 15, image: 0 }
      : { video: 0, image: 15 };

  const picked: ScoredMediaItem[] = [];
  const sourceCount = new Map<string, number>();
  const thematicBuckets = new Map<string, number>();
  const mediaTypeCount = new Map<string, number>();

  const getBucket = (text: string): string => {
    const syntheticItem: MediaItem = {
      source: "pexels",
      url: "https://placeholder.local/media.mp4",
      thumb: "",
      duration: 8,
      type: "video",
      title: text,
      tags: text.split(" "),
    };

    if (isNatureFreedomText(text)) return "nature_freedom";
    if (hasStrictFreedomRemoteBlend(text)) return "remote_freedom";
    if (!isNatureFreedomText(text) && !hasStrictFreedomRemoteBlend(text) && isRelaxedFreedomRecurringCandidate(syntheticItem)) {
      return "relaxed_freedom";
    }
    if (hasStrongNatureScene(text)) return "nature";
    if (containsAny(text, ["travel", "lifestyle", "digital nomad", "freedom", "luxury", "premium"])) return "lifestyle";
    if (containsAny(text, ["laptop", "remote work", "workspace", "computer"])) return "workspace";
    if (containsAny(text, ["entrepreneur", "business", "startup", "founder"])) return "business";
    if (containsAny(text, ["product", "demo", "showcase", "closeup", "review", "unboxing", "hands", "holding"])) {
      return "product_demo";
    }
    if (containsAny(text, ["landing page", "sales funnel", "conversion", "lead generation", "checkout", "crm"])) {
      return "funnel_marketing";
    }
    return "generic";
  };

  const bucketCap =
    freedomRecurring || forceNatureFreedomClip
      ? {
          nature_freedom: 7,
          remote_freedom: 4,
          relaxed_freedom: 4,
          nature: 3,
          lifestyle: 4,
          workspace: 1,
          business: 0,
          product_demo: 0,
          funnel_marketing: 0,
          generic: 1,
        }
      : offerMode === "product"
      ? {
          product_demo: 6,
          lifestyle: 4,
          workspace: 3,
          business: 3,
          funnel_marketing: 2,
          nature: 2,
          remote_freedom: 2,
          nature_freedom: 2,
          relaxed_freedom: 2,
          generic: 3,
        }
      : offerMode === "funnel"
      ? {
          funnel_marketing: 6,
          workspace: 4,
          business: 4,
          lifestyle: 3,
          product_demo: 2,
          nature: 2,
          remote_freedom: 2,
          nature_freedom: 2,
          relaxed_freedom: 2,
          generic: 3,
        }
      : intent === "freedom_lifestyle" || intent === "motivation"
      ? {
          nature_freedom: 4,
          remote_freedom: 4,
          relaxed_freedom: 4,
          nature: 4,
          workspace: 4,
          business: 4,
          lifestyle: 4,
          product_demo: 3,
          funnel_marketing: 3,
          generic: 3,
        }
      : {
          nature_freedom: 3,
          remote_freedom: 3,
          relaxed_freedom: 3,
          nature: 3,
          workspace: 5,
          business: 5,
          lifestyle: 3,
          product_demo: 3,
          funnel_marketing: 3,
          generic: 3,
        };

  let prioritizedItems = items;

  if (freedomRecurring || forceNatureFreedomClip) {
    prioritizedItems = ensureFreedomRecurringGuarantees(items, type);
  } else if (offerMode === "product") {
    prioritizedItems = ensureProductGuarantees(items, type);
  } else if (offerMode === "funnel") {
    prioritizedItems = ensureFunnelGuarantees(items, type);
  }

  for (const item of prioritizedItems) {
    if (!item.url) continue;

    const itemType = item.type === "image" ? "image" : "video";
    const currentTypeCount = mediaTypeCount.get(itemType) || 0;
    if (currentTypeCount >= (typeCap[itemType] ?? 0)) continue;

    const src = item.source;
    const srcCount = sourceCount.get(src) || 0;
    if (srcCount >= (sourceCap[src] ?? 4)) continue;

    const bucket = getBucket(item._text);
    const bucketCount = thematicBuckets.get(bucket) || 0;
    if (bucketCount >= (bucketCap[bucket as keyof typeof bucketCap] ?? 3)) continue;

    if ((freedomRecurring || forceNatureFreedomClip) && !isRelaxedFreedomRecurringCandidate(item)) {
      continue;
    }

    picked.push(item);
    sourceCount.set(src, srcCount + 1);
    thematicBuckets.set(bucket, bucketCount + 1);
    mediaTypeCount.set(itemType, currentTypeCount + 1);

    if (picked.length >= MAX_RESULTS) break;
  }

  return picked;
}

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

async function fetchWithTimeout(input: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function safeJson(response: Response): Promise<any | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function finalizeItem(item: MediaItem): MediaItem | null {
  if (!isHttpUrl(item.url)) return null;

  const finalized: MediaItem = {
    ...item,
    thumb: isHttpUrl(item.thumb) ? item.thumb : item.type === "image" ? item.url : "",
    duration: item.type === "video" ? Math.max(0, safeNumber(item.duration, 0)) : 0,
    width: safeNumber(item.width, 0) || undefined,
    height: safeNumber(item.height, 0) || undefined,
    tags: Array.isArray(item.tags)
      ? item.tags.map((t) => safeString(t)).filter(Boolean)
      : [],
    title: safeString(item.title, ""),
  };

  if (finalized.type === "video" && finalized.duration < MIN_VIDEO_DURATION) return null;
  return finalized;
}

async function fetchPexelsVideos(query: string, apiKey: string, page: number): Promise<MediaItem[]> {
  const r = await fetchWithTimeout(
    `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=12&page=${page}`,
    {
      headers: { Authorization: apiKey },
    }
  );

  if (!r.ok) return [];

  const json = await safeJson(r);
  if (!Array.isArray(json?.videos)) return [];

  return json.videos
    .map((v: any) => {
      const files = Array.isArray(v?.video_files) ? v.video_files : [];
      const best =
        files.find((f: any) => f?.quality === "hd" && safeNumber(f?.height) >= 960) ||
        files.find((f: any) => f?.quality === "hd" && safeNumber(f?.width) >= 720) ||
        files.find((f: any) => f?.quality === "sd") ||
        files[0];

      return finalizeItem({
        source: "pexels",
        type: "video",
        url: safeString(best?.link),
        thumb: safeString(v?.image),
        duration: safeNumber(v?.duration),
        width: safeNumber(best?.width),
        height: safeNumber(best?.height),
        tags: Array.isArray(v?.tags) ? v.tags : [],
        title: safeString(v?.url || v?.user?.name || ""),
      });
    })
    .filter((item): item is MediaItem => item !== null);
}

async function fetchPixabayVideos(query: string, apiKey: string, page: number): Promise<MediaItem[]> {
  const r = await fetchWithTimeout(
    `https://pixabay.com/api/videos/?key=${apiKey}&q=${encodeURIComponent(query)}&per_page=12&page=${page}`
  );

  if (!r.ok) return [];

  const json = await safeJson(r);
  if (!Array.isArray(json?.hits)) return [];

  return json.hits
    .map((h: any) =>
      finalizeItem({
        source: "pixabay",
        type: "video",
        url:
          safeString(h?.videos?.large?.url) ||
          safeString(h?.videos?.medium?.url) ||
          safeString(h?.videos?.small?.url),
        thumb: safeString(h?.videos?.tiny?.thumbnail) || safeString(h?.userImageURL || ""),
        duration: safeNumber(h?.duration),
        width: safeNumber(h?.videos?.large?.width || h?.videos?.medium?.width),
        height: safeNumber(h?.videos?.large?.height || h?.videos?.medium?.height),
        tags: safeString(h?.tags)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        title: safeString(h?.tags || h?.user || ""),
      })
    )
    .filter((item): item is MediaItem => item !== null);
}

async function fetchPexelsImages(query: string, apiKey: string, page: number): Promise<MediaItem[]> {
  const r = await fetchWithTimeout(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=12&page=${page}&orientation=portrait`,
    {
      headers: { Authorization: apiKey },
    }
  );

  if (!r.ok) return [];

  const json = await safeJson(r);
  if (!Array.isArray(json?.photos)) return [];

  return json.photos
    .map((p: any) =>
      finalizeItem({
        source: "pexels",
        type: "image",
        url: safeString(p?.src?.large2x || p?.src?.large || p?.src?.original),
        thumb: safeString(p?.src?.medium || p?.src?.small || p?.src?.tiny),
        duration: 0,
        width: safeNumber(p?.width),
        height: safeNumber(p?.height),
        tags: [],
        title: safeString(p?.alt || p?.photographer || ""),
      })
    )
    .filter((item): item is MediaItem => item !== null);
}

async function fetchPixabayImages(query: string, apiKey: string, page: number): Promise<MediaItem[]> {
  const r = await fetchWithTimeout(
    `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&image_type=photo&orientation=vertical&per_page=12&page=${page}`
  );

  if (!r.ok) return [];

  const json = await safeJson(r);
  if (!Array.isArray(json?.hits)) return [];

  return json.hits
    .map((h: any) =>
      finalizeItem({
        source: "pixabay",
        type: "image",
        url: safeString(h?.largeImageURL || h?.webformatURL || h?.previewURL),
        thumb: safeString(h?.webformatURL || h?.previewURL || h?.largeImageURL),
        duration: 0,
        width: safeNumber(h?.imageWidth),
        height: safeNumber(h?.imageHeight),
        tags: safeString(h?.tags)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        title: safeString(h?.tags || h?.user || ""),
      })
    )
    .filter((item): item is MediaItem => item !== null);
}

async function fetchVideezyCache(
  supabaseUrl: string,
  supabaseKey: string,
  hash: number
): Promise<MediaItem[]> {
  const r = await fetchWithTimeout(`${supabaseUrl}/rest/v1/videezy_assets?select=*`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });

  if (!r.ok) return [];

  const json = await safeJson(r);
  if (!Array.isArray(json) || json.length === 0) return [];

  const startIndex = hash % json.length;
  const picked: MediaItem[] = [];

  for (let i = 0; i < 24 && i < json.length; i++) {
    const idx = (startIndex + i) % json.length;
    const item = json[idx];

    const finalized = finalizeItem({
      source: "videezy",
      type: "video",
      url: safeString(item?.video_url),
      thumb: safeString(item?.thumbnail_url),
      duration: safeNumber(item?.duration),
      width: safeNumber(item?.width),
      height: safeNumber(item?.height),
      tags: Array.isArray(item?.tags)
        ? item.tags
        : safeString(item?.tags)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
      title: safeString(item?.title || item?.name || item?.query || ""),
    });

    if (finalized) picked.push(finalized);
  }

  return picked;
}

async function fetchExtraQueryBatches(params: {
  queries: string[];
  type: MediaType;
  hash: number;
  pexelsKey: string;
  pixabayKey: string;
}): Promise<MediaItem[]> {
  const { queries, type, hash, pexelsKey, pixabayKey } = params;

  const tasks: Array<Promise<MediaItem[] | null>> = [];

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    const pexelsPage = ((hash + i + 7) % 4) + 1;
    const pixabayPage = (((hash >> 2) + i + 7) % 4) + 1;

    if ((type === "video" || type === "mixed") && pexelsKey) {
      tasks.push(safe(() => fetchPexelsVideos(q, pexelsKey, pexelsPage)));
    }

    if ((type === "video" || type === "mixed") && pixabayKey) {
      tasks.push(safe(() => fetchPixabayVideos(q, pixabayKey, pixabayPage)));
    }

    if ((type === "stills" || type === "mixed") && pexelsKey) {
      tasks.push(safe(() => fetchPexelsImages(q, pexelsKey, pexelsPage)));
    }

    if ((type === "stills" || type === "mixed") && pixabayKey) {
      tasks.push(safe(() => fetchPixabayImages(q, pixabayKey, pixabayPage)));
    }
  }

  const results = await Promise.all(tasks);
  const out: MediaItem[] = [];

  for (const batch of results) {
    if (Array.isArray(batch)) out.push(...batch);
  }

  return dedupeMedia(out);
}

function buildFallback(type: MediaType): MediaItem[] {
  if (type === "stills") {
    return [
      {
        source: "fallback",
        type: "image",
        url: "https://public.autoaffi.com/fallback/thumb1.jpg",
        thumb: "https://public.autoaffi.com/fallback/thumb1.jpg",
        duration: 0,
      },
    ];
  }

  if (type === "video") {
    return [
      {
        source: "fallback",
        type: "video",
        url: "https://public.autoaffi.com/fallback/fallback1.mp4",
        thumb: "https://public.autoaffi.com/fallback/thumb1.jpg",
        duration: 8,
      },
    ];
  }

  return [
    {
      source: "fallback",
      type: "video",
      url: "https://public.autoaffi.com/fallback/fallback1.mp4",
      thumb: "https://public.autoaffi.com/fallback/thumb1.jpg",
      duration: 8,
    },
    {
      source: "fallback",
      type: "image",
      url: "https://public.autoaffi.com/fallback/thumb1.jpg",
      thumb: "https://public.autoaffi.com/fallback/thumb1.jpg",
      duration: 0,
    },
  ];
}

function ensureAtLeastOneNatureFreedomClip(
  combined: MediaItem[],
  scored: ScoredMediaItem[],
  type: MediaType,
  active: boolean
): MediaItem[] {
  if (!active) return combined;
  if (type === "stills") return combined;

  const alreadyHas = combined.some(
    (item) => item.type === "video" && isRelaxedFreedomRecurringCandidate(item)
  );

  if (alreadyHas) return combined;

  const candidate =
    scored.find(
      (item) =>
        item.type === "video" &&
        isStrictFreedomRecurringCandidate(item)
    ) ||
    scored.find(
      (item) =>
        item.type === "video" &&
        isRelaxedFreedomRecurringCandidate(item)
    ) ||
    undefined;

  if (!candidate) return combined;

  const current = [...combined];
  const existing = new Set(current.map((item) => item.url));

  if (existing.has(candidate.url)) return current;

  const replaceIndex =
    current.findIndex(
      (item) =>
        item.type === "video" &&
        !isRelaxedFreedomRecurringCandidate(item)
    ) >= 0
      ? current.findIndex(
          (item) =>
            item.type === "video" &&
            !isRelaxedFreedomRecurringCandidate(item)
        )
      : current.findIndex((item) => !isRelaxedFreedomRecurringCandidate(item));

  if (replaceIndex >= 0) {
    current.splice(replaceIndex, 1, {
      source: candidate.source,
      url: candidate.url,
      thumb: candidate.thumb,
      duration: candidate.duration,
      width: candidate.width,
      height: candidate.height,
      tags: candidate.tags,
      title: candidate.title,
      type: candidate.type,
    });
    return current.slice(0, MAX_RESULTS);
  }

  current.push({
    source: candidate.source,
    url: candidate.url,
    thumb: candidate.thumb,
    duration: candidate.duration,
    width: candidate.width,
    height: candidate.height,
    tags: candidate.tags,
    title: candidate.title,
    type: candidate.type,
  });

  return current.slice(0, MAX_RESULTS);
}

function ensureAtLeastOneProductWowClip(
  combined: MediaItem[],
  scored: ScoredMediaItem[],
  type: MediaType,
  active: boolean
): MediaItem[] {
  if (!active) return combined;
  if (type === "stills") return combined;

  const alreadyHas = combined.some(
    (item) =>
      item.type === "video" &&
      hasProductBridge(extractTerms(item)) &&
      (
        hasCropSafeProductSignal(extractTerms(item)) ||
        isStrongVertical(item.width, item.height) ||
        isSquareish(item.width, item.height)
      )
  );

  if (alreadyHas) return combined;

  const candidate =
    scored.find(
      (item) =>
        item.type === "video" &&
        hasProductBridge(item._text) &&
        hasCropSafeProductSignal(item._text) &&
        !hasCropRiskSignal(item._text) &&
        (isStrongVertical(item.width, item.height) || isSquareish(item.width, item.height)) &&
        containsAny(item._text, ["demo", "hands", "holding", "showcase", "review", "use case"])
    ) ||
    scored.find(
      (item) =>
        item.type === "video" &&
        hasProductBridge(item._text) &&
        hasCropSafeProductSignal(item._text) &&
        !hasCropRiskSignal(item._text)
    ) ||
    scored.find(
      (item) =>
        item.type === "video" &&
        hasProductBridge(item._text)
    );

  if (!candidate) return combined;

  const current = [...combined];
  const existing = new Set(current.map((item) => item.url));
  if (existing.has(candidate.url)) return current;

  const replaceIndex =
    current.findIndex(
      (item) =>
        item.type === "video" &&
        (
          !hasProductBridge(extractTerms(item)) ||
          hasCropRiskSignal(extractTerms(item)) ||
          isUltraWide(item.width, item.height)
        )
    ) >= 0
      ? current.findIndex(
          (item) =>
            item.type === "video" &&
            (
              !hasProductBridge(extractTerms(item)) ||
              hasCropRiskSignal(extractTerms(item)) ||
              isUltraWide(item.width, item.height)
            )
        )
      : current.findIndex(
          (item) =>
            !hasProductBridge(extractTerms(item)) ||
            hasCropRiskSignal(extractTerms(item))
        );

  if (replaceIndex >= 0) {
    current.splice(replaceIndex, 1, {
      source: candidate.source,
      url: candidate.url,
      thumb: candidate.thumb,
      duration: candidate.duration,
      width: candidate.width,
      height: candidate.height,
      tags: candidate.tags,
      title: candidate.title,
      type: candidate.type,
    });
    return current.slice(0, MAX_RESULTS);
  }

  current.push({
    source: candidate.source,
    url: candidate.url,
    thumb: candidate.thumb,
    duration: candidate.duration,
    width: candidate.width,
    height: candidate.height,
    tags: candidate.tags,
    title: candidate.title,
    type: candidate.type,
  });

  return current.slice(0, MAX_RESULTS);
}

function ensureAtLeastOneFunnelWowClip(
  combined: MediaItem[],
  scored: ScoredMediaItem[],
  type: MediaType,
  active: boolean
): MediaItem[] {
  if (!active) return combined;
  if (type === "stills") return combined;

  const alreadyHas = combined.some(
    (item) => item.type === "video" && hasFunnelBridge(extractTerms(item))
  );

  if (alreadyHas) return combined;

  const candidate =
    scored.find(
      (item) =>
        item.type === "video" &&
        hasFunnelBridge(item._text) &&
        containsAny(item._text, ["landing page", "sales funnel", "conversion", "lead generation", "dashboard", "campaign"])
    ) ||
    scored.find(
      (item) =>
        item.type === "video" &&
        hasFunnelBridge(item._text)
    );

  if (!candidate) return combined;

  const current = [...combined];
  const existing = new Set(current.map((item) => item.url));
  if (existing.has(candidate.url)) return current;

  const replaceIndex =
    current.findIndex(
      (item) => item.type === "video" && !hasFunnelBridge(extractTerms(item))
    ) >= 0
      ? current.findIndex(
          (item) => item.type === "video" && !hasFunnelBridge(extractTerms(item))
        )
      : current.findIndex((item) => !hasFunnelBridge(extractTerms(item)));

  if (replaceIndex >= 0) {
    current.splice(replaceIndex, 1, {
      source: candidate.source,
      url: candidate.url,
      thumb: candidate.thumb,
      duration: candidate.duration,
      width: candidate.width,
      height: candidate.height,
      tags: candidate.tags,
      title: candidate.title,
      type: candidate.type,
    });
    return current.slice(0, MAX_RESULTS);
  }

  current.push({
    source: candidate.source,
    url: candidate.url,
    thumb: candidate.thumb,
    duration: candidate.duration,
    width: candidate.width,
    height: candidate.height,
    tags: candidate.tags,
    title: candidate.title,
    type: candidate.type,
  });

  return current.slice(0, MAX_RESULTS);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const rawQuery = safeString(body?.query);
    const type = normalizeMediaType(body?.type);
    const seed = body?.seed;

    const offerMode = normalizeOfferMode(
      body?.offerMode ??
        body?.renderHints?.offerMode ??
        body?.offerMeta?.mode ??
        body?.selectedOffer?.mode
    );

    const freedomRecurring = !!(
      body?.freedomRecurring ??
      body?.renderHints?.freedomRecurring
    );

    const forceNatureFreedomClip = !!(
      body?.forceNatureFreedomClip ??
      body?.renderHints?.forceNatureFreedomClip
    );

    if (!rawQuery) {
      return NextResponse.json({
        ok: true,
        intent: "generic",
        queries: [],
        combined: buildFallback(type),
      });
    }

    const PEXELS_KEY = process.env.PEXELS_API_KEY || "";
    const PIXABAY_KEY = process.env.PIXABAY_API_KEY || "";
    const SUPABASE_URL =
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const SUPABASE_KEY =
      process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

    const hash = hashSeed(seed ?? rawQuery);

    const detectedIntent = detectIntent(rawQuery);
    const intent: MediaIntent =
      freedomRecurring || forceNatureFreedomClip
        ? "freedom_lifestyle"
        : offerMode === "product"
        ? "product_generic"
        : offerMode === "funnel"
        ? "marketing_funnel"
        : detectedIntent;

    const queries = buildSearchQueries(rawQuery, intent, {
      offerMode,
      freedomRecurring,
      forceNatureFreedomClip,
    }).slice(0, MAX_QUERY_VARIANTS);

    let all: MediaItem[] = [];

    const globalTasks: Array<Promise<MediaItem[] | null>> = [];

    if ((type === "video" || type === "mixed") && SUPABASE_URL && SUPABASE_KEY) {
      globalTasks.push(safe(() => fetchVideezyCache(SUPABASE_URL, SUPABASE_KEY, hash)));
    }

    for (let i = 0; i < queries.length; i++) {
      const q = queries[i];
      const pexelsPage = ((hash + i) % 4) + 1;
      const pixabayPage = (((hash >> 2) + i) % 4) + 1;

      if ((type === "video" || type === "mixed") && PEXELS_KEY) {
        globalTasks.push(safe(() => fetchPexelsVideos(q, PEXELS_KEY, pexelsPage)));
      }

      if ((type === "video" || type === "mixed") && PIXABAY_KEY) {
        globalTasks.push(safe(() => fetchPixabayVideos(q, PIXABAY_KEY, pixabayPage)));
      }

      if ((type === "stills" || type === "mixed") && PEXELS_KEY) {
        globalTasks.push(safe(() => fetchPexelsImages(q, PEXELS_KEY, pexelsPage)));
      }

      if ((type === "stills" || type === "mixed") && PIXABAY_KEY) {
        globalTasks.push(safe(() => fetchPixabayImages(q, PIXABAY_KEY, pixabayPage)));
      }
    }

    const taskResults = await Promise.all(globalTasks);

    for (const batch of taskResults) {
      if (Array.isArray(batch)) all.push(...batch);
    }

    all = dedupeMedia(all)
      .filter((m) => isHttpUrl(m.url))
      .map((item) =>
        enrichMediaItemForIntent(item, {
          rawQuery,
          intent,
          offerMode,
          freedomRecurring,
          forceNatureFreedomClip,
        })
      );

    if (type === "video") {
      all = all.filter((m) => m.type === "video" && m.duration >= MIN_VIDEO_DURATION);
    }

    if (type === "stills") {
      all = all.filter((m) => m.type === "image");
    }

    if (type === "mixed") {
      all = all.filter(
        (m) => (m.type === "video" && m.duration >= MIN_VIDEO_DURATION) || m.type === "image"
      );
    }

    let scored: ScoredMediaItem[] = all
      .filter((item) =>
        !hardBlockItem(item, intent, {
          offerMode,
          freedomRecurring,
          forceNatureFreedomClip,
        })
      )
      .map((item) =>
        toScored(
          item,
          scoreMediaItem(item, intent, rawQuery, {
            offerMode,
            freedomRecurring,
            forceNatureFreedomClip,
          })
        )
      )
      .filter((item) => item._score > -10)
      .sort((a, b) => b._score - a._score);

    if ((freedomRecurring || forceNatureFreedomClip) && type !== "stills") {
      const strictNatureVideos = scored.filter(
        (item) =>
          item.type === "video" &&
          isStrictFreedomRecurringCandidate(item)
      );

      const relaxedNatureVideos = scored.filter(
        (item) =>
          item.type === "video" &&
          isRelaxedFreedomRecurringCandidate(item)
      );

      if (strictNatureVideos.length < 4 && relaxedNatureVideos.length < 6) {
        const extraNature = await fetchExtraQueryBatches({
          queries: buildStrictNatureFreedomQueries(rawQuery),
          type: "video",
          hash: hash + 101,
          pexelsKey: PEXELS_KEY,
          pixabayKey: PIXABAY_KEY,
        });

        all = dedupeMedia([
          ...all,
          ...extraNature.map((item) =>
            enrichMediaItemForIntent(item, {
              rawQuery,
              intent,
              offerMode,
              freedomRecurring,
              forceNatureFreedomClip,
            })
          ),
        ]);

        scored = all
          .filter((item) =>
            !hardBlockItem(item, intent, {
              offerMode,
              freedomRecurring,
              forceNatureFreedomClip,
            })
          )
          .map((item) =>
            toScored(
              item,
              scoreMediaItem(item, intent, rawQuery, {
                offerMode,
                freedomRecurring,
                forceNatureFreedomClip,
              })
            )
          )
          .filter((item) => item._score > -10)
          .sort((a, b) => b._score - a._score);
      }

      const strictOnlyVideos = scored.filter(
        (item) => item.type === "video" && isStrictFreedomRecurringCandidate(item)
      );

      const relaxedOnlyVideos = scored.filter(
        (item) => item.type === "video" && isRelaxedFreedomRecurringCandidate(item)
      );

      if (strictOnlyVideos.length >= 4) {
        scored = strictOnlyVideos;
      } else if (relaxedOnlyVideos.length >= 4) {
        scored = relaxedOnlyVideos;
      }
    }

    if (offerMode === "product" && type !== "stills") {
      const hasProductVideo = scored.some(
        (item) => item.type === "video" && hasProductBridge(item._text)
      );

      if (!hasProductVideo) {
        const extraProduct = await fetchExtraQueryBatches({
          queries: buildStrictProductWowQueries(rawQuery),
          type: "video",
          hash: hash + 211,
          pexelsKey: PEXELS_KEY,
          pixabayKey: PIXABAY_KEY,
        });

        all = dedupeMedia([
          ...all,
          ...extraProduct.map((item) =>
            enrichMediaItemForIntent(item, {
              rawQuery,
              intent,
              offerMode,
              freedomRecurring,
              forceNatureFreedomClip,
            })
          ),
        ]);

        scored = all
          .filter((item) =>
            !hardBlockItem(item, intent, {
              offerMode,
              freedomRecurring,
              forceNatureFreedomClip,
            })
          )
          .map((item) =>
            toScored(
              item,
              scoreMediaItem(item, intent, rawQuery, {
                offerMode,
                freedomRecurring,
                forceNatureFreedomClip,
              })
            )
          )
          .filter((item) => item._score > -10)
          .sort((a, b) => b._score - a._score);
      }
    }

    if (offerMode === "funnel" && type !== "stills") {
      const hasFunnelVideo = scored.some(
        (item) => item.type === "video" && hasFunnelBridge(item._text)
      );

      if (!hasFunnelVideo) {
        const extraFunnel = await fetchExtraQueryBatches({
          queries: buildStrictFunnelWowQueries(rawQuery),
          type: "video",
          hash: hash + 307,
          pexelsKey: PEXELS_KEY,
          pixabayKey: PIXABAY_KEY,
        });

        all = dedupeMedia([
          ...all,
          ...extraFunnel.map((item) =>
            enrichMediaItemForIntent(item, {
              rawQuery,
              intent,
              offerMode,
              freedomRecurring,
              forceNatureFreedomClip,
            })
          ),
        ]);

        scored = all
          .filter((item) =>
            !hardBlockItem(item, intent, {
              offerMode,
              freedomRecurring,
              forceNatureFreedomClip,
            })
          )
          .map((item) =>
            toScored(
              item,
              scoreMediaItem(item, intent, rawQuery, {
                offerMode,
                freedomRecurring,
                forceNatureFreedomClip,
              })
            )
          )
          .filter((item) => item._score > -10)
          .sort((a, b) => b._score - a._score);
      }
    }

    const diversified = diversifyMedia(scored, intent, type, {
      offerMode,
      freedomRecurring,
      forceNatureFreedomClip,
    });

    let combined = diversified.map(({ _score, _text, ...rest }) => rest);

    if (combined.length < 8) {
      const topUps = scored
        .filter((item) => !combined.some((c) => c.url === item.url))
        .slice(0, 8 - combined.length)
        .map(({ _score, _text, ...rest }) => rest);

      combined = [...combined, ...topUps];
    }

    combined = ensureAtLeastOneNatureFreedomClip(
      combined,
      scored,
      type,
      freedomRecurring || forceNatureFreedomClip
    );

    combined = ensureAtLeastOneProductWowClip(
      combined,
      scored,
      type,
      offerMode === "product"
    );

    combined = ensureAtLeastOneFunnelWowClip(
      combined,
      scored,
      type,
      offerMode === "funnel"
    );

    if (offerMode === "recurring" && (freedomRecurring || forceNatureFreedomClip)) {
      combined = ensureVideoFirstFreedomRecurring(
        combined,
        scored,
        type,
        true
      );

      const strictVideoCount = combined.filter(
        (item) => item.type === "video" && isStrictFreedomRecurringCandidate(item)
      ).length;

      const relaxedVideoCount = combined.filter(
        (item) => item.type === "video" && isRelaxedFreedomRecurringCandidate(item)
      ).length;

      if (strictVideoCount >= 3) {
        const strictFirst = combined.filter(
          (item) =>
            item.type === "video" &&
            isStrictFreedomRecurringCandidate(item)
        );

        const fillers = combined.filter(
          (item) =>
            !strictFirst.some((x) => x.url === item.url) &&
            item.type === "video"
        );

        combined = [...strictFirst, ...fillers].slice(0, MAX_RESULTS);
      } else if (relaxedVideoCount >= 4) {
        const relaxedFirst = combined.filter(
          (item) =>
            item.type === "video" &&
            isRelaxedFreedomRecurringCandidate(item)
        );

        const fillers = combined.filter(
          (item) =>
            !relaxedFirst.some((x) => x.url === item.url) &&
            item.type === "video"
        );

        combined = [...relaxedFirst, ...fillers].slice(0, MAX_RESULTS);
      } else {
        const fallbackFreedomSet = ensureMinimumFreedomVideoSet(scored, scored, 4, MAX_RESULTS);
        if (fallbackFreedomSet.length > 0) {
          combined = fallbackFreedomSet;
        }
      }
    }

    combined = combined.slice(0, MAX_RESULTS);

    if (offerMode === "recurring" && (freedomRecurring || forceNatureFreedomClip) && type !== "stills") {
      const videoCount = combined.filter((item) => item.type === "video").length;

      if (videoCount < 4) {
        const emergencyFreedomVideos = ensureMinimumFreedomVideoSet(scored, scored, 4, MAX_RESULTS);
        if (emergencyFreedomVideos.length > 0) {
          combined = emergencyFreedomVideos;
        }
      }

      const nonStillCombined = combined.filter(
        (item) => item.type === "video" && isRelaxedFreedomRecurringCandidate(item)
      );

      if (nonStillCombined.length > 0) {
        combined = nonStillCombined.slice(0, MAX_RESULTS);
      }
    }

    if (combined.length === 0) {
      combined = buildFallback(type);
    }

    return NextResponse.json({
      ok: true,
      intent,
      queries,
      combined,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Media fetch failed",
        combined: buildFallback("mixed"),
      },
      { status: 500 }
    );
  }
}