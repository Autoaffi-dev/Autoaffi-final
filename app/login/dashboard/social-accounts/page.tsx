"use client";

import { useState } from "react";
import Link from "next/link";
import AccountManageModal from "@/components/social-accounts/modals/AccountManageModal";

// PLATFORM TYPES
type PlatformKey = "tiktok" | "instagram" | "facebook" | "youtube" | "x" | "linkedin";
type Plan = "Basic" | "Pro" | "Elite";

type Account = {
  id: string;
  username: string;
  primary: boolean;
};

type PlatformState = {
  accounts: Account[];
  lastSynced?: string;
};

const PLATFORM_LABELS: Record<PlatformKey, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  x: "X (Twitter)",
  linkedin: "LinkedIn",
};

const PLATFORM_PLAN: Record<PlatformKey, Plan> = {
  tiktok: "Basic",
  instagram: "Basic",
  facebook: "Basic",
  youtube: "Basic",
  x: "Pro",
  linkedin: "Elite",
};

// vi antar Basic just nu – kan kopplas mot riktig plan senare
const ACTIVE_PLAN: Plan = "Basic";

const INITIAL_STATE: Record<PlatformKey, PlatformState> = {
  tiktok: { accounts: [] },
  instagram: { accounts: [] },
  facebook: { accounts: [] },
  youtube: { accounts: [] },
  x: { accounts: [] },
  linkedin: { accounts: [] },
};

