"use client";

import StatBlock from "./StatBlock";

export type AtAGlanceProps = {
  socials: number;
  offers: number;
  recurring: number;
  postsToday: number;
  steps: number;
};

export default function AtAGlance({
  socials,
  offers,
  recurring,
  postsToday,
  steps,
}: AtAGlanceProps) {
  return (
    <div className="mb-8 rounded-2xl border border-slate-700/60 bg-slate-900/70 p-5 shadow-[0_18px_40px_rgba(0,0,0,0.7)]">
      <h3 className="mb-4 text-xs uppercase tracking-[0.22em] text-yellow-300">
        At a Glance
      </h3>

      <div className="grid gap-4 md:grid-cols-5">
        <StatBlock
          label="Socials Connected"
          value={socials}
          icon="🔵"
          color="text-blue-300"
        />

        <StatBlock
          label="Offers Added"
          value={offers}
          icon="🟠"
          color="text-orange-300"
        />

        <StatBlock
          label="Recurring Setup"
          value={recurring}
          icon="🟢"
          color="text-green-300"
        />

        <StatBlock
          label="Posts Published"
          value={postsToday}
          icon="🟣"
          color="text-purple-300"
        />

        <StatBlock
          label="Steps Completed"
          value={steps}
          icon="🟡"
          color="text-yellow-300"
        />
      </div>
    </div>
  );
}