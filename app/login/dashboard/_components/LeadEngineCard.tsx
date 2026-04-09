"use client";

import { useEffect, useState } from "react";

type LeadSignal = {
  id: string;
  source: string;
  source_url: string | null;
  snippet: string;
  author_hint: string | null;
  temperature: "HOT" | "WARM" | "COLD";
  score: number;
  why: string[];
  created_at: string;
};

type ManualScanResult = {
  snippet: string;
  source: string;
  temperature: "HOT" | "WARM" | "COLD";
  score: number;
  why: string[];
  dm_opener: string;
  follow_up: string;
};

function tempClasses(temp: "HOT" | "WARM" | "COLD") {
  if (temp === "HOT") {
    return "border-red-400/25 bg-red-500/10 text-red-200";
  }

  if (temp === "WARM") {
    return "border-amber-400/25 bg-amber-500/10 text-amber-200";
  }

  return "border-slate-500/25 bg-slate-500/10 text-slate-200";
}

function tempSummary(temp: "HOT" | "WARM" | "COLD") {
  if (temp === "HOT") return "Good chance to get a new customer.";
  if (temp === "WARM") return "Solid intent signal, but trust/timing matters.";
  return "Weak signal right now — lower priority.";
}

function sourceLabel(source: string) {
  const lower = source.toLowerCase();
  if (lower === "x") return "X";
  if (lower === "reddit") return "Reddit";
  if (lower === "instagram") return "Instagram";
  if (lower === "tiktok") return "TikTok";
  return source;
}