export default function SocialAccountsPage() {
  const [platforms, setPlatforms] =
    useState<Record<PlatformKey, PlatformState>>(INITIAL_STATE);

  const [manageOpen, setManageOpen] = useState(false);
  const [managePlatform, setManagePlatform] = useState<PlatformKey | null>(null);

  // ---------------- PLAN LOCKING ----------------
  function isLocked(platform: PlatformKey): boolean {
    const neededPlan = PLATFORM_PLAN[platform];
    if (ACTIVE_PLAN === "Elite") return false;
    if (ACTIVE_PLAN === "Pro") {
      return neededPlan === "Elite";
    }
    // Basic
    return neededPlan === "Pro" || neededPlan === "Elite";
  }

  // ---------------- CONNECT / SYNC ----------------
  function handleConnect(platform: PlatformKey) {
    if (isLocked(platform)) return;

    setPlatforms((prev) => {
      const current = prev[platform];
      const hasAccounts = current.accounts.length > 0;

      // Första gången → skapa ett fejk-konto
      if (!hasAccounts) {
        const firstAccount: Account = {
          id: `acc-${platform}-1`,
          username: `${PLATFORM_LABELS[platform]} account`,
          primary: true,
        };

        return {
          ...prev,
          [platform]: {
            accounts: [firstAccount],
            lastSynced: "Just now",
          },
        };
      }

      // Redan ansluten → bara uppdatera "senast synkad"
      return {
        ...prev,
        [platform]: {
          ...current,
          lastSynced: "Just now",
        },
      };
    });
  }

  // ---------------- ADD ACCOUNT (+) ----------------
  function handleAddAccount(platform: PlatformKey) {
    if (isLocked(platform)) return;

    setPlatforms((prev) => {
      const current = prev[platform];
      if (current.accounts.length === 0) {
        return prev; // ska egentligen inte kunna hända, knappen är disabled i UI
      }

      const index = current.accounts.length + 1;
      const newAccount: Account = {
        id: `acc-${platform}-${index}`,
        username: `${PLATFORM_LABELS[platform]} #${index}`,
        primary: false,
      };

      return {
        ...prev,
        [platform]: {
          ...current,
          accounts: [...current.accounts, newAccount],
        },
      };
    });
  }

  // ---------------- MANAGE MODAL ----------------
  function handleManage(platform: PlatformKey) {
    const state = platforms[platform];
    if (state.accounts.length === 0) return;
    setManagePlatform(platform);
    setManageOpen(true);
  }

  function closeManage() {
    setManageOpen(false);
    setManagePlatform(null);
  }

  function handleModalAdd() {
    if (!managePlatform) return;
    handleAddAccount(managePlatform);
  }

  function handleModalRemove(id: string) {
    if (!managePlatform) return;
    setPlatforms((prev) => {
      const current = prev[managePlatform];
      const filtered = current.accounts.filter((acc) => acc.id !== id);

      if (filtered.length > 0 && !filtered.some((acc) => acc.primary)) {
        filtered[0] = { ...filtered[0], primary: true };
      }

      return {
        ...prev,
        [managePlatform]: {
          ...current,
          accounts: filtered,
        },
      };
    });
  }

  function handleModalSetPrimary(id: string) {
    if (!managePlatform) return;
    setPlatforms((prev) => {
      const current = prev[managePlatform];
      const updated = current.accounts.map((acc) => ({
        ...acc,
        primary: acc.id === id,
      }));
      return {
        ...prev,
        [managePlatform]: {
          ...current,
          accounts: updated,
        },
      };
    });
  }

  // ---------------- RENDER ----------------
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-slate-50 px-4 py-10">
      <div className="mx-auto max-w-6xl">
        {/* HEADER */}
        <header className="mb-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 mb-2">
              Social connections
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
                Connect your socials
              </span>
            </h1>
            <p className="mt-2 text-sm md:text-base text-slate-400 max-w-xl">
              Autoaffi never auto-DMs, never auto-likes and never posts without
              your consent. We only read safe analytics to help you grow smarter.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-xs text-slate-300 shadow-lg shadow-black/50 max-w-xs">
            <p className="font-semibold text-yellow-300 mb-1">
              What changes when you connect?
            </p>
            <ul className="space-y-1">
              <li>• Better Smart Suggestions & Viral Heads-Up</li>
              <li>• Real performance data for My Progress</li>
              <li>• Safer, platform-compliant optimization</li>
            </ul>
          </div>
        </header>

        {/* 3-STEP GUIDE */}
        <section className="mb-10 rounded-2xl border border-yellow-500/30 bg-slate-900/70 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.6)]">
          <h2 className="text-xs font-semibold uppercase tracking-[0.28em] text-yellow-300 mb-3">
            Start here – 3 steps
          </h2>

          <div className="grid gap-4 md:grid-cols-3 text-xs text-slate-200">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="mb-1 text-[11px] font-semibold text-yellow-300">
                Step 1 — Connect basics
              </p>
              <p>
                Start with{" "}
                <span className="font-semibold">
                  TikTok, Instagram, Facebook &amp; YouTube
                </span>
                . These give the strongest analytics boost.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="mb-1 text-[11px] font-semibold text-yellow-300">
                Step 2 — Add extra channels
              </p>
              <p>
                <span className="font-semibold">Pro</span> unlocks X and{" "}
                <span className="font-semibold">Elite</span> unlocks LinkedIn for
                advanced authority &amp; B2B growth.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="mb-1 text-[11px] font-semibold text-yellow-300">
                Step 3 — Let Autoaffi guide you
              </p>
              <p>
                Connected accounts power{" "}
                <span className="font-semibold">
                  Content Optimizer, Smart Suggestions, Viral Heads-Up
                </span>{" "}
                and <span className="font-semibold">My Progress</span>.
              </p>
            </div>
          </div>
        </section>

        {/* PLATFORM CARDS */}
        <section className="mb-12">
          <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-yellow-400 mb-2">
            Platforms & plans
          </h2>
          <p className="text-[11px] text-slate-500 mb-4">
            Basic users see everything — Pro &amp; Elite unlock more connections.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            {(Object.keys(PLATFORM_LABELS) as PlatformKey[]).map((platform) => {
              const label = PLATFORM_LABELS[platform];
              const plan = PLATFORM_PLAN[platform];
              const state = platforms[platform];
              const locked = isLocked(platform);
              const hasAccounts = state.accounts.length > 0;

              const connectLabel = locked
                ? "Upgrade to unlock"
                : hasAccounts
                ? "Sync analytics"
                : "Connect";

              const statusLabel = hasAccounts
                ? `${state.accounts.length} account${state.accounts.length > 1 ? "s" : ""} connected`
                : "Not connected yet";

              const lastSyncedLabel = hasAccounts
                ? state.lastSynced
                  ? `Last synced: ${state.lastSynced}`
                  : "Not synced yet"
                : "Sync will start after first connect";

              // mini "fake stats"
              const followersLabel = hasAccounts
                ? "Growing steadily"
                : "Visible after connect";
              const bestTimeLabel = hasAccounts
                ? "18:00–21:00 (your peak)"
                : "Calculated after sync";
              const trendLabel = hasAccounts
                ? "Strong fit for short-form"
                : "Analyzed from your content";

              return (
                <article
                  key={platform}
                  className={`flex flex-col rounded-2xl border bg-slate-900/70 p-4 shadow-[0_14px_40px_rgba(0,0,0,0.6)] transition-all ${
                    locked
                      ? "border-slate-800 opacity-85"
                      : "border-slate-800 hover:border-yellow-400/70 hover:bg-slate-900/90"
                  }`}
                >
                  {/* TOP ROW */}
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-50">
                        {label}
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Included in {plan}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {locked && (
                        <span className="rounded-full border border-yellow-500/60 bg-yellow-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-yellow-300">
                          {plan} feature
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400">
                        {statusLabel}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 mb-3">
                    Analytics & insights for {label}. Connect once — Autoaffi
                    keeps reading safe data in the background.
                  </p>

                  {/* MINI STATS */}
                  <div className="mb-4 grid grid-cols-3 gap-3 text-[11px] text-slate-300">
                    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500 mb-1">
                        Followers
                      </p>
                      <p className="font-semibold text-slate-100">
                        {followersLabel}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500 mb-1">
                        Best time
                      </p>
                      <p className="font-semibold text-slate-100">
                        {bestTimeLabel}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500 mb-1">
                        Trend fit
                      </p>
                      <p className="font-semibold text-slate-100">
                        {trendLabel}
                      </p>
                    </div>
                  </div>

                  {/* BUTTONS */}
                  <div className="mt-auto flex items-center gap-2">
                    {/* CONNECT / SYNC */}
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => handleConnect(platform)}
                      className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold transition ${
                        locked
                          ? "cursor-not-allowed border border-slate-700 text-slate-500"
                          : "border border-yellow-500 bg-gradient-to-r from-yellow-400 to-yellow-600 text-slate-900 hover:brightness-110"
                      }`}
                    >
                      {connectLabel}
                    </button>

                    {/* MANAGE */}
                    <button
                      type="button"
                      disabled={!hasAccounts}
                      onClick={() => handleManage(platform)}
                      className={`rounded-full px-3 py-2 text-[11px] font-medium border ${
                        !hasAccounts
                          ? "cursor-not-allowed border-slate-700 text-slate-600"
                          : "border-slate-700 text-slate-200 hover:border-yellow-400 hover:text-yellow-300"
                      }`}
                    >
                      Manage
                    </button>

                    {/* ADD ACCOUNT */}
                    <button
                      type="button"
                      disabled={!hasAccounts}
                      onClick={() => handleAddAccount(platform)}
                      className={`rounded-full px-3 py-2 text-[14px] font-bold border ${
                        !hasAccounts
                          ? "cursor-not-allowed border-slate-700 text-slate-700"
                          : "border-yellow-500 text-yellow-400 hover:text-yellow-200"
                      }`}
                    >
                      +
                    </button>
                  </div>

                  {/* LAST SYNC */}
                  <p className="mt-2 text-[10px] text-slate-500">
                    {lastSyncedLabel}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        {/* WHAT WE READ / NEVER DO */}
        <section className="mb-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 md:p-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-yellow-400 mb-2">
            What Autoaffi reads (and what we never do)
          </h2>

          <div className="grid gap-4 md:grid-cols-3 text-[11px] text-slate-300">
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <p className="font-semibold text-yellow-300 mb-1">We use</p>
              <ul className="space-y-1">
                <li>• Views, likes & comments</li>
                <li>• Post frequency & timing</li>
                <li>• High-level profile data</li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <p className="font-semibold text-yellow-300 mb-1">We never</p>
              <ul className="space-y-1">
                <li>• Auto-DM or auto-comment</li>
                <li>• Auto-like or follow/unfollow</li>
                <li>• Post anything without consent</li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <p className="font-semibold text-yellow-300 mb-1">This powers</p>
              <ul className="space-y-1">
                <li>• Content Optimizer</li>
                <li>• Smart Suggestions</li>
                <li>• Viral Heads-Up</li>
                <li>• Performance Score</li>
              </ul>
            </div>
          </div>
        </section>
      </div>

      {/* MANAGE MODAL */}
      {managePlatform && (
        <AccountManageModal
          open={manageOpen}
          onClose={closeManage}
          platform={PLATFORM_LABELS[managePlatform]}
          accounts={platforms[managePlatform].accounts}
          onAdd={handleModalAdd}
          onRemove={handleModalRemove}
          onSetPrimary={handleModalSetPrimary}
        />
      )}
    </main>
  );
}