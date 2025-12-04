"use client";

export default function XGrowth() {
  const sample = [5, 12, 9, 14, 22, 18, 30, 24];

  return (
    <div className="text-sm text-slate-300">
      <p className="text-[11px] text-slate-500 mb-2">7-day follower growth</p>

      <div className="flex gap-1">
        {sample.map((n, i) => (
          <div
            key={i}
            className="w-6 rounded bg-yellow-400/20 border border-yellow-400/40"
            style={{ height: `${n * 3}px` }}
          />
        ))}
      </div>
    </div>
  );
}