"use client";

import type { SavedPush } from "../types";

type SavedPushesPanelProps = {
  pushes: SavedPush[];
  onOpen: (push: SavedPush) => void;
};

export default function SavedPushesPanel({
  pushes,
  onOpen,
}: SavedPushesPanelProps) {
  if (!pushes.length) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-7 shadow-[0_0_30px_rgba(0,0,0,0.24)]">
        <p className="text-[11px] uppercase tracking-[0.22em] text-yellow-300/80 font-semibold">
          Saved Pushes
        </p>
        <p className="mt-3 text-sm text-white/55">
          No saved pushes yet. Generate your first one and save it here for easy reuse.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-7 shadow-[0_0_30px_rgba(0,0,0,0.24)]">
      <div className="mb-5">
        <p className="text-[11px] uppercase tracking-[0.22em] text-yellow-300/80 font-semibold">
          Saved Pushes
        </p>
        <p className="mt-2 text-sm text-white/55">
          Reopen previous pushes and reuse them whenever you want.
        </p>
      </div>

      <div className="space-y-3">
        {pushes.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-white/10 bg-black/20 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <p className="text-sm font-semibold text-white">{item.push.title}</p>
              <p className="mt-1 text-xs text-white/45">
                {item.push.platform} • {item.push.durationDays} days • {item.push.goal}
              </p>
              <p className="mt-1 text-xs text-white/35">
                Saved: {new Date(item.createdAt).toLocaleString()}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onOpen(item)}
              className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-xs font-semibold text-yellow-300 transition hover:bg-yellow-400/15"
            >
              Open push
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
