import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LeadTemperature = "HOT" | "WARM" | "COLD";

type LeadStatus =
  | "new"
  | "saved"
  | "contacted"
  | "ignored"
  | "dismissed";

type LeadSignalRow = {
  id: string;
  user_id?: string | null;

  // Legacy fields
  source?: string | null;
  source_url?: string | null;
  snippet?: string | null;
  author_hint?: string | null;
  temperature?: string | null;
  score?: number | null;
  why?: string[] | null;
  created_at?: string | null;

  // New richer Social Lead fields
  source_platform?: string | null;
  source_type?: string | null;
  external_id?: string | null;
  source_username?: string | null;
  source_author_url?: string | null;
  source_title?: string | null;
  source_channel?: string | null;
  source_text?: string | null;
  why_matched?: string[] | null;
  suggested_opener?: string | null;
  tags?: string[] | null;
  status?: string | null;
  raw?: Record<string, unknown> | null;
  updated_at?: string | null;

  // Autoaffi identity snapshot fields
  autoaffi_user_code?: string | null;
  autoaffi_identity_status?: string | null;
  tracking_context?: Record<string, unknown> | null;
  global_pool_id?: string | null;
};

function normalizeTemperature(value: string | null | undefined): LeadTemperature {
  const upper = String(value || "").toUpperCase();

  if (upper === "HOT") return "HOT";
  if (upper === "WARM") return "WARM";
  return "COLD";
}

function normalizeStatus(value: string | null | undefined): LeadStatus {
  const clean = String(value || "").toLowerCase();

  if (clean === "saved") return "saved";
  if (clean === "contacted") return "contacted";
  if (clean === "ignored") return "ignored";
  if (clean === "dismissed") return "dismissed";

  return "new";
}

function temperatureRank(temp: LeadTemperature) {
  if (temp === "HOT") return 3;
  if (temp === "WARM") return 2;
  return 1;
}

function statusRank(status: LeadStatus) {
  if (status === "new") return 4;
  if (status === "saved") return 3;
  if (status === "contacted") return 2;
  if (status === "ignored") return 1;
  return 0;
}

function normalizeWhy(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }

  return [];
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }

  return [];
}

function buildFallbackDmOpener(params: {
  sourceText: string;
  temperature: LeadTemperature;
  source: string;
}) {
  const { sourceText, temperature, source } = params;

  if (temperature === "HOT") {
    return `Hey — I saw your ${source} post and it sounded like you’re actively looking for a clearer way to move forward. A simple starting point is one offer, useful content, and proper tracking so you can see what actually works. Want the simple version?`;
  }

  if (temperature === "WARM") {
    return `Hey — I came across your ${source} post and thought it was relevant. If you’re trying to build online income in a more structured way, I’d start with one clear offer, simple content, and tracking before adding more platforms.`;
  }

  return `Hey — I saw your ${source} post. Not sure if it is relevant right now, but if you ever want a simple content + affiliate setup, I can send the basic version.`;
}

function buildFallbackFollowUp(temperature: LeadTemperature) {
  if (temperature === "HOT") {
    return `Quick check — do you want the simple version or the more complete setup? Reply SIMPLE or FULL and I’ll send the right one.`;
  }

  if (temperature === "WARM") {
    return `Quick follow-up — still interested in a simple way to get started without overcomplicating it?`;
  }

  return `No stress if now is not the right time — if you want the simple version later, just reply GO.`;
}

function normalizeLeadSignal(row: LeadSignalRow) {
  const temperature = normalizeTemperature(row.temperature);
  const status = normalizeStatus(row.status);

  const source = row.source_platform || row.source || "unknown";

  const snippet = row.source_text || row.snippet || "";

  const authorHint = row.source_username || row.author_hint || null;

  const why =
    normalizeWhy(row.why_matched).length > 0
      ? normalizeWhy(row.why_matched)
      : normalizeWhy(row.why);

  const tags = normalizeTags(row.tags);

  const suggestedOpener =
    row.suggested_opener ||
    buildFallbackDmOpener({
      sourceText: snippet,
      temperature,
      source,
    });

  const followUp = buildFallbackFollowUp(temperature);

  return {
    id: row.id,
    user_id: row.user_id || null,

    source,
    source_platform: row.source_platform || source,
    source_type: row.source_type || null,
    external_id: row.external_id || null,

    source_url: row.source_url || null,
    source_title: row.source_title || null,
    source_channel: row.source_channel || null,

    snippet,
    source_text: snippet,

    author_hint: authorHint,
    source_username: authorHint,
    source_author_url: row.source_author_url || null,

    temperature,
    score: Number(row.score || 0),

    why,
    why_matched: why,

    suggested_opener: suggestedOpener,
    dm_opener: suggestedOpener,
    follow_up: followUp,

    tags,
    status,

    autoaffi_user_code: row.autoaffi_user_code || null,
    autoaffi_identity_status: row.autoaffi_identity_status || "not_checked",
    tracking_context: row.tracking_context || null,
    global_pool_id: row.global_pool_id || null,

    raw: row.raw || null,

    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || null,
  };
}

