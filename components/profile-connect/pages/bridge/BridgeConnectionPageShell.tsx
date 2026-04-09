"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Props = {
  creatorName?: string;
  creatorImageUrl?: string;
  creatorImageAlt?: string;
  variantSeed?: string;

  connectionHeadline?: string;
  connectionSubheadline?: string;

  whoIAmTitle?: string;
  whoIAmText?: string;

  whatIBelieveTitle?: string;
  whatIBelieveText?: string;

  whyIShareTitle?: string;
  whyIShareText?: string;

  ifYouAreLikeMeTitle?: string;
  ifYouAreLikeMePoints?: string[];

  onContinueClick?: () => void;
  onGuideClick?: () => void;
};

const STORY_BASES = [
  "/images/profile-connect/beast/autoaffi-story-beast-01.jpg",
  "/images/profile-connect/beast/autoaffi-story-beast-02.jpg",
  "/images/profile-connect/beast/autoaffi-story-beast-03.jpg",
  "/images/profile-connect/beast/autoaffi-story-beast-04.jpg",
  "/images/profile-connect/beast/autoaffi-story-beast-05.jpg",
  "/images/profile-connect/beast/autoaffi-story-beast-06.jpg",
  "/images/profile-connect/beast/autoaffi-story-beast-07.jpg",
  "/images/profile-connect/beast/autoaffi-story-beast-08.jpg",
  "/images/profile-connect/beast/autoaffi-story-beast-09.jpg",
  "/images/profile-connect/beast/autoaffi-story-beast-10.jpg",
  "/images/profile-connect/beast/autoaffi-story-beast-11.jpg",
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
  const index = hashString(seed || "autoaffi-story-default") % items.length;
  return items[index] ?? fallback;
}

function resolveStoryImage(imageUrl?: string, variantSeed?: string) {
  const explicit = normalizeImageUrl(imageUrl);
  if (explicit) return explicit;

  return pickBySeed(
    STORY_BASES,
    `${variantSeed || "autoaffi-story-default"}-story-base`,
    DEFAULT_FALLBACK_IMAGE
  );
}

function buildPremiumHref(pathname: string, search: URLSearchParams | null) {
  const cleanPath = pathname.replace(/\/+$/, "");

  if (cleanPath.endsWith("/premium")) {
    const params = search?.toString() || "";
    return `${cleanPath}${params ? `?${params}` : ""}`;
  }

  if (cleanPath.endsWith("/story")) {
    const params = search?.toString() || "";
    return `${cleanPath.replace(/\/story$/, "/premium")}${params ? `?${params}` : ""}`;
  }

  const params = search?.toString() || "";
  return `${cleanPath}/premium${params ? `?${params}` : ""}`;
}

function buildGuideHref(pathname: string, search: URLSearchParams | null) {
  const cleanPath = pathname.replace(/\/+$/, "");

  if (cleanPath.endsWith("/story")) {
    const params = search?.toString() || "";
    return `${cleanPath.replace(/\/story$/, "")}${params ? `?${params}` : ""}`;
  }

  if (cleanPath.endsWith("/premium")) {
    const params = search?.toString() || "";
    return `${cleanPath.replace(/\/premium$/, "")}${params ? `?${params}` : ""}`;
  }

  const params = search?.toString() || "";
  return `${cleanPath}${params ? `?${params}` : ""}`;
}

