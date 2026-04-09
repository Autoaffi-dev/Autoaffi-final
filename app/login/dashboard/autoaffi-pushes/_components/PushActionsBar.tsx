"use client";

import type { GeneratedPush } from "../types";
import { copyFullPush } from "@/lib/autoaffi-pushes/copyPush";
import { downloadPush } from "@/lib/autoaffi-pushes/downloadPush";

type PushActionsBarProps = {
  push: GeneratedPush;
  onRegenerate: () => void;
};

export default function PushActionsBar({
  push,
  onRegenerate,
}: PushActionsBarProps) {
  async function handleCopyAll() {
    try {
      await copyFullPush(push);
    } catch (err) {
      console.error("[AUTOAFFI_PUSHES] copy full push failed", err);
    }
  }

  function handleDownload() {
    try {
      downloadPush(push);
    } catch (err) {
      console.error("[AUTOAFFI_PUSHES] download push failed", err);
    }
  }

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-white/[0.03] p-5 md:p-6 shadow-[0_0_30px_rgba(0,0,0,0.24)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-yellow-300/80 font-semibold">
            Push Actions
          </p>
          <p className="mt-2 text-sm text-white/60 leading-6">
            Copy the full push, download it for later, or regenerate a fresh
            version with the same direction.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 md:min-w-[520px]">
          <button
            type="button"
            onClick={handleCopyAll}
            className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-sm font-semibold text-yellow-300 transition hover:bg-yellow-400/15"
          >
            Copy full push
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-semibold text-white/80 transition hover:border-yellow-500/30 hover:text-white"
          >
            Download .txt
          </button>

          <button
            type="button"
            onClick={onRegenerate}
            className="rounded-2xl bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-600 px-4 py-3 text-sm font-bold text-black transition hover:brightness-110"
          >
            Regenerate push
          </button>
        </div>
      </div>
    </section>
  );
}
