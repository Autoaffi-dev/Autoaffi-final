import {
  isIdentifierLikeProductTitle,
  isPromotionalProductCopy,
  isUnknownProductCategory,
} from "./reelsProductIdentity";

export type ProductMediaOfferInput = {
  name?: string | null;
  category?: string | null;
  description?: string | null;
  mode?: string | null;
};

export type ProductObjectAnchors = {
  tokens: string[];
  phrases: string[];
};

export type ProductMediaRole = "strong" | "use_case" | "contextual" | "neutral" | "none";

export type ProductSearchTierId = "A" | "B" | "C" | "D" | "neutral";

export type ProductSearchTier = {
  tier: ProductSearchTierId;
  queries: string[];
};

export type ProductSearchProvenance = {
  tier?: ProductSearchTierId | null;
};

export type ProductDiscoveryCounts = {
  strong: number;
  useCase: number;
  contextual: number;
};

export type ProductSearchStage = {
  tier: ProductSearchTierId;
  page: number;
  queries: string[];
};

export const REEL_SAFE_FALLBACK_VIDEO_URL =
  "https://public.autoaffi.com/fallback/fallback1.mp4";
export const REEL_SAFE_FALLBACK_THUMB_URL =
  "https://public.autoaffi.com/fallback/thumb1.jpg";

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "for",
  "with",
  "to",
  "in",
  "on",
  "at",
  "by",
  "from",
  "as",
  "is",
  "it",
  "this",
  "that",
  "your",
  "our",
]);

export const GENERIC_PRODUCT_QUERY_NOISE = [
  "modern workflow",
  "digital tool",
  "creator setup",
  "product demo",
  "hands using tool",
  "before after",
  "before after improvement",
  "clean result",
  "ugc lifestyle",
  "isolated showcase",
  "hands using product",
  "hands holding",
] as const;

const MEDIA_NOISE_TOKENS = new Set([
  "product",
  "demo",
  "hands",
  "using",
  "tool",
  "tools",
  "digital",
  "modern",
  "workflow",
  "creator",
  "setup",
  "ugc",
  "showcase",
  "results",
  "result",
  "before",
  "after",
  "improvement",
  "clean",
  "premium",
  "commercial",
  "closeup",
  "review",
  "lifestyle",
  "customer",
  "experience",
  "social",
  "media",
  "isolated",
  "transformation",
  "vibe",
  "best",
  "amazing",
  "quality",
  "shipping",
  "free",
  "sale",
  "hot",
  "deal",
  "anyone",
  "wants",
  "choice",
  "uncategorized",
  "unknown",
  "n/a",
  "na",
  "sku",
  "asin",
  "ean",
  "upc",
  "id",
  "http",
  "https",
  "www",
  "com",
]);

const CONTEXT_ONLY_TOKENS = new Set([
  "fitness",
  "sports",
  "beauty",
  "outdoor",
  "software",
  "digital",
  "lifestyle",
  "creator",
  "gym",
  "workout",
  "training",
  "athlete",
  "athletic",
  "nature",
  "forest",
  "camping",
  "trail",
  "hiking",
  "kitchen",
  "food",
  "cooking",
  "skincare",
  "cosmetics",
  "makeup",
  "saas",
  "app",
  "ai",
  "laptop",
  "computer",
  "dashboard",
  "screen",
  "ui",
  "mobile",
  "exercise",
  "fashion",
  "street",
  "woman",
  "man",
  "people",
  "person",
]);

const PHYSICAL_OBJECT_LEXICON = new Set([
  "bag",
  "duffel",
  "backpack",
  "earbuds",
  "earbud",
  "headphones",
  "headphone",
  "bottle",
  "poles",
  "pole",
  "serum",
]);

const SPECIFIC_OBJECT_TOKENS = new Set([
  "duffel",
  "backpack",
  "earbuds",
  "earbud",
  "headphones",
  "headphone",
  "serum",
]);

const AMBIGUOUS_OBJECT_TOKENS = new Set(["bag", "bottle", "pole", "poles"]);

const DIGITAL_HINT_TOKENS = new Set([
  "software",
  "saas",
  "app",
  "platform",
  "scheduler",
  "dashboard",
  "editor",
]);

const BAG_CONFLICT_TOKENS = new Set([
  "purse",
  "handbag",
  "clutch",
  "crossbody",
  "evening",
]);

const USE_CASE_ACTION_TOKENS = new Set([
  "packing",
  "preparing",
  "carrying",
  "applying",
  "using",
  "drinking",
  "listening",
  "filling",
  "loading",
  "wearing",
  "putting",
  "ready",
]);

const PRODUCT_ROLE_RANK: Record<ProductMediaRole, number> = {
  strong: 0,
  use_case: 1,
  contextual: 2,
  neutral: 3,
  none: 4,
};