export default function LeadEngineCard() {
  const [signals, setSignals] = useState<LeadSignal[]>([]);
  const [loading, setLoading] = useState(true);

  const [input, setInput] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [scanResult, setScanResult] = useState<ManualScanResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const res = await fetch("/api/dashboard/lead-engine", {
          method: "GET",
          cache: "no-store",
        });

        const json = await res.json();

        if (!mounted) return;

        if (res.ok) {
          setSignals(Array.isArray(json.items) ? json.items : []);
        }
      } catch {
        // silent for now
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleScan() {
    if (!input.trim()) return;

    setScanLoading(true);
    setScanResult(null);

    try {
      const res = await fetch("/api/dashboard/lead-engine", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input }),
      });

      const json = await res.json();

      if (res.ok) {
        setScanResult(json.result);
      }
    } catch {
      // silent for now
    } finally {
      setScanLoading(false);
    }
  }

  async function copyText(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1200);
    } catch {
      // silent for now
    }
  }

  return (
    <section className="mb-8 grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-5 shadow-[0_18px_40px_rgba(0,0,0,0.7)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-yellow-300">
              Daily Lead Engine
            </p>

            <h3 className="mt-2 text-lg font-semibold text-slate-100">
              Daily Lead Signals
            </h3>

            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Fresh lead opportunities refreshed daily after midnight. These are
              intent-based signals surfaced by the dashboard refresh engine to help
              you spot people who may be open to a conversation about income,
              change or affiliate growth.
            </p>

            <p className="mt-2 text-[12px] text-slate-500">
              HOT = good chance to get a new customer. WARM = real interest, but
              needs better timing or trust.
            </p>
          </div>

          <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-200">
            LIVE
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-400">
              Loading lead signals...
            </div>
          ) : signals.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
              <p className="text-sm font-medium text-slate-200">
                No live lead signals yet
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
                The lead feed updates automatically after the dashboard refresh run.
                When fresh signals are available, they will appear here.
              </p>
            </div>
          ) : (
            signals.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-white/10 bg-slate-950/40 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${tempClasses(
                      item.temperature
                    )}`}
                  >
                    {item.temperature}
                  </span>

                  <div className="text-right text-[11px] text-slate-500">
                    Score {item.score}
                  </div>
                </div>

                <p className="mt-2 text-[11px] font-medium text-slate-300">
                  {tempSummary(item.temperature)}
                </p>

                <p className="mt-3 text-[13px] leading-relaxed text-slate-200">
                  {item.snippet}
                </p>

                <p className="mt-2 text-[11px] text-slate-400">
                  Source: <span className="text-slate-200">{sourceLabel(item.source)}</span>
                  {item.author_hint ? (
                    <>
                      {" "}
                      • Author:{" "}
                      <span className="text-slate-200">{item.author_hint}</span>
                    </>
                  ) : null}
                </p>

                {item.why?.length ? (
                  <div className="mt-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                      Why this signal was scored this way
                    </p>
                    <ul className="mt-2 space-y-1 text-[11px] text-slate-400">
                      {item.why.slice(0, 3).map((reason, idx) => (
                        <li key={`${reason}-${idx}`}>• {reason}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  {item.source_url ? (
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-slate-200 hover:bg-white/5"
                    >
                      Open
                    </a>
                  ) : null}

                  <button
                    onClick={() =>
                      copyText(
                        `dm-${item.id}`,
                        `Hey — I saw your post and it sounded like you’re looking for a real way to improve your income. Totally get that. I use a simple content + affiliate system that keeps things clear and low-pressure. Want the simple version?`
                      )
                    }
                    className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-slate-200 hover:bg-white/5"
                  >
                    {copied === `dm-${item.id}` ? "Copied ✓" : "Copy DM"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-5 shadow-[0_18px_40px_rgba(0,0,0,0.7)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-yellow-300">
              Lead Scanner
            </p>

            <h3 className="mt-2 text-lg font-semibold text-slate-100">
              IG / TikTok / Social Lead Scanner
            </h3>

            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Paste a copied caption, bio, comment, text snippet, username or a
              public link. Autoaffi will score the intent signal and generate a
              suggested DM opener.
            </p>

            <p className="mt-2 text-[12px] text-yellow-300">
              If the link won’t work, copy the text instead.
            </p>

            <p className="mt-1 text-[12px] text-slate-500">
              Best results come from pasted text. Public links may work, but some
              platforms can limit what is readable automatically.
            </p>
          </div>

          <span className="rounded-full border border-yellow-400/25 bg-yellow-500/10 px-3 py-1 text-[11px] font-medium text-yellow-200">
            READY
          </span>
        </div>

        <div className="mt-4">
          <label className="mb-2 block text-[11px] uppercase tracking-[0.18em] text-slate-400">
            Paste text / username / public link
          </label>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={5}
            placeholder="Paste a caption, bio, comment, username or public link here..."
            className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-yellow-400/40"
          />

          <div className="mt-3 flex gap-2">
            <button
              onClick={handleScan}
              disabled={scanLoading || !input.trim()}
              className="rounded-full border border-yellow-400/40 bg-gradient-to-r from-yellow-400 to-yellow-600 px-4 py-1.5 text-[11px] font-semibold text-slate-900 hover:brightness-110 disabled:opacity-60"
            >
              {scanLoading ? "Analyzing..." : "Analyze Lead"}
            </button>

            <button
              onClick={() => {
                setInput("");
                setScanResult(null);
              }}
              className="rounded-full border border-white/10 px-4 py-1.5 text-[11px] text-slate-200 hover:bg-white/5"
            >
              Clear
            </button>
          </div>
        </div>

        {scanResult && (
          <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <span
                className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${tempClasses(
                  scanResult.temperature
                )}`}
              >
                {scanResult.temperature}
              </span>

              <span className="text-[11px] text-slate-400">
                Score {scanResult.score}
              </span>
            </div>

            <p className="mt-2 text-[11px] font-medium text-slate-300">
              {tempSummary(scanResult.temperature)}
            </p>

            <p className="mt-3 text-[13px] leading-relaxed text-slate-200">
              {scanResult.snippet}
            </p>

            <div className="mt-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                Why this lead was scored this way
              </p>
              <ul className="mt-2 space-y-1 text-[11px] text-slate-400">
                {scanResult.why.map((reason, idx) => (
                  <li key={`${reason}-${idx}`}>• {reason}</li>
                ))}
              </ul>
            </div>

            <div className="mt-4 rounded-lg border border-white/10 bg-slate-900/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                  Suggested DM opener
                </p>

                <button
                  onClick={() => copyText("opener", scanResult.dm_opener)}
                  className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/10"
                >
                  {copied === "opener" ? "Copied ✓" : "Copy"}
                </button>
              </div>

              <pre className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-slate-200">
                {scanResult.dm_opener}
              </pre>
            </div>

            <div className="mt-3 rounded-lg border border-white/10 bg-slate-900/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                  Follow-up
                </p>

                <button
                  onClick={() => copyText("followup", scanResult.follow_up)}
                  className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/10"
                >
                  {copied === "followup" ? "Copied ✓" : "Copy"}
                </button>
              </div>

              <pre className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-slate-200">
                {scanResult.follow_up}
              </pre>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}