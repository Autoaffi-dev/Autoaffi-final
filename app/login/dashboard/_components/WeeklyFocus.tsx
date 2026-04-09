"use client";

import * as React from "react";
import DailyPostDeliveryCard from "./DailyPostDeliveryCard";

interface WeeklyFocusProps {
  creatorMode: "beginner" | "consistent" | "growth" | null;
  plan: "basic" | "pro" | "elite";
}

type SafeCreatorMode = "beginner" | "consistent" | "growth";

type WeeklyFocusPayload = {
  weekKey: string;
  title: string;
  actions: string[];
  addOns: string[];
  guardrails: string[];
  win: string;
};

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function getISOWeekNumber(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date as any) - (yearStart as any)) / 86400000 + 1) / 7);
  return weekNo;
}

function contentCoachBlueprintBeastV2(plan: "basic" | "pro" | "elite") {
  const planBlock =
    plan === "elite"
      ? [
          "PLAN RULES (ELITE):",
          "- Provide 3 hook angles (curiosity / contrast / proof) and pick the best.",
          "- Provide 2 CTA keyword options and recommend one.",
          "- Provide repurpose plan: Reel + text post + story prompt.",
          "- Provide objection handling scripts (scam/time/price) and follow-up sequences.",
        ].join("\n")
      : plan === "pro"
        ? [
            "PLAN RULES (PRO):",
            "- Provide 2 hook variations and recommend one.",
            "- Provide 1 alternate CTA keyword option.",
            "- Provide short repurpose suggestion (Reel -> Post).",
            "- Provide a follow-up DM script.",
          ].join("\n")
        : [
            "PLAN RULES (BASIC):",
            "- Provide 1 strong version. Keep it simple and executable today.",
            "- Provide 1 CTA keyword and 1 DM reply script.",
            "- No fluff. No extra steps beyond 20 minutes.",
          ].join("\n");

  return [
    "YOU ARE: Autoaffi BEAST Content Coach (Samantha Mode).",
    "GOAL: Maximize my affiliate commissions using a daily content + conversion system.",
    "Tone: confident, direct, premium. Ethical. No hype, no spam.",
    "",
    "CORE RULES (NON-NEGOTIABLE):",
    "1) Always output a complete CONTENT + CONVERSION package (not just a caption).",
    "2) Everything must be copy-paste ready.",
    "3) One clear CTA only (keyword-based).",
    "4) If today is OFFER and I have no link, instruct Autoaffi-first.",
    "",
    planBlock,
    "",
    "OUTPUT SECTIONS:",
    "A) Hook + angle",
    "B) On-screen text",
    "C) Caption",
    "D) Pinned comment",
    "E) DM auto-reply",
    "F) Follow-up DM",
    "G) Objection handlers",
    "H) Image prompt",
    "I) CapCut script",
    "J) Link placement rules",
    "K) Execution loop",
  ].join("\n");
}

function buildLocalFallback(args: {
  creatorMode: SafeCreatorMode;
  plan: "basic" | "pro" | "elite";
}): WeeklyFocusPayload {
  const { creatorMode, plan } = args;
  const week = getISOWeekNumber(new Date());

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
    weekKey: `${new Date().getFullYear()}-W${String(week).padStart(2, "0")}`,
    title: chosen.title,
    actions: chosen.actions,
    addOns,
    guardrails,
    win: chosen.win,
  };
}

