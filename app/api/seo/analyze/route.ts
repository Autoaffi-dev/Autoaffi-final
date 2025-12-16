import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// 💰 Kostnadskontroll: vi klipper texten & kör mini-modell
const MAX_CONTENT_CHARS = 1200;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawContent = (body?.content as string) || "";
    const manualLink = (body?.manualLink as string | undefined) || undefined;

    const content = rawContent.slice(0, MAX_CONTENT_CHARS).trim();

    if (!content) {
      return NextResponse.json(
        {
          ok: false,
          reason: "NO_CONTENT",
          message: "No content provided for SEO analysis.",
        },
        { status: 400 }
      );
    }

    const prompt = `
You are an SEO & social media optimization expert for short-form content (TikTok, Reels, Shorts).

INPUT:
- Post content: """${content}"""
- Optional URL: ${manualLink || "none"}

TASK:
Return a STRICT JSON object (no extra text) with this shape:

{
  "keywords": string[],                  // 5-12 short, punchy keywords
  "hashtags": {
    "high": string[],                    // broad, high-volume tags (3-6)
    "medium": string[],                  // niche, mid-volume (3-6)
    "low": string[]                      // very specific, low-volume (3-6)
  },
  "insights": string[],                  // 3-6 short bullet-style tips
  "scores": {
    "hook": number,                      // 0-100 how strong the hook is
    "seo": number,                       // 0-100 SEO discoverability
    "engagement": number,                // 0-100 engagement potential
    "clarity": number                    // 0-100 message clarity
  }
}

Rules:
- All arrays must have at least 3 items.
- Hashtags must NOT include "#", just plain words (e.g. "aitools", "makemoneyonline").
- Keywords should be short phrases, not full sentences.
- Scores are integers (no decimals).
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // billig & snabb – byt vid behov
      messages: [
        { role: "system", content: "You output ONLY valid JSON. No explanations." },
        { role: "user", content: prompt },
      ],
      max_tokens: 450,
      temperature: 0.4,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      // Fallback om modellen strular lite
      parsed = {
        keywords: [],
        hashtags: { high: [], medium: [], low: [] },
        insights: ["SEO engine fallback – could not parse model output."],
        scores: { hook: 50, seo: 50, engagement: 50, clarity: 50 },
      };
    }

    const safe = {
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      hashtags: {
        high:
          Array.isArray(parsed.hashtags?.high) ? parsed.hashtags.high : [],
        medium:
          Array.isArray(parsed.hashtags?.medium) ? parsed.hashtags.medium : [],
        low: Array.isArray(parsed.hashtags?.low) ? parsed.hashtags.low : [],
      },
      insights: Array.isArray(parsed.insights) ? parsed.insights : [],
      scores: {
        hook: Number(parsed.scores?.hook ?? 50),
        seo: Number(parsed.scores?.seo ?? 50),
        engagement: Number(parsed.scores?.engagement ?? 50),
        clarity: Number(parsed.scores?.clarity ?? 50),
      },
    };

    return NextResponse.json({ ok: true, analysis: safe });
  } catch (err) {
    console.error("[SEO Engine] Error:", err);
    return NextResponse.json(
      {
        ok: false,
        reason: "SERVER_ERROR",
      },
      { status: 500 }
    );
  }
}