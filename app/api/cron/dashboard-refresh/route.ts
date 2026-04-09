import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type CreatorMode = "beginner" | "consistent" | "growth";
type Plan = "basic" | "pro" | "elite";

type DailyCacheRow = {
  day_key: string;
  creator_mode: CreatorMode;
  plan: Plan;
  email_subject: string;
  email_body: string;
};

type WeeklyCacheRow = {
  week_key: string;
  creator_mode: CreatorMode;
  plan: Plan;
  title: string;
  actions: string[];
  add_ons: string[];
  guardrails: string[];
  win_condition: string;
};

type LeadSignalRow = {
  source: string;
  source_url: string;
  snippet: string;
  author_hint: string;
  temperature: "HOT" | "WARM" | "COLD";
  score: number;
  why: string[];
};

const CREATOR_MODES: CreatorMode[] = ["beginner", "consistent", "growth"];
const PLANS: Plan[] = ["basic", "pro", "elite"];

function checkCronAuth(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;

  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

function getStockholmNow() {
  return new Date();
}

function getDayKeyStockholm(d = getStockholmNow()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function getISOWeekNumber(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date as any) - (yearStart as any)) / 86400000 + 1) / 7);
  return weekNo;
}

function getWeekKeyStockholm() {
  const now = getStockholmNow();
  const year = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
  }).format(now);
  const week = String(getISOWeekNumber(now)).padStart(2, "0");
  return `${year}-W${week}`;
}

