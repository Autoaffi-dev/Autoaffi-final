"use client";

type Plan = "basic" | "pro" | "elite";
type CreatorMode = "beginner" | "consistent" | "growth" | null;

export interface ConsistencyTextProps {
  creatorMode: CreatorMode;
  plan?: Plan;
}

export default function ConsistencyText({ creatorMode }: ConsistencyTextProps) {
  if (!creatorMode) return null;

  let heading = "Consistency > perfection";
  let body =
    "Post at least twice per day on your main channel. Don’t expect reliable payouts in the first weeks — focus on getting reps in and letting the algorithm learn.";
  let timeline =
    "Most creators see their first meaningful results after 4–8 weeks of consistent posting.";

  if (creatorMode === "consistent") {
    body =
      "You already have some momentum. Lock in a schedule you can actually keep and track your weekly output inside Autoaffi.";
    timeline =
      "Expect clearer patterns and more stable clicks in 3–6 weeks if you stay above 10–14 pieces of content per week.";
  }

  if (creatorMode === "growth") {
    body =
      "Now it’s about scaling what already works: double-down on your best angles, funnels and recurring offers.";
    timeline =
      "With focused testing and enough volume, many growth-mode creators can double results in 6–12 weeks.";
  }

  return (
    <section className="border-b border-slate-800 bg-slate-950/70">
      <div className="mx-auto max-w-6xl px-4 py-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
          {heading}
        </h2>
        <p className="mt-1 text-xs text-slate-200">{body}</p>
        <p className="mt-1 text-[11px] text-slate-400">Reality check: {timeline}</p>
      </div>
    </section>
  );
}