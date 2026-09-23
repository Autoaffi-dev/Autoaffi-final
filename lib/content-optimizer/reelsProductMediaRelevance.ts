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

export type ProductMediaRole = "strong" | "contextual" | "none";

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
  const verified = buildVerifiedProductMediaTerms(input);
  const expanded = expandVisualSynonyms(verified).slice(0, 12);
  return expanded.join(" ").trim();
}

export function buildProductSearchQueryVariants(input: ProductMediaOfferInput): string[] {
  const verified = buildVerifiedProductMediaTerms(input);
  const primary = buildProductMediaQuery(input);
  const has = (...needles: string[]) => needles.some((needle) => verified.includes(needle));

  const variants: string[] = [primary];

  if (has("gym", "fitness", "workout", "sports") && has("bag", "duffel", "backpack")) {
    variants.push("gym bag", "sports bag", "packing gym bag", "fitness bag");
  } else if (has("beauty", "skincare", "cosmetics", "makeup")) {
    variants.push(`${primary} beauty`, "skincare application");
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
  const nativeTags = Array.isArray(item.nativeTags)
    ? item.nativeTags.join(" ")
    : String(item.nativeTags || "");

  if (hasExplicitNativeMediaFields(item)) {
    return normalizeText([item.nativeTitle || "", item.nativeDescription || "", nativeTags].join(" "));
  }

  const fallbackTags = Array.isArray(item.tags) ? item.tags.join(" ") : String(item.tags || "");
  return normalizeText(
    [item.title || "", item.description || "", fallbackTags].join(" ")
  );
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
  const blob = normalizeText(nativeText);
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

export function isContextualProductNative(
  input: ProductMediaOfferInput,
  nativeText: unknown
): boolean {
  const blob = normalizeText(nativeText);
  if (!blob || isGraphicUnsafeStock(blob)) return false;
  if (hasIncompatibleBagClassConflict(input, blob)) return false;
  if (isStrongProductObjectNative(input, blob)) return false;

  const nativeTokens = nativeMatchTokens(blob).filter((token) => !MEDIA_NOISE_TOKENS.has(token));
  return nativeHasSupportingContext(input, nativeTokens);
}

export function classifyProductMediaRole(
  input: ProductMediaOfferInput,
  nativeText: unknown
): ProductMediaRole {
  if (isStrongProductObjectNative(input, nativeText)) return "strong";
  if (isContextualProductNative(input, nativeText)) return "contextual";
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
  }
): boolean {
  const nativeText = extractNativeMediaText(item);
  if (isGraphicUnsafeStock(nativeText)) return false;
  if (!isReelSceneVideo(item) && String(item?.type || "") === "image") return false;

  if (isDigitalProduct(input) || !hasPhysicalProductObjectAnchors(input)) {
    return candidateMatchesVerifiedProduct(buildVerifiedProductMediaTerms(input), nativeText);
  }

  const role = classifyProductMediaRole(input, nativeText);
  return role === "strong" || role === "contextual";
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

  const acceptable = videos.filter((item) => isAcceptableProductPoolItem(input, item));
  if (physicalProductReelNeedsObjectVideo(input)) {
    if (!acceptable.some((item) => isStrongProductVideo(input, item))) {
      return [];
    }
  }
  return acceptable;
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
