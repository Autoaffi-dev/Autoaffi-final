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
  }
): boolean {
  const nativeText = extractNativeMediaText(item);
  if (isGraphicUnsafeStock(nativeText)) return false;
  return candidateMatchesVerifiedProduct(buildVerifiedProductMediaTerms(input), nativeText);
}

export function productQueryContainsForbiddenGenericExpansion(query: string): boolean {
  const blob = normalizeText(query);
  return GENERIC_PRODUCT_QUERY_NOISE.some((phrase) => blob.includes(phrase));
}
