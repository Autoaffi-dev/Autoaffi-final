"use client";

import { useMemo, useState } from "react";
import type { PlatformKey, StepPayload, CTAType } from "@/lib/profile-connect/engine/types";

type LinkMode = "lead" | "bridge";

type Props = {
  platform: PlatformKey;
  payload: StepPayload;
  stepState: any;
  onSave: (patch: Record<string, any>) => Promise<void> | void;
  onSaveAndContinue: (patch: Record<string, any>) => Promise<void> | void;
  saving: boolean;
};

function cleanSeed(value: string) {
  return String(value || "").trim();
}

function getBaseOrigin() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "https://www.autoaffi.com";
}

function normalizeToAbsolute(url: string) {
  const value = cleanSeed(url);
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return `${getBaseOrigin()}${value}`;
  return `${getBaseOrigin()}/${value}`;
}

function convertAutoaffiLink(rawUrl: string, mode: LinkMode) {
  const normalized = normalizeToAbsolute(rawUrl);
  if (!normalized) return "";

  try {
    const url = new URL(normalized);

    if (mode === "bridge") {
      url.pathname = url.pathname.replace("/profile/lead/", "/profile/bridge/");
      url.searchParams.delete("offer");
    } else {
      url.pathname = url.pathname.replace("/profile/bridge/", "/profile/lead/");
      if (!url.searchParams.get("offer")) {
        url.searchParams.set("offer", "autoaffi");
      }
    }

    return url.toString();
  } catch {
    if (mode === "bridge") {
      return normalized
        .replace("/profile/lead/", "/profile/bridge/")
        .replace(/([?&])offer=[^&]*(&|$)/, (_m, p1, p2) =>
          p2 === "&" ? p1 : ""
        )
        .replace(/[?&]$/, "");
    }

    const converted = normalized.replace("/profile/bridge/", "/profile/lead/");
    return converted.includes("offer=")
      ? converted
      : `${converted}${converted.includes("?") ? "&" : "?"}offer=autoaffi`;
  }
}

function resolveAutoaffiLink(stepState: any, mode: LinkMode) {
  const explicitLead =
    cleanSeed(stepState?.lead?.public_url) ||
    cleanSeed(stepState?.lead?.link_url) ||
    cleanSeed(stepState?.lead?.image_click_url);

  const explicitBridge =
    cleanSeed(stepState?.bridge?.public_url) ||
    cleanSeed(stepState?.bridge?.link_url) ||
    cleanSeed(stepState?.connection?.public_url) ||
    cleanSeed(stepState?.connection?.link_url);

  const fallback =
    cleanSeed(stepState?.link?.primary_link_url) ||
    cleanSeed(stepState?.autoaffi_link) ||
    cleanSeed(stepState?.generated_link) ||
    "/";

  if (mode === "lead") {
    return explicitLead || convertAutoaffiLink(fallback, "lead");
  }

  return explicitBridge || convertAutoaffiLink(fallback, "bridge");
}

const DM_BIOS = [
  `Helping people find a clearer path, better tools and smarter next steps.\nDM "START" if you want help.`,
  `Making it easier to move forward with more clarity, structure and direction.\nDM "START" ↓`,
  `Helping people go from confusion to clearer progress and better decisions.\nDM "START" if you want the next step.`,
];

function buildLeadLinkBios(link: string) {
  return [
    `Helping people find a clearer path, better tools and smarter next steps.\nGet the free guide here ↓\n${link}`,
    `Making it easier to move forward with more clarity, structure and direction.\nStart with the free guide ↓\n${link}`,
    `Helping people go from confusion to clearer progress and better decisions.\nUse this link to get started ↓\n${link}`,
  ];
}

function buildBridgeLinkBios(link: string) {
  return [
    `Helping people find a clearer path, better tools and smarter next steps.\nStart here and explore the path ↓\n${link}`,
    `Making it easier to move forward with more clarity, structure and direction.\nExplore the next step ↓\n${link}`,
    `Helping people go from confusion to clearer progress and better decisions.\nUse this link to begin ↓\n${link}`,
  ];
}

function buildLeadHybridBios(link: string) {
  return [
    `Helping people find a clearer path, better tools and smarter next steps.\nUse the link below for the free guide or DM "START" if you want help.\n${link}`,
    `Making it easier to move forward with more clarity, structure and direction.\nStart with the guide or DM "START" ↓\n${link}`,
    `Helping people go from confusion to clearer progress and better decisions.\nUse the link below or DM "START".\n${link}`,
  ];
}

function buildBridgeHybridBios(link: string) {
  return [
    `Helping people find a clearer path, better tools and smarter next steps.\nExplore the path below or DM "START" if you want help first.\n${link}`,
    `Making it easier to move forward with more clarity, structure and direction.\nUse the link or DM "START" ↓\n${link}`,
    `Helping people go from confusion to clearer progress and better decisions.\nUse the link to begin or DM "START".\n${link}`,
  ];
}

function buildOptions(ctaType: CTAType, linkMode: LinkMode, link: string) {
  if (ctaType === "dm") return DM_BIOS;
  if (ctaType === "link") {
    return linkMode === "lead" ? buildLeadLinkBios(link) : buildBridgeLinkBios(link);
  }
  return linkMode === "lead" ? buildLeadHybridBios(link) : buildBridgeHybridBios(link);
}

