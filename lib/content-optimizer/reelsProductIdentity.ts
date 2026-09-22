export type ProductIdentitySource =
  | "title"
  | "shortened_title"
  | "description"
  | "merchant_category"
  | "category"
  | "unknown";

export type ProductDisplayIdentity = {
  displayName: string;
  source: ProductIdentitySource;
  unknown: boolean;
  categoryLabel: string;
};

const TRAILING_SPEC_WORDS = new Set([
  "black",
  "white",
  "red",
  "blue",
  "green",
  "grey",
  "gray",
  "silver",
  "gold",
  "eu",
  "uk",
  "us",
  "usa",
  "pack",
  "pcs",
  "pc",
  "set",
  "new",
  "free",
  "shipping",
  "hot",
  "sale",
]);

const STOP_WORDS = new Set(["a", "an", "the", "and", "or", "of", "for", "with", "to", "in", "on"]);

function normalizeWhitespace(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function tokenizeWords(value: string): string[] {
  return normalizeWhitespace(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

export function isUnknownProductCategory(category: unknown): boolean {
  const c = normalizeWhitespace(category).toLowerCase();
  return !c || c === "uncategorized" || c === "unknown" || c === "n/a" || c === "na";
}

export function isIdentifierLikeProductTitle(title: unknown): boolean {
  const raw = normalizeWhitespace(title);
  if (!raw) return true;

  if (/^https?:\/\//i.test(raw) || /^www\./i.test(raw)) return true;
  if (/\.(com|net|org|io)\b/i.test(raw) && !/\s/.test(raw)) return true;

  const compact = raw.replace(/\s+/g, "");
  if (/^(sku|id|pid|item|asin|ean|upc)[_-]?\w+/i.test(compact)) return true;

  const words = tokenizeWords(raw);
  const digitCount = (raw.match(/\d/g) || []).length;
  const letterCount = (raw.match(/[A-Za-z]/g) || []).length;
  const digitRatio = digitCount / Math.max(raw.length, 1);

  if (words.length <= 2 && digitRatio >= 0.28 && digitCount >= 4) return true;
  if (words.length === 1 && /[A-Za-z]/.test(raw) && /\d/.test(raw) && /[-_]/.test(raw) && digitCount >= 3) {
    return true;
  }
  if (!/\s/.test(raw) && /^[A-Z0-9._-]{8,}$/.test(raw) && digitCount >= 3) return true;
  if (letterCount > 0 && digitCount >= 8 && digitRatio >= 0.4) return true;
  if (words.every((word) => /^[A-Z0-9._-]{4,}$/.test(word)) && digitCount >= 4) return true;

  return false;
}

function isHumanReadableTitle(title: string): boolean {
  const words = tokenizeWords(title);
  if (isIdentifierLikeProductTitle(title)) return false;
  if (words.length === 0) return false;
  const alphaWords = words.filter((word) => /[A-Za-z]{3,}/.test(word));
  return alphaWords.length >= 2 || (alphaWords.length === 1 && words.length <= 4 && !/\d{4,}/.test(title));
}

function wordsFromSource(text: string): string[] {
  return tokenizeWords(text).map((word) => word.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, ""));
}

function sourceHasWord(source: string, word: string): boolean {
  const needle = word.toLowerCase();
  return wordsFromSource(source).some((candidate) => candidate.toLowerCase() === needle);
}

export function shortenVerifiedProductTitle(title: string, maxWords = 6): string {
  const clean = normalizeWhitespace(title);
  if (!clean || isIdentifierLikeProductTitle(clean)) return "";

  const words = tokenizeWords(clean);
  if (words.length <= maxWords && isHumanReadableTitle(clean)) return clean;

  const kept: string[] = [];
  for (const word of words) {
    const lower = word.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (STOP_WORDS.has(lower)) continue;
    if (TRAILING_SPEC_WORDS.has(lower) && kept.length >= 3) continue;
    if (!sourceHasWord(clean, word)) continue;
    kept.push(word);
    if (kept.length >= maxWords) break;
  }

  const shortened = kept.join(" ").trim();
  if (shortened && !isIdentifierLikeProductTitle(shortened)) return shortened;
  return words.slice(0, maxWords).join(" ");
}

function firstDescriptionLabel(description: string): string {
  const clean = normalizeWhitespace(description);
  if (!clean || isIdentifierLikeProductTitle(clean)) return "";
  const sentence = clean.split(/[.!?]/)[0] || clean;
  return shortenVerifiedProductTitle(sentence, 6);
}

export function deriveProductDisplayIdentity(input: {
  title?: string | null;
  description?: string | null;
  category?: string | null;
  merchantName?: string | null;
}): ProductDisplayIdentity {
  const title = normalizeWhitespace(input.title);
  const description = normalizeWhitespace(input.description);
  const category = normalizeWhitespace(input.category);
  const merchantName = normalizeWhitespace(input.merchantName);
  const categoryLabel = isUnknownProductCategory(category) ? "" : category;

  if (title && isHumanReadableTitle(title) && tokenizeWords(title).length <= 8 && !isIdentifierLikeProductTitle(title)) {
    return {
      displayName: title,
      source: "title",
      unknown: false,
      categoryLabel,
    };
  }

  if (title && isHumanReadableTitle(title)) {
    const shortened = shortenVerifiedProductTitle(title, 6);
    if (shortened) {
      return {
        displayName: shortened,
        source: "shortened_title",
        unknown: false,
        categoryLabel,
      };
    }
  }

  const fromDescription = firstDescriptionLabel(description);
  if (fromDescription) {
    return {
      displayName: fromDescription,
      source: "description",
      unknown: false,
      categoryLabel,
    };
  }

  if (merchantName && categoryLabel && !isIdentifierLikeProductTitle(merchantName)) {
    const merchantWords = tokenizeWords(merchantName).slice(0, 3).join(" ");
    const typeWords = tokenizeWords(categoryLabel).slice(0, 3).join(" ");
    return {
      displayName: `${merchantWords} ${typeWords}`.trim(),
      source: "merchant_category",
      unknown: false,
      categoryLabel,
    };
  }

  if (categoryLabel) {
    return {
      displayName: categoryLabel,
      source: "category",
      unknown: false,
      categoryLabel,
    };
  }

  return {
    displayName: "",
    source: "unknown",
    unknown: true,
    categoryLabel: "",
  };
}

export function formatCreatorCommissionPercent(
  commission: number | null | undefined
): string {
  if (commission === null || commission === undefined) return "";
  if (typeof commission !== "number" || !Number.isFinite(commission)) return "";
  return `${commission}%`;
}

export function parseOptionalCommission(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
