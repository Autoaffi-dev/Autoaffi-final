"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  OfferSearchResult,
  OfferSource,
  searchOffersClient,
} from "@/lib/offers/searchOffersClient";

type Props = {
  title?: string;

  // Optional: if you want parent to decide what happens when user clicks "Add"
  onPick?: (item: OfferSearchResult) => Promise<void> | void;

  // Optional: if set, this component will POST the picked item to that endpoint.
  // Example later: "/api/offers/select"
  persistEndpoint?: string;

  // Optional: initial filters
  defaultSources?: OfferSource[];
  defaultLimit?: number;

  // Optional: show compact (for Reels/Posts)
  variant?: "default" | "compact";
};

const ALL_SOURCES: OfferSource[] = ["awin", "cj", "rakuten", "warriorplus", "aliexpress"];

function cx(...arr: Array<string | false | null | undefined>) {
  return arr.filter(Boolean).join(" ");
}

function formatPrice(p?: number | null, c?: string | null) {
  if (!p || !Number.isFinite(p)) return null;
  const cur = (c || "").trim() || "";
  return `${p}${cur ? " " + cur : ""}`;
}

export default function OfferSearchPanel({
  title = "Sök i globala katalogen",
  onPick,
  persistEndpoint,
  defaultSources,
  defaultLimit,
  variant = "default",
}: Props) {
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState<number>(defaultLimit ?? 20);
  const [sources, setSources] = useState<OfferSource[]>(defaultSources?.length ? defaultSources : ALL_SOURCES);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<OfferSearchResult[]>([]);
  const [pickedId, setPickedId] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<any>(null);

  const canSearch = useMemo(() => q.trim().length >= 2, [q]);

  const panelPad = variant === "compact" ? "p-3" : "p-4";
  const titleSize = variant === "compact" ? "text-xs" : "text-[11px]";
  const gridCols = variant === "compact" ? "" : "md:grid-cols-2";

  async function persistPick(item: OfferSearchResult) {
    if (!persistEndpoint) return;
    const res = await fetch(persistEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(t || "Could not save selection");
    }
  }

  async function handlePick(item: OfferSearchResult) {
    try {
      setPickedId(item.external_id);
      setErr(null);

      if (onPick) await onPick(item);
      if (persistEndpoint) await persistPick(item);
    } catch (e: any) {
      setErr(e?.message || "Kunde inte spara valet.");
    } finally {
      setTimeout(() => setPickedId(null), 700);
    }
  }

  async function runSearch(nextQ: string) {
    const query = nextQ.trim();
    if (query.length < 2) {
      setItems([]);
      setErr(null);
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      setLoading(true);
      setErr(null);

      const res = await searchOffersClient(
        {
          q: query,
          limit,
          sources,
        },
        ctrl.signal
      );

      setItems(Array.isArray(res.results) ? res.results : []);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setErr(e?.message || "Sökningen misslyckades.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // debounce typing
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(q), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, limit, sources.join(",")]);

  const sourceLabel = (s: OfferSource) => {
    if (s === "warriorplus") return "WarriorPlus";
    if (s === "aliexpress") return "AliExpress";
    return s.toUpperCase();
  };

  return (
    <section className={cx("rounded-3xl border border-slate-800/80 bg-slate-950/80 shadow-[0_18px_50px_rgba(0,0,0,0.7)]", panelPad)}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className={cx(titleSize, "font-semibold uppercase tracking-[0.2em] text-yellow-300")}>{title}</p>
          <p className="mt-1 text-[11px] text-slate-400">
            Sök produkter globalt. Klicka <span className="text-yellow-300 font-semibold">Add</span> för att spara i Affiliate Offers (eller skicka till Reels/Posts).
          </p>
        </div>
      </div>

      <div className={cx("grid gap-3", gridCols)}>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
          <label className="block text-[11px] text-slate-200">
            <span className="mb-1 block">Sökterm</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="t.ex. phone case, gadgets, fitness..."
              className="mt-0.5 w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-[12px] text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-400/70 focus:border-yellow-400/60"
            />
          </label>

          <div className="mt-3 flex items-center justify-between gap-2">
            <label className="text-[11px] text-slate-300">
              Limit
              <select
                value={String(limit)}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="ml-2 rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-1 text-[11px] text-slate-100"
              >
                {[10, 20, 30, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>

            <span className="text-[11px] text-slate-500">
              {loading ? "Söker..." : canSearch ? `${items.length} resultat` : "Minst 2 tecken"}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
          <p className="text-[11px] text-slate-200 mb-2">Källor</p>
          <div className="flex flex-wrap gap-2">
            {ALL_SOURCES.map((s) => {
              const active = sources.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSources((prev) => {
                      const has = prev.includes(s);
                      const next = has ? prev.filter((x) => x !== s) : prev.concat(s);
                      return next.length ? next : prev; // never allow empty
                    });
                  }}
                  className={cx(
                    "rounded-full px-3 py-1 text-[11px] font-semibold transition",
                    active
                      ? "bg-yellow-400 text-slate-900"
                      : "border border-slate-700 bg-slate-950/60 text-slate-200 hover:border-yellow-400/40"
                  )}
                >
                  {sourceLabel(s)}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Tips: håll färre källor aktiva för snabbare och mer relevanta sök.
          </p>
        </div>
      </div>

      {err && (
        <div className="mt-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3 text-[11px] text-rose-100">
          {err}
        </div>
      )}

      <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-2">
        {loading && !items.length ? (
          <div className="p-3 text-[11px] text-slate-400">Söker i katalogen...</div>
        ) : !items.length ? (
          <div className="p-3 text-[11px] text-slate-500">
            Inga resultat än. Prova en annan sökterm (t.ex. “gadgets”, “home”, “fitness”, “beauty”).
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => {
              const price = formatPrice(it.price, it.currency);
              const source = sourceLabel(it.source as OfferSource);
              const busy = pickedId === it.external_id;

              return (
                <li key={it.external_id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                  <div className="flex gap-3">
                    <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
                      {it.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.image_url} alt={it.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full grid place-items-center text-[10px] text-slate-500">No img</div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[12px] font-semibold text-slate-50 truncate">{it.title}</p>
                          <p className="mt-0.5 text-[11px] text-slate-400 truncate">
                            {it.merchant_name ? it.merchant_name : "Merchant okänd"}
                            {it.category ? ` • ${it.category}` : ""}
                            {price ? ` • ${price}` : ""}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-yellow-400/40 bg-yellow-400/10 px-2 py-0.5 text-[10px] font-semibold text-yellow-200">
                            {source}
                          </span>

                          <button
                            type="button"
                            onClick={() => handlePick(it)}
                            disabled={busy}
                            className={cx(
                              "rounded-full px-3 py-1 text-[11px] font-semibold shadow-md transition",
                              busy
                                ? "bg-slate-700 text-slate-200 opacity-70"
                                : "bg-gradient-to-r from-yellow-400 to-yellow-600 text-slate-900 hover:brightness-110"
                            )}
                          >
                            {busy ? "Added" : "Add"}
                          </button>
                        </div>
                      </div>

                      {it.winner_tier ? (
                        <p className="mt-2 text-[10px] text-slate-500">
                          Tier: <span className="text-slate-200 font-semibold">{it.winner_tier}</span>
                          {typeof it.quality_score === "number" ? ` • Score: ${it.quality_score}` : ""}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
