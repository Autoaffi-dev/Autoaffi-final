"use client";

interface BeginnerNoticeProps {
  hoursLeft: number;
}

export default function BeginnerNotice({ hoursLeft }: BeginnerNoticeProps) {
  return (
    <div className="mx-auto mb-6 w-full max-w-6xl px-4">
      <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-emerald-200 shadow-[0_0_25px_rgba(0,255,180,0.15)]">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300 mb-1">
          Beginner Boost Mode Active
        </div>

        <p className="text-sm text-emerald-100">
          You have <span className="font-semibold">{hoursLeft}h</span> left of enhanced 48h guided onboarding.
          Features are simplified and AI suggestions are boosted.
        </p>
      </div>
    </div>
  );
}