function analyzeIntent(input: string) {
  const text = input.trim();
  const lower = text.toLowerCase();

  const positiveRules = [
    {
      phrase: "make money online",
      points: 30,
      why: "Explicit make-money-online intent",
    },
    {
      phrase: "extra income",
      points: 25,
      why: "Explicit extra-income intent",
    },
    {
      phrase: "side hustle",
      points: 20,
      why: "Side hustle intent",
    },
    {
      phrase: "need a change",
      points: 20,
      why: "Life-change intent",
    },
    {
      phrase: "quit my job",
      points: 25,
      why: "Strong transformation intent",
    },
    {
      phrase: "affiliate marketing",
      points: 15,
      why: "Affiliate interest detected",
    },
    {
      phrase: "need money",
      points: 20,
      why: "Money urgency",
    },
    {
      phrase: "how do i",
      points: 10,
      why: "Asking for help",
    },
    {
      phrase: "any advice",
      points: 10,
      why: "Open to guidance",
    },
    {
      phrase: "no sales",
      points: 18,
      why: "Shows lack of results",
    },
    {
      phrase: "no clicks",
      points: 18,
      why: "Shows tracking or conversion problem",
    },
    {
      phrase: "struggling",
      points: 15,
      why: "Shows frustration or pain point",
    },
    {
      phrase: "stuck",
      points: 15,
      why: "Shows need for guidance",
    },
  ];

  const negativeRules = [
    {
      phrase: "crypto",
      points: -10,
      why: "Crypto-heavy phrasing",
    },
    {
      phrase: "dm me",
      points: -10,
      why: "Possible spam-style wording",
    },
    {
      phrase: "link in bio",
      points: -10,
      why: "Promotion-heavy wording",
    },
    {
      phrase: "get rich quick",
      points: -20,
      why: "Low-quality / hype signal",
    },
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
  input: string,
  temperature: "HOT" | "WARM" | "COLD"
) {
  if (temperature === "HOT") {
    return `Hey — I saw this and it sounded like you’re actively looking for a real way to improve your income. Totally get that. A simple starting point is one offer, useful content, and tracking so you can see what actually works. Want the simple version?`;
  }

  if (temperature === "WARM") {
    return `Hey — I came across this and thought I’d reach out. It sounds like you’re interested in improving your situation and earning online in a more structured way. Want me to send the simple version?`;
  }

  return `Hey — I saw this. Not sure if it’s relevant, but if you ever want a simple system for content + affiliate growth, I can send the basic version.`;
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

async function resolveUserId(req: Request) {
  const devHeaderUserId = req.headers.get("x-autoaffi-user-id");

  if (
    process.env.NODE_ENV !== "production" &&
    devHeaderUserId &&
    devHeaderUserId.length > 10
  ) {
    return devHeaderUserId;
  }

  const session = await getServerSession(authOptions);
  return session?.user?.id || null;
}

export async function GET(req: Request) {
  const userId = await resolveUserId(req);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("lead_signals")
    .select(
      [
        "id",
        "user_id",

        // Legacy fields
        "source",
        "source_url",
        "snippet",
        "author_hint",
        "temperature",
        "score",
        "why",
        "created_at",

        // New richer fields
        "source_platform",
        "source_type",
        "external_id",
        "source_username",
        "source_author_url",
        "source_title",
        "source_channel",
        "source_text",
        "why_matched",
        "suggested_opener",
        "tags",
        "status",
        "raw",
        "updated_at",

        // Autoaffi identity snapshot fields
        "autoaffi_user_code",
        "autoaffi_identity_status",
        "tracking_context",
        "global_pool_id",
      ].join(", ")
    )
    .eq("user_id", userId)
    .neq("status", "dismissed")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        debugUserId: userId,
        error: error.message,
      },
      { status: 500 }
    );
  }

  const allowedSources = new Set([
    "youtube",
    "telegram",
    "reddit",
    "bluesky",
    "x",
    "instagram",
    "tiktok",
    "mlgs",
    "manual_scan",
  ]);

  const normalizedItems = (data ?? []).map((row) =>
    normalizeLeadSignal(row as unknown as LeadSignalRow)
  );

  const items = normalizedItems
    .filter((item) => {
      if (!item.snippet?.trim()) return false;

      const source = item.source.toLowerCase();
      const sourcePlatform = String(item.source_platform || "").toLowerCase();

      return allowedSources.has(source) || allowedSources.has(sourcePlatform);
    })
    .sort((a, b) => {
      const statusDiff = statusRank(b.status) - statusRank(a.status);
      if (statusDiff !== 0) return statusDiff;

      const tempDiff =
        temperatureRank(b.temperature) - temperatureRank(a.temperature);

      if (tempDiff !== 0) return tempDiff;

      const scoreDiff = Number(b.score || 0) - Number(a.score || 0);
      if (scoreDiff !== 0) return scoreDiff;

      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    })
    .slice(0, 12);

  return NextResponse.json({
  ok: true,
  items,
});
}

export async function POST(req: Request) {
  const userId = await resolveUserId(req);

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
    source_platform: "manual_scan",
    source_type: "manual_scan",
    temperature: analysis.temperature,
    score: analysis.score,
    why: analysis.why.length ? analysis.why : ["General intent detected"],
    why_matched: analysis.why.length ? analysis.why : ["General intent detected"],
    dm_opener: buildDmOpener(input, analysis.temperature),
    suggested_opener: buildDmOpener(input, analysis.temperature),
    follow_up: buildFollowUp(analysis.temperature),
    status: "new",
  };

  return NextResponse.json({
    ok: true,
    result,
  });
}

export async function PATCH(req: Request) {
  const userId = await resolveUserId(req);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  const id = String(body?.id || "").trim();
  const status = normalizeStatus(String(body?.status || "new"));

  if (!id) {
    return NextResponse.json({ error: "Missing lead id" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("lead_signals")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId)
    .select("id, status, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    item: data,
  });
}