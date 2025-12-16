"use client";

import { useEffect, useState } from "react";

// CORE UI
import SectionBlock from "./_components/SectionBlock";
import DashboardCard from "./_components/DashboardCard";
import DashboardHeader from "./_components/DashboardHeader";
import MiniNav from "./_components/MiniNav";

// A6 POWER COMPONENTS
import WeeklyFocus from "./_components/WeeklyFocus";
import AtAGlance from "./_components/AtAGlance";
import GrowthPlan from "./_components/GrowthPlan";
import RecommendationPanel from "./_components/RecommendationPanel";
import PlanStrip from "./_components/PlanStrip";
import ConsistencyText from "./_components/ConsistencyText";

// ONBOARDING
import OnboardingOverlay from "./_components/OnboardingOverlay";
import OnboardingFlow from "./_components/OnboardingFlow";
import AISpeech from "./_components/AISpeech";
import SpotlightHighlight from "./_components/SpotlightHighlight";

let BLOCK_WRITES = false;

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

export default function DashboardPage({ searchParams }: any) {
  const activePlan: Plan =
    (searchParams?.plan as Plan | undefined) ?? ("basic" as Plan);

  // STATE
  const [creatorMode, setCreatorMode] = useState<CreatorMode>(null);
  const [tourStage, setTourStage] = useState<TourStage>("off");
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [tourCompleted, setTourCompleted] = useState(false);
  const [heroIntro, setHeroIntro] = useState(false);

  const [beginnerUntil, setBeginnerUntil] = useState<number | null>(null);
  const [startStepsCompleted, setStartStepsCompleted] = useState(0);

  const [aiMessage, setAiMessage] = useState<string>("");
  const [showRecommendations, setShowRecommendations] = useState(false);

  const beginnerHoursLeft =
    beginnerUntil !== null
      ? Math.max(1, Math.ceil((beginnerUntil - Date.now()) / (60 * 60 * 1000)))
      : null;

// LOAD FROM LOCALSTORAGE
useEffect(() => {
  if (typeof window === "undefined") return;

  const storedMode = localStorage.getItem("autoaffi_creator_mode") as CreatorMode | null;
  const storedSteps = localStorage.getItem("autoaffi_start_steps");
  const storedBeginner = localStorage.getItem("autoaffi_beginner_until");
  const storedTour = localStorage.getItem("autoaffi_tour_done");

  // LOAD mode / steps / beginner timer
  if (storedMode) setCreatorMode(storedMode);
  if (storedSteps) setStartStepsCompleted(parseInt(storedSteps, 10));
  if (storedBeginner) setBeginnerUntil(parseInt(storedBeginner, 10));

  // HERO fade-in
  setTimeout(() => setHeroIntro(true), 150);

  // TOUR COMPLETED → disable everything permanently
  if (storedTour === "1") {
    setTourCompleted(true);
    setShowRecommendations(true);
    setTourStage("off");
    return;
  }

  // FIRST TIME USER → START onboarding
  if (!storedTour) {
    setTimeout(() => {
      setTourStage("welcome");
      setAiMessage(
        "Welcome to Autoaffi — your second home on the internet. From today, everything you do for affiliate growth has one place to live. I’ll walk you through the core sections so you know exactly where to focus first."
      );
    }, 600);
  }
}, []);



  // STEP PROGRESSION TRACKER (används av 3-stegs-komponenten)
  function markStepCompleted(step: number) {
    setStartStepsCompleted((prev) => {
      const next = step > prev ? step : prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("autoaffi_start_steps", String(next));
      }
      return next;
    });
  }

  // FINISH ONBOARDING – varm avslutning + 3 steg
  function finishOnboarding() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("autoaffi_tour_done", "1");
    }

    setTourCompleted(true);
    setTourStage("complete");
    setShowRecommendations(true);

    // AI – final 3-step message
    setAiMessage(
      "I will now show you the first 3 important steps — the beginning of our journey together. These 3 steps will move you from zero to progress fast. And remember… you are not alone. You’re part of the Autoaffi family now."
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

      setAiMessage(
        "Beginner mode enabled. For the next 48 hours I’ll push you with extra guidance and fast wins — including your first 3 steps."
      );
    }

    if (mode === "consistent") {
      setAiMessage(
        "Consistency mode selected. We’ll use your posting patterns to drive smarter recommendations."
      );
    }

    if (mode === "growth") {
      setAiMessage(
        "Growth mode activated. Time to scale what already works — recurring offers, funnels and higher EPC."
      );
    }

    setSpotlightIndex(0);
    setTourStage("spotlight");
  }

