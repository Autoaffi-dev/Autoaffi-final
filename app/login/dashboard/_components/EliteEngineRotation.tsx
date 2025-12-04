"use client";

type Plan = "basic" | "pro" | "elite";

interface EliteEngineRotationProps {
  plan: Plan;
}

export default function EliteEngineRotation({ plan }: EliteEngineRotationProps) {
  const locked = plan !== "elite";

  return (
    <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-[0_18px_40px_rgba(0,0,0,0.65)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-yellow-400">
            Elite Engine
          </p>
          <h2 className="text-sm font-semibold text-slate-50">
            Offer Rotation & EPC Optimization
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Safely rotate offers in the background and send more traffic to
            what actually performs.
          </p>
        </div>

        <span className="rounded-full bg-slate-800 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
          Elite Only
        </span>
      </div>

      <ul className="mb-4 space-y-1.5 text-[12px] text-slate-300">
        <li>• Rotation rules based on EPC & refund risk</li>
        <li>• Protects your backend & warm traffic</li>
        <li>• Future: AI-based weighting per audience segment</li>
      </ul>

      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <p>
          Status:{" "}
          <span className={locked ? "text-slate-500" : "text-emerald-300"}>
            {locked ? "Preview mode" : "Configured soon"}
          </span>
        </p>
        <p className="italic text-slate-500">
          Shown here so you can plan your stack early.
        </p>
      </div>
    </section>
  );
}