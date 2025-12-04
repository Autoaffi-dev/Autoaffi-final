"use client";

export default function FacebookBestTimes() {
  const times = [
    "09:00 — High reach",
    "12:00 — Strong engagement",
    "18:00 — Viral window",
  ];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 shadow-lg text-slate-200">
      <h3 className="text-sm font-semibold mb-3 text-yellow-300 tracking-wide">
        Best Times to Post (Facebook)
      </h3>

      <ul className="space-y-2 text-xs">
        {times.map((t, i) => (
          <li
            key={i}
            className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-slate-300"
          >
            {t}
          </li>
        ))}
      </ul>

      <p className="mt-4 text-[11px] text-slate-500">
        Autoaffi analyzes your last 60 posts to find the strongest posting windows.
      </p>
    </div>
  );
}