"use client";

import { useMemo, useState } from "react";
import type { PlatformKey, StepPayload } from "@/lib/profile-connect/engine/types";

type LinkType = "lead" | "bridge";
type LinkMode = "autoaffi" | "custom";

type Props = {
  platform: PlatformKey;
  payload: StepPayload;
  stepState: any;
  onSave: (patch: Record<string, any>) => Promise<void> | void;
  onSaveAndContinue: (patch: Record<string, any>) => Promise<void> | void;
  saving: boolean;
};

function getAppBaseUrl() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000";

  return raw.replace(/\/+$/, "");
}

function getUserCode(stepState: any) {
  return String(stepState?.autoaffi_user_code || "").trim();
}

function getSlug(stepState: any) {
  return String(
    stepState?.slug ||
      stepState?.link?.slug ||
      stepState?.offer_key ||
      "autoaffi"
  ).trim();
}

function buildDirectProfileRoute(stepState: any, linkType: LinkType) {
  const baseUrl = getAppBaseUrl();
  const userCode = getUserCode(stepState);
  const slug = getSlug(stepState);

  const route =
    linkType === "lead"
      ? `/profile/lead/${encodeURIComponent(slug)}`
      : `/profile/bridge/${encodeURIComponent(slug)}`;

  const url = new URL(route, baseUrl);

  if (userCode) {
    url.searchParams.set("u", userCode);
  }

  if (!url.searchParams.get("platform")) {
    url.searchParams.set(
      "platform",
      String(stepState?.profile_platform || "instagram")
    );
  }

  return url.toString();
}

