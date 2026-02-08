"use client";

import * as React from "react";

interface WeeklyFocusProps {
  creatorMode: "beginner" | "consistent" | "growth" | null;
  plan: "basic" | "pro" | "elite";
}

type PackType = "value" | "proof" | "offer";

type DailyPack = {
  type: PackType;
  label: string;
  caption: string; // UI copy-paste caption (ready to post)
  imagePrompt: string; // UI copy-paste image prompt
  capcutScript: string; // UI copy-paste script (15–25s)
  ctaHint: string; // e.g. "CTA keyword: PLAN"
  ctaKeyword: string; // e.g. "PLAN"
  offerHint?: string; // if offer day: Product Discovery guidance
};

function getISOWeekNumber(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date as any) - (yearStart as any)) / 86400000 + 1) / 7);
  return weekNo;
}

function getDayKey(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getDayOfWeekIndex(d = new Date()) {
  // Monday=0 ... Sunday=6
  const js = d.getDay(); // Sun=0
  return js === 0 ? 6 : js - 1;
}

function hashString(str: string) {
  // deterministic hash -> integer
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

/** Collapsible helpers (icon-only) */
function previewText(text: string, maxChars = 180) {
  const clean = (text ?? "").trim();
  if (clean.length <= maxChars) return clean;
  return clean.slice(0, maxChars).trimEnd() + "…";
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      className={`transition-transform ${open ? "rotate-180" : "rotate-0"}`}
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
    </svg>
  );
}

function IconButton({
  onClick,
  open,
  label,
}: {
  onClick: () => void;
  open: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/10"
    >
      <ChevronIcon open={open} />
    </button>
  );
}

function getMix(creatorMode: "beginner" | "consistent" | "growth") {
  if (creatorMode === "beginner") {
    return {
      value: 70,
      proof: 20,
      offer: 10,
      why:
        "Algorithms reward VALUE (saves/shares/watch time) and PROOF (trust + comments/DMs). Keep OFFER low early so you don’t look spammy.",
      rule: "Rule: 1 Offer max per 7 days. Value & Proof still generate leads using DM/comment keywords.",
    };
  }
  if (creatorMode === "consistent") {
    return {
      value: 60,
      proof: 30,
      offer: 10,
      why:
        "You already post consistently. More PROOF increases conversion because people trust your process and take action faster.",
      rule: "Rule: 1–2 Offers per week max. Proof is your conversion engine.",
    };
  }
  return {
    value: 50,
    proof: 30,
    offer: 20,
    why:
      "You have momentum. Keep VALUE + PROOF to protect reach and trust, but increase OFFERS to drive revenue without killing the algorithm.",
    rule: "Rule: Never post 2 offers in a row. Insert Value/Proof between.",
  };
}

function build7DayPlan(creatorMode: "beginner" | "consistent" | "growth") {
  // Monday..Sunday schedule (stable)
  if (creatorMode === "beginner") {
    return [
      { day: "Mon", type: "value" as PackType },
      { day: "Tue", type: "value" as PackType },
      { day: "Wed", type: "proof" as PackType },
      { day: "Thu", type: "value" as PackType },
      { day: "Fri", type: "value" as PackType },
      { day: "Sat", type: "offer" as PackType },
      { day: "Sun", type: "proof" as PackType },
    ];
  }

  if (creatorMode === "consistent") {
    return [
      { day: "Mon", type: "value" as PackType },
      { day: "Tue", type: "proof" as PackType },
      { day: "Wed", type: "value" as PackType },
      { day: "Thu", type: "proof" as PackType },
      { day: "Fri", type: "value" as PackType },
      { day: "Sat", type: "offer" as PackType },
      { day: "Sun", type: "proof" as PackType },
    ];
  }

  // growth
  return [
    { day: "Mon", type: "value" as PackType },
    { day: "Tue", type: "proof" as PackType },
    { day: "Wed", type: "offer" as PackType },
    { day: "Thu", type: "value" as PackType },
    { day: "Fri", type: "proof" as PackType },
    { day: "Sat", type: "offer" as PackType },
    { day: "Sun", type: "value" as PackType },
  ];
}

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

function getThemes() {
  return [
    "Stop sounding salesy (still get leads)",
    "Turn views into DMs (simple keyword system)",
    "Proof that builds trust fast (without bragging)",
    "3 mistakes killing your reach (fix this week)",
    "Beginner-friendly recurring income setup",
    "Content that gets saves + shares (algorithm fuel)",
    "Simple 7-day momentum plan (no burnout)",
    "Offer positioning that converts ethically",
  ];
}

function getOfferKeyword(seed: number) {
  const keywords = [
    "AI video editor",
    "CapCut templates",
    "productivity app",
    "website builder",
    "email marketing tool",
    "social media scheduler",
    "AI copywriting tool",
    "landing page builder",
  ];
  return keywords[seed % keywords.length];
}

/**
 * Weekly Focus engine:
 * - Rotates weekly (based on ISO week number)
 * - Returns 3 daily actions + win condition
 * - Scales by plan (Basic/Pro/Elite) and creatorMode
 */
function buildWeeklyBeastFocus(args: {
  creatorMode: "beginner" | "consistent" | "growth";
  plan: "basic" | "pro" | "elite";
}) {
  const { creatorMode, plan } = args;
  const week = getISOWeekNumber(new Date());
  const seed = hashString(`${week}__${creatorMode}__${plan}`);

  const themes = rotate(
    [
      {
        title: "DM Funnel Week (Turn views into conversations)",
        actions: [
          "Publish 1 piece of content daily (use Today’s Post).",
          "Pin ONE comment: “Comment KEYWORD and I’ll send it.”",
          "Reply to every comment/DM within 60 minutes (or same day).",
        ],
        win: "If you get 5+ DMs this week, you’re on track. DMs = conversions.",
      },
      {
        title: "Trust Week (Proof that converts without bragging)",
        actions: [
          "Post 2 PROOF pieces this week (process, screenshots, routine).",
          "Add a 1-line micro-proof in every caption (credible + calm).",
          "Ask 1 question in every caption to increase comments.",
        ],
        win: "If your comments increase, your reach and leads will rise automatically.",
      },
      {
        title: "Community Week (Algorithm boost + warm leads)",
        actions: [
          "Engage 10 minutes BEFORE posting (10 real comments).",
          "Engage 10 minutes AFTER posting (reply + comments).",
          "Join 1 community/thread per day (FB group / niche hashtags / LinkedIn).",
        ],
        win: "If you do pre/post engagement daily, you’ll see reach lift within 7–14 days.",
      },
      {
        title: "Offer Week (Ethical conversion, not spam)",
        actions: [
          "Use soft CTA: comment keyword → send link in DM (not in comments).",
          "Do not post offers 2 days in a row (Value/Proof between).",
          "Follow-up DM 24h later: “Want the next step?”",
        ],
        win: "If you get 2–5 “yes” replies on follow-up, your offer positioning is working.",
      },
      {
        title: "Clarity Week (Make your niche instantly obvious)",
        actions: [
          "Rewrite your bio to 1 clear promise + 1 CTA keyword.",
          "Repeat the same content angle for 3 days (consistency wins).",
          "Use the same on-screen text style (recognizable branding).",
        ],
        win: "If people instantly know what you do, conversion rises even with same views.",
      },
      {
        title: "Speed Week (Consistency without burnout)",
        actions: [
          "Batch 2 scripts today (save them for tomorrow).",
          "Reuse the same template style all week.",
          "Keep videos 15–25 seconds. Cut ruthlessly.",
        ],
        win: "If you can post daily without friction, you will outgrow most creators.",
      },
    ],
    seed
  );

  const chosen = themes[0];

  const proAddOns = ["Create 2 hook variations for each post (A/B test).", "Add a ‘pinned comment’ + ‘DM reply’ copy every day."];

  const eliteAddOns = [
    "Generate 3 hook angles + pick the best (curiosity / contrast / proof).",
    "Repurpose: 1 reel → 1 text post → 1 story prompt (same idea, different format).",
    "Objection handling: prep 3 replies (scam, time, price) and use them in DMs.",
  ];

  const addOns = plan === "elite" ? eliteAddOns : plan === "pro" ? proAddOns : [];

  const beginnerGuard = ["Keep CTA extremely simple: one keyword only.", "No external links in comments. Move link to DM."];

  const guardrails = creatorMode === "beginner" ? beginnerGuard : [];

  return { title: chosen.title, actions: chosen.actions, addOns, guardrails, win: chosen.win };
}

function buildDailyPack(args: {
  creatorMode: "beginner" | "consistent" | "growth";
  plan: "basic" | "pro" | "elite";
  dayKey: string;
}) {
  const { creatorMode, plan, dayKey } = args;

  const week = getISOWeekNumber(new Date());
  const themes = rotate(getThemes(), week);
  const theme = themes[0];

  const schedule = build7DayPlan(creatorMode);
  const dayIndex = getDayOfWeekIndex(new Date());
  const todayType = schedule[dayIndex]?.type ?? "value";

  const seed = hashString(`${dayKey}__${creatorMode}__${plan}__${theme}`);
  const offerSearch = getOfferKeyword(seed);

  const hooksValue = rotate(
    ["Most people post this wrong.", "If you want more reach, do this.", "This is why you get zero leads.", "Save this — it fixes your content.", "Stop doing this and watch what happens."],
    seed
  );

  const hooksProof = rotate(
    ["Here’s the exact structure I follow.", "I stopped guessing and used this system.", "This is the only thing I track daily.", "Proof beats hype every time.", "This is how I keep it simple."],
    seed + 7
  );

  const hooksOffer = rotate(
    ["Want the exact pack I use?", "If you want the link + the plan:", "DM me this keyword and I’ll send it.", "If you’re ready to start, do this:", "Here’s the cleanest way to begin:"],
    seed + 13
  );

  const ctaValue = rotate(["PLAN", "HOOKS", "ROUTINE", "GUIDE"], seed)[0];
  const ctaProof = rotate(["PROOF", "TEMPLATE", "STEPS", "SYSTEM"], seed)[0];
  const ctaOffer = rotate(["START", "LINK", "RECURRING", "PACK"], seed)[0];

  const reelsNote =
    plan === "elite"
      ? "Elite: turn this into a Reel using Autoaffi Reels Generator."
      : plan === "pro"
      ? "Pro: you can Reel this. Elite unlocks the strongest Reel workflows."
      : "Basic: you can post this. Pro/Elite unlock stronger Reel workflows.";

  if (todayType === "value") {
    const hook = hooksValue[0];
    return {
      type: "value" as PackType,
      label: "DAILY VALUE — Reach + saves (ready to post)",
      ctaHint: `CTA keyword: ${ctaValue}`,
      ctaKeyword: ctaValue,
      caption:
        `${hook}\n` +
        `Here’s the simple rule:\n` +
        `VALUE builds reach.\n` +
        `PROOF builds trust.\n` +
        `OFFER converts.\n\n` +
        `Comment "${ctaValue}" and I’ll send the exact daily plan.\n\n` +
        `#sidehustle #contentstrategy #makemoneyonline #socialmediatips #creator`,
      imagePrompt:
        `Create a scroll-stopping, minimal premium social post image.\n` +
        `Theme: "${theme}".\n` +
        `Visual: dark background, subtle gradient accents, bold headline text: "${hook}".\n` +
        `Include a 3-step visual stack: VALUE → PROOF → OFFER.\n` +
        `High contrast, clean layout, modern, realistic, not spammy.`,
      capcutScript:
        `0–3s (HOOK on screen): "${hook}"\n` +
        `3–12s (VALUE): "Post VALUE to get reach: 3 simple points people can save."\n` +
        `12–18s (STRUCTURE): "Then add PROOF to build trust. Only then offer."\n` +
        `18–25s (CTA): "Comment ${ctaValue} and I’ll send the daily plan."\n\n` +
        `ON-SCREEN TEXT:\n` +
        `1) VALUE builds reach\n` +
        `2) PROOF builds trust\n` +
        `3) OFFER converts\n` +
        `CTA: Comment "${ctaValue}"\n\n` +
        `NOTE: ${reelsNote}`,
    } satisfies DailyPack;
  }

  if (todayType === "proof") {
    const hook = hooksProof[0];
    return {
      type: "proof" as PackType,
      label: "DAILY PROOF — Trust builder (ready to post)",
      ctaHint: `CTA keyword: ${ctaProof}`,
      ctaKeyword: ctaProof,
      caption:
        `${hook}\n` +
        `I don’t rely on motivation.\n` +
        `I rely on structure.\n\n` +
        `My weekly mix:\n` +
        `• VALUE (reach)\n` +
        `• PROOF (trust)\n` +
        `• OFFER (convert)\n\n` +
        `Comment "${ctaProof}" and I’ll share the exact template.\n\n` +
        `#creator #contenttips #onlineincome #socialgrowth #affiliate`,
      imagePrompt:
        `Create a realistic “process proof” image.\n` +
        `Scene: desk/phone/laptop with a simple checklist overlay.\n` +
        `Overlay headline: "${hook}".\n` +
        `Checklist overlay:\n` +
        `- VALUE post\n` +
        `- PROOF post\n` +
        `- OFFER (max 1/7 days)\n` +
        `Premium dark style, modern, believable.`,
      capcutScript:
        `0–3s (HOOK on screen): "${hook}"\n` +
        `3–12s (PROOF): "This is the exact structure I follow every week."\n` +
        `12–18s (DETAIL): "Value gets reach. Proof gets trust. Offer converts."\n` +
        `18–25s (CTA): "Comment ${ctaProof} and I’ll send the template."\n\n` +
        `ON-SCREEN TEXT:\n` +
        `My weekly structure:\n` +
        `VALUE → PROOF → OFFER\n` +
        `CTA: Comment "${ctaProof}"\n\n` +
        `NOTE: ${reelsNote}`,
    } satisfies DailyPack;
  }

  // OFFER day
  const hook = hooksOffer[0];
  const isRecurringAngle = seed % 2 === 0;

  const offerHint = isRecurringAngle
    ? `Recurring mode today: Promote Autoaffi Recurring (or one of your active recurring platforms).`
    : `Product mode today: Go to Autoaffi → Product Discovery and search: "${offerSearch}". Generate your affiliate link, then use it in your CTA.`;

  const offerLine = isRecurringAngle
    ? `Recurring > random one-offs.\nToday: Autoaffi Recurring (or your active recurring platform).`
    : `Today’s product idea: "${offerSearch}".\nFind it in Autoaffi Product Discovery → generate your affiliate link.`;

  return {
    type: "offer" as PackType,
    label: "DAILY OFFER — Convert (ethical, ready to post)",
    ctaHint: `CTA keyword: ${ctaOffer}`,
    ctaKeyword: ctaOffer,
    offerHint,
    caption:
      `${hook}\n` +
      `${offerLine}\n\n` +
      `If you want the exact setup + link, DM "${ctaOffer}".\n` +
      `(Keep it ethical. No hype. Lead with value.)\n\n` +
      `#affiliate #onlineincome #sidehustle #contentcreator #marketing`,
    imagePrompt:
      `Create a premium offer-style image that does NOT look spammy.\n` +
      `Headline: "${hook}".\n` +
      `Subheadline (short): "${isRecurringAngle ? "Recurring income setup" : "High-demand product angle"}".\n` +
      `Style: modern dark UI, clean typography, subtle highlight accent.\n` +
      `No money stacks, no hype, no “get rich quick”.`,
    capcutScript:
      `0–3s (HOOK on screen): "${hook}"\n` +
      `3–12s (OFFER): "${isRecurringAngle ? "Recurring income is predictable. Here’s the simple setup." : `Here’s a high-demand angle: ${offerSearch}.`}"\n` +
      `12–18s (ACTION): "${isRecurringAngle ? "Use Autoaffi Recurring or your active platform." : `Search it in Autoaffi Product Discovery and generate your affiliate link.`}"\n` +
      `18–25s (CTA): "DM ${ctaOffer} and I’ll send the exact steps."\n\n` +
      `ON-SCREEN TEXT:\n` +
      `${isRecurringAngle ? "Recurring > random" : `Product angle: ${offerSearch}`}\n` +
      `CTA: DM "${ctaOffer}"`,
  } satisfies DailyPack;
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
    "3) One clear CTA only (keyword-based). Do NOT include raw affiliate link in public comments if platform-sensitive — push to DM.",
    "4) If today is OFFER and I have no link, you MUST instruct Autoaffi-first:",
    '   “Go to Autoaffi → Product Discovery and search: <exact keyword>. Generate your affiliate link there, then paste it here.”',
    '   OR “Use Autoaffi Recurring or one of your connected platforms.”',
    "5) Never look spammy. Lead with value/proof. Keep offers soft and helpful.",
    "",
    planBlock,
    "",
    "START (ASK IN ONE MESSAGE):",
    "Q1) Which Autoaffi plan are you on (Basic / Pro / Elite)?",
    "Q2) What platform today? (TikTok / Instagram Reels / YouTube Shorts / Facebook / LinkedIn)",
    "Q3) Choose format: Reel / Post / Carousel (if unsure choose Reel).",
    "Q4) What is your niche + target audience (1 sentence).",
    "Q5) What are you promoting today?",
    "    - Paste affiliate link OR say: NONE",
    "    - If recurring: say “RECURRING” + platform name (Autoaffi Recurring / connected platform).",
    "Q6) Choose today’s mode: VALUE / PROOF / OFFER (If I don’t choose, you decide based on a safe rotation: mostly VALUE).",
    "",
    "OUTPUT (YOU MUST DELIVER EXACTLY THESE SECTIONS, IN THIS ORDER):",
    "",
    "SECTION A) HOOK (1 line) + ANGLE",
    "- Provide hook(s) based on my plan rules, then choose the best one.",
    "- Also state the angle in 3 words: e.g., “Reach”, “Trust”, “Convert”.",
    "",
    "SECTION B) ON-SCREEN TEXT (3–6 beats)",
    "- Short lines, native to the platform, punchy.",
    "",
    "SECTION C) CAPTION (copy-paste ready)",
    "- Start with hook.",
    "- 3–6 short lines with clear structure.",
    "- Include one micro-proof line (without bragging).",
    "- End with ONE CTA keyword instruction.",
    "- Add 8–15 relevant hashtags.",
    "",
    "SECTION D) PINNED COMMENT (copy-paste)",
    "- One line that matches the CTA keyword.",
    "",
    "SECTION E) DM AUTO-REPLY (copy-paste)",
    "- If someone comments/DMs the keyword, this is the message you send.",
    "- Include: 1) friendly opener 2) quick value 3) ask a question 4) if OFFER day: send link and next step.",
    "",
    "SECTION F) FOLLOW-UP DM (24 hours later) (copy-paste)",
    "- Short, not needy. One question only.",
    "",
    "SECTION G) OBJECTION HANDLERS (copy-paste)",
    "- Provide 3 short replies:",
    '  1) “Is this a scam?”',
    '  2) “I don’t have time.”',
    '  3) “It’s too expensive.”',
    "",
    "SECTION H) IMAGE PROMPT (copy-paste)",
    "- Must match the post/reel angle.",
    "- Premium, realistic, scroll-stopping, not spammy.",
    "",
    "SECTION I) CAPCUT SCRIPT (15–25s) (copy-paste)",
    "- Timestamped: 0–3s hook, 3–15s value/proof/offer, 15–25s CTA.",
    "- Include voiceover + on-screen text + simple shot guidance.",
    "",
    "SECTION J) LINK PLACEMENT RULES (1–2 lines)",
    "- Tell me where to place the link today: bio / DM / pinned comment (platform appropriate).",
    "",
    "SECTION K) EXECUTION LOOP (10 minutes before + 10 minutes after)",
    "- Give me a mini checklist:",
    "  Before posting: comment on 10 niche posts (real comments).",
    "  After posting: reply fast, pin comment, DM keyword replies.",
    "",
    "FINISH (ALWAYS ASK THESE 2 QUESTIONS):",
    "1) “Want me to generate a matching image?”",
    '   If I say NO, ask: “Okay — what should the image be about/describe (1 sentence)?”',
    '2) “Want a reminder for tomorrow’s post? What time?”',
  ].join("\n");
}

