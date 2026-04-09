"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlatformKey } from "@/lib/profile-connect/engine/types";

type ExportKitSection = {
  id: string;
  label: string;
  paste_target: string;
  helper: string;
  text: string;
};

type ExportKit = {
  platform: PlatformKey;
  title: string;
  summary: string;
  sections: ExportKitSection[];
};

type Props = {
  platform: PlatformKey;
  stepState: any;
  saving: boolean;
  onComplete: () => Promise<boolean> | boolean;
};

export default function Step8_FinalKit({
  platform,
  saving,
  onComplete,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kit, setKit] = useState<ExportKit | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function loadKit() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/profile-connect/export-kit?platform=${platform}`, {
        method: "GET",
        cache: "no-store",
      });

      const json = await res.json();

      if (!json?.ok) {
        throw new Error(json?.error || "Failed to load final kit");
      }

      setKit(json.export_kit);
    } catch (e: any) {
      setError(e?.message || "Failed to load final kit");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadKit();
  }, [platform]);

  async function copySection(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  }

  async function copyAll() {
    if (!kit) return;

    const full = [
      kit.title,
      kit.summary,
      "",
      ...kit.sections.flatMap((section) => [
        `=== ${section.label} ===`,
        `Paste here: ${section.paste_target}`,
        section.text,
        "",
      ]),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(full);
      setCopied("all");
      setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  }

  async function handleComplete() {
    setCompleting(true);
    await onComplete();
    setCompleting(false);
  }

  const groupedSections = useMemo(() => {
    if (!kit) return [];

    return [
      {
        title: "Profile Identity",
        items: kit.sections.filter((s) =>
          ["profile_name", "positioning", "bio", "profile_image"].includes(s.id)
        ),
      },
      {
        title: "Link + Conversion",
        items: kit.sections.filter((s) =>
          ["primary_link", "cta_line", "cta_system_summary", "pinned_comment"].includes(s.id)
        ),
      },
      {
        title: "Trust Layer",
        items: kit.sections.filter((s) =>
          ["proof_layer"].includes(s.id)
        ),
      },
      {
        title: "Pinned Assets",
        items: kit.sections.filter((s) =>
          ["pin_1", "pin_2", "pin_3"].includes(s.id)
        ),
      },
      {
        title: "Reply System",
        items: kit.sections.filter((s) =>
          ["quick_reply_1", "quick_reply_2", "quick_reply_3", "follow_up"].includes(s.id)
        ),
      },
    ].filter((group) => group.items.length > 0);
  }, [kit]);

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
        <p className="text-xs uppercase tracking-[0.16em] text-white/40">Step 8</p>
        <h4 className="mt-2 text-2xl font-extrabold text-white">Your final copy-paste kit</h4>
        <p className="mt-2 text-sm text-white/65">
          Everything is now in one place. You do not need to think. Just copy each block and paste it
          into the right place on your platform.
        </p>
      </div>

      <div className="rounded-[24px] border border-emerald-400/15 bg-emerald-500/5 p-5">
        <p className="text-sm font-semibold text-emerald-200">What to do now</p>
        <div className="mt-3 space-y-2 text-sm text-emerald-100/85">
          <p>1. Copy each section below</p>
          <p>2. Paste it into the exact place Autoaffi tells you</p>
          <p>3. Your profile will instantly feel clearer, stronger and more professional</p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-[24px] border border-white/10 bg-black/20 p-5 text-sm text-white/60">
          Loading your final kit…
        </div>
      ) : error ? (
        <div className="rounded-[24px] border border-red-400/20 bg-red-500/10 p-5 text-sm text-red-200">
          {error}
        </div>
      ) : !kit ? (
        <div className="rounded-[24px] border border-white/10 bg-black/20 p-5 text-sm text-white/60">
          No final kit available yet.
        </div>
      ) : (
        <>
          <div className="rounded-[24px] border border-yellow-400/15 bg-yellow-500/5 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-lg font-bold text-white">{kit.title}</p>
                <p className="mt-1 text-sm text-white/65">{kit.summary}</p>
              </div>

              <button
                type="button"
                onClick={copyAll}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/[0.06]"
              >
                {copied === "all" ? "Copied all ✅" : "Copy Everything"}
              </button>
            </div>
          </div>

          <div className="space-y-5">
            {groupedSections.map((group) => (
              <div
                key={group.title}
                className="rounded-[24px] border border-white/10 bg-black/20 p-5"
              >
                <p className="text-sm font-semibold text-white">{group.title}</p>

                <div className="mt-4 space-y-4">
                  {group.items.map((section) => (
                    <div
                      key={section.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white">{section.label}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-emerald-300">
                            {section.paste_target}
                          </p>
                          <p className="mt-2 text-sm text-white/60">{section.helper}</p>

                          <pre className="mt-3 whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-black/20 p-3 font-sans text-sm text-white">
                            {section.text}
                          </pre>
                        </div>

                        <button
                          type="button"
                          onClick={() => copySection(section.id, section.text)}
                          className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/[0.06]"
                        >
                          {copied === section.id ? "Copied ✅" : "Copy"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-[24px] border border-emerald-400/15 bg-emerald-500/5 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-emerald-200">Ready to finish?</p>
                <p className="mt-1 text-sm text-emerald-100/80">
                  When you’ve got your full setup, finish the platform setup here.
                </p>
              </div>

              <button
                type="button"
                onClick={handleComplete}
                disabled={saving || completing}
                className="rounded-2xl bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 px-5 py-3 text-sm font-bold text-black transition hover:scale-[1.01] disabled:opacity-60"
              >
                {completing ? "Completing..." : "Complete Platform Setup"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