export default function Step4_LinkTracking({
  platform,
  stepState,
  onSaveAndContinue,
  saving,
}: Props) {
  const existing = stepState?.link || {};

  const [linkType, setLinkType] = useState<LinkType>(
    (existing.primary_link_type || "lead") as LinkType
  );
  const [linkMode, setLinkMode] = useState<LinkMode>(
    (existing.link_mode || "autoaffi") as LinkMode
  );
  const [customUrl, setCustomUrl] = useState<string>(existing.custom_url || "");

  const previewRoutedLink = useMemo(() => {
    return buildDirectProfileRoute(stepState, linkType);
  }, [stepState, linkType]);

  const activeLink = linkMode === "autoaffi" ? previewRoutedLink : customUrl.trim();

  const destinationCopy = useMemo(() => {
    if (linkType === "lead") {
      return {
        title: "Lead Page",
        why: "This sends visitors to a softer first-step page designed to create interest and generate leads.",
        publicCta: "Start here",
        bioCta: "Use the link below to start with the easiest first step ↓",
        replyCta: `Here’s the easiest first step: ${activeLink || "[your link]"}`,
      };
    }

    return {
      title: "Personal Bridge Page",
      why: "This sends visitors to a more personal page first, then continues into the premium next step.",
      publicCta: "See how this works first",
      bioCta: "Use the link below to see how this works first ↓",
      replyCta: `Here’s the personal page first: ${activeLink || "[your link]"}`,
    };
  }, [linkType, activeLink]);

  async function handleContinue() {
    await onSaveAndContinue({
      link: {
        done: true,
        completed: true,
        primary_link_type: linkType,
        link_mode: linkMode,
        custom_url: customUrl,
        primary_link_url: linkMode === "autoaffi" ? previewRoutedLink : customUrl.trim(),
        destination_path: linkMode === "autoaffi" ? previewRoutedLink : customUrl.trim(),
        destination_label: destinationCopy.title,
        destination_description: destinationCopy.why,
        cta_line: destinationCopy.bioCta,
      },
      reply_context: {
        ...(stepState?.reply_context || {}),
        main_link: linkMode === "autoaffi" ? previewRoutedLink : customUrl.trim(),
      },
      bio: {
        ...(stepState?.bio || {}),
        cta_text: destinationCopy.bioCta,
      },
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
        <p className="text-xs uppercase tracking-[0.16em] text-white/40">Step 4</p>
        <h4 className="mt-2 text-2xl font-extrabold text-white">
          Choose where your visitors should go
        </h4>
        <p className="mt-2 text-sm text-white/65">
          This decides what happens after someone clicks your profile link. Autoaffi gives you two
          cleaner paths: a lead path or a personal bridge path.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-5">
          <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
            <p className="text-sm font-semibold text-white">Choose your destination type</p>

            <div className="mt-4 grid gap-3">
              <button
                type="button"
                onClick={() => setLinkType("lead")}
                className={`rounded-2xl border p-4 text-left transition ${
                  linkType === "lead"
                    ? "border-yellow-400/30 bg-yellow-500/10"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                }`}
              >
                <p className="text-sm font-semibold text-white">Lead Page</p>
                <p className="mt-2 text-sm text-white/70">
                  Best if you want the easiest path. Visitors land on a simpler page designed to
                  create interest and generate leads.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setLinkType("bridge")}
                className={`rounded-2xl border p-4 text-left transition ${
                  linkType === "bridge"
                    ? "border-yellow-400/30 bg-yellow-500/10"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                }`}
              >
                <p className="text-sm font-semibold text-white">Personal Bridge Page</p>
                <p className="mt-2 text-sm text-white/70">
                  Best if you want visitors to first land on a more personal page connected to you
                  before the premium page.
                </p>
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/75">
              <p className="font-semibold text-white">{destinationCopy.title}</p>
              <p className="mt-2">{destinationCopy.why}</p>
            </div>
          </div>

          <div className="rounded-[24px] border border-yellow-400/15 bg-yellow-500/5 p-5">
            <p className="text-sm font-semibold text-yellow-200">Choose which link to use</p>
            <p className="mt-1 text-xs text-yellow-100/75">
              Use your Autoaffi profile route, or paste your own custom page if needed.
            </p>

            <div className="mt-4 grid gap-3">
              <button
                type="button"
                onClick={() => setLinkMode("autoaffi")}
                className={`rounded-2xl border p-4 text-left transition ${
                  linkMode === "autoaffi"
                    ? "border-yellow-400/30 bg-yellow-500/10"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                }`}
              >
                <p className="text-sm font-semibold text-white">Use my Autoaffi routed link</p>
                <p className="mt-2 text-sm text-white/70">
                  Best if you want the correct direct profile route for lead or bridge.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setLinkMode("custom")}
                className={`rounded-2xl border p-4 text-left transition ${
                  linkMode === "custom"
                    ? "border-yellow-400/30 bg-yellow-500/10"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                }`}
              >
                <p className="text-sm font-semibold text-white">Use my own custom page</p>
                <p className="mt-2 text-sm text-white/70">
                  Best if you already have your own lead page or bridge page.
                </p>
              </button>
            </div>

            {linkMode === "autoaffi" ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-white/40">
                  Your routed Autoaffi link
                </p>
                <p className="mt-2 break-all text-sm text-white">
                  {previewRoutedLink || "No routed link available yet."}
                </p>
              </div>
            ) : (
              <div className="mt-4">
                <label className="text-xs uppercase tracking-[0.16em] text-white/40">
                  Paste your own custom page
                </label>
                <input
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://your-page.com"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-yellow-400/30"
                />
              </div>
            )}
          </div>

          <div className="rounded-[24px] border border-emerald-400/15 bg-emerald-500/5 p-5">
            <p className="text-sm font-semibold text-emerald-200">Why this matters</p>
            <div className="mt-3 space-y-2 text-sm text-emerald-100/85">
              <p>• Lead gives your customer a simpler path to direct leads</p>
              <p>• Bridge makes the first click feel more personal and trust-building</p>
              <p>• Both paths use cleaner logic than a hard sales page</p>
              <p>• This keeps the profile more premium and less pushy</p>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
            <p className="text-sm font-semibold text-white">Copy-paste result</p>

            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-white/40">
                  Paste this into your profile link field
                </p>
                <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white break-all">
                  {activeLink ||
                    (linkMode === "autoaffi"
                      ? "No routed link available yet."
                      : "No custom page entered yet.")}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-white/40">
                  Use this in your bio CTA
                </p>
                <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white">
                  {destinationCopy.bioCta}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-white/40">
                  Use this as your public CTA
                </p>
                <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white">
                  {destinationCopy.publicCta}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-white/40">
                  Use this in replies / DMs
                </p>
                <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white break-all">
                  {destinationCopy.replyCta}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
            <p className="text-sm font-semibold text-white">Simple rule</p>
            <div className="mt-3 space-y-2 text-sm text-white/75">
              <p>• Lead = direct lead path</p>
              <p>• Bridge = personal page first, premium page after</p>
              <p>• Use one clear path only</p>
              <p>• Keep the same path everywhere in your profile</p>
            </div>
          </div>

          <div className="rounded-[24px] border border-emerald-400/15 bg-emerald-500/5 p-5">
            <button
              type="button"
              onClick={handleContinue}
              disabled={saving}
              className="rounded-2xl bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 px-5 py-3 text-sm font-bold text-black transition hover:scale-[1.01] disabled:opacity-60"
            >
              {saving ? "Saving..." : "Use This & Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}