"use client";

interface LeadSourceSummary {
  name: string;
  leadsToday: number;
  leads7d: number;
  network: string;
}

const MOCK_SOURCES: LeadSourceSummary[] = [
  { name: "MLGS", leadsToday: 3, leads7d: 21, network: "Email" },
  { name: "MyLead", leadsToday: 1, leads7d: 9, network: "CPL" },
  { name: "CPAlead", leadsToday: 0, leads7d: 4, network: "CPC" },
];

export default function LeadsHub() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 text-slate-50">
      <header className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
          Data · Leads
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          Leads Hub — all your leads in one place
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          This view will unify leads from MLGS, MyLead, CPAlead and more. The
          mock data below shows the structure Autoaffi will use.
        </p>
      </header>

      <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-[0_20px_40px_rgba(0,0,0,0.6)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-50">
            Source overview (mock data)
          </h2>
          <p className="text-[11px] text-slate-500">
            Real connections will appear here once integrations are live.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/40">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-900/80 text-[11px] uppercase tracking-[0.16em] text-slate-400">
              <tr>
                <th className="px-4 py-2">Source</th>
                <th className="px-4 py-2">Network</th>
                <th className="px-4 py-2">Leads Today</th>
                <th className="px-4 py-2">Last 7 Days</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_SOURCES.map((src) => (
                <tr
                  key={src.name}
                  className="border-t border-slate-800/60 text-[13px] text-slate-200"
                >
                  <td className="px-4 py-2 font-semibold">{src.name}</td>
                  <td className="px-4 py-2 text-slate-400">{src.network}</td>
                  <td className="px-4 py-2">{src.leadsToday}</td>
                  <td className="px-4 py-2">{src.leads7d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-[12px] text-slate-500">
        This page is a design-ready mock. Once APIs are wired, Autoaffi will
        pull real leads and connect them to campaigns, funnels and contacts.
      </p>
    </main>
  );
}