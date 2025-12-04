"use client";

type CreatorMode = "beginner" | "consistent" | "growth" | null;

interface PersonaChooserProps {
  value: CreatorMode;
  onChange: (mode: CreatorMode) => void;
  compact?: boolean;
}

const OPTIONS = [
  {
    id: "beginner" as const,
    label: "Beginner",
    desc: "New to content or affiliate marketing. Keep it simple and focus on 1–2 key actions.",
  },
  {
    id: "consistent" as const,
    label: "Consistent creator",
    desc: "You post sometimes and want more predictable income and better systems.",
  },
  {
    id: "growth" as const,
    label: "Growth mode",
    desc: "You want scaling, automation and smarter funnels.",
  },
];

export default function PersonaChooser({
  value,
  onChange,
  compact,
}: PersonaChooserProps) {
  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {OPTIONS.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`w-full rounded-xl border px-4 py-3 text-left transition ${
              active
                ? "border-yellow-400 bg-slate-800/80"
                : "border-slate-700 bg-slate-800/40 hover:border-yellow-400/60"
            }`}
          >
            <p className="font-semibold text-slate-50">{opt.label}</p>
            {!compact && (
              <p className="text-[12px] text-slate-300">{opt.desc}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}