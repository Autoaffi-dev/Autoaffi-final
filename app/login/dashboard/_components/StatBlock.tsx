"use client";

interface StatBlockProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: string; // t.ex. "text-emerald-300"
}

export default function StatBlock({ label, value, icon, color }: StatBlockProps) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-900/60 border border-slate-800 p-4 shadow">
      <div>
        <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
        <p className={`text-xl font-bold ${color ?? "text-slate-100"}`}>{value}</p>
      </div>
      {icon && <div className="text-2xl opacity-80">{icon}</div>}
    </div>
  );
}