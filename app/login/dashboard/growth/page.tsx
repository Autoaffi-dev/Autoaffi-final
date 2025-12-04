"use client";

import { useState } from "react";

// Types
type PlatformHeat = {
  name: string;
  posts: number;
  heat: number;
  note: string;
};

type WeeklyDay = {
  label: string;
  score: number; // 0–100
  status: "good" | "ok" | "bad";
  reason: string;
  posts: number;
};

type TopContent = {
  platform: string;
  title: string;
  metric: string;
  value: string;
  hint: string;
};

export default function GrowthHubPage() {
  // -------------------------------------
  // MOCK DATA
  // -------------------------------------

  const momentumScore = 72;

  const momentumBreakdown = [
    { label: "Posting frequency", value: 68 },
    { label: "Engagement trend", value: 74 },
    { label: "Platform mix & balance", value: 80 },
  ];

  const platformHeat: PlatformHeat[] = [
    {
      name: "TikTok",
      posts: 9,
      heat: 88,
      note: "Your hooks are outperforming your niche average.",
    },
    {
      name: "Instagram",
      posts: 6,
      heat: 74,
      note: "Reels show strong saves – educational angle works well.",
    },
    {
      name: "YouTube",
      posts: 2,
      heat: 61,
      note: "Retention strong, but volume is low.",
    },
    {
      name: "Facebook",
      posts: 3,
      heat: 52,
      note: "Groups respond well – focus on consistent posting.",
    },
  ];

  // WEEKLY TARGETS (Bar Chart)
  const weeklyTargets: WeeklyDay[] = [
    { label: "Mon", score: 82, status: "good", reason: "Hit posting floor", posts: 2 },
    { label: "Tue", score: 53, status: "ok", reason: "Posted once", posts: 1 },
    { label: "Wed", score: 30, status: "bad", reason: "No post published", posts: 0 },
    { label: "Thu", score: 44, status: "ok", reason: "Underperformed", posts: 1 },
    { label: "Fri", score: 90, status: "good", reason: "Strong saves", posts: 2 },
    { label: "Sat", score: 27, status: "bad", reason: "Low activity", posts: 0 },
    { label: "Sun", score: 39, status: "bad", reason: "Only Stories", posts: 0 },
  ];

  const topThisWeek: TopContent[] = [
    {
      platform: "TikTok",
      title: "“AI side hustle nobody talks about”",
      metric: "Views",
      value: "34.2k",
      hint: "Turn into mini-series with 3 variations.",
    },
    {
      platform: "Instagram",
      title: "Carousel: ‘3 rookie mistakes with funnels’",
      metric: "Saves",
      value: "412",
      hint: "Add CTA linking to funnel series.",
    },
    {
      platform: "YouTube",
      title: "“From 0 to first affiliate commission”",
      metric: "Watch time",
      value: "18.6h",
      hint: "Add timestamps & CTA in pinned comment.",
    },
  ];

  const viralAngles = [
    "Show your process: ‘Building my affiliate brand from scratch.’",
    "Break down a viral video and rebuild it in 30–60 sec.",
    "Post ‘before vs after’ versions of your offers.",
    "Document weekly growth instead of posting quotes.",
  ];

  // WEEKLY SMS TOGGLE
  const [weeklyEnabled, setWeeklyEnabled] = useState(false);
  const [phone, setPhone] = useState("");

  // -------------------------------------
  // UI HELPERS
  // -------------------------------------

  function momentumLabel(score: number) {
    if (score >= 80) return "Explosive";
    if (score >= 60) return "Building strong";
    if (score >= 40) return "Warming up";
    return "Needs ignition";
  }

  function barColor(status: WeeklyDay["status"]) {
    switch (status) {
      case "good":
        return "from-emerald-400 to-emerald-500 shadow-emerald-400/30";
      case "ok":
        return "from-yellow-300 to-yellow-400 shadow-yellow-400/30";
      case "bad":
        return "from-red-400 to-red-500 shadow-red-400/30";
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-slate-50 px-4 py-10">
      <div className="mx-auto max-w-6xl">
        {/* HEADER */}
        <header className="mb-10">
          <p className="text-xs tracking-[0.22em] uppercase text-slate-500">
            Growth Hub
          </p>

          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
            Growth Focus
          </h1>

          <p className="mt-2 text-slate-400 max-w-xl">
            Understand where your <span className="font-semibold text-yellow-300">momentum</span> comes from —
            and what to do next to grow faster across TikTok, Instagram, YouTube & more.
          </p>
        </header>

        {/* MAIN GRID */}
        <section className="grid gap-6 lg:grid-cols-[2.5fr_2fr_1.7fr] mb-14">
          {/* MOMENTUM SCORE */}
          <div className="rounded-2xl border border-yellow-500/30 bg-slate-900/70 p-5 shadow-xl">
            <h2 className="text-xs uppercase tracking-[0.26em] text-yellow-300 mb-3">
              Momentum Score
            </h2>

            <p className="text-4xl font-extrabold bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
              {momentumScore}
              <span className="text-sm text-slate-500 ml-2">/100</span>
            </p>

            <p className="text-xs text-slate-400 mt-1 mb-4">
              {momentumLabel(momentumScore)}
            </p>

            {/* BREAKDOWN */}
            <h3 className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">
              Why this score?
            </h3>

            <div className="space-y-2 mb-4">
              {momentumBreakdown.map((item, i) => (
                <div key={i} className="flex justify-between text-sm text-slate-300">
                  <span>{item.label}</span>
                  <span className="text-yellow-300 font-semibold">{item.value}/100</span>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-400">
              Your score blends <b>consistency</b>, <b>engagement curve</b> and <b>cross-platform performance</b>.
            </p>
          </div>

          {/* PLATFORM HEAT */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
            <h2 className="text-xs uppercase tracking-[0.26em] text-yellow-400 mb-3">
              Platform Heat
            </h2>

            <div className="space-y-3">
              {platformHeat.map((p) => (
                <div key={p.name} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="flex justify-between mb-1">
                    <div>
                      <p className="text-xs font-semibold">{p.name}</p>
                      <p className="text-[11px] text-slate-500">{p.posts} posts</p>
                    </div>
                    <p className="text-sm text-yellow-300 font-semibold">{p.heat}/100</p>
                  </div>

                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-yellow-400 via-amber-300 to-orange-500"
                      style={{ width: `${p.heat}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-slate-400 mt-2">{p.note}</p>
                </div>
              ))}
            </div>
          </div>

          {/* WEEKLY BAR CHART */}
          <div className="rounded-2xl border border-emerald-500/30 bg-slate-900/70 p-5 shadow-lg flex flex-col">
            <h2 className="text-xs uppercase tracking-[0.26em] text-emerald-300 mb-3">
              Weekly Posting Targets
            </h2>

            <p className="text-[11px] text-slate-400 mb-3">
              Aim for <span className="text-emerald-300 font-semibold">4+ green days</span> per week.
            </p>

            {/* BAR CHART */}
            <div className="flex items-end justify-between gap-3 h-48 mb-4">
              {weeklyTargets.map((d) => {
                const height = 20 + d.score * 1.2; // taller bars

                return (
                  <div key={d.label} className="flex flex-col items-center w-9 group">
                    <div
                      className={`
                        w-7 rounded-b-full shadow-lg
                        bg-gradient-to-b ${barColor(d.status)}
                        group-hover:brightness-125 transition-all
                      `}
                      style={{
                        height: `${height}px`,
                        minHeight: "30px",
                      }}
                      title={d.reason}
                    />

                    <span className="text-[10px] text-slate-400 mt-1">{d.label}</span>
                    <span className="text-[10px] text-slate-500">{d.posts}x</span>
                  </div>
                );
              })}
            </div>

            {/* LEGEND */}
            <div className="space-y-2 text-[11px] text-slate-400">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Green = hit posting floor
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-yellow-400" /> Yellow = posted but underperformed
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500" /> Red = no main content
              </div>
            </div>
          </div>
        </section>

        {/* SECOND ROW */}
        <section className="grid gap-6 lg:grid-cols-[2fr_1fr] mb-14">
          {/* LEFT SECTION */}
          <div className="space-y-6">
            {/* VIRAL ANGLES */}
            <div className="rounded-2xl border border-yellow-500/20 bg-slate-900/70 p-5 shadow">
              <h3 className="text-xs uppercase tracking-[0.26em] text-yellow-300 mb-3">
                Viral Angles to Try
              </h3>

              <ul className="space-y-2 text-sm text-slate-300">
                {viralAngles.map((v, i) => (
                  <li key={i}>• {v}</li>
                ))}
              </ul>
            </div>

            {/* TOP CONTENT */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow">
              <h3 className="text-xs uppercase tracking-[0.26em] text-yellow-400 mb-3">
                Top Content This Week
              </h3>

              <div className="space-y-3">
                {topThisWeek.map((item, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"
                  >
                    <p className="text-xs font-semibold">{item.platform}</p>
                    <p className="text-sm text-slate-200 mt-1">{item.title}</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {item.metric}:{" "}
                      <span className="text-slate-300 font-semibold">
                        {item.value}
                      </span>
                    </p>
                    <p className="text-[11px] text-yellow-300 mt-2">
                      {item.hint}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT SECTION = WEEKLY SMS + UPSSELL */}
          <div className="space-y-6">
            {/* WEEKLY SMS */}
            <div className="rounded-2xl border border-purple-500/30 bg-slate-900/70 p-5 shadow-lg">
              <h3 className="text-xs uppercase tracking-[0.28em] text-purple-300 mb-3">
                Weekly Growth Reports (Elite)
              </h3>

              <p className="text-sm text-slate-300 mb-3">
                Receive a <span className="text-purple-300 font-semibold">weekly SMS</span> with momentum updates,
                content windows and platform alerts.
              </p>

              {/* TOGGLE */}
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={() => setWeeklyEnabled(!weeklyEnabled)}
                  className={`relative inline-flex h-5 w-10 items-center rounded-full transition
                    ${weeklyEnabled ? "bg-purple-500" : "bg-slate-700"}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition
                      ${weeklyEnabled ? "translate-x-5" : "translate-x-1"}`}
                  />
                </button>

                <span className="text-sm text-slate-300">
                  Receive weekly SMS insights
                </span>
              </div>

              {weeklyEnabled && (
                <input
                  type="text"
                  placeholder="+46 …"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 p-2 text-sm focus:border-purple-400"
                />
              )}

              <p className="text-[11px] text-slate-500 mt-4">
                Elite members also unlock Trend Alerts, AI Posting Plan and platform-specific opportunities.
              </p>
            </div>

            {/* UPSSELL */}
            <div className="rounded-2xl border border-yellow-500/20 bg-slate-900/60 p-5">
              <h3 className="text-xs uppercase tracking-[0.26em] text-yellow-400 mb-2">
                Why Elite Users Grow Faster
              </h3>

              <ul className="space-y-2 text-sm text-slate-300">
                <li>• Weekly SMS coaching</li>
                <li>• Priority trend alerts</li>
                <li>• Automated posting windows</li>
                <li>• Personalized growth plan</li>
              </ul>

              <p className="mt-3 text-[11px] text-slate-500">
                Elite users grow on average 31–57% faster within 60 days.
              </p>
            </div>
          </div>
        </section>

        {/* AI COACH */}
        <section className="rounded-2xl border border-yellow-500/30 bg-slate-900/80 p-8 shadow-xl mb-20">
          <h2 className="text-xs uppercase tracking-[0.28em] text-yellow-300 mb-3">
            AI Growth Coach – Your Next Moves
          </h2>

          <ul className="space-y-4 text-sm text-slate-300">
            <li>
              <b className="text-yellow-300">1. Double down on TikTok</b> — replicate your top hook with two new variations.
            </li>

            <li>
              <b className="text-yellow-300">2. On Instagram</b> — add micro-CTAs to turn saves into profile visits.
            </li>

            <li>
              <b className="text-yellow-300">
                3. YouTube
              </b>{" "}
              — one more longform video could lift next week’s score by 18%.
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}