"use client";

export default function FacebookTopPosts() {
  const fakePosts = [
    { title: "AI side-hustle breakdown", score: 92 },
    { title: "3 mistakes beginners make", score: 88 },
    { title: "My automation setup", score: 86 },
    { title: "Simple content funnel", score: 81 },
    { title: "Daily posting checklist", score: 78 },
  ];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 shadow-lg text-slate-200">
      <h3 className="text-sm font-semibold mb-3 text-yellow-300 tracking-wide">
        Top Posts (Facebook)
      </h3>

      <ul className="space-y-2">
        {fakePosts.map((p, i) => (
          <li
            key={i}
            className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs"
          >
            <span className="text-slate-300">{p.title}</span>
            <span className="text-yellow-400 font-bold">{p.score}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}