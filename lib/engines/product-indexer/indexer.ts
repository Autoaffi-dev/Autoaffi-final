// lib/engines/product-indexer/indexer.ts

// Vilka plattformar vi indexerar i v1.0
export type ProductSource = "digistore" | "mylead" | "cpalead" | "amazon" | "impact";

// Rå produkt i indexet
export interface RawProductRecord {
  id: string;
  title: string;
  description?: string;
  epc?: number;
  category?: string;
  url: string;
  source: ProductSource;
}

// Input till sökningen
export interface SearchProductIndexInput {
  query: string;
  sources?: ProductSource[];
  limit?: number;
}

// Enkel mockad produktkatalog v1.0 – vi kan fylla på senare ✨
const PRODUCT_INDEX: RawProductRecord[] = [
  // DIGISTORE
  {
    id: "digistore-465948",
    title: "Beginner Affiliate System – 3-step roadmap",
    description: "Digital course for new affiliates, teaches simple traffic & offers.",
    epc: 2.9,
    category: "Make Money Online",
    url: "https://www.digistore24.com/en/product/465948",
    source: "digistore",
  },
  {
    id: "digistore-keto-plan",
    title: "Keto Meal Plan – 28 days",
    description: "High-converting keto plan for weight loss audiences.",
    epc: 3.2,
    category: "Health & Fitness",
    url: "https://www.digistore24.com/en/home",
    source: "digistore",
  },

  // MYLEAD
  {
    id: "mylead-crypto-starter",
    title: "Crypto Starter Pack (MyLead)",
    description: "Easy-entry lead magnet for people curious about crypto.",
    epc: 2.4,
    category: "Finance / Crypto",
    url: "https://mylead.global/en",
    source: "mylead",
  },
  {
    id: "mylead-sweepstake",
    title: "Phone Giveaway – sweepstake",
    description: "Classic sweepstake offer for broad audiences.",
    epc: 1.6,
    category: "General / Sweepstakes",
    url: "https://mylead.global/en",
    source: "mylead",
  },

  // CPALEAD
  {
    id: "cpalead-weight-quiz",
    title: "Lose Weight Quiz (CPAlead)",
    description: "Quiz-flow that pre-frames weight loss offers.",
    epc: 1.7,
    category: "Health & Fitness",
    url: "https://cpalead.com",
    source: "cpalead",
  },
  {
    id: "cpalead-mobile-app",
    title: "Mobile Rewards App",
    description: "Incentive-friendly mobile app with global reach.",
    epc: 1.3,
    category: "Mobile / Rewards",
    url: "https://cpalead.com",
    source: "cpalead",
  },

  // AMAZON
  {
    id: "amazon-ringlight",
    title: "Ring Light + Phone Tripod",
    description: "Perfect bundle for Reels, TikTok & Shorts creators.",
    epc: 0.8,
    category: "Creator Gear",
    url: "https://www.amazon.com",
    source: "amazon",
  },
  {
    id: "amazon-mic",
    title: "USB Podcast Mic",
    description: "Entry-level microphone for better audio on content.",
    epc: 0.9,
    category: "Audio / Gear",
    url: "https://www.amazon.com",
    source: "amazon",
  },

  // IMPACT
  {
    id: "impact-fitness-app",
    title: "Fitness Meal App – premium",
    description: "Subscription app for meal plans & workouts.",
    epc: 1.8,
    category: "Health / Apps",
    url: "https://app.impact.com",
    source: "impact",
  },
  {
    id: "impact-tracking-tool",
    title: "Creator Tracking Tool",
    description: "Analytics SaaS for content & campaigns.",
    epc: 2.0,
    category: "Marketing / SaaS",
    url: "https://app.impact.com",
    source: "impact",
  },
];

// Själva sökmotorn – v1.0, enkel men stabil
export async function searchProductIndex(
  input: SearchProductIndexInput
): Promise<RawProductRecord[]> {
  const { query, limit = 20 } = input;
  const q = query.trim().toLowerCase();

  const activeSources: ProductSource[] =
    input.sources && input.sources.length > 0
      ? input.sources
      : ["digistore", "mylead", "cpalead", "amazon", "impact"];

  const filtered = PRODUCT_INDEX.filter((p) => {
    if (!activeSources.includes(p.source)) return false;
    if (!q) return true;

    const haystack = (
      p.title +
      " " +
      (p.description ?? "") +
      " " +
      (p.category ?? "")
    ).toLowerCase();

    return haystack.includes(q);
  });

  return filtered.slice(0, limit);
}