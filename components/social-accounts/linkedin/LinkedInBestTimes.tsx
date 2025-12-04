"use client";

export default function LinkedInBestTimes() {
  const best = [
    { day: "Mon", time: "08:00 — 11:00" },
    { day: "Tue", time: "09:00 — 12:00" },
    { day: "Wed", time: "08:00 — 10:00" },
    { day: "Thu", time: "10:00 — 13:00" },
    { day: "Fri", time: "07:00 — 09:00" },
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