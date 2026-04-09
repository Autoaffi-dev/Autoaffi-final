"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlatformKey, StepPayload } from "@/lib/profile-connect/engine/types";

type Props = {
  platform: PlatformKey;
  payload: StepPayload;
  stepState: any;
  onSave: (patch: Record<string, any>) => Promise<void> | void;
  onSaveAndContinue: (patch: Record<string, any>) => Promise<void> | void;
  saving: boolean;
};

const READY_LINE_OPTIONS = [
  "Helping people find a clearer path, better tools and simpler next steps that actually feel doable.",
  "Sharing what feels easier, smarter and more realistic when you want to move forward without the noise.",
  "Helping people choose better-fit tools, cleaner systems and a path that feels more natural to follow.",
  "Making growth feel simpler through clearer direction, smarter tools and less overwhelm.",
  "Sharing a more human way to find better tools, stronger direction and easier next steps.",
  "Helping people move forward with clearer choices, simpler systems and a setup that feels right.",
];

function cleanSeed(value: string) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function toTitleCase(value: string) {
  return cleanSeed(value)
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function emailLocalToName(email: string) {
  const local = (email.split("@")[0] || "").trim();

  const cleaned = local
    .replace(/[._-]+/g, " ")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return toTitleCase(cleaned);
}

function splitNameParts(value: string) {
  const cleaned = cleanSeed(value);
  const parts = cleaned.split(" ").filter(Boolean);
  const firstName = parts[0] || "";
  const lastName = parts.length > 1 ? parts[parts.length - 1] : "";
  return { cleaned, firstName, lastName };
}

function isGenericPlaceholder(value: string) {
  const normalized = cleanSeed(value).toLowerCase();

  if (!normalized) return true;

  const blocked = new Set([
    "your",
    "your creator",
    "creator",
    "me",
    "by me",
    "my page",
    "my profile",
    "your page",
    "your profile",
    "name",
    "profile",
    "user",
    "by your",
    "your next step",
    "your recommends",
    "your finds",
    "your s",
    "my next step",
    "my finds",
    "my recommends",
  ]);

  if (blocked.has(normalized)) return true;
  if (normalized.startsWith("your ")) return true;

  return false;
}

function pickBestAutoName(stepState: any) {
  const directCandidates = [
    stepState?.profile?.full_name,
    stepState?.profile?.name,
    stepState?.profile?.display_name,
    stepState?.user?.full_name,
    stepState?.user?.name,
    stepState?.session?.user?.full_name,
    stepState?.session?.user?.name,
    stepState?.account?.full_name,
    stepState?.account?.name,

    stepState?.positioning?.own_name,
    stepState?.positioning?.brand_name,
    stepState?.positioning?.display_name,

    stepState?.brand?.name,
  ]
    .map((v: any) => cleanSeed(v))
    .filter((v) => v && !isGenericPlaceholder(v));

  if (directCandidates.length > 0) {
    return toTitleCase(directCandidates[0]);
  }

  const emailCandidates = [
    stepState?.profile?.email,
    stepState?.user?.email,
    stepState?.session?.user?.email,
    stepState?.account?.email,
    stepState?.email,
    stepState?.user_email,
    stepState?.customer_email,
  ]
    .map((v: any) => cleanSeed(v))
    .filter(Boolean);

  if (emailCandidates.length > 0) {
    const derived = emailLocalToName(emailCandidates[0]);
    if (derived && !isGenericPlaceholder(derived)) {
      return derived;
    }
  }

  return "";
}

function buildReadyNameOptions(seed: string) {
  const safeSeed = isGenericPlaceholder(seed) ? "" : seed;
  const { cleaned, firstName, lastName } = splitNameParts(safeSeed);

  if (!cleaned) {
    return [
      "Clearer By Design",
      "Better Way Studio",
      "Premium Path Co.",
      "Human Edge Studio",
      "The Clearer Route",
      "Modern Growth Edit",
    ];
  }

  const first = firstName || cleaned;
  const full = cleaned;
  const firstLastInitial =
    firstName && lastName ? `${firstName} ${lastName.charAt(0)}` : first;

  const premiumOptions = [
    full,
    firstLastInitial,
    `By ${first}`,
    `${first} Studio`,
    `${first} Select`,
    `${first} Method`,
    `${first} Edit`,
    `${first} Perspective`,
    `${first} Circle`,
    `${first} Collective`,
    `${first} Co.`,
    `${first} & Co.`,
  ];

  if (lastName) {
    premiumOptions.push(`${lastName} Studio`);
    premiumOptions.push(`${lastName} Select`);
    premiumOptions.push(`${firstName} ${lastName}`);
    premiumOptions.push(`${firstName} ${lastName.charAt(0)}.`);
  }

  return Array.from(
    new Set(
      premiumOptions
        .map((v) => cleanSeed(v))
        .filter((v) => v && !isGenericPlaceholder(v))
    )
  );
}

export default function Step1_Positioning({
  platform,
  stepState,
  onSaveAndContinue,
  saving,
}: Props) {
  const existing = stepState?.positioning || {};
  const autoDetectedName = useMemo(() => pickBestAutoName(stepState), [stepState]);

  const initialOwnName =
    !isGenericPlaceholder(existing.own_name) ? existing.own_name : autoDetectedName || "";
  const initialBrandName =
    !isGenericPlaceholder(existing.brand_name) ? existing.brand_name : "";
  const initialDisplayName =
    !isGenericPlaceholder(existing.display_name) ? existing.display_name : autoDetectedName || "";

  const [nameMode, setNameMode] = useState<"own" | "brand" | "ready">(
    existing.name_mode || (autoDetectedName ? "own" : "ready")
  );

  const [ownName, setOwnName] = useState<string>(initialOwnName);
  const [brandName, setBrandName] = useState<string>(initialBrandName);

  const seedForReadyNames = useMemo(() => {
    const candidate = cleanSeed(
      ownName || brandName || initialDisplayName || autoDetectedName || ""
    );
    return isGenericPlaceholder(candidate) ? "" : candidate;
  }, [ownName, brandName, initialDisplayName, autoDetectedName]);

  const readyNameOptions = useMemo(() => {
    return buildReadyNameOptions(seedForReadyNames);
  }, [seedForReadyNames]);

  const [readyName, setReadyName] = useState<string>(
    !isGenericPlaceholder(existing.ready_name)
      ? existing.ready_name
      : buildReadyNameOptions(
          initialOwnName || initialBrandName || initialDisplayName || autoDetectedName || ""
        )[0] || "Clearer By Design"
  );

  const [selectedLine, setSelectedLine] = useState<string>(
    existing.one_liner || READY_LINE_OPTIONS[0]
  );

  useEffect(() => {
    if (!existing.own_name && autoDetectedName && !ownName) {
      setOwnName(autoDetectedName);
    }
  }, [existing.own_name, autoDetectedName, ownName]);

  useEffect(() => {
    if (nameMode === "ready" && readyNameOptions.length > 0 && !readyNameOptions.includes(readyName)) {
      setReadyName(readyNameOptions[0]);
    }
  }, [nameMode, readyName, readyNameOptions]);

  const finalDisplayName = useMemo(() => {
    if (nameMode === "own") return cleanSeed(ownName);
    if (nameMode === "brand") return cleanSeed(brandName);
    return cleanSeed(readyName);
  }, [nameMode, ownName, brandName, readyName]);

  const effectiveReadyName = useMemo(() => {
    if (readyNameOptions.includes(readyName)) return readyName;
    return readyNameOptions[0] || "Clearer By Design";
  }, [readyName, readyNameOptions]);

  async function handleContinue() {
    await onSaveAndContinue({
      positioning: {
        done: true,
        completed: true,
        name_mode: nameMode,
        own_name: ownName,
        brand_name: brandName,
        auto_detected_name: autoDetectedName || null,
        ready_name: nameMode === "ready" ? effectiveReadyName : readyName,
        display_name: finalDisplayName,
        one_liner: selectedLine,
      },
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
        <p className="text-xs uppercase tracking-[0.16em] text-white/40">Step 1</p>
        <h4 className="mt-2 text-2xl font-extrabold text-white">
          Choose a profile name that feels personal and worth clicking on
        </h4>
        <p className="mt-2 text-sm text-white/65">
          Your profile name should feel human, interesting and easy to trust. The best names usually
          feel connected to the person behind the page — not like a random generic brand.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-5">
          <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
            <p className="text-sm font-semibold text-white">What this step does</p>
            <div className="mt-3 space-y-2 text-sm text-white/75">
              <p>• Gives your profile a stronger first impression</p>
              <p>• Makes the page feel more personal and easier to trust</p>
              <p>• Helps visitors quickly understand the identity behind the page</p>
              <p>• Creates more curiosity before they even click the link</p>
            </div>
          </div>

          <div className="rounded-[24px] border border-emerald-400/15 bg-emerald-500/5 p-5">
            <p className="text-sm font-semibold text-emerald-200">Where this goes</p>
            <div className="mt-3 space-y-3 text-sm text-emerald-100/85">
              <div>
                <p className="font-semibold">Profile Name</p>
                <p className="text-emerald-100/75">
                  Paste this into the visible name field on your {platform} profile.
                </p>
              </div>
              <div>
                <p className="font-semibold">Profile Line</p>
                <p className="text-emerald-100/75">
                  Paste this into your bio intro / profile description area where your platform lets
                  you explain what the page is about.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
            <p className="text-sm font-semibold text-white">Psychology tip</p>
            <div className="mt-3 space-y-2 text-sm text-white/75">
              <p>• Names tied to a real person usually feel warmer and more trustworthy</p>
              <p>• People react better to names that feel human than to stiff generic labels</p>
              <p>• Slight curiosity works better than sounding too “salesy”</p>
              <p>• Faceless brands should still feel like there is a real person behind them</p>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[24px] border border-yellow-400/15 bg-yellow-500/5 p-5">
            <p className="text-sm font-semibold text-yellow-200">Choose your profile name style</p>
            <p className="mt-1 text-xs text-yellow-100/75">
              Pick the option that makes your page feel strongest and most natural.
            </p>

            {autoDetectedName ? (
              <div className="mt-4 rounded-2xl border border-emerald-400/15 bg-emerald-500/5 p-4 text-sm text-emerald-100/85">
                Auto-detected from your account:{" "}
                <span className="font-semibold text-white">{autoDetectedName}</span>
              </div>
            ) : null}

            <div className="mt-4 grid gap-3">
              <button
                type="button"
                onClick={() => setNameMode("own")}
                className={`rounded-2xl border p-4 text-left transition ${
                  nameMode === "own"
                    ? "border-yellow-400/30 bg-yellow-500/10"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                }`}
              >
                <p className="text-sm font-semibold text-white">Use your own name</p>
                <p className="mt-2 text-sm text-white/70">
                  Best if you want the profile to feel personal, trustworthy and real.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setNameMode("brand")}
                className={`rounded-2xl border p-4 text-left transition ${
                  nameMode === "brand"
                    ? "border-yellow-400/30 bg-yellow-500/10"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                }`}
              >
                <p className="text-sm font-semibold text-white">Use your creator / brand name</p>
                <p className="mt-2 text-sm text-white/70">
                  Best if you already have a creator identity or want a faceless premium brand feel.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setNameMode("ready");
                  setReadyName(readyNameOptions[0] || "Clearer By Design");
                }}
                className={`rounded-2xl border p-4 text-left transition ${
                  nameMode === "ready"
                    ? "border-yellow-400/30 bg-yellow-500/10"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                }`}
              >
                <p className="text-sm font-semibold text-white">Use Autoaffi’s personalized suggestions</p>
                <p className="mt-2 text-sm text-white/70">
                  Autoaffi builds these from your account name, email or typed name so they feel more personal and interesting.
                </p>
              </button>
            </div>

            {nameMode === "own" && (
              <div className="mt-4">
                <label className="text-xs uppercase tracking-[0.16em] text-white/40">
                  Your name
                </label>
                <input
                  value={ownName}
                  onChange={(e) => setOwnName(e.target.value)}
                  placeholder="Type your first and last name"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-yellow-400/30"
                />
              </div>
            )}

            {nameMode === "brand" && (
              <div className="mt-4">
                <label className="text-xs uppercase tracking-[0.16em] text-white/40">
                  Creator / brand name
                </label>
                <input
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="Type your creator or brand name"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-yellow-400/30"
                />
              </div>
            )}

            {nameMode === "ready" && (
              <div className="mt-4 grid gap-3">
                {readyNameOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setReadyName(option)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      effectiveReadyName === option
                        ? "border-yellow-400/30 bg-yellow-500/10"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                    }`}
                  >
                    <p className="text-sm text-white">{option}</p>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4">
              <label className="text-xs uppercase tracking-[0.16em] text-white/40">
                Final profile name
              </label>
              <input
                value={finalDisplayName}
                onChange={() => {}}
                readOnly
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none"
              />
            </div>
          </div>

          <div className="rounded-[24px] border border-yellow-400/15 bg-yellow-500/5 p-5">
            <p className="text-sm font-semibold text-yellow-200">Choose your profile line</p>
            <p className="mt-1 text-xs text-yellow-100/75">
              Pick the line that feels most natural for your profile.
            </p>

            <div className="mt-4 grid gap-3">
              {READY_LINE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSelectedLine(option)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    selectedLine === option
                      ? "border-yellow-400/30 bg-yellow-500/10"
                      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                  }`}
                >
                  <p className="text-sm text-white">{option}</p>
                </button>
              ))}
            </div>

            <div className="mt-4">
              <label className="text-xs uppercase tracking-[0.16em] text-white/40">
                Final profile line
              </label>
              <textarea
                value={selectedLine}
                onChange={(e) => setSelectedLine(e.target.value)}
                rows={4}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-yellow-400/30"
              />
            </div>
          </div>

          <div className="rounded-[24px] border border-emerald-400/15 bg-emerald-500/5 p-5">
            <p className="text-sm font-semibold text-emerald-200">Copy-paste result</p>

            <div className="mt-3 space-y-3 text-sm text-emerald-100/85">
              <div>
                <p className="font-semibold">Paste this into your profile name field:</p>
                <div className="mt-1 rounded-xl border border-white/10 bg-black/20 p-3 text-white">
                  {finalDisplayName || "No profile name selected yet."}
                </div>
              </div>

              <div>
                <p className="font-semibold">Paste this into your profile line / intro area:</p>
                <div className="mt-1 rounded-xl border border-white/10 bg-black/20 p-3 text-white">
                  {selectedLine || "No profile line selected yet."}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleContinue}
              disabled={saving || !finalDisplayName || !selectedLine}
              className="mt-5 rounded-2xl bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 px-5 py-3 text-sm font-bold text-black transition hover:scale-[1.01] disabled:opacity-60"
            >
              {saving ? "Saving..." : "Use This & Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}