function hashString(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function rotate<T>(arr: T[], offset: number) {
  if (!arr.length) return arr;
  const idx = ((offset % arr.length) + arr.length) % arr.length;
  return [...arr.slice(idx), ...arr.slice(0, idx)];
}

function buildWeeklyFocus(creatorMode: CreatorMode, plan: Plan) {
  const week = getISOWeekNumber(getStockholmNow());

  const themes = [
    {
      title: "DM Funnel Week (Turn views into conversations)",
      actions: [
        "Publish consistently and focus on one clear CTA.",
        "Use one keyword-based call to action in your content.",
        "Reply to every comment and DM the same day.",
      ],
      win: "If you get 5+ DMs this week, you’re building real buying intent.",
    },
    {
      title: "Trust Week (Proof that converts without bragging)",
      actions: [
        "Post 2 proof-based pieces this week.",
        "Add one micro-proof line in every caption.",
        "Ask one question in every post to boost comments.",
      ],
      win: "If comments increase, your reach and trust are compounding.",
    },
    {
      title: "Community Week (Algorithm boost + warm leads)",
      actions: [
        "Engage 10 minutes before posting.",
        "Engage 10 minutes after posting.",
        "Join one niche conversation per day.",
      ],
      win: "If you engage daily around posting, reach usually lifts within 7–14 days.",
    },
    {
      title: "Offer Week (Ethical conversion, not spam)",
      actions: [
        "Keep offers soft and helpful.",
        "Do not post offers two days in a row.",
        "Follow up warm leads 24 hours later.",
      ],
      win: "If you get 2–5 positive replies on follow-up, your positioning is working.",
    },
  ];

  const chosen = themes[week % themes.length];

  const addOns =
    plan === "elite"
      ? [
          "Generate 3 hook angles and test the strongest one.",
          "Repurpose 1 Reel into 1 post and 1 story prompt.",
        ]
      : plan === "pro"
        ? [
            "Generate 2 hook variations and compare response.",
            "Add a pinned comment + DM reply every day.",
          ]
        : [];

  const guardrails =
    creatorMode === "beginner"
      ? [
          "Keep CTA extremely simple: one keyword only.",
          "No raw links in public comments.",
        ]
      : [];

  return {
    title: chosen.title,
    actions: chosen.actions,
    add_ons: addOns,
    guardrails,
    win_condition: chosen.win,
  };
}

function buildDailyPost(creatorMode: CreatorMode, plan: Plan, dayKey: string) {
  const angle =
    creatorMode === "beginner"
      ? "simple beginner momentum"
      : creatorMode === "consistent"
        ? "consistent creator structure"
        : "growth mode conversion";

  const subject = `Autoaffi Daily Post • ${dayKey} • ${creatorMode}/${plan}`;

  const body =
    `Hook:\n` +
    `If you want more ${creatorMode === "growth" ? "buyers" : "momentum"}, stop overcomplicating your content.\n\n` +
    `Body:\n` +
    `Today’s focus is ${angle}. Keep your post simple, clear and easy to engage with. ` +
    `Use one CTA, one angle and one helpful message.\n\n` +
    `CTA:\n` +
    `Comment "PLAN" and I’ll send the next step.\n\n` +
    `Plan level:\n${plan.toUpperCase()}`;

  return {
    email_subject: subject,
    email_body: body,
  };
}

function buildLeadSignals(dayKey: string): LeadSignalRow[] {
  const seed = hashString(dayKey);

  const redditHot = rotate(
    [
      {
        snippet:
          "I’ve been looking for a real online income path that doesn’t feel scammy. I just want something clear and legit.",
        why: [
          "Explicit income-improvement intent",
          "Trust-sensitive phrasing",
          "High chance of responding to a clear DM",
        ],
      },
      {
        snippet:
          "I seriously need an extra income stream this year. Open to learning something online if it’s realistic.",
        why: [
          "Explicit extra-income intent",
          "Open to guidance",
          "Practical rather than hype-driven wording",
        ],
      },
      {
        snippet:
          "Does anyone know a legit way to build income online when you’re starting from scratch?",
        why: [
          "Beginner intent",
          "Direct request for help",
          "Strong curiosity signal",
        ],
      },
    ],
    seed
  );

  const xHot = rotate(
    [
      {
        snippet:
          "Need to make a change this year. I want a cleaner way to earn online without chasing random side hustles.",
        why: [
          "Life-change intent",
          "Income motivation",
          "Looking for a more structured path",
        ],
      },
      {
        snippet:
          "What’s the most legit way to start making money online if you don’t want to look spammy?",
        why: [
          "Explicit make-money-online intent",
          "Trust-aware language",
          "High-quality beginner signal",
        ],
      },
      {
        snippet:
          "I’m tired of overcomplicating this. I just want one real online system I can focus on consistently.",
        why: [
          "Desire for simplicity",
          "Consistency-oriented wording",
          "Warm conversion potential",
        ],
      },
    ],
    seed + 3
  );

  const redditWarm = rotate(
    [
      {
        snippet:
          "Thinking about affiliate marketing or some kind of content-based side income, but not sure what’s actually worth focusing on.",
        why: [
          "Affiliate interest detected",
          "Exploratory intent",
          "Needs guidance before conversion",
        ],
      },
      {
        snippet:
          "I want to build something online on the side, but I need it to be simple enough to stay consistent with.",
        why: [
          "Side-income intent",
          "Consistency concern",
          "Warm educational opportunity",
        ],
      },
      {
        snippet:
          "Would love an online income setup that feels realistic and low-pressure instead of aggressive selling.",
        why: [
          "Low-pressure preference",
          "Strong fit for value-first outreach",
          "Warm trust-led signal",
        ],
      },
    ],
    seed + 7
  );

  return [
    {
      source: "reddit",
      source_url: "https://reddit.com",
      snippet: redditHot[0].snippet,
      author_hint: "Public post",
      temperature: "HOT",
      score: 88,
      why: redditHot[0].why,
    },
    {
      source: "x",
      source_url: "https://x.com",
      snippet: xHot[0].snippet,
      author_hint: "Public post",
      temperature: "HOT",
      score: 84,
      why: xHot[0].why,
    },
    {
      source: "reddit",
      source_url: "https://reddit.com",
      snippet: redditWarm[0].snippet,
      author_hint: "Public post",
      temperature: "WARM",
      score: 67,
      why: redditWarm[0].why,
    },
  ];
}

async function sendDailyEmails(dayKey: string) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM_EMAIL;

  if (!resendApiKey || !resendFrom) {
    return { attempted: 0, sent: 0, skipped: "Missing RESEND_API_KEY or RESEND_FROM_EMAIL" };
  }

  const { data: recipients, error } = await supabaseAdmin
    .from("user_daily_post_delivery")
    .select("user_id, email")
    .eq("enabled", true)
    .or(`last_sent_day_key.is.null,last_sent_day_key.neq.${dayKey}`);

  if (error || !recipients?.length) {
    return { attempted: 0, sent: 0, skipped: error?.message ?? "No enabled recipients" };
  }

  let attempted = 0;
  let sent = 0;

  for (const row of recipients) {
    attempted += 1;

    const creatorMode: CreatorMode = "beginner";
    const plan: Plan = "basic";

    const { data: content } = await supabaseAdmin
      .from("dashboard_daily_content_cache")
      .select("email_subject, email_body")
      .eq("day_key", dayKey)
      .eq("creator_mode", creatorMode)
      .eq("plan", plan)
      .maybeSingle();

    if (!content) continue;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: resendFrom,
          to: row.email,
          subject: content.email_subject,
          text: content.email_body,
        }),
      });

      if (!res.ok) continue;

      sent += 1;

      await supabaseAdmin
        .from("user_daily_post_delivery")
        .update({
          last_sent_day_key: dayKey,
          last_sent_at: new Date().toISOString(),
        })
        .eq("user_id", row.user_id);
    } catch {
      // continue
    }
  }

  return { attempted, sent, skipped: null };
}

