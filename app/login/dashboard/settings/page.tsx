"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Mail,
  Settings2,
  Sparkles,
} from "lucide-react";

const FREQUENCIES = [
  { value: "manual", label: "Manual only" },
  { value: "1-per-day", label: "1 post per day" },
  { value: "2-per-day", label: "2 posts per day" },
  { value: "3-per-day", label: "3 posts per day" },
] as const;

type Frequency = (typeof FREQUENCIES)[number]["value"];

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function SettingsPage() {
  const [frequency, setFrequency] = useState<Frequency>("manual");
  const [includeWeekends, setIncludeWeekends] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <motion.header
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="rounded-3xl border border-yellow-400/20 bg-slate-900/70 p-6 shadow-[0_0_40px_rgba(0,0,0,0.22)]"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-yellow-400/30 bg-slate-950/80">
            <Settings2 className="h-7 w-7 text-yellow-300" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight text-yellow-300 md:text-4xl">
                Settings
              </h1>
              <Sparkles className="h-5 w-5 text-yellow-300" />
            </div>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
              Manage the key settings that power your Autoaffi workflow.
              Connected Inbox lives here and will be used by Business Finder,
              Contact Manager, and Leads Hub.
            </p>
          </div>
        </div>
      </motion.header>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05 }}
          className="rounded-3xl border border-yellow-400/20 bg-slate-900/70 p-5"
        >
          <div className="mb-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-yellow-300">
              Core settings
            </div>
            <h2 className="mt-2 text-xl font-semibold text-white">
              System connections
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Keep the most important Autoaffi system connections ready.
            </p>
          </div>

          <div className="space-y-3">
            <Link
              href="/login/dashboard/settings/email"
              className="group block rounded-2xl border border-yellow-400/20 bg-slate-950/40 p-4 transition hover:border-yellow-400/40 hover:bg-yellow-400/[0.04]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-yellow-400/25 bg-slate-950">
                    <Mail className="h-6 w-6 text-yellow-300" />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-base font-semibold text-white">
                        Connected Inbox
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/25 bg-yellow-400/10 px-2.5 py-1 text-[11px] font-medium text-yellow-300">
                        Required for Business Finder
                      </span>
                    </div>

                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Connect and manage the inbox used for tracked outreach,
                      reply handling, and synced lead visibility across
                      Business Finder, Contact Manager, and Leads Hub.
                    </p>
                  </div>
                </div>

                <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-yellow-300 transition group-hover:translate-x-0.5" />
              </div>
            </Link>

            <div className="rounded-2xl border border-slate-700/70 bg-slate-950/30 p-4">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-700 bg-slate-950">
                  <CalendarDays className="h-6 w-6 text-slate-300" />
                </div>

                <div>
                  <div className="text-base font-semibold text-white">
                    More settings later
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Future modules such as automation approvals, advanced
                    workflow controls, and connected system options can be
                    added here without disturbing the dashboard structure.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="rounded-3xl border border-yellow-400/20 bg-slate-900/70 p-5"
        >
          <div className="mb-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-yellow-300">
              Posting preferences
            </div>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Auto-posting Settings (Elite)
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Decide how aggressive Autoaffi should be with scheduling and
              planning content across connected social accounts.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-700/70 bg-slate-950/40 p-4">
            <div className="mb-3 text-sm font-medium text-white">
              Posting frequency
            </div>

            <p className="mb-4 text-sm leading-6 text-slate-400">
              How often should Autoaffi schedule posts for you?
            </p>

            <div className="grid gap-2 md:grid-cols-2">
              {FREQUENCIES.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFrequency(f.value)}
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-left text-sm transition",
                    frequency === f.value
                      ? "border-yellow-400/40 bg-yellow-400/10 text-yellow-300"
                      : "border-slate-700 bg-slate-950/30 text-slate-300 hover:border-yellow-400/25 hover:text-white"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <label className="mt-4 flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={includeWeekends}
                onChange={(e) => setIncludeWeekends(e.target.checked)}
                className="rounded border-slate-600 bg-transparent"
              />
              Include weekends in scheduling
            </label>

            <p className="mt-4 text-xs leading-6 text-slate-500">
              Autoaffi will always let you review posts before publishing unless
              you explicitly enable stronger automation later. For now, this is a
              planning setting.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center rounded-full bg-yellow-400 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:brightness-110"
              >
                Save preferences
              </button>

              {saved && (
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                  Preferences saved
                </div>
              )}
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}