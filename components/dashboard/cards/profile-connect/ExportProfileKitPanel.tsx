"use client";

import { useEffect, useMemo, useState } from "react";

type PlatformKey = "instagram" | "tiktok" | "youtube" | "linkedin" | "x";

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
};

export default function ExportProfileKitPanel({ platform }: Props) {
  const [loading, setLoading] = useState(false);
  const [exportKit, setExportKit] = useState<ExportKit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  async function loadExportKit() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/profile-connect/export-kit?platform=${platform}`, {
        method: "GET",
        cache: "no-store",
      });

      const json = await res.json();

      if (!json?.ok) {
        throw new Error(json?.error || "Failed to load export kit");
      }

      setExportKit(json.export_kit);
    } catch (e: any) {
      setError(e?.message || "Failed to load export kit");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadExportKit();
  }, [platform]);

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(label);
      setTimeout(() => setCopiedSection(null), 1800);
    } catch {
      setCopiedSection(null);
    }
  }

  async function copyFullKit() {
    if (!exportKit) return;

    const fullText = [
      exportKit.title,
      exportKit.summary,
      "",
      ...exportKit.sections.flatMap((section) => [
        `=== ${section.label} ===`,
        `Paste here: ${section.paste_target}`,
        section.helper,
        section.text,
        "",
      ]),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(fullText);
      setCopiedSection("FULL_KIT");
      setTimeout(() => setCopiedSection(null), 1800);
    } catch {
      setCopiedSection(null);
    }
  }

  const groupedSections = useMemo(() => {
    if (!exportKit) return [];

    return [
      {
        title: "Profile Identity",
        items: exportKit.sections.filter((s) =>
          ["profile_name", "positioning", "bio", "profile_image"].includes(s.id)
        ),
      },
      {
        title: "Link + Conversion",
        items: exportKit.sections.filter((s) =>
          ["primary_link", "cta_line", "cta_system_summary", "pinned_comment"].includes(s.id)
        ),
      },
      {
        title: "Trust Layer",
        items: exportKit.sections.filter((s) => ["proof_layer"].includes(s.id)),
      },
      {
        title: "Pinned Assets",
        items: exportKit.sections.filter((s) => ["pin_1", "pin_2", "pin_3"].includes(s.id)),
      },
      {
        title: "Reply System",
        items: exportKit.sections.filter((s) =>
          ["quick_reply_1", "quick_reply_2", "quick_reply_3", "follow_up"].includes(s.id)
        ),
      },
    ].filter((group) => group.items.length > 0);
  }, [exportKit]);

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 md:p-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 inline-flex rounded-full border border-yellow-400/20 bg-yellow-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-300">
              Final Copy-Paste Kit
            </div>
            <h4 className="text-xl font-extrabold text-white">Everything in one place</h4>
            <p className="mt-2 max-w-2xl text-sm text-white/60">
              Autoaffi already prepared the setup for you. Copy each block below and paste it into
              the exact place shown.
            </p>
          </div>

          <button
            type="button"
            onClick={copyFullKit}
            disabled={!exportKit}
            className="rounded-2xl bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 px-5 py-3 text-sm font-bold text-black transition hover:scale-[1.01] disabled:opacity-60"
          >
            {copiedSection === "FULL_KIT" ? "Copied full kit ✅" : "Copy Everything"}
          </button>
        </div>

        <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/5 p-4 text-sm text-emerald-100/85">
          <p className="font-semibold text-emerald-200">How to use this</p>
          <div className="mt-2 space-y-2">
            <p>1. Copy the section you want</p>
            <p>2. Paste it into the exact place shown</p>
            <p>3. Keep the same setup everywhere so your profile feels clear and professional</p>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
            Loading export kit…
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : !exportKit ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">
            No export kit available yet.
          </div>
        ) : (
          <div className="space-y-5">
            {groupedSections.map((group) => (
              <div
                key={group.title}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
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

                          <pre className="mt-3 whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-black/20 p-4 font-sans text-sm text-white/80">
                            {section.text}
                          </pre>
                        </div>

                        <button
                          type="button"
                          onClick={() => copyText(section.label, section.text)}
                          className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/[0.06]"
                        >
                          {copiedSection === section.label ? "Copied ✅" : "Copy"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}