/**
 * ✅ DM ROUTER (Next reply system)
 * Purpose: after user pastes the DM AUTO-REPLY, they need “what to answer next”
 * - Includes 7 common buyer replies -> exact copy-paste answers
 * - Offer vs non-offer variant
 * - Keeps it ethical + no hype
 */
function buildDmRouter(args: { type: PackType; keyword: string }) {
  const { type, keyword } = args;
  const isOffer = type === "offer";

  const header = isOffer
    ? `DM NEXT REPLY ROUTER (OFFER DAY) — Copy/Paste\n(Use these when they reply after your first DM.)`
    : `DM NEXT REPLY ROUTER (VALUE/PROOF DAY) — Copy/Paste\n(Use these when they reply after your first DM.)`;

  const route1 = [
    `1) If they say: "YES" / "Send it"`,
    `Reply:`,
    `Perfect 👌`,
    `Quick so I tailor it:`,
    `1) What platform are you posting on? (IG/TikTok/FB/YT)`,
    `2) Are you totally new to affiliate or have you tried before?`,
  ].join("\n");

  const route2 = [
    `2) If they ask: "What is this?" / "How does it work?"`,
    `Reply:`,
    `Short version: I use a simple daily content system that turns views into comments/DMs.`,
    `Then I send a step-by-step plan based on your niche so it feels natural (not salesy).`,
    `What’s your niche + goal in one sentence?`,
  ].join("\n");

  const route3 = [
    `3) If they ask: "Is this a scam?"`,
    `Reply:`,
    `Totally fair question. I don’t do hype or promises.`,
    `I share the exact steps + you decide if it’s for you.`,
    `Want the simple version (15–20 min/day) or the full version (30 min/day)?`,
  ].join("\n");

  const route4 = [
    `4) If they say: "I don’t have time"`,
    `Reply:`,
    `That’s exactly why this works — it’s built for short daily execution.`,
    `If you can do 15–20 min/day you can start.`,
    `Want the “ultra-minimal” plan (no overwhelm)?`,
  ].join("\n");

  const route5 = [
    `5) If they say: "I don’t have money" / "I’m broke"`,
    `Reply:`,
    `No stress. You can start free and just use the system + content plan.`,
    `Upgrade only when you see traction.`,
    `Do you want the free-start version first?`,
  ].join("\n");

  const route6 = [
    `6) If they ask: "How do you make money from it?"`,
    `Reply:`,
    `You earn when someone buys through your recommendation (affiliate).`,
    `We don’t spam links — we post value, people ask, then we help in DM.`,
    `Want an example of post → DM → next step?`,
  ].join("\n");

  const route7 = [
    `7) If they ghost / stop replying`,
    `Reply (48h later):`,
    `Quick check 👋 still want the plan?`,
    `If yes, reply “GO” and I’ll send the next step.`,
  ].join("\n");

  const offerClose = [
    `8) If they say: "Ok send me the link" (OFFER CLOSE)`,
    `Reply:`,
    `Perfect — here’s the link + next step 👇`,
    `1) Use the link and create your account`,
    `2) Reply “DONE” when you’re in — I’ll send Step 2 (setup)`,
    ``,
    `Important: don’t post raw links in public comments. Use keyword → DM.`,
  ].join("\n");

  const nonOfferBridge = [
    `8) If they say: "Nice, what do I post next?" (NEXT POST)`,
    `Reply:`,
    `Love it. Tomorrow we do the next piece in the sequence.`,
    `What’s your niche in one sentence, and what platform are you on?`,
    `I’ll tailor the next post angle for you.`,
  ].join("\n");

  const blocks = isOffer
    ? [header, route1, "", route2, "", route3, "", route4, "", route5, "", route6, "", route7, "", offerClose].join("\n")
    : [header, route1, "", route2, "", route3, "", route4, "", route5, "", route6, "", route7, "", nonOfferBridge].join("\n");

  const hint = isOffer
    ? `Router tip: qualify (platform + new/experienced) → send link only in DM → ask for “DONE”.`
    : `Router tip: ask niche + goal → tailor next post → keep CTA one keyword (${keyword}).`;

  return { blocks, hint };
}

