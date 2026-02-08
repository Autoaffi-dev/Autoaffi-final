"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

// CORE UI
import SectionBlock from "./_components/SectionBlock";
import DashboardCard from "./_components/DashboardCard";
import DashboardHeader from "./_components/DashboardHeader";
import MiniNav from "./_components/MiniNav";

// A6 POWER COMPONENTS
import WeeklyFocus from "./_components/WeeklyFocus";
import AtAGlance from "./_components/AtAGlance";
import GrowthPlan from "./_components/GrowthPlan";
import PlanStrip from "./_components/PlanStrip";
import ConsistencyText from "./_components/ConsistencyText";

// ONBOARDING
import OnboardingOverlay from "./_components/OnboardingOverlay";
import OnboardingFlow from "./_components/OnboardingFlow";
import AISpeech from "./_components/AISpeech";
import SpotlightHighlight from "./_components/SpotlightHighlight";

// TYPES
type Plan = "basic" | "pro" | "elite";
export type CreatorMode = "beginner" | "consistent" | "growth" | null;

export type TourStage =
  | "off"
  | "welcome"
  | "path"
  | "persona"
  | "spotlight"
  | "final-steps"
  | "complete";

// SPOTLIGHT → ORDERED SECTION LIST
const SPOTLIGHT_TARGETS: string[] = [
  "dashboard-core-setup",
  "dashboard-content-offers",
  "dashboard-recurring",
  "dashboard-audience-growth",
  "dashboard-data-learning",
  "dashboard-system",
];

// ✅ Onboarding persistence keys
type OnboardingPersist = { stage: TourStage; startedAt: number };
const LS_ONBOARDING_STATE = "autoaffi_onboarding_state";
const LS_ONBOARDING_BOOTED = "autoaffi_onboarding_booted";

// ✅ NEW: persist “spoken stages” so Samantha doesn’t repeat after navigation/back
const LS_ONBOARDING_SPOKEN = "autoaffi_onboarding_spoken_v1";

function getStageMessage(stage: TourStage) {
  if (stage === "welcome") {
    return "Welcome to Autoaffi — your second home on the internet. From today, everything you do for affiliate growth has one place to live. I’ll walk you through the basics and give you your first win fast.";
  }
  if (stage === "persona") {
    return "First — choose your creator style. This decides how I guide you inside the dashboard, what I prioritize, and how fast we move.";
  }
  if (stage === "path") {
    return "Next — choose your starting path. This decides what we focus on first, and how much structure you get in the beginning.";
  }
  if (stage === "final-steps") {
    return "Before we begin, I want to show you your first three steps. These steps give you momentum and help you get results faster. Let’s take your first three steps together.";
  }
  if (stage === "spotlight") {
    return "Advanced tour starting. First stop: Core Setup — connect socials and offers so Autoaffi can power everything else.";
  }
  return "";
}

function safeReadSpoken(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LS_ONBOARDING_SPOKEN);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function safeWriteSpoken(next: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_ONBOARDING_SPOKEN, JSON.stringify(next));
  } catch {}
}

function markSpoken(stage: TourStage) {
  const map = safeReadSpoken();
  map[`stage::${stage}`] = true;
  safeWriteSpoken(map);
}

function hasSpoken(stage: TourStage) {
  const map = safeReadSpoken();
  return !!map[`stage::${stage}`];
}

function clearSpoken() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LS_ONBOARDING_SPOKEN);
  } catch {}
}

