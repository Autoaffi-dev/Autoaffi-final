"use client";

export default function YoutubeBestTimes() {
  // Fake placeholder times – API koppas senare
  const times = [
    { day: "Monday", best: "18:00 – 21:00" },
    { day: "Tuesday", best: "17:00 – 20:00" },
    { day: "Wednesday", best: "18:00 – 22:00" },
    { day: "Thursday", best: "19:00 – 23:00" },
    { day: "Friday", best: "16:00 – 19:00" },
    { day: "Saturday", best: "10:00 – 14:00" },
    { day: "Sunday", best: "12:00 – 16:00" },
  ];

  return (
    <div className="text-sm text-slate-300">
      <p className="text-[11px] text-slate-400 mb-3">
        Based on average audience activity. Autoaffi will replace this with real API
        data when YouTube is connected.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {times.map((t) => (
          <div
            key={t.day}
            className="rounded-lg border border-slate-800 bg-slate-900 p-3 shadow-md"
          >
            <p className="text-xs font-semibold text-red-300">{t.day}</p>
            <p className="text-sm text-yellow-300 mt-1">{t.best}</p>
          </div>
        ))}
      </div>
    </div>
  );
}