export default function BridgeConnectionPageShell({
  creatorName,
  creatorImageUrl = "",
  creatorImageAlt = "Autoaffi story visual",
  variantSeed = "autoaffi-story-default",

  connectionHeadline = "A more personal look at why I believe this path can work better",
  connectionSubheadline = "I wanted something that felt clearer, more realistic and easier to trust. That is a big part of why I believe Autoaffi can help people move forward in a calmer and smarter way.",

  whoIAmTitle = "Why this became personal for me",
  whoIAmText = "I know how frustrating it can feel to want more in life, but still feel like you are standing still. Not because you do not care, and not because you are not willing to try, but because everything around you feels unclear, scattered and harder than it should be. That is something I have thought about a lot. I have seen how many people lose time, energy and confidence simply because they never get a path that feels clear enough to follow. Over time, that made this feel personal to me. What pulled me toward Autoaffi was not just the idea of a platform. It was the feeling that this could become something that actually helps people in a more human way. Something that gives structure where there is usually confusion, and something that makes the path feel possible again.",

  whatIBelieveTitle = "What made me believe in this instead",
  whatIBelieveText = "I did not want to put my energy behind something that only looked exciting on the surface. I wanted something that could genuinely make it easier for people to move forward. What I liked here was that it felt like a smarter and more supportive way to help someone build progress. Less chaos. Less guessing. Less feeling like you have to figure out everything alone. More clarity. More direction. More chance to actually keep going when life gets busy or motivation drops. That matters to me, because I do not think most people need more pressure. I think they need a better setup — one that makes success feel more realistic instead of more distant.",

  whyIShareTitle = "Why I want to share this with people",
  whyIShareText = "I want to share this because I know there are people out there who are capable of much more than their current situation shows. Sometimes they do not need a miracle. They need the right path, the right structure and the feeling that they are not doing everything alone. That is what I want this to be about. Not hype. Not empty promises. Not pretending everything is easy. Just a better chance. A clearer path. And a more supportive way for someone to build something real over time. If this can help even one person feel more hope, more direction and more belief in what is possible, then that matters to me. That is why this is worth sharing.",

  ifYouAreLikeMeTitle = "This may connect with you if...",
  ifYouAreLikeMePoints = [
    "You feel like you have more potential than your current results show",
    "You are tired of trying to figure everything out alone",
    "You want a path that feels clearer, calmer and more realistic",
    "You want support, structure and a better chance to actually keep going",
  ],

  onContinueClick,
  onGuideClick,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const safePathname = pathname || "";

  const premiumHref = useMemo(
    () => buildPremiumHref(safePathname, searchParams),
    [safePathname, searchParams]
  );

  const guideHref = useMemo(
    () => buildGuideHref(safePathname, searchParams),
    [safePathname, searchParams]
  );

  const resolvedImage = useMemo(
    () => resolveStoryImage(creatorImageUrl, variantSeed),
    [creatorImageUrl, variantSeed]
  );

  function handleContinueClick() {
    if (onContinueClick) {
      onContinueClick();
      return;
    }

    if (premiumHref) {
      router.push(premiumHref);
    }
  }

  function handleGuideClick() {
    if (onGuideClick) {
      onGuideClick();
      return;
    }

    if (guideHref) {
      router.push(guideHref);
    }
  }

  return (
    <main className="min-h-screen bg-[#040509] text-white">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.10),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.08),transparent_26%),linear-gradient(180deg,#06070a_0%,#040509_100%)]" />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-16 pt-6 md:px-6 md:pb-20 md:pt-8 xl:px-8">
        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#06070a] shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.10),transparent_30%),linear-gradient(180deg,#0a0b10_0%,#06070a_100%)]" />

          <div className="relative grid gap-8 px-6 py-8 md:px-10 md:py-10 xl:grid-cols-[0.98fr_1.02fr] xl:items-center">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="space-y-6"
            >
              <div className="inline-flex rounded-full border border-yellow-400/20 bg-yellow-500/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-yellow-100/90">
                MY PERSPECTIVE
              </div>

              <div>
                <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.04] tracking-tight text-white md:text-5xl xl:text-6xl">
                  {connectionHeadline}
                </h1>

                <p className="mt-5 max-w-3xl text-base leading-8 text-white/78 md:text-[18px]">
                  {connectionSubheadline}
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-1 sm:flex-row">
                <button
                  type="button"
                  onClick={handleGuideClick}
                  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 px-6 py-3 text-sm font-extrabold text-[#111318] shadow-[0_12px_30px_rgba(245,158,11,0.28)] transition duration-200 hover:scale-[1.01] hover:brightness-110"
                >
                  Get the Free Guide
                </button>

                <button
                  type="button"
                  onClick={handleContinueClick}
                  className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white/88 backdrop-blur-sm transition duration-200 hover:bg-white/[0.07]"
                >
                  Continue to the Premium Page
                </button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08 }}
              className="relative"
            >
              <div className="absolute -inset-6 rounded-[36px] bg-[radial-gradient(circle,rgba(251,191,36,0.18),transparent_58%)] blur-2xl" />

              <div className="relative mx-auto w-full max-w-[520px] overflow-hidden rounded-[30px] border border-white/10 bg-[#0b0d12] shadow-[0_25px_70px_rgba(0,0,0,0.5)]">
                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent" />

                <div className="relative p-1 md:p-2">
                  <div className="overflow-hidden rounded-[24px] border border-white/10 bg-black/10">
                    <div className="relative aspect-[4/5] w-full">
                      <img
                        src={resolvedImage}
                        alt={creatorImageAlt}
                        className="absolute inset-0 h-full w-full object-contain"
                      />
                      <div className="absolute inset-0 rounded-[20px] bg-[radial-gradient(circle_at_top_right,rgba(96,165,250,0.10),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(251,191,36,0.12),transparent_30%)]" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="space-y-6"
          >
            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
              <div className="inline-flex rounded-full border border-yellow-400/20 bg-yellow-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-100/90">
                {whoIAmTitle}
              </div>
              <p className="mt-4 text-sm leading-7 text-white/72 md:text-base">
                {whoIAmText}
              </p>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
              <div className="inline-flex rounded-full border border-yellow-400/20 bg-yellow-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-100/90">
                {whatIBelieveTitle}
              </div>
              <p className="mt-4 text-sm leading-7 text-white/72 md:text-base">
                {whatIBelieveText}
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="space-y-6"
          >
            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
              <div className="inline-flex rounded-full border border-emerald-400/15 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100/90">
                {whyIShareTitle}
              </div>
              <p className="mt-4 text-sm leading-7 text-white/72 md:text-base">
                {whyIShareText}
              </p>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
              <div className="inline-flex rounded-full border border-emerald-400/15 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100/90">
                {ifYouAreLikeMeTitle}
              </div>

              <div className="mt-5 grid gap-3">
                {ifYouAreLikeMePoints.map((point, index) => (
                  <div
                    key={`${point}-${index}`}
                    className="rounded-[20px] border border-white/10 bg-black/20 p-4"
                  >
                    <p className="text-sm leading-6 text-white/74">{point}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </section>
      </div>
    </main>
  );
}