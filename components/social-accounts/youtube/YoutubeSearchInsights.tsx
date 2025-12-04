"use client";

import { useState } from "react";

type Keyword = {
  term: string;
  position: number;
  volume: string;
  difficulty: "Easy" | "Medium" | "Hard";
  clickRate: string;
};

const MOCK_KEYWORDS: Keyword[] = [
  {
    term: "ai side hustles",
    position: 4,
    volume: "12.3k/mo",
    difficulty: "Medium",
    clickRate: "7.2%",
  },
  {
    term: "passive income 2025",
    position: 9,
    volume: "8.4k/mo",
    difficulty: "Hard",
    clickRate: "4.1%",
  },
  {
    term: "make money online beginners",
    position: 15,
    volume: "22.1k/mo",
    difficulty: "Hard",
    clickRate: "3.0%",
  },
  {
    term: "affiliate marketing step by step",
    position: 6,
    volume: "5.9k/mo",
    difficulty: "Medium",
    clickRate: "6.5%",
  },
];

export default function YouTubeSearchInsights() {
  const [selected, setSelected] = useState<Keyword | null>(MOCK_KEYWORDS[0]);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.7)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-red-300">
            Search & keyword insights
          </h2>
          <p className="mt-1 text-[11px] text-slate-400">
            See which topics you’re already ranking for – and where a small push
            could unlock big traffic.
          </p>
        </div>
        <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-red-300">
          Mock data
        </span>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/70">
        <table className="w-full text-[11px]">
          <thead className="bg-slate-950/60">
            <tr className="text-slate-400">
              <th className="px-3 py-2 text-left font-medium">Keyword</th>
              <th className="px-3 py-2 text-left font-medium">Position</th>
              <th className="px-3 py-2 text-left font-medium">Volume</th>
              <th className="px-3 py-2 text-left font-medium">Difficulty</th>
              <th className="px-3 py-2 text-left font-medium">CTR</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_KEYWORDS.map((kw) => {
              const isActive = selected?.term === kw.term;
              return (
                <tr
                  key={kw.term}
                  className={`cursor-pointer border-t border-slate-800/80 text-slate-200 transition hover:bg-slate-900/90 ${
                    isActive ? "bg-slate-900" : ""
                  }`}
                  onClick={() => setSelected(kw)}
                >
                  <td className="px-3 py-2 text-[11px]">{kw.term}</td>
                  <td className="px-3 py-2 text-[11px]">#{kw.position}</td>
                  <td className="px-3 py-2 text-[11px]">{kw.volume}</td>
                  <td className="px-3 py-2 text-[11px]">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] ${
                        kw.difficulty === "Easy"
                          ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/40"
                          : kw.difficulty === "Medium"
                          ? "bg-yellow-500/10 text-yellow-300 border border-yellow-500/40"
                          : "bg-red-500/10 text-red-300 border border-red-500/40"
                      }`}
                    >
                      {kw.difficulty}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[11px]">{kw.clickRate}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* DETAIL PANEL */}
      {selected && (
        <div className="mt-5 grid gap-4 md:grid-cols-3 text-[11px]">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Priority level
            </p>
            <p className="text-slate-200">
              {selected.position <= 5 ? (
                <>
                  Already ranking <span className="text-emerald-300">top 5</span>.{" "}
                  <span className="text-yellow-300">
                    Double down with new videos.
                  </span>
                </>
              ) : selected.position <= 15 ? (
                <>
                  <span className="text-yellow-300">Breakout potential.</span>{" "}
                  Small improvements could push this into top 10.
                </>
              ) : (
                <>
                  Long-term opportunity. Consider tighter angles or lower
                  competition keywords.
                </>
              )}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Suggested action
            </p>
            <ul className="space-y-1 text-slate-200">
              <li>• Create 1–2 new videos around “{selected.term}”.</li>
              <li>• Re-use hooks that already got good retention.</li>
              <li>• Add this keyword to your title & first 2 lines.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Autoaffi will soon…
            </p>
            <ul className="space-y-1 text-slate-300">
              <li>• Track keyword movements week-to-week.</li>
              <li>• Flag when a video starts ranking.</li>
              <li>• Suggest scripts purely for search intent.</li>
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}