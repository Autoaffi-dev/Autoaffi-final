import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type ProductIndexRow = {
  id: string;
  source: string | null;
  external_id: string | null;
  title: string | null;
  description: string | null;
  category: string | null;
  product_url: string | null;
  landing_url: string | null;
  image_url: string | null;
  epc: number | string | null;
  commission: number | string | null;
  currency: string | null;
  price: number | string | null;
  score: number | string | null;
  quality_score: number | string | null;
  geo_scope: string | null;
  winner_tier: string | null;
  is_active: boolean | null;
  last_seen_at: string | null;
  is_approved: boolean | null;
};

type ProductKind = "digital" | "physical" | "unknown";

type SearchIntent =
  | "ai_tools"
  | "phone_accessories"
  | "fitness"
  | "beauty"
  | "home_kitchen"
  | "fashion"
  | "business_software"
  | "education"
  | "pets"
  | "gaming"
  | "productivity"
  | "travel"
  | "finance_crypto"
  | "marketing_tools"
  | "creator_tools"
  | "smart_home"
  | "office_accessories"
  | "health_wellness"
  | "generic";

type SearchResultRow = {
  id: string;
  source: string;
  external_id: string | null;
  name: string;
  description: string;
  category: string;
  platform: string;
  productUrl: string;
  affiliate: string;
  imageUrl: string | null;
  epc: number | null;
  commission: number | null;
  currency: string | null;
  price: number | null;
  score: number | null;
  qualityScore: number | null;
  geoScope: string | null;
  winnerTier: string | null;
  approved: boolean;
  lastSeenAt: string | null;
  relevanceScore?: number;
  productKind?: ProductKind;
};