// SECTION AUTOSCROLL WHEN SPOTLIGHT CHANGES
useEffect(() => {
  if (tourStage !== "spotlight") return;

  // When all sections are done → go to final 3-steps
  if (spotlightIndex === SPOTLIGHT_TARGETS.length) {
    setTourStage("final-steps");
    return;
  }

  const messages = [
    // 0: Core Setup — 18 sec
    "First stop: Core Setup. This is where you connect your socials and add your key affiliate offers so Autoaffi can understand your world. Once this foundation is in place, everything else becomes easier. Think of this as unlocking the engine that powers the rest of your dashboard.",

    // 1: Content & Offers — 18 sec
    "Next up: Content & Offers — the heart of your creator workflow. This is where your products turn into posts, reels, captions and campaigns. The more you add here, the smarter Autoaffi becomes at generating ideas and tailored suggestions designed just for you.",

    // 2: Recurring Income — 18 sec
    "Now we move into Recurring Income & Funnels. This is where you build offers that can pay you month after month, even when you're offline. Funnels, recurring programs and long-term income streams — this is how creators build stability and freedom.",

    // 3: Audience & Growth — 18 sec
    "Here we have Audience & Growth. This section shows you trends, angles and engagement patterns so you never post in the dark. It helps you understand what your audience responds to — giving you clarity, direction and momentum week after week.",

    // 4: Data, Leads & Learning — 18 sec
    "Next is Data, Leads & Learning. This is your performance center — where your warm leads, analytics and insights live together. You'll always know what’s working, what to improve, and where your next opportunity is coming from.",

    // 5: System & Account — 18 sec
    "Finally: System & Account. Quiet, but powerful. This is where your integrations, payouts and account settings live. When this is set up properly, everything in your dashboard runs smoother, faster and with fewer distractions."
  ];

  // Set voice text
  const currentMessage =
    messages[spotlightIndex] ??
    "Scrolling through the important areas of your dashboard.";

  setAiMessage(currentMessage);

  // Scroll to current spotlight section
  const id = SPOTLIGHT_TARGETS[spotlightIndex];
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

// 25 sec for first section, 18 sec for the rest
const durations = [25000, 18000, 18000, 18000, 18000, 18000];

const timeout = window.setTimeout(() => {
  setSpotlightIndex(prev => prev + 1);
}, durations[spotlightIndex]);

  return () => clearTimeout(timeout);
}, [tourStage, spotlightIndex]);


// FINAL 3-STEP INTRO (20 seconds)
useEffect(() => {
  if (tourStage !== "final-steps") return;

  const finalMessage =
    "Before we begin, I want to show you your first three steps. These steps give you momentum, unlock smarter AI guidance and help you get results faster. And remember — you’re not doing this alone. From this moment, you’re part of the Autoaffi family. I’ll guide you through every step, every win and every milestone. Let’s take your first three steps together.";

  setAiMessage(finalMessage);

  const timeout = window.setTimeout(() => {
    const el = document.getElementById("start-steps-anchor");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 50); // 20 seconds

  return () => clearTimeout(timeout);
}, [tourStage]);

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
  setAiMessage,
});

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      {/* HEADER */}
      <DashboardHeader heroIntro={heroIntro} />

{/* AI VOICE */}
{["welcome", "persona", "path", "spotlight", "final-steps"].includes(tourStage) && (
  <AISpeech
    text={aiMessage}
    play={true}
  />
)}

      {/* AI OVERLAY */}
<OnboardingOverlay
    stage={tourStage}
    aiMessage={aiMessage}
    handleWelcomeContinue={flow.handleWelcomeContinue}
    handlePersonaSelect={flow.handlePersonaSelect}
    handlePathSelect={flow.handlePathSelect}
