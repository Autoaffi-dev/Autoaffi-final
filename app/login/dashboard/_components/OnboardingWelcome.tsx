"use client";

export interface OnboardingWelcomeProps {
  onContinue: () => void;
}

export default function OnboardingWelcome({ onContinue }: OnboardingWelcomeProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur">
      <div className="rounded-2xl bg-slate-900 p-8 shadow-xl border border-emerald-400/30 w-full max-w-md">
        <h2 className="text-xl font-bold text-emerald-300 mb-4">
          Welcome to Autoaffi 👋
        </h2>

        <p className="text-slate-300 mb-6">
          Let’s set up your personalized dashboard. This takes less than a minute.
        </p>

        <button
          onClick={onContinue}
          className="w-full rounded-xl bg-emerald-500 py-2 text-black font-semibold hover:bg-emerald-400"
        >
          Continue
        </button>
      </div>
    </div>
  );
}