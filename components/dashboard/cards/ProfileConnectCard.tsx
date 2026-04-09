"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";

import ProfileConnectWizard from "@/components/dashboard/cards/profile-connect/wizard/ProfileConnectWizard";
import ProfileConnectControlCenter from "@/components/dashboard/cards/profile-connect/ProfileConnectControlCenter";

type PlatformKey = "instagram" | "tiktok" | "youtube" | "linkedin" | "x";
type SetupStatus = "not_started" | "in_progress" | "completed";

type PlatformState = {
  platform: PlatformKey;
  status: SetupStatus;
  score: number;
  updated_at?: string | null;
};

const PLATFORM_OPTIONS: { key: PlatformKey; label: string }[] = [
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "youtube", label: "YouTube" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "x", label: "X" },
];

function statusLabel(status: SetupStatus) {
  if (status === "completed") return "Completed";
  if (status === "in_progress") return "In progress";
  return "Not started";
}

function statusClasses(status: SetupStatus) {
  if (status === "completed") {
    return "bg-emerald-500/15 text-emerald-300 border border-emerald-400/20";
  }
  if (status === "in_progress") {
    return "bg-yellow-500/15 text-yellow-300 border border-yellow-400/20";
  }
  return "bg-white/5 text-white/60 border border-white/10";
}