export default function DashboardPage({ searchParams }: any) {
  const router = useRouter();
  const { status } = useSession();

  // ✅ StrictMode-safe: one-shot boot guard
  const bootOnceRef = useRef(false);

  // ✅ timeout cleanup refs
  const tHeroRef = useRef<number | null>(null);
  const tWelcomeRef = useRef<number | null>(null);
  const tFinalScrollRef = useRef<number | null>(null);
  const tSpotlightRef = useRef<number | null>(null);

  const [booted, setBooted] = useState(false);

  // ✅ Speech engine state (deterministic)
  const [speechKey, setSpeechKey] = useState<string>("init");
  const [speaking, setSpeaking] = useState(false);

  const [aiMessage, setAiMessage] = useState<string>("");

  // ✅ block any speech during navigation clicks (Step 1/2/3)
  const suppressSpeechRef = useRef(false);

  // Next.js fix: ensure searchParams is NOT a Promise
  const resolvedParams =
    searchParams && typeof searchParams === "object" && !("then" in searchParams)
      ? searchParams
      : {};

  const planFromUrl = resolvedParams.plan;

  const activePlan: Plan =
    planFromUrl === "pro" || planFromUrl === "elite" || planFromUrl === "basic"
      ? (planFromUrl as Plan)
      : "basic";

  // STATE
  const [creatorMode, setCreatorMode] = useState<CreatorMode>(null);
  const [tourStage, setTourStage] = useState<TourStage>("off");
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [tourCompleted, setTourCompleted] = useState(false);
  const [heroIntro, setHeroIntro] = useState(false);

  const [beginnerUntil, setBeginnerUntil] = useState<number | null>(null);
  const [startStepsCompleted, setStartStepsCompleted] = useState(0);

  const [showRecommendations, setShowRecommendations] = useState(false);

  // Tour 2 done flag
  const [advancedTourDone, setAdvancedTourDone] = useState(false);

  const beginnerHoursLeft = useMemo(() => {
    return beginnerUntil !== null
      ? Math.max(1, Math.ceil((beginnerUntil - Date.now()) / (60 * 60 * 1000)))
      : null;
  }, [beginnerUntil]);

  function hardStopSpeech() {
    setSpeaking(false);
    try {
      window.speechSynthesis?.cancel();
    } catch {}
  }

  /**
   * ✅ AUTH GUARD
   */
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }

    const onPageShow = async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const data = await res.json();
        if (!data?.user) router.replace("/login");
      } catch {
        router.replace("/login");
      }
    };

    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [status, router]);

  /**
   * ✅ speak() = ONLY way to trigger voice
   * - cancels old speech inside AISpeech
   * - forces fresh run via speechKey
   */
  function speak(text: string) {
    if (!text) return;
    if (suppressSpeechRef.current) return;

    setAiMessage(text);
    setSpeaking(true);
    setSpeechKey(`${Date.now()}_${Math.random().toString(16).slice(2)}`);
  }

  /**
   * ✅ BOOT / LOAD FROM LOCALSTORAGE (StrictMode-safe)
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (bootOnceRef.current) return;
    bootOnceRef.current = true;

    const cleanup = () => {
      if (tHeroRef.current) clearTimeout(tHeroRef.current);
      if (tWelcomeRef.current) clearTimeout(tWelcomeRef.current);
      if (tFinalScrollRef.current) clearTimeout(tFinalScrollRef.current);
      if (tSpotlightRef.current) clearTimeout(tSpotlightRef.current);
    };

    const storedMode = localStorage.getItem("autoaffi_creator_mode") as CreatorMode | null;
    const storedSteps = localStorage.getItem("autoaffi_start_steps");
    const storedBeginner = localStorage.getItem("autoaffi_beginner_until");
    const storedTour = localStorage.getItem("autoaffi_tour_done");
    const storedTour2 = localStorage.getItem("autoaffi_tour2_done");

    if (storedMode) setCreatorMode(storedMode);
    if (storedSteps) setStartStepsCompleted(parseInt(storedSteps, 10));
    if (storedBeginner) setBeginnerUntil(parseInt(storedBeginner, 10));
    if (storedTour2 === "1") setAdvancedTourDone(true);

    // HERO fade-in (one-shot)
    tHeroRef.current = window.setTimeout(() => setHeroIntro(true), 150);

    // TOUR 1 COMPLETED
    if (storedTour === "1") {
      setTourCompleted(true);
      setShowRecommendations(true);
      setTourStage("off");
      setBooted(true);
      return cleanup;
    }

    // ✅ RESUME
    const persistedRaw = localStorage.getItem(LS_ONBOARDING_STATE);
    if (persistedRaw) {
      try {
        const persisted = JSON.parse(persistedRaw) as OnboardingPersist;
        if (persisted?.stage && persisted.stage !== "off" && persisted.stage !== "complete") {
          setTourStage(persisted.stage);
          setAiMessage(getStageMessage(persisted.stage));
          setBooted(true);
          return cleanup;
        }
      } catch {
        // ignore
      }
    }

    // ✅ START welcome ONLY ONCE
    const bootedFlag = localStorage.getItem(LS_ONBOARDING_BOOTED);
    if (!bootedFlag) {
      // ✅ new onboarding run => clear spoken history
      clearSpoken();

      localStorage.setItem(LS_ONBOARDING_BOOTED, "1");

      const nextState: OnboardingPersist = { stage: "welcome", startedAt: Date.now() };
      localStorage.setItem(LS_ONBOARDING_STATE, JSON.stringify(nextState));

      setTourStage("welcome");
      setAiMessage(getStageMessage("welcome"));

      tWelcomeRef.current = window.setTimeout(() => {
        setBooted(true);
      }, 50);

      return cleanup;
    }

    setBooted(true);
    return cleanup;
  }, []);

  /**
   * ✅ Persist tourStage
   */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedTour = window.localStorage.getItem("autoaffi_tour_done");
    if (storedTour === "1") {
      window.localStorage.removeItem(LS_ONBOARDING_STATE);
      return;
    }

    window.localStorage.setItem(
      LS_ONBOARDING_STATE,
      JSON.stringify({ stage: tourStage, startedAt: Date.now() } as OnboardingPersist)
    );
  }, [tourStage]);

  // STEP PROGRESSION TRACKER
  function markStepCompleted(step: number) {
    setStartStepsCompleted((prev) => {
      const next = step > prev ? step : prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("autoaffi_start_steps", String(next));
      }
      return next;
    });
  }

  // FINISH ONBOARDING – (Tour 1 done)
  function finishOnboarding() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("autoaffi_tour_done", "1");
      window.localStorage.removeItem(LS_ONBOARDING_STATE);
    }

    setTourCompleted(true);
    setTourStage("complete");
    setShowRecommendations(true);

    speak(
      "You’re in. Your dashboard is ready. Start with the first 3 steps to build momentum fast — and remember… you are not alone. You’re part of the Autoaffi family now."
    );
  }

  // PERSONA CHOICE
  function choosePersona(mode: CreatorMode) {
    setCreatorMode(mode);

    if (typeof window !== "undefined" && mode) {
      window.localStorage.setItem("autoaffi_creator_mode", mode);
    }

    if (mode === "beginner") {
      const until = Date.now() + 48 * 60 * 60 * 1000;
      setBeginnerUntil(until);

      if (typeof window !== "undefined") {
        window.localStorage.setItem("autoaffi_beginner_until", String(until));
      }

      speak(
        "Beginner mode enabled. For the next 48 hours I’ll push you with extra guidance and fast wins — starting with your first 3 steps."
      );
    }

    if (mode === "consistent") {
      speak("Consistency mode selected. We’ll use your posting patterns to drive smarter recommendations.");
    }

    if (mode === "growth") {
      speak("Growth mode activated. Time to scale what already works — recurring offers, funnels and higher EPC.");
    }

    setSpotlightIndex(0);
  }

  // START ADVANCED TOUR (Tour 2)
  function startAdvancedTour() {
  if (typeof window === "undefined") return;

  // ✅ reset so Tour 2 can always be started
  try {
    window.localStorage.removeItem("autoaffi_tour2_done");
  } catch {}

  setAdvancedTourDone(false);
  setSpotlightIndex(0);
  setTourStage("spotlight");

  speak(getStageMessage("spotlight"));

  window.setTimeout(() => {
    const el = document.getElementById(SPOTLIGHT_TARGETS[0]);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 80);
}

  /**
   * ✅ Stage intro speech (ONE TIME per onboarding run, persisted)
   * Fixar:
   * - path blir aldrig tyst
   * - “final-steps” pratas INTE om igen efter att du gått Step 1 -> tillbaka
   */
  const lastStageRef = useRef<TourStage>("off");
  useEffect(() => {
    if (!booted) return;

    const speakStages: TourStage[] = ["welcome", "persona", "path", "final-steps"];
    if (!speakStages.includes(tourStage)) return;

    // only react on actual stage change
    if (lastStageRef.current === tourStage) return;
    lastStageRef.current = tourStage;

    // already spoken in this onboarding run? then do nothing
    if (hasSpoken(tourStage)) return;

    const msg = getStageMessage(tourStage);
    if (!msg) return;

    // cancel anything else and speak immediately (fix path silence)
    hardStopSpeech();
    window.setTimeout(() => {
      hardStopSpeech();
      speak(msg);
      markSpoken(tourStage);
    }, 80);
  }, [booted, tourStage]);

  // FINAL 3-STEP INTRO (Tour 1)
  useEffect(() => {
    if (tourStage !== "final-steps") return;

    if (tFinalScrollRef.current) clearTimeout(tFinalScrollRef.current);

    tFinalScrollRef.current = window.setTimeout(() => {
      const el = document.getElementById("start-steps-anchor");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);

    return () => {
      if (tFinalScrollRef.current) clearTimeout(tFinalScrollRef.current);
    };
  }, [tourStage]);

  // SECTION AUTOSCROLL + SPEECH WHEN SPOTLIGHT CHANGES (Tour 2)
  useEffect(() => {
    if (tourStage !== "spotlight") return;

    if (tSpotlightRef.current) clearTimeout(tSpotlightRef.current);

    if (spotlightIndex === SPOTLIGHT_TARGETS.length) {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("autoaffi_tour2_done", "1");
      }
      setAdvancedTourDone(true);
      setTourStage("off");
      hardStopSpeech();
      speak("Advanced tour completed. You can now explore freely — you know exactly where everything lives.");
      return;
    }

    const messages = [
      "First stop: Core Setup. Connect your socials and add your key offers so Autoaffi understands your world. Once this foundation is in place, everything else becomes easier.",
      "Next up: Content & Offers — the heart of your creator workflow. This is where your products turn into posts, reels, captions and campaigns.",
      "Now we move into Recurring Income & Funnels. This is how creators build stability and freedom — month after month.",
      "Here we have Audience & Growth. Trends, angles and engagement patterns so you never post in the dark.",
      "Next is Data, Leads & Learning. Your performance center — warm leads, analytics and insights together.",
      "Finally: System & Account. Settings, payouts and integrations. When this is clean, everything runs smoother and faster.",
    ];

    hardStopSpeech();
    speak(messages[spotlightIndex] ?? "Scrolling through the important areas of your dashboard.");

    const id = SPOTLIGHT_TARGETS[spotlightIndex];
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });

    const durations = [22000, 17000, 17000, 17000, 17000, 17000];

    tSpotlightRef.current = window.setTimeout(() => {
      setSpotlightIndex((prev) => prev + 1);
    }, durations[spotlightIndex] ?? 17000);

    return () => {
      if (tSpotlightRef.current) clearTimeout(tSpotlightRef.current);
    };
  }, [tourStage, spotlightIndex]);

  // SECTION JUMP
  function scrollToId(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const showCreatorMeta = creatorMode !== null;

  // ONBOARDING FLOW CONTROLLER
  const flow = OnboardingFlow({
    stage: tourStage,
    setTourStage: (s) => setTourStage(s as TourStage),
    choosePersona,
    creatorMode,
    spotlightIndex,
    setSpotlightIndex: (n) => setSpotlightIndex(n),
    finishOnboarding,
    setAiMessage: speak, // ✅ IMPORTANT: all stage prompts go through speak()
    startAdvancedTour,
  });

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      {/* HEADER */}
      <DashboardHeader heroIntro={heroIntro} />

      {/* ✅ AI VOICE (AUDIO ONLY) */}
      {booted && ["welcome", "persona", "path", "spotlight", "final-steps", "complete"].includes(tourStage) && (
        <AISpeech text={aiMessage} play={speaking} speechKey={speechKey} onDone={() => setSpeaking(false)} />
      )}

      {/* AI OVERLAY */}
      <OnboardingOverlay
        stage={tourStage}
        aiMessage={aiMessage} // ✅ always show message in the SAME modal (no dubbelruta)
        handleWelcomeContinue={flow.handleWelcomeContinue}
        handlePersonaSelect={flow.handlePersonaSelect}
        handlePathSelect={flow.handlePathSelect}
        onSkip={() => {
          setCreatorMode("beginner");

          const until = Date.now() + 48 * 60 * 60 * 1000;

          if (typeof window !== "undefined") {
            window.localStorage.setItem("autoaffi_tour_done", "1");
            window.localStorage.setItem("autoaffi_creator_mode", "beginner");
            window.localStorage.setItem("autoaffi_beginner_until", String(until));
            window.localStorage.removeItem(LS_ONBOARDING_STATE);
          }

          setBeginnerUntil(until);
          setStartStepsCompleted(0);

          setTourCompleted(true);
          setShowRecommendations(true);
          setTourStage("off");

          // stop speech and also prevent repeats later
          hardStopSpeech();
          clearSpoken();
        }}
      />

      {/* SPOTLIGHT HIGHLIGHT */}
      {tourStage === "spotlight" && (
  <SpotlightHighlight
    stage={tourStage}
    spotlightIndex={spotlightIndex}
    spotlightTargets={SPOTLIGHT_TARGETS}
    aiMessage={aiMessage}
    onNext={() => setSpotlightIndex((prev) => prev + 1)}
  />
)}

      {/* PLAN STRIP */}
      <PlanStrip plan={activePlan} beginnerHoursLeft={beginnerHoursLeft} />

      {/* CONSISTENCY TEXT */}
      <ConsistencyText creatorMode={creatorMode} plan={activePlan} />

      {/* MINI NAV */}
      <MiniNav onJump={scrollToId} />

      {/* ✅ AT A GLANCE */}
      {showCreatorMeta && <AtAGlance socials={1} offers={2} recurring={0} postsToday={0} steps={startStepsCompleted} />}

      {/* WEEKLY FOCUS */}
      <WeeklyFocus creatorMode={creatorMode} plan={activePlan} />

      {/* GROWTH PLAN */}
{creatorMode && (
  <GrowthPlan
    creatorMode={creatorMode}
    startStepsCompleted={startStepsCompleted}
    markStepCompleted={markStepCompleted}
    // ✅ FIX: Tour 2 ska synas även när du är i "final-steps" (det är då Growth Plan visas)
    showContinueTour={!advancedTourDone && (tourStage === "off" || tourStage === "final-steps")}
    onContinueTour={startAdvancedTour}
    onStepNavigate={(step) => {
      // ✅ CRITICAL: prevent ANY re-speak when clicking Step 1/2/3 and navigating away/back
      suppressSpeechRef.current = true;
      hardStopSpeech();

      // ✅ also mark final-steps as “already spoken” so it won't repeat when returning
      markSpoken("final-steps");

      // release after short time (in case you cancel navigation)
      window.setTimeout(() => {
        suppressSpeechRef.current = false;
      }, 2000);

      if (step === 1) window.location.href = "/login/dashboard/social-accounts";
      if (step === 2) window.location.href = "/login/dashboard/affiliate";
      if (step === 3) window.location.href = "/login/dashboard/content-optimizer/posts";
    }}
  />
)}

      {/* MAIN WRAPPER */}
      <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        {/* ===== DIN UI UNDER HÄR: ORÖRD ===== */}

        {/* CORE SETUP */}
        <SectionBlock
          id="dashboard-core-setup"
          title="Core Setup"
          subtitle="Your foundation. Connect accounts, offers & essential data."
          highlighted={startStepsCompleted >= 1}
        >
          <div className="grid gap-4 md:grid-cols-3">
            <DashboardCard
              plan={activePlan}
              minPlan="basic"
              title="Social Accounts"
              badge="Start"
              href="/login/dashboard/social-accounts"
              description="Connect TikTok, Instagram, YouTube & Facebook."
              points={["Improves AI accuracy", "Unlocks analytics", "Prepares for auto-posting"]}
            />

            <DashboardCard
              plan={activePlan}
              minPlan="basic"
              title="Affiliate Offers"
              badge="Core"
              href="/login/dashboard/affiliate"
              description="Save your links & recurring programs."
              points={["Better targeting", "Optimized Content AI", "Organized funnels"]}
            />

            <DashboardCard
              plan={activePlan}
              minPlan="basic"
              title="Autoaffi AI Coach"
              badge="AI Coach"
              href="/login/dashboard/ai-coach"
              description="Your personal 60-day execution coach powered by Autoaffi & ChatGPT."
              points={[
                "Daily execution guidance",
                "Personalized to your offers & funnels",
                "Calls out inconsistency",
                "Built for real results — not motivation",
              ]}
            />
          </div>
        </SectionBlock>

        {/* CONTENT & OFFERS */}
        <SectionBlock id="dashboard-content-offers" title="Content & Offers" subtitle="Turn your offers into high-performing content.">
          <div className="grid gap-4 md:grid-cols-3">
            <DashboardCard
              plan={activePlan}
              minPlan="basic"
              title="Posts Generator"
              badge="AI + Links"
              href="/login/dashboard/content-optimizer/posts"
              description="Hooks, captions, formatting & SEO in one."
              points={["Hooks + captions", "SEO formatting", "Auto-linked offers"]}
            />

            <DashboardCard
              plan={activePlan}
              minPlan="basic"
              title="Reels & Shorts"
              badge="AI Video"
              href="/login/dashboard/content-optimizer/reels"
              description="Scripts for TikTok, Reels & Shorts."
              points={["Hook + script", "CTA builder", "Consistent offers"]}
            />

            <DashboardCard
              plan={activePlan}
              minPlan="pro"
              title="Campaigns"
              badge="Pro"
              href="/login/dashboard/campaigns"
              description="Organize themed multi-day campaigns."
              points={["Attach offers", "Track performance", "Future: auto sequences"]}
            />
          </div>
        </SectionBlock>

        {/* RECURRING INCOME & FUNNELS */}
        <SectionBlock id="dashboard-recurring" title="Recurring Income & Funnels" subtitle="Build long-term predictable affiliate income.">
          <div className="grid gap-4 md:grid-cols-3">
            <DashboardCard
              plan={activePlan}
              minPlan="basic"
              title="Autoaffi Recurring"
              badge="Lifetime 50%"
              href="/login/dashboard/recurring-autoaffi"
              description="Lifetime recurring commissions."
              points={["Perfect backend offer", "Works in any niche", "High retention"]}
            />

            <DashboardCard
              plan={activePlan}
              minPlan="basic"
              title="Recurring AI Stack"
              badge="AI Tools"
              href="/login/dashboard/recurring-income-platforms"
              description="Top SaaS tools for monthly commissions."
              points={["High LTV tools", "Creator-friendly", "Easy to promote"]}
            />

            <DashboardCard
              plan={activePlan}
              minPlan="pro"
              title="Funnel Builders"
              badge="Funnels"
              href="/login/dashboard/funnel-builders"
              description="Connect your main funnel — used everywhere."
              points={["OLSP / HBA / CF", "Backend protection", "Future: auto routing"]}
            />
          </div>
        </SectionBlock>

        {/* AUDIENCE & GROWTH */}
        <SectionBlock id="dashboard-audience-growth" title="Audience & Growth" subtitle="Find trends, angles & niche opportunities.">
          <div className="grid gap-4 md:grid-cols-3">
            <DashboardCard
              plan={activePlan}
              minPlan="basic"
              title="Growth Hub"
              badge="Insights"
              href="/login/dashboard/growth"
              description="Daily & weekly niche insights."
              points={["Heatmaps", "Momentum score", "Trend tracking"]}
            />

            <DashboardCard
              plan={activePlan}
              minPlan="pro"
              title="Smart Suggestions"
              badge="Pro"
              href="/login/dashboard/smart-suggestions"
              description="Find high-quality communities that match your niche."
              points={["Engagement patterns", "High relevance", "Zero spam"]}
            />

            <DashboardCard
              plan={activePlan}
              minPlan="pro"
              title="Viral Heads-Up"
              badge="Trends"
              href="/login/dashboard/viral-heads-up"
              description="Spot upcoming viral angles early."
              points={["Compare creators", "Trend signals", "Future: AI hook recommendations"]}
            />
          </div>
        </SectionBlock>

        {/* DATA / LEADS / LEARNING */}
        <SectionBlock id="dashboard-data-learning" title="Data, Leads & Learning" subtitle="Track performance, leads and get smarter over time.">
          <div className="grid gap-4 md:grid-cols-3">
            <DashboardCard
              plan={activePlan}
              minPlan="basic"
              title="Contact Manager"
              badge="CRM"
              href="/login/dashboard/contact"
              description="Track warm leads from DMs, comments & funnels."
              points={["Lead notes", "Tagging system", "Follow-up steps"]}
            />

            <DashboardCard
              plan={activePlan}
              minPlan="basic"
              title="Leads Hub"
              badge="Data"
              href="/login/dashboard/leads"
              description="Unified affiliate lead tracking."
              points={["Cross-network tracking", "Intent scoring", "Centralized feed"]}
            />

            <DashboardCard
              plan={activePlan}
              minPlan="pro"
              title="Smart Suggestions List"
              badge="Pro"
              href="/login/dashboard/smart-suggestions"
              description="AI-enhanced discovery engine."
              points={["Find best communities", "Match based on niche", "Future: contact automation"]}
            />
          </div>
        </SectionBlock>

        {/* SYSTEM & ACCOUNT */}
        <SectionBlock id="dashboard-system" title="System & Account" subtitle="Settings, payouts & integrations.">
          <div className="grid gap-4 md:grid-cols-4">
            <DashboardCard
              plan={activePlan}
              minPlan="basic"
              title="Payments & Integrations"
              badge="Billing"
              href="/login/dashboard/payments-integrations"
              description="Manage networks, payouts & subscriptions."
              points={["Stripe & networks", "Status overview", "Clear routing"]}
            />

            <DashboardCard
              plan={activePlan}
              minPlan="basic"
              title="Payouts"
              badge="Earnings"
              href="/login/dashboard/payouts"
              description="See upcoming & paid commissions."
              points={["Wallet", "Bank transfers", "PayPal"]}
            />

            <DashboardCard
              plan={activePlan}
              minPlan="basic"
              title="Settings"
              badge="Preferences"
              href="/login/dashboard/settings"
              description="Profile, region & notifications."
              points={["Profile", "Notifications", "Automation prefs"]}
            />

            <DashboardCard
              plan={activePlan}
              minPlan="basic"
              title="Support"
              badge="Help"
              href="/login/dashboard/contact"
              description="Ask questions or report bugs."
              points={["Email", "Priority support (Elite)", "Fast responses"]}
            />
          </div>
        </SectionBlock>

        {/* COMING SOON */}
        <SectionBlock
          id="dashboard-coming-soon"
          title="Coming Soon to Your Dashboard"
          subtitle="Features we’re building to boost your results even further."
        >
          <div className="grid gap-4 md:grid-cols-3">
            <DashboardCard
              plan={activePlan}
              minPlan="basic"
              title="Community Boost"
              badge="Soon"
              href="#"
              description="Autoaffi creators boosting each other’s posts & reels for algorithm momentum."
              points={["Auto-like pods (quality-first)", "Discover other Autoaffi creators", "Higher chance to hit viral"]}
              comingSoon
            />

            <DashboardCard
              plan={activePlan}
              minPlan="basic"
              title="Content Calendar"
              badge="Soon"
              href="#"
              description="One unified calendar for posts, campaigns, launches & recurring offers."
              points={["Daily posting plan", "Tie content to offers", "See gaps at a glance"]}
              comingSoon
            />

            <DashboardCard
              plan={activePlan}
              minPlan="basic"
              title="Creator Collab Hub"
              badge="Soon"
              href="#"
              description="Find other creators to collab with based on niche, platform and style."
              points={["Match by niche & volume", "Cross-promotion ideas", "Future: AI collab suggestions"]}
              comingSoon
            />
          </div>
        </SectionBlock>

        {/* ELITE ENGINES */}
        <SectionBlock id="dashboard-elite-engines" title="Elite Power Engines" subtitle="Advanced engines — visible to all, unlocked for Elite.">
          <div className="grid gap-4 md:grid-cols-2">
            <DashboardCard
              plan={activePlan}
              minPlan="elite"
              title="Tracking ID Engine"
              badge="Elite"
              href="#"
              description="Full click-tracking precision."
              points={["Auto IDs", "Cross-network", "Forecasting"]}
              comingSoon
            />

            <DashboardCard
              plan={activePlan}
              minPlan="elite"
              title="Offer Rotation AI"
              badge="Elite"
              href="#"
              description="Optimize EPC automatically."
              points={["Rotation rules", "Refund alerts", "Traffic allocation"]}
              comingSoon
            />

            <DashboardCard
              plan={activePlan}
              minPlan="elite"
              title="Viral Engine"
              badge="Elite"
              href="#"
              description="Predict viral waves before they break."
              points={["Angle detection", "Topic virality", "Niche predictions"]}
              comingSoon
            />

            <DashboardCard
              plan={activePlan}
              minPlan="elite"
              title="Auto Funnel Builder"
              badge="Elite"
              href="#"
              description="AI-generated funnels & step flows."
              points={["Smart sequences", "Optimized steps", "High conversions"]}
              comingSoon
            />

            <DashboardCard
              plan={activePlan}
              minPlan="elite"
              title="Timeline Analytics"
              badge="Elite"
              href="#"
              description="Understand consistency gaps over time."
              points={["Posting timeline", "Revenue projections", "Retention analysis"]}
              comingSoon
            />
          </div>
        </SectionBlock>
      </div>
      {/* END MAIN WRAPPER */}
    </main>
  );
}