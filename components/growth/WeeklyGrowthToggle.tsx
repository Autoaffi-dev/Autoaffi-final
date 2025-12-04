"use client";

import { useState } from "react";

type Props = {
  plan: "basic" | "pro" | "elite";
  enabled: boolean;
  phone: string;
  onChange: (enabled: boolean, phone: string) => void;
};

export default function WeeklyGrowthToggle({
  plan,
  enabled,
  phone,
  onChange,
}: Props) {
  const [localEnabled, setLocalEnabled] = useState(enabled);
  const [localPhone, setLocalPhone] = useState(phone);
  const [saved, setSaved] = useState<null | "ok" | "error">(null);

  // ELITE-only
  const locked = plan !== "elite";

  function handleSave() {
    if (locked) return;

    if (localEnabled && !localPhone.trim()) {
      setSaved("error");
      return;
    }

    onChange(localEnabled, localPhone);
    setSaved("ok");
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.5)]">
      <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-yellow-300 mb-2">
        Weekly Growth Alerts (Elite)
      </h2>

      <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
        Every Sunday Autoaffi sends a{" "}
        <span className="text-yellow-300 font-semibold">
          personal growth summary
        </span>{" "}
        to your phone: momentum score, wins, weak spots and{" "}
        <span className="text-yellow-300 font-semibold">
          3 actions for the next week
        </span>
        .<br />
        <br />
        <span className="text-slate-500">
          Basic & Pro users see this panel as a preview — Elite unlocks it fully.
        </span>
      </p>

      {locked ? (
        <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-4 text-center">
          <p className="text-xs text-slate-400 mb-2">
            Upgrade to <span className="text-yellow-300 font-semibold">Elite</span> 
            to activate weekly SMS insights.
          </p>

          <button
            disabled
            className="rounded-full border border-yellow-700/40 bg-yellow-600/20 px-3 py-1.5 text-[11px] font-semibold text-yellow-400 cursor-not-allowed"
          >
            Elite required
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3">
            <input
              type="checkbox"
              checked={localEnabled}
              onChange={(e) => setLocalEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-yellow-400"
            />
            <label className="text-xs text-slate-300">Enable weekly SMS</label>
          </div>

          <input
            type="text"
            disabled={!localEnabled}
            value={localPhone}
            onChange={(e) => setLocalPhone(e.target.value)}
            placeholder="+46 72 000 00 00"
            className={`w-full rounded-xl border px-3 py-2 text-sm bg-slate-950/40 text-slate-200 placeholder-slate-600 mb-3 ${
              localEnabled
                ? "border-slate-700 focus:border-yellow-400"
                : "border-slate-800 opacity-40 cursor-not-allowed"
            }`}
          />

          <button
            onClick={handleSave}
            className="w-full rounded-xl border border-yellow-500 bg-yellow-500/20 px-3 py-2 text-xs font-semibold text-yellow-300 hover:bg-yellow-500/30 transition"
          >
            Save weekly settings
          </button>

          {saved === "ok" && (
            <p className="mt-2 text-[11px] text-emerald-400">Saved ✔</p>
          )}
          {saved === "error" && (
            <p className="mt-2 text-[11px] text-red-400">
              Enter your phone number.
            </p>
          )}
        </>
      )}
    </div>
  );
}