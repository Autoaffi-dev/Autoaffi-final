"use client";

import { useEffect, useMemo, useState } from "react";

type LeadTemperature = "HOT" | "WARM" | "COLD";
type LeadStatus = "new" | "saved" | "contacted" | "ignored" | "dismissed";

type LeadSignal = {
  id: string;

  source: string;
  source_platform?: string | null;
  source_type?: string | null;
  external_id?: string | null;

  source_url: string | null;
  source_title?: string | null;
  source_channel?: string | null;

  snippet: string;
  source_text?: string;

  author_hint: string | null;
  source_username?: string | null;
  source_author_url?: string | null;

  temperature: LeadTemperature;
  score: number;

  why: string[];
  why_matched?: string[];

  suggested_opener?: string | null;
  dm_opener?: string | null;
  follow_up?: string | null;

  tags?: string[];
  status?: LeadStatus;

  created_at: string;
  updated_at?: string | null;
};

type ManualScanResult = {
  snippet: string;
  source: string;
  source_platform?: string;
  source_type?: string;
  temperature: LeadTemperature;
  score: number;
  why: string[];
  why_matched?: string[];
  dm_opener: string;
  suggested_opener?: string;
  follow_up: string;
  status?: LeadStatus;
};

function tempClasses(temp: LeadTemperature) {
  if (temp === "HOT") {
    return "border-red-400/30 bg-red-500/10 text-red-200";
  }

  if (temp === "WARM") {
    return "border-amber-400/30 bg-amber-500/10 text-amber-200";
  }

  return "border-slate-500/30 bg-slate-500/10 text-slate-200";
}

function statusClasses(status: LeadStatus) {
  if (status === "saved") {
    return "border-yellow-400/30 bg-yellow-500/10 text-yellow-200";
  }

  if (status === "contacted") {
    return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  }

  if (status === "ignored") {
    return "border-slate-500/30 bg-slate-500/10 text-slate-300";
  }

  if (status === "dismissed") {
    return "border-red-400/30 bg-red-500/10 text-red-200";
  }

  return "border-blue-400/30 bg-blue-500/10 text-blue-200";
}

function tempSummary(temp: LeadTemperature) {
  if (temp === "HOT") return "High intent. Prioritize this conversation.";
  if (temp === "WARM") return "Solid signal. Needs trust, timing or softer approach.";
  return "Lower priority. Save only if it clearly fits your niche.";
}

