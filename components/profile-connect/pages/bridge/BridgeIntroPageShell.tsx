"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AutoaffiPathHero from "../shared/AutoaffiPathHero";

type Props = {
  creatorName?: string;
  creatorHeadline?: string;
  creatorIntro?: string;
  imageUrl?: string;
  variantSeed?: string;
  onGuideClick?: () => void;
  onStoryClick?: () => void;
};

function buildGuideHref(pathname: string, search: URLSearchParams | null) {
  const cleanPath = pathname.replace(/\/+$/, "");
  const match = cleanPath.match(/\/profile\/bridge\/([^/]+)$/);

  if (!match?.[1]) return null;

  const token = match[1];
  const params = new URLSearchParams(search?.toString() || "");

  return `/profile/lead/${encodeURIComponent(token)}${
    params.toString() ? `?${params.toString()}` : ""
  }`;
}

function buildStoryHref(pathname: string, search: URLSearchParams | null) {
  const cleanPath = pathname.replace(/\/+$/, "");

  if (cleanPath.endsWith("/story")) {
    const params = search?.toString() || "";
    return `${cleanPath}${params ? `?${params}` : ""}`;
  }

  const params = search?.toString() || "";
  return `${cleanPath}/story${params ? `?${params}` : ""}`;
}

export default function BridgeIntroPageShell({
  creatorName = "Your Creator",
  creatorHeadline = "A more personal look at my path, perspective and next step",
  creatorIntro = "This page is here to make the path feel more personal, more human and easier to understand before the next step.",
  imageUrl = "",
  variantSeed = "autoaffi-bridge-default",
  onGuideClick,
  onStoryClick,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const safePathname = pathname || "";

  const guideHref = useMemo(
    () => buildGuideHref(safePathname, searchParams),
    [safePathname, searchParams]
  );

  const storyHref = useMemo(
    () => buildStoryHref(safePathname, searchParams),
    [safePathname, searchParams]
  );

  function handleGuideClick() {
    if (onGuideClick) {
      onGuideClick();
      return;
    }

    if (guideHref) {
      router.push(guideHref);
    }
  }

  function handleStoryClick() {
    if (onStoryClick) {
      onStoryClick();
      return;
    }

    if (storyHref) {
      router.push(storyHref);
    }
  }

  return (
    <main className="min-h-screen bg-[#040509] text-white">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.10),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.08),transparent_26%),linear-gradient(180deg,#06070a_0%,#040509_100%)]" />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-16 pt-6 md:px-6 md:pb-20 md:pt-8 xl:px-8">
        <AutoaffiPathHero
          eyebrow="AUTOAFFI PERSONAL PATH"
          title={creatorHeadline}
          subtitle={creatorIntro}
          imageUrl=""
          imageAlt={`${creatorName} personal bridge intro`}
          variantSeed={variantSeed}
          badgeText="PERSONAL PAGE"
          primaryCtaLabel="Get the Free Guide"
          secondaryCtaLabel="Learn More About My Story"
          onPrimaryClick={handleGuideClick}
          onSecondaryClick={handleStoryClick}
          showSecondaryCta
          supportTitle=""
          supportText=""
          point1Title="Understand what this is"
          point1Text="Get a clearer feel for what this path actually is and why it may fit you better."
          point2Title="See why it feels different"
          point2Text="Understand why this approach feels calmer, more structured and easier to trust."
          point3Title="Choose your next step"
          point3Text="Decide whether you want the free guide now or want to learn more first."
        />

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm"
          >
            <div className="inline-flex rounded-full border border-yellow-400/20 bg-yellow-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-100/90">
              Start in the way that feels right for you
            </div>

            <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-white md:text-3xl">
              Two simple ways to move forward
            </h2>

            <p className="mt-4 text-sm leading-7 text-white/66 md:text-base">
              Some people want the simplest first step right away. Others want to
              understand the person, the thinking and the reason behind the path
              first. This page gives you both options in a way that feels more
              human, more grounded and easier to trust.
            </p>

            <div className="mt-6 grid gap-3">
              <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-semibold text-white">
                  Get the Free Guide
                </p>
                <p className="mt-1 text-sm leading-6 text-white/62">
                  Choose this if you want a useful first step right away and want
                  something practical you can start with.
                </p>
              </div>

              <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-semibold text-white">
                  Learn More About My Story
                </p>
                <p className="mt-1 text-sm leading-6 text-white/62">
                  Choose this if you want to understand more about me, what I
                  believe works better and why I think this can help other people
                  too.
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
              What you can expect
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-[22px] border border-white/10 bg-black/20 p-5">
                <p className="text-sm font-semibold text-white">
                  Clearer direction
                </p>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Understand the path faster without extra noise or confusion.
                </p>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-black/20 p-5">
                <p className="text-sm font-semibold text-white">
                  More confidence
                </p>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  A calmer first impression that feels more real and easier to
                  trust.
                </p>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-black/20 p-5">
                <p className="text-sm font-semibold text-white">
                  Better next move
                </p>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Choose the next step that feels right for you instead of
                  guessing.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-[24px] border border-white/10 bg-black/20 p-5">
              <h3 className="text-lg font-bold text-white">
                Built to feel personal, not pushy
              </h3>
              <p className="mt-3 text-sm leading-7 text-white/66">
                The goal here is not to pressure anyone. It is to make the path
                feel more real, more useful and easier to connect with before the
                next step.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleGuideClick}
                className="inline-flex flex-1 items-center justify-center rounded-full bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 px-6 py-3 text-sm font-extrabold text-[#101218] shadow-[0_12px_30px_rgba(245,158,11,0.24)] transition duration-200 hover:scale-[1.01] hover:brightness-110"
              >
                Get the Free Guide
              </button>

              <button
                type="button"
                onClick={handleStoryClick}
                className="inline-flex flex-1 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white/88 backdrop-blur-sm transition duration-200 hover:bg-white/[0.07]"
              >
                Learn More About My Story
              </button>
            </div>
          </motion.div>
        </section>
      </div>
    </main>
  );
}