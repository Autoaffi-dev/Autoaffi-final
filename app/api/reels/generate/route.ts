import { NextResponse } from "next/server";
import OpenAI from "openai";

// Initialize OpenAI
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// ------------------------
// MOCK PRODUCT CATALOG (static for now)
// ------------------------
const PRODUCT_CATALOG = {
  ai: [
    {
      id: "ai-1",
      name: "AI Video Masterclass",
      epc: 3.4,
      rating: 4.7,
    },
    {
      id: "ai-2",
      name: "ChatGPT Side Hustles",
      epc: 2.9,
      rating: 4.6,
    },
    {
      id: "ai-3",
      name: "AI Automation Tools",
      epc: 4.1,
      rating: 4.8,
    },
  ],
  fitness: [
    {
      id: "fit-1",
      name: "Home Workout Program",
      epc: 1.8,
      rating: 4.3,
    },
    {
      id: "fit-2",
      name: "Fat Burn Formula",
      epc: 2.1,
      rating: 4.5,
    },
  ],
  marketing: [
    {
      id: "mkt-1",
      name: "Instagram Growth Bootcamp",
      epc: 3.1,
      rating: 4.6,
    },
    {
      id: "mkt-2",
      name: "TikTok Monetization Blueprint",
      epc: 2.7,
      rating: 4.4,
    },
  ],
};

// ------------------------
// OFFER-BASED CONTEXT
// ------------------------
function buildOfferContext(offer: any | null) {
  if (!offer) {
    return `
No offer selected. Use neutral hooks, generalized pacing and broad CTA.`;
  }

  if (offer.mode === "funnel") {
    return `
Offer Type: FUNNEL.
Use curiosity hooks, storytelling pacing and soft CTA inviting click-through.`;
  }

  if (offer.mode === "product") {
    return `
Offer Type: PRODUCT.
Use problem → solution → transformation.
Strong CTA. Showcase benefits.`;
  }

  if (offer.mode === "recurring") {
    return `
Offer Type: RECURRING SaaS.
Use recurring revenue angles, automation benefits and long-term value.`;
  }

  return "Neutral offer.";
}

// ------------------------
// STORY FORMAT TEMPLATE
// ------------------------
function buildStoryTemplate(format: string) {
  switch (format) {
    case "hook-story-cta":
      return "HOOK → MINI STORY → CTA";
    case "problem-solution":
      return "Problem → Pain → Solution → CTA";
    case "3-tips":
      return "Tip 1 → Tip 2 → Tip 3 → CTA";
    default:
      return "HOOK → STORY → CTA";
  }
}

// ------------------------
// PRODUCT RECOMMENDATIONS
// ------------------------
function getProductRecommendations(category: string, search?: string) {
  const list = PRODUCT_CATALOG[category] || [];

  if (search) {
    return list
      .filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase())
      )
      .slice(0, 3);
  }

  return list.slice(0, 3);
}

// ------------------------
// MAIN API HANDLER
// ------------------------
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      genre,
      tone,
      storyFormat,
      videoLength,
      mode,
      mediaType,
      nicheDescription,
      selectedOffer,
    } = body;

    // Build contexts
    const offerContext = buildOfferContext(selectedOffer);
    const formatContext = buildStoryTemplate(storyFormat);

    // Mode context
    const modeContext =
      mode === "manual"
        ? "User controls media. Keep pacing tight."
        : mode === "guided"
        ? `User provided niche: ${nicheDescription || "None"}`
        : "AUTO MODE: Optimized for reach.";

    // -----------------------------
    // PRODUCT RECOMMENDATIONS
    // -----------------------------
    let recommendations = [];

    if (selectedOffer?.mode === "product") {
      recommendations = getProductRecommendations(
        selectedOffer.category || "ai",
        body.manualProductSearch
      );
    }

    // -----------------------------
    // OPENAI GENERATION
    // -----------------------------
    const completion = await client.chat.completions.create({
      model: "gpt-4.1",
      temperature: 0.8,
      messages: [
        {
          role: "system",
          content: `
You are Autoaffi VX. Generate JSON only. Structure:

{
 "script": "...",
 "storyboard": [],
 "subtitles": [],
 "cta": "...",
 "socialHints": {
   "hashtags": [],
   "titleIdeas": [],
   "captionIdeas": [],
   "postingTimes": []
 },
 "thumbnailIntelligence": {
   "finalPrompt": "",
   "emotion": "",
   "focalPoint": "",
   "colorPalette": [],
   "layoutNotes": ""
 },
 "ctaIntelligence": {
   "hookType": "",
   "urgencyLevel": "",
   "clarityScore": 8,
   "powerWords": [],
   "frictionPhrases": [],
   "finalCtaLine": ""
 },
 "offerMeta": {
   "name": "",
   "mode": "",
   "category": "",
   "recommendations": []
 },
 "beatMap": [],
 "voiceTimeline": [],
 "exportTimeline": []
}

NO extra text.
`,
        },
        {
          role: "user",
          content: `
Generate reel blueprint:

Genre: ${genre}
Tone: ${tone}
Format: ${formatContext}
Length: ${videoLength}
Mode: ${mode}
Media: ${mediaType}

Offer context:
${offerContext}

Recommendations:
${JSON.stringify(recommendations, null, 2)}

Mode behavior:
${modeContext}
`,
        },
      ],
    });

    const raw = completion.choices[0].message?.content || "{}";

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error("❌ JSON PARSE ERROR:", raw);
      throw new Error("AI returned invalid JSON.");
    }

    // Attach recommendations into offerMeta
    if (parsed.offerMeta) {
      parsed.offerMeta.recommendations = recommendations;
    }

    return NextResponse.json(parsed, { status: 200 });
  } catch (err: any) {
    console.error("❌ GENERATE ERROR", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate reel." },
      { status: 500 }
    );
  }
}