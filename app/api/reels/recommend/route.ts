import { NextResponse } from "next/server";

type Genre =
  | "Cinematic"
  | "Lifestyle"
  | "Hustle"
  | "Anime"
  | "Tech"
  | "Luxury"
  | "Dark"
  | "Minimal"
  | "TikTok";

type Tone = "Friendly" | "Bold" | "Motivational" | "Calm" | "Direct";

type StoryFormat =
  | "Hook → Value → CTA"
  | "Tutorial"
  | "Emotion"
  | "Listicle"
  | "Storytelling";

interface RecommendRequestBody {
  targetAudience?: string;
  genre?: Genre | string;
  tone?: Tone | string;
  storyFormat?: StoryFormat | string;
}

interface ProductInfo {
  id: string;
  name: string;
  stars: number;
  commission: number;
  epc: number;
  description: string;
  category: "ai" | "business" | "fitness" | "crypto" | "education";
}

/**
 * Liten, fristående katalog – matchar din frontend TOP_PRODUCTS-struktur.
 * Detta styr bara rekommendationslogiken, inte själva reel-genereringen.
 */
const PRODUCT_CATALOG: ProductInfo[] = [
  // AI & tools / creator
  {
    id: "p-autoaffi",
    name: "Autoaffi Pro",
    stars: 5,
    commission: 50,
    epc: 2.8,
    description: "AI affiliate automation for recurring income.",
    category: "ai",
  },
  {
    id: "p-videoai",
    name: "Video AI Creator",
    stars: 4.6,
    commission: 45,
    epc: 2.1,
    description: "AI-powered vertical video tool.",
    category: "ai",
  },
  {
    id: "p-notion",
    name: "Notion Templates Bundle",
    stars: 4.4,
    commission: 40,
    epc: 1.8,
    description: "Top-selling productivity templates.",
    category: "ai",
  },

  // Online business / make money online
  {
    id: "p-freedombundle",
    name: "Freedom Business Starter Kit",
    stars: 4.7,
    commission: 50,
    epc: 3.1,
    description: "Beginner-friendly affiliate income blueprint.",
    category: "business",
  },
  {
    id: "p-emailmastery",
    name: "Email Mastery",
    stars: 4.8,
    commission: 45,
    epc: 2.4,
    description: "High-converting email sequences.",
    category: "business",
  },
  {
    id: "p-brandkit",
    name: "Brand Identity Pro",
    stars: 4.5,
    commission: 35,
    epc: 1.5,
    description: "Logo pack + content presets.",
    category: "business",
  },

  // Fitness & health
  {
    id: "p-fitmeal",
    name: "Fitness Meal Guides",
    stars: 4.9,
    commission: 30,
    epc: 1.4,
    description: "Diet & workout books.",
    category: "fitness",
  },
  {
    id: "p-homeworkout",
    name: "Home Workout Bundle",
    stars: 4.4,
    commission: 45,
    epc: 2.0,
    description: "Bodyweight home fitness plan.",
    category: "fitness",
  },
  {
    id: "p-shredai",
    name: "Shred AI Coach",
    stars: 4.8,
    commission: 40,
    epc: 2.7,
    description: "AI-powered training planner.",
    category: "fitness",
  },

  // Crypto & finance
  {
    id: "p-cryptostarter",
    name: "Crypto Starter Pack",
    stars: 4.3,
    commission: 35,
    epc: 1.3,
    description: "Learn everything about crypto basics.",
    category: "crypto",
  },
  {
    id: "p-tradingai",
    name: "Trading Signals AI",
    stars: 4.5,
    commission: 40,
    epc: 2.2,
    description: "AI-based crypto alerts.",
    category: "crypto",
  },
  {
    id: "p-ledger",
    name: "Ledger Nano X",
    stars: 4.8,
    commission: 10,
    epc: 0.7,
    description: "Crypto hardware wallet.",
    category: "crypto",
  },

  // Education / learning
  {
    id: "p-language",
    name: "Language Master Pro",
    stars: 4.7,
    commission: 40,
    epc: 1.9,
    description: "Learn any language quickly.",
    category: "education",
  },
  {
    id: "p-coursestarter",
    name: "Course Creator Bundle",
    stars: 4.6,
    commission: 50,
    epc: 2.9,
    description: "Everything to build an online course.",
    category: "education",
  },
  {
    id: "p-speedread",
    name: "Speed Reading Masterclass",
    stars: 4.9,
    commission: 30,
    epc: 1.2,
    description: "Read 3× faster with proven methods.",
    category: "education",
  },
];

/**
 * Enkel keyword–baserad kategorimappning.
 * Vi tittar på targetAudience, genre och storyFormat och försöker gissa kategori.
 */
function inferCategoryFromContext(body: RecommendRequestBody): ProductInfo["category"] {
  const audience = (body.targetAudience ?? "").toLowerCase();
  const genre = (body.genre ?? "").toLowerCase();
  const story = (body.storyFormat ?? "").toLowerCase();

  // Fitness / health
  if (
    audience.includes("fitness") ||
    audience.includes("health") ||
    audience.includes("workout") ||
    audience.includes("gym")
  ) {
    return "fitness";
  }

  // Crypto / finance
  if (
    audience.includes("crypto") ||
    audience.includes("bitcoin") ||
    audience.includes("trading") ||
    audience.includes("stocks") ||
    genre.includes("tech") && audience.includes("finance")
  ) {
    return "crypto";
  }

  // Education / learning
  if (
    audience.includes("students") ||
    audience.includes("study") ||
    audience.includes("learn") ||
    audience.includes("course") ||
    story.includes("tutorial")
  ) {
    return "education";
  }

  // Business / side hustle / MMO
  if (
    audience.includes("online income") ||
    audience.includes("make money") ||
    audience.includes("side hustle") ||
    audience.includes("business") ||
    audience.includes("entrepreneur")
  ) {
    return "business";
  }

  // Default – AI & tools / creators
  return "ai";
}

/**
 * Sorterar produkter så att de bästa hamnar först.
 * Enkel score: stars * epc + liten bonus för hög commission.
 */
function sortProducts(products: ProductInfo[]): ProductInfo[] {
  return [...products].sort((a, b) => {
    const scoreA = a.stars * a.epc + a.commission * 0.02;
    const scoreB = b.stars * b.epc + b.commission * 0.02;
    return scoreB - scoreA;
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RecommendRequestBody;

    const category = inferCategoryFromContext(body);

    const filtered = PRODUCT_CATALOG.filter(
      (p) => p.category === category
    );

    const sorted = filtered.length > 0 ? sortProducts(filtered) : sortProducts(PRODUCT_CATALOG);

    const recommendedOffer = sorted[0];
    const alternatives = sorted.slice(1, 3); // 2 alternativ att visa senare om du vill

    if (!recommendedOffer) {
      return NextResponse.json(
        { error: "No products available for recommendation." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        recommendedOffer,
        alternatives,
        debug: {
          usedCategory: category,
          input: body,
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Error in /api/reels/recommend:", err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          "Failed to recommend offer. Please try again.",
      },
      { status: 500 }
    );
  }
}