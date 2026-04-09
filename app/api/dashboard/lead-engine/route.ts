import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function analyzeIntent(input: string) {
  const text = input.trim();
  const lower = text.toLowerCase();

  const positiveRules = [
    { phrase: "make money online", points: 30, why: "Explicit make-money-online intent" },
    { phrase: "extra income", points: 25, why: "Explicit extra-income intent" },
    { phrase: "side hustle", points: 20, why: "Side hustle intent" },
    { phrase: "need a change", points: 20, why: "Life-change intent" },
    { phrase: "quit my job", points: 25, why: "Strong transformation intent" },
    { phrase: "affiliate marketing", points: 15, why: "Affiliate interest detected" },
    { phrase: "need money", points: 20, why: "Money urgency" },
    { phrase: "how do i", points: 10, why: "Asking for help" },
    { phrase: "any advice", points: 10, why: "Open to guidance" },
  ];

  const negativeRules = [
    { phrase: "crypto", points: -10, why: "Crypto-heavy phrasing" },
    { phrase: "dm me", points: -10, why: "Possible spam-style wording" },
    { phrase: "link in bio", points: -10, why: "Promotion-heavy wording" },
    { phrase: "get rich quick", points: -20, why: "Low-quality / hype signal" },
  ];

  let score = 20;
  const why: string[] = [];

  for (const rule of positiveRules) {
    if (lower.includes(rule.phrase)) {
      score += rule.points;
      why.push(rule.why);
    }
  }

  for (const rule of negativeRules) {
    if (lower.includes(rule.phrase)) {
      score += rule.points;
      why.push(rule.why);
    }
  }

  if (text.includes("?")) {
    score += 8;
    why.push("Question detected");
  }

  if (score >= 75) {
    return {
      temperature: "HOT" as const,
      score: Math.min(score, 100),
      why,
    };
  }

  if (score >= 45) {
    return {
      temperature: "WARM" as const,
      score: Math.min(score, 100),
      why,
    };
  }

  return {
    temperature: "COLD" as const,
    score: Math.max(score, 0),
    why,
  };
}

function buildDmOpener(
  _input: string,
  temperature: "HOT" | "WARM" | "COLD"
) {
  if (temperature === "HOT") {
    return `Hey — I saw your post and it sounded like you’re actively looking for a real way to improve your income. Totally get that. I use a simple content + affiliate system that keeps things clear and low-pressure. Want the simple version?`;
  }

  if (temperature === "WARM") {
    return `Hey — I came across your post and thought I’d reach out. It sounds like you’re interested in improving your situation and earning online in a more structured way. Want me to send the simple version?`;
  }

  return `Hey — I saw your post. Not sure if it’s relevant, but if you ever want a simple system for content + affiliate growth, I can send the basic version.`;
}

function buildFollowUp(temperature: "HOT" | "WARM" | "COLD") {
  if (temperature === "HOT") {
    return `Quick check — do you want the simple version or the more complete setup? Reply with SIMPLE or FULL and I’ll send the right one.`;
  }

  if (temperature === "WARM") {
    return `Quick follow-up — still interested in a simple way to get started online without overcomplicating it?`;
  }

  return `No stress if now isn’t the right time — but if you want the simple version later, just reply GO and I’ll send it.`;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("lead_signals")
    .select(
      "id, source, source_url, snippet, author_hint, temperature, score, why, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    items: data ?? [],
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const input = String(body?.input ?? "").trim();

  if (!input) {
    return NextResponse.json({ error: "Missing input" }, { status: 400 });
  }

  const analysis = analyzeIntent(input);

  const result = {
    snippet: input,
    source: "manual_scan",
    temperature: analysis.temperature,
    score: analysis.score,
    why: analysis.why.length ? analysis.why : ["General intent detected"],
    dm_opener: buildDmOpener(input, analysis.temperature),
    follow_up: buildFollowUp(analysis.temperature),
  };

  return NextResponse.json({ result });
}