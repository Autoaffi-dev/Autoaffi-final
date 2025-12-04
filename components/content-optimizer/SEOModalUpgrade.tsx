"use client";

type Plan = "basic" | "pro" | "elite";

export type SEOModalUpgradeProps = {
  currentPlan: Plan;
  targetPlan: Plan;
};

export default function SEOModalUpgrade({ currentPlan, targetPlan }: SEOModalUpgradeProps) {
  if (currentPlan === "elite") return null;

  const labelMap: Record<Plan, string> = {
    basic: "Basic",
    pro: "Pro",
    elite: "Elite",
  };

  return (
    <div className="rounded-2xl border border-yellow-500/40 bg-slate-900/80 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.7)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-yellow-300 mb-1">
        Coming as you scale
      </p>
      <p className="text-[11px] text-slate-200 mb-2">
        Right now you&apos;re on{" "}
        <span className="font-semibold text-yellow-300">{labelMap[currentPlan]}</span>. When you
        upgrade to{" "}
        <span className="font-semibold text-yellow-300">{labelMap[targetPlan]}</span>, the SEO
        helper will plug into{" "}
        <span className="text-slate-50">
          deeper trend data, competitor angles and cross-platform insights
        </span>
        .
      </p>
      <p className="text-[11px] text-slate-500">
        You don&apos;t need this to start.{" "}
        <span className="text-slate-200 font-semibold">Post consistently first</span> – upgrade when
        you&apos;re ready to scale harder.
      </p>
    </div>
  );
}