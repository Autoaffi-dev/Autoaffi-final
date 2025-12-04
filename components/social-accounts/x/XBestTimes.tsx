"use client";

export default function XBestTimes() {
  const best = [
    { day: "Mon", time: "12:00 — 15:00" },
    { day: "Tue", time: "09:00 — 11:00" },
    { day: "Wed", time: "13:00 — 16:00" },
    { day: "Thu", time: "11:00 — 14:00" },
    { day: "Fri", time: "08:00 — 10:00" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 text-sm text-slate-300">
      {best.map((b) => (
        <div key={b.day} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
          <p className="text-yellow-300 font-semibold text-xs">{b.day}</p>
          <p className="text-slate-400 text-sm">{b.time}</p>
        </div>
      ))}
    </div>
  );
}