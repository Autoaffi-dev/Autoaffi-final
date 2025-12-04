"use client";

interface Suggestion {
  name: string;
  type: "group" | "page" | "profile";
  platform: "Facebook" | "TikTok" | "Instagram" | "YouTube";
  reason: string;
}

const MOCK_SUGGESTIONS: Suggestion[] = [
  {
    name: "Affiliate Creators — FB Group",
    type: "group",
    platform: "Facebook",
    reason: "High engagement on affiliate questions similar to your content.",
  },
  {
    name: "@sidehustle.ai",
    type: "profile",
    platform: "TikTok",
    reason: "Audience overlaps with your AI & affiliate angles.",
  },
  {
    name: "YouTube Automation & Funnels",
    type: "page",
    platform: "YouTube",
    reason: "Long-form audience interested in systems & recurring income.",
  },
];

export default function SmartSuggestionsList() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 text-slate-50">
      <header className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
          Growth · Discovery
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          Smart Suggestions — where to show up
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          These are mock examples of the kind of pages, groups and profiles
          Autoaffi will surface based on your niche and performance.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-[0_20px_40px_rgba(0,0,0,0.6)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-50">
            Suggested places to engage (mock data)
          </h2>
          <p className="text-[11px] text-slate-500">
            Real signals will come from your social & content data.
          </p>
        </div>

        <div className="space-y-3">
          {MOCK_SUGGESTIONS.map((sugg) => (
            <div
              key={sugg.name}
              className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 text-[13px]"
            >
              <div className="mb-1 flex items-center justify-between gap-3">
                <p className="font-semibold text-slate-50">{sugg.name}</p>
                <span className="rounded-full border border-slate-700/80 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-slate-400">
                  {sugg.platform} · {sugg.type}
                </span>
              </div>
              <p className="text-slate-300">{sugg.reason}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-4 text-[12px] text-slate-500">
        The goal here is to avoid spam and instead show you a shortlist of
        high-probability conversations worth joining.
      </p>
    </main>
  );
}