function sourceLabel(source: string | null | undefined) {
  const lower = String(source || "").toLowerCase();

  if (lower === "x") return "X";
  if (lower === "reddit") return "Reddit";
  if (lower === "bluesky") return "Bluesky";
  if (lower === "youtube") return "YouTube";
  if (lower === "telegram") return "Telegram";
  if (lower === "instagram") return "Instagram";
  if (lower === "tiktok") return "TikTok";
  if (lower === "mlgs") return "Lead Source";
  if (lower === "manual_scan") return "Manual Scan";

  return source || "Unknown";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("sv-SE", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeStatus(value: string | null | undefined): LeadStatus {
  const clean = String(value || "").toLowerCase();

  if (clean === "saved") return "saved";
  if (clean === "contacted") return "contacted";
  if (clean === "ignored") return "ignored";
  if (clean === "dismissed") return "dismissed";

  return "new";
}

function getBestOpener(item: LeadSignal) {
  return (
    item.suggested_opener ||
    item.dm_opener ||
    `Hey — I saw your post and thought it was relevant. If you are trying to grow online, I’d focus on one clear offer, useful content, and proper tracking before adding more platforms.`
  );
}

function getFollowUp(item: LeadSignal) {
  if (item.follow_up) return item.follow_up;

  if (item.temperature === "HOT") {
    return "Quick check — do you want the simple version or the more complete setup? Reply SIMPLE or FULL and I’ll send the right one.";
  }

  if (item.temperature === "WARM") {
    return "Quick follow-up — still interested in a simple way to get started without overcomplicating it?";
  }

  return "No stress if now is not the right time — if you want the simple version later, just reply GO.";
}

export default function LeadEngineCard() {
  const [signals, setSignals] = useState<LeadSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusLoadingId, setStatusLoadingId] = useState<string | null>(null);

  const [input, setInput] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [scanResult, setScanResult] = useState<ManualScanResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stats = useMemo(() => {
    return {
      total: signals.length,
      hot: signals.filter((item) => item.temperature === "HOT").length,
      warm: signals.filter((item) => item.temperature === "WARM").length,
      new: signals.filter((item) => normalizeStatus(item.status) === "new").length,
    };
  }, [signals]);

  async function loadSignals(options?: { soft?: boolean }) {
    if (options?.soft) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const res = await fetch("/api/dashboard/lead-engine", {
        method: "GET",
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to load lead signals");
      }

      setSignals(Array.isArray(json.items) ? json.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leads");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        const res = await fetch("/api/dashboard/lead-engine", {
          method: "GET",
          cache: "no-store",
        });

        const json = await res.json();

        if (!mounted) return;

        if (res.ok) {
          setSignals(Array.isArray(json.items) ? json.items : []);
        } else {
          setError(json?.error || "Failed to load lead signals");
        }
      } catch {
        if (mounted) setError("Failed to load lead signals");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    run();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleScan() {
    if (!input.trim()) return;

    setScanLoading(true);
    setScanResult(null);
    setError(null);

    try {
      const res = await fetch("/api/dashboard/lead-engine", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to analyze lead");
      }

      setScanResult(json.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze lead");
    } finally {
      setScanLoading(false);
    }
  }

  async function updateStatus(id: string, status: LeadStatus) {
    setStatusLoadingId(id);
    setError(null);

    const previous = signals;

    setSignals((current) =>
      current
        .map((item) => (item.id === id ? { ...item, status } : item))
        .filter((item) => normalizeStatus(item.status) !== "dismissed")
    );

    try {
      const res = await fetch("/api/dashboard/lead-engine", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, status }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to update lead status");
      }
    } catch (err) {
      setSignals(previous);
      setError(err instanceof Error ? err.message : "Failed to update lead");
    } finally {
      setStatusLoadingId(null);
    }
  }

  async function copyText(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1200);
    } catch {
      setError("Could not copy text");
    }
  }

  return (
    <section className="mb-8 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-5 shadow-[0_18px_40px_rgba(0,0,0,0.7)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-yellow-300">
              Social Lead Engine
            </p>

            <h3 className="mt-2 text-lg font-semibold text-slate-100">
              Daily Lead Signals
            </h3>

            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              Real public intent signals from YouTube, Bluesky and Reddit. These
              leads are scored, deduped and protected by Autoaffi before they
              appear here.
            </p>

            <p className="mt-2 text-[12px] text-slate-500">
              Save strong leads for Lead Manager. Verify the conversation first —
              do not spam links.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-200">
              LIVE
            </span>

            <button
              type="button"
              onClick={() => loadSignals({ soft: true })}
              disabled={refreshing}
              className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-slate-200 hover:bg-white/5 disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              Total
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-100">
              {stats.total}
            </p>
          </div>

          <div className="rounded-xl border border-red-400/15 bg-red-500/5 p-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-red-300/80">
              Hot
            </p>
            <p className="mt-1 text-lg font-semibold text-red-100">
              {stats.hot}
            </p>
          </div>

          <div className="rounded-xl border border-amber-400/15 bg-amber-500/5 p-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-amber-300/80">
              Warm
            </p>
            <p className="mt-1 text-lg font-semibold text-amber-100">
              {stats.warm}
            </p>
          </div>

          <div className="rounded-xl border border-blue-400/15 bg-blue-500/5 p-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-blue-300/80">
              New
            </p>
            <p className="mt-1 text-lg font-semibold text-blue-100">
              {stats.new}
            </p>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

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
                The lead engine is connected. When the cron finds fresh qualified
                signals, they will appear here.
              </p>
            </div>
          ) : (
            signals.map((item) => {
              const status = normalizeStatus(item.status);
              const opener = getBestOpener(item);
              const tags = Array.isArray(item.tags) ? item.tags : [];
              const source = sourceLabel(item.source_platform || item.source);
              const isSaved = status === "saved";
              const isContacted = status === "contacted";

              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-white/10 bg-slate-950/40 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${tempClasses(
                          item.temperature
                        )}`}
                      >
                        {item.temperature}
                      </span>

                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase ${statusClasses(
                          status
                        )}`}
                      >
                        {status}
                      </span>

                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-slate-300">
                        {source}
                      </span>
                    </div>

                    <div className="text-left text-[11px] text-slate-500 sm:text-right">
                      <p>Score {item.score}</p>
                      {item.created_at ? <p>{formatDate(item.created_at)}</p> : null}
                    </div>
                  </div>

                  <p className="mt-2 text-[11px] font-medium text-slate-300">
                    {tempSummary(item.temperature)}
                  </p>

                  {item.source_title ? (
                    <p className="mt-3 text-[13px] font-semibold leading-relaxed text-slate-100">
                      {item.source_title}
                    </p>
                  ) : null}

                  <p className="mt-2 text-[13px] leading-relaxed text-slate-200">
                    {item.snippet}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
                    {item.source_channel ? (
                      <p>
                        Channel:{" "}
                        <span className="text-slate-200">
                          {item.source_channel}
                        </span>
                      </p>
                    ) : null}

                    {item.author_hint ? (
                      <p>
                        Author:{" "}
                        {item.source_author_url ? (
                          <a
                            href={item.source_author_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-200 underline decoration-white/20 underline-offset-2 hover:text-yellow-200"
                          >
                            {item.author_hint}
                          </a>
                        ) : (
                          <span className="text-slate-200">
                            {item.author_hint}
                          </span>
                        )}
                      </p>
                    ) : null}
                  </div>

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

                  {tags.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {tags.slice(0, 5).map((tag) => (
                        <span
                          key={`${item.id}-${tag}`}
                          className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-400"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-4 rounded-lg border border-yellow-400/15 bg-yellow-500/5 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-200">
                        Suggested message
                      </p>

                      <button
                        type="button"
                        onClick={() => copyText(`opener-${item.id}`, opener)}
                        className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/10"
                      >
                        {copied === `opener-${item.id}` ? "Copied ✓" : "Copy"}
                      </button>
                    </div>

                    <p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-slate-200">
                      {opener}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {item.source_url ? (
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-slate-200 hover:bg-white/5"
                      >
                        Open source
                      </a>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => copyText(`quick-opener-${item.id}`, opener)}
                      className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-slate-200 hover:bg-white/5"
                    >
                      {copied === `quick-opener-${item.id}`
                        ? "Copied ✓"
                        : "Copy message"}
                    </button>

                    <button
                      type="button"
                      onClick={() => updateStatus(item.id, "saved")}
                      disabled={statusLoadingId === item.id || isSaved}
                      className="rounded-full border border-yellow-400/25 px-3 py-1 text-[11px] text-yellow-200 hover:bg-yellow-500/10 disabled:opacity-60"
                    >
                      {isSaved ? "Saved ✓" : "Save"}
                    </button>

                    <button
                      type="button"
                      onClick={() => updateStatus(item.id, "contacted")}
                      disabled={statusLoadingId === item.id || isContacted}
                      className="rounded-full border border-emerald-400/25 px-3 py-1 text-[11px] text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-60"
                    >
                      {isContacted ? "Contacted ✓" : "Contacted"}
                    </button>

                    <button
                      type="button"
                      onClick={() => updateStatus(item.id, "dismissed")}
                      disabled={statusLoadingId === item.id}
                      className="rounded-full border border-red-400/20 px-3 py-1 text-[11px] text-red-200 hover:bg-red-500/10 disabled:opacity-60"
                    >
                      Hide
                    </button>
                  </div>
                </div>
              );
            })
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
              Paste a copied caption, bio, comment, text snippet, username or
              public link. Autoaffi scores the signal and creates a soft opener.
            </p>

            <p className="mt-2 text-[12px] text-yellow-300">
              Best results come from pasted text.
            </p>

            <p className="mt-1 text-[12px] text-slate-500">
              Public links may work, but some platforms limit what can be read
              automatically.
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
              type="button"
              onClick={handleScan}
              disabled={scanLoading || !input.trim()}
              className="rounded-full border border-yellow-400/40 bg-gradient-to-r from-yellow-400 to-yellow-600 px-4 py-1.5 text-[11px] font-semibold text-slate-900 hover:brightness-110 disabled:opacity-60"
            >
              {scanLoading ? "Analyzing..." : "Analyze Lead"}
            </button>

            <button
              type="button"
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
                {scanResult.why.slice(0, 4).map((reason, idx) => (
                  <li key={`${reason}-${idx}`}>• {reason}</li>
                ))}
              </ul>
            </div>

            <div className="mt-4 rounded-lg border border-white/10 bg-slate-900/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                  Suggested message
                </p>

                <button
                  type="button"
                  onClick={() =>
                    copyText(
                      "manual-opener",
                      scanResult.suggested_opener || scanResult.dm_opener
                    )
                  }
                  className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/10"
                >
                  {copied === "manual-opener" ? "Copied ✓" : "Copy"}
                </button>
              </div>

              <pre className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-slate-200">
                {scanResult.suggested_opener || scanResult.dm_opener}
              </pre>
            </div>

            <div className="mt-3 rounded-lg border border-white/10 bg-slate-900/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                  Follow-up
                </p>

                <button
                  type="button"
                  onClick={() => copyText("manual-followup", scanResult.follow_up)}
                  className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/10"
                >
                  {copied === "manual-followup" ? "Copied ✓" : "Copy"}
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