export default function Step3_BioBuilder({
  platform,
  stepState,
  onSaveAndContinue,
  saving,
}: Props) {
  const existing = stepState?.bio || {};

  const [ctaType, setCtaType] = useState<CTAType>(existing.cta_type || "dm");
  const [linkMode, setLinkMode] = useState<LinkMode>(existing.link_mode || "bridge");

  const autoaffiLink = useMemo(
    () => resolveAutoaffiLink(stepState, linkMode),
    [stepState, linkMode]
  );

  const options = useMemo(
    () => buildOptions(ctaType, linkMode, autoaffiLink),
    [ctaType, linkMode, autoaffiLink]
  );

  const [selectedText, setSelectedText] = useState<string>(
    existing.selected_text || options[0]
  );

  function handleType(type: CTAType) {
    setCtaType(type);
    const nextOptions = buildOptions(type, linkMode, autoaffiLink);
    setSelectedText(nextOptions[0]);
  }

  function handleLinkMode(mode: LinkMode) {
    const nextLink = resolveAutoaffiLink(stepState, mode);
    setLinkMode(mode);
    const nextOptions = buildOptions(ctaType, mode, nextLink);
    setSelectedText(nextOptions[0]);
  }

  async function handleContinue() {
    await onSaveAndContinue({
      bio: {
        done: true,
        completed: true,
        selected_text: selectedText,
        cta_type: ctaType,
        link_mode: linkMode,
      },
      final_bio: selectedText,
    });
  }

  const description =
    ctaType === "dm"
      ? `DM is best if you want people to connect with you personally before they take the next step.`
      : ctaType === "link"
      ? linkMode === "lead"
        ? `Link is set to Lead, which means people go straight into your free-guide / lead path.`
        : `Link is set to Bridge, which means people first enter your public Autoaffi path before deciding what fits them best.`
      : linkMode === "lead"
      ? `Hybrid is set to Lead, so some people can message you first while others go directly to your lead path.`
      : `Hybrid is set to Bridge, so some people can message you first while others explore your bridge path before moving forward.`;

  const pasteWhere =
    platform === "youtube"
      ? "Paste this into your About section."
      : platform === "linkedin"
      ? "Paste this into your About section."
      : "Paste this into your bio field.";

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
        <p className="text-xs uppercase tracking-[0.16em] text-white/40">Step 3</p>
        <h4 className="mt-2 text-2xl font-extrabold text-white">
          Shape the first impression people see
        </h4>
        <p className="mt-2 text-sm text-white/65">
          This is the message people will notice first when they land on your profile.
          Choose whether you want them to message you, click into your path, or do both.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-5">
          <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
            <p className="text-sm font-semibold text-white">
              Choose what kind of response you want first
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {(["dm", "link", "hybrid"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleType(type)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    ctaType === type
                      ? "border border-yellow-400/30 bg-yellow-500/15 text-yellow-200"
                      : "border border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]"
                  }`}
                >
                  {type.toUpperCase()}
                </button>
              ))}
            </div>

            {(ctaType === "link" || ctaType === "hybrid") && (
              <div className="mt-5">
                <p className="text-sm font-semibold text-white">
                  Choose where your link should lead people first
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {(["lead", "bridge"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleLinkMode(mode)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        linkMode === mode
                          ? "border border-yellow-400/30 bg-yellow-500/15 text-yellow-200"
                          : "border border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]"
                      }`}
                    >
                      {mode === "lead" ? "LEAD" : "BRIDGE"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/75">
              <p>{description}</p>

              {(ctaType === "link" || ctaType === "hybrid") && (
                <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/40">
                    Your Autoaffi link
                  </p>
                  <p className="mt-2 break-all text-sm text-white">{autoaffiLink}</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[24px] border border-emerald-400/15 bg-emerald-500/5 p-5">
            <p className="text-sm font-semibold text-emerald-200">Where this goes</p>
            <div className="mt-3 space-y-2 text-sm text-emerald-100/85">
              <p>• {pasteWhere}</p>
              <p>• This is what people see before they decide whether to message you or explore your path</p>
              <p>• Your bio should match the public journey you want them to enter</p>
              <p>• If you choose Link or Hybrid, your profile link should lead into the same Autoaffi flow</p>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
            <p className="text-sm font-semibold text-white">Why this step matters</p>
            <div className="mt-3 space-y-2 text-sm text-white/75">
              <p>• Your bio shapes the first impression people get</p>
              <p>• It helps guide people toward the next step you want</p>
              <p>• A clearer bio gives you a better chance of the right response</p>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[24px] border border-yellow-400/15 bg-yellow-500/5 p-5">
            <p className="text-sm font-semibold text-yellow-200">
              Choose the message people will see first
            </p>
            <p className="mt-1 text-xs text-yellow-100/75">
              Pick the one you want to use on your {platform} profile.
            </p>

            <div className="mt-4 grid gap-3">
              {options.map((option, index) => (
                <button
                  key={`${ctaType}-${linkMode}-${index}`}
                  type="button"
                  onClick={() => setSelectedText(option)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    selectedText === option
                      ? "border-yellow-400/30 bg-yellow-500/10"
                      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                  }`}
                >
                  <pre className="whitespace-pre-wrap font-sans text-sm text-white">
                    {option}
                  </pre>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
            <label className="text-xs uppercase tracking-[0.16em] text-white/40">
              Final Bio
            </label>
            <textarea
              value={selectedText}
              onChange={(e) => setSelectedText(e.target.value)}
              rows={8}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-yellow-400/30"
            />

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-white">Copy-paste result</p>
              <p className="mt-2 text-xs text-white/45">Copy this into your bio field:</p>
              <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-white/10 bg-black/20 p-3 font-sans text-sm text-white">
                {selectedText || "No bio selected yet."}
              </pre>
            </div>
          </div>

          <div className="rounded-[24px] border border-emerald-400/15 bg-emerald-500/5 p-5">
            <button
              type="button"
              onClick={handleContinue}
              disabled={saving || !selectedText}
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