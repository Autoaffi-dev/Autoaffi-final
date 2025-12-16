"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type FunnelRow = {
  id: string;
  user_id: string;
  name: string;
  funnel_url: string;
  created_at: string;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function FunnelBuildersPage() {
  const [user, setUser] = useState<any>(null);
  const [funnels, setFunnels] = useState<FunnelRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "connected" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // -----------------------------
  // LOAD USER
  // -----------------------------
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user ?? null);
    });
  }, []);

  // -----------------------------
  // LOAD FUNNELS
  // -----------------------------
  useEffect(() => {
    if (!user?.id) return;

    async function loadFunnels() {
      setLoading(true);
      const { data } = await supabase
        .from("user_funnels")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setFunnels((data || []) as FunnelRow[]);
      setLoading(false);
    }

    loadFunnels();
  }, [user]);

  // -----------------------------
  // ADD FUNNEL
  // -----------------------------
  async function handleAddFunnel() {
    setError(null);
    setStatus("idle");

    if (!name.trim() || !url.trim()) {
      setError("Please enter a valid funnel name and URL.");
      setStatus("error");
      return;
    }

    try {
      const { error } = await supabase.from("user_funnels").insert({
        user_id: user.id,
        name: name.trim(),
        funnel_url: url.trim(),
      });

      if (error) throw error;

      setStatus("connected");
      setName("");
      setUrl("");

      const { data } = await supabase
        .from("user_funnels")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setFunnels((data || []) as FunnelRow[]);
    } catch {
      setStatus("error");
      setError(
        "Funnel could not be connected. Please double-check your funnel URL."
      );
    }
  }

  // -----------------------------
  // DELETE FUNNEL
  // -----------------------------
  async function handleDelete(id: string) {
    await supabase.from("user_funnels").delete().eq("id", id);
    setFunnels((prev) => prev.filter((f) => f.id !== id));
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-8">

        {/* HEADER */}
        <header>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 mb-2">
            Autoaffi Funnels
          </p>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
              Funnels — Connect your funnel link
            </span>
          </h1>
        </header>

<p className="mt-4 max-w-3xl text-sm text-slate-400 leading-relaxed">
  <span className="font-semibold text-emerald-300">
    Autoaffi Funnel Intelligence.
  </span>{" "}
  When you connect a funnel, Autoaffi automatically tracks clicks sent to your
  funnel, where the traffic comes from (post, reel or platform) and how each
  funnel performs over time. This gives you real data on which content actually
  converts into leads and customers — without touching or changing anything
  inside your existing funnel setup.
</p>

        {/* ADD FUNNEL */}
        <section className="rounded-2xl border border-yellow-500/40 bg-slate-900/80 p-5 shadow-[0_18px_40px_rgba(0,0,0,0.7)]">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-yellow-300 mb-1">
            Add a funnel
          </p>
          <p className="text-[11px] text-slate-400 mb-3">
            Works with every existing funnel — no rebuild required.
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Funnel name (e.g. HBA Core Funnel)"
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-funnel-url.com"
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </div>

          {status === "connected" && (
            <p className="mt-2 text-xs text-emerald-400">
              ✓ Funnel connected successfully
            </p>
          )}

          {status === "error" && error && (
            <p className="mt-2 text-xs text-red-400">{error}</p>
          )}

          <button
            onClick={handleAddFunnel}
            className="mt-4 rounded-xl bg-yellow-400 px-5 py-2 text-sm font-semibold text-slate-900 shadow hover:brightness-110"
          >
            Add funnel
          </button>
        </section>

        {/* CONNECTED FUNNELS */}
        {funnels.length > 0 && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400 mb-3">
              Connected funnel
            </p>

            {funnels.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-slate-100">{f.name}</p>
                  <p className="text-xs text-slate-500 break-all">
                    {f.funnel_url}
                  </p>
                </div>

                <button
                  onClick={() => handleDelete(f.id)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            ))}
          </section>
        )}

        {/* OPTIMIZATION TIPS */}
<div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-yellow-300">
    Funnel Optimization Tips
  </p>

  <div className="space-y-2">
    {/* 1 — HERO TIP */}
    <div className="group rounded-lg px-3 py-2.5 transition hover:bg-slate-800/40">
      <div className="flex items-start gap-2.5">
        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.4)]" />
        <div>
          <p className="text-[12px] font-semibold text-emerald-300">
            Focus on Tier-1 traffic (US, CA, UK, AU)
          </p>
          <p className="mt-0.5 text-[11px] text-slate-300">
            Higher buying power = better EPC, stronger backend performance and cleaner data.
          </p>
          <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">
            You can steer this by aligning your social account’s region, language,
            posting times and audience signals toward Tier-1 markets.
          </p>
        </div>
      </div>
    </div>

    {/* 2 */}
    <div className="group rounded-md px-3 py-1.5 transition hover:bg-slate-800/30">
      <div className="flex items-start gap-2">
        <span className="mt-1.5 h-1 w-1 rounded-full bg-emerald-300/80" />
        <div>
          <p className="text-[11.5px] font-semibold text-emerald-300">
            Feed ONE funnel consistently
          </p>
          <p className="text-[11px] text-slate-300">
            Don’t split traffic. One funnel creates clearer signals, stronger data
            and faster optimization.
          </p>
        </div>
      </div>
    </div>

    {/* 3 */}
    <div className="group rounded-md px-3 py-1.5 transition hover:bg-slate-800/30">
      <div className="flex items-start gap-2">
        <span className="mt-1.5 h-1 w-1 rounded-full bg-emerald-300/80" />
        <div>
          <p className="text-[11.5px] font-semibold text-emerald-300">
            Lead with value, not links
          </p>
          <p className="text-[11px] text-slate-300">
            Posts that educate or solve ONE specific problem convert better
            than direct promotions.
          </p>
        </div>
      </div>
    </div>

    {/* 4 */}
    <div className="group rounded-md px-3 py-1.5 transition hover:bg-slate-800/30">
      <div className="flex items-start gap-2">
        <span className="mt-1.5 h-1 w-1 rounded-full bg-emerald-300/80" />
        <div>
          <p className="text-[11.5px] font-semibold text-emerald-300">
            Use backend &amp; recurring offers
          </p>
          <p className="text-[11px] text-slate-300">
            Most funnel profits come after the opt-in. Recurring offers and
            upsells create stability — not luck.
          </p>
        </div>
      </div>
    </div>

    {/* 5 */}
    <div className="group rounded-md px-3 py-1.5 transition hover:bg-slate-800/30">
      <div className="flex items-start gap-2">
        <span className="mt-1.5 h-1 w-1 rounded-full bg-emerald-300/80" />
        <div>
          <p className="text-[11.5px] font-semibold text-emerald-300">
            Track what content sends buyers — not likes
          </p>
          <p className="text-[11px] text-slate-300">
            Views don’t pay bills. Autoaffi shows which posts and reels actually
            send traffic to your funnel.
          </p>
        </div>
      </div>
    </div>
  </div>
</div>

      </div>
    </main>
  );
}