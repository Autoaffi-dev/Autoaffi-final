"use client";

type Plan = "basic" | "pro" | "elite";

interface EliteEngineAutoFunnelProps {
  plan: Plan;
}

export default function EliteEngineAutoFunnel({
  plan,
}: EliteEngineAutoFunnelProps) {
  const locked = plan !== "elite";

  return (
    <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-[0_18px_40px_rgba(0,0,0,0.65)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-yellow-400">
            Elite Engine
          </p>
          <h2 className="text-sm font-semibold text-slate-50">
            Auto-Funnel Insertion
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Make sure every post, reel and script points to the right funnel at
            the right time — without manual link juggling.
          </p>
        </div>

        <span className="rounded-full bg-slate-800 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
          Elite Only
        </span>
      </div>

      <ul className="mb-4 space-y-1.5 text-[12px] text-slate-300">
        <li>• Syncs with Campaigns & Content Optimizer</li>
        <li>• Keeps backend offers consistent</li>
        <li>• Future: dynamic funnel switching per segment</li>
      </ul>

      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <p>
          Status:{" "}
          <span className={locked ? "text-slate-500" : "text-emerald-300"}>
            {locked ? "Preview mode" : "In private testing"}
          </span>
        </p>
        <p className="italic text-slate-500">
          Think of it as “auto-router” for your promotion strategy.
        </p>
      </div>
    </section>
  );
}