const VISUAL_SYNONYMS: Record<string, string[]> = {
  gym: ["fitness", "workout", "sports"],
  fitness: ["gym", "workout", "sports"],
  workout: ["gym", "fitness", "sports"],
  sports: ["fitness", "gym", "athletic"],
  bag: ["duffel", "backpack"],
  duffel: ["bag"],
  beauty: ["skincare", "cosmetics", "makeup"],
  skincare: ["beauty", "cosmetics"],
  cosmetics: ["beauty", "makeup", "skincare"],
  makeup: ["beauty", "cosmetics"],
  outdoor: ["hiking", "camping", "trail", "nature"],
  hiking: ["outdoor", "trail", "nature", "forest"],
  camping: ["outdoor", "nature", "tent", "forest"],
  trail: ["hiking", "outdoor"],
  nature: ["outdoor", "trail"],
  kitchen: ["food", "cooking"],
  food: ["kitchen", "cooking"],
  cooking: ["kitchen", "food"],
  software: ["laptop", "computer", "dashboard", "screen", "ui"],
  saas: ["software", "laptop", "dashboard", "computer"],
  app: ["software", "laptop", "mobile", "screen"],
  ai: ["software", "laptop", "computer"],
  laptop: ["computer", "screen", "software"],
  computer: ["laptop", "screen", "software"],
};

const CONCEPT_FAMILY: Record<string, string> = {
  gym: "gym",
  fitness: "gym",
  workout: "gym",
  sports: "gym",
  athletic: "gym",
  athlete: "gym",
  training: "gym",
  exercise: "gym",
  bag: "bag",
  duffel: "bag",
  backpack: "bag",
  beauty: "beauty",
  cosmetics: "beauty",
  makeup: "beauty",
  skincare: "skincare",
  outdoor: "outdoor",
  nature: "outdoor",
  forest: "outdoor",
  camping: "outdoor",
  tent: "outdoor",
  hiking: "hiking",
  trail: "hiking",
  kitchen: "kitchen",
  food: "kitchen",
  cooking: "kitchen",
  software: "software",
  saas: "software",
  app: "software",
  ai: "software",
  laptop: "computer",
  computer: "computer",
  dashboard: "ui",
  screen: "ui",
  ui: "ui",
  mobile: "ui",
  earbuds: "audio",
  earbud: "audio",
  headphones: "audio",
  headphone: "audio",
  bottle: "bottle",
  poles: "poles",
  pole: "poles",
  serum: "serum",
};

export const GRAPHIC_STOCK_SAFETY_PATTERNS = [
  /\bused tampon\b/,
  /\bused sanitary(?: pad)?\b/,
  /\bused pad\b/,
  /\bvisible blood\b/,
  /\bblood stain\b/,
  /\bblood soaked\b/,
  /\bbloody wound\b/,
  /\bopen wound\b/,
  /\bgore\b/,
  /\bgory\b/,
  /\bbodily fluid\b/,
  /\bbody fluid\b/,
  /\bfeces\b/,
  /\bvomit\b/,
  /\bpus\b/,
] as const;

function normalizeText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeMediaText(value: unknown): string[] {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token) && !MEDIA_NOISE_TOKENS.has(token));
}

function uniqueTokens(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const token = normalizeText(value);
    if (!token || seen.has(token)) continue;
    seen.add(token);
    out.push(token);
  }
  return out;
}

function expandVisualSynonyms(tokens: string[]): string[] {
  const extra: string[] = [];
  for (const token of tokens) {
    extra.push(...(VISUAL_SYNONYMS[token] || []));
  }
  return uniqueTokens([...tokens, ...extra]);
}

function extractDescriptionTerms(description: unknown): string[] {
  const clean = String(description || "").trim();
  if (!clean || isPromotionalProductCopy(clean)) return [];

  const sentence = (clean.split(/[.!?]/)[0] || clean).trim();
  if (isPromotionalProductCopy(sentence)) return [];

  return tokenizeMediaText(sentence).slice(0, 8);
}

export function buildVerifiedProductMediaTerms(input: ProductMediaOfferInput): string[] {
  const name = String(input.name || "").trim();
  const category = String(input.category || "").trim();
  const description = String(input.description || "").trim();

  const fromName = isIdentifierLikeProductTitle(name) ? [] : tokenizeMediaText(name);
  const fromCategory = isUnknownProductCategory(category) ? [] : tokenizeMediaText(category);
  const fromDescription = extractDescriptionTerms(description);

  return uniqueTokens([...fromName, ...fromCategory, ...fromDescription]);
}

export function buildProductMediaQuery(input: ProductMediaOfferInput): string {
  if (hasPhysicalProductObjectAnchors(input) && !isDigitalProduct(input)) {
    return buildProductDiscoveryTiers(input).find((tier) => tier.tier === "A")?.queries[0] || "";
  }

  const verified = buildVerifiedProductMediaTerms(input);
  const expanded = expandVisualSynonyms(verified).slice(0, 12);
  return expanded.join(" ").trim();
}