export default function WeeklyFocus({ creatorMode, plan }: WeeklyFocusProps) {
  const [copied, setCopied] = React.useState(false);
  const [weekly, setWeekly] = React.useState<WeeklyFocusPayload | null>(null);
  const [loading, setLoading] = React.useState(true);

  const safeCreatorMode = creatorMode ?? "beginner";
  const coachText = contentCoachBlueprintBeastV2(plan);

  React.useEffect(() => {
    let mounted = true;

    async function load() {
      if (!creatorMode) {
        if (mounted) {
          setWeekly(null);
          setLoading(false);
        }
        return;
      }

      try {
        const res = await fetch(
          `/api/dashboard/weekly-focus?creatorMode=${safeCreatorMode}&plan=${plan}`,
          { cache: "no-store" }
        );

        const json = await res.json();

        if (!mounted) return;

        if (res.ok && json?.item) {
          setWeekly(json.item);
          return;
        }
      } catch {
        // fallback below
      }

      if (mounted) {
        setWeekly(buildLocalFallback({ creatorMode: safeCreatorMode, plan }));
      }
    }

    setLoading(true);

    load().finally(() => {
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [creatorMode, safeCreatorMode, plan]);

  async function handleCopyBlueprint() {
    const ok = await copyText(coachText);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  const weekLabel = weekly?.weekKey ?? `Week ${getISOWeekNumber(new Date())}`;

  if (!creatorMode) return null;

  return (
    <section className="mb-8 space-y-4">
      <div className="rounded-xl border border-emerald-400/25 bg-slate-900/60 p-6 shadow-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xs uppercase tracking-widest text-emerald-300">
              Autoaffi Content Coach
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Paste this blueprint into ChatGPT to generate a full content +
              conversion package based on your plan and today’s goal.
            </p>
          </div>

          <button
            onClick={handleCopyBlueprint}
            className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/15"
          >
            {copied ? "Copied ✓" : "Copy Blueprint"}
          </button>
        </div>
      </div>

      <DailyPostDeliveryCard creatorMode={safeCreatorMode} plan={plan} />

      <div className="rounded-xl border border-white/10 bg-slate-950/30 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-slate-400">
              This week’s focus (BEAST)
            </p>
            <p className="mt-1 text-[12px] font-semibold text-slate-200">
              {loading ? "Loading weekly focus..." : weekly?.title ?? "Weekly focus unavailable"}
            </p>
          </div>
          <span className="text-[10px] text-slate-500">{weekLabel}</span>
        </div>

        <p className="mt-2 text-[12px] leading-relaxed text-slate-300">
          Keep this simple. These are the highest-leverage actions for this week.
        </p>

        <ul className="mt-3 space-y-2 text-[12px] text-slate-200">
          {(weekly?.actions ?? []).map((a, i) => (
            <li key={`${a}-${i}`} className="flex gap-2">
              <span className="text-emerald-300">{i + 1})</span>
              <span>{a}</span>
            </li>
          ))}
        </ul>

        {(weekly?.addOns?.length ?? 0) > 0 && (
          <div className="mt-3 rounded-lg border border-sky-400/15 bg-sky-500/5 p-3">
            <p className="text-[11px] font-medium uppercase tracking-widest text-sky-200">
              Plan boosters ({plan.toUpperCase()})
            </p>
            <ul className="mt-2 space-y-1 text-[12px] text-slate-200">
              {weekly!.addOns.map((x, i) => (
                <li key={`${x}-${i}`} className="flex gap-2">
                  <span className="text-sky-300">•</span>
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(weekly?.guardrails?.length ?? 0) > 0 && (
          <div className="mt-3 rounded-lg border border-amber-400/15 bg-amber-500/5 p-3">
            <p className="text-[11px] font-medium uppercase tracking-widest text-amber-200">
              Guardrails
            </p>
            <ul className="mt-2 space-y-1 text-[12px] text-slate-200">
              {weekly!.guardrails.map((x, i) => (
                <li key={`${x}-${i}`} className="flex gap-2">
                  <span className="text-amber-300">•</span>
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-3 rounded-lg border border-emerald-400/15 bg-emerald-500/5 p-3">
          <p className="text-[11px] font-medium text-emerald-200">
            Weekly win condition
          </p>
          <p className="mt-1 text-[12px] text-slate-200">
            {weekly?.win ?? "Weekly win condition unavailable."}
          </p>
        </div>
      </div>
    </section>
  );
}