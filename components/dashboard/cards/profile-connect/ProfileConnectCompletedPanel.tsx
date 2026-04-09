"use client";

import ExportProfileKitPanel from "@/components/dashboard/cards/profile-connect/ExportProfileKitPanel";

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
  selectedState: PlatformState;
};

function labelForPlatform(platform: PlatformKey) {
  switch (platform) {
    case "instagram":
      return "Instagram";
    case "tiktok":
      return "TikTok";
    case "youtube":
      return "YouTube";
    case "linkedin":
      return "LinkedIn";
    case "x":
      return "X";
    default:
      return platform;
  }
}

export default function ProfileConnectCompletedPanel({
  selectedPlatform,
  selectedState,
}: Props) {
  if (selectedState.status !== "completed") return null;

  return (
    <div className="space-y-4">
      <div className="rounded-[28px] border border-emerald-400/20 bg-emerald-500/10 p-5 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="max-w-3xl">
            <div className="mb-2 inline-flex rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
              Platform Completed
            </div>

            <h4 className="text-xl md:text-2xl font-extrabold text-white">
              {labelForPlatform(selectedPlatform)} setup is ready
            </h4>

            <p className="mt-2 text-sm leading-6 text-white/75">
              Autoaffi has now prepared your full copy-paste setup for this platform. You do not need
              to guess what to do — just copy each section below and paste it into the exact place
              shown.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/80">
            Score: <span className="font-bold text-white">{selectedState.score}/100</span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-white/40">What is ready</p>
            <p className="mt-2 text-sm text-white/80">
              Profile name, bio, visuals, proof package, pinned assets and reply system.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-white/40">How to use it</p>
            <p className="mt-2 text-sm text-white/80">
              Copy each block below and paste it into the exact field Autoaffi tells you to use.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-white/40">Why it matters</p>
            <p className="mt-2 text-sm text-white/80">
              Your profile now feels clearer, more trustworthy and much easier for visitors to act on.
            </p>
          </div>
        </div>
      </div>

      <ExportProfileKitPanel platform={selectedPlatform} />
    </div>
  );
}