export function buildProductSearchQueryVariants(input: ProductMediaOfferInput): string[] {
  if (hasPhysicalProductObjectAnchors(input) && !isDigitalProduct(input)) {
    return buildProductDiscoveryTiers(input)
      .filter((tier) => tier.tier === "A" || tier.tier === "B")
      .flatMap((tier) => tier.queries)
      .slice(0, 6);
  }

  const verified = buildVerifiedProductMediaTerms(input);
  const primary = buildProductMediaQuery(input);
  const has = (...needles: string[]) => needles.some((needle) => verified.includes(needle));

  const variants: string[] = [primary];

  if (has("beauty", "skincare", "cosmetics", "makeup")) {
    variants.push("skincare application", "beauty routine");
  } else if (has("outdoor", "hiking", "camping", "trail")) {
    variants.push("hiking outdoor trail", "camping outdoor nature");
  } else if (has("software", "saas", "app", "ai", "laptop", "computer")) {
    variants.push("software laptop dashboard", "computer screen interface");
  } else if (has("kitchen", "food", "cooking")) {
    variants.push("kitchen food cooking");
  }

  return uniqueTokens(variants.filter(Boolean)).slice(0, 6);
}

function conceptFamily(token: string): string {
  return CONCEPT_FAMILY[token] || token;
}