onSkip={() => {
  // Sätt default persona = "beginner"
  setCreatorMode("beginner");

  // Ge beginner-mode samma 48h-boost som om man valt det i guiden
  const until = Date.now() + 48 * 60 * 60 * 1000;

  if (typeof window !== "undefined") {
    window.localStorage.setItem("autoaffi_tour_done", "1");
    window.localStorage.setItem("autoaffi_creator_mode", "beginner");
    window.localStorage.setItem("autoaffi_beginner_until", String(until));
  }

  setBeginnerUntil(until);
  setStartStepsCompleted(0); // valfritt, men nice att börja från 0

  setTourCompleted(true);
  setShowRecommendations(true);
  setTourStage("off");
}}
/>

     {/* SPOTLIGHT HIGHLIGHT */}
<SpotlightHighlight
  stage={tourStage}
  spotlightIndex={spotlightIndex}
  spotlightTargets={SPOTLIGHT_TARGETS}
  aiMessage={aiMessage}
  onNext={() => setSpotlightIndex((prev) => prev + 1)}
/>

      {/* PLAN STRIP */}
      <PlanStrip plan={activePlan} beginnerHoursLeft={beginnerHoursLeft} />

      {/* CONSISTENCY TEXT */}
      <ConsistencyText creatorMode={creatorMode} plan={activePlan} />

      {/* MINI NAV */}
      <MiniNav onJump={scrollToId} />

      {/* WEEKLY FOCUS */}
      <WeeklyFocus creatorMode={creatorMode} plan={activePlan} />

      {/* AT A GLANCE */}
      {showCreatorMeta && (
        <AtAGlance
          socials={1}
          offers={2}
          recurring={0}
          postsToday={0}
          steps={startStepsCompleted}
        />
      )}