export default function ProfileConnectCard() {
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformKey>("instagram");
  const [showWizard, setShowWizard] = useState(false);
  const [loading, setLoading] = useState(true);
  const [platformStates, setPlatformStates] = useState<Record<PlatformKey, PlatformState>>({
    instagram: { platform: "instagram", status: "not_started", score: 0 },
    tiktok: { platform: "tiktok", status: "not_started", score: 0 },
    youtube: { platform: "youtube", status: "not_started", score: 0 },
    linkedin: { platform: "linkedin", status: "not_started", score: 0 },
    x: { platform: "x", status: "not_started", score: 0 },
  });

  const selectedState = platformStates[selectedPlatform];

  const hasCompletedAny = useMemo(
    () => Object.values(platformStates).some((p) => p.status === "completed"),
    [platformStates]
  );

  async function loadPlatformState(platform: PlatformKey) {
    const res = await fetch(`/api/profile-connect/state/get?platform=${platform}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    const json = await res.json();
    if (!json?.ok) return null;
    return json.state;
  }

  async function refreshAllStates() {
    try {
      setLoading(true);

      const entries = await Promise.all(
        PLATFORM_OPTIONS.map(async ({ key }) => {
          const state = await loadPlatformState(key);

          if (!state) {
            return [
              key,
              {
                platform: key,
                status: "not_started" as SetupStatus,
                score: 0,
                updated_at: null,
              },
            ] as const;
          }

          return [
            key,
            {
              platform: key,
              status: (state.status || "not_started") as SetupStatus,
              score: state.score || 0,
              updated_at: state.updated_at || null,
            },
          ] as const;
        })
      );

      setPlatformStates(Object.fromEntries(entries) as Record<PlatformKey, PlatformState>);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAllStates();
  }, []);

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#07070a] p-6 md:p-7 shadow-[0_0_40px_rgba(0,0,0,0.35)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(250,204,21,0.09),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.04),transparent_24%)]" />

      <div className="relative z-10">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center rounded-full border border-yellow-400/20 bg-yellow-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-yellow-300">
                Autoaffi Copy-Paste Setup
              </div>

              <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                Profile Setup
              </h3>

              <p className="mt-3 max-w-2xl text-sm md:text-[15px] leading-6 text-white/70">
                Autoaffi gives you the exact profile copy, visuals, CTA structure and reply system
                you need. Choose your platform, copy what fits, paste it where Autoaffi tells you,
                and you are done.
              </p>
            </div>

            <div
              className={`self-start rounded-full px-3 py-1.5 text-xs font-semibold ${statusClasses(
                selectedState.status
              )}`}
            >
              {statusLabel(selectedState.status)}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-white/40">What it does</p>
              <p className="mt-2 text-sm text-white/80">
                Gives you ready-made profile name, bio, visuals, pinned assets, proof package and
                reply system.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-white/40">Why it matters</p>
              <p className="mt-2 text-sm text-white/80">
                A better profile makes people understand you faster, trust you more and act more
                easily.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-white/40">How it feels</p>
              <p className="mt-2 text-sm text-white/80">
                Simple. Copy. Paste. Done. Autoaffi removes the confusion for you.
              </p>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 md:p-5">
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-white/40">Choose platform</p>
                <p className="mt-1 text-sm text-white/60">
                  Each platform gets its own ready-made setup.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {PLATFORM_OPTIONS.map((platform) => {
                  const state = platformStates[platform.key];
                  const active = selectedPlatform === platform.key;

                  return (
                    <button
                      key={platform.key}
                      type="button"
                      onClick={() => setSelectedPlatform(platform.key)}
                      className={[
                        "rounded-full px-4 py-2 text-sm font-medium transition-all",
                        active
                          ? "border border-yellow-400/30 bg-yellow-500/15 text-yellow-200"
                          : "border border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]",
                      ].join(" ")}
                    >
                      <span className="mr-2">{platform.label}</span>
                      <span className="text-xs opacity-80">
                        {state.status === "completed"
                          ? "✅"
                          : state.status === "in_progress"
                          ? "⏳"
                          : "➕"}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-2 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-semibold text-white">
                    {PLATFORM_OPTIONS.find((p) => p.key === selectedPlatform)?.label} setup preview
                  </p>

                  <div className="mt-3 space-y-2 text-sm text-white/75">
                    <p>• Ready-made profile name + positioning</p>
                    <p>• Ready-made bio + link path + CTA logic</p>
                    <p>• Ready-made proof package + pinned assets + reply system</p>
                    <p>• Final all-in-one copy-paste kit in step 8</p>
                  </div>

                  <p className="mt-4 text-xs text-white/45">
                    You do not need to know your niche perfectly yet. Autoaffi still gives you a
                    strong setup.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/40">
                    Selected status
                  </p>
                  <p className="mt-2 text-lg font-bold text-white">
                    {statusLabel(selectedState.status)}
                  </p>

                  <div className="mt-4 space-y-2 text-sm text-white/70">
                    <p>
                      Score:{" "}
                      <span className="font-semibold text-white">
                        {selectedState.score || 0}/100
                      </span>
                    </p>
                    <p>
                      Platform:{" "}
                      <span className="font-semibold text-white capitalize">
                        {selectedPlatform}
                      </span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowWizard(true)}
                    className="mt-5 w-full rounded-2xl bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 px-4 py-3 text-sm font-bold text-black transition hover:scale-[1.01]"
                  >
                    {selectedState.status === "completed"
                      ? "Re-open Setup"
                      : "Start Copy-Paste Setup"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowWizard(true)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white/80 transition hover:bg-white/[0.06]"
                  >
                    See what Autoaffi gives you
                  </button>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-white/60">
              Loading Profile Setup…
            </div>
          ) : hasCompletedAny ? (
            <ProfileConnectControlCenter
              selectedPlatform={selectedPlatform}
              platformStates={platformStates}
              onSelectPlatform={setSelectedPlatform}
              onAddAnotherPlatform={(platform) => {
                setSelectedPlatform(platform);
                setShowWizard(true);
              }}
              onRefresh={refreshAllStates}
            />
          ) : null}
        </div>
      </div>

      <AnimatePresence>
        {showWizard && (
          <ProfileConnectWizard
            selectedPlatform={selectedPlatform}
            onClose={() => setShowWizard(false)}
            onCompleted={async (platform) => {
              setSelectedPlatform(platform);
              await refreshAllStates();
              setShowWizard(false);
            }}
            onSaved={refreshAllStates}
          />
        )}
      </AnimatePresence>
    </div>
  );
}