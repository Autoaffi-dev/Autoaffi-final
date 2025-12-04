"use client";

interface WeeklyFocusProps {
  creatorMode: "beginner" | "consistent" | "growth" | null;
  plan: "basic" | "pro" | "elite";
}

export default function WeeklyFocus({ creatorMode }: WeeklyFocusProps) {
  if (!creatorMode) return null;

  const content = {
    beginner: {
      title: "This Week’s Focus",
      tasks: [
        "Connect all your active social accounts.",
        "Add at least 2 affiliate offers so AI has something to work with.",
        "Post once daily for 7 days — build simple and steady momentum.",
      ],
      improvement:
        "Focus on reducing friction. Keep things simple so you can build confidence fast.",
    },

    consistent: {
      title: "Weekly Strategy",
      tasks: [
        "Post 2× daily across your main channel.",
        "Study your top 3 high-engagement posts and replicate the angles.",
        "Add 3 new content variations to test this week.",
      ],
      improvement:
        "Refine what already works. Double down on the patterns driving growth.",
    },

    growth: {
      title: "Scaling Plan",
      tasks: [
        "Plan and launch a 7-day themed content campaign.",
        "Choose one recurring offer to push harder this week.",
        "Optimize your lead flow — mini funnel, link structure, CTAs.",
      ],
      improvement:
        "Push EPC and automation. Small improvements compound fast at this stage.",
    },
  }[creatorMode];

  return (
    <section className="mb-8 rounded-xl border border-emerald-400/25 bg-slate-900/60 p-6 shadow-xl">
      <h3 className="text-xs uppercase tracking-widest text-emerald-300 mb-3">
        {content.title}
      </h3>

      <ul className="mb-4 text-sm text-slate-300 space-y-2 leading-relaxed">
        {content.tasks.map((t) => (
          <li key={t}>• {t}</li>
        ))}
      </ul>

      <p className="text-xs text-slate-400 italic leading-relaxed">
        Tip:{" "}
        <span className="text-emerald-300 font-medium">{content.improvement}</span>
      </p>
    </section>
  );
}