function buildConversionAddOns(args: { type: PackType; keyword: string }) {
  const { type, keyword } = args;
  const isOffer = type === "offer";

  const pinnedComment = isOffer ? `DM "${keyword}" and I’ll send the exact setup + link.` : `Comment "${keyword}" and I’ll send the exact plan/template.`;

  const dmReply = isOffer
    ? [
        `Perfect — here’s the quick setup 👇`,
        ``,
        `1) I’ll send the steps + link in this chat.`,
        `2) Quick question so I tailor it: what platform are you posting on? (IG / TikTok / FB / YT)`,
        ``,
        `If you’re promoting a PRODUCT:`,
        `- Go to Autoaffi → Product Discovery and generate your affiliate link (then paste it here).`,
        `If you’re promoting RECURRING:`,
        `- Use Autoaffi Recurring (or your connected recurring platform).`,
        ``,
        `Want the “daily posting plan” too? Reply: YES`,
      ].join("\n")
    : [
        `Let’s go — here’s the exact plan 👇`,
        ``,
        `Step 1) Post today’s content (keep it short & clear).`,
        `Step 2) Pin the keyword comment.`,
        `Step 3) Reply fast for 60 minutes to boost reach.`,
        ``,
        `Quick question so I tailor the next post: what niche are you in (1 sentence)?`,
      ].join("\n");

  const followUp24h = isOffer
    ? `Quick one — do you want the next step (so you can start earning consistently), or should I keep it simple?`
    : `Quick check — did you post it? If yes, want a stronger hook version for tomorrow?`;

  const objections = [
    `“Is this a scam?” → Totally fair question. I don’t do hype. I send the exact steps + you can decide if it’s for you.`,
    `“I don’t have time.” → That’s why it’s 15–25 seconds + copy-paste. 20 minutes/day is enough to start.`,
    `“It’s too expensive.” → No worries. Start with the free plan + the system. Upgrade only when you see traction.`,
  ].join("\n");

  const linkPlacement = isOffer ? `Link placement: keep the link in DM (not public comments). Bio link is optional.` : `Link placement: no link needed today. Use keyword → DM.`;

  const executionChecklist = [
    `10 MIN BEFORE POST:`,
    `- Leave 10 real comments in your niche (no spam).`,
    `- Open your DMs (be ready to reply).`,
    ``,
    `10 MIN AFTER POST:`,
    `- Reply fast to comments (pin your keyword comment).`,
    `- Send DM reply to everyone who uses the keyword.`,
    `- Follow-up later if they reply (keep it helpful).`,
  ].join("\n");

  return { pinnedComment, dmReply, followUp24h, objections, linkPlacement, executionChecklist };
}

