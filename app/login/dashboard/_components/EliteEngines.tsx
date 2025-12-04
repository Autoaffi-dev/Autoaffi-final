"use client";

import DashboardCard from "./DashboardCard";

interface EliteEnginesProps {
  plan: "basic" | "pro" | "elite";
  creatorMode: "beginner" | "consistent" | "growth" | null;
}

export default function EliteEngines({ plan, creatorMode }: EliteEnginesProps) {
  return (
    <section
      id="dashboard-elite-engines"
      className="mb-12 rounded-2xl border border-yellow-500/40 bg-slate-900/60 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.65)]"
    >
      {/* BEGINNER WARNING */}
      {creatorMode === "beginner" && (
        <p className="mb-3 text-[11px] text-slate-500">
          These are long-term multipliers — you don’t need to touch these yet.
          Focus on the top sections first.
        </p>
      )}

      {/* Intro block */}
      <div className="mb-4 rounded-xl border border-yellow-500/40 bg-slate-900/50 p-4 text-[12px]">
        <p className="font-semibold text-yellow-300 mb-1">Elite Layer</p>
        <p className="text-slate-300">
          These aren’t shortcuts — <span className="font-semibold">they multiply your results.</span>{" "}
          Autoaffi enhances your strategy using data, attribution and AI-level insights.
        </p>
      </div>

      {/* ALL 5 ELITE CARDS */}
      <div className="grid gap-4 md:grid-cols-2">
        <DashboardCard
          plan={plan}
          minPlan="elite"
          title="Tracking & Click ID Engine"
          badge="Elite Engine"
          href="#"
          description="Track every click through your funnel stack with precision-level attribution."
          points={[
            "Autoaffi click IDs",
            "Cross-network journey mapping",
            "Accurate EPC forecasting",
          ]}
          comingSoon
        />

        <DashboardCard
          plan={plan}
          minPlan="elite"
          title="Offer Rotation & EPC Optimization"
          badge="Elite Engine"
          href="#"
          description="Smart rotation of offers you already promote — maximizes earnings per click."
          points={[
            "Safe rotation rules",
            "Highlights refund risks",
            "Optimizes traffic allocation",
          ]}
          comingSoon
        />

        <DashboardCard
          plan={plan}
          minPlan="elite"
          title="Viral AI & Network Insights"
          badge="Elite Engine"
          href="#"
          description="Macro-level insights combining niche trends, competitors and winning patterns."
          points={[
            "Smarter than manual research",
            "Predict upcoming trends",
            "AI-assisted angle testing (future)",
          ]}
          comingSoon
        />

        <DashboardCard
          plan={plan}
          minPlan="elite"
          title="Auto-Funnel Insertion"
          badge="Elite Engine"
          href="#"
          description="Ensure your content always promotes the right funnel at the right moment."
          points={[
            "Syncs with campaigns",
            "Ensures backend consistency",
            "Dynamic funnel switching (future)",
          ]}
          comingSoon
        />

        <DashboardCard
          plan={plan}
          minPlan="elite"
          title="Future Income Timeline"
          badge="Elite Engine"
          href="#"
          description="Projected income curve based on content, leads and campaigns — forward-looking metrics."
          points={[
            "Lead flow forecasting",
            "Funnel bottleneck warnings",
            "Pairs with Campaigns + Leads Hub",
          ]}
          comingSoon
        />
      </div>
    </section>
  );
}