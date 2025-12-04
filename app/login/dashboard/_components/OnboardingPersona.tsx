"use client";

type Props = {
  stage: string;
  handlePersonaSelect: (mode: "beginner" | "consistent" | "growth") => void;
  onSkip: () => void;
};

export default function OnboardingPersona({
  stage,
  handlePersonaSelect,
  onSkip,
}: Props) {
  if (stage !== "persona") return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-md">
      <div className="bg-slate-900/95 border border-emerald-500/40 rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-6">
        <h2 className="text-xl font-bold text-emerald-300 mb-2 text-center">
          Tell me who you are as a creator
        </h2>
        <p className="text-slate-300 text-sm mb-5 text-center">
          This helps me tune your dashboard, language and pace. You can change
          this later — this is just how we start our journey together.
        </p>

        <div className="space-y-3">
          <button
            className="w-full p-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-emerald-400/50 text-left transition"
            onClick={() => handlePersonaSelect("beginner")}
          >
            <p className="text-emerald-300 font-semibold text-sm">
              🌱 Beginner – “I’m just starting out”
            </p>
            <p className="text-slate-400 text-xs mt-1">
              You want clear steps, examples and fast wins without overwhelm.
            </p>
          </button>

          <button
            className="w-full p-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-emerald-400/40 text-left transition"
            onClick={() => handlePersonaSelect("consistent")}
          >
            <p className="text-emerald-300 font-semibold text-sm">
              🔁 Consistent – “I’m posting but want structure”
            </p>
            <p className="text-slate-400 text-xs mt-1">
              You already create content and now want better systems, tracking
              and focus.
            </p>
          </button>

          <button
            className="w-full p-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-emerald-400/40 text-left transition"
            onClick={() => handlePersonaSelect("growth")}
          >
            <p className="text-emerald-300 font-semibold text-sm">
              🚀 Growth – “I’m ready to scale”
            </p>
            <p className="text-slate-400 text-xs mt-1">
              You have motion already and want to push recurring income,
              funnels and optimization.
            </p>
          </button>
        </div>

        <button
          onClick={onSkip}
          className="mt-4 w-full text-xs text-slate-400 hover:text-slate-200 transition text-center"
        >
          Skip for now – I’ll decide later
        </button>
      </div>
    </div>
  );
}