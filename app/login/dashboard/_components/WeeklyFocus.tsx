"use client";

import * as React from "react";

interface WeeklyFocusProps {
  creatorMode: "beginner" | "consistent" | "growth" | null;
  plan: "basic" | "pro" | "elite";
}

type PackType = "value" | "proof" | "offer";

type PackItem = {
  type: PackType;
  label: string;
  prompt: string; // customer copies into THEIR ChatGPT
  script: string; // paste into CapCut or use as VO script (15–25s)
  quickCaption?: string; // optional fallback caption (no ChatGPT)
  ctaHint: string;
};

function getISOWeekNumber(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date as any) - (yearStart as any)) / 86400000 + 1) / 7);
  return weekNo;
}

function rotate<T>(arr: T[], offset: number) {
  if (!arr.length) return arr;
  const idx = ((offset % arr.length) + arr.length) % arr.length;
  return [...arr.slice(idx), ...arr.slice(0, idx)];
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function getMix(creatorMode: "beginner" | "consistent" | "growth") {
  if (creatorMode === "beginner") {
    return {
      value: 70,
      proof: 20,
      offer: 10,
      why:
        "Algorithms reward VALUE (saves/shares/watch time) and PROOF (trust + comments/DMs). Keep OFFER low early so you don’t look spammy.",
      rule:
        "Rule: 1 Offer max per 7 days. Value & Proof still generate leads using DM/comment keywords.",
    };
  }
  if (creatorMode === "consistent") {
    return {
      value: 60,
      proof: 30,
      offer: 10,
      why:
        "You already post consistently. More PROOF increases conversion because people trust your process and take action faster.",
      rule:
        "Rule: 1–2 Offers per week max. Proof is your conversion engine.",
    };
  }
  return {
    value: 50,
    proof: 30,
    offer: 20,
    why:
      "You have momentum. Keep VALUE + PROOF to protect reach and trust, but increase OFFERS to drive revenue without killing the algorithm.",
    rule:
      "Rule: Never post 2 offers in a row. Insert Value/Proof between.",
  };
}

function promptHeader(theme: string, creatorMode: "beginner" | "consistent" | "growth") {
  const tone =
    creatorMode === "beginner"
      ? "simple, beginner-friendly, confidence-building, direct"
      : creatorMode === "consistent"
      ? "clear, slightly advanced, pattern-based, high engagement"
      : "direct-response, conversion-focused, still ethical, high clarity";

  return [
    "You are my elite short-form content writer AND creative director.",
    `Weekly theme: ${theme}`,
    `Tone: ${tone}`,
    "",
    "Hard rules:",
    "- Ethical only. No fake income claims. No hype. No 'get rich quick'.",
    "- Use simple words and short lines.",
    "- Optimize for SAVES, SHARES, COMMENTS and DMs.",
    "- Duration: 15–25 seconds.",
    "- Audience: people interested in extra income / online income.",
    "",
    "IMPORTANT: I need BOTH the written content AND the visual plan.",
    "",
    "Output EXACTLY in this structure (no extra talk):",
    "1) Post Type: VALUE / PROOF / OFFER",
    "2) Hook (1 line, max 9 words)",
    "3) On-screen text (3 lines, max 7 words each)",
    "4) Voiceover script (15–25s, short lines)",
    "5) Caption (max 2 lines)",
    "6) CTA keyword (comment or DM keyword)",
    "7) Hashtags (8–12)",
    "8) Visual plan (stock-friendly):",
    "   - 5 B-roll shot ideas (simple, realistic)",
    "   - 8 search keywords for Pexels/Pixabay/Videezy",
    "   - 1 recommended cover image idea (what it should show)",
    "",
  ].join("\n");
}

function build7DayPlan(creatorMode: "beginner" | "consistent" | "growth") {
  // Simple 1 post/day plan that respects the mix.
  // (We keep it stable; prompts + theme rotate weekly.)
  if (creatorMode === "beginner") {
    return [
      { day: "Mon", type: "value" as PackType, pick: 0 },
      { day: "Tue", type: "value" as PackType, pick: 1 },
      { day: "Wed", type: "proof" as PackType, pick: 0 },
      { day: "Thu", type: "value" as PackType, pick: 2 },
      { day: "Fri", type: "value" as PackType, pick: 0 },
      { day: "Sat", type: "offer" as PackType, pick: 0 },
      { day: "Sun", type: "proof" as PackType, pick: 1 },
    ];
  }

  if (creatorMode === "consistent") {
    return [
      { day: "Mon", type: "value" as PackType, pick: 0 },
      { day: "Tue", type: "proof" as PackType, pick: 0 },
      { day: "Wed", type: "value" as PackType, pick: 1 },
      { day: "Thu", type: "proof" as PackType, pick: 1 },
      { day: "Fri", type: "value" as PackType, pick: 2 },
      { day: "Sat", type: "offer" as PackType, pick: 0 },
      { day: "Sun", type: "proof" as PackType, pick: 2 },
    ];
  }

  // growth
  return [
    { day: "Mon", type: "value" as PackType, pick: 0 },
    { day: "Tue", type: "proof" as PackType, pick: 0 },
    { day: "Wed", type: "offer" as PackType, pick: 0 },
    { day: "Thu", type: "value" as PackType, pick: 1 },
    { day: "Fri", type: "proof" as PackType, pick: 1 },
    { day: "Sat", type: "offer" as PackType, pick: 1 },
    { day: "Sun", type: "value" as PackType, pick: 2 },
  ];
}

export default function WeeklyFocus({ creatorMode, plan }: WeeklyFocusProps) {
  if (!creatorMode) return null;

  const week = getISOWeekNumber(new Date());
  const weekLabel = `Week ${week}`;
  const mix = getMix(creatorMode);

  const content = {
    beginner: {
      title: "This Week’s Focus",
      tasks: [
        "Connect all your active social accounts.",
        "Add at least 2 affiliate offers so Autoaffi has something to work with.",
        "Post once daily for 7 days — build simple and steady momentum.",
      ],
      improvement:
        "Reduce friction. Keep it simple so you build confidence fast.",
    },
    consistent: {
      title: "Weekly Strategy",
      tasks: [
        "Post 2× daily across your main channel (if possible).",
        "Study your top 3 high-engagement posts and replicate the angles.",
        "Add 3 new content variations to test this week.",
      ],
      improvement:
        "Refine what already works. Double down on patterns driving growth.",
    },
    growth: {
      title: "Scaling Plan",
      tasks: [
        "Plan and launch a 7-day themed content campaign.",
        "Choose one recurring offer to push harder this week.",
        "Optimize your lead flow — link structure + CTAs + follow-up.",
      ],
      improvement:
        "Push EPC and automation. Small improvements compound fast at this stage.",
    },
  }[creatorMode];

  // Weekly theme rotation (no backend needed)
  const themes = rotate(
    [
      "Stop sounding salesy (still get leads)",
      "Turn views into DMs (simple keyword system)",
      "Proof that builds trust fast (without bragging)",
      "3 mistakes killing your reach (fix this week)",
      "Beginner-friendly recurring income setup",
      "Content that gets saves + shares (algorithm fuel)",
      "Simple 7-day momentum plan (no burnout)",
      "Offer positioning that converts ethically",
    ],
    week
  );
  const theme = themes[0];

  // How many pack items are visible per plan (keeps premium feel)
  const counts = {
    basic: { value: 2, proof: 2, offer: 1, quickCaptions: 1 },
    pro: { value: 3, proof: 3, offer: 2, quickCaptions: 2 },
    elite: { value: 4, proof: 3, offer: 3, quickCaptions: 2 },
  }[plan];

  const base = promptHeader(theme, creatorMode);

  // -------------------------
  // Pack templates (rotated weekly)
  // -------------------------
  const valueTemplates: PackItem[] = rotate(
    [
      {
        type: "value",
        label: "VALUE — Fix the #1 mistake (high saves)",
        prompt:
          base +
          "Create a VALUE post that teaches the #1 mistake people make when trying to get leads from content.\n" +
          "Make the fix simple (3 steps).\n" +
          "CTA keyword: PLAN (comment or DM).\n",
        script:
          "ON-SCREEN: “0 leads? Fix this.”\n\nVOICEOVER:\n" +
          "If you post daily and still get zero leads, it’s usually one thing.\n" +
          "You post offers too often.\n" +
          "Fix it with this weekly mix:\n" +
          "Value to build reach.\n" +
          "Proof to build trust.\n" +
          "Offer to convert.\n" +
          "Comment PLAN and I’ll send the 7-day setup.",
        quickCaption:
          "0 leads? Fix this: VALUE → PROOF → OFFER.\nComment “PLAN” and I’ll send the 7-day setup.",
        ctaHint: "CTA keyword: PLAN",
      },
      {
        type: "value",
        label: "VALUE — 3 rules that boost reach",
        prompt:
          base +
          "Create a VALUE post with 3 rules that boost reach.\n" +
          "Make it very easy to save and share.\n" +
          "CTA keyword: HOOKS.\n",
        script:
          "ON-SCREEN: “3 rules for more reach”\n\nVOICEOVER:\n" +
          "Want more reach?\nHere are 3 rules:\n" +
          "Keep it simple.\nMake it save-worthy.\nUse one clear CTA.\n" +
          "Comment HOOKS and I’ll send 10 hooks you can copy.",
        quickCaption:
          "3 reach rules: simple words, save-worthy points, one CTA.\nComment “HOOKS”.",
        ctaHint: "CTA keyword: HOOKS",
      },
      {
        type: "value",
        label: "VALUE — Checklist post (save magnet)",
        prompt:
          base +
          "Create a VALUE checklist post designed for SAVES.\n" +
          "Topic: a simple daily routine that creates leads.\n" +
          "CTA keyword: ROUTINE.\n",
        script:
          "ON-SCREEN: “Daily routine for leads”\n\nVOICEOVER:\n" +
          "Here’s a simple routine:\n" +
          "One value post.\nOne proof post.\nTen minutes replying.\n" +
          "Do it for 7 days.\n" +
          "Comment ROUTINE and I’ll send the exact schedule.",
        quickCaption:
          "Daily routine: Value post + Proof post + 10 min replies.\nComment “ROUTINE”.",
        ctaHint: "CTA keyword: ROUTINE",
      },
      {
        type: "value",
        label: "VALUE — Myth bust (share bait)",
        prompt:
          base +
          "Create a VALUE post that myth-busts a common belief about making extra income online.\n" +
          "Make it calm, credible, and shareable.\n" +
          "CTA keyword: PLAN.\n",
        script:
          "ON-SCREEN: “Most people get this wrong”\n\nVOICEOVER:\n" +
          "Most people think you need to be ‘salesy’ to make money online.\n" +
          "You don’t.\n" +
          "You need value that earns reach,\nproof that earns trust,\nand a simple offer.\n" +
          "Comment PLAN and I’ll send the structure.",
        quickCaption:
          "You don’t need to be salesy. You need: Value → Proof → Offer.\nComment “PLAN”.",
        ctaHint: "CTA keyword: PLAN",
      },
    ],
    week
  );

  const proofTemplates: PackItem[] = rotate(
    [
      {
        type: "proof",
        label: "PROOF — Process proof (trust builder)",
        prompt:
          base +
          "Create a PROOF post that shows process proof (not bragging).\n" +
          "Show your weekly system (Value/Proof/Offer) and why it works.\n" +
          "CTA keyword: TEMPLATE.\n",
        script:
          "ON-SCREEN: “My simple system”\n\nVOICEOVER:\n" +
          "I don’t rely on motivation.\nI rely on structure.\n" +
          "This is my weekly system:\nValue.\nProof.\nOffer.\nRepeat.\n" +
          "Comment TEMPLATE and I’ll send the exact format.",
        quickCaption:
          "My system: Value → Proof → Offer. Repeat.\nComment “TEMPLATE”.",
        ctaHint: "CTA keyword: TEMPLATE",
      },
      {
        type: "proof",
        label: "PROOF — Small wins (credible & human)",
        prompt:
          base +
          "Create a PROOF post about small wins compounding.\n" +
          "Make it relatable and realistic.\n" +
          "CTA keyword: PLAN.\n",
        script:
          "ON-SCREEN: “Small wins compound”\n\nVOICEOVER:\n" +
          "Big hype is useless.\nSmall wins compound.\n" +
          "This week I’m doing:\nOne value post daily,\nproof twice,\none offer,\n10 minutes replying.\n" +
          "Comment PLAN and I’ll send the weekly plan.",
        quickCaption:
          "Small wins > hype. Follow a weekly plan.\nComment “PLAN”.",
        ctaHint: "CTA keyword: PLAN",
      },
      {
        type: "proof",
        label: "PROOF — Template reveal (high comments)",
        prompt:
          base +
          "Create a PROOF post that reveals a content template.\n" +
          "Template: Hook → 3 points → CTA.\n" +
          "CTA keyword: TEMPLATE.\n",
        script:
          "ON-SCREEN: “Template I use”\n\nVOICEOVER:\n" +
          "Here’s my exact template:\nHook.\nThree points.\nCTA.\n" +
          "If you want 5 more templates, comment TEMPLATE.",
        quickCaption:
          "Template: Hook → 3 points → CTA.\nComment “TEMPLATE”.",
        ctaHint: "CTA keyword: TEMPLATE",
      },
    ],
    week + 1
  );

  const offerTemplates: PackItem[] = rotate(
    [
      {
        type: "offer",
        label: "OFFER — Plug-and-play pack (ethical)",
        prompt:
          base +
          "Create an OFFER post that is ethical and clear.\n" +
          "Offer: a plug-and-play weekly plan + scripts + captions.\n" +
          "CTA keyword: START.\n",
        script:
          "ON-SCREEN: “Want the pack?”\n\nVOICEOVER:\n" +
          "If you want plug-and-play so you can post today,\n" +
          "I’ll send you the weekly plan,\n15–25 second scripts,\nand captions.\n" +
          "Comment START and I’ll send it.",
        quickCaption:
          "Want the pack? Comment “START” and I’ll send weekly plan + scripts.",
        ctaHint: "CTA keyword: START",
      },
      {
        type: "offer",
        label: "OFFER — Recurring angle (predictable)",
        prompt:
          base +
          "Create an OFFER post that promotes recurring tools ethically.\n" +
          "Angle: predictable income > one-offs.\n" +
          "CTA keyword: RECURRING.\n",
        script:
          "ON-SCREEN: “Predictable > random”\n\nVOICEOVER:\n" +
          "If you want predictable income,\nfocus on recurring tools.\nNot random one-offs.\n" +
          "DM RECURRING and I’ll send my shortlist + plan.",
        quickCaption:
          "Predictable income = recurring tools.\nDM “RECURRING”.",
        ctaHint: "CTA keyword: RECURRING",
      },
      {
        type: "offer",
        label: "OFFER — DM keyword lead capture",
        prompt:
          base +
          "Create an OFFER post that drives DMs with one keyword.\n" +
          "Make it short, no hype.\n" +
          "CTA keyword: PLAN.\n",
        script:
          "ON-SCREEN: “DM me PLAN”\n\nVOICEOVER:\n" +
          "Want my exact weekly structure that turns content into leads?\n" +
          "DM me PLAN and I’ll send it.\n" +
          "Simple. No fluff.",
        quickCaption:
          "DM me “PLAN” and I’ll send the weekly structure that creates leads.",
        ctaHint: "CTA keyword: PLAN",
      },
    ],
    week + 2
  );

  const valuePack = valueTemplates.slice(0, counts.value);
  const proofPack = proofTemplates.slice(0, counts.proof);
  const offerPack = offerTemplates.slice(0, counts.offer);

  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [showQuick, setShowQuick] = React.useState(false);

  async function handleCopy(key: string, text: string) {
    const ok = await copyText(text);
    if (!ok) return;
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1200);
  }

  const capcutUrl = "https://www.capcut.com/tools/script-to-video-maker";

  const plan7 = build7DayPlan(creatorMode);

  function badge(type: PackType) {
    if (type === "value") return "bg-emerald-500/10 text-emerald-200 border-emerald-400/25";
    if (type === "proof") return "bg-sky-500/10 text-sky-200 border-sky-400/25";
    return "bg-amber-500/10 text-amber-200 border-amber-400/25";
  }

  function label(type: PackType) {
    if (type === "value") return "Value";
    if (type === "proof") return "Proof";
    return "Offer";
  }

  function getItemByType(type: PackType, pick: number) {
    const arr = type === "value" ? valuePack : type === "proof" ? proofPack : offerPack;
    if (!arr.length) return null;
    return arr[pick % arr.length];
  }

  function renderItem(item: PackItem, k: string, allowQuick: boolean) {
    return (
      <div className="rounded-lg border border-white/10 bg-slate-950/40 p-3">
        <p className="text-xs text-slate-200 font-medium">{item.label}</p>

        <div className="mt-2 flex flex-wrap gap-2">
          <button
            onClick={() => handleCopy(`${k}-prm`, item.prompt)}
            className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/10"
          >
            {copiedKey === `${k}-prm` ? "Copied ✓" : "Copy Prompt (ChatGPT)"}
          </button>

          <button
            onClick={() => handleCopy(`${k}-scr`, item.script)}
            className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/10"
          >
            {copiedKey === `${k}-scr` ? "Copied ✓" : "Copy Script (15–25s)"}
          </button>

          {allowQuick && item.quickCaption ? (
            <button
              onClick={() => handleCopy(`${k}-cap`, item.quickCaption!)}
              className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/10"
            >
              {copiedKey === `${k}-cap` ? "Copied ✓" : "Copy Quick Caption"}
            </button>
          ) : null}
        </div>

        <p className="mt-2 text-[11px] text-slate-400">{item.ctaHint}</p>
      </div>
    );
  }

  return (
    <section className="mb-8 rounded-xl border border-emerald-400/25 bg-slate-900/60 p-6 shadow-xl">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-xs uppercase tracking-widest text-emerald-300 mb-3">
          {content.title}
        </h3>
        <span className="text-[10px] text-slate-400">
          Updated weekly • {weekLabel}
        </span>
      </div>

      <ul className="mb-4 text-sm text-slate-300 space-y-2 leading-relaxed">
        {content.tasks.map((t) => (
          <li key={t}>• {t}</li>
        ))}
      </ul>

      <p className="text-xs text-slate-400 italic leading-relaxed">
        Tip:{" "}
        <span className="text-emerald-300 font-medium">{content.improvement}</span>
      </p>

      {/* MIX + WHY */}
      <div className="mt-5 rounded-xl border border-white/10 bg-slate-950/40 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-200">
              Content Mix (This is the winning formula)
            </p>
            <p className="text-[11px] text-slate-400">
              Value builds reach • Proof builds trust • Offer converts
            </p>
          </div>

          <div className="flex gap-2">
            <span className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-200">
              {mix.value}% Value
            </span>
            <span className="rounded-lg border border-sky-400/25 bg-sky-500/10 px-2.5 py-1 text-[11px] text-sky-200">
              {mix.proof}% Proof
            </span>
            <span className="rounded-lg border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-200">
              {mix.offer}% Offer
            </span>
          </div>
        </div>

        <p className="mt-3 text-[11px] text-slate-400 leading-relaxed">
          <span className="text-slate-200 font-medium">Why this works:</span>{" "}
          {mix.why}
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          {mix.rule}
        </p>
      </div>

      {/* 7-DAY PLAN */}
      <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/40 p-4">
        <p className="text-xs uppercase tracking-widest text-slate-200">
          7-Day Plan (Post 1× daily)
        </p>
        <p className="mt-1 text-[11px] text-slate-400">
          Use <span className="text-slate-200">Copy Prompt</span> for the best results. Use{" "}
          <span className="text-slate-200">Copy Script</span> for CapCut videos (15–25s).
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {plan7.map((p) => {
            const item = getItemByType(p.type, p.pick);
            return (
              <div key={p.day} className="rounded-lg border border-white/10 bg-slate-900/40 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-300 font-medium">{p.day}</span>
                  <span className={`rounded-md border px-2 py-0.5 text-[10px] ${badge(p.type)}`}>
                    {label(p.type)}
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  Use: <span className="text-slate-200">{item?.label ?? `${label(p.type)} post`}</span>
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* WEEKLY PROMPT PACK */}
      <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/40 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-200">
              Weekly Prompt Pack (Free)
            </p>
            <p className="text-[11px] text-slate-400">
              Theme: <span className="text-slate-200">{theme}</span> • Includes a visual plan (images/stock)
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href={capcutUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/15"
            >
              Open CapCut (free)
            </a>

            <button
              onClick={() => setShowQuick((v) => !v)}
              className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-slate-200 hover:bg-white/10"
            >
              {showQuick ? "Hide Quick Captions" : "Show Quick Captions"}
            </button>
          </div>
        </div>

        <div className="mt-3 text-[11px] text-slate-500">
          Workflow: Copy Prompt → paste into your ChatGPT → it outputs caption + script + hashtags +{" "}
          <span className="text-slate-300">visual plan</span>. For video: paste Script into CapCut (script-to-video).
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-slate-900/40 p-3">
            <p className="text-[11px] font-semibold text-emerald-200 uppercase tracking-widest">
              Value (Reach)
            </p>
            <div className="mt-2 space-y-3">
              {valuePack.map((item, i) =>
                renderItem(item, `v-${i}`, showQuick && i < counts.quickCaptions)
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-900/40 p-3">
            <p className="text-[11px] font-semibold text-sky-200 uppercase tracking-widest">
              Proof (Trust)
            </p>
            <div className="mt-2 space-y-3">
              {proofPack.map((item, i) =>
                renderItem(item, `p-${i}`, showQuick && i < counts.quickCaptions)
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-900/40 p-3">
            <p className="text-[11px] font-semibold text-amber-200 uppercase tracking-widest">
              Offer (Leads)
            </p>
            <div className="mt-2 space-y-3">
              {offerPack.map((item, i) =>
                renderItem(item, `o-${i}`, showQuick && i < 1)
              )}
            </div>

            <p className="mt-3 text-[11px] text-slate-400">
              Guardrail: Never post 2 offers in a row.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}