export async function GET(req: Request) {
  if (!checkCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dayKey = getDayKeyStockholm();
  const weekKey = getWeekKeyStockholm();

  const dailyRows: DailyCacheRow[] = [];
  const weeklyRows: WeeklyCacheRow[] = [];

  for (const creatorMode of CREATOR_MODES) {
    for (const plan of PLANS) {
      const daily = buildDailyPost(creatorMode, plan, dayKey);
      dailyRows.push({
        day_key: dayKey,
        creator_mode: creatorMode,
        plan,
        email_subject: daily.email_subject,
        email_body: daily.email_body,
      });

      const weekly = buildWeeklyFocus(creatorMode, plan);
      weeklyRows.push({
        week_key: weekKey,
        creator_mode: creatorMode,
        plan,
        title: weekly.title,
        actions: weekly.actions,
        add_ons: weekly.add_ons,
        guardrails: weekly.guardrails,
        win_condition: weekly.win_condition,
      });
    }
  }

  const leadRows = buildLeadSignals(dayKey);

  const dailyResult = await supabaseAdmin
    .from("dashboard_daily_content_cache")
    .upsert(dailyRows as any, { onConflict: "day_key,creator_mode,plan" });

  const weeklyResult = await supabaseAdmin
    .from("dashboard_weekly_focus_cache")
    .upsert(
      weeklyRows.map((row) => ({
        ...row,
        actions: row.actions as any,
        add_ons: row.add_ons as any,
        guardrails: row.guardrails as any,
      })) as any,
      { onConflict: "week_key,creator_mode,plan" }
    );

  await supabaseAdmin.from("lead_signals").delete().not("id", "is", null);
  const leadResult = await supabaseAdmin.from("lead_signals").insert(leadRows as any);

  const emailResult = await sendDailyEmails(dayKey);

  return NextResponse.json({
    ok: true,
    dayKey,
    weekKey,
    daily_cache: dailyResult.error ? dailyResult.error.message : "ok",
    weekly_cache: weeklyResult.error ? weeklyResult.error.message : "ok",
    lead_signals: leadResult.error ? leadResult.error.message : "ok",
    email: emailResult,
  });
}