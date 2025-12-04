"use client";

export default function LinkedInGrowth() {
  const weekly = [2, 5, 4, 8, 12, 7, 14];

  return (
    <div className="text-sm text-slate-300">
      <p className="text-[11px] text-slate-500 mb-2">7-day connection growth</p>

      <div className="flex gap-1">
        {weekly.map((n, i) => (
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