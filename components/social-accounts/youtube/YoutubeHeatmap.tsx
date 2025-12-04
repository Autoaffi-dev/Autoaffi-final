"use client";
import { useState, useMemo } from "react";

const hours = [
  "00", "01", "02", "03", "04", "05",
  "06", "07", "08", "09", "10", "11",
  "12", "13", "14", "15", "16", "17",
  "18", "19", "20", "21", "22", "23",
];

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Mock retention curve data
const mockRetention = [100, 72, 58, 47, 38, 33, 28, 24, 20, 17, 15];

const generateFakeHeatmap = () =>
  Array.from({ length: days.length }).map(() =>
    Array.from({ length: hours.length }).map(() =>
      Math.floor(Math.random() * 100)
    )
  );

export default function YouTubeHeatmap() {
  const [heatmap] = useState(generateFakeHeatmap);

  const maxValue = useMemo(
    () => Math.max(...heatmap.flat()),
    [heatmap]
  );

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.7)]">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-red-300 mb-4">
        Best times & retention curve
      </h2>

      {/* ------------ HEATMAP ------------ */}
      <div>
        <p className="text-xs text-slate-400 mb-2">
          When your audience is most active
        </p>

        <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <table className="text-[10px]">
            <thead>
              <tr>
                <th className="text-left text-slate-500 pr-2">Day</th>
                {hours.map((h) => (
                  <th key={h} className="px-1 text-slate-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {days.map((day, dayIndex) => (
                <tr key={day}>
                  <td className="pr-2 text-slate-400">{day}</td>
                  {heatmap[dayIndex].map((value, hourIndex) => {
                    const intensity = value / maxValue;
                    const bg = `rgba(255, 0, 0, ${intensity * 0.8})`;

                    return (
                      <td
                        key={hourIndex}
                        className="w-5 h-5 rounded-sm"
                        style={{
                          backgroundColor: bg,
                        }}
                      ></td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[10px] text-slate-500 mt-2">
          Darker = more viewers online → higher ranking opportunity.
        </p>
      </div>

      {/* ------------ RETENTION CURVE ------------ */}
      <div className="mt-8">
        <p className="text-xs text-slate-400 mb-2">
          Audience retention (first 60 seconds)
        </p>

        <div className="relative h-40 w-full border border-slate-800 bg-slate-900/60 rounded-xl overflow-hidden p-2">
          {/* The line path */}
          <svg width="100%" height="100%" viewBox="0 0 100 100">
            <polyline
              fill="none"
              stroke="#ff4444"
              strokeWidth="1.5"
              points={mockRetention
                .map((v, i) => `${(i / (mockRetention.length - 1)) * 100},${100 - v}`)
                .join(" ")}
            />
          </svg>

          {/* Labels */}
          <div className="absolute top-2 right-2 text-[10px] text-slate-400">
            Drop-off visualization
          </div>
        </div>

        <p className="text-[10px] text-slate-500 mt-2">
          High early retention <span className="text-red-300">boosts search ranking</span> and pushes your video into Suggested.
        </p>
      </div>

      {/* ------------ FOOTER ------------ */}
      <p className="text-[11px] text-slate-500 mt-4">
        Once connected, Autoaffi tracks your real data and updates your heatmap daily.
      </p>
    </section>
  );
}