"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

type PlatformKey =
  | "syllaby"
  | "submagic"
  | "simplified"
  | "fliki"
  | "dfirst"
  | "tubemagic"
  | "systeme"
  | "clickfunnels"
  | "minea"
  | "justcall"
  | "heygen";

type PlatformState = {
  key: PlatformKey;
  active: boolean;
  tracking_code: string | null;
  promo_link: string | null;
};

type PlatformDef = {
  key: PlatformKey;
  name: string;
  category: string;
  commission: string;
  recurringBadge: "Lifetime" | "12 months" | "Recurring";
  group: "lifetime" | "limited" | "business";
  recommended?: boolean;
  summary: string;
  bestFor: string;
  recommendedOn: string;
  bestAngle: string;
};

const AUTOAFFI_OFFER_HREF = "/login/dashboard/recurring-autoaffi";

const PLATFORM_DEFS: PlatformDef[] = [
  {
    key: "systeme",
    name: "Systeme.io",
    category: "Funnels / Email / Courses",
    commission: "Recurring",
    recurringBadge: "Lifetime",
    group: "lifetime",
    recommended: true,
    summary:
      "A beginner-friendly all-in-one platform for funnels, email marketing and digital products.",
    bestFor:
      "Beginners building funnels, lead capture, offers and email lists.",
    recommendedOn: "YouTube, funnels, email, beginner business content",
    bestAngle:
      "Promote it as the easiest all-in-one business starter platform.",
  },
  {
    key: "submagic",
    name: "Submagic",
    category: "Creator / Video",
    commission: "30% recurring (for life)",
    recurringBadge: "Lifetime",
    group: "lifetime",
    recommended: true,
    summary:
      "A very easy-to-sell short-form video tool focused on captions, hooks and retention.",
    bestFor:
      "Reels creators, TikTok creators, faceless video accounts and coaches.",
    recommendedOn: "Instagram Reels, TikTok, YouTube Shorts",
    bestAngle:
      "Show how much faster and more engaging short-form videos become with better captions.",
  },
  {
    key: "fliki",
    name: "Fliki",
    category: "AI Video",
    commission: "30% on all payments",
    recurringBadge: "Lifetime",
    group: "lifetime",
    recommended: true,
    summary:
      "An AI text-to-video platform that is simple to understand and attractive for a broad B2C audience.",
    bestFor:
      "Private individuals, side hustlers, faceless content and beginner creators.",
    recommendedOn: "YouTube Shorts, Instagram Reels, TikTok",
    bestAngle:
      "Promote it as a fast way to turn ideas into videos without editing skills.",
  },
  {
    key: "minea",
    name: "Minea",
    category: "Ecom / Ads Intelligence",
    commission: "30% recurring (for life)",
    recurringBadge: "Lifetime",
    group: "lifetime",
    summary:
      "A strong e-commerce research tool focused on winning products, ads and market intelligence.",
    bestFor:
      "Ecom users, dropshipping, ad research and side hustle opportunities.",
    recommendedOn: "YouTube, TikTok, ecom communities, ad strategy content",
    bestAngle:
      "Position it as the shortcut to finding winning products and ad angles faster.",
  },
  {
    key: "syllaby",
    name: "Syllaby",
    category: "Creator / AI Content",
    commission: "30% recurring",
    recurringBadge: "Recurring",
    group: "limited",
    recommended: true,
    summary:
      "A creator-focused content engine that helps users generate ideas, scripts and short-form content faster.",
    bestFor:
      "Creators, beginners, short-form content, consistency and social growth.",
    recommendedOn: "Instagram Reels, TikTok, YouTube Shorts",
    bestAngle:
      "Promote it as the tool that removes creator block and gives instant content ideas.",
  },
  {
    key: "simplified",
    name: "Simplified",
    category: "AI Content Suite",
    commission: "20% recurring",
    recurringBadge: "Recurring",
    group: "limited",
    summary:
      "An all-in-one AI content suite for posts, visuals and social media workflows.",
    bestFor:
      "Users who want one platform for content, graphics and productivity.",
    recommendedOn: "Instagram, Facebook, Pinterest, content workflows",
    bestAngle: "Sell the convenience: one tool for multiple content needs.",
  },
  {
    key: "dfirst",
    name: "DFIRST",
    category: "AI Marketing Agent",
    commission: "30% on paid customers",
    recurringBadge: "Recurring",
    group: "limited",
    summary:
      "A business-growth oriented AI marketing platform with a stronger pro/business angle.",
    bestFor:
      "Marketers, ambitious creators, small businesses and growth-focused users.",
    recommendedOn: "LinkedIn, email, landing pages, blog content",
    bestAngle:
      "Position it as an AI growth assistant for people who want smarter marketing output.",
  },
  {
    key: "tubemagic",
    name: "TubeMagic",
    category: "YouTube / Faceless",
    commission: "50% commission",
    recurringBadge: "Recurring",
    group: "limited",
    recommended: true,
    summary:
      "A YouTube-focused AI platform designed for scripts, ideas and channel growth.",
    bestFor:
      "YouTube creators, faceless channels, automation content and long-form growth.",
    recommendedOn: "YouTube, YouTube Shorts",
    bestAngle:
      "Promote it as the growth tool for faceless YouTube and script automation.",
  },
  {
    key: "clickfunnels",
    name: "ClickFunnels",
    category: "Funnels / Pro",
    commission: "Recurring",
    recurringBadge: "Recurring",
    group: "limited",
    summary:
      "A more advanced funnel platform for serious builders who want a proven sales infrastructure.",
    bestFor:
      "Coaches, advanced creators, funnel builders and higher-ticket offers.",
    recommendedOn: "YouTube, email, landing pages, business content",
    bestAngle:
      "Sell it as the serious funnel upgrade once someone wants to scale harder.",
  },
  {
    key: "heygen",
    name: "HeyGen",
    category: "AI Avatars / Video",
    commission: "20% recurring",
    recurringBadge: "12 months",
    group: "limited",
    summary:
      "A highly attractive AI avatar video platform with strong visual appeal and premium brand recognition.",
    bestFor:
      "Creators, marketers, businesses and users interested in avatar-based video.",
    recommendedOn: "LinkedIn, YouTube, demos, AI business content",
    bestAngle:
      "Show impressive AI avatar demos and let the visual wow factor sell it.",
  },
  {
    key: "justcall",
    name: "JustCall",
    category: "B2B Sales / Calling",
    commission: "20% recurring",
    recurringBadge: "Recurring",
    group: "business",
    summary:
      "A B2B communication and calling platform that adds credibility and business depth to the stack.",
    bestFor: "Small businesses, agencies, sales teams and B2B workflows.",
    recommendedOn: "LinkedIn, B2B outreach, agency content",
    bestAngle:
      "Promote it as the communication layer for teams that want more serious sales operations.",
  },
];