function nativeMatchTokens(value: unknown): string[] {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

function hasExplicitNativeMediaFields(item: {
  nativeTitle?: unknown;
  nativeDescription?: unknown;
  nativeTags?: unknown;
}): boolean {
  const nativeTags = Array.isArray(item.nativeTags)
    ? item.nativeTags.map((tag) => String(tag || "").trim()).filter(Boolean)
    : String(item.nativeTags || "").trim();
  return Boolean(
    String(item.nativeTitle || "").trim() ||
      String(item.nativeDescription || "").trim() ||
      (Array.isArray(nativeTags) ? nativeTags.length > 0 : Boolean(nativeTags))
  );
}

export function isUrlLikeMediaText(value: unknown): boolean {
  const raw = String(value || "").trim();
  if (!raw) return false;
  return (
    /https?:\/\//i.test(raw) ||
    /\bwww\./i.test(raw) ||
    /(?:pexels|pixabay|vecteezy|videezy)\.com/i.test(raw)
  );
}

function evidenceBlob(value: unknown): string {
  if (isUrlLikeMediaText(value)) return "";
  return normalizeText(String(value || "").replace(/-/g, " "));
}

export function extractNativeMediaText(item: {
  nativeTitle?: unknown;
  nativeDescription?: unknown;
  nativeTags?: unknown;
  title?: unknown;
  tags?: unknown;
  description?: unknown;
  url?: unknown;
  thumb?: unknown;
}): string {
  if (!hasExplicitNativeMediaFields(item)) return "";

  const nativeTags = Array.isArray(item.nativeTags)
    ? item.nativeTags.join(" ")
    : String(item.nativeTags || "");

  const parts = [item.nativeTitle, item.nativeDescription, nativeTags].filter(
    (part) => !isUrlLikeMediaText(part)
  );
  return evidenceBlob(parts.join(" "));
}

export function isGraphicUnsafeStock(text: unknown): boolean {
  const blob = normalizeText(text);
  if (!blob) return false;
  return GRAPHIC_STOCK_SAFETY_PATTERNS.some((pattern) => pattern.test(blob));
}

function nativeTokenMatchesVerified(nativeToken: string, verifiedTerms: string[]): boolean {
  if (verifiedTerms.includes(nativeToken)) return true;
  return verifiedTerms.some((term) => (VISUAL_SYNONYMS[term] || []).includes(nativeToken));
}

export function candidateMatchesVerifiedProduct(
  verifiedTerms: string[],
  nativeText: unknown
): boolean {
  const verified = uniqueTokens(verifiedTerms.filter((term) => !MEDIA_NOISE_TOKENS.has(term)));
  if (verified.length === 0) return false;

  const nativeTokens = nativeMatchTokens(nativeText).filter(
    (token) => !MEDIA_NOISE_TOKENS.has(token)
  );
  if (nativeTokens.length === 0) return false;

  const matchedFamilies = new Set<string>();
  for (const nativeToken of nativeTokens) {
    if (!nativeTokenMatchesVerified(nativeToken, verified)) continue;
    matchedFamilies.add(conceptFamily(nativeToken));
  }

  return matchedFamilies.size >= 2;
}

function nativeContainsPhrase(nativeText: string, phrase: string): boolean {
  const needle = normalizeText(phrase);
  if (!needle) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(nativeText);
}

function hasAny(tokens: string[], needles: string[]): boolean {
  return needles.some((needle) => tokens.includes(needle));
}

export function derivePhysicalProductObjectAnchors(
  input: ProductMediaOfferInput
): ProductObjectAnchors {
  if (isDigitalProduct(input)) {
    return { tokens: [], phrases: [] };
  }

  const verified = buildVerifiedProductMediaTerms(input);
  const tokens: string[] = [];
  const phrases: string[] = [];

  const objectHits = verified.filter((token) => PHYSICAL_OBJECT_LEXICON.has(token));
  tokens.push(...objectHits);

  const gymBagFamily =
    hasAny(verified, ["bag", "duffel", "backpack"]) &&
    hasAny(verified, ["gym", "fitness", "workout", "sports", "duffel"]);

  if (gymBagFamily) {
    tokens.push("bag", "duffel");
    phrases.push("gym bag", "sports bag", "duffel bag", "duffel");
  }

  if (hasAny(verified, ["earbuds", "earbud", "headphones", "headphone"])) {
    tokens.push("earbuds", "earbud", "headphones", "headphone");
    phrases.push("earbuds", "headphones");
  }

  if (verified.includes("bottle")) {
    tokens.push("bottle");
    phrases.push("water bottle");
    if (hasAny(verified, ["stainless", "steel"])) phrases.push("stainless steel bottle");
    if (verified.includes("reusable") && verified.includes("water")) {
      phrases.push("reusable water bottle");
    }
  }

  if (hasAny(verified, ["poles", "pole"]) && hasAny(verified, ["hiking", "trail", "outdoor", "trekking"])) {
    tokens.push("poles", "pole");
    phrases.push("hiking poles", "trekking poles");
  }

  if (verified.includes("serum")) {
    tokens.push("serum");
    phrases.push("skincare serum", "serum");
  }

  return {
    tokens: uniqueTokens(tokens.filter((token) => !CONTEXT_ONLY_TOKENS.has(token))),
    phrases: uniqueTokens(phrases),
  };
}

export function hasPhysicalProductObjectAnchors(input: ProductMediaOfferInput): boolean {
  const anchors = derivePhysicalProductObjectAnchors(input);
  return anchors.tokens.length > 0 || anchors.phrases.length > 0;
}

export function isDigitalProduct(input: ProductMediaOfferInput): boolean {
  const category = tokenizeMediaText(input.category);
  const verified = buildVerifiedProductMediaTerms(input);
  const objectHits = verified.filter((token) => PHYSICAL_OBJECT_LEXICON.has(token));
  if (objectHits.length > 0) return false;

  return [...category, ...verified].some((token) => DIGITAL_HINT_TOKENS.has(token));
}

function productContextTokens(input: ProductMediaOfferInput): string[] {
  return buildVerifiedProductMediaTerms(input).filter((token) => CONTEXT_ONLY_TOKENS.has(token));
}

function isGymSportsDuffelBagProduct(input: ProductMediaOfferInput): boolean {
  const verified = buildVerifiedProductMediaTerms(input);
  const anchors = derivePhysicalProductObjectAnchors(input);
  return (
    (anchors.tokens.includes("bag") || anchors.tokens.includes("duffel")) &&
    hasAny(verified, ["gym", "fitness", "workout", "sports", "duffel"])
  );
}

export function hasIncompatibleBagClassConflict(
  input: ProductMediaOfferInput,
  nativeText: unknown
): boolean {
  if (!isGymSportsDuffelBagProduct(input)) return false;

  const blob = normalizeText(nativeText);
  const nativeTokens = nativeMatchTokens(blob);
  const conflict =
    nativeTokens.some((token) => BAG_CONFLICT_TOKENS.has(token)) ||
    nativeContainsPhrase(blob, "evening bag") ||
    nativeContainsPhrase(blob, "fashion handbag") ||
    nativeContainsPhrase(blob, "crossbody purse");

  if (!conflict) return false;

  const compatible =
    nativeContainsPhrase(blob, "gym bag") ||
    nativeContainsPhrase(blob, "sports bag") ||
    nativeContainsPhrase(blob, "duffel bag") ||
    nativeTokens.includes("duffel");

  return !compatible;
}

function nativeHasObjectAnchor(
  anchors: ProductObjectAnchors,
  nativeText: string,
  nativeTokens: string[]
): boolean {
  if (nativeTokens.some((token) => anchors.tokens.includes(token))) return true;
  return anchors.phrases.some((phrase) => nativeContainsPhrase(nativeText, phrase));
}

function nativeHasClearObjectPhrase(
  anchors: ProductObjectAnchors,
  nativeText: string,
  nativeTokens: string[]
): boolean {
  const specificPhrases = anchors.phrases.filter(
    (phrase) => phrase.includes(" ") || !AMBIGUOUS_OBJECT_TOKENS.has(phrase)
  );
  if (specificPhrases.some((phrase) => nativeContainsPhrase(nativeText, phrase))) return true;
  return nativeTokens.some(
    (token) =>
      SPECIFIC_OBJECT_TOKENS.has(token) &&
      anchors.tokens.includes(token) &&
      !AMBIGUOUS_OBJECT_TOKENS.has(token)
  );
}

function nativeHasSupportingContext(
  input: ProductMediaOfferInput,
  nativeTokens: string[]
): boolean {
  const context = productContextTokens(input);
  if (context.length === 0) return false;

  const matchedFamilies = new Set<string>();
  for (const nativeToken of nativeTokens) {
    if (!nativeTokenMatchesVerified(nativeToken, context)) continue;
    matchedFamilies.add(conceptFamily(nativeToken));
  }
  return matchedFamilies.size >= 1;
}

function nativeHasSupportingVerifiedFacts(
  input: ProductMediaOfferInput,
  nativeTokens: string[]
): boolean {
  const supportTerms = buildVerifiedProductMediaTerms(input).filter(
    (token) => !AMBIGUOUS_OBJECT_TOKENS.has(token) && !MEDIA_NOISE_TOKENS.has(token)
  );
  if (supportTerms.length === 0) return nativeHasSupportingContext(input, nativeTokens);

  const matchedFamilies = new Set<string>();
  for (const nativeToken of nativeTokens) {
    if (AMBIGUOUS_OBJECT_TOKENS.has(nativeToken)) continue;
    if (!nativeTokenMatchesVerified(nativeToken, supportTerms)) continue;
    matchedFamilies.add(conceptFamily(nativeToken));
  }
  return matchedFamilies.size >= 1;
}

function isGenericBagOnlyNative(
  input: ProductMediaOfferInput,
  nativeText: string,
  nativeTokens: string[]
): boolean {
  if (!isGymSportsDuffelBagProduct(input)) return false;
  const hasSpecificBagPhrase =
    nativeContainsPhrase(nativeText, "gym bag") ||
    nativeContainsPhrase(nativeText, "sports bag") ||
    nativeContainsPhrase(nativeText, "duffel bag");
  if (hasSpecificBagPhrase) return false;
  if (nativeTokens.includes("duffel") || nativeTokens.includes("backpack")) return false;
  return nativeTokens.includes("bag");
}

export function isStrongProductObjectNative(
  input: ProductMediaOfferInput,
  nativeText: unknown
): boolean {
  if (isUrlLikeMediaText(nativeText)) return false;
  const blob = evidenceBlob(nativeText);
  if (!blob || isGraphicUnsafeStock(blob)) return false;
  if (hasIncompatibleBagClassConflict(input, blob)) return false;

  const anchors = derivePhysicalProductObjectAnchors(input);
  if (anchors.tokens.length === 0 && anchors.phrases.length === 0) return false;

  const nativeTokens = nativeMatchTokens(blob).filter((token) => !MEDIA_NOISE_TOKENS.has(token));
  const objectMatch = nativeHasObjectAnchor(anchors, blob, nativeTokens);
  if (!objectMatch) return false;

  if (isGenericBagOnlyNative(input, blob, nativeTokens)) {
    return nativeHasSupportingContext(input, nativeTokens);
  }

  if (nativeHasClearObjectPhrase(anchors, blob, nativeTokens)) return true;
  return nativeHasSupportingVerifiedFacts(input, nativeTokens);
}

export function isUseCaseProductNative(
  input: ProductMediaOfferInput,
  nativeText: unknown
): boolean {
  if (isUrlLikeMediaText(nativeText)) return false;
  const blob = evidenceBlob(nativeText);
  if (!blob || isGraphicUnsafeStock(blob)) return false;
  if (hasIncompatibleBagClassConflict(input, blob)) return false;
  if (isStrongProductObjectNative(input, blob)) return false;

  const nativeTokens = nativeMatchTokens(blob).filter((token) => !MEDIA_NOISE_TOKENS.has(token));
  const hasAction = nativeTokens.some((token) => USE_CASE_ACTION_TOKENS.has(token));
  if (!hasAction) return false;
  return nativeHasSupportingContext(input, nativeTokens);
}

export function isContextualProductNative(
  input: ProductMediaOfferInput,
  nativeText: unknown
): boolean {
  if (isUrlLikeMediaText(nativeText)) return false;
  const blob = evidenceBlob(nativeText);
  if (!blob || isGraphicUnsafeStock(blob)) return false;
  if (hasIncompatibleBagClassConflict(input, blob)) return false;
  if (isStrongProductObjectNative(input, blob)) return false;
  if (isUseCaseProductNative(input, blob)) return false;

  const nativeTokens = nativeMatchTokens(blob).filter((token) => !MEDIA_NOISE_TOKENS.has(token));
  return nativeHasSupportingContext(input, nativeTokens);
}

export function classifyProductMediaRole(
  input: ProductMediaOfferInput,
  nativeText: unknown,
  provenance?: ProductSearchProvenance | null
): ProductMediaRole {
  if (isUrlLikeMediaText(nativeText)) {
    return sparseProvenanceRole(provenance);
  }

  const blob = evidenceBlob(nativeText);
  if (blob && isGraphicUnsafeStock(blob)) return "none";
  if (blob && hasIncompatibleBagClassConflict(input, blob)) return "none";
  if (blob && isStrongProductObjectNative(input, blob)) return "strong";
  if (blob && isUseCaseProductNative(input, blob)) return "use_case";
  if (blob && isContextualProductNative(input, blob)) return "contextual";
  if (blob) return "none";
  return sparseProvenanceRole(provenance);
}

function sparseProvenanceRole(provenance?: ProductSearchProvenance | null): ProductMediaRole {
  const tier = provenance?.tier;
  if (tier === "A" || tier === "B" || tier === "C") return "contextual";
  if (tier === "D" || tier === "neutral") return "neutral";
  return "none";
}

export function coerceReelSceneMediaType(_type?: unknown): "mixed" | "video" | "stills" {
  return "video";
}

export function isReelSceneVideo(item: { type?: unknown; url?: unknown }): boolean {
  const type = String(item?.type || "").toLowerCase();
  const url = String(item?.url || "").toLowerCase();
  if (type === "image") return false;
  if (/\.(jpg|jpeg|png|gif|webp|avif|bmp|svg)(\?|#|$)/i.test(url)) return false;
  if (type === "video") return true;
  if (/\.(mp4|mov|webm|mkv)(\?|#|$)/i.test(url)) return true;
  if (url.includes("fallback1.mp4")) return true;
  return false;
}

export function buildSafeReelFallbackVideo(duration = 8): {
  source: "fallback";
  type: "video";
  url: string;
  thumb: string;
  duration: number;
} {
  return {
    source: "fallback",
    type: "video",
    url: REEL_SAFE_FALLBACK_VIDEO_URL,
    thumb: REEL_SAFE_FALLBACK_THUMB_URL,
    duration,
  };
}

export function isStrongProductVideo(
  input: ProductMediaOfferInput,
  item: {
    type?: unknown;
    url?: unknown;
    nativeTitle?: unknown;
    nativeDescription?: unknown;
    nativeTags?: unknown;
    title?: unknown;
    tags?: unknown;
    description?: unknown;
    thumb?: unknown;
  }
): boolean {
  if (!isReelSceneVideo(item)) return false;
  return isStrongProductObjectNative(input, extractNativeMediaText(item));
}

export function isAcceptableProductPoolItem(
  input: ProductMediaOfferInput,
  item: {
    type?: unknown;
    url?: unknown;
    nativeTitle?: unknown;
    nativeDescription?: unknown;
    nativeTags?: unknown;
    title?: unknown;
    tags?: unknown;
    description?: unknown;
    thumb?: unknown;
    searchTier?: unknown;
  }
): boolean {
  const nativeText = extractNativeMediaText(item);
  if (isGraphicUnsafeStock(nativeText)) return false;
  if (!isReelSceneVideo(item) && String(item?.type || "") === "image") return false;

  if (isDigitalProduct(input) || !hasPhysicalProductObjectAnchors(input)) {
    return candidateMatchesVerifiedProduct(buildVerifiedProductMediaTerms(input), nativeText);
  }

  const role = classifyProductMediaRole(input, nativeText, provenanceFromItem(item));
  return role === "strong" || role === "use_case" || role === "contextual" || role === "neutral";
}

function provenanceFromItem(item: { searchTier?: unknown }): ProductSearchProvenance | null {
  const tier = item?.searchTier;
  if (tier === "A" || tier === "B" || tier === "C" || tier === "D" || tier === "neutral") {
    return { tier };
  }
  return null;
}

export function productMediaRoleForItem(
  input: ProductMediaOfferInput,
  item: {
    type?: unknown;
    url?: unknown;
    nativeTitle?: unknown;
    nativeDescription?: unknown;
    nativeTags?: unknown;
    searchTier?: unknown;
  }
): ProductMediaRole {
  if (!isReelSceneVideo(item)) return "none";
  return classifyProductMediaRole(input, extractNativeMediaText(item), provenanceFromItem(item));
}

export function physicalProductReelNeedsObjectVideo(input: ProductMediaOfferInput): boolean {
  return hasPhysicalProductObjectAnchors(input) && !isDigitalProduct(input);
}

export function physicalProductScenePoolHasRequiredObjectVideo(
  input: ProductMediaOfferInput,
  items: Array<{
    type?: unknown;
    url?: unknown;
    nativeTitle?: unknown;
    nativeDescription?: unknown;
    nativeTags?: unknown;
    title?: unknown;
    tags?: unknown;
    description?: unknown;
    thumb?: unknown;
  }>
): boolean {
  if (!physicalProductReelNeedsObjectVideo(input)) {
    return items.some((item) => isReelSceneVideo(item));
  }
  return items.some((item) => isStrongProductVideo(input, item));
}

export function filterReelSceneVideos<T extends { type?: unknown; url?: unknown }>(items: T[]): T[] {
  return items.filter((item) => isReelSceneVideo(item));
}

export function finalizeReelScenePool<
  T extends {
    type?: unknown;
    url?: unknown;
    nativeTitle?: unknown;
    nativeDescription?: unknown;
    nativeTags?: unknown;
    title?: unknown;
    tags?: unknown;
    description?: unknown;
    thumb?: unknown;
  },
>(
  offerMode: string | null | undefined,
  input: ProductMediaOfferInput,
  items: T[]
): T[] {
  const videos = filterReelSceneVideos(items);
  if (offerMode !== "product") return videos;

  const ranked = videos
    .map((item) => ({ item, role: productMediaRoleForItem(input, item) }))
    .filter((entry) => entry.role !== "none");

  if (!physicalProductReelNeedsObjectVideo(input)) {
    const digital = videos.filter((item) => isAcceptableProductPoolItem(input, item));
    return digital;
  }

  const hasBetterThanNeutral = ranked.some((entry) => entry.role !== "neutral");
  const kept = hasBetterThanNeutral ? ranked.filter((entry) => entry.role !== "neutral") : ranked;
  const seen = new Set<string>();

  return kept
    .sort((a, b) => PRODUCT_ROLE_RANK[a.role] - PRODUCT_ROLE_RANK[b.role])
    .filter((entry) => {
      const url = String(entry.item.url || "");
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    })
    .map((entry) => ({ ...entry.item, mediaRole: entry.role }));
}

export function isProductMediaRelevant(
  input: ProductMediaOfferInput,
  item: {
    nativeTitle?: unknown;
    nativeDescription?: unknown;
    nativeTags?: unknown;
    title?: unknown;
    tags?: unknown;
    description?: unknown;
    url?: unknown;
    thumb?: unknown;
    type?: unknown;
  }
): boolean {
  const nativeText = extractNativeMediaText(item);
  if (isGraphicUnsafeStock(nativeText)) return false;

  if (isDigitalProduct(input) || !hasPhysicalProductObjectAnchors(input)) {
    return candidateMatchesVerifiedProduct(buildVerifiedProductMediaTerms(input), nativeText);
  }

  return isStrongProductObjectNative(input, nativeText);
}

export function productQueryContainsForbiddenGenericExpansion(query: string): boolean {
  const blob = normalizeText(query);
  return GENERIC_PRODUCT_QUERY_NOISE.some((phrase) => blob.includes(phrase));
}

function categoryNeutralQueries(input: ProductMediaOfferInput): string[] {
  const verified = buildVerifiedProductMediaTerms(input);
  const category = tokenizeMediaText(input.category);
  const tokens = [...verified, ...category];

  if (hasAny(tokens, ["gym", "fitness", "workout", "sports"])) {
    return ["fitness lifestyle", "gym environment", "active lifestyle"];
  }
  if (hasAny(tokens, ["beauty", "skincare", "cosmetics", "makeup", "serum"])) {
    return ["skincare routine", "beauty lifestyle"];
  }
  if (hasAny(tokens, ["software", "saas", "app", "ai", "laptop", "computer"])) {
    return ["laptop workspace", "digital work", "business software"];
  }
  if (hasAny(tokens, ["outdoor", "hiking", "camping", "trail", "bottle", "poles", "pole"])) {
    return ["outdoor activity", "hiking lifestyle"];
  }
  return [];
}

export function buildProductDiscoveryTiers(input: ProductMediaOfferInput): ProductSearchTier[] {
  const verified = buildVerifiedProductMediaTerms(input);
  const anchors = derivePhysicalProductObjectAnchors(input);
  const neutral = categoryNeutralQueries(input);

  let tiers: ProductSearchTier[];

  if (
    (anchors.tokens.includes("bag") || anchors.tokens.includes("duffel")) &&
    hasAny(verified, ["gym", "fitness", "workout", "sports", "duffel"])
  ) {
    tiers = [
      { tier: "A", queries: ["gym bag", "duffel bag", "sports bag"] },
      { tier: "B", queries: ["packing gym bag", "carrying gym bag", "gym duffel", "workout bag"] },
      { tier: "C", queries: ["packing workout clothes", "gym gear", "fitness equipment"] },
      { tier: "D", queries: ["gym workout", "fitness training", "sports training"] },
    ];
  } else if (anchors.tokens.includes("bottle")) {
    tiers = [
      { tier: "A", queries: ["water bottle", "reusable water bottle"] },
      { tier: "B", queries: ["drinking water bottle"] },
      { tier: "C", queries: ["drinking water", "outdoor hydration"] },
      { tier: "D", queries: ["outdoor activity"] },
    ];
  } else if (hasAny(anchors.tokens, ["earbuds", "earbud", "headphones", "headphone"])) {
    tiers = [
      { tier: "A", queries: ["wireless earbuds", "headphones"] },
      { tier: "B", queries: ["using headphones", "wearing earbuds"] },
      { tier: "C", queries: ["listening to music"] },
      { tier: "D", queries: ["music lifestyle"] },
    ];
  } else if (hasAny(anchors.tokens, ["poles", "pole"])) {
    tiers = [
      { tier: "A", queries: ["hiking poles", "trekking poles"] },
      { tier: "B", queries: ["hiker using poles"] },
      { tier: "C", queries: ["hiking trail"] },
      { tier: "D", queries: ["outdoor hiking"] },
    ];
  } else if (anchors.tokens.includes("serum")) {
    tiers = [
      { tier: "A", queries: ["skincare serum"] },
      { tier: "B", queries: ["applying serum"] },
      { tier: "C", queries: ["skincare routine"] },
      { tier: "D", queries: ["beauty routine"] },
    ];
  } else {
    const objectQueries = anchors.phrases.filter(Boolean).slice(0, 3);
    tiers = [
      { tier: "A", queries: objectQueries },
      { tier: "B", queries: objectQueries.slice(0, 2).map((phrase) => `using ${phrase}`) },
      { tier: "C", queries: [] },
      { tier: "D", queries: [] },
    ];
  }

  return [...tiers, { tier: "neutral", queries: neutral }];
}

export function productDiscoveryIsSufficient(counts: ProductDiscoveryCounts): boolean {
  const useful = counts.strong + counts.useCase + counts.contextual;
  return counts.strong >= 2 || (counts.strong >= 1 && useful >= 4);
}

export function selectNextProductSearchStage(params: {
  tiers: ProductSearchTier[];
  completed: Array<{ tier: ProductSearchTierId; page: number }>;
  counts: ProductDiscoveryCounts;
  tierAPage1Count: number;
}): ProductSearchStage | null {
  const done = (tier: ProductSearchTierId, page: number) =>
    params.completed.some((stage) => stage.tier === tier && stage.page === page);

  const stageFor = (tier: ProductSearchTierId, page: number): ProductSearchStage | null => {
    const queries = params.tiers.find((entry) => entry.tier === tier)?.queries.filter(Boolean) || [];
    if (!queries.length) return null;
    return { tier, page, queries };
  };

  if (!done("A", 1)) return stageFor("A", 1);
  if (productDiscoveryIsSufficient(params.counts)) return null;

  const useful = params.counts.strong + params.counts.useCase + params.counts.contextual;
  const thinPage = params.tierAPage1Count < 4;

  if (thinPage && !done("A", 2)) return stageFor("A", 2);
  if (!done("B", 1)) return stageFor("B", 1);
  if (!thinPage && !done("A", 2) && params.counts.strong < 1) return stageFor("A", 2);
  if (params.counts.strong >= 1 && useful >= 4) return null;
  if (!done("C", 1) && params.counts.strong + params.counts.useCase < 2) return stageFor("C", 1);
  if (!done("D", 1) && useful < 2) return stageFor("D", 1);
  if (!done("neutral", 1) && useful === 0) return stageFor("neutral", 1);
  return null;
}

export function strongestProductMediaRole(
  roles: Array<ProductMediaRole | null | undefined>
): ProductMediaRole {
  let best: ProductMediaRole = "none";
  for (const role of roles) {
    if (!role || role === "none") continue;
    if (PRODUCT_ROLE_RANK[role] < PRODUCT_ROLE_RANK[best]) best = role;
  }
  return best;
}

export function productVisibleClaimAllowed(role: ProductMediaRole): boolean {
  return role === "strong";
}

export function productVisualDirection(role: ProductMediaRole, offerName: string): string {
  const name = offerName.trim() || "this product";
  if (productVisibleClaimAllowed(role)) {
    return `Strong product footage is available. Shot language may show ${name} as visible.`;
  }
  return [
    `The footage does not prove ${name} is visible.`,
    `Do NOT say "Here is the ${name} in action".`,
    `Do NOT say "Look at this bag" or "Watch this bag being used".`,
    `Do NOT say "Reveal ${name}".`,
    "Talk about the need, the use case, or the category instead.",
  ].join(" ");
}

export function productSceneSolutionCopy(
  offerName: string,
  role: ProductMediaRole
): { description: string; visualCue: string } {
  if (productVisibleClaimAllowed(role)) {
    return {
      description: `Reveal ${offerName} as the cleaner smarter product shift`,
      visualCue: "sharp transformation reveal, cleaner modern look",
    };
  }
  return {
    description: `${offerName} is the smarter way to handle this, without claiming the footage shows it`,
    visualCue: "category-relevant motion, no fake product close-up",
  };
}
