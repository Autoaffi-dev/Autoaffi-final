"use client";

export interface MiniNavProps {
  onJump: (id: string) => void;
}

const SECTIONS = [
  { id: "dashboard-core-setup", label: "Core" },
  { id: "dashboard-content-offers", label: "Content" },
  { id: "dashboard-recurring", label: "Recurring" },
  { id: "dashboard-audience-growth", label: "Growth" },
  { id: "dashboard-data-learning", label: "Data & Leads" },
  { id: "dashboard-system", label: "System" },
  { id: "dashboard-elite-engines", label: "Elite" },
];

export default function MiniNav({ onJump }: MiniNavProps) {
  return (
    <nav className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2">
        <div className="flex gap-2 overflow-x-auto text-[11px] font-medium text-slate-300">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => onJump(s.id)}
              className="whitespace-nowrap rounded-full border border-slate-700/80 bg-slate-900/80 px-3 py-1 hover:border-emerald-400 hover:text-emerald-300"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}