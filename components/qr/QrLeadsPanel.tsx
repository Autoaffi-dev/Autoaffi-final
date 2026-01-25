"use client";

import React from "react";
import { fetchQrLeads, type QrLead } from "@/app/lib/qr/leadsClient";

function fmtDate(ts?: string | null) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleString();
  } catch {
    return ts;
  }
}

export default function QrLeadsPanel({
  userId,
  days = 30,
  limit = 50,
}: {
  userId: string;
  days?: number;
  limit?: number;
}) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<QrLead[]>([]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchQrLeads({ userId, days, limit });
      setItems(data.items || []);
    } catch (e: any) {
      setError(e?.message || "Kunde inte hämta leads");
    } finally {
      setLoading(false);
    }
  }, [userId, days, limit]);

  React.useEffect(() => {
    if (!userId) return;
    load();
  }, [userId, load]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">Leads</div>
          <div className="text-xs text-white/60">Senaste {days} dagar</div>
        </div>

        <button
          onClick={load}
          className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15"
        >
          Uppdatera
        </button>
      </div>

      <div className="mt-4">
        {loading && (
          <div className="text-sm text-white/60">Laddar leads…</div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/60">
            Inga leads ännu.
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="mt-2 space-y-3">
            {items.map((l) => (
              <div
                key={l.id}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">
                      {l.name || "Lead"}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-white/70">
                      {l.email ? (
                        <span className="rounded-full bg-white/10 px-2 py-1">
                          {l.email}
                        </span>
                      ) : null}
                      {l.phone ? (
                        <span className="rounded-full bg-white/10 px-2 py-1">
                          {l.phone}
                        </span>
                      ) : null}
                      {l.token ? (
                        <span className="rounded-full bg-white/10 px-2 py-1">
                          token: {l.token}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="shrink-0 text-xs text-white/50">
                    {fmtDate(l.ts)}
                  </div>
                </div>

                {l.message ? (
                  <div className="mt-3 whitespace-pre-wrap text-sm text-white/80">
                    {l.message}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}