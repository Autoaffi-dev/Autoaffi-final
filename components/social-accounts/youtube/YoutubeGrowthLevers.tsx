"use client";

const LEVERS = [
  {
    title: "Boost click-through rate",
    impact: "High",
    description:
      "Small thumbnail & title changes can double your traffic without posting more.",
    actions: [
      "Test a bold, curiosity-based title on your lowest CTR video.",
      "Add 1 strong emotion word (shocked, broke, stuck, etc.).",
      "Use a face + clear outcome text in your thumbnails.",
    ],
  },
  {
    title: "Fix early drop-off",
    impact: "High",
    description:
      "Most viewers decide in the first 10 seconds if they stay. That’s where we start.",
    actions: [
      "Open with the end result your viewer wants – not your name.",
      "Cut any intro fluff longer than 5 seconds.",
      "Use pattern-interrupts: zoom, text, b-roll every 3–5 seconds.",
    ],
  },
  {
    title: "Create a binge path",
    impact: "Medium",
    description:
      "Turn single videos into mini playlists so viewers naturally keep watching.",
    actions: [
      "Pick 1 main topic (e.g. 'AI hustles') and map 3–5 related videos.",
      "Link to the 'next step' video in your end screen + pinned comment.",
      "Use similar thumbnails so they feel like a series.",
    ],
  },
];

export default function YouTubeGrowthLevers() {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.7)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-red-300">
            Growth levers (YouTube)
          </h2>
          <p className="mt-1 text-[11px] text-slate-400">
            3 practical levers that move the needle the most – based on your
            upcoming Autoaffi data.
          </p>
        </div>
        <span className="rounded-full border border-yellow-500/40 bg-yellow-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-yellow-300">
          Elite preview
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {LEVERS.map((lever) => (
          <article
            key={lever.title}
            className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-[0_12px_32px_rgba(0,0,0,0.6)]"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <h3 className="text-xs font-semibold text-slate-50">
                {lever.title}
              </h3>
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
                {lever.impact} impact
              </span>
            </div>

            <p className="mb-3 text-[11px] text-slate-300">
              {lever.description}
            </p>

            <ul className="mb-3 space-y-1 text-[11px] text-slate-300">
              {lever.actions.map((a) => (
                <li key={a}>• {a}</li>
              ))}
            </ul>

            <p className="mt-auto text-[10px] text-slate-500">
              Soon: Autoaffi will generate <span className="text-yellow-300">
                personalized levers
              </span>{" "}
              based on your watch-time and click data.
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}