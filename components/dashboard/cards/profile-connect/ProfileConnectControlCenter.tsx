"use client";

import ProfileConnectCompletedPanel from "@/components/dashboard/cards/profile-connect/ProfileConnectCompletedPanel";

type PlatformKey = "instagram" | "tiktok" | "youtube" | "linkedin" | "x";
type SetupStatus = "not_started" | "in_progress" | "completed";

type PlatformState = {
  platform: PlatformKey;
  status: SetupStatus;
  score: number;
  updated_at?: string | null;
};

type Props = {
  selectedPlatform: PlatformKey;
  platformStates: Record<PlatformKey, PlatformState>;
  onSelectPlatform: (platform: PlatformKey) => void;
  onAddAnotherPlatform: (platform: PlatformKey) => void;
  onRefresh: () => void | Promise<void>;
};

const PLATFORM_OPTIONS: { key: PlatformKey; label: string; recommendation?: string }[] = [
  { key: "instagram", label: "Instagram", recommendation: "Best for proof + profile trust" },
  { key: "tiktok", label: "TikTok", recommendation: "Fastest reach for beginners" },
  { key: "youtube", label: "YouTube", recommendation: "Strongest long-term trust" },
  { key: "linkedin", label: "LinkedIn", recommendation: "High-trust authority platform" },
  { key: "x", label: "X", recommendation: "Fast profile clarity + replies" },
];

function formatUpdated(date?: string | null) {
  if (!date) return "Not updated yet";
  try {
    return new Date(date).toLocaleDateString();
  } catch {
    return "Recently";
  }
}

export default function ProfileConnectControlCenter({
  selectedPlatform,
  platformStates,
  onSelectPlatform,
  onAddAnotherPlatform,
  onRefresh,
}: Props) {
  const completedPlatforms = PLATFORM_OPTIONS.filter(
    ({ key }) => platformStates[key]?.status === "completed"
  );

  const selected = platformStates[selectedPlatform];

  const recommendedNext =
    PLATFORM_OPTIONS.find((p) => platformStates[p.key]?.status === "not_started") || null;

  return (
    <div className="space-y-4">
      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 md:p-6">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl">
              <div className="mb-2 inline-flex rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                Setup Active
              </div>

              <h4 className="text-xl md:text-2xl font-extrabold text-white">
                Profile Setup Control Center
              </h4>

              <p className="mt-2 text-sm leading-6 text-white/65">
                Autoaffi keeps each platform setup saved, visible and ready to reuse. Open any
                completed platform to copy the exact setup again, or add another platform when you
                want to expand.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onRefresh()}
              className="self-start rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/80 hover:bg-white/[0.06]"
            >
              Refresh Status
            </button>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-white/40">Your platforms</p>
            <p className="mt-1 text-sm text-white/60">
              Choose a platform to open its setup or add a new one.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {PLATFORM_OPTIONS.map(({ key, label }) => {
                const state = platformStates[key];
                const active = selectedPlatform === key;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onSelectPlatform(key)}
                    className={[
                      "rounded-full px-4 py-2 text-sm font-medium transition-all",
                      active
                        ? "border border-yellow-400/30 bg-yellow-500/15 text-yellow-200"
                        : "border border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]",
                    ].join(" ")}
                  >
                    <span className="mr-2">{label}</span>
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

            <p className="mt-3 text-xs text-white/45">
              Every platform gets its own copy-paste setup, so the user never has to guess what goes where.
            </p>
          </div>

          {completedPlatforms.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-white/40">Completed setups</p>

              <div className="mt-4 space-y-3">
                {completedPlatforms.map(({ key, label }) => {
                  const row = platformStates[key];

                  return (
                    <div
                      key={key}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-base font-bold text-white">
                            {label} <span className="ml-2 text-emerald-300">✅</span>
                          </p>
                          <p className="mt-1 text-sm text-white/60">
                            Ready-made profile identity, bio, visuals, proof, pinned assets and reply system
                          </p>
                          <div className="mt-3 grid gap-2 text-sm text-white/70 md:grid-cols-3">
                            <p>
                              Score: <span className="font-semibold text-white">{row.score}/100</span>
                            </p>
                            <p>
                              Status: <span className="font-semibold text-emerald-300">Ready</span>
                            </p>
                            <p>
                              Last updated:{" "}
                              <span className="font-semibold text-white">
                                {formatUpdated(row.updated_at)}
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => onSelectPlatform(key)}
                            className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/80 hover:bg-white/[0.06]"
                          >
                            Open kit
                          </button>

                          <button
                            type="button"
                            onClick={() => onAddAnotherPlatform(key)}
                            className="rounded-2xl border border-yellow-400/20 bg-yellow-500/10 px-4 py-2.5 text-sm font-medium text-yellow-200 hover:bg-yellow-500/15"
                          >
                            Re-open setup
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="mt-3 text-xs text-white/45">
                Re-open anytime if you change offer, brand style or link path.
              </p>
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-white/40">
                What Autoaffi gives you
              </p>
              <div className="mt-4 space-y-2 text-sm text-white/80">
                <p>• Ready-made profile name</p>
                <p>• Ready-made bio</p>
                <p>• Ready-made image path</p>
                <p>• Ready-made link setup</p>
                <p>• Ready-made proof package</p>
                <p>• Ready-made pinned assets</p>
                <p>• Ready-made reply system</p>
                <p>• Final all-in-one copy-paste kit</p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-white/40">
                Why users like this
              </p>
              <div className="mt-4 space-y-2 text-sm text-white/80">
                <p>• No guesswork</p>
                <p>• No confusing setup logic</p>
                <p>• No need to know everything first</p>
                <p>• Clear copy-paste instructions</p>
                <p>• Faster path to a more professional-looking profile</p>
              </div>
            </div>
          </div>

          {recommendedNext && (
            <div className="rounded-2xl border border-yellow-400/20 bg-yellow-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-yellow-200/70">
                Recommended next platform
              </p>

              <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-base font-bold text-yellow-100">
                    {recommendedNext.label} ➕
                  </p>
                  <p className="mt-1 text-sm text-yellow-100/80">
                    {recommendedNext.recommendation}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onAddAnotherPlatform(recommendedNext.key)}
                  className="rounded-2xl bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 px-5 py-3 text-sm font-bold text-black transition hover:scale-[1.01]"
                >
                  Add another platform
                </button>
              </div>
            </div>
          )}

          {selected && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-white/40">
                Selected platform snapshot
              </p>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs text-white/45">Platform</p>
                  <p className="mt-1 font-semibold capitalize text-white">{selected.platform}</p>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs text-white/45">Status</p>
                  <p className="mt-1 font-semibold text-white capitalize">
                    {selected.status.replace("_", " ")}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs text-white/45">Score</p>
                  <p className="mt-1 font-semibold text-white">{selected.score}/100</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {selected ? (
        <ProfileConnectCompletedPanel
          selectedPlatform={selectedPlatform}
          selectedState={selected}
        />
      ) : null}
    </div>
  );
}