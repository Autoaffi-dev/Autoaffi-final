"use client";

import React from "react";
import { fetchQrOverview, type QrOverviewItem } from "@/app/lib/qr/overviewClient";

function fmtDate(ts?: string | null) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

export default function QrOverviewPanel({
  userId,
  offerKey,
  days = 30,
  limit = 10,
}: {
  userId: string;
  offerKey: string;
  days?: number;
  limit?: number;
}) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<QrOverviewItem[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);

  const load = React.useCallback(
    async (next?: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchQrOverview({
          userId,
          offerKey,
          days,
          limit,
          cursor: next ?? null,
        });
        setItems(data.items || []);
        setCursor(next ?? null);
        setNextCursor(data.next_cursor ?? null);
      } catch (e: any) {
        setError(e?.message || "Kunde inte hämta overview");
      } finally {
        setLoading(false);
      }
    },
    [userId, offerKey, days, limit]
  );

  React.useEffect(() => {
    if (!userId) return;
    load(null);
  }, [userId, load]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">QR Overview</div>
          <div className="text-xs text-white/60">
            Offer: <span className="text-white/80">{offerKey}</span> · senaste {days} dagar
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => load(null)}
            className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15"
          >
            Uppdatera
          </button>

          <button
            disabled={!nextCursor || loading}
            onClick={() => load(nextCursor)}
            className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15 disabled:opacity-40"
          >
            Nästa
          </button>
        </div>
      </div>

      <div className="mt-4">
        {loading && <div className="text-sm text-white/60">Laddar…</div>}

        {!loading && error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/60">
            Inga items ännu.
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="space-y-3">
            {items.map((it) => (
              <div key={it.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">
                      {it.product_type} · {it.destination_mode}
                    </div>

                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-white/70">
                      <span className="rounded-full bg-white/10 px-2 py-1">token: {it.token}</span>
                      <span className="rounded-full bg-white/10 px-2 py-1">slug: {it.slug}</span>
                      {it.destination_url ? (
                        <span className="rounded-full bg-white/10 px-2 py-1 truncate max-w-[280px]">
                          {it.destination_url}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="shrink-0 text-xs text-white/50">{fmtDate(it.ts)}</div>
                </div>
              </div>
            ))}

            <div className="pt-2 text-xs text-white/50">
              cursor: {cursor ?? "null"} · next_cursor: {nextCursor ?? "null"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}