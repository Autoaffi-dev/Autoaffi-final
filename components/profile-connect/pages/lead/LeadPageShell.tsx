"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AutoaffiPathHero from "../shared/AutoaffiPathHero";

type Props = {
  creatorName?: string;
  guideTitle?: string;
  guideSubtitle?: string;
  imageUrl?: string;
  variantSeed?: string;
  onPrimaryClick?: () => void;

  /**
   * Future-ready for video
   */
  videoUrl?: string;
  videoTitle?: string;
  videoSubtitle?: string;
};

const DEFAULT_GUIDE_TITLE =
  "Start with a simpler first step that feels easier to trust";

const DEFAULT_GUIDE_SUBTITLE =
  "This page is here to help you understand the path more clearly, see what may fit you better, and take a calmer first step before moving forward.";

const SAFE_LEAD_BASES = [
  "/images/profile-connect/beast/autoaffi-story-beast-01.jpg",
  "/images/profile-connect/beast/autoaffi-story-beast-03.jpg",
  "/images/profile-connect/beast/autoaffi-story-beast-06.jpg",
  "/images/profile-connect/beast/autoaffi-story-beast-09.jpg",
] as const;

const DEFAULT_FALLBACK_IMAGE =
  "/images/profile-connect/beast/autoaffi-story-beast-01.jpg";

function normalizeImageUrl(url?: string) {
  return (url || "").trim();
}

