"use client";

import OpenAI from "openai";

export type ExactFixResult = {
  hook: string;
  caption: string;
  body: string;
  score: number;
  howToReach10: string[];
};

// 🔐 Trygg klient – skapas bara om det finns en nyckel
let client: OpenAI | null = null;

const browserApiKey = process.env.NEXT_PUBLIC_OPENAI_KEY;

if (browserApiKey) {
  client = new OpenAI({
    apiKey: browserApiKey,
    // OBS: bara för dev / interna tester – i produktion flyttas detta till backend
    dangerouslyAllowBrowser: true,
  });
} else {
  if (typeof window !== "undefined") {
    console.warn(
      "ExactFixEngine: NEXT_PUBLIC_OPENAI_KEY is missing – engine is disabled but the page will still work."
    );
  }
}

// --- MAIN FIX FUNCTION ---
// Används från posts/page.tsx men kraschar inte om ingen nyckel finns.
export async function runExactFixEngine(input: {
  hook: string;
  caption: string;
  body: string;
  niche: string;
}): Promise<ExactFixResult | null> {
  // Ingen nyckel? hoppa över remote-call, låt UI fortsätta funka.
  if (!client) {
    return null;
  }

  const prompt = `
You are EXACT FIX ENGINE v3 — optimize social content to reach 10/10 performance.

INPUT:
Hook: ${input.hook}
Caption: ${input.caption}
Body: ${input.body}
Niche: ${input.niche}

TASK:
1. Rewrite the hook (HookFix)
2. Rewrite the caption (SEOFix)
3. Rewrite the body (EngagementFix + ClarityFix)
4. Give a 1–10 score
5. Give EXACT instructions to reach 10/10
6. Output JSON ONLY:

{
 "hook": "...",
 "caption": "...",
 "body": "...",
 "score": 9,
 "howToReach10": [
   "...",
   "..."
 ]
}
`.trim();

  try {
    const completion = await client.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
      temperature: 0.4,
    });

    const text = (completion as any).output_text as string;

    try {
      const parsed = JSON.parse(text);
      return {
        hook: parsed.hook ?? input.hook,
        caption: parsed.caption ?? input.caption,
        body: parsed.body ?? input.body,
        score: typeof parsed.score === "number" ? parsed.score : 7,
        howToReach10: Array.isArray(parsed.howToReach10)
          ? parsed.howToReach10
          : [],
      };
    } catch (e) {
      console.error("ExactFixEngine JSON parse error", e);
      return null;
    }
  } catch (err) {
    console.error("ExactFixEngine OpenAI error", err);
    return null;
  }
}