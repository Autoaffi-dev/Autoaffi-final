"use client";

export type RecommendationPanelProps = {
  creatorMode: "beginner" | "consistent" | "growth";
  plan: "basic" | "pro" | "elite";
};

export default function RecommendationPanel({
  creatorMode,
  plan,
}: RecommendationPanelProps) {
  const bullets =
    creatorMode === "beginner"
      ? [
          "Connect at least 1 social account.",
          "Add 1–2 affiliate offers you trust.",
          "Generate 1 post today — keep it simple.",
        ]
      : creatorMode === "consistent"
      ? [
          "Create a weekly content batch (3–5 posts).",
          "Add recurring offers to improve predictability.",
          "Review analytics and update your CTA.",
        ]
      : [
          "Build your 7-day funnel sequence.",
          "Push 1 backend recurring offer.",
          "Use niche trends to scale faster.",
        ];

  return (
    <section className="mb-8 rounded-2xl border border-emerald-400/30 bg-slate-900/70 p-5 shadow-[0_18px_40px_rgba(0,0,0,0.7)]">
      <p className="mb-1 text-[11px] uppercase tracking-[0.2em] text-emerald-300">
        Personalized Focus
      </p>

      <p className="mb-3 text-sm text-slate-100">
        Based on your creator type and your plan{" "}
        <span className="text-yellow-300 font-bold">
          {plan.toUpperCase()}
        </span>
        , here’s what to focus on today:
      </p>

      <ul className="mb-2 space-y-1.5 text-[13px] text-slate-300">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span className="mt-[5px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400"></span>
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <p className="text-[11px] text-slate-500">
        You can always update your creator mode later in Settings.
      </p>
    </section>
  );
}