{/* GROWTH PLAN */}
{creatorMode && (
  <GrowthPlan
    creatorMode={creatorMode}
    startStepsCompleted={startStepsCompleted}
    markStepCompleted={markStepCompleted}
  />
)}

      {/* RECOMMENDATIONS */}
      {creatorMode && showRecommendations && (
        <RecommendationPanel creatorMode={creatorMode} plan={activePlan} />
      )}

      {/* MAIN WRAPPER */}
      <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">



        {/* -------------------------------------- */}
        {/* CORE SETUP */}
        {/* -------------------------------------- */}
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
              points={[
                "Improves AI accuracy",
                "Unlocks analytics",
                "Prepares for auto-posting",
              ]}
            />

            <DashboardCard
              plan={activePlan}
              minPlan="basic"
              title="Affiliate Offers"
              badge="Core"
              href="/login/dashboard/affiliate"
              description="Save your links & recurring programs."
              points={[
                "Better targeting",
                "Optimized Content AI",
                "Organized funnels",
              ]}
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

        {/* -------------------------------------- */}
        {/* CONTENT & OFFERS */}
        {/* -------------------------------------- */}
        <SectionBlock
          id="dashboard-content-offers"
          title="Content & Offers"
          subtitle="Turn your offers into high-performing content."
        >
          <div className="grid gap-4 md:grid-cols-3">
            <DashboardCard
              plan={activePlan}
              minPlan="basic"
              title="Posts Generator"
              badge="AI + Links"
              href="/login/dashboard/content-optimizer/posts"
              description="Hooks, captions, formatting & SEO in one."
              points={[
                "Hooks + captions",
                "SEO formatting",
                "Auto-linked offers",
              ]}
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
              points={[
                "Attach offers",
                "Track performance",
                "Future: auto sequences",
              ]}
            />
          </div>
        </SectionBlock>

        {/* -------------------------------------- */}
        {/* RECURRING INCOME & FUNNELS */}
        {/* -------------------------------------- */}
        <SectionBlock
          id="dashboard-recurring"
          title="Recurring Income & Funnels"
          subtitle="Build long-term predictable affiliate income."
        >
          <div className="grid gap-4 md:grid-cols-3">
            <DashboardCard
              plan={activePlan}
              minPlan="basic"
              title="Autoaffi Recurring"
              badge="Lifetime 50%"
              href="/login/dashboard/recurring-autoaffi"
              description="Lifetime recurring commissions."
              points={[
                "Perfect backend offer",
                "Works in any niche",
                "High retention",
              ]}
            />

            <DashboardCard
              plan={activePlan}
              minPlan="basic"
              title="Recurring AI Stack"
              badge="AI Tools"
              href="/login/dashboard/recurring-income-platforms"
              description="Top SaaS tools for monthly commissions."
              points={[
                "High LTV tools",
                "Creator-friendly",
                "Easy to promote",
              ]}
            />

            <DashboardCard
              plan={activePlan}
              minPlan="pro"
              title="Funnel Builders"
              badge="Funnels"
              href="/login/dashboard/funnel-builders"
              description="Connect your main funnel — used everywhere."
              points={[
                "OLSP / HBA / CF",
                "Backend protection",
                "Future: auto routing",
              ]}
            />
          </div>
        </SectionBlock>

        {/* -------------------------------------- */}
        {/* AUDIENCE & GROWTH */}
        {/* -------------------------------------- */}
        <SectionBlock
          id="dashboard-audience-growth"
          title="Audience & Growth"
          subtitle="Find trends, angles & niche opportunities."
        >
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
              points={[
                "Compare creators",
                "Trend signals",
                "Future: AI hook recommendations",
              ]}
            />
          </div>
        </SectionBlock>

        {/* -------------------------------------- */}
        {/* DATA / LEADS / LEARNING */}
        {/* -------------------------------------- */}
        <SectionBlock
          id="dashboard-data-learning"
          title="Data, Leads & Learning"
          subtitle="Track performance, leads and get smarter over time."
        >
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
              points={[
                "Cross-network tracking",
                "Intent scoring",
                "Centralized feed",
              ]}
            />

            <DashboardCard
              plan={activePlan}
              minPlan="pro"
              title="Smart Suggestions List"
              badge="Pro"
              href="/login/dashboard/smart-suggestions"
              description="AI-enhanced discovery engine."
              points={[
                "Find best communities",
                "Match based on niche",
                "Future: contact automation",
              ]}
            />
          </div>
        </SectionBlock>

        {/* -------------------------------------- */}
        {/* SYSTEM & ACCOUNT */}
        {/* -------------------------------------- */}
        <SectionBlock
          id="dashboard-system"
          title="System & Account"
          subtitle="Settings, payouts & integrations."
        >
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

        {/* -------------------------------------- */}
        {/* COMING SOON — COMMUNITY & BOOSTERS */}
        {/* -------------------------------------- */}
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
              points={[
                "Auto-like pods (quality-first)",
                "Discover other Autoaffi creators",
                "Higher chance to hit viral",
              ]}
              comingSoon
            />

            <DashboardCard
              plan={activePlan}
              minPlan="basic"
              title="Content Calendar"
              badge="Soon"
              href="#"
              description="One unified calendar for posts, campaigns, launches & recurring offers."
              points={[
                "Daily posting plan",
                "Tie content to offers",
                "See gaps at a glance",
              ]}
              comingSoon
            />

            <DashboardCard
              plan={activePlan}
              minPlan="basic"
              title="Creator Collab Hub"
              badge="Soon"
              href="#"
              description="Find other creators to collab with based on niche, platform and style."
              points={[
                "Match by niche & volume",
                "Cross-promotion ideas",
                "Future: AI collab suggestions",
              ]}
              comingSoon
            />
          </div>
        </SectionBlock>

        {/* -------------------------------------- */}
        {/* ELITE ENGINES — ALL 5 INCLUDED */}
        {/* -------------------------------------- */}
        <SectionBlock
          id="dashboard-elite-engines"
          title="Elite Power Engines"
          subtitle="Advanced engines — visible to all, unlocked for Elite."
        >
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
              points={[
                "Posting timeline",
                "Revenue projections",
                "Retention analysis",
              ]}
              comingSoon
            />
          </div>
        </SectionBlock>
      </div>

      {/* END MAIN WRAPPER */}
    </main>
  );
}