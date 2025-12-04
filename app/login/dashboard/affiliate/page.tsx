"use client";

import Link from "next/link";
import { useMemo } from "react";

type Plan = "basic" | "pro" | "elite";

function resolvePlan(input?: string | string[] | null): Plan {
  if (!input) return "basic";
  const v = Array.isArray(input) ? input[0] : input;
  const lower = v.toLowerCase();
  if (lower === "pro") return "pro";
  if (lower === "elite") return "elite";
  return "basic";
}

function planLabel(plan: Plan) {
  if (plan === "elite") return "Elite";
  if (plan === "pro") return "Pro";
  return "Basic";
}

function planRank(plan: Plan): number {
  if (plan === "elite") return 3;
  if (plan === "pro") return 2;
  return 1;
}

export default function AffiliatePage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const activePlan = resolvePlan(searchParams?.plan);

  const mlgsCopy = useMemo(() => {
    if (activePlan === "elite") {
      return {
        title: "MLGS Leads Engine – daily",
        bullet: "Elite: daily fresh leads delivered into your Leads Hub.",
      };
    }
    if (activePlan === "pro") {
      return {
        title: "MLGS Leads Engine – 3x per week",
        bullet: "Pro: leads delivered 3x per week into your Leads Hub.",
      };
    }
    return {
      title: "MLGS Leads Engine",
      bullet: "Pro: 3x per week • Elite: daily. Basic can still use MyLead & CPAlead.",
    };
  }, [activePlan]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-8 md:py-12">
        {/* HEADER */}
        <header className="mb-8">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            Affiliate Links &amp; Offers
          </p>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Set up your{" "}
            <span className="bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
              affiliate IDs &amp; core networks
            </span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm md:text-[15px] text-slate-300">
            Autoaffi never logs into networks for you.{" "}
            <span className="font-semibold text-yellow-300">
              You create your own affiliate accounts and IDs,
            </span>{" "}
            then Autoaffi uses them to suggest offers, content angles and track performance.
          </p>
        </header>

        {/* CURRENT PLAN STATUS */}
        <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Current plan
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-50">
              {planLabel(activePlan)} – Affiliate stack
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              All plans can add affiliate IDs and choose networks.{" "}
              <span className="text-yellow-300">
                Pro &amp; Elite unlock MLGS Leads Engine and deeper automation.
              </span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-900">
              {planLabel(activePlan)}
            </span>
            <div className="flex gap-2 text-[11px]">
              <Link
                href="/login/dashboard"
                className="rounded-full border border-slate-700/80 px-3 py-1 text-slate-300 hover:bg-slate-800/70 transition"
              >
                ← Back to dashboard
              </Link>
              <Link
                href="/login/dashboard/pricing"
                className="rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 px-3 py-1 font-semibold text-slate-900 shadow-md hover:brightness-110 transition"
              >
                Upgrade plan
              </Link>
            </div>
          </div>
        </section>

        {/* STEP 1 */}
        <StepBlock
          step="1"
          title="Create / sign in to your affiliate accounts"
          highlight="You own the accounts. Autoaffi just reads data and uses your IDs."
        >
          <p className="text-[13px] text-slate-300 mb-3">
            To earn and track commissions, you need your own affiliate accounts. We
            recommend starting with these core networks:
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            <NetworkCard
              name="Digistore24"
              type="Digital products"
              bullets={[
                "Wide range of digital offers",
                "Recurring & one-time commissions",
                "Good for international audiences",
              ]}
            />
            <NetworkCard
              name="MyLead"
              type="CPA & lead offers"
              bullets={[
                "CPA, CPL and mixed models",
                "Works well with social traffic",
                "Perfect for “quick win” offers",
              ]}
            />
            <NetworkCard
              name="CPAlead"
              type="CPA & mobile"
              bullets={[
                "Mobile & incentive-friendly offers",
                "Useful for some niches & countries",
                "Great for experiments and tests",
              ]}
            />
            <NetworkCard
              name="Amazon Associates"
              type="Physical products"
              bullets={[
                "Physical products & bundles",
                "Lower commissions but high trust",
                "Good as a complement to main offers",
              ]}
            />
          </div>

          <p className="mt-3 text-[11px] text-slate-500">
            Prefer another network? No problem.{" "}
            <span className="text-yellow-300">
              You can add any network that gives you a trackable affiliate ID or link.
            </span>{" "}
            Autoaffi will treat it as part of your stack.
          </p>
        </StepBlock>

        {/* STEP 2 */}
        <StepBlock
          step="2"
          title="Add your affiliate IDs and main links"
          highlight="You add IDs once – Autoaffi reuses them across content, campaigns and funnels."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-yellow-300">
                Core network IDs
              </p>
              <ul className="space-y-1.5 text-[12px] text-slate-300">
                <li>• Digistore24: your affiliate ID or username.</li>
                <li>• MyLead: your unique partner ID or link structure.</li>
                <li>• CPAlead: your account ID or tracking prefix.</li>
                <li>• Amazon: your tracking ID (e.g. <code>yourbrand-21</code>).</li>
              </ul>
              <p className="mt-2 text-[11px] text-slate-500">
                Autoaffi doesn&apos;t need full login or passwords.{" "}
                <span className="text-yellow-300">
                  We only use IDs and links you explicitly provide.
                </span>
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-yellow-300">
                MLGS & leads stack
              </p>
              <ul className="space-y-1.5 text-[12px] text-slate-300">
                <li>• MyLead &amp; CPAlead leads flow directly into your Leads Hub.</li>
                <li>• MLGS email lists are managed by Autoaffi at a platform level.</li>
                <li>
                  • You simply decide if you want MLGS leads included in your pipeline.
                </li>
              </ul>
              <p className="mt-2 text-[11px] text-slate-500">
                When you enable MLGS inside Autoaffi,{" "}
                <span className="text-yellow-300">
                  we handle list management and distribute leads fairly
                </span>{" "}
                based on your plan and usage.
              </p>
            </div>
          </div>

          {/* MLGS TOGGLE ROW */}
          <div className="mt-4 rounded-2xl border border-yellow-500/40 bg-yellow-500/5 p-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-yellow-300">
                {mlgsCopy.title}
              </p>
              <p className="mt-1 text-[12px] text-yellow-100">
                {mlgsCopy.bullet}
              </p>
              <p className="mt-1 text-[11px] text-yellow-100/80">
                Leads appear in{" "}
                <span className="font-semibold">Leads Hub</span> and{" "}
                <span className="font-semibold">Contact Manager</span>. You decide which
                campaigns they belong to.
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              {activePlan === "basic" && (
                <>
                  <span className="inline-flex items-center rounded-full border border-yellow-500/40 bg-slate-950/80 px-3 py-1 text-[11px] text-yellow-300">
                    Upgrade to Pro or Elite to enable MLGS Leads Engine
                  </span>
                  <Link
                    href="/login/dashboard/pricing"
                    className="text-[11px] text-yellow-300 underline underline-offset-2 hover:text-yellow-200"
                  >
                    See plans &amp; what&apos;s included ↗
                  </Link>
                </>
              )}

              {activePlan === "pro" && (
                <span className="inline-flex items-center rounded-full border border-emerald-500/60 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-100">
                  MLGS Leads Engine: active 3x per week (Pro)
                </span>
              )}

              {activePlan === "elite" && (
                <span className="inline-flex items-center rounded-full border border-emerald-500/60 bg-emerald-500/15 px-3 py-1 text-[11px] text-emerald-100">
                  MLGS Leads Engine: daily distribution (Elite)
                </span>
              )}
            </div>
          </div>
        </StepBlock>

        {/* STEP 3 */}
        <StepBlock
          step="3"
          title="How Autoaffi uses your links & IDs"
          highlight="This is why your IDs matter – and how they connect to the rest of the platform."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-yellow-300">
                Inside Content Optimizer
              </p>
              <ul className="space-y-1.5 text-[12px] text-slate-300">
                <li>• We suggest offers that match your niche and audience.</li>
                <li>• Hooks &amp; captions can mention outcomes your offers deliver.</li>
                <li>
                  • Links are attached to content so you don&apos;t have to copy/paste
                  every time.
                </li>
              </ul>
              <p className="mt-2 text-[11px] text-slate-500">
                You always decide{" "}
                <span className="text-yellow-300">which offer is actually used</span> in
                each piece of content.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-yellow-300">
                Inside campaigns, funnels & reporting
              </p>
              <ul className="space-y-1.5 text-[12px] text-slate-300">
                <li>• Campaigns show which offers are attached and how they perform.</li>
                <li>
                  • Funnel Builders ensure the right backend (OLSP, HBA, etc.) is used
                  for your traffic.
                </li>
                <li>
                  • Elite engines later use your IDs to optimize EPC and rotate similar
                  offers safely.
                </li>
              </ul>
              <p className="mt-2 text-[11px] text-slate-500">
                Autoaffi never changes payout rules.{" "}
                <span className="text-yellow-300">
                  Networks pay you as usual – we only help you send more of the right
                  traffic.
                </span>
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-slate-500">
              Later, when API connections are live,{" "}
              <span className="text-yellow-300">
                Autoaffi will read stats using your own credentials or keys
              </span>{" "}
              – still under your control.
            </p>
            <Link
              href="/login/dashboard"
              className="rounded-full border border-slate-700/80 px-3 py-1 text-[11px] text-slate-300 hover:bg-slate-800/70 transition"
            >
              ← Back to dashboard
            </Link>
          </div>
        </StepBlock>
      </div>
    </main>
  );
}

/* ---------- Small layout helpers ---------- */

function StepBlock({
  step,
  title,
  highlight,
  children,
}: {
  step: string;
  title: string;
  highlight?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8 rounded-3xl border border-slate-800/80 bg-slate-950/80 p-4 md:p-5 shadow-[0_18px_50px_rgba(0,0,0,0.7)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-yellow-400 text-[11px] font-bold text-slate-900">
            {step}
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-50">{title}</h2>
            {highlight && (
              <p className="mt-1 max-w-xl text-[11px] text-slate-400">{highlight}</p>
            )}
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}

function NetworkCard({
  name,
  type,
  bullets,
}: {
  name: string;
  type: string;
  bullets: string[];
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-50">{name}</p>
        <span className="rounded-full border border-slate-700/80 px-2 py-0.5 text-[10px] text-slate-400">
          {type}
        </span>
      </div>
      <ul className="space-y-1 text-[12px] text-slate-300">
        {bullets.map((b) => (
          <li key={b}>• {b}</li>
        ))}
      </ul>
    </div>
  );
}