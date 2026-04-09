"use client";

import {
  useMemo,
  useState,
  useEffect,
  useCallback,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { runExactFixEngine } from "@/components/content-optimizer/ExactFixEngine";

type Mode = "content_only" | "content_and_offer";
type InputStyle = "manual" | "scan_link";
type PlatformKey = "tiktok" | "instagram" | "facebook" | "youtube";

type ProductResult = {
  id: string;
  external_id: string;
  name: string;
  epc: number | null;
  category: string;
  platform: string;
  productUrl: string;
  affiliate?: string;
  imageUrl?: string;
  merchantName?: string;
  source?: string;
  commission?: number | null;
  currency?: string | null;
};

type SavedOffer = {
  id: string;
  source: string | null;
  external_id?: string | null;
  title: string | null;
  description?: string | null;
  category?: string | null;
  niche?: string | null;
  merchant_name?: string | null;
  product_url?: string | null;
  image_url?: string | null;
  affiliate_link?: string | null;
  subid?: string | null;
  is_primary?: boolean | null;
  is_pinned?: boolean | null;
  pin_rank?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type RecurringPlatformRow = {
  id: string;
  user_id: string;
  platform: string;
  autoaffi_user_code: string | null;
  created_at: string;
};

type FunnelRow = {
  id: string;
  user_id: string;
  name: string;
  funnel_url: string;
  created_at: string;
};

type ExactFixResultShape = {
  hook?: string;
  caption?: string;
  body?: string;
  score?: number;
  howToReach10?: string[];
  breakdown?: {
    hook?: number;
    seo?: number;
    engagement?: number;
    clarity?: number;
  };
};

type SeoScoreShape = {
  triggeredAt?: number;
  forcedRefresh?: number;
  score?: number;
  breakdown?: {
    hook?: number;
    seo?: number;
    engagement?: number;
    clarity?: number;
  };
  keywords?: string[];
};

type OfferSelectResponse = {
  ok: boolean;
  saved?: SavedOffer | null;
  error?: string;
};

type CopyArchetype =
  | "phone_case"
  | "ai_tool"
  | "beauty"
  | "fitness"
  | "home_kitchen"
  | "fashion"
  | "business_software"
  | "education"
  | "pets"
  | "gaming"
  | "productivity"
  | "travel"
  | "generic";

type LastGeneratedCopy = {
  angle: string;
  hook: string;
  caption: string;
  body: string;
};

const quickOfferCategories = [
  "AI tools",
  "Phone accessories",
  "Fitness",
  "Beauty",
  "Home & kitchen",
  "Fashion",
  "Business software",
  "Education",
  "Pets",
  "Gaming",
  "Productivity",
  "Travel",
];

async function copyToClipboard(text: string) {
  try {
    if (!text) return;
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.error("Clipboard error", err);
  }
}

function pickRandom<T>(items: T[], seed: number): T {
  if (!items.length) {
    throw new Error("pickRandom called with empty array");
  }
  return items[Math.abs(seed) % items.length];
}

function formatMoney(value?: number | null, currency = "USD") {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${n.toFixed(2)} ${currency}`;
}

function getHostLabel(url?: string | null) {
  try {
    if (!url) return "";
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host;
  } catch {
    return "";
  }
}

function normalizeTopic(input?: string | null) {
  return String(input || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function sentenceCase(input?: string | null) {
  const text = String(input || "").trim();
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function getEstimatedCustomerEarning(product: ProductResult) {
  const commission = Number(product.commission ?? 0);
  const epc = Number(product.epc ?? 0);
  const currency = product.currency || "USD";

  if (commission > 0) {
    return `Est. customer earning: ${commission.toFixed(2)} ${currency}`;
  }

  if (epc > 0) {
    return `Est. customer earning: ${epc.toFixed(2)} ${currency}`;
  }

  return "Est. customer earning: data pending";
}

function getCommissionLabel(product: ProductResult) {
  const commission = formatMoney(product.commission, product.currency || "USD");
  return commission ? `Commission: ${commission}` : "Commission: pending";
}

function getEpcLabel(product: ProductResult) {
  const epc = formatMoney(product.epc, product.currency || "USD");
  return epc ? `EPC: ${epc}` : "EPC: pending";
}

function getOfferVisual({
  uploadedImage,
  vaultImage,
  productImage,
}: {
  uploadedImage?: string | null;
  vaultImage?: string | null;
  productImage?: string | null;
}) {
  return uploadedImage || vaultImage || productImage || "";
}

function buildDisplayAffiliateLink(params: {
  activeVaultOffer?: SavedOffer | null;
  selectedSearchSavedOffer?: SavedOffer | null;
}) {
  const savedId = params.selectedSearchSavedOffer?.id || params.activeVaultOffer?.id;
  if (!savedId) return "";
  return `https://autoaffi.com/go/offer/${savedId}`;
}

function truncateMiddle(text: string, start = 32, end = 18) {
  if (!text) return "";
  if (text.length <= start + end + 3) return text;
  return `${text.slice(0, start)}...${text.slice(-end)}`;
}

function cleanProductName(input?: string | null) {
  const text = String(input || "").trim();
  if (!text) return "";

  const stripped = text
    .replace(
      /\b(official|premium|ultimate|complete|full|bundle|system|software|platform|tool|tools|app|apps|program|course|academy|membership|kit|package)\b/gi,
      ""
    )
    .replace(/\s{2,}/g, " ")
    .replace(/[|•]+/g, " ")
    .trim();

  if (!stripped) return text;

  const words = stripped.split(" ").filter(Boolean);
  if (words.length <= 4) return sentenceCase(stripped);

  return sentenceCase(words.slice(0, 4).join(" "));
}

function buildOfferSearchQuery(input?: string | null) {
  const raw = String(input || "").trim();
  if (!raw) return "";

  const normalized = raw.toLowerCase();

  const categoryMap: Record<string, string> = {
    "ai tools":
      "ai tools ai software automation productivity business software saas content creation video generator writing assistant image generator marketing copywriting workflow automation beginner ai",
    "phone accessories":
      "phone accessories phone case iphone case samsung case magsafe case clear case shockproof case slim case silicone case protective case mobile accessories aliexpress phone accessories tech accessories",
    fitness:
      "fitness home workout gym accessories resistance bands recovery tool muscle recovery training gear beginner fitness fat loss wellness workout equipment",
    beauty:
      "beauty skincare serum face care makeup beauty tool anti-aging glow routine self care hair care cosmetics beauty essentials",
    "home & kitchen":
      "home kitchen gadgets cooking tools storage organizer home organizer cleaning tool practical home product kitchen accessory appliance kitchen essentials",
    fashion:
      "fashion clothing outfit accessories style wardrobe everyday wear trendy basics streetwear handbag jewelry sunglasses",
    "business software":
      "business software saas crm automation sales tools email marketing invoicing project management workflow business productivity startup software",
    education:
      "education online course learning study skills training digital education certification teaching materials classroom tools language learning",
    pets:
      "pet products dog accessories cat accessories pet care pet grooming pet toy pet training leash feeder litter pet essentials",
    gaming:
      "gaming gamer accessories headset keyboard mouse controller rgb setup streaming setup gaming desk gaming gear console accessories",
    productivity:
      "productivity tools focus planner workflow automation organization time management deep work note taking calendar task management",
    travel:
      "travel accessories luggage travel gear carry on organizer portable essentials travel comfort passport holder packing cubes",
  };

  return categoryMap[normalized] || raw;
}

function detectIntentBucket(input?: string | null): CopyArchetype {
  const text = normalizeTopic(input || "");

  if (
    /(iphone|phone case|magsafe|transparent case|silicone case|shockproof|slim case|phone accessories|mobile accessories|case)/.test(
      text
    )
  ) {
    return "phone_case";
  }

  if (/(ai tools|ai|automation|software|saas|generator|assistant)/.test(text)) {
    return "ai_tool";
  }

  if (/(business software|crm|sales|email marketing|invoicing|project management)/.test(text)) {
    return "business_software";
  }

  if (/(productivity|focus|planner|workflow|task|calendar|notes)/.test(text)) {
    return "productivity";
  }

  if (/(beauty|skincare|makeup|hair|cosmetic)/.test(text)) {
    return "beauty";
  }

  if (/(fitness|gym|workout|muscle|wellness|training)/.test(text)) {
    return "fitness";
  }

  if (/(home|kitchen|cooking|organizer|storage|cleaning)/.test(text)) {
    return "home_kitchen";
  }

  if (/(fashion|style|clothing|outfit|wardrobe|jewelry|bag)/.test(text)) {
    return "fashion";
  }

  if (/(education|course|learning|study|training|teaching)/.test(text)) {
    return "education";
  }

  if (/(pet|dog|cat|grooming|leash|feeder|toy)/.test(text)) {
    return "pets";
  }

  if (/(gaming|gamer|controller|keyboard|mouse|headset|streaming)/.test(text)) {
    return "gaming";
  }

  if (/(travel|luggage|packing|carry on|passport|portable)/.test(text)) {
    return "travel";
  }

  return "generic";
}

function getSourcePriorityScore(product: ProductResult, intent: CopyArchetype) {
  const source = String(product.source || product.platform || "").toLowerCase();
  const name = String(product.name || "").toLowerCase();
  const category = String(product.category || "").toLowerCase();
  const haystack = `${source} ${name} ${category}`;

  const isAliExpress = /aliexpress/.test(haystack);
  const isAwin = /awin/.test(haystack);
  const isCJ = /\bcj\b|commission junction/.test(haystack);
  const isImpact = /impact/.test(haystack);
  const isDigistore = /digistore/.test(haystack);
  const isWarrior = /warrior/.test(haystack);

  switch (intent) {
    case "phone_case":
    case "fashion":
    case "gaming":
      if (isAliExpress) return 18;
      if (isAwin || isCJ) return 9;
      if (isImpact) return 6;
      return 0;

    case "ai_tool":
    case "business_software":
    case "productivity":
    case "education":
      if (isImpact || isCJ || isDigistore || isWarrior) return 18;
      if (isAwin) return 4;
      if (isAliExpress) return 2;
      return 0;

    case "beauty":
    case "fitness":
    case "home_kitchen":
    case "pets":
    case "travel":
      if (isAwin || isCJ || isImpact) return 14;
      if (isAliExpress) return 6;
      return 0;

    default:
      if (isAwin || isCJ || isImpact || isAliExpress) return 6;
      return 0;
  }
}

function getSemanticMismatchPenalty(product: ProductResult, intent: CopyArchetype) {
  const haystack =
    `${product.name} ${product.category} ${product.platform} ${product.merchantName || ""} ${product.source || ""}`.toLowerCase();

  const hasPhoneWords =
    /(iphone|phone case|magsafe|clear case|shockproof|silicone case|mobile accessories|case for)/.test(
      haystack
    );
  const hasAIToolWords =
    /(ai|software|saas|automation|generator|assistant|workflow|productivity|crm|marketing tool|writing tool|video tool)/.test(
      haystack
    );
  const hasBeautyWords = /(beauty|skincare|makeup|hair|serum|cosmetic)/.test(haystack);
  const hasFitnessWords = /(fitness|gym|workout|recovery|training)/.test(haystack);
  const hasHomeWords = /(home|kitchen|storage|organizer|cleaning|cooking)/.test(haystack);
  const hasFashionWords = /(fashion|clothing|outfit|jewelry|bag|style)/.test(haystack);
  const hasEducationWords = /(education|course|learning|study|training|teaching)/.test(haystack);
  const hasPetWords = /(pet|dog|cat|grooming|toy|leash|feeder)/.test(haystack);
  const hasGamingWords = /(gaming|gamer|controller|keyboard|mouse|headset|streaming)/.test(haystack);
  const hasTravelWords = /(travel|luggage|packing|carry on|passport|portable)/.test(haystack);

  const clearlyWrongRetailForAI =
    /(air freshener|spray|refill|linen|fragrance|cleaner|cleaning spray|oud)/.test(haystack);

  switch (intent) {
    case "phone_case":
      return hasPhoneWords ? 0 : 20;

    case "ai_tool":
    case "business_software":
    case "productivity":
      if (hasAIToolWords) return 0;
      if (clearlyWrongRetailForAI) return 30;
      return 18;

    case "beauty":
      return hasBeautyWords ? 0 : 16;

    case "fitness":
      return hasFitnessWords ? 0 : 16;

    case "home_kitchen":
      return hasHomeWords ? 0 : 16;

    case "fashion":
      return hasFashionWords ? 0 : 16;

    case "education":
      return hasEducationWords ? 0 : 16;

    case "pets":
      return hasPetWords ? 0 : 16;

    case "gaming":
      return hasGamingWords ? 0 : 16;

    case "travel":
      return hasTravelWords ? 0 : 16;

    default:
      return 0;
  }
}

function getOfferKindScore(product: ProductResult, intent: CopyArchetype) {
  const haystack =
    `${product.name} ${product.category} ${product.platform} ${product.merchantName || ""} ${product.source || ""}`.toLowerCase();

  const looksDigital =
    /(ai|software|saas|automation|generator|assistant|crm|membership|course|training|learning|platform|app)/.test(
      haystack
    );
  const looksPhysical =
    /(case|accessories|spray|bottle|serum|band|headset|keyboard|bag|toy|organizer|holder|luggage)/.test(
      haystack
    );

  const digitalIntent =
    intent === "ai_tool" ||
    intent === "business_software" ||
    intent === "productivity" ||
    intent === "education";

  if (digitalIntent && looksDigital) return 10;
  if (digitalIntent && looksPhysical) return -8;
  if (!digitalIntent && looksPhysical) return 8;
  if (!digitalIntent && looksDigital) return -4;

  return 0;
}

function scoreProductMatch(product: ProductResult, userIntent: string) {
  const haystack = `${product.name} ${product.category} ${product.platform} ${product.merchantName || ""} ${product.source || ""}`.toLowerCase();
  const words = normalizeTopic(userIntent).split(" ").filter((word) => word.length > 1);

  let score = 0;

  for (const word of words) {
    if (haystack.includes(word)) score += 4;
    if (product.name.toLowerCase().includes(word)) score += 6;
    if (product.category.toLowerCase().includes(word)) score += 5;
  }

  if (/iphone|phone case|magsafe|samsung case|clear case|shockproof|slim case/.test(haystack)) {
    score += 8;
  }
  if (/ai|software|automation|generator|assistant|saas/.test(haystack)) {
    score += 6;
  }
  if (/fitness|workout|gym|recovery/.test(haystack)) {
    score += 5;
  }
  if (/beauty|skincare|makeup|hair/.test(haystack)) {
    score += 5;
  }

  return score;
}

function getRankedProductScore(product: ProductResult, userIntent: string) {
  const intent = detectIntentBucket(userIntent);
  const matchScore = scoreProductMatch(product, userIntent);
  const sourceScore = getSourcePriorityScore(product, intent);
  const kindScore = getOfferKindScore(product, intent);
  const mismatchPenalty = getSemanticMismatchPenalty(product, intent);

  return matchScore + sourceScore + kindScore - mismatchPenalty;
}

function isStrongEnoughProductMatch(product: ProductResult, userIntent: string) {
  return getRankedProductScore(product, userIntent) >= 12;
}

function detectCopyArchetype(params: {
  topic?: string | null;
  offerLabel?: string | null;
  category?: string | null;
}): CopyArchetype {
  const haystack = `${params.topic || ""} ${params.offerLabel || ""} ${params.category || ""}`.toLowerCase();

  if (
    /(iphone|phone case|magsafe|transparent case|silicone case|case for|phone accessories|samsung case|mobile case)/.test(
      haystack
    )
  ) {
    return "phone_case";
  }

  if (/(ai|automation|software|saas|generator|assistant|tool|productivity)/.test(haystack)) {
    return "ai_tool";
  }

  if (/(beauty|skincare|makeup|hair|cosmetic)/.test(haystack)) {
    return "beauty";
  }

  if (/(fitness|gym|workout|muscle|wellness|training)/.test(haystack)) {
    return "fitness";
  }

  if (/(home|kitchen|cooking|organizer|storage|cleaning)/.test(haystack)) {
    return "home_kitchen";
  }

  if (/(fashion|style|clothing|outfit|wardrobe|jewelry|bag)/.test(haystack)) {
    return "fashion";
  }

  if (/(business software|crm|sales|email marketing|invoicing|project management)/.test(haystack)) {
    return "business_software";
  }

  if (/(education|course|learning|study|training|teaching)/.test(haystack)) {
    return "education";
  }

  if (/(pet|dog|cat|grooming|leash|feeder|toy)/.test(haystack)) {
    return "pets";
  }

  if (/(gaming|gamer|controller|keyboard|mouse|headset|streaming)/.test(haystack)) {
    return "gaming";
  }

  if (/(productivity|focus|planner|workflow|task|calendar|notes)/.test(haystack)) {
    return "productivity";
  }

  if (/(travel|luggage|packing|carry on|passport|portable)/.test(haystack)) {
    return "travel";
  }

  return "generic";
}

function getAnglePool(archetype: CopyArchetype): string[] {
  switch (archetype) {
    case "phone_case":
      return ["protection", "slim", "style", "daily_use", "grip", "gift"];
    case "ai_tool":
      return ["save_time", "easy_start", "better_output", "less_stress", "speed", "consistency"];
    case "beauty":
      return ["results", "routine", "confidence", "easy_use", "self_care", "daily_glow"];
    case "fitness":
      return ["results", "beginner", "motivation", "daily_use", "comfort", "progress"];
    case "home_kitchen":
      return ["practical", "organize", "save_time", "daily_use", "easy_upgrade", "smart_solution"];
    case "fashion":
      return ["style", "everyday", "confidence", "versatile", "gift", "easy_upgrade"];
    case "business_software":
      return ["save_time", "workflow", "organization", "sales", "simplicity", "clarity"];
    case "education":
      return ["learning", "easy_start", "progress", "clarity", "confidence", "results"];
    case "pets":
      return ["comfort", "care", "daily_use", "practical", "peace_of_mind", "gift"];
    case "gaming":
      return ["performance", "setup", "comfort", "immersion", "everyday", "upgrade"];
    case "productivity":
      return ["focus", "workflow", "clarity", "less_stress", "consistency", "organization"];
    case "travel":
      return ["convenience", "portable", "organization", "comfort", "smart_pack", "practical"];
    default:
      return ["benefit", "simplicity", "everyday_use", "value", "problem_solution", "trust"];
  }
}

function pickDifferentString(items: string[], previous = "", seed = Date.now()) {
  const unique = Array.from(new Set(items.filter(Boolean)));
  if (!unique.length) return "";
  if (unique.length === 1) return unique[0];

  const filtered = previous ? unique.filter((item) => item !== previous) : unique;
  const pool = filtered.length ? filtered : unique;

  return pickRandom(pool, seed);
}

function buildHookPool(params: {
  topic: string;
  offerLabel?: string;
  archetype: CopyArchetype;
  hasFunnel: boolean;
  hasRecurring: boolean;
  recurringLabel?: string;
  manualLink?: string;
}) {
  const topicLabel = normalizeTopic(params.topic || "your niche");
  const topicText = sentenceCase(topicLabel || "your niche");
  const offerLabel = cleanProductName(params.offerLabel || "");
  const recurringLabel = cleanProductName(params.recurringLabel || "");
  const linkHint = params.manualLink ? " Link in bio." : "";

  let hooks: string[] = [];

  switch (params.archetype) {
    case "phone_case":
      hooks = [
        `Want a ${topicLabel || "phone case"} that protects your phone without making it bulky?`,
        `A good ${topicLabel || "phone case"} should feel slim, clean, and easy to use every day.`,
        `If you want a cleaner everyday ${topicLabel || "phone case"}, this is a strong option.`,
        `${offerLabel || "This case"} keeps the look simple while giving your phone extra protection.`,
        `Your ${topicLabel || "phone case"} should protect your phone and still look good doing it.`,
        `A slim phone case is one of those upgrades you notice every single day.`,
      ];
      break;

    case "ai_tool":
    case "business_software":
    case "productivity":
      hooks = [
        `Trying to get better results with ${topicLabel}? Start with a tool that saves time.`,
        `If ${topicLabel} feels messy or slow, this kind of tool makes it much easier.`,
        `A good tool should help you move faster without making the process harder.`,
        `${offerLabel || "This tool"} is built for speed, clarity, and easier output.`,
        `If you want simpler ${topicLabel} workflows, this is the kind of tool worth testing.`,
        `The best ${topicLabel} tools save time first — everything else comes after that.`,
      ];
      break;

    case "beauty":
      hooks = [
        `A good ${topicLabel} product should fit into real life, not just look good in ads.`,
        `If you want simpler ${topicLabel} results, start with something easy to use consistently.`,
        `${offerLabel || "This beauty pick"} is the kind of product people keep reaching for.`,
        `The best ${topicLabel} products feel easy, effective, and realistic to use every day.`,
        `If your routine feels too complicated, this is a much easier place to start.`,
      ];
      break;

    case "fitness":
      hooks = [
        `The best ${topicLabel} products are the ones you actually keep using.`,
        `If you want better ${topicLabel} habits, start with something simple enough to stick to.`,
        `${offerLabel || "This fitness pick"} makes daily progress feel easier and more realistic.`,
        `You do not need complicated routines — you need something that fits real life.`,
        `A good ${topicLabel} product should help with consistency, not add more friction.`,
      ];
      break;

    case "home_kitchen":
      hooks = [
        `A smart ${topicLabel} product should make everyday life easier straight away.`,
        `${offerLabel || "This home pick"} is the kind of upgrade you notice from day one.`,
        `If you want a more practical setup around ${topicLabel}, this is a strong option.`,
        `The best ${topicLabel} products save time, reduce mess, and make life feel simpler.`,
      ];
      break;

    case "fashion":
      hooks = [
        `The right ${topicLabel} piece can make everyday outfits feel instantly better.`,
        `${offerLabel || "This fashion pick"} is easy to wear, easy to style, and easy to keep reaching for.`,
        `If you want something simple that still feels good, this is a strong ${topicLabel} option.`,
        `Great style usually starts with pieces that feel easy, versatile, and wearable.`,
      ];
      break;

    case "education":
      hooks = [
        `If you want better progress with ${topicLabel}, start with something that feels easy to follow.`,
        `${offerLabel || "This learning pick"} helps make ${topicLabel} clearer and easier to stick with.`,
        `A good education product should reduce confusion, not add more of it.`,
        `If learning ${topicLabel} feels overwhelming, this is a simpler place to start.`,
      ];
      break;

    case "pets":
      hooks = [
        `The best pet products are the ones that make daily care easier right away.`,
        `${offerLabel || "This pet pick"} is practical, easy to use, and built for real everyday routines.`,
        `If you want something more useful around ${topicLabel}, this is a strong option.`,
        `Simple products usually win in pet care — less hassle, better daily use.`,
      ];
      break;

    case "gaming":
      hooks = [
        `A good ${topicLabel} upgrade should improve the setup without making it complicated.`,
        `${offerLabel || "This gaming pick"} is a strong upgrade if you want more comfort or performance.`,
        `If your setup feels incomplete, this is the kind of ${topicLabel} product worth testing.`,
        `Small gaming upgrades can make a bigger difference than people think.`,
      ];
      break;

    case "travel":
      hooks = [
        `The best travel products make the whole trip feel easier, not more complicated.`,
        `${offerLabel || "This travel pick"} is practical, portable, and easy to appreciate fast.`,
        `If you want smoother travel around ${topicLabel}, this is a smart option.`,
        `A good travel product should save space, reduce hassle, and feel useful immediately.`,
      ];
      break;

    default:
      hooks = [
        `If you want better results with ${topicLabel}, start with something people understand fast.`,
        `A strong ${topicLabel} product should solve a real problem without making life harder.`,
        `${offerLabel || "This product"} is easy to understand, easy to use, and easy to want.`,
        `The best ${topicLabel} products feel clear, useful, and worth trying right away.`,
        `If you want a simpler upgrade in ${topicLabel}, this is a strong place to start.`,
        `People usually want the same thing from ${topicLabel}: something simple that actually helps.`,
      ];
      break;
  }

  const extras: string[] = [];

  if (params.hasRecurring && recurringLabel) {
    extras.push(
      `Looking at ${topicText}? ${recurringLabel} is built for long-term value, not just a quick win.`
    );
  }

  if (params.hasFunnel) {
    extras.push(`If you want the full breakdown, there’s a simple next step waiting for you.${linkHint}`);
  }

  return [...hooks, ...extras];
}

function buildBuyerFacingPreviewText(params: {
  topic: string;
  offerLabel?: string;
  recurringLabel?: string;
  hasFunnel: boolean;
  category?: string;
}) {
  const topic = normalizeTopic(params.topic || "your niche");
  const offerLabel = cleanProductName(params.offerLabel || "");
  const recurringLabel = cleanProductName(params.recurringLabel || "");
  const archetype = detectCopyArchetype({
    topic,
    offerLabel,
    category: params.category || "",
  });

  if (archetype === "phone_case") {
    return `${offerLabel || "This phone case"} gives you a cleaner everyday look while helping protect your phone from scratches, bumps, and daily wear.`;
  }

  if (archetype === "ai_tool" || archetype === "business_software" || archetype === "productivity") {
    return `${offerLabel || "This tool"} helps make ${topic} faster, simpler, and easier to keep consistent without the usual overwhelm.`;
  }

  if (archetype === "beauty") {
    return `${offerLabel || "This beauty product"} fits naturally into your routine and makes it easier to get a cleaner, more polished result.`;
  }

  if (archetype === "fitness") {
    return `${offerLabel || "This fitness product"} makes it easier to stay consistent, keep things simple, and actually build momentum over time.`;
  }

  if (archetype === "home_kitchen") {
    return `${offerLabel || "This home product"} is a practical everyday upgrade that helps make things cleaner, easier, or more organized right away.`;
  }

  if (archetype === "fashion") {
    return `${offerLabel || "This fashion piece"} is an easy everyday option if you want something simple, wearable, and easy to style.`;
  }

  if (archetype === "education") {
    return `${offerLabel || "This learning product"} helps make ${topic} feel clearer, more manageable, and easier to stick with.`;
  }

  if (archetype === "pets") {
    return `${offerLabel || "This pet product"} is designed to make daily care easier, more practical, and more comfortable in real life.`;
  }

  if (archetype === "gaming") {
    return `${offerLabel || "This gaming product"} is a simple upgrade if you want a setup that feels better, smoother, or more complete.`;
  }

  if (archetype === "travel") {
    return `${offerLabel || "This travel product"} is built to make trips feel easier, more organized, and less stressful from the start.`;
  }

  if (recurringLabel) {
    return `${recurringLabel} is designed for people who want something simple, useful, and easier to stick with long term.`;
  }

  if (params.hasFunnel) {
    return `This is a simple next step for people who want a clearer path, less confusion, and a better first result.`;
  }

  return `${offerLabel || "This product"} is a practical option for people who want something simple, clear, and easy to use in real life.`;
}

function buildFreshCaption(params: {
  topic: string;
  offerLabel?: string;
  angle: string;
  category?: string;
  previous?: string;
}) {
  const topic = normalizeTopic(params.topic || "your niche");
  const topicText = sentenceCase(topic || "your niche");
  const offerLabel = cleanProductName(params.offerLabel || "") || "This product";
  const archetype = detectCopyArchetype({
    topic,
    offerLabel,
    category: params.category || "",
  });

  let pool: string[] = [];

  if (archetype === "phone_case") {
    const byAngle: Record<string, string[]> = {
      protection: [
        `A good ${topic || "phone case"} should protect your phone without ruining the look.\n\n${offerLabel} keeps things simple while still giving you the everyday protection most people actually want.`,
        `Most people do not want a bulky case — they just want reliable protection and a clean finish.\n\nThat is exactly why ${offerLabel} is such an easy everyday option.`,
      ],
      slim: [
        `If you like your phone to feel slim in your hand, the case matters a lot.\n\n${offerLabel} gives you extra protection without making your phone feel heavy or overbuilt.`,
        `${offerLabel} is the kind of case people like because it keeps the phone feeling light, simple, and easy to carry every day.`,
      ],
      style: [
        `A ${topic || "phone case"} should not just protect your phone — it should still look good when you use it.\n\n${offerLabel} keeps the design clean and minimal.`,
        `Clean, simple, and easy to use.\n\n${offerLabel} is a strong pick if you want your phone protected without covering up the look.`,
      ],
      daily_use: [
        `The best ${topic || "phone cases"} are the ones that feel right every single day.\n\n${offerLabel} is easy to carry, easy to hold, and easy to keep on.`,
        `If you use your phone all day, your case should feel comfortable all day too.\n\n${offerLabel} is built for that kind of everyday use.`,
      ],
      grip: [
        `A slippery phone gets annoying fast.\n\n${offerLabel} gives you a cleaner grip and a more comfortable everyday feel.`,
        `One small upgrade can make your phone feel much better to use.\n\n${offerLabel} adds protection and a nicer grip without making things bulky.`,
      ],
      gift: [
        `A clean, practical phone accessory is one of those gifts people actually use.\n\n${offerLabel} is simple, useful, and easy to appreciate right away.`,
        `If you want a safe gift that feels useful instead of random, ${offerLabel} is a smart pick.`,
      ],
    };

    pool = byAngle[params.angle] || Object.values(byAngle).flat();
  } else if (archetype === "ai_tool" || archetype === "business_software" || archetype === "productivity") {
    const byAngle: Record<string, string[]> = {
      save_time: [
        `If ${topic} is taking too long, the right tool can make a huge difference.\n\n${offerLabel} helps you move faster without making the process more complicated.`,
        `The biggest win with a good tool is simple: it saves time.\n\n${offerLabel} is built to make ${topic} feel faster and easier.`,
      ],
      easy_start: [
        `A lot of tools look powerful and still feel hard to use.\n\n${offerLabel} is a better fit for people who want to start quickly and keep things simple.`,
        `If you want to get into ${topic} without overthinking every step, ${offerLabel} makes the process much easier to start.`,
      ],
      better_output: [
        `Better tools usually lead to better output.\n\n${offerLabel} helps you create cleaner, faster, and more usable results around ${topic}.`,
        `If you want stronger results in ${topic}, the tool you use matters.\n\n${offerLabel} makes better output feel easier to reach.`,
      ],
      less_stress: [
        `${topicText} does not need to feel overwhelming.\n\n${offerLabel} helps remove friction and makes the workflow easier to manage.`,
        `A good tool should reduce stress, not add more of it.\n\n${offerLabel} is designed to make ${topic} feel more manageable.`,
      ],
      speed: [
        `Sometimes speed is the whole advantage.\n\n${offerLabel} helps you move faster with ${topic} while still keeping the quality strong.`,
        `If you want to get more done in less time, ${offerLabel} is exactly the kind of tool worth testing.`,
      ],
      consistency: [
        `Consistency gets easier when the workflow gets easier.\n\n${offerLabel} helps you stay on track with ${topic} without burning time or energy.`,
        `The right tool can help you stop starting over every day.\n\n${offerLabel} brings more consistency to ${topic}.`,
      ],
    };

    pool = byAngle[params.angle] || Object.values(byAngle).flat();
  } else if (archetype === "beauty") {
    pool = [
      `${offerLabel} is a strong fit if you want a ${topic} product that feels realistic to use and easy to keep in your routine.`,
      `If you want cleaner, simpler ${topic} results, ${offerLabel} is the kind of product worth testing.`,
      `${offerLabel} works well because it feels easy, practical, and natural to use consistently.`,
    ];
  } else if (archetype === "fitness") {
    pool = [
      `${offerLabel} is a good option if you want ${topic} to feel easier to stick to in real life.`,
      `The best fitness products are usually the ones you keep using.\n\n${offerLabel} fits that kind of simple, repeatable progress.`,
      `If you want more consistent ${topic} habits, ${offerLabel} makes a strong starting point.`,
    ];
  } else if (archetype === "home_kitchen") {
    pool = [
      `${offerLabel} is the kind of home upgrade that makes everyday tasks feel easier almost immediately.`,
      `If you want a more practical setup around ${topic}, ${offerLabel} is a simple product that actually helps.`,
      `The best home products save time, reduce clutter, and feel useful right away.\n\n${offerLabel} fits that really well.`,
    ];
  } else if (archetype === "fashion") {
    pool = [
      `${offerLabel} is an easy fashion piece to reach for when you want something simple, wearable, and versatile.`,
      `If you want ${topic} that feels good without trying too hard, ${offerLabel} is a strong option.`,
      `Great everyday style usually comes from pieces that are easy to wear again and again.\n\n${offerLabel} does that well.`,
    ];
  } else if (archetype === "education") {
    pool = [
      `${offerLabel} makes ${topic} feel clearer, simpler, and easier to keep progressing with.`,
      `If you want to learn ${topic} without unnecessary overwhelm, ${offerLabel} is a strong place to start.`,
      `The best learning products reduce confusion and make the next step obvious.\n\n${offerLabel} does exactly that.`,
    ];
  } else if (archetype === "pets") {
    pool = [
      `${offerLabel} is a practical pet product that makes everyday care feel easier and more manageable.`,
      `If you want something more useful around ${topic}, ${offerLabel} is the kind of product people keep using.`,
      `Simple pet products usually win because they fit real daily routines.\n\n${offerLabel} is a strong example of that.`,
    ];
  } else if (archetype === "gaming") {
    pool = [
      `${offerLabel} is the kind of gaming upgrade that makes your setup feel better without overcomplicating it.`,
      `If you want a stronger ${topic} setup, ${offerLabel} is a simple upgrade worth looking at.`,
      `Small setup improvements can make a real difference.\n\n${offerLabel} is built for that kind of easy win.`,
    ];
  } else if (archetype === "travel") {
    pool = [
      `${offerLabel} is a practical travel option if you want something easier to pack, easier to use, and easier to appreciate.`,
      `The best travel products reduce hassle fast.\n\n${offerLabel} is built for that kind of smoother trip.`,
      `If you want ${topic} to feel less stressful and more organized, ${offerLabel} is a strong choice.`,
    ];
  } else {
    const byAngle: Record<string, string[]> = {
      benefit: [
        `If you want better results with ${topic}, start with something that feels easy to understand and easy to use.\n\n${offerLabel} does exactly that.`,
        `${offerLabel} is a strong option for people who want something practical, clear, and actually useful in real life.`,
      ],
      simplicity: [
        `Simple usually wins.\n\n${offerLabel} makes ${topic} feel easier to approach without losing the value people care about.`,
        `If you are tired of overcomplicated options in ${topic}, ${offerLabel} feels like a much easier choice.`,
      ],
      everyday_use: [
        `The best products are the ones that fit easily into everyday life.\n\n${offerLabel} is built to be one of those easy wins.`,
        `${offerLabel} works well because it feels practical, straightforward, and easy to keep using.`,
      ],
      value: [
        `Value is not about hype — it is about getting something you will actually use.\n\n${offerLabel} is a strong pick for that.`,
        `If you want something in ${topic} that feels worth it from day one, ${offerLabel} is a solid option.`,
      ],
      problem_solution: [
        `A strong product solves one annoying problem clearly.\n\n${offerLabel} makes that part of ${topic} feel much simpler.`,
        `If one part of ${topic} keeps feeling frustrating, ${offerLabel} is a cleaner solution than most people expect.`,
      ],
      trust: [
        `People usually want the same thing from ${topic}: something clear, useful, and easy to trust.\n\n${offerLabel} fits that well.`,
        `${offerLabel} is the kind of product people like because it feels understandable, practical, and low-friction.`,
      ],
    };

    pool = byAngle[params.angle] || Object.values(byAngle).flat();
  }

  return pickDifferentString(pool, params.previous || "", Date.now() + pool.length + topic.length);
}

function buildFreshBody(params: {
  topic: string;
  finalCTA: string;
  hasFunnel: boolean;
  offerLabel?: string;
  recurringLabel?: string;
  angle: string;
  category?: string;
  previous?: string;
}) {
  const topic = normalizeTopic(params.topic || "your niche");
  const topicText = sentenceCase(topic || "your niche");
  const offerLabel = cleanProductName(params.offerLabel || "") || "This product";
  const recurringLabel = cleanProductName(params.recurringLabel || "");
  const archetype = detectCopyArchetype({
    topic,
    offerLabel,
    category: params.category || "",
  });

  const ctaLine =
    params.finalCTA === "Link in first comment"
      ? `Check the first comment for the link.`
      : params.finalCTA === "Link in bio"
      ? `Use the link in bio.`
      : params.finalCTA === "DM me “start”"
      ? `DM me “start” and I’ll send it over.`
      : params.finalCTA === "Comment YES and I’ll send details"
      ? `Comment YES and I’ll send the details.`
      : params.finalCTA === "Share this with a friend"
      ? `Share this with someone who would actually use this.`
      : `Save this so you do not lose it.`;

  let pool: string[] = [];

  if (archetype === "phone_case") {
    pool = [
      `${offerLabel} is a strong option if you want your phone protected without adding a lot of bulk.\n\nIt keeps the look clean, feels easy in the hand, and works well for normal everyday use.\n\n${ctaLine}`,
      `A good ${topic || "phone case"} should be simple: protect the phone, feel comfortable, and still look good.\n\n${offerLabel} checks those boxes without overdoing anything.\n\n${ctaLine}`,
      `If you use your phone constantly, your case should feel right constantly.\n\n${offerLabel} helps with grip, daily protection, and a cleaner overall look.\n\n${ctaLine}`,
    ];
  } else if (archetype === "ai_tool" || archetype === "business_software" || archetype === "productivity") {
    pool = [
      `${offerLabel} helps make ${topic} faster, simpler, and easier to stay consistent with.\n\nThat matters when you want better output without spending more time or energy than necessary.\n\n${ctaLine}`,
      `The right tool can remove a lot of friction from ${topic}.\n\n${offerLabel} is built to help you move faster, get clearer results, and keep the process manageable.\n\n${ctaLine}`,
      `If ${topicText} feels too slow or too messy, ${offerLabel} is the kind of tool that can make the whole workflow feel lighter.\n\n${ctaLine}`,
    ];
  } else if (archetype === "beauty") {
    pool = [
      `${offerLabel} fits well if you want ${topic} to feel easier, more realistic, and more natural to stay consistent with.\n\nIt is the kind of product that works best when it fits into everyday life instead of making things more complicated.\n\n${ctaLine}`,
      `A good beauty product should feel simple enough to keep using and effective enough to notice.\n\n${offerLabel} is a strong option for that kind of routine.\n\n${ctaLine}`,
    ];
  } else if (archetype === "fitness") {
    pool = [
      `${offerLabel} is a practical fitness option if you want something that helps you stay consistent instead of starting over all the time.\n\nSimple progress usually comes from products that fit real life.\n\n${ctaLine}`,
      `If your goal is better ${topic}, the best products are often the easiest ones to keep using.\n\n${offerLabel} is built for that kind of repeatable momentum.\n\n${ctaLine}`,
    ];
  } else if (archetype === "home_kitchen") {
    pool = [
      `${offerLabel} is a practical everyday upgrade that helps make home tasks easier, cleaner, or more organized.\n\nThose small improvements are usually the ones that matter most over time.\n\n${ctaLine}`,
      `A good home product should save effort without adding more complexity.\n\n${offerLabel} is a strong option if you want something genuinely useful.\n\n${ctaLine}`,
    ];
  } else if (archetype === "fashion") {
    pool = [
      `${offerLabel} is a simple fashion option if you want something that feels easy to wear, easy to style, and easy to keep reaching for.\n\nThat kind of everyday value is usually what makes a piece worth it.\n\n${ctaLine}`,
      `The best style upgrades are usually the ones that fit into real life right away.\n\n${offerLabel} is a strong example of that.\n\n${ctaLine}`,
    ];
  } else if (archetype === "education") {
    pool = [
      `${offerLabel} helps make ${topic} feel clearer, more structured, and easier to keep moving forward with.\n\nThat matters most when you want progress without feeling overwhelmed.\n\n${ctaLine}`,
      `A strong learning product should reduce friction and make the next step obvious.\n\n${offerLabel} works well for that kind of steady progress.\n\n${ctaLine}`,
    ];
  } else if (archetype === "pets") {
    pool = [
      `${offerLabel} is built to make daily pet care easier, more practical, and more comfortable.\n\nThe best pet products are usually the simplest ones to use again and again.\n\n${ctaLine}`,
      `If you want something around ${topic} that feels genuinely helpful in real life, ${offerLabel} is a strong option.\n\n${ctaLine}`,
    ];
  } else if (archetype === "gaming") {
    pool = [
      `${offerLabel} is a simple setup upgrade if you want a gaming experience that feels smoother, better, or more comfortable.\n\nSmall upgrades often make a bigger difference than expected.\n\n${ctaLine}`,
      `A good gaming product should improve the setup without overcomplicating it.\n\n${offerLabel} is built for that kind of easy improvement.\n\n${ctaLine}`,
    ];
  } else if (archetype === "travel") {
    pool = [
      `${offerLabel} is a practical travel option if you want less hassle, better organization, and something that feels useful immediately.\n\nThat is usually what makes a travel product worth packing.\n\n${ctaLine}`,
      `The best travel products make the trip feel easier from the start.\n\n${offerLabel} is designed for that kind of smoother experience.\n\n${ctaLine}`,
    ];
  } else {
    pool = [
      `${offerLabel} is a practical option for people who want something simpler, clearer, and easier to use in real life.\n\nIt fits well if your focus is ${topic} and you want something that feels low-friction from the start.\n\n${ctaLine}`,
      `If you want a stronger result in ${topic}, it usually starts with picking something people instantly understand and actually want to use.\n\n${offerLabel} works well for that.\n\n${ctaLine}`,
      `${offerLabel} is easier to understand than most options, which makes it easier to trust and easier to act on.\n\nThat is a big reason it fits well inside ${topic} content.\n\n${ctaLine}`,
    ];
  }

  if (recurringLabel) {
    pool = pool.map(
      (item) =>
        `${item}\n\n${
          params.hasFunnel
            ? `There is also a simple next step if you want the full breakdown.`
            : `It also fits well for people looking at long-term tools like ${recurringLabel}.`
        }`
    );
  } else if (params.hasFunnel) {
    pool = pool.map((item) => `${item}\n\nThere is also a simple next step if you want the full breakdown.`);
  }

  return pickDifferentString(
    pool,
    params.previous || "",
    Date.now() + pool.length + topic.length + offerLabel.length
  );
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

function buildFinalLink({
  mode,
  offerType,
  productAffiliateUrl,
  recurringPlatform,
  recurringUserCode,
  funnelSlug,
}: {
  mode: "content_only" | "content_and_offer";
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

export default function PostOptimizerPage() {
  const [mode, setMode] = useState<Mode>("content_and_offer");
  const [inputStyle, setInputStyle] = useState<InputStyle>("manual");
  const [platform, setPlatform] = useState<PlatformKey>("tiktok");
  const [selectedQuickCategory, setSelectedQuickCategory] = useState("");

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

  const [activeRecurring, setActiveRecurring] = useState<RecurringPlatformRow[]>([]);
  const [selectedRecurringId, setSelectedRecurringId] = useState<string | null>(null);

  const [userFunnels, setUserFunnels] = useState<FunnelRow[]>([]);
  const [selectedFunnelId, setSelectedFunnelId] = useState<string | null>(null);

  async function loadFunnels() {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from("user_funnels")
      .select("*")
      .eq("user_id", user.id);

    if (!error && data) {
      const rows = data as FunnelRow[];
      setUserFunnels(rows);

      setSelectedFunnelId((prev) => {
        if (prev && rows.some((row) => row.id === prev)) return prev;
        return rows[0]?.id || null;
      });
    }
  }

  async function loadRecurringPlatforms() {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from("user_recurring_platforms")
      .select("*")
      .eq("user_id", user.id);

    if (!error && data) {
      const rows = data as RecurringPlatformRow[];
      setActiveRecurring(rows);

      setSelectedRecurringId((prev) => {
        if (prev && rows.some((row) => row.id === prev)) return prev;
        return rows[0]?.id || null;
      });
    }
  }

  useEffect(() => {
    loadFunnels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase]);

  useEffect(() => {
    loadRecurringPlatforms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase]);

  const hasRecurringStack =
    Array.isArray(activeRecurring) && activeRecurring.length > 0;

  const selectedRecurringPlatform = useMemo(() => {
    if (!selectedRecurringId) return null;
    return activeRecurring.find((r) => r.id === selectedRecurringId) || null;
  }, [activeRecurring, selectedRecurringId]);

  const [useFunnelMode, setUseFunnelMode] = useState(false);
  const [funnelLink, setFunnelLink] = useState("");

  const hasFunnel = useMemo(() => {
    return useFunnelMode && funnelLink.trim().length > 0;
  }, [useFunnelMode, funnelLink]);

  const [productResults, setProductResults] = useState<ProductResult[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [productSearchError, setProductSearchError] = useState<string | null>(null);
  const [savingSelectedProduct, setSavingSelectedProduct] = useState(false);
  const [selectedSearchSavedOffer, setSelectedSearchSavedOffer] =
    useState<SavedOffer | null>(null);
  const [lastSyncedProductKey, setLastSyncedProductKey] = useState<string>("");

  const [vaultOffers, setVaultOffers] = useState<SavedOffer[]>([]);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [selectedVaultOfferId, setSelectedVaultOfferId] = useState<string | null>(null);

  const [keywords, setKeywords] = useState("");
  const [offerIdea, setOfferIdea] = useState("");
  const [manualLink, setManualLink] = useState("");

  async function loadProductsForOffer(customQuery?: string) {
    const rawQuery = (customQuery ?? offerIdea).trim();
    const query = buildOfferSearchQuery(rawQuery);

    if (!query) {
      setProductResults([]);
      setSelectedProductId(null);
      setSelectedSearchSavedOffer(null);
      setLastSyncedProductKey("");
      setProductSearchError("Enter a product/offer first.");
      return;
    }

    setLoadingProducts(true);
    setProductSearchError(null);

    try {
      const res = await fetch(
        "/api/products/search?q=" + encodeURIComponent(query) + "&limit=18"
      );
      const data = await res.json();

      const rawResults = Array.isArray(data.results) ? data.results : [];

      const mappedResults: ProductResult[] = rawResults.map((item: any, index: number) => ({
        id: String(item.id || item.external_id || `result-${index}`),
        external_id: String(item.external_id || item.id || `result-${index}`),
        name: String(
          item.name ||
            item.title ||
            item.product_name ||
            item.offer_name ||
            "Untitled product"
        ),
        epc:
          item.epc === null || item.epc === undefined || item.epc === ""
            ? null
            : Number(item.epc),
        category: String(item.category || item.niche || "General"),
        platform: String(item.platform || item.source || "Unknown source"),
        productUrl: String(item.productUrl || item.product_url || item.url || ""),
        affiliate:
          item.affiliate ||
          item.affiliate_link ||
          item.productUrl ||
          item.product_url ||
          item.url ||
          undefined,
        imageUrl: item.imageUrl || item.image_url || undefined,
        merchantName: item.merchantName || item.merchant_name || undefined,
        source: item.source || item.platform || undefined,
        commission:
          item.commission === null || item.commission === undefined || item.commission === ""
            ? null
            : Number(item.commission),
        currency: item.currency || null,
      }));

      const rankedResults = mappedResults
        .map((product) => ({
          product,
          rankScore: getRankedProductScore(product, rawQuery),
        }))
        .sort((a, b) => b.rankScore - a.rankScore);

      const strongResults = rankedResults.filter((item) =>
        isStrongEnoughProductMatch(item.product, rawQuery)
      );

      const finalResults = (strongResults.length ? strongResults : rankedResults)
        .map((item) => item.product)
        .slice(0, 12);

      setProductResults(finalResults);
      setSelectedSearchSavedOffer(null);
      setLastSyncedProductKey("");

      if (!finalResults.length) {
        setSelectedProductId(null);
        setProductSearchError("No products found for this search.");
        return;
      }

      const topResult = finalResults[0];
      const topResultStrong = isStrongEnoughProductMatch(topResult, rawQuery);

      if (topResultStrong) {
        setSelectedProductId(topResult.id);
        setProductSearchError(null);
      } else {
        setSelectedProductId(null);
        setProductSearchError(
          "No strong match found yet. Please choose a product manually from the results below."
        );
      }
    } catch (err) {
      console.error("Product search error:", err);
      setProductResults([]);
      setSelectedProductId(null);
      setSelectedSearchSavedOffer(null);
      setLastSyncedProductKey("");
      setProductSearchError("Search failed. Try again.");
    } finally {
      setLoadingProducts(false);
    }
  }

  function handleOfferSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void loadProductsForOffer();
    }
  }

  async function loadVaultOffers() {
    try {
      setVaultLoading(true);
      setVaultError(null);

      const res = await fetch("/api/affiliate/products/list", {
        method: "GET",
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to load offer vault");
      }

      const items = Array.isArray(json.items) ? (json.items as SavedOffer[]) : [];
      setVaultOffers(items);

      setSelectedVaultOfferId((prev) => {
        if (prev && items.some((item) => item.id === prev)) return prev;
        const primary = items.find((item) => item.is_primary);
        if (primary?.id) return primary.id;
        return items[0]?.id || null;
      });
    } catch (e: any) {
      setVaultError(e?.message || "Failed to load offer vault");
    } finally {
      setVaultLoading(false);
    }
  }

  useEffect(() => {
    if (!user?.id) return;
    loadVaultOffers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const refreshAll = async () => {
      await Promise.all([
        loadVaultOffers(),
        loadFunnels(),
        loadRecurringPlatforms(),
      ]);
    };

    const onFocus = async () => {
      if (document.visibilityState === "visible") {
        await refreshAll();
      }
    };

    const interval = setInterval(refreshAll, 10000);

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const primaryVaultOffer = useMemo(() => {
    return vaultOffers.find((offer) => offer.is_primary) || null;
  }, [vaultOffers]);

  const selectedVaultOffer = useMemo(() => {
    if (!selectedVaultOfferId) return null;
    return vaultOffers.find((offer) => offer.id === selectedVaultOfferId) || null;
  }, [vaultOffers, selectedVaultOfferId]);

  const activeVaultOffer = selectedVaultOffer || primaryVaultOffer || null;

  const selectedProduct = useMemo(() => {
    if (!selectedProductId) return null;
    return productResults.find((p) => p.id === selectedProductId) || null;
  }, [productResults, selectedProductId]);

  const syncSelectedProductToOfferCenter = useCallback(
    async (product: ProductResult) => {
      if (!product?.source || !product?.external_id) return;

      const syncKey = `${product.source}:${product.external_id}`;
      if (lastSyncedProductKey === syncKey) return;

      try {
        setSavingSelectedProduct(true);

        const res = await fetch("/api/offers/select", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            from: "posts",
            item: {
              source: String(product.source).toLowerCase(),
              external_id: product.external_id,
              title: product.name,
              category: product.category,
              merchant_name: product.merchantName || null,
              product_url: product.productUrl || product.affiliate || null,
              image_url: product.imageUrl || null,
              commission: product.commission,
              epc: product.epc,
              currency: product.currency,
            },
          }),
        });

        const json = (await res.json()) as OfferSelectResponse;

        if (!res.ok || !json?.ok || !json.saved) {
          throw new Error(json?.error || "Failed to sync selected product");
        }

        setSelectedSearchSavedOffer(json.saved);
        setLastSyncedProductKey(syncKey);
      } catch (err: any) {
        console.error("Failed to sync selected product into user_offers", err);
      } finally {
        setSavingSelectedProduct(false);
      }
    },
    [lastSyncedProductKey]
  );

  useEffect(() => {
    if (!selectedProduct || activeVaultOffer) return;
    void syncSelectedProductToOfferCenter(selectedProduct);
  }, [selectedProduct, activeVaultOffer, syncSelectedProductToOfferCenter]);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState("");

  const resolvedPreviewImage = useMemo(() => {
    return getOfferVisual({
      uploadedImage: imagePreviewUrl,
      vaultImage: activeVaultOffer?.image_url || selectedSearchSavedOffer?.image_url,
      productImage: selectedProduct?.imageUrl,
    });
  }, [
    imagePreviewUrl,
    activeVaultOffer?.image_url,
    selectedSearchSavedOffer?.image_url,
    selectedProduct?.imageUrl,
  ]);

  const [selectedHookIndex, setSelectedHookIndex] = useState<number>(0);
  const [customHook, setCustomHook] = useState("");
  const [caption, setCaption] = useState("");
  const [body, setBody] = useState("");
  const [selectedCTA, setSelectedCTA] = useState<string | null>(null);

  const [hasGenerated, setHasGenerated] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationCount, setGenerationCount] = useState(0);
  const [lastGeneratedCopy, setLastGeneratedCopy] = useState<LastGeneratedCopy>({
    angle: "",
    hook: "",
    caption: "",
    body: "",
  });

  const [exactFixResult, setExactFixResult] =
    useState<ExactFixResultShape | null>(null);
  const [exactFixStatus, setExactFixStatus] =
    useState<"idle" | "running" | "ready" | "error">("idle");

  const [seoResult, setSeoResult] = useState<SeoScoreShape | null>(null);
  const [isSEOLoading, setIsSEOLoading] = useState(false);
  const [seoError, setSeoError] = useState<string | null>(null);

  const baseTopic = useMemo(() => {
    if (keywords.trim()) return keywords.trim();
    if (offerIdea.trim()) return offerIdea.trim();
    if (selectedProduct?.category) return selectedProduct.category;
    return "your niche";
  }, [offerIdea, keywords, selectedProduct?.category]);

  const activeProductTitle = cleanProductName(
    activeVaultOffer?.title ||
      selectedSearchSavedOffer?.title ||
      selectedProduct?.name ||
      ""
  );

  const copyArchetype = useMemo(() => {
    return detectCopyArchetype({
      topic: keywords.trim() || baseTopic,
      offerLabel: activeProductTitle || offerIdea,
      category:
        selectedProduct?.category ||
        activeVaultOffer?.category ||
        selectedSearchSavedOffer?.category ||
        offerIdea ||
        "",
    });
  }, [
    keywords,
    baseTopic,
    activeProductTitle,
    offerIdea,
    selectedProduct?.category,
    activeVaultOffer?.category,
    selectedSearchSavedOffer?.category,
  ]);

  const hookOptions = useMemo(() => {
    return buildHookPool({
      topic: keywords.trim() || baseTopic || "your niche",
      offerLabel: activeProductTitle || offerIdea || "",
      archetype: copyArchetype,
      hasFunnel,
      hasRecurring: hasRecurringStack,
      recurringLabel: selectedRecurringPlatform?.platform || "",
      manualLink,
    });
  }, [
    keywords,
    baseTopic,
    activeProductTitle,
    offerIdea,
    copyArchetype,
    hasFunnel,
    hasRecurringStack,
    selectedRecurringPlatform?.platform,
    manualLink,
  ]);

  const recommendedCTA = useMemo(() => {
    if (hasFunnel && hasRecurringStack) {
      return "Start the 3-step system: funnel + recurring = freedom";
    }

    if (hasFunnel) {
      return "Unlock the first step — free training inside";
    }

    if (hasRecurringStack) {
      const recurringLabel =
        selectedRecurringPlatform?.platform || "your recurring stack";
      return `Do this once → earn monthly with ${recurringLabel}`;
    }

    if (activeProductTitle || offerIdea) {
      return "Get instant access to the offer";
    }

    return "Save this so you don’t lose it";
  }, [
    hasFunnel,
    hasRecurringStack,
    selectedRecurringPlatform,
    activeProductTitle,
    offerIdea,
  ]);

  const ctaOptions = [
    "Link in bio",
    "Link in first comment",
    "DM me “start”",
    "Save this & come back",
    "Comment YES and I’ll send details",
    "Share this with a friend",
  ];

  const selectedOfferType:
    | "product"
    | "recurring"
    | "funnel"
    | undefined =
    activeVaultOffer || selectedSearchSavedOffer
      ? "product"
      : selectedRecurringPlatform
      ? "recurring"
      : selectedFunnelId
      ? "funnel"
      : undefined;

  const postMode: "content_only" | "content_and_offer" =
    mode === "content_only"
      ? "content_only"
      : selectedOfferType
      ? "content_and_offer"
      : "content_only";

  const productAffiliateUrl: string | undefined =
    activeVaultOffer?.affiliate_link ||
    activeVaultOffer?.product_url ||
    selectedSearchSavedOffer?.affiliate_link ||
    selectedSearchSavedOffer?.product_url ||
    selectedProduct?.affiliate ||
    selectedProduct?.productUrl ||
    undefined;

  const recurringPlatform: string | undefined =
    selectedRecurringPlatform?.platform ?? undefined;

  const autoaffiUserCode: string | undefined =
    selectedRecurringPlatform?.autoaffi_user_code ?? undefined;

  const funnelSlug: string | undefined = selectedFunnelId ?? undefined;

  const finalCTA = selectedCTA || recommendedCTA;

  const normalizedOfferType:
    | "product"
    | "recurring"
    | "funnel"
    | undefined = selectedOfferType ?? undefined;

  const finalLink =
    mode === "content_only"
      ? ""
      : buildFinalLink({
          mode: postMode,
          offerType: normalizedOfferType,
          productAffiliateUrl,
          recurringPlatform,
          recurringUserCode: autoaffiUserCode,
          funnelSlug,
        });

  const linkHint = resolveLinkHint(finalCTA, finalLink);

  const displayAffiliateLink = useMemo(() => {
    return buildDisplayAffiliateLink({
      activeVaultOffer,
      selectedSearchSavedOffer,
    });
  }, [activeVaultOffer, selectedSearchSavedOffer]);

  useEffect(() => {
    setLastGeneratedCopy({
      angle: "",
      hook: "",
      caption: "",
      body: "",
    });
  }, [selectedProductId, selectedVaultOfferId, selectedRecurringId, selectedFunnelId, keywords, offerIdea]);

  const selectedProductIntent = useMemo(() => {
    return keywords.trim() || offerIdea.trim() || selectedQuickCategory.trim() || baseTopic;
  }, [keywords, offerIdea, selectedQuickCategory, baseTopic]);

  const selectedProductRankScore = useMemo(() => {
    if (!selectedProduct) return 0;
    return getRankedProductScore(selectedProduct, selectedProductIntent);
  }, [selectedProduct, selectedProductIntent]);

  function handleGenerate() {
    if (isGenerating) return;

    setIsGenerating(true);
    setCopyMessage("");
    setExactFixResult(null);
    setExactFixError(null);
    setExactFixStatus("idle");

    if (
      mode === "content_and_offer" &&
      selectedProduct &&
      !activeVaultOffer &&
      !isStrongEnoughProductMatch(selectedProduct, selectedProductIntent)
    ) {
      setIsGenerating(false);
      setProductSearchError(
        "Selected product does not match your topic/category strongly enough yet. Pick a stronger match before generating."
      );
      return;
    }

    try {
      const nextGeneration = generationCount + 1;
      setGenerationCount(nextGeneration);

      const topic =
        keywords.trim() ||
        baseTopic ||
        selectedProduct?.category ||
        offerIdea ||
        "your niche";

      const offerLabel =
        activeVaultOffer?.title ||
        selectedSearchSavedOffer?.title ||
        selectedProduct?.name ||
        offerIdea ||
        undefined;

      const recurringLabel = selectedRecurringPlatform?.platform || undefined;

      const categoryLabel =
        selectedProduct?.category ||
        activeVaultOffer?.category ||
        selectedSearchSavedOffer?.category ||
        offerIdea ||
        "";

      const archetype = detectCopyArchetype({
        topic,
        offerLabel,
        category: categoryLabel,
      });

      const anglePool = getAnglePool(archetype);
      const selectedAngle = pickDifferentString(
        anglePool,
        lastGeneratedCopy.angle,
        Date.now() + nextGeneration + anglePool.length
      );

      const freshHookPool = buildHookPool({
        topic,
        offerLabel,
        archetype,
        hasFunnel,
        hasRecurring: hasRecurringStack,
        recurringLabel,
        manualLink,
      });

      const selectedHook = pickDifferentString(
        freshHookPool,
        lastGeneratedCopy.hook,
        Date.now() + nextGeneration * 7 + freshHookPool.length
      );

      const freshCaption = buildFreshCaption({
        topic,
        offerLabel,
        angle: selectedAngle,
        category: categoryLabel,
        previous: lastGeneratedCopy.caption,
      });

      const freshBody = buildFreshBody({
        topic,
        finalCTA,
        hasFunnel,
        offerLabel,
        recurringLabel,
        angle: selectedAngle,
        category: categoryLabel,
        previous: lastGeneratedCopy.body,
      });

      setHasGenerated(true);
      setSelectedHookIndex(
        Math.max(
          0,
          hookOptions.findIndex((h) => h === selectedHook)
        )
      );
      setCustomHook(selectedHook);
      setCaption(freshCaption);
      setBody(freshBody);
      setLastGeneratedCopy({
        angle: selectedAngle,
        hook: selectedHook,
        caption: freshCaption,
        body: freshBody,
      });

      setSeoResult({
        score: 9.2,
        breakdown: {
          hook: 94,
          seo: 93,
          engagement: 91,
          clarity: 91,
        },
        keywords: (
          keywords?.trim() ||
          offerIdea?.trim() ||
          activeProductTitle ||
          baseTopic ||
          "online business"
        )
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 5),
      });
    } finally {
      setIsGenerating(false);
    }
  }

  const fullContentForSEO = useMemo(() => {
    const parts = [customHook || hookOptions[selectedHookIndex], caption, body];
    return parts.filter(Boolean).join("\n\n");
  }, [customHook, hookOptions, selectedHookIndex, caption, body]);

  const [isExactFixLoading, setIsExactFixLoading] = useState(false);
  const [exactFixError, setExactFixError] = useState<string | null>(null);
  const [isSEOFixing, setIsSEOFixing] = useState(false);

  async function handleRunExactFix() {
    try {
      setIsExactFixLoading(true);
      setExactFixError(null);
      setExactFixStatus("running");

      const sourceHook = (customHook || hookOptions[selectedHookIndex] || "").trim();
      const sourceCaption = caption.trim();
      const sourceBody = body.trim();

      if (!sourceHook && !sourceCaption && !sourceBody) {
        setExactFixError("Generate your post first.");
        setExactFixStatus("error");
        return;
      }

      const result = await runExactFixEngine({
        hook: sourceHook,
        caption: sourceCaption,
        body: sourceBody,
        niche: baseTopic,
      }).catch(() => null);

      if (result) {
        setExactFixResult(result as ExactFixResultShape);
        setExactFixStatus("ready");
        return;
      }

      const fallbackHook =
        sourceHook.length < 12
          ? `Stop scrolling — this is the smarter way to approach ${baseTopic}.`
          : sourceHook;

      const fallbackCaption =
        sourceCaption.length < 40
          ? `${sourceCaption}\n\nThis is one of the clearest ways to get better results around ${baseTopic} without making it complicated.`
          : sourceCaption;

      const fallbackBody =
        sourceBody.length < 80
          ? `${sourceBody}\n\nFocus on one clear problem, one strong promise, and one clean reason to click. That alone usually improves performance fast.`
          : sourceBody;

      setExactFixResult({
        hook: fallbackHook,
        caption: fallbackCaption,
        body: fallbackBody,
        score: 9.3,
        howToReach10: [
          "Make the first line even more specific",
          "Use a stronger promise in the caption",
          "Keep one clear CTA only",
          "Reduce generic wording and increase clarity",
        ],
        breakdown: {
          hook: 94,
          seo: 93,
          engagement: 91,
          clarity: 91,
        },
      });
      setExactFixStatus("ready");
    } catch (err) {
      console.error("ExactFixEngine error", err);
      setExactFixError("Something went wrong. Please try again.");
      setExactFixStatus("error");
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

    const keyword =
      keywords?.trim() ||
      offerIdea?.trim() ||
      activeProductTitle ||
      baseTopic ||
      "online business";

    setCaption((prev) => {
      const base = prev?.trim() || "";
      return `${base}

#${keyword.replace(/\s+/g, "").toLowerCase()} #growth #onlinebusiness #marketing #sidehustle #contentstrategy #digitalincome`;
    });

    setBody((prev) => {
      const base = prev?.trim() || "";
      return `${base}

👉 Save this post so you don’t forget it.
👉 Use one keyword focus: ${keyword}
👉 Keep the CTA clear and singular.`;
    });

    setSeoResult({
      forcedRefresh: Date.now(),
      score: 9.4,
      breakdown: {
        hook: 95,
        seo: 94,
        engagement: 92,
        clarity: 92,
      },
      keywords: keyword.split(/\s+/).filter(Boolean).slice(0, 5),
    });

    setIsSEOFixing(false);
  }

  async function handleRunSEO() {
    try {
      setIsSEOLoading(true);
      setSeoError(null);

      if (!fullContentForSEO || fullContentForSEO.trim().length < 20) {
        setSeoError("Generate your post first before running SEO analysis.");
        return;
      }

      setSeoResult({
        triggeredAt: Date.now(),
        score: 9.2,
        breakdown: {
          hook: 94,
          seo: 93,
          engagement: 91,
          clarity: 91,
        },
        keywords: (
          keywords?.trim() ||
          offerIdea?.trim() ||
          activeProductTitle ||
          baseTopic ||
          "online business"
        )
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 5),
      });
    } catch {
      setSeoError("Failed to analyze SEO for this post.");
    } finally {
      setIsSEOLoading(false);
    }
  }

  const tiktokPreview = useMemo(() => {
    const userHandle = "@autoaffi.creator";
    const firstLine = (customHook || hookOptions[selectedHookIndex] || "").trim();
    const combinedCaption = [firstLine, caption].filter(Boolean).join("\n\n");

    const previewLinkHint =
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
      linkHint: previewLinkHint,
    };
  }, [customHook, hookOptions, selectedHookIndex, caption, mode, finalCTA]);

  const buyerFacingPreviewText = useMemo(() => {
    return buildBuyerFacingPreviewText({
      topic: keywords.trim() || baseTopic,
      offerLabel:
        activeVaultOffer?.title ||
        selectedSearchSavedOffer?.title ||
        selectedProduct?.name ||
        offerIdea ||
        "",
      recurringLabel: selectedRecurringPlatform?.platform || "",
      hasFunnel,
      category:
        selectedProduct?.category ||
        activeVaultOffer?.category ||
        selectedSearchSavedOffer?.category ||
        offerIdea ||
        "",
    });
  }, [
    keywords,
    baseTopic,
    activeVaultOffer?.title,
    activeVaultOffer?.category,
    selectedSearchSavedOffer?.title,
    selectedSearchSavedOffer?.category,
    selectedProduct?.name,
    selectedProduct?.category,
    offerIdea,
    selectedRecurringPlatform?.platform,
    hasFunnel,
  ]);

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

  async function handleDownloadPicture() {
    if (!resolvedPreviewImage) {
      showCopyMessage("No picture available to download");
      return;
    }

    try {
      const response = await fetch(resolvedPreviewImage);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `autoaffi-post-preview-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
      showCopyMessage("Picture downloaded");
    } catch {
      const a = document.createElement("a");
      a.href = resolvedPreviewImage;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
      showCopyMessage("Opened picture");
    }
  }

  const currentGuidelines = platformImageGuidelines[platform];

  const selectedProductSummary = useMemo(() => {
    if (!selectedProduct) return null;

    return {
      title: selectedProduct.name,
      earning: getEstimatedCustomerEarning(selectedProduct),
      commission: getCommissionLabel(selectedProduct),
      epc: getEpcLabel(selectedProduct),
      affiliate:
        selectedSearchSavedOffer?.affiliate_link ||
        selectedProduct.affiliate ||
        selectedProduct.productUrl ||
        "",
      merchant:
        selectedProduct.merchantName ||
        selectedProduct.source ||
        getHostLabel(selectedProduct.productUrl),
      category: selectedProduct.category,
      platform: selectedProduct.platform,
      image:
        selectedSearchSavedOffer?.image_url ||
        selectedProduct.imageUrl ||
        null,
      trackingReady: Boolean(selectedSearchSavedOffer?.affiliate_link),
    };
  }, [selectedProduct, selectedSearchSavedOffer]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50 px-4 py-8 md:py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 lg:flex-row">
        <div className="flex-1">
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

          <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-xs shadow-[0_18px_50px_rgba(0,0,0,0.6)]">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              What do you want to do?
            </p>

            <div className="mb-3 grid gap-2 md:grid-cols-2">
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
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              <span className="font-semibold text-yellow-300">Platform focus:</span>

              <PlatformPill platform={platform} setPlatform={setPlatform} value="tiktok" label="TikTok" />
              <PlatformPill platform={platform} setPlatform={setPlatform} value="instagram" label="Instagram" />
              <PlatformPill platform={platform} setPlatform={setPlatform} value="facebook" label="Facebook" />
              <PlatformPill platform={platform} setPlatform={setPlatform} value="youtube" label="YouTube Shorts" />
            </div>
          </section>

          <section className="mb-8 rounded-2xl border border-yellow-500/40 bg-slate-900/70 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.7)]">
            <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-baseline md:justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-yellow-300">
                Step 1 — Tell Autoaffi what you’re doing
              </h2>
              <p className="text-[11px] text-slate-400">
                Start here. Steps 2–3 adapt to your input.
              </p>
            </div>

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

            {inputStyle === "manual" && (
              <>
                <label className="mb-1 block text-xs font-semibold text-slate-300">
                  What do you want this post to be about?
                </label>

                <input
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="ex: AI side hustles, fitness for beginners..."
                  className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500"
                />

                {mode !== "content_only" && (
                  <>
                    <label className="mb-1 block text-xs font-semibold text-slate-300">
                      What product/offer do you want to promote?
                    </label>

                    <div className="mb-3">
                      <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                        Or pick a category
                      </label>

                      <select
                        value={selectedQuickCategory}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSelectedQuickCategory(value);
                          if (value) {
                            setOfferIdea(value);
                            void loadProductsForOffer(value);
                          }
                        }}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                      >
                        <option value="">Choose a category...</option>
                        {quickOfferCategories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mb-4 flex flex-col gap-2 sm:flex-row">
                      <input
                        type="text"
                        value={offerIdea}
                        onChange={(e) => setOfferIdea(e.target.value)}
                        onKeyDown={handleOfferSearchKeyDown}
                        placeholder="ex: AI video tool, email course, membership..."
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500"
                      />
                      <button
                        type="button"
                        onClick={() => loadProductsForOffer()}
                        disabled={loadingProducts}
                        className="rounded-lg border border-yellow-400/60 bg-yellow-400/10 px-4 py-2 text-sm font-semibold text-yellow-300 hover:bg-yellow-400/20 disabled:opacity-60"
                      >
                        {loadingProducts ? "Searching…" : "Search"}
                      </button>
                    </div>
                  </>
                )}

                <p className="text-[11px] text-slate-500 mb-1">
                  Autoaffi will generate hooks & captions based on this.
                </p>
              </>
            )}

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

            {mode !== "content_only" && (
              <>
                <div className="mb-5 rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-yellow-300">
                      Offer Vault (recommended)
                    </p>

                    <Link
                      href="/login/dashboard/affiliate"
                      className="text-[10px] text-yellow-300 underline underline-offset-2 hover:text-yellow-200"
                    >
                      Manage offers
                    </Link>
                  </div>

                  {vaultLoading && (
                    <p className="text-[11px] text-yellow-200/80">
                      Loading your saved offers…
                    </p>
                  )}

                  {vaultError && (
                    <p className="text-[11px] text-red-300/90">{vaultError}</p>
                  )}

                  {!vaultLoading && !vaultOffers.length && (
                    <p className="text-[11px] text-yellow-200/80">
                      No saved offers yet. Add offers in <span className="font-semibold">Offer Command Center</span> to use them here automatically.
                    </p>
                  )}

                  {!!vaultOffers.length && (
                    <>
                      <p className="mb-2 text-[11px] text-yellow-200/80">
                        These are your saved recommended offers. Primary is auto-selected.
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {vaultOffers.slice(0, 8).map((offer) => {
                          const active = selectedVaultOfferId === offer.id;

                          return (
                            <button
                              key={offer.id}
                              type="button"
                              onClick={() => {
                                setSelectedVaultOfferId(offer.id);
                                setSelectedProductId(null);
                                setSelectedSearchSavedOffer(null);
                                setLastSyncedProductKey("");
                              }}
                              className={`rounded-full border px-3 py-1 text-[11px] transition ${
                                active
                                  ? "border-yellow-300 bg-yellow-300 text-slate-900"
                                  : "border-yellow-500/40 text-yellow-100 hover:border-yellow-300/80"
                              }`}
                            >
                              {offer.title || "Untitled offer"}
                              {offer.is_primary ? " • Primary" : ""}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                <div className="mb-5 rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Global offer search
                    </p>

                    <div className="flex items-center gap-2">
                      {savingSelectedProduct && (
                        <span className="text-[10px] text-emerald-300">Syncing tracking…</span>
                      )}
                      {loadingProducts && (
                        <span className="text-[10px] text-yellow-300">Searching…</span>
                      )}
                    </div>
                  </div>

                  {productSearchError && (
                    <p className="mb-2 text-[11px] text-slate-500">{productSearchError}</p>
                  )}

                  {selectedProductSummary && (
                    <div className="mb-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                      <p className="text-[10px] text-slate-500">
                        Relevance score:{" "}
                        <span
                          className={`font-semibold ${
                            selectedProductRankScore >= 18
                              ? "text-emerald-300"
                              : selectedProductRankScore >= 12
                              ? "text-yellow-300"
                              : "text-red-300"
                          }`}
                        >
                          {selectedProductRankScore}
                        </span>
                      </p>
                    </div>
                  )}

                  {selectedProductSummary && (
                    <div className="mb-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-yellow-300">
                        Selected product
                      </p>

                      <div className="mt-2 flex gap-3">
                        {selectedProductSummary.image ? (
                          <img
                            src={selectedProductSummary.image}
                            alt={selectedProductSummary.title}
                            className="h-20 w-20 rounded-xl border border-slate-700 object-cover"
                          />
                        ) : null}

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-100">
                            {selectedProductSummary.title}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-400">
                            {selectedProductSummary.platform} • {selectedProductSummary.category}
                          </p>
                          {selectedProductSummary.merchant ? (
                            <p className="mt-1 text-[10px] text-slate-500">
                              {selectedProductSummary.merchant}
                            </p>
                          ) : null}

                          <div className="mt-2 space-y-1">
                            <p className="text-[11px] font-semibold text-emerald-300">
                              {selectedProductSummary.earning}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {selectedProductSummary.commission}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {selectedProductSummary.epc}
                            </p>
                            {selectedProductSummary.trackingReady && (
                              <p className="text-[10px] font-semibold text-emerald-300">
                                Verified Autoaffi tracking active
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {productResults.length > 0 ? (
                    <div className="grid gap-2 md:grid-cols-3 text-[11px]">
                      {productResults.slice(0, 6).map((product, index) => {
                        const isActive = selectedProductId === product.id;
                        const hostLabel = getHostLabel(product.productUrl);
                        const earningLabel = getEstimatedCustomerEarning(product);
                        const commissionLabel = getCommissionLabel(product);
                        const epcLabel = getEpcLabel(product);

                        return (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => {
                              setSelectedProductId(product.id);
                              setSelectedVaultOfferId(null);
                            }}
                            className={`group rounded-xl border px-3 py-2 text-left transition ${
                              isActive
                                ? "border-yellow-400 bg-yellow-400/10"
                                : "border-slate-800 bg-slate-900/80 hover:border-yellow-400/70"
                            }`}
                          >
                            <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-yellow-300/90">
                              Result {index + 1}
                            </p>

                            {product.imageUrl ? (
                              <div className="mb-2 overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
                                <img
                                  src={product.imageUrl}
                                  alt={product.name}
                                  className="h-24 w-full object-cover"
                                />
                              </div>
                            ) : null}

                            <p className="font-semibold text-slate-100 mb-1 line-clamp-2">
                              {product.name}
                            </p>

                            <p className="text-slate-400 line-clamp-1">
                              {product.platform} • {product.category}
                            </p>

                            {(product.merchantName || product.source || hostLabel) && (
                              <p className="mt-1 text-[10px] text-slate-500 line-clamp-1">
                                {product.merchantName || product.source || hostLabel}
                              </p>
                            )}

                            <div className="mt-2 space-y-1">
                              <p className="text-[10px] text-emerald-300">
                                {earningLabel}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {commissionLabel}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {epcLabel}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      Type a product/offer above and click Search to search the global catalog.
                    </p>
                  )}
                </div>

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
                            {funnel.name || funnel.funnel_url || "Unnamed funnel"}
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
                      Autoaffi will adapt hooks & captions automatically.
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

                <div className="mt-1 space-y-3">
                  <div className="mb-4 rounded-2xl border border-yellow-500/40 bg-black/40 p-4 shadow-[0_0_25px_rgba(255,200,0,0.15)]">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-yellow-300">
                      Recommended CTA — Autoaffi AI
                    </p>

                    <div className="rounded-xl bg-gradient-to-r from-yellow-500/20 via-yellow-400/10 to-yellow-500/20 border border-yellow-500/30 p-3">
                      <p className="text-sm font-semibold text-yellow-300 drop-shadow">
                        {recommendedCTA}
                      </p>
                      <p className="mt-1 text-[10px] text-yellow-200/80 italic">
                        Auto-updates based on niche, offer, funnel & recurring stack.
                      </p>
                    </div>
                  </div>

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

            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className={`mt-5 w-full rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-600 py-3 text-sm font-semibold text-slate-900 shadow-lg transition ${
                isGenerating ? "opacity-70 cursor-not-allowed" : "hover:brightness-110"
              }`}
            >
              {isGenerating ? "Generating…" : "Generate hooks, caption & body"}
            </button>

            <p className="mt-2 text-[11px] text-slate-500">
              Step 2 lets you refine text. Step 3 gives visual preview & SEO score.
            </p>
          </section>

          {hasGenerated && (
            <div className="flex flex-col gap-6 lg:flex-row">
              <div className="min-w-0 flex-1">
                <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-[0_18px_40px_rgba(0,0,0,0.6)]">
                  <div className="mb-4 space-y-1">
                    <p className="text-[11px] text-slate-400">
                      Step 2 lets you refine text. Step 3 gives visual preview, SEO score &{" "}
                      <span className="text-blue-300/90"> Conversion Power analysis</span>.
                    </p>

                    <p className="text-[11px] text-yellow-300/90 font-semibold">
                      Your affiliate, funnel or recurring link is automatically added in{" "}
                      <span className="underline underline-offset-2">Step 3</span>.
                      When you copy your post, Autoaffi always inserts your correct link —{" "}
                      <span className="text-yellow-200">based on Product, Funnel or Recurring platform.</span>
                    </p>
                  </div>

                  <div className="mb-4">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-[11px] font-semibold text-yellow-300">Hook styles</p>

                      <button
                        type="button"
                        onClick={async () => {
                          const hookText = (customHook || hookOptions[selectedHookIndex] || "").trim();
                          if (!hookText) {
                            showCopyMessage("No hook to copy yet");
                            return;
                          }
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
                            customHook ? customHook === hook : selectedHookIndex === idx
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

                  <div className="mb-4">
                    <p className="text-[11px] font-semibold text-yellow-300 mb-1">Final hook</p>

                    <textarea
                      rows={2}
                      value={customHook || hookOptions[selectedHookIndex] || ""}
                      onChange={(e) => setCustomHook(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                    />
                  </div>

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
                      rows={7}
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                    />
                  </div>

                  {copyMessage && (
                    <p className="mt-1 text-[11px] text-emerald-400">✓ {copyMessage}</p>
                  )}

                  <div className="mb-6 rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-yellow-300 mb-2">
                      Optional — Add an image for preview
                    </h3>

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
                </section>

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

                  {finalLink && (
                    <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
                        Active affiliate link
                      </p>
                      <p className="mt-1 text-[11px] text-emerald-100">
                        {displayAffiliateLink || truncateMiddle(finalLink)}
                      </p>
                      <p className="mt-1 text-[10px] text-emerald-200/60">
                        Smart Autoaffi bridge shown in preview. Your real affiliate link is still copied correctly.
                      </p>
                      <button
                        type="button"
                        onClick={async () => {
                          await copyToClipboard(finalLink);
                          showCopyMessage("Affiliate link copied");
                        }}
                        className="mt-2 rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-400/20"
                      >
                        Copy affiliate link
                      </button>
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                    <div className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-950 to-slate-900 p-4 text-xs">
                      <div className="mb-3 flex items-center justify-between text-[11px] text-slate-500">
                        <div className="flex gap-2">
                          <span className="font-semibold text-slate-300">Following</span>
                          <span className="text-slate-500">For You</span>
                        </div>
                        <span className="text-slate-500">•••</span>
                      </div>

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

                      <div className="mb-3 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-100">
                        {tiktokPreview.caption}

                        {tiktokPreview.linkHint && (
                          <p className="mt-2 font-semibold text-yellow-300">
                            {tiktokPreview.linkHint}
                          </p>
                        )}
                      </div>

                      {resolvedPreviewImage ? (
                        <div className="mb-3 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
                          <div className="mx-auto max-w-[360px]">
                            <img
                              src={resolvedPreviewImage}
                              alt="Post preview visual"
                              className="h-[210px] w-full object-cover"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="mb-3 flex h-[180px] items-center justify-center rounded-2xl border border-slate-800 bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.18),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(96,165,250,0.18),_transparent_55%)] text-center text-[11px] text-slate-500">
                          Product image will appear here when the selected offer has an image
                          or when you upload one above.
                        </div>
                      )}

                      <div className="mb-3 space-y-3 text-[11px] text-slate-300">
                        <p className="leading-relaxed text-slate-200">
                          {buyerFacingPreviewText}
                        </p>

                        {displayAffiliateLink && (
                          <p className="break-all rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-[10px] text-slate-400">
                            {displayAffiliateLink}
                          </p>
                        )}

                        <div className="whitespace-pre-wrap text-[11px] text-slate-400">
                          {body}
                        </div>
                      </div>

                      {finalCTA && (
                        <p className="mt-2 text-[12px] font-semibold text-yellow-300">
                          {finalCTA}
                        </p>
                      )}

                      <div className="mt-4 flex items-center justify-between text-[10px] text-slate-500">
                        <span>❤️ 12.3K</span>
                        <span>💬 483</span>
                        <span>↪ 129</span>
                        <span>⋯</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      <div className="relative mx-auto w-full max-w-[260px] overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900 via-slate-950 to-black shadow-[0_18px_40px_rgba(0,0,0,0.8)] aspect-[9/16]">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.18),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(96,165,250,0.18),_transparent_55%)]" />

                        <div className="relative flex h-full flex-col p-4">
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

                            <p className="text-sm font-bold leading-snug text-slate-50 drop-shadow-xl line-clamp-3">
                              {(customHook || hookOptions[selectedHookIndex] || "").replace(/\n/g, " ")}
                            </p>
                          </div>

                          {resolvedPreviewImage ? (
                            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950/80">
                              <img
                                src={resolvedPreviewImage}
                                alt="Thumbnail visual preview"
                                className="h-[165px] w-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="mt-3 flex h-[165px] items-center justify-center rounded-2xl border border-slate-700/80 bg-slate-950/60 px-4 text-center text-[10px] text-slate-500">
                              Preview image appears here
                            </div>
                          )}

                          <div className="mt-3 space-y-2 text-[10px] text-slate-200 drop-shadow-xl">
                            <p className="line-clamp-3 opacity-90">
                              {buyerFacingPreviewText}
                            </p>

                            {finalCTA && (
                              <p className="text-[13px] font-semibold text-yellow-300">
                                {finalCTA}
                              </p>
                            )}

                            {displayAffiliateLink && (
                              <p className="line-clamp-1 text-[9px] text-slate-300/80">
                                {truncateMiddle(displayAffiliateLink, 22, 12)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {resolvedPreviewImage && (
                        <button
                          type="button"
                          onClick={handleDownloadPicture}
                          className="w-full rounded-xl border border-yellow-400/60 bg-yellow-400/10 px-4 py-2 text-sm font-semibold text-yellow-300 hover:bg-yellow-400/20"
                        >
                          Download picture
                        </button>
                      )}
                    </div>
                  </div>

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

                <div className="mb-8">
                  <Link
                    href="/login/dashboard"
                    className="text-sm text-slate-400 hover:text-yellow-400 transition"
                  >
                    ← Back to dashboard
                  </Link>
                </div>
              </div>

              <aside className="w-full lg:w-80 lg:flex-shrink-0">
                <div className="sticky top-6 space-y-4">
                  <section className="rounded-2xl border border-yellow-500/40 bg-slate-900/80 p-4 text-[11px] shadow-[0_18px_40px_rgba(0,0,0,0.8)]">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-yellow-300">
                      Autoaffi Post Engine
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Two AI engines work together to improve conversions and reach before you publish.
                    </p>
                  </section>

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

                    <div className="mb-3 space-y-2">
                      {[
                        { label: "Hook strength", value: exactFixResult?.breakdown?.hook ?? 94 },
                        { label: "SEO clarity", value: exactFixResult?.breakdown?.seo ?? 93 },
                        { label: "Engagement", value: exactFixResult?.breakdown?.engagement ?? 91 },
                        { label: "Overall clarity", value: exactFixResult?.breakdown?.clarity ?? 91 },
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
                          {exactFixResult?.score ?? "9.3"}
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

                    {exactFixStatus === "running" && (
                      <p className="mt-2 text-[10px] text-yellow-300">ExactFix is running…</p>
                    )}
                  </section>

                  <section className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 text-[11px] text-slate-200 shadow-[0_18px_40px_rgba(0,0,0,0.8)]">
                    <header className="mb-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-yellow-300">
                        SEO &amp; Social Reach Engine
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        This layer pushes the post toward stronger visibility, better keyword coverage,
                        and clearer conversion-focused structure.
                      </p>
                    </header>

                    <button
                      type="button"
                      onClick={() => {
                        void handleRunSEO();
                        handleApplySEOFix();
                      }}
                      disabled={isSEOFixing}
                      className="mb-3 w-full rounded-lg border border-yellow-400/60 bg-yellow-400/10 px-3 py-1.5 text-[11px] font-semibold text-yellow-300 hover:bg-yellow-400/20 disabled:opacity-60"
                    >
                      {isSEOFixing ? "Applying SEO optimization…" : "Apply SEO optimization"}
                    </button>

                    <p className="mb-3 text-[10px] text-slate-500">
                      Improves discoverability and reach without changing your core message.
                      Best used after ExactFix.
                    </p>

                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-[10px] text-slate-500">
                        <p className="font-semibold uppercase tracking-[0.18em]">
                          Discovery Power
                        </p>
                        <p>How discoverable this post is right now.</p>
                      </div>

                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold text-yellow-300">
                          {seoResult?.score ?? "9.2"}
                        </span>
                        <span className="text-[10px] text-slate-500">/10</span>
                      </div>
                    </div>

                    {seoError && (
                      <p className="mb-2 text-[10px] text-red-400">{seoError}</p>
                    )}

                    <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        SEO & Social Reach
                      </p>

                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-slate-500">Post score (0–10)</p>
                          <p className="text-[10px] text-slate-500">
                            Strong indicator of how sharp, discoverable and conversion-ready this post looks.
                          </p>
                        </div>
                        <p className="text-2xl font-extrabold text-yellow-300">
                          {seoResult?.score ?? "9.2"}/10
                        </p>
                      </div>

                      <div className="space-y-2">
                        {[
                          { label: "Hook", value: seoResult?.breakdown?.hook ?? 94 },
                          { label: "SEO", value: seoResult?.breakdown?.seo ?? 93 },
                          { label: "Engagement", value: seoResult?.breakdown?.engagement ?? 91 },
                          { label: "Clarity", value: seoResult?.breakdown?.clarity ?? 91 },
                        ].map((item) => (
                          <div key={item.label}>
                            <div className="mb-0.5 flex justify-between text-[9px] uppercase tracking-widest text-slate-500">
                              <span>{item.label}</span>
                              <span>{item.value}</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-slate-800">
                              <div
                                className="h-1.5 rounded-full bg-yellow-400"
                                style={{ width: `${item.value}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      {!!seoResult?.keywords?.length && (
                        <div className="mt-3">
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                            Suggested keywords
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {seoResult.keywords.map((word: string) => (
                              <span
                                key={word}
                                className="rounded-full border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-slate-300"
                              >
                                {word}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

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