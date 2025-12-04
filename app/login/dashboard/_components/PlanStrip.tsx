"use client";

type Plan = "basic" | "pro" | "elite";

export interface PlanStripProps {
  plan: Plan;
  // ✅ inte optional längre – alltid number eller null
  beginnerHoursLeft: number | null;
}

const LABELS: Record<Plan, string> = {
  basic: "Basic",
  pro: "Pro",
  elite: "Elite",
};

export default function PlanStrip({ plan, beginnerHoursLeft }: PlanStripProps) {
  return (
    <section className="border-b border-emerald-400/20 bg-slate-950/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
        {/* LEFT */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Your plan
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-100">
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              {LABELS[plan]} plan
            </span>

            {plan !== "elite" && (
              <span className="text-[11px] text-slate-400">
                Upgrade to unlock Elite Engines & advanced automation.
              </span>
            )}
          </div>

          {beginnerHoursLeft !== null && beginnerHoursLeft > 0 && (
            <p className="mt-1 text-[11px] text-emerald-300/80">
              Beginner boost active for ~{beginnerHoursLeft}h — extra guidance is on.
            </p>
          )}
        </div>

        {/* RIGHT */}
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <button className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-slate-200 hover:border-emerald-400 hover:text-emerald-200">
            View billing
          </button>

          {plan !== "elite" && (
            <button className="rounded-full bg-emerald-500 px-3 py-1 font-semibold text-black hover:bg-emerald-400">
              See Elite benefits
            </button>
          )}
        </div>
      </div>
    </section>
  );
}