export default function WeeklyFocus({ creatorMode, plan }: WeeklyFocusProps) {
  if (!creatorMode) return null;

  const week = getISOWeekNumber(new Date());
  const weekLabel = `Week ${week}`;
  const mix = getMix(creatorMode);

  const dayKey = getDayKey(new Date());
  const daily = buildDailyPack({ creatorMode, plan, dayKey });

  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  // Collapsible open states (icon-only)
  const [openMap, setOpenMap] = React.useState<Record<string, boolean>>({});
  function isOpen(key: string) {
    return !!openMap[key];
  }
  function toggleOpen(key: string) {
    setOpenMap((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleCopy(key: string, text: string) {
    const ok = await copyText(text);
    if (!ok) return;
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1200);
  }

  const coachText = contentCoachBlueprintBeastV2(plan);

  const planNote =
    plan === "elite"
      ? "Elite: full conversion system (hooks + DM funnel + objections + repurpose)."
      : plan === "pro"
      ? "Pro: variations + follow-up scripts."
      : "Basic: one daily pack + simple conversion steps.";

  const weekly = buildWeeklyBeastFocus({ creatorMode, plan });

  // Today’s keyword MUST match today’s post
  const keyword = daily.ctaKeyword;

  // Conversion add-ons
  const addOns = buildConversionAddOns({ type: daily.type, keyword });

  // DM Router (next reply system)
  const dmRouter = buildDmRouter({ type: daily.type, keyword });

  // Fill weekly focus placeholders with real keyword
  const weeklyActions = weekly.actions.map((a) => a.replace("KEYWORD", keyword));

  return (
    <section className="mb-8 rounded-xl border border-emerald-400/25 bg-slate-900/60 p-6 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-xs uppercase tracking-widest text-emerald-300 mb-3">Daily Prompt Pack (Free)</h3>
        <span className="text-[10px] text-slate-400">
          New every day • {dayKey} • {weekLabel}
        </span>
      </div>

      <p className="text-[11px] text-slate-400 leading-relaxed -mt-1">
        One ready-to-post caption + image prompt + CapCut script (15–25s) — based on your{" "}
        <span className="text-slate-200 font-medium">Value / Proof / Offer</span> mix.{" "}
        <span className="text-emerald-300 font-medium">{planNote}</span>
      </p>

      {/* CONTENT MIX */}
      <div className="mt-5 rounded-xl border border-white/10 bg-slate-950/40 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-200">Content Mix (This is the winning formula)</p>
            <p className="text-[11px] text-slate-400">Value builds reach • Proof builds trust • Offer converts</p>
          </div>

          <div className="flex gap-2">
            <span className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-200">{mix.value}% Value</span>
            <span className="rounded-lg border border-sky-400/25 bg-sky-500/10 px-2.5 py-1 text-[11px] text-sky-200">{mix.proof}% Proof</span>
            <span className="rounded-lg border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-200">{mix.offer}% Offer</span>
          </div>
        </div>

        {/* WHY THIS WORKS */}
        <p className="mt-3 text-[11px] text-slate-400 leading-relaxed">
          <span className="text-slate-200 font-medium">Why this works:</span> {mix.why}
        </p>
        <p className="mt-1 text-[11px] text-slate-500">{mix.rule}</p>

        {/* DM/Comment keyword */}
        <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="text-[11px] uppercase tracking-widest text-slate-300">DM / Comment keyword (use this today)</p>
          <p className="mt-1 text-[12px] text-slate-200">
            Use keyword: <span className="font-semibold text-emerald-200">{keyword}</span>{" "}
            <span className="text-slate-400">(one keyword only)</span>
          </p>
        </div>

        {/* CONTENT COACH (ONE copy button) */}
        <div className="mt-4 rounded-xl border border-emerald-400/15 bg-emerald-500/5 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-200">
                Autoaffi Content Coach (BEAST v2) — Copy into ChatGPT
              </p>
              <p className="text-[11px] text-slate-400">
                Paste once → generate content + DM funnel + objections + follow-up + execution loop.
              </p>
            </div>

            <button
              onClick={() => handleCopy("coach", coachText)}
              className="inline-flex items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/15"
            >
              {copiedKey === "coach" ? "Copied ✓" : "Copy Blueprint"}
            </button>
          </div>
        </div>
      </div>

      {/* TODAY'S POST (3 columns) */}
      <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/40 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className={`rounded-md border px-2 py-0.5 text-[10px] ${badge(daily.type)}`}>{label(daily.type)}</span>
            <p className="text-xs uppercase tracking-widest text-slate-200">Today’s Post</p>
          </div>
          <p className="text-[11px] text-slate-400">{daily.ctaHint}</p>
        </div>

        {daily.offerHint ? (
          <div className="mt-3 rounded-lg border border-amber-400/15 bg-amber-500/5 p-3">
            <p className="text-[11px] text-amber-200 font-medium">Offer rule (Autoaffi-first)</p>
            <p className="text-[11px] text-slate-300 mt-1">{daily.offerHint}</p>
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {/* LEFT: Hook/Caption */}
          <div className="rounded-lg border border-white/10 bg-slate-900/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-200">Hook + Caption</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy("cap", daily.caption)}
                  className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/10"
                >
                  {copiedKey === "cap" ? "Copied ✓" : "Copy"}
                </button>
                <IconButton open={isOpen("cap")} onClick={() => toggleOpen("cap")} label={isOpen("cap") ? "Collapse" : "Expand"} />
              </div>
            </div>

            <pre
              className={`mt-2 whitespace-pre-wrap text-[12px] text-slate-200 leading-relaxed overflow-auto pr-1 ${
                isOpen("cap") ? "max-h-56" : "max-h-20"
              }`}
            >
              {isOpen("cap") ? daily.caption : previewText(daily.caption)}
            </pre>
          </div>

          {/* MIDDLE: Image prompt */}
          <div className="rounded-lg border border-white/10 bg-slate-900/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-200">Image Prompt</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy("img", daily.imagePrompt)}
                  className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/10"
                >
                  {copiedKey === "img" ? "Copied ✓" : "Copy"}
                </button>
                <IconButton open={isOpen("img")} onClick={() => toggleOpen("img")} label={isOpen("img") ? "Collapse" : "Expand"} />
              </div>
            </div>

            <pre
              className={`mt-2 whitespace-pre-wrap text-[12px] text-slate-200 leading-relaxed overflow-auto pr-1 ${
                isOpen("img") ? "max-h-56" : "max-h-20"
              }`}
            >
              {isOpen("img") ? daily.imagePrompt : previewText(daily.imagePrompt)}
            </pre>
          </div>

          {/* RIGHT: CapCut script */}
          <div className="rounded-lg border border-white/10 bg-slate-900/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-200">CapCut Script (15–25s)</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy("scr", daily.capcutScript)}
                  className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/10"
                >
                  {copiedKey === "scr" ? "Copied ✓" : "Copy"}
                </button>
                <IconButton open={isOpen("scr")} onClick={() => toggleOpen("scr")} label={isOpen("scr") ? "Collapse" : "Expand"} />
              </div>
            </div>

            <pre
              className={`mt-2 whitespace-pre-wrap text-[12px] text-slate-200 leading-relaxed overflow-auto pr-1 ${
                isOpen("scr") ? "max-h-56" : "max-h-20"
              }`}
            >
              {isOpen("scr") ? daily.capcutScript : previewText(daily.capcutScript)}
            </pre>
          </div>
        </div>

        {/* ✅ CONVERSION ADD-ONS */}
        <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/30 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-slate-400">Conversion Add-ons (Copy/Paste)</p>
              <p className="text-[11px] text-slate-400">
                This is what turns content into commissions (pinned comment → DM reply → follow-up).
              </p>
            </div>

            <button
              onClick={() =>
                handleCopy(
                  "all-conv",
                  [
                    `PINNED COMMENT:\n${addOns.pinnedComment}`,
                    ``,
                    `DM AUTO-REPLY:\n${addOns.dmReply}`,
                    ``,
                    `DM NEXT REPLY ROUTER:\n${dmRouter.blocks}`,
                    ``,
                    `FOLLOW-UP (24H):\n${addOns.followUp24h}`,
                    ``,
                    `OBJECTIONS:\n${addOns.objections}`,
                    ``,
                    `LINK PLACEMENT:\n${addOns.linkPlacement}`,
                    ``,
                    `EXECUTION CHECKLIST:\n${addOns.executionChecklist}`,
                  ].join("\n")
                )
              }
              className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-slate-200 hover:bg-white/10"
            >
              {copiedKey === "all-conv" ? "Copied ✓" : "Copy all"}
            </button>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {/* Pinned comment (Copy only) */}
            <div className="rounded-lg border border-white/10 bg-slate-900/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-200">Pinned comment</p>
                <button
                  onClick={() => handleCopy("pin", addOns.pinnedComment)}
                  className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/10"
                >
                  {copiedKey === "pin" ? "Copied ✓" : "Copy"}
                </button>
              </div>
              <pre className="mt-2 whitespace-pre-wrap text-[12px] text-slate-200 leading-relaxed">{addOns.pinnedComment}</pre>
            </div>

            {/* DM reply (Copy + expand icon) */}
            <div className="rounded-lg border border-white/10 bg-slate-900/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-200">DM reply</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy("dm", addOns.dmReply)}
                    className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/10"
                  >
                    {copiedKey === "dm" ? "Copied ✓" : "Copy"}
                  </button>
                  <IconButton open={isOpen("dm")} onClick={() => toggleOpen("dm")} label={isOpen("dm") ? "Collapse" : "Expand"} />
                </div>
              </div>

              <pre
                className={`mt-2 whitespace-pre-wrap text-[12px] text-slate-200 leading-relaxed overflow-auto pr-1 ${
                  isOpen("dm") ? "max-h-40" : "max-h-20"
                }`}
              >
                {isOpen("dm") ? addOns.dmReply : previewText(addOns.dmReply)}
              </pre>
            </div>

            {/* DM Router (Copy + expand icon) */}
            <div className="rounded-lg border border-white/10 bg-slate-900/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-200">DM Router (next replies)</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy("router", dmRouter.blocks)}
                    className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/10"
                  >
                    {copiedKey === "router" ? "Copied ✓" : "Copy"}
                  </button>
                  <IconButton
                    open={isOpen("router")}
                    onClick={() => toggleOpen("router")}
                    label={isOpen("router") ? "Collapse" : "Expand"}
                  />
                </div>
              </div>

              <p className="mt-2 text-[11px] text-slate-400">{dmRouter.hint}</p>

              <pre
                className={`mt-2 whitespace-pre-wrap text-[12px] text-slate-200 leading-relaxed overflow-auto pr-1 ${
                  isOpen("router") ? "max-h-40" : "max-h-20"
                }`}
              >
                {isOpen("router") ? dmRouter.blocks : previewText(dmRouter.blocks)}
              </pre>
            </div>
          </div>

          {/* Follow-up + checklist (NO buttons) */}
          <div className="mt-3 rounded-lg border border-white/10 bg-slate-900/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-200">Follow-up + Checklist</p>
            </div>

            <p className="mt-2 text-[11px] text-slate-400">Follow-up (24h):</p>
            <pre className="mt-1 whitespace-pre-wrap text-[12px] text-slate-200 leading-relaxed">{addOns.followUp24h}</pre>

            <p className="mt-3 text-[11px] text-slate-400">Execution checklist:</p>
            <pre className="mt-1 whitespace-pre-wrap text-[12px] text-slate-200 leading-relaxed max-h-28 overflow-auto pr-1">
              {addOns.executionChecklist}
            </pre>
          </div>

          {/* Objections + Link placement */}
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-white/10 bg-slate-900/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-200">Objection handlers</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Short copy-paste replies for common objections (scam / time / price). Use in DM to keep it calm and helpful.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy("obj", addOns.objections)}
                    className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/10"
                  >
                    {copiedKey === "obj" ? "Copied ✓" : "Copy"}
                  </button>
                  <IconButton open={isOpen("obj")} onClick={() => toggleOpen("obj")} label={isOpen("obj") ? "Collapse" : "Expand"} />
                </div>
              </div>

              <pre
                className={`mt-2 whitespace-pre-wrap text-[12px] text-slate-200 leading-relaxed overflow-auto pr-1 ${
                  isOpen("obj") ? "max-h-32" : "max-h-20"
                }`}
              >
                {isOpen("obj") ? addOns.objections : previewText(addOns.objections)}
              </pre>
            </div>

            <div className="rounded-lg border border-white/10 bg-slate-900/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-200">Link placement</p>
                <button
                  onClick={() => handleCopy("link", addOns.linkPlacement)}
                  className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/10"
                >
                  {copiedKey === "link" ? "Copied ✓" : "Copy"}
                </button>
              </div>
              <pre className="mt-2 whitespace-pre-wrap text-[12px] text-slate-200 leading-relaxed">{addOns.linkPlacement}</pre>
            </div>
          </div>
        </div>
      </div>

      {/* THIS WEEK'S FOCUS (rotates weekly) */}
      <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/30 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-slate-400">This week’s focus (BEAST)</p>
            <p className="mt-1 text-[12px] text-slate-200 font-semibold">{weekly.title}</p>
          </div>
          <span className="text-[10px] text-slate-500">Rotates weekly • {weekLabel}</span>
        </div>

        <p className="mt-2 text-[12px] text-slate-300 leading-relaxed">
          Do these actions daily. This is the fastest way to improve reach, trust, and conversions.
        </p>

        <ul className="mt-3 space-y-2 text-[12px] text-slate-200">
          {weeklyActions.map((a, i) => (
            <li key={`${a}-${i}`} className="flex gap-2">
              <span className="text-emerald-300">{i + 1})</span>
              <span>{a}</span>
            </li>
          ))}
        </ul>

        {weekly.addOns.length ? (
          <div className="mt-3 rounded-lg border border-sky-400/15 bg-sky-500/5 p-3">
            <p className="text-[11px] text-sky-200 font-medium uppercase tracking-widest">Plan boosters ({plan.toUpperCase()})</p>
            <ul className="mt-2 space-y-1 text-[12px] text-slate-200">
              {weekly.addOns.map((x, i) => (
                <li key={`${x}-${i}`} className="flex gap-2">
                  <span className="text-sky-300">•</span>
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {weekly.guardrails.length ? (
          <div className="mt-3 rounded-lg border border-amber-400/15 bg-amber-500/5 p-3">
            <p className="text-[11px] text-amber-200 font-medium uppercase tracking-widest">Guardrails (Beginner)</p>
            <ul className="mt-2 space-y-1 text-[12px] text-slate-200">
              {weekly.guardrails.map((x, i) => (
                <li key={`${x}-${i}`} className="flex gap-2">
                  <span className="text-amber-300">•</span>
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-3 rounded-lg border border-emerald-400/15 bg-emerald-500/5 p-3">
          <p className="text-[11px] text-emerald-200 font-medium">Weekly win condition</p>
          <p className="mt-1 text-[12px] text-slate-200">{weekly.win}</p>
        </div>
      </div>
    </section>
  );
}