function copyToClipboard(text: string) {
  try {
    navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  }
}

function sortPlatforms(
  defs: PlatformDef[],
  states: Record<PlatformKey, PlatformState>
) {
  return [...defs].sort((a, b) => {
    const aActive = states[a.key]?.active ? 1 : 0;
    const bActive = states[b.key]?.active ? 1 : 0;

    if (aActive !== bActive) return bActive - aActive;

    const aRecommended = a.recommended ? 1 : 0;
    const bRecommended = b.recommended ? 1 : 0;
    if (aRecommended !== bRecommended) return bRecommended - aRecommended;

    return a.name.localeCompare(b.name);
  });
}

function PlatformSection({
  title,
  subtitle,
  platforms,
  states,
  loading,
  busy,
  onToggle,
  onCopy,
  toastSetter,
}: {
  title: string;
  subtitle: string;
  platforms: PlatformDef[];
  states: Record<PlatformKey, PlatformState>;
  loading: boolean;
  busy: PlatformKey | null;
  onToggle: (platform: PlatformKey, nextActive: boolean) => Promise<void>;
  onCopy: (text: string) => void;
  toastSetter: (text: string | null) => void;
}) {
  if (!platforms.length) return null;

  return (
    <section className="mb-8">
      <div className="mb-4">
        <h2 className="text-lg md:text-xl font-bold text-slate-50">{title}</h2>
        <p className="mt-1 text-[12px] text-slate-400">{subtitle}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {platforms.map((p) => {
          const st = states[p.key];
          const active = !!st?.active;
          const promo = st?.promo_link ?? "";

          return (
            <section
              key={p.key}
              className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-4 md:p-5 shadow-[0_18px_50px_rgba(0,0,0,0.7)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base md:text-lg font-semibold text-slate-50">
                      {p.name}
                    </h3>

                    {p.recommended && (
                      <span className="inline-flex rounded-full border border-yellow-400/60 bg-yellow-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-yellow-200">
                        Recommended
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-[11px] text-slate-400">
                    {p.category} •{" "}
                    <span className="font-semibold text-slate-200">
                      {p.commission}
                    </span>
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                        active
                          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-100"
                          : "border-slate-700 bg-slate-900/60 text-slate-300"
                      }`}
                    >
                      {active ? "Active" : "Inactive"}
                    </span>

                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                        p.recurringBadge === "Lifetime"
                          ? "border-yellow-400/50 bg-yellow-400/10 text-yellow-200"
                          : p.recurringBadge === "12 months"
                          ? "border-sky-400/50 bg-sky-400/10 text-sky-200"
                          : "border-slate-700 bg-slate-900/60 text-slate-200"
                      }`}
                    >
                      {p.recurringBadge}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (busy === p.key || loading) return;
                    void onToggle(p.key, !active);
                  }}
                  disabled={busy === p.key || loading}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                    active
                      ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
                      : "bg-slate-700"
                  } ${
                    busy === p.key || loading
                      ? "opacity-60 cursor-not-allowed"
                      : ""
                  }`}
                  aria-pressed={active}
                  aria-label={`${active ? "Deactivate" : "Activate"} ${p.name}`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                      active ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              <div className="mt-4 space-y-2">
                <p className="text-[12px] text-slate-300">{p.summary}</p>

                <p className="text-[11px] text-slate-400">
                  <span className="font-semibold text-yellow-300">
                    Best for:
                  </span>{" "}
                  {p.bestFor}
                </p>

                <p className="text-[11px] text-slate-400">
                  <span className="font-semibold text-yellow-300">
                    Recommended on:
                  </span>{" "}
                  {p.recommendedOn}
                </p>

                <p className="text-[11px] text-slate-400">
                  <span className="font-semibold text-yellow-300">
                    Best angle:
                  </span>{" "}
                  {p.bestAngle}
                </p>
              </div>

              {active && (
                <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Promo link
                  </p>

                  <div className="mt-2 flex flex-col gap-2">
                    <input
                      value={promo || "Generating link..."}
                      readOnly
                      className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-[12px] text-slate-50"
                    />

                    {!promo && (
                      <p className="text-[10px] text-yellow-300">
                        Link is being generated...
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!promo) return;
                          onCopy(promo);
                          toastSetter("Copied.");
                          setTimeout(() => toastSetter(null), 900);
                        }}
                        disabled={!promo}
                        className="rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 px-3 py-1.5 text-[11px] font-semibold text-slate-900 shadow-md hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition"
                      >
                        Copy link
                      </button>

                      <a
                        href={promo || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                          promo
                            ? "border-slate-700 bg-slate-900/50 text-slate-100 hover:bg-slate-900"
                            : "border-slate-800 bg-slate-950/60 text-slate-600 pointer-events-none"
                        }`}
                      >
                        Open ↗
                      </a>
                    </div>

                    <p className="text-[10px] text-slate-500">
                      Autoaffi generates your tracking automatically. No manual
                      Sub-ID editing needed.
                    </p>
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </section>
  );
}

export default function RecurringBeastPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<PlatformKey | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [states, setStates] = useState<Record<PlatformKey, PlatformState>>(
    {} as Record<PlatformKey, PlatformState>
  );

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/recurring/platforms", {
          cache: "no-store",
        });
        const json = await res.json();
        setStates(json?.platforms ?? {});
      } catch (e) {
        console.error("Recurring GET failed:", e);
        setToast("Could not load recurring platforms.");
        setTimeout(() => setToast(null), 2200);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleToggle(platform: PlatformKey, nextActive: boolean) {
    try {
      setBusy(platform);
      setToast(null);

      const res = await fetch("/api/recurring/platforms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          platform,
          active: nextActive,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        console.error("Recurring update failed:", json);
        throw new Error(json?.error || "Could not update platform.");
      }

      setStates((prev) => ({
        ...prev,
        [platform]: json.platform,
      }));

      setToast(nextActive ? "Activated. Link generated." : "Deactivated.");
      setTimeout(() => setToast(null), 1600);
    } catch (e: any) {
      console.error("Recurring toggle failed:", e);
      setToast(e?.message || "Could not update. Please try again.");
      setTimeout(() => setToast(null), 2400);
    } finally {
      setBusy(null);
    }
  }

  const lifetimePlatforms = useMemo(
    () =>
      sortPlatforms(
        PLATFORM_DEFS.filter((p) => p.group === "lifetime"),
        states
      ),
    [states]
  );

  const limitedPlatforms = useMemo(
    () =>
      sortPlatforms(
        PLATFORM_DEFS.filter((p) => p.group === "limited"),
        states
      ),
    [states]
  );

  const businessPlatforms = useMemo(
    () =>
      sortPlatforms(
        PLATFORM_DEFS.filter((p) => p.group === "business"),
        states
      ),
    [states]
  );

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="mb-8"
        >
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            Recurring Income
          </p>

          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Recurring commission stack:{" "}
            <span className="bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
              Lifetime + 12 months
            </span>
          </h1>

          <p className="mt-2 max-w-3xl text-sm md:text-[15px] text-slate-300">
            This card gives you ready-to-promote recurring offers. Just switch a
            platform to{" "}
            <span className="font-semibold text-yellow-300">Active</span> and
            Autoaffi will generate your tracking automatically so you can start
            promoting instantly.
          </p>

          <p className="mt-3 max-w-3xl text-sm md:text-[14px] font-medium text-yellow-300">
            Don&apos;t forget to also use and promote{" "}
            <Link
              href={AUTOAFFI_OFFER_HREF}
              className="underline decoration-yellow-400/70 underline-offset-4 hover:text-yellow-200"
            >
              Autoaffi&apos;s own platform
            </Link>
            . Autoaffi can be promoted both online and offline, which makes it a
            unique extra income stream on top of the recurring tools below.
          </p>

          {toast && (
            <div className="mt-4 inline-flex items-center rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-[11px] text-yellow-200">
              {toast}
            </div>
          )}
        </motion.header>

        <PlatformSection
          title="Lifetime recurring"
          subtitle="These are your strongest long-term recurring offers."
          platforms={lifetimePlatforms}
          states={states}
          loading={loading}
          busy={busy}
          onToggle={handleToggle}
          onCopy={copyToClipboard}
          toastSetter={setToast}
        />

        <PlatformSection
          title="12 months + standard recurring"
          subtitle="Strong bonus offers and recurring tools that still fit your stack very well."
          platforms={limitedPlatforms}
          states={states}
          loading={loading}
          busy={busy}
          onToggle={handleToggle}
          onCopy={copyToClipboard}
          toastSetter={setToast}
        />

        <PlatformSection
          title="Business / bonus"
          subtitle="Extra credibility and stronger B2B options for selected users."
          platforms={businessPlatforms}
          states={states}
          loading={loading}
          busy={busy}
          onToggle={handleToggle}
          onCopy={copyToClipboard}
          toastSetter={setToast}
        />
      </div>
    </main>
  );
}
