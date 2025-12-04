"use client";

interface Contact {
  name: string;
  status: "cold" | "warm" | "hot";
  source: string;
  lastTouch: string;
  nextStep: string;
}

const MOCK_CONTACTS: Contact[] = [
  {
    name: "Alex — TikTok DM",
    status: "warm",
    source: "TikTok",
    lastTouch: "Yesterday",
    nextStep: "Send funnel overview video",
  },
  {
    name: "Mia — MLGS lead",
    status: "hot",
    source: "MLGS",
    lastTouch: "Today",
    nextStep: "Book call / send checkout",
  },
  {
    name: "Jonas — FB Group",
    status: "cold",
    source: "Facebook",
    lastTouch: "3 days ago",
    nextStep: "Reply to comment with value",
  },
];

function statusColor(status: Contact["status"]) {
  if (status === "hot") return "bg-emerald-500/20 text-emerald-300 border-emerald-400/40";
  if (status === "warm") return "bg-yellow-500/20 text-yellow-300 border-yellow-400/40";
  return "bg-slate-700/40 text-slate-200 border-slate-600/60";
}

export default function ContactManager() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 text-slate-50">
      <header className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
          Leads · CRM
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          Contact Manager — simple pipeline for warm leads
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          This is where you’ll track DMs, comments, and funnel leads you
          actually want to follow up with.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-[0_20px_40px_rgba(0,0,0,0.6)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-50">
            Pipeline (mock preview)
          </h2>
          <p className="text-[11px] text-slate-500">
            The layout is ready — real data will plug in later.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {["cold", "warm", "hot"].map((stage) => (
            <div key={stage} className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3">
              <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-slate-400">
                {stage === "cold"
                  ? "Cold / New"
                  : stage === "warm"
                  ? "Warm / Engaged"
                  : "Hot / Close"}
              </p>

              <div className="space-y-3">
                {MOCK_CONTACTS.filter((c) => c.status === stage).map((c) => (
                  <div
                    key={c.name}
                    className={`rounded-lg border px-3 py-2 text-[12px] ${statusColor(
                      c.status
                    )}`}
                  >
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-slate-300">Source: {c.source}</p>
                    <p className="text-slate-400 text-[11px]">
                      Last touch: {c.lastTouch}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-200">
                      Next step: <span className="font-semibold">{c.nextStep}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-4 text-[12px] text-slate-500">
        This CRM is intentionally simple. Autoaffi will later add reminders,
        tags and automation on top of this base.
      </p>
    </main>
  );
}