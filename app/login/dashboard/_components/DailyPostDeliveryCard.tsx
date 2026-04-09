"use client";

import { useEffect, useState } from "react";

type DeliveryState = {
  enabled: boolean;
  email: string | null;
  next_run_label?: string | null;
  latest_day_key?: string | null;
  preview_subject?: string | null;
};

export default function DailyPostDeliveryCard({
  creatorMode,
  plan,
}: {
  creatorMode: "beginner" | "consistent" | "growth";
  plan: "basic" | "pro" | "elite";
}) {
  const [state, setState] = useState<DeliveryState>({
    enabled: false,
    email: null,
    next_run_label: null,
    latest_day_key: null,
    preview_subject: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const res = await fetch(
          `/api/dashboard/daily-post-delivery?creatorMode=${creatorMode}&plan=${plan}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const json = await res.json();

        if (!mounted) return;

        if (res.ok) {
          setState({
            enabled: !!json.enabled,
            email: json.email ?? null,
            next_run_label: json.next_run_label ?? null,
            latest_day_key: json.latest_day_key ?? null,
            preview_subject: json.preview_subject ?? null,
          });
        }
      } catch {
        // silent fail for now
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [creatorMode, plan]);

  async function toggleDelivery(next: boolean) {
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/dashboard/daily-post-delivery", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enabled: next,
          creatorMode,
          plan,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setMessage(json.error || "Something went wrong.");
        return;
      }

      setState({
        enabled: !!json.enabled,
        email: json.email ?? null,
        next_run_label: json.next_run_label ?? null,
        latest_day_key: json.latest_day_key ?? null,
        preview_subject: json.preview_subject ?? null,
      });

      setMessage(
        next
          ? "Daily Post Delivery enabled."
          : "Daily Post Delivery turned off."
      );
    } catch {
      setMessage("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-yellow-400/20 bg-yellow-500/5 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-yellow-300">
            Daily Post Delivery
          </p>

          <h3 className="mt-1 text-sm font-semibold text-slate-100">
            Do you want help with your posting?
          </h3>

          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-slate-300">
            Register your email account and we will automatically send over a new
            copy-paste daily post every day after midnight — ready to post
            directly on your platform.
          </p>

          {!loading && state.email && (
            <p className="mt-2 text-[11px] text-slate-400">
              Delivery email: <span className="text-slate-200">{state.email}</span>
            </p>
          )}

          {!loading && state.preview_subject && (
            <p className="mt-1 text-[11px] text-slate-500">
              Next email preview: <span className="text-slate-300">{state.preview_subject}</span>
            </p>
          )}

          {!loading && state.next_run_label && (
            <p className="mt-1 text-[11px] text-slate-500">
              Next scheduled refresh: <span className="text-slate-300">{state.next_run_label}</span>
            </p>
          )}

          {message ? (
            <p className="mt-2 text-[11px] text-emerald-300">{message}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {loading ? (
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-300">
              Loading...
            </span>
          ) : state.enabled ? (
            <>
              <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-200">
                Enabled
              </span>

              <button
                onClick={() => toggleDelivery(false)}
                disabled={saving}
                className="rounded-full border border-slate-600 px-3 py-1 text-[11px] font-medium text-slate-200 hover:bg-white/5 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Turn Off"}
              </button>
            </>
          ) : (
            <button
              onClick={() => toggleDelivery(true)}
              disabled={saving}
              className="rounded-full border border-yellow-400/40 bg-gradient-to-r from-yellow-400 to-yellow-600 px-4 py-1.5 text-[11px] font-semibold text-slate-900 hover:brightness-110 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Enable Daily Delivery"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}