type RankedCandidate = {
  row: ProductIndexRow;
  relevanceScore: number;
  productKind: ProductKind;
  sourceKey: string;
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE env vars (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)."
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeQuery(query: string): string[] {
  return normalizeText(query)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function buildOrFilter(tokens: string[]) {
  const safeTokens = tokens
    .map((token) => token.replace(/[%_,]/g, " ").trim())
    .filter(Boolean)
    .slice(0, 10);

  const clauses: string[] = [];

  for (const token of safeTokens) {
    clauses.push(`title.ilike.%${token}%`);
    clauses.push(`category.ilike.%${token}%`);
    clauses.push(`description.ilike.%${token}%`);
    clauses.push(`source.ilike.%${token}%`);
  }

  return clauses.join(",");
}

function detectSearchIntent(query: string): SearchIntent {
  const q = normalizeText(query);

  if (
    /\b(crypto|cryptocurrency|bitcoin|btc|ethereum|eth|altcoin|web3|blockchain|trading|forex|investing|investment|portfolio|defi|nft|signals)\b/.test(
      q
    )
  ) {
    return "finance_crypto";
  }

  if (
    /\b(marketing tools|marketing tool|lead generation|lead gen|email marketing|ads manager|ad tool|campaign tool|conversion tool|sales funnel|landing page builder|funnel builder|crm marketing|seo tool|keyword tool|copywriting tool)\b/.test(
      q
    )
  ) {
    return "marketing_tools";
  }

  if (
    /\b(creator tools|creator tool|content creator|youtube tool|tiktok tool|instagram tool|reels tool|thumbnail tool|caption tool|editing tool|video editing|content editing|social media tool|ugc tool)\b/.test(
      q
    )
  ) {
    return "creator_tools";
  }

  if (
    /\b(smart home|smart light|smart lights|smart plug|smart plugs|smart bulb|smart bulbs|wifi camera|security camera|robot vacuum|home assistant device|alexa device|google home device|smart sensor)\b/.test(
      q
    )
  ) {
    return "smart_home";
  }

  if (
    /\b(office accessories|desk accessories|desk setup|office setup|mouse pad|laptop stand|desk organizer|ergonomic mouse|ergonomic keyboard|webcam|monitor light|monitor stand|office organizer)\b/.test(
      q
    )
  ) {
    return "office_accessories";
  }

  if (
    /\b(health wellness|wellness products|recovery tools|massage gun|posture corrector|sleep aid|hydration|supplement|vitamins|health device|self care|wellbeing)\b/.test(
      q
    )
  ) {
    return "health_wellness";
  }

  if (
    /\b(productivity|focus|workflow|planner|task|calendar|notes|organization tool|project tracker|task manager|note taking)\b/.test(
      q
    )
  ) {
    return "productivity";
  }

  if (
    /\b(business software|crm|sales tools|email marketing|invoicing|project management|business app|sales software)\b/.test(
      q
    )
  ) {
    return "business_software";
  }

  if (
    /\b(ai tools|ai tool|artificial intelligence|automation|ai software|writing tool|image generator|video generator|assistant|saas|workflow automation|content tool|content creation|text generator|image ai|video ai)\b/.test(
      q
    )
  ) {
    return "ai_tools";
  }

  if (
    /\b(phone accessories|phone case|iphone case|iphone accessories|magsafe|samsung case|mobile accessories|clear case|shockproof case|screen protector|charger|charging cable|phone holder|iphone charger|usb c cable)\b/.test(
      q
    )
  ) {
    return "phone_accessories";
  }

  if (/\b(fitness|gym|workout|wellness|recovery|exercise)\b/.test(q)) {
    return "fitness";
  }

  if (/\b(beauty|skincare|makeup|hair care|cosmetics|serum|self care)\b/.test(q)) {
    return "beauty";
  }

  if (/\b(home|kitchen|cooking|organizer|cleaning|storage|appliance)\b/.test(q)) {
    return "home_kitchen";
  }

  if (/\b(fashion|clothing|style|wardrobe|jewelry|bag|outfit)\b/.test(q)) {
    return "fashion";
  }

  if (
    /\b(education|course|learning|study|teaching|ebook|school|lesson|academy|tutorial|worksheet)\b/.test(
      q
    )
  ) {
    return "education";
  }

  if (
    /\b(pets|pet|dog|dogs|cat|cats|puppy|puppies|kitten|kittens|pet care|pet toy|pet toys|pet bed|pet bowl|pet feeder|feeder|leash|collar|harness|grooming|litter|litter box|scratching post|chew toy|bird|parrot|rabbit|hamster|fish|aquarium)\b/.test(
      q
    )
  ) {
    return "pets";
  }

  if (/\b(gaming|gamer|headset|controller|keyboard|mouse|streaming|console)\b/.test(q)) {
    return "gaming";
  }

  if (/\b(travel|luggage|packing|carry on|passport|portable|travel gear)\b/.test(q)) {
    return "travel";
  }

  return "generic";
}

function getIntentKeywords(intent: SearchIntent): string[] {
  switch (intent) {
    case "ai_tools":
      return [
        "ai",
        "automation",
        "saas",
        "generator",
        "assistant",
        "tool",
        "app",
        "platform",
        "workflow",
        "copy",
        "video",
        "image",
        "content",
        "digital",
        "online",
        "cloud",
        "api",
      ];

    case "productivity":
      return [
        "productivity",
        "focus",
        "workflow",
        "planner",
        "task",
        "calendar",
        "notes",
        "organizer",
        "project",
        "management",
        "software",
        "app",
      ];

    case "business_software":
      return [
        "business",
        "software",
        "crm",
        "sales",
        "email",
        "project",
        "automation",
        "invoicing",
        "dashboard",
        "marketing",
        "lead",
        "pipeline",
      ];

    case "marketing_tools":
      return [
        "marketing",
        "lead generation",
        "lead gen",
        "conversion",
        "campaign",
        "email marketing",
        "sales funnel",
        "landing page",
        "crm",
        "ads",
        "seo",
        "copywriting",
        "automation",
        "analytics",
      ];

    case "creator_tools":
      return [
        "creator",
        "content",
        "reels",
        "tiktok",
        "instagram",
        "youtube",
        "thumbnail",
        "caption",
        "editing",
        "video",
        "social media",
        "ugc",
        "content creation",
      ];

    case "finance_crypto":
      return [
        "crypto",
        "bitcoin",
        "ethereum",
        "blockchain",
        "trading",
        "forex",
        "investing",
        "investment",
        "portfolio",
        "signals",
        "defi",
        "web3",
        "digital",
      ];

    case "smart_home":
      return [
        "smart home",
        "smart light",
        "smart lights",
        "smart plug",
        "smart bulb",
        "security camera",
        "wifi camera",
        "robot vacuum",
        "sensor",
        "alexa",
        "google home",
        "home automation",
      ];

    case "office_accessories":
      return [
        "office",
        "desk",
        "desk setup",
        "desk organizer",
        "mouse pad",
        "laptop stand",
        "keyboard",
        "ergonomic",
        "webcam",
        "monitor stand",
        "office organizer",
      ];

    case "health_wellness":
      return [
        "health",
        "wellness",
        "recovery",
        "massage gun",
        "hydration",
        "sleep",
        "supplement",
        "vitamin",
        "self care",
        "wellbeing",
        "posture",
      ];

    case "phone_accessories":
      return [
        "phone",
        "iphone",
        "samsung",
        "case",
        "magsafe",
        "mobile",
        "accessory",
        "charger",
        "cable",
        "screen",
        "protector",
      ];

    case "fitness":
      return ["fitness", "gym", "workout", "exercise", "recovery", "wellness"];

    case "beauty":
      return ["beauty", "skincare", "makeup", "hair", "cosmetic", "serum"];

    case "home_kitchen":
      return [
        "home",
        "kitchen",
        "organizer",
        "storage",
        "cleaning",
        "cooking",
        "household",
        "rack",
        "hook",
        "shelf",
      ];

    case "fashion":
      return ["fashion", "style", "clothing", "outfit", "wardrobe", "jewelry"];

    case "education":
      return [
        "education",
        "course",
        "learning",
        "study",
        "teaching",
        "ebook",
        "lesson",
        "academy",
        "school",
        "tutorial",
        "worksheet",
      ];

    case "pets":
      return [
        "pet",
        "pets",
        "dog",
        "dogs",
        "cat",
        "cats",
        "puppy",
        "kitten",
        "grooming",
        "toy",
        "feeder",
        "leash",
        "collar",
        "harness",
        "pet bed",
        "pet bowl",
        "pet care",
        "litter",
        "scratching",
        "chew",
        "bird",
        "rabbit",
        "hamster",
        "fish",
        "aquarium",
      ];

    case "gaming":
      return ["gaming", "gamer", "keyboard", "mouse", "controller", "headset"];

    case "travel":
      return ["travel", "luggage", "packing", "portable", "passport", "suitcase"];

    default:
      return [];
  }
}

function rowHaystack(row: ProductIndexRow) {
  return normalizeText([row.title, row.description, row.category, row.source].join(" "));
}

function normalizedSource(row: ProductIndexRow) {
  return normalizeText(row.source || "");
}

function normalizedCategory(row: ProductIndexRow) {
  return normalizeText(row.category || "");
}

function isUnknownCategory(row: ProductIndexRow) {
  const cat = normalizedCategory(row);
  return !cat || cat === "uncategorized" || cat === "unknown";
}

function hasDigitalSignals(row: ProductIndexRow) {
  const haystack = rowHaystack(row);

  return /(\bai\b|\bsoftware\b|\bsaas\b|automation|generator|assistant|\bcrm\b|workflow|productivity|\bapp\b|platform|tool|tools|online|digital|subscription|cloud|\bapi\b|template|course|learning|ebook|dashboard|planner app|task manager|project management|email marketing|lead management|pipeline|crypto|bitcoin|ethereum|trading|forex|investment|portfolio|blockchain|web3|reels tool|creator tool|marketing tool|seo tool|landing page builder|funnel builder)/.test(
    haystack
  );
}

function hasPhysicalSignals(row: ProductIndexRow) {
  const haystack = rowHaystack(row);

  return /(shampoo|balsam|conditioner|perfume|parfum|spray|cleaning|kitchen|air freshener|pet toy|dog leash|phone case|cover|bottle|serum|makeup|fashion|luggage|bag|hoodie|sticker|mouse pad|keyboard|headset|earbud|earbuds|wireless|bluetooth|speaker|supplement|cream|oil|soap|charger|cable|holder|protector|shoe|clothing|organizer|tempered glass|rack|hook|shelf|pan|knife|garlic|grinder|press|trainer|resistance bands|grip strength|sports bra|sport bh|portable audio|smart bulb|smart plug|camera|robot vacuum|webcam|monitor stand|desk mat|posture corrector|massage gun)/.test(
    haystack
  );
}

function detectProductKind(row: ProductIndexRow): ProductKind {
  const digital = hasDigitalSignals(row);
  const physical = hasPhysicalSignals(row);

  if (digital && !physical) return "digital";
  if (physical && !digital) return "physical";
  return "unknown";
}

function hasPhysicalMismatchForDigitalIntent(row: ProductIndexRow) {
  const haystack = rowHaystack(row);

  return /(shampoo|balsam|conditioner|perfume|parfum|spray|cleaning|kitchen|air freshener|room fragrance|odor|laundry|remover|stain|cleaner|pet|dog|cat|phone case|skincare|makeup|fashion|luggage|bottle|soap|cream|oil|storage box|household|rack|hook|shelf|hotel|room|sofa|nail|manicure|pedicure|resort|suite|stay|earbud|earbuds|wireless|bluetooth|speaker|portable audio|sports bra|sport bh|trainer|resistance|grip strength|garlic|grinder|press|hand tools|key ring|keychain|mini pocket|smart bulb|smart plug|robot vacuum|security camera|desk organizer|monitor stand|webcam|massage gun|posture corrector)/.test(
    haystack
  );
}

function hasPhoneSignals(row: ProductIndexRow) {
  const haystack = rowHaystack(row);

  return /(phone|iphone|samsung|case|magsafe|mobile|cover|screen protector|charger|cable|wireless charger|phone holder|tempered glass)/.test(
    haystack
  );
}

function hasBeautySignals(row: ProductIndexRow) {
  const haystack = rowHaystack(row);

  return /(beauty|skincare|makeup|hair|cosmetic|serum|cream|mask|cleanser|moisturizer|nail|manicure)/.test(
    haystack
  );
}

function hasFitnessSignals(row: ProductIndexRow) {
  const haystack = rowHaystack(row);

  return /(fitness|gym|workout|exercise|wellness|recovery|resistance|yoga|protein|supplement|dumbbell|grip strength|sports bra|sport bh|trainer)/.test(
    haystack
  );
}

function hasHomeKitchenSignals(row: ProductIndexRow) {
  const haystack = rowHaystack(row);

  return /(home|kitchen|organizer|storage|cleaning|cooking|appliance|household|rack|hook|shelf|bathroom|door hanger|closet|kitchen tool|garlic press|pan|dish|drawer|grinder)/.test(
    haystack
  );
}

function hasFashionSignals(row: ProductIndexRow) {
  const haystack = rowHaystack(row);

  return /(fashion|clothing|style|outfit|wardrobe|jewelry|bag|dress|shirt|hoodie|sneaker|perfume|parfum)/.test(
    haystack
  );
}

function hasEducationSignals(row: ProductIndexRow) {
  const haystack = rowHaystack(row);

  return /(\beducation\b|\bcourse\b|learning|\bstudy\b|teaching|\blesson\b|academy|\bebook\b|\bschool\b|worksheet|tutorial|guide|masterclass)/.test(
    haystack
  );
}

function hasPetSignals(row: ProductIndexRow) {
  const haystack = rowHaystack(row);

  return /(\bpet\b|\bpets\b|\bdog\b|\bdogs\b|\bcat\b|\bcats\b|\bpuppy\b|\bpuppies\b|\bkitten\b|\bkittens\b|pet care|pet toy|pet toys|grooming|feeder|pet feeder|leash|collar|harness|litter|litter box|pet bed|pet bowl|scratching post|chew toy|bird|parrot|rabbit|hamster|fish|aquarium)/.test(
    haystack
  );
}

function hasGamingSignals(row: ProductIndexRow) {
  const haystack = rowHaystack(row);

  return /(gaming|gamer|controller|keyboard|mouse|headset|rgb|streaming|console)/.test(
    haystack
  );
}

function hasTravelSignals(row: ProductIndexRow) {
  const haystack = rowHaystack(row);

  return /(travel|luggage|packing|carry on|passport|portable|travel gear|suitcase)/.test(
    haystack
  );
}

function hasProductivitySignals(row: ProductIndexRow) {
  const haystack = rowHaystack(row);

  return /(productivity|focus|workflow|planner|task|calendar|notes|project management|organizer app|task manager|note taking|to do|kanban)/.test(
    haystack
  );
}

function hasBusinessSoftwareSignals(row: ProductIndexRow) {
  const haystack = rowHaystack(row);

  return /(business|software|crm|sales|email marketing|invoicing|project management|business app|sales software|dashboard|automation|marketing platform|pipeline|lead management)/.test(
    haystack
  );
}

function hasFinanceCryptoSignals(row: ProductIndexRow) {
  const haystack = rowHaystack(row);

  return /(crypto|cryptocurrency|bitcoin|btc|ethereum|eth|altcoin|blockchain|web3|trading|forex|investing|investment|portfolio|signals|defi|nft)/.test(
    haystack
  );
}

function hasMarketingToolSignals(row: ProductIndexRow) {
  const haystack = rowHaystack(row);

  return /(marketing|lead generation|lead gen|email marketing|campaign|conversion|landing page|sales funnel|funnel builder|seo|keyword tool|copywriting|ads manager|crm|analytics)/.test(
    haystack
  );
}

function hasCreatorToolSignals(row: ProductIndexRow) {
  const haystack = rowHaystack(row);

  return /(creator|content creation|content creator|social media|instagram|tiktok|youtube|reels|thumbnail|caption|editing|video editing|ugc)/.test(
    haystack
  );
}

function hasSmartHomeSignals(row: ProductIndexRow) {
  const haystack = rowHaystack(row);

  return /(smart home|smart light|smart lights|smart plug|smart plugs|smart bulb|smart bulbs|wifi camera|security camera|robot vacuum|smart sensor|alexa|google home|home automation)/.test(
    haystack
  );
}

function hasOfficeAccessorySignals(row: ProductIndexRow) {
  const haystack = rowHaystack(row);

  return /(office accessories|desk accessories|desk setup|desk organizer|desk mat|mouse pad|laptop stand|ergonomic mouse|ergonomic keyboard|webcam|monitor stand|office organizer|monitor light)/.test(
    haystack
  );
}

function hasHealthWellnessSignals(row: ProductIndexRow) {
  const haystack = rowHaystack(row);

  return /(health|wellness|recovery|massage gun|posture corrector|sleep aid|hydration|supplement|vitamin|wellbeing|self care)/.test(
    haystack
  );
}

function getTokenMatchStrength(row: ProductIndexRow, tokens: string[]) {
  const title = normalizeText(row.title);
  const description = normalizeText(row.description);
  const category = normalizeText(row.category);

  let score = 0;
  let titleHits = 0;
  let descriptionHits = 0;
  let categoryHits = 0;

  for (const token of tokens) {
    if (!token) continue;

    if (title.includes(token)) {
      score += 4;
      titleHits += 1;
    }
    if (description.includes(token)) {
      score += 2;
      descriptionHits += 1;
    }
    if (category.includes(token)) {
      score += 3;
      categoryHits += 1;
    }
  }

  return {
    score,
    titleHits,
    descriptionHits,
    categoryHits,
  };
}

function hasStrongTextMatch(row: ProductIndexRow, tokens: string[], intent: SearchIntent) {
  if (!tokens.length) return false;

  const strength = getTokenMatchStrength(row, tokens);

  if (strength.titleHits >= 2) return true;
  if (strength.titleHits >= 1 && strength.descriptionHits >= 1) return true;
  if (strength.score >= 6) return true;

  if (
    intent === "marketing_tools" ||
    intent === "creator_tools" ||
    intent === "smart_home" ||
    intent === "office_accessories" ||
    intent === "health_wellness" ||
    intent === "travel" ||
    intent === "fashion" ||
    intent === "beauty" ||
    intent === "fitness" ||
    intent === "home_kitchen"
  ) {
    return strength.score >= 4;
  }

  return false;
}

function isHardBlockedForIntent(
  row: ProductIndexRow,
  intent: SearchIntent,
  kind: ProductKind
) {
  const haystack = rowHaystack(row);
  const source = normalizedSource(row);

  switch (intent) {
    case "ai_tools":
    case "business_software":
    case "productivity":
    case "marketing_tools":
    case "creator_tools":
    case "finance_crypto":
      if (source.includes("aliexpress")) return true;
      if (source.includes("amazon")) return true;
      if (kind === "physical") return true;
      if (hasPhysicalMismatchForDigitalIntent(row)) return true;
      return false;

    case "education":
      if (source.includes("aliexpress")) return true;
      if (kind === "physical" && !hasEducationSignals(row)) return true;
      if (
        /(fitness|gym|workout|sports bra|sport bh|trainer|grip strength|resistance|pet|dog|cat|phone|case|kitchen|home|laundry|cleaner|air freshener)/.test(
          haystack
        )
      ) {
        return true;
      }
      return false;

    case "pets":
      if (
        /(hotel|room|suite|resort|stay|booking|laundry|cleaner|fitness|gym|beauty|education|course|phone case|usb|micro usb|otg|adapter|splitter|cable|charger|electronics|computer peripherals|headphones|earbuds|wireless|bluetooth|speaker|portable audio|travel organizer|kitchen|home storage|business|software|crm)/.test(
          haystack
        )
      ) {
        return true;
      }
      return false;

    case "home_kitchen":
      if (
        /(hotel|room|suite|resort|stay|pet|dog|cat|sports bra|sport bh|trainer|grip strength|resistance|nail|manicure|pedicure)/.test(
          haystack
        )
      ) {
        return true;
      }
      return false;

    case "smart_home":
      if (
        /(course|education|pet|dog|cat|beauty|skincare|makeup|fashion|perfume|supplement|software only|crm|ebook|worksheet)/.test(
          haystack
        )
      ) {
        return true;
      }
      return false;

    case "office_accessories":
      if (
        /(beauty|makeup|skincare|pet|dog|cat|kitchen|hotel|resort|course|ebook|software platform|crm|crypto)/.test(
          haystack
        )
      ) {
        return true;
      }
      return false;

    case "health_wellness":
      if (
        /(software|crm|landing page|ebook|worksheet|phone case|smart bulb|security camera|pet feeder|cat litter)/.test(
          haystack
        )
      ) {
        return true;
      }
      return false;

    default:
      return false;
  }
}

function getSourceWeight(source: string, intent: SearchIntent, kind: ProductKind) {
  const s = normalizeText(source);

  switch (intent) {
    case "phone_accessories":
      if (s.includes("aliexpress")) return 36;
      if (s.includes("amazon")) return 28;
      if (s.includes("awin")) return 18;
      if (s.includes("cj")) return 16;
      if (s.includes("impact")) return 8;
      return 0;

    case "home_kitchen":
    case "fashion":
    case "travel":
    case "smart_home":
    case "office_accessories":
    case "health_wellness":
      if (s.includes("aliexpress")) return 24;
      if (s.includes("amazon")) return 22;
      if (s.includes("awin")) return 20;
      if (s.includes("cj")) return 18;
      if (s.includes("impact")) return 12;
      return 0;

    case "beauty":
    case "fitness":
    case "pets":
    case "gaming":
      if (s.includes("aliexpress")) return 22;
      if (s.includes("awin")) return 20;
      if (s.includes("cj")) return 18;
      if (s.includes("impact")) return 12;
      return 0;

    case "ai_tools":
    case "business_software":
    case "productivity":
    case "marketing_tools":
    case "creator_tools":
    case "finance_crypto":
      if (kind === "physical") return -200;
      if (s.includes("impact")) return 34;
      if (s.includes("cj")) return 28;
      if (s.includes("warriorplus")) return 24;
      if (s.includes("awin")) return 16;
      if (s.includes("aliexpress")) return -220;
      if (s.includes("amazon")) return -220;
      return 0;

    case "education":
      if (s.includes("impact")) return 24;
      if (s.includes("cj")) return 20;
      if (s.includes("awin")) return 16;
      if (s.includes("warriorplus")) return 18;
      if (s.includes("aliexpress")) return -180;
      return 0;

    default:
      if (s.includes("impact")) return 12;
      if (s.includes("cj")) return 12;
      if (s.includes("awin")) return 12;
      if (s.includes("amazon")) return 12;
      if (s.includes("aliexpress")) return 12;
      if (s.includes("warriorplus")) return 12;
      return 0;
  }
}

function getIntentPenalty(row: ProductIndexRow, intent: SearchIntent, kind: ProductKind) {
  const haystack = rowHaystack(row);

  if (isHardBlockedForIntent(row, intent, kind)) {
    return -1000;
  }

  switch (intent) {
    case "ai_tools":
      if (hasPhysicalMismatchForDigitalIntent(row)) return -260;
      if (kind === "physical") return -220;
      if (!hasDigitalSignals(row)) return -180;
      return 0;

    case "business_software":
      if (hasPhysicalMismatchForDigitalIntent(row)) return -260;
      if (kind === "physical") return -220;
      if (!hasBusinessSoftwareSignals(row) && !hasDigitalSignals(row)) return -220;
      return 0;

    case "productivity":
      if (hasPhysicalMismatchForDigitalIntent(row)) return -260;
      if (kind === "physical") return -220;
      if (!hasProductivitySignals(row) && !hasDigitalSignals(row)) return -220;
      return 0;

    case "finance_crypto":
      if (hasPhysicalMismatchForDigitalIntent(row)) return -260;
      if (kind === "physical") return -220;
      if (!hasFinanceCryptoSignals(row) && !hasDigitalSignals(row)) return -220;
      return 0;

    case "marketing_tools":
      if (hasPhysicalMismatchForDigitalIntent(row)) return -260;
      if (kind === "physical") return -220;
      if (!hasMarketingToolSignals(row) && !hasDigitalSignals(row)) return -180;
      return 0;

    case "creator_tools":
      if (hasPhysicalMismatchForDigitalIntent(row)) return -260;
      if (kind === "physical") return -220;
      if (!hasCreatorToolSignals(row) && !hasDigitalSignals(row)) return -180;
      return 0;

    case "phone_accessories":
      if (!hasPhoneSignals(row)) return -140;
      if (kind === "digital") return -120;
      return 0;

    case "beauty":
      if (!hasBeautySignals(row)) return -90;
      if (/(fitness|pet|phone|gaming|hotel|travel|laundry|cleaning spray)/.test(haystack)) return -80;
      return 0;

    case "fitness":
      if (!hasFitnessSignals(row)) return -90;
      if (/(beauty|phone|kitchen|hotel|pet|laundry|air freshener)/.test(haystack)) return -80;
      return 0;

    case "home_kitchen":
      if (!hasHomeKitchenSignals(row)) return -120;
      if (/(fitness|pet|dog|cat|phone|gaming|hotel|booking|stay|suite|resort|nail|manicure|pedicure|sports bra|sport bh|trainer)/.test(haystack))
        return -220;
      return 0;

    case "fashion":
      if (!hasFashionSignals(row)) return -90;
      if (/(air freshener|laundry|stain remover|cleaner)/.test(haystack)) return -100;
      return 0;

    case "education":
      if (!hasEducationSignals(row)) return -220;
      if (/(fitness|gym|phone case|beauty|pet|dog|cat|kitchen|hotel|travel gear|laundry|cleaner|sports bra|sport bh|trainer)/.test(haystack))
        return -220;
      return 0;

    case "pets":
      if (!hasPetSignals(row)) return -260;
      if (/(beauty|fitness|phone|kitchen|hotel|travel|education|booking|stay|suite|resort|laundry)/.test(haystack))
        return -220;
      return 0;

    case "gaming":
      if (!hasGamingSignals(row)) return -90;
      return 0;

    case "travel":
      if (!hasTravelSignals(row)) return -90;
      return 0;

    case "smart_home":
      if (!hasSmartHomeSignals(row)) return -120;
      if (/(beauty|fashion|pet|education|course|ebook|crm|software platform)/.test(haystack))
        return -140;
      return 0;

    case "office_accessories":
      if (!hasOfficeAccessorySignals(row)) return -120;
      if (/(beauty|pet|kitchen|course|ebook|crypto|crm)/.test(haystack))
        return -140;
      return 0;

    case "health_wellness":
      if (!hasHealthWellnessSignals(row) && !hasFitnessSignals(row) && !hasBeautySignals(row))
        return -100;
      if (/(crm|software|landing page|worksheet|ebook|smart bulb|security camera)/.test(haystack))
        return -140;
      return 0;

    default:
      return 0;
  }
}

function getMatchScore(row: ProductIndexRow, tokens: string[], intent: SearchIntent) {
  const title = normalizeText(row.title);
  const category = normalizeText(row.category);
  const description = normalizeText(row.description);
  const haystack = rowHaystack(row);

  const productKind = detectProductKind(row);
  let score = 0;

  for (const token of tokens) {
    if (!token) continue;

    if (title.includes(token)) score += 32;
    if (category.includes(token)) score += 24;
    if (description.includes(token)) score += 10;
    if (haystack.includes(token)) score += 6;
  }

  const intentKeywords = getIntentKeywords(intent);

  for (const keyword of intentKeywords) {
    if (title.includes(keyword)) score += 16;
    if (category.includes(keyword)) score += 12;
    if (description.includes(keyword)) score += 5;
  }

  if (hasStrongTextMatch(row, tokens, intent)) {
    score += 18;
  }

  score += getSourceWeight(String(row.source || ""), intent, productKind);
  score += getIntentPenalty(row, intent, productKind);

  score += toNumber(row.score) || 0;
  score += toNumber(row.quality_score) || 0;

  if (row.winner_tier === "A") score += 12;
  if (row.winner_tier === "B") score += 6;
  if (row.image_url) score += 4;
  if (row.product_url || row.landing_url) score += 4;
  if (row.is_approved) score += 4;

  return score;
}

function normalizeRow(row: ProductIndexRow): SearchResultRow {
  const productUrl = String(row.product_url || row.landing_url || "").trim();

  return {
    id: row.id,
    source: String(row.source || "").trim(),
    external_id: row.external_id,
    name: String(row.title || "").trim(),
    description: String(row.description || "").trim(),
    category: String(row.category || "").trim(),
    platform: String(row.source || "").trim(),
    productUrl,
    affiliate: productUrl,
    imageUrl: row.image_url || null,
    epc: toNumber(row.epc),
    commission: toNumber(row.commission),
    currency: row.currency || null,
    price: toNumber(row.price),
    score: toNumber(row.score),
    qualityScore: toNumber(row.quality_score),
    geoScope: row.geo_scope || null,
    winnerTier: row.winner_tier || null,
    approved: Boolean(row.is_approved),
    lastSeenAt: row.last_seen_at || null,
  };
}

function isStrictAllowedForIntent(
  row: ProductIndexRow,
  intent: SearchIntent,
  score: number,
  kind: ProductKind,
  tokens: string[]
) {
  if (isHardBlockedForIntent(row, intent, kind)) return false;

  switch (intent) {
    case "ai_tools":
      if (hasPhysicalMismatchForDigitalIntent(row)) return false;
      if (kind !== "digital") return false;
      if (!hasDigitalSignals(row)) return false;
      return score >= 18;

    case "business_software":
      if (hasPhysicalMismatchForDigitalIntent(row)) return false;
      if (kind !== "digital") return false;
      if (!hasBusinessSoftwareSignals(row) && !hasDigitalSignals(row)) return false;
      return score >= 18;

    case "productivity":
      if (hasPhysicalMismatchForDigitalIntent(row)) return false;
      if (kind !== "digital") return false;
      if (!hasProductivitySignals(row) && !hasDigitalSignals(row)) return false;
      return score >= 14;

    case "finance_crypto":
      if (hasPhysicalMismatchForDigitalIntent(row)) return false;
      if (kind !== "digital") return false;
      if (!hasFinanceCryptoSignals(row) && !hasDigitalSignals(row)) return false;
      return score >= 14;

    case "marketing_tools":
      if (hasPhysicalMismatchForDigitalIntent(row)) return false;
      if (kind !== "digital") return false;
      if (
        !hasMarketingToolSignals(row) &&
        !hasDigitalSignals(row) &&
        !hasStrongTextMatch(row, tokens, intent)
      ) {
        return false;
      }
      return score >= 12;

    case "creator_tools":
      if (hasPhysicalMismatchForDigitalIntent(row)) return false;
      if (kind !== "digital") return false;
      if (
        !hasCreatorToolSignals(row) &&
        !hasDigitalSignals(row) &&
        !hasStrongTextMatch(row, tokens, intent)
      ) {
        return false;
      }
      return score >= 12;

    case "phone_accessories":
      if (!hasPhoneSignals(row)) return false;
      if (kind === "digital") return false;
      return score >= 8;

    case "beauty":
      if (!hasBeautySignals(row) && !hasStrongTextMatch(row, tokens, intent)) return false;
      return score >= 4;

    case "fitness":
      if (!hasFitnessSignals(row) && !hasStrongTextMatch(row, tokens, intent)) return false;
      return score >= 4;

    case "home_kitchen":
      if (!hasHomeKitchenSignals(row) && !hasStrongTextMatch(row, tokens, intent)) return false;
      return score >= 6;

    case "fashion":
      if (!hasFashionSignals(row) && !hasStrongTextMatch(row, tokens, intent)) return false;
      return score >= 4;

    case "education":
      if (!hasEducationSignals(row)) return false;
      if (isUnknownCategory(row) && !hasStrongTextMatch(row, tokens, intent)) return false;
      return score >= 8;

    case "pets":
      if (!hasPetSignals(row)) return false;
      return score >= 6;

    case "gaming":
      if (!hasGamingSignals(row) && !hasStrongTextMatch(row, tokens, intent)) return false;
      return score >= 4;

    case "travel":
      if (!hasTravelSignals(row) && !hasStrongTextMatch(row, tokens, intent)) return false;
      return score >= 4;

    case "smart_home":
      if (!hasSmartHomeSignals(row) && !hasStrongTextMatch(row, tokens, intent)) return false;
      return score >= 4;

    case "office_accessories":
      if (!hasOfficeAccessorySignals(row) && !hasStrongTextMatch(row, tokens, intent)) return false;
      return score >= 4;

    case "health_wellness":
      if (
        !hasHealthWellnessSignals(row) &&
        !hasFitnessSignals(row) &&
        !hasBeautySignals(row) &&
        !hasStrongTextMatch(row, tokens, intent)
      ) {
        return false;
      }
      return score >= 4;

    default:
      return score > -40;
  }
}

function isRelaxedAllowedForIntent(
  row: ProductIndexRow,
  intent: SearchIntent,
  score: number,
  kind: ProductKind,
  tokens: string[]
) {
  if (isHardBlockedForIntent(row, intent, kind)) return false;

  switch (intent) {
    case "ai_tools":
    case "business_software":
      if (hasPhysicalMismatchForDigitalIntent(row)) return false;
      if (kind === "physical") return false;
      return score >= 2;

    case "productivity":
      if (hasPhysicalMismatchForDigitalIntent(row)) return false;
      if (kind === "physical") return false;
      return hasProductivitySignals(row) || hasDigitalSignals(row) || hasStrongTextMatch(row, tokens, intent);

    case "finance_crypto":
      if (hasPhysicalMismatchForDigitalIntent(row)) return false;
      if (kind === "physical") return false;
      return hasFinanceCryptoSignals(row) || hasDigitalSignals(row) || hasStrongTextMatch(row, tokens, intent);

    case "marketing_tools":
      if (hasPhysicalMismatchForDigitalIntent(row)) return false;
      if (kind === "physical") return false;
      return hasMarketingToolSignals(row) || hasDigitalSignals(row) || hasStrongTextMatch(row, tokens, intent);

    case "creator_tools":
      if (hasPhysicalMismatchForDigitalIntent(row)) return false;
      if (kind === "physical") return false;
      return hasCreatorToolSignals(row) || hasDigitalSignals(row) || hasStrongTextMatch(row, tokens, intent);

    case "phone_accessories":
      if (!hasPhoneSignals(row) && !hasStrongTextMatch(row, tokens, intent)) return false;
      if (kind === "digital") return false;
      return score >= -10;

    case "beauty":
      if (!hasBeautySignals(row) && !hasStrongTextMatch(row, tokens, intent)) return false;
      return score >= -10;

    case "fitness":
      if (!hasFitnessSignals(row) && !hasStrongTextMatch(row, tokens, intent)) return false;
      return score >= -10;

    case "home_kitchen":
      if (!hasHomeKitchenSignals(row) && !hasStrongTextMatch(row, tokens, intent)) return false;
      return score >= -10;

    case "fashion":
      if (!hasFashionSignals(row) && !hasStrongTextMatch(row, tokens, intent)) return false;
      return score >= -10;

    case "education":
      if (!hasEducationSignals(row) && !hasStrongTextMatch(row, tokens, intent)) return false;
      return score >= -10;

    case "pets":
      if (!hasPetSignals(row)) return false;
      return score >= -10;

    case "gaming":
      if (!hasGamingSignals(row) && !hasStrongTextMatch(row, tokens, intent)) return false;
      return score >= -10;

    case "travel":
      if (!hasTravelSignals(row) && !hasStrongTextMatch(row, tokens, intent)) return false;
      return score >= -10;

    case "smart_home":
      if (!hasSmartHomeSignals(row) && !hasStrongTextMatch(row, tokens, intent)) return false;
      return score >= -10;

    case "office_accessories":
      if (!hasOfficeAccessorySignals(row) && !hasStrongTextMatch(row, tokens, intent)) return false;
      return score >= -10;

    case "health_wellness":
      if (
        !hasHealthWellnessSignals(row) &&
        !hasFitnessSignals(row) &&
        !hasBeautySignals(row) &&
        !hasStrongTextMatch(row, tokens, intent)
      ) {
        return false;
      }
      return score >= -10;

    default:
      return score > -60;
  }
}

function groupBySource(candidates: RankedCandidate[]) {
  const grouped = new Map<string, RankedCandidate[]>();

  for (const item of candidates) {
    const key = item.sourceKey || "unknown";

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }

    grouped.get(key)!.push(item);
  }

  return grouped;
}

function getPerSourceLimit(intent: SearchIntent) {
  switch (intent) {
    case "ai_tools":
    case "business_software":
    case "productivity":
    case "marketing_tools":
    case "creator_tools":
    case "finance_crypto":
      return 3;
    default:
      return 2;
  }
}

function diversifyResults(candidates: RankedCandidate[], intent: SearchIntent, limit: number) {
  const grouped = groupBySource(candidates);
  const perSourceLimit = getPerSourceLimit(intent);
  const final: RankedCandidate[] = [];

  for (const items of grouped.values()) {
    items.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  const sourceOrder = Array.from(grouped.entries())
    .map(([key, items]) => ({
      key,
      bestScore: items[0]?.relevanceScore ?? -9999,
    }))
    .sort((a, b) => b.bestScore - a.bestScore)
    .map((item) => item.key);

  let round = 0;

  while (final.length < limit) {
    let addedThisRound = 0;

    for (const sourceKey of sourceOrder) {
      const items = grouped.get(sourceKey) || [];
      const alreadyFromSource = final.filter((item) => item.sourceKey === sourceKey).length;

      if (alreadyFromSource >= perSourceLimit) continue;
      if (items.length <= round) continue;

      final.push(items[round]);
      addedThisRound += 1;

      if (final.length >= limit) break;
    }

    if (addedThisRound === 0) break;
    round += 1;
  }

  return final.slice(0, limit);
}

function mergeUniqueCandidates(primary: RankedCandidate[], fallback: RankedCandidate[]) {
  const seen = new Set<string>();
  const merged: RankedCandidate[] = [];

  for (const item of [...primary, ...fallback]) {
    const key = item.row.id || `${item.row.source}:${item.row.external_id || item.row.title}`;

    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged;
}

function shouldUseStrictOnly(intent: SearchIntent) {
  return (
    intent === "ai_tools" ||
    intent === "business_software" ||
    intent === "productivity" ||
    intent === "education" ||
    intent === "pets" ||
    intent === "finance_crypto"
  );
}

async function fetchRows(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  tokens: string[];
  sources: string[] | null;
  geos: string[] | null;
  approvedOnly: boolean;
  broad: boolean;
  take: number;
}) {
  let qb = params.supabase
    .from("product_index")
    .select(
      [
        "id",
        "source",
        "external_id",
        "title",
        "description",
        "category",
        "product_url",
        "landing_url",
        "image_url",
        "epc",
        "commission",
        "currency",
        "price",
        "score",
        "quality_score",
        "geo_scope",
        "winner_tier",
        "is_active",
        "last_seen_at",
        "is_approved",
      ].join(",")
    )
    .eq("is_active", true);

  if (params.approvedOnly) {
    qb = qb.eq("is_approved", true);
  }

  if (params.sources && params.sources.length > 0) {
    qb = qb.in("source", params.sources);
  }

  if (params.geos && params.geos.length > 0) {
    qb = qb.in("geo_scope", params.geos);
  }

  if (!params.broad && params.tokens.length > 0) {
    qb = qb.or(buildOrFilter(params.tokens));
  }

  const { data, error } = await qb
    .order("score", { ascending: false, nullsFirst: false })
    .order("quality_score", { ascending: false, nullsFirst: false })
    .order("last_seen_at", { ascending: false })
    .limit(params.take);

  if (error) throw error;

  return Array.isArray(data) ? (data as unknown as ProductIndexRow[]) : [];
}

/**
 * GET /api/products/search?q=keyword&sources=warriorplus&limit=20
 * Optional: &geo=worldwide
 * Optional: &approved=false (default true)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const q = (searchParams.get("q") ?? "").trim();
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "20"), 1), 50);

    const sourcesParam = (searchParams.get("sources") ?? "").trim();
    const geoParam = (searchParams.get("geo") ?? "").trim();

    const approvedParam = (searchParams.get("approved") ?? "").trim().toLowerCase();
    const approvedOnly = approvedParam === "false" ? false : true;

    const sources = sourcesParam
      ? sourcesParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : null;

    const geos = geoParam
      ? geoParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : null;

    const tokens = tokenizeQuery(q);
    const intent = detectSearchIntent(q);
    const supabase = getSupabaseAdmin();

    const filteredRows = await fetchRows({
      supabase,
      tokens,
      sources,
      geos,
      approvedOnly,
      broad: false,
      take: Math.max(limit * 12, 140),
    });

    let allRows = filteredRows;

    if (filteredRows.length < Math.max(12, limit * 3)) {
      const broadRows = await fetchRows({
        supabase,
        tokens,
        sources,
        geos,
        approvedOnly,
        broad: true,
        take: Math.max(limit * 18, 220),
      });

      const seen = new Set<string>();
      const merged: ProductIndexRow[] = [];

      for (const row of [...filteredRows, ...broadRows]) {
        const key = row.id || `${row.source}:${row.external_id || row.title}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(row);
      }

      allRows = merged;
    }

    const rankedAll: RankedCandidate[] = allRows
      .map((row) => {
        const productKind = detectProductKind(row);
        const relevanceScore = getMatchScore(row, tokens, intent);

        return {
          row,
          relevanceScore,
          productKind,
          sourceKey: normalizeText(row.source || "unknown"),
        };
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    const strictCandidates = rankedAll.filter((item) =>
      isStrictAllowedForIntent(
        item.row,
        intent,
        item.relevanceScore,
        item.productKind,
        tokens
      )
    );

    const relaxedCandidates = rankedAll.filter((item) =>
      isRelaxedAllowedForIntent(
        item.row,
        intent,
        item.relevanceScore,
        item.productKind,
        tokens
      )
    );

    let selectedPool = strictCandidates;

    if (!shouldUseStrictOnly(intent) && strictCandidates.length < Math.min(limit, 6)) {
      selectedPool = mergeUniqueCandidates(strictCandidates, relaxedCandidates);
    }

    const diversified = diversifyResults(selectedPool, intent, limit);

    let finalCandidates = diversified;

    if (finalCandidates.length < Math.min(limit, 4)) {
      finalCandidates = selectedPool.slice(0, limit);
    }

    const results: SearchResultRow[] = finalCandidates.map((item) => {
      const normalized = normalizeRow(item.row);

      return {
        ...normalized,
        relevanceScore: item.relevanceScore,
        productKind: item.productKind,
      };
    });

    return NextResponse.json({
      success: true,
      query: q,
      intent,
      approvedOnly,
      count: results.length,
      results,
    });
  } catch (err: any) {
    console.error("[products/search] error:", err);

    return NextResponse.json(
      {
        success: false,
        error: err?.message ?? "Product search failed",
      },
      { status: 500 }
    );
  }
}