function hashString(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickBySeed<T>(items: readonly T[], seed: string, fallback: T): T {
  if (!items.length) return fallback;
  const index = hashString(seed || "autoaffi-lead-default") % items.length;
  return items[index] ?? fallback;
}

function resolveLeadHeroImage(imageUrl?: string, variantSeed?: string) {
  const explicit = normalizeImageUrl(imageUrl);
  if (explicit) return explicit;

  return pickBySeed(
    SAFE_LEAD_BASES,
    `${variantSeed || "autoaffi-lead-default"}-lead-base`,
    DEFAULT_FALLBACK_IMAGE
  );
}

function buildProfileLeadCaptureHref(
  pathname: string,
  search: URLSearchParams | null
) {
  const params = new URLSearchParams(search?.toString() || "");
  const tokenMatch = pathname.match(/\/profile\/lead\/([^/?#]+)/);

  if (!tokenMatch?.[1]) return null;

  const token = tokenMatch[1];

  return `/profile/lead/${encodeURIComponent(token)}/capture${
    params.toString() ? `?${params.toString()}` : ""
  }`;
}

export default function LeadPageShell({
  creatorName,
  guideTitle = DEFAULT_GUIDE_TITLE,
  guideSubtitle = DEFAULT_GUIDE_SUBTITLE,
  imageUrl,
  variantSeed = "autoaffi-lead-default",
  onPrimaryClick,
  videoUrl = "",
  videoTitle = "See how Autoaffi works",
  videoSubtitle = "A short explainer video can be added here later after the lead step.",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const safePathname = pathname || "";

  const leadCaptureHref = useMemo(
    () => buildProfileLeadCaptureHref(safePathname, searchParams),
    [safePathname, searchParams]
  );

  const resolvedImageUrl = useMemo(
    () => resolveLeadHeroImage(imageUrl, variantSeed),
    [imageUrl, variantSeed]
  );

  const hasVideoGuide = Boolean(String(videoUrl || "").trim());

  function handlePrimaryClick() {
    if (onPrimaryClick) {
      onPrimaryClick();
      return;
    }

    if (leadCaptureHref) {
      router.push(leadCaptureHref);
    }
  }

  return (
    <main className="min-h-screen bg-[#040509] text-white">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.10),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.08),transparent_26%),linear-gradient(180deg,#06070a_0%,#040509_100%)]" />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-16 pt-6 md:px-6 md:pb-20 md:pt-8 xl:px-8">
        <AutoaffiPathHero
          eyebrow="AUTOAFFI LEAD PATH"
          title={guideTitle}
          subtitle={guideSubtitle}
          imageUrl={resolvedImageUrl}
          imageAlt="Autoaffi lead path visual"
          variantSeed={variantSeed}
          badgeText="PUBLIC PAGE"
          primaryCtaLabel="Get the Free Guide"
          showSecondaryCta={false}
          onPrimaryClick={handlePrimaryClick}
          supportTitle="A clearer first step"
          supportText="The goal here is to make the path feel more human, more useful and less overwhelming — not more complicated."
          point1Title="Understand the path"
          point1Text="See a simpler overview of what this path is, how it works and where to begin."
          point2Title="See what may fit you"
          point2Text="Get a clearer feel for what may actually suit you instead of guessing blindly."
          point3Title="Move forward more clearly"
          point3Text="Take the next step in a way that feels more natural, more useful and easier to trust."
          hasVideoGuide={hasVideoGuide}
          videoTitle={videoTitle}
          videoSubtitle={videoSubtitle}
        />

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm"
          >
            <div className="inline-flex rounded-full border border-yellow-400/20 bg-yellow-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-100/90">
              Why start here
            </div>

            <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-white md:text-3xl">
              A calmer and clearer first step
            </h2>

            <p className="mt-4 text-sm leading-7 text-white/66 md:text-base">
              This page is designed to make the first step easier to understand.
              Instead of throwing too much at you at once, it helps you see the
              path more clearly, understand what may fit you better, and move
              forward with less confusion.
            </p>

            <div className="mt-6 grid gap-3">
              <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-semibold text-white">
                  Understand the path
                </p>
                <p className="mt-1 text-sm leading-6 text-white/62">
                  See a simpler overview of what this is, how it works and where
                  to begin.
                </p>
              </div>

              <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-semibold text-white">
                  See what may fit
                </p>
                <p className="mt-1 text-sm leading-6 text-white/62">
                  Get a clearer feel for what may actually suit you instead of
                  guessing blindly.
                </p>
              </div>

              <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-semibold text-white">
                  Move forward naturally
                </p>
                <p className="mt-1 text-sm leading-6 text-white/62">
                  Take the next step in a way that feels more useful, more human
                  and easier to trust.
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm"
          >
            <div className="inline-flex rounded-full border border-emerald-400/15 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100/90">
              What you get
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-[22px] border border-white/10 bg-black/20 p-5">
                <p className="text-sm font-semibold text-white">
                  Clearer direction
                </p>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  A simpler way to understand what matters first.
                </p>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-black/20 p-5">
                <p className="text-sm font-semibold text-white">
                  Less overwhelm
                </p>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  A calmer start that feels easier to trust and follow.
                </p>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-black/20 p-5">
                <p className="text-sm font-semibold text-white">
                  Better next move
                </p>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  A more natural path into the next step when you are ready.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-[24px] border border-white/10 bg-black/20 p-5">
              <h3 className="text-lg font-bold text-white">
                What happens after you click
              </h3>
              <p className="mt-3 text-sm leading-7 text-white/66">
                You move to a simple next step where you can request the free
                guide and leave your contact details. Later, this same flow can
                also include a short Autoaffi explainer video.
              </p>

              {hasVideoGuide ? (
                <div className="mt-4 rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm font-semibold text-white">{videoTitle}</p>
                  <p className="mt-2 text-sm leading-6 text-white/60">
                    {videoSubtitle}
                  </p>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={handlePrimaryClick}
              className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 px-6 py-3 text-sm font-extrabold text-[#101218] shadow-[0_12px_30px_rgba(245,158,11,0.24)] transition duration-200 hover:scale-[1.01] hover:brightness-110"
            >
              Get the Free Guide
            </button>

            <p className="mt-3 text-center text-xs tracking-[0.14em] text-white/42 uppercase">
              Free to start • Clearer first step • Easier next move
            </p>
          </motion.div>
        </section>
      </div>
    </main>
  );
}