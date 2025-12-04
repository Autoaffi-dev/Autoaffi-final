"use client";

type Props = {
  stage: string;
  handlePathSelect: (path: "beginner" | "pro" | "elite") => void;
  onSkip: () => void;
};

export default function OnboardingPath({
  stage,
  handlePathSelect,
  onSkip,
}: Props) {
  if (stage !== "path") return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-md">
      <div className="bg-slate-900/95 border border-emerald-500/40 rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-6">
       
        <h2 className="text-xl font-bold text-emerald-300 mb-2 text-center">
          Choose Your Starting Path
        </h2>

        <p className="text-slate-300 text-sm mb-5 text-center leading-relaxed">
          This sets the structure of your dashboard and how I guide you. 
          Nothing is permanent — you can switch anytime inside settings.
        </p>

        <div className="space-y-3">

          <button
            className="w-full p-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-emerald-400/50 text-left transition"
            onClick={() => handlePathSelect("beginner")}
          >
            <p className="text-emerald-300 font-semibold text-sm">
              🌱 Beginner Path
            </p>
            <p className="text-slate-400 text-xs mt-1">
              A simple, clean layout with only the essentials — perfect if you want clarity and fast action.
            </p>
          </button>

          <button
            className="w-full p-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-emerald-400/40 text-left transition"
            onClick={() => handlePathSelect("pro")}
          >
            <p className="text-emerald-300 font-semibold text-sm">
              ⚡ Pro Creator
            </p>
            <p className="text-slate-400 text-xs mt-1">
              Shows more analytics, insights and options — ideal if you already post consistently.
            </p>
          </button>

          <button
            className="w-full p-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-emerald-400/40 text-left transition"
            onClick={() => handlePathSelect("elite")}
          >
            <p className="text-emerald-300 font-semibold text-sm">
              👑 Elite Growth Mode
            </p>
            <p className="text-slate-400 text-xs mt-1">
              Unlocks scaling layout: recurring income focus, funnel visibility & future automation spaces.
            </p>
          </button>

        </div>

        <button
          onClick={onSkip}
          className="mt-4 w-full text-xs text-slate-400 hover:text-slate-200 transition text-center"
        >
          Skip – I’ll pick later
        </button>